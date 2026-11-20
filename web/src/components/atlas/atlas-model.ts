import type { PublicScenarioDTO, SessionSummaryDTO } from '#shared/domain/api.ts';
import { DIFFICULTY_PROFILES } from '#shared/domain/state.ts';
import {
  CALL_STAGE_LABELS,
  DIMENSIONS,
  IMPACT_LABELS,
  type BusinessImpact,
  type CallStage,
  type Difficulty,
  type DimensionId,
  type IssueType,
  type StartTemperature,
} from '#shared/domain/vocab.ts';
import { isFullCall } from '../dashboard/dashboard-model.ts';
import { scoreOfFive } from '../report/labels.ts';
import { fold } from '../scenario/library-filters.ts';
import { issueTypesOf, scenariosOfIssue } from '../scenario/setup-model.ts';

// The mission universe: the scenario library as an interactive map. This file turns scenarios and
// the trainee's own saved practice into a model (families, missions and the way each one is
// encoded), and says which missions a lens (a search and filters) lights up. Where each mission is
// drawn lives in atlas-layout.ts. Everything is worked out from stored data only: a new trainee
// gets missions that are all "new", and nothing here carries a hidden fact or an evaluator
// criterion, because the public scenario has none.

export { ATLAS_BOUNDS, MIN_MISSION_DISTANCE, layoutAtlas } from './atlas-layout.ts';
export type { AtlasAnchor, AtlasLayout, AtlasLayoutOptions, AtlasNode } from './atlas-layout.ts';

/** What each issue type is called on the map, in the order of the vocabulary. */
export const ATLAS_FAMILY_LABELS: Record<IssueType, string> = {
  'sign-in-access': 'Access and Identity',
  'service-outage': 'Service Availability',
  'slow-performance': 'Performance',
  'data-missing': 'Data and Recovery',
  'billing-licence': 'Billing and Licensing',
  'how-to': 'Guidance and How-To',
  'feature-not-working': 'Unexpected Behaviour',
};

export type MissionStatus = 'new' | 'attempted' | 'completed';

export interface AtlasFamily {
  /** The issue type the family is made of. */
  id: IssueType;
  label: string;
  /** Its missions, gentlest first. */
  missionIds: string[];
  /** How many of them have been completed at least once. */
  completed: number;
}

export interface AtlasMission {
  id: string;
  title: string;
  summary: string;
  tags: string[];
  persona: { name: string; role: string; organisation: string };
  coachingFocus: DimensionId[];
  /** The family it belongs to: the scenario's issue type. */
  family: IssueType;
  familyLabel: string;
  difficulty: Difficulty;
  impact: BusinessImpact;
  /** Difficulty as rings around the mission: starter 1, standard 2, challenge 3. */
  rings: 1 | 2 | 3;
  /** Business impact as size: low 1, medium 2, high 3. */
  size: 1 | 2 | 3;
  start: StartTemperature;
  stage: CallStage;
  minutes: number;
  /**
   * `new` until a call is started; `attempted` once one was started but none was taken to a close
   * (still open, ended early, or waiting on its report); `completed` after at least one full call.
   */
  status: MissionStatus;
  /** Calls started on this scenario, whatever happened to them. Samples are never counted. */
  attempts: number;
  /** The best overall score among its full calls, or null when none has a score. */
  best: number | null;
  recommended: boolean;
  /** What the call is built to practise, as skill names. */
  focus: string[];
  /** Plain English for assistive technology: what it is, and where the trainee stands. */
  description: string;
}

export interface AtlasModel {
  /** Only families that have a mission, in the order of the issue type vocabulary. */
  families: AtlasFamily[];
  /** Grouped by family, then gentlest first, so the order never depends on how they were listed. */
  missions: AtlasMission[];
}

const RINGS: Record<Difficulty, AtlasMission['rings']> = { starter: 1, standard: 2, challenge: 3 };
const SIZES: Record<BusinessImpact, AtlasMission['size']> = { low: 1, medium: 2, high: 3 };

