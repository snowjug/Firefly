import type {
  PublicScenarioDTO,
  SessionDTO,
  SessionSummaryDTO,
  TurnDTO,
  TurnMarker,
} from '#shared/domain/api.ts';
import { availableCurveballTypes, GENERIC_STAGE_FRAMES } from '#shared/domain/config.ts';
import { CALL_STAGES, type CallStage } from '#shared/domain/vocab.ts';
import { CoachingReportSchema, type CoachingReport } from '#shared/domain/report.ts';
import type { ScenarioDefinition } from '#shared/domain/scenario.ts';
import type { StateEvent } from '#shared/domain/state.ts';
import { publicState } from '../engine/session.ts';
import type { SessionRow, TurnRow } from '../db/repository.ts';

// Mapping from stored rows to the JSON the web app sees. Hidden facts, evaluator notes and raw
// engine state never appear here; the only things revealed about a call are those a trainee may
// legitimately see, and (after the call ends) the report and transcript annotations.

export function toPublicScenario(def: ScenarioDefinition): PublicScenarioDTO {
  return {
    id: def.id,
    version: def.version,
    title: def.title,
    summary: def.summary,
    tags: def.tags,
    estimatedMinutes: def.estimatedMinutes,
    issueType: def.issueType,
    impact: def.impact,
    startingTemperature: def.startingTemperature,
    proficiency: def.proficiency,
    style: def.style,
    callStage: def.callStage,
    difficulty: def.difficulty,
    persona: {
      name: def.persona.name,
      role: def.persona.role,
      organisation: def.persona.organisation,
    },
    brief: def.brief,
    stageBriefs: Object.fromEntries(
      CALL_STAGES.map((stage) => [
        stage,
        (def.stageFrames[stage] ?? GENERIC_STAGE_FRAMES[stage]).brief,
      ]),
    ) as Record<CallStage, string>,
    expectedDiscoveryAreas: def.expectedDiscoveryAreas,
    coachingFocus: def.coachingFocus,
    curveballOptions: availableCurveballTypes(def),
    synthetic: true,
  };
}

export function toSummary(row: SessionRow, traineeTurns: number): SessionSummaryDTO {
  const cfg = row.scenario.config;
  const durationSeconds =
    row.endedAt === null
      ? null
      : Math.max(0, Math.round((Date.parse(row.endedAt) - Date.parse(row.startedAt)) / 1000));
  return {
    id: row.id,
    scenarioId: row.scenarioId,
    scenarioTitle: row.scenarioTitle,
    issueType: row.scenario.issueType,
    difficulty: cfg.difficulty,
    startingTemperature: cfg.startingTemperature,
    impact: cfg.impact,
    style: cfg.style,
    mode: row.mode,
    providerKind: row.providerKind,
    providerLabel: row.providerLabel,
    status: row.status,
    startedAt: row.startedAt,
    endedAt: row.endedAt,
    durationSeconds,
    traineeTurns,
    completion: row.completion,
    overallScore: row.overallScore,
    dimensionScores: row.dimensionScores,
  };
}

function markersFor(
  row: SessionRow,
  events: StateEvent[],
  hiddenLabels: Map<string, string>,
): Map<number, TurnMarker[]> {
  const byTurn = new Map<number, TurnMarker[]>();
  const add = (index: number, marker: TurnMarker) => {
    const list = byTurn.get(index) ?? [];
    list.push(marker);
    byTurn.set(index, list);
  };
  for (const e of events) {
    if (e.key !== 'temperature' || Math.abs(e.delta) < 3) continue;
    add(e.turnIndex, {
      kind: e.category === 'curveball' ? 'curveball' : 'state',
      label: e.reason,
      detail: `${e.delta > 0 ? 'Customer temperature up' : 'Customer temperature down'} (${e.delta > 0 ? '+' : ''}${e.delta})`,
      delta: e.delta,
    });
  }
  for (const record of Object.values(row.runtime.discovery)) {
    const label = hiddenLabels.get(record.factId) ?? 'A hidden fact';
    add(record.turnIndex, {
      kind: 'discovery',
      label: record.status === 'discovered' ? `Uncovered: ${label}` : `Partly uncovered: ${label}`,
    });
  }
  return byTurn;
}

export function toTurnDTOs(row: SessionRow, turns: TurnRow[], events: StateEvent[]): TurnDTO[] {
  const completed = row.status === 'completed';
  const labels = new Map(row.scenario.hiddenFacts.map((f) => [f.id, f.label] as const));
  const markers = completed ? markersFor(row, events, labels) : new Map<number, TurnMarker[]>();
  return turns.map((t) => ({
    index: t.idx,
    role: t.role,
    text: t.text,
    createdAt: t.createdAt,
    source: t.source,
    inputMode: t.inputMode,
    ...(completed && markers.has(t.idx) ? { markers: markers.get(t.idx) } : {}),
  }));
}

export function parseStoredReport(raw: unknown): CoachingReport | null {
  const parsed = CoachingReportSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

function awaitingReplyFor(row: SessionRow, turns: TurnRow[]): SessionDTO['awaitingReply'] {
  const last = turns[turns.length - 1];
  if (row.status !== 'active' || last?.role !== 'trainee' || !last.clientMessageId) return null;
  return { clientMessageId: last.clientMessageId, turnIndex: last.idx };
}

export function toSessionDTO(
  row: SessionRow,
  turns: TurnRow[],
  events: StateEvent[],
  storedReport: unknown,
): SessionDTO {
  const traineeTurns = turns.filter((t) => t.role === 'trainee').length;
  const cfg = row.scenario.config;
  return {
    ...toSummary(row, traineeTurns),
    scenario: {
      scenarioId: row.scenarioId,
      title: row.scenarioTitle,
      summary: row.scenario.summary,
      issueType: row.scenario.issueType,
      tags: row.scenario.tags,
      estimatedMinutes: row.scenario.estimatedMinutes,
      persona: {
        name: row.scenario.persona.name,
        role: row.scenario.persona.role,
        organisation: row.scenario.persona.organisation,
      },
      brief: row.scenario.brief,
      config: {
        impact: cfg.impact,
        startingTemperature: cfg.startingTemperature,
        proficiency: cfg.proficiency,
        style: cfg.style,
        callStage: cfg.callStage,
        difficulty: cfg.difficulty,
        mode: cfg.mode,
        curveballsEnabled: cfg.curveballTypes.length > 0,
      },
      expectedDiscoveryAreas: row.scenario.expectedDiscoveryAreas,
      coachingFocus: row.scenario.coachingFocus,
    },
    turns: toTurnDTOs(row, turns, events),
    state: publicState(row.runtime),
    awaitingReply: awaitingReplyFor(row, turns),
    evaluationPhase: row.evaluationPhase,
    evaluationError: row.evaluationError,
    report: row.status === 'completed' ? parseStoredReport(storedReport) : null,
  };
}
