import type { SessionDTO } from '#shared/domain/api.ts';
import type { CoachingReport } from '#shared/domain/report.ts';

// The two links that carry a call's settings to the scenario pages. The keys are a contract with the
// scenario workspace and the brief page, which read the same query: difficulty, impact, temperature
// (the starting temperature id), proficiency, style, stage (the call stage id), curveballs (`none`
// or a comma-separated list of types) and hints (`on` for guided practice, `off` for immersive).

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

/** The brief page for the same scenario with the same settings as this call: "Repeat this scenario". */
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

/** The scenario workspace with the suggested scenario and difficulty chosen: "Practise this next". */
export function practiceHref(next: CoachingReport['nextPractice']): string {
  if (!next.suggestedScenarioId) return '/scenarios';
  const query = new URLSearchParams({
    scenario: next.suggestedScenarioId,
    difficulty: next.suggestedDifficulty,
  });
  return `/scenarios?${query}`;
}