// ------------------------------------------------------------------------------------------
// Words

const lower = (text: string) => text.toLowerCase();

/** The text with a full stop, unless it already ends the way a sentence does. */
const sentence = (text: string) => {
  const trimmed = text.trim();
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
};

type MissionFacts = Omit<AtlasMission, 'description'>;

function standing(mission: MissionFacts): string {
  if (mission.status === 'completed') {
    return mission.best === null
      ? 'Completed.'
      : `Completed, best score ${scoreOfFive(mission.best)}.`;
  }
  return mission.status === 'attempted' ? 'Started, not completed yet.' : 'Not tried yet.';
}

/**
 * One sentence-like description that says everything the picture says (what it is, how demanding,
 * where the trainee stands), so the map never relies on colour or shape alone. It names the
 * public settings only, never anything about how a call is scored.
 */
export function describeMission(mission: MissionFacts): string {
  const minutes = mission.minutes === 1 ? 'about 1 minute' : `about ${mission.minutes} minutes`;
  const facts = [
    DIFFICULTY_PROFILES[mission.difficulty].label,
    `${lower(IMPACT_LABELS[mission.impact].label)} impact`,
    `customer starts ${mission.start}`,
    lower(CALL_STAGE_LABELS[mission.stage].label),
    minutes,
  ].join(', ');
  const parts = [
    sentence(mission.title),
    sentence(mission.familyLabel),
    sentence(facts),
    standing(mission),
  ];
  if (mission.recommended) parts.push('Suggested next.');
  return parts.join(' ');
}

/** What a family holds, for the label on the map and the heading in the list. */
export function describeFamily(
  family: Pick<AtlasFamily, 'label' | 'missionIds' | 'completed'>,
): string {
  const count = family.missionIds.length;
  const missions = count === 1 ? '1 mission' : `${count} missions`;
  const done = family.completed === 0 ? 'none completed yet' : `${family.completed} completed`;
  return `${family.label}: ${missions}, ${done}.`;
}

// ------------------------------------------------------------------------------------------
// Building the model

interface Practice {
  attempts: number;
  completed: boolean;
  best: number | null;
}

/** Samples are demonstration data, so they are skipped; only full calls count towards a score. */
function summarisePractice(sessions: readonly SessionSummaryDTO[]): Map<string, Practice> {
  const result = new Map<string, Practice>();
  for (const session of sessions) {
    if (session.isSample) continue;
    const entry = result.get(session.scenarioId) ?? { attempts: 0, completed: false, best: null };
    entry.attempts += 1;
    if (isFullCall(session)) {
      entry.completed = true;
      const score = session.overallScore;
      if (score !== null && Number.isFinite(score)) {
        entry.best = entry.best === null ? score : Math.max(entry.best, score);
      }
    }
    result.set(session.scenarioId, entry);
  }
  return result;
}

