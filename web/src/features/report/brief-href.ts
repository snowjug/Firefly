import type { SessionDTO } from '#shared/domain/api.ts';
import type { CoachingReport } from '#shared/domain/report.ts';
import type { ScenarioIndex, ScenarioRef } from './scenario-index.ts';

// The links that carry a call's settings to the scenario pages. The keys are a contract with the
// scenario workspace and the brief page, which read the same query: difficulty, impact, temperature
// (the starting temperature id), proficiency, style, stage (the call stage id), curveballs (`none`
// or a comma-separated list of types) and hints (`on` for guided practice, `off` for immersive).
//
// A call can name a scenario that no longer exists (it was saved before the Microsoft scenarios), so
// every link here that names a scenario has a way back to the scenario list instead.

export const SCENARIO_LIST = '/scenarios';

/**
 * Which unexpected turns to ask for when repeating a call.
 *
 * A session reports only whether unexpected turns were switched on, not which ones. So: `none`
 * when they were off; the kind that actually came up when the report names one; and no key at all
 * (the difficulty's own default) when they were on but none came up.
 */
function curveballsFor(session: SessionDTO): string | null {
  if (!session.scenario.config.curveballsEnabled) return 'none';
  return session.report?.curveball?.type ?? null;
}

/** The brief page for the same scenario with the same settings as this call. */
export function toBriefHref(session: SessionDTO): string {
  const { scenarioId, config } = session.scenario;
  const query = new URLSearchParams();
  query.set('difficulty', config.difficulty);
  query.set('impact', config.impact);
  query.set('temperature', config.startingTemperature);
  query.set('proficiency', config.proficiency);
  query.set('style', config.style);
  query.set('stage', config.callStage);
  const curveballs = curveballsFor(session);
  if (curveballs !== null) query.set('curveballs', curveballs);
  query.set('hints', config.mode === 'guided' ? 'on' : 'off');
  return `/scenarios/${encodeURIComponent(scenarioId)}/brief?${query}`;
}

/**
 * Whether a scenario can be opened. Once the list of scenarios has arrived it is the list that
 * decides. Until then (or if it never arrives) a call saved before the Microsoft scenarios, which
 * has no product, is taken to name a retired scenario, and any other call is given the benefit of
 * the doubt: the brief page says so itself if the scenario has gone.
 */
export function scenarioExists(
  index: ScenarioIndex,
  scenarioId: string,
  session: SessionDTO,
): boolean {
  if (index.state === 'ready') return index.byId.has(scenarioId);
  return session.scenario.product !== null;
}

export interface RepeatLink {
  to: string;
  /** False when the scenario is gone: the link then opens the scenario list. */
  available: boolean;
}

/** Where "Repeat scenario" goes: the same scenario with the same settings, or else the list. */
export function repeatLink(session: SessionDTO, index: ScenarioIndex): RepeatLink {
  return scenarioExists(index, session.scenario.scenarioId, session)
    ? { to: toBriefHref(session), available: true }
    : { to: SCENARIO_LIST, available: false };
}

export interface PracticeLink {
  to: string;
  /** The recommended scenario, when it can be opened. */
  scenario: { title: string; product: string | null } | null;
}

/** Where "Practise this scenario" goes: the suggested scenario at the suggested difficulty, or else the list. */
export function practiceLink(
  session: SessionDTO,
  next: CoachingReport['nextPractice'],
  index: ScenarioIndex,
): PracticeLink {
  const id = next.suggestedScenarioId;
  if (id === null || !scenarioExists(index, id, session)) {
    return { to: SCENARIO_LIST, scenario: null };
  }
  const known: ScenarioRef | undefined = index.state === 'ready' ? index.byId.get(id) : undefined;
  const title = known?.title ?? next.suggestedScenarioTitle;
  const query = new URLSearchParams({ scenario: id, difficulty: next.suggestedDifficulty });
  return {
    to: `${SCENARIO_LIST}?${query}`,
    scenario: title ? { title, product: known?.product?.name ?? null } : null,
  };
}