/** One of each id, in id order, so ties further down are settled the same way every time. */
function uniqueById(scenarios: readonly PublicScenarioDTO[]): PublicScenarioDTO[] {
  const seen = new Set<string>();
  const unique: PublicScenarioDTO[] = [];
  for (const scenario of scenarios) {
    if (seen.has(scenario.id)) continue;
    seen.add(scenario.id);
    unique.push(scenario);
  }
  return unique.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

function toMission(
  scenario: PublicScenarioDTO,
  practice: Practice | undefined,
  recommended: boolean,
): AtlasMission {
  const attempts = practice?.attempts ?? 0;
  const facts: MissionFacts = {
    id: scenario.id,
    title: scenario.title,
    summary: scenario.summary,
    tags: [...scenario.tags],
    // Picked field by field so nothing else a server might add can ride along.
    persona: {
      name: scenario.persona.name,
      role: scenario.persona.role,
      organisation: scenario.persona.organisation,
    },
    coachingFocus: [...scenario.coachingFocus],
    family: scenario.issueType,
    familyLabel: ATLAS_FAMILY_LABELS[scenario.issueType],
    difficulty: scenario.difficulty,
    impact: scenario.impact,
    rings: RINGS[scenario.difficulty],
    size: SIZES[scenario.impact],
    start: scenario.startingTemperature,
    stage: scenario.callStage,
    minutes: scenario.estimatedMinutes,
    status: practice?.completed ? 'completed' : attempts > 0 ? 'attempted' : 'new',
    attempts,
    best: practice?.best ?? null,
    recommended,
    focus: scenario.coachingFocus.map((id) => DIMENSIONS[id]?.label ?? id),
  };
  return { ...facts, description: describeMission(facts) };
}

/**
 * The model for the map. A call that was started and not taken to a close (still running, ended
 * early or awaiting its report) makes a mission "attempted"; a full call makes it "completed".
 * Scenarios with an issue type the vocabulary does not know are left out rather than guessed at.
 */
export function buildAtlas(
  scenarios: readonly PublicScenarioDTO[],
  sessions: readonly SessionSummaryDTO[],
  recommendedId: string | null,
): AtlasModel {
  const practice = summarisePractice(sessions);
  const library = uniqueById(scenarios);
  const families: AtlasFamily[] = [];
  const missions: AtlasMission[] = [];
  for (const issueType of issueTypesOf(library)) {
    const inFamily = scenariosOfIssue(library, issueType).map((scenario) =>
      toMission(scenario, practice.get(scenario.id), scenario.id === recommendedId),
    );
    families.push({
      id: issueType,
      label: ATLAS_FAMILY_LABELS[issueType],
      missionIds: inFamily.map((mission) => mission.id),
      completed: inFamily.filter((mission) => mission.status === 'completed').length,
    });
    missions.push(...inFamily);
  }
  return { families, missions };
}

// ------------------------------------------------------------------------------------------
// Lens

/** What the trainee is looking through: a search and filters. Null means "any". */
export interface AtlasLens {
  query: string;
  difficulty: Difficulty | null;
  impact: BusinessImpact | null;
  family: string | null;
  status: AtlasMission['status'] | null;
}

export const EMPTY_LENS: AtlasLens = {
  query: '',
  difficulty: null,
  impact: null,
  family: null,
  status: null,
};

const searchTerms = (query: string) => fold(query).split(/\s+/).filter(Boolean);

/** True when the lens narrows nothing, so no mission should be dimmed. */
export function isLensEmpty(lens: AtlasLens): boolean {
  return (
    searchTerms(lens.query).length === 0 &&
    !lens.difficulty &&
    !lens.impact &&
    !lens.family &&
    !lens.status
  );
}

const haystacks = new WeakMap<AtlasMission, string>();

/** Everything a person can read about a mission on the map and might search for. */
function haystack(mission: AtlasMission): string {
  let text = haystacks.get(mission);
  if (text === undefined) {
    text = fold(
      [
        mission.title,
        mission.summary,
        mission.persona.name,
        mission.persona.role,
        mission.persona.organisation,
        ...mission.tags,
        mission.familyLabel,
      ].join('\n'),
    );
    haystacks.set(mission, text);
  }
  return text;
}

/**
 * The missions the lens lights up. Every word typed must appear somewhere, ignoring case and
 * accents, and every filter must agree. An empty lens lights them all. Where the missions sit never
 * depends on the lens, so a search dims the map rather than rearranging it.
 */
export function applyLens(
  model: AtlasModel,
  lens: AtlasLens,
): { matches: Set<string>; count: number } {
  const terms = searchTerms(lens.query);
  const matches = new Set<string>();
  for (const mission of model.missions) {
    if (lens.difficulty && mission.difficulty !== lens.difficulty) continue;
    if (lens.impact && mission.impact !== lens.impact) continue;
    if (lens.family && mission.family !== lens.family) continue;
    if (lens.status && mission.status !== lens.status) continue;
    if (terms.length > 0) {
      const text = haystack(mission);
      if (!terms.every((term) => text.includes(term))) continue;
    }
    matches.add(mission.id);
  }
  return { matches, count: matches.size };
}
