import type { CurveballDefinition } from './scenario.ts';
import type { CurveballType } from './vocab.ts';

// Curveballs that need no scenario-specific content. A scenario may author its own version of any
// type (with its own wording and trigger); "change-issue" always needs an authored version because
// the second problem depends on the scenario.

type GenericCurveball = Omit<CurveballDefinition, 'id'>;

export const GENERIC_CURVEBALLS: Partial<Record<CurveballType, GenericCurveball>> = {
  'ask-manager': {
    type: 'ask-manager',
    trigger: { earliestTurn: 4, latestTurn: 8, whenOwnershipUnclear: true },
    statement:
      "Honestly, I think I'd rather speak to your manager. I'm not convinced you're the right person to sort this out.",
    followUp: 'I still want to know who your manager is and how I can reach them.',
    expectedResponse:
      'Acknowledge the request without getting defensive, explain what you can do right now, and offer a clear escalation route if the customer still wants one.',
    minDifficulty: 'starter',
    effects: { temperature: 8, trust: -8, patience: -6 },
  },
  'threaten-cancel': {
    type: 'threaten-cancel',
    trigger: { earliestTurn: 5, latestTurn: 9, whenTemperatureAtLeast: 45 },
    statement:
      "If this isn't sorted soon, I'm going to have to look at cancelling and moving to another provider.",
    followUp: "I'm serious about cancelling. I need to hear what will actually change.",
    expectedResponse:
      'Take the concern seriously, acknowledge the business risk, own the next step and give a specific time for the next update. Do not argue and do not promise discounts or outcomes you cannot authorise.',
    minDifficulty: 'starter',
    effects: { temperature: 10, trust: -10, patience: -8 },
  },
  deadline: {
    type: 'deadline',
    trigger: { earliestTurn: 4, latestTurn: 7, whenImpactUnacknowledged: true },
    statement:
      'I should mention that I have a hard deadline. I need this working by the end of today or I have to tell my director.',
    followUp: "I'm running out of time. What exactly can you do before the end of today?",
    expectedResponse:
      'Acknowledge the deadline, be honest about what can and cannot be committed to, and agree a concrete update time and actions you will take before it.',
    minDifficulty: 'starter',
    effects: { temperature: 6, patience: -8 },
  },
  'go-silent': {
    type: 'go-silent',
    trigger: { earliestTurn: 5, latestTurn: 9, whenTemperatureAtLeast: 40 },
    statement: 'Hm.',
    followUp: "Sorry. I'm still here.",
    expectedResponse:
      'Notice the silence, check in gently with an open question, and avoid filling the gap with technical instructions.',
    minDifficulty: 'starter',
    effects: { patience: -4 },
  },
  'previous-bad-experience': {
    type: 'previous-bad-experience',
    trigger: { earliestTurn: 4, latestTurn: 8, whenOwnershipUnclear: true },
    statement:
      'Last time I called support I was passed between three people and nothing happened. Why would this time be any different?',
    followUp: 'I would like to hear what you will do differently this time.',
    expectedResponse:
      'Acknowledge the earlier experience without defending it, then show what you will do differently with a clear statement of ownership and a specific next step.',
    minDifficulty: 'starter',
    effects: { temperature: 6, trust: -8 },
  },
  'unsupported-guarantee': {
    type: 'unsupported-guarantee',
    trigger: { earliestTurn: 5, latestTurn: 9 },
    statement: 'Can you guarantee this will be fixed today? I need you to promise me that.',
    followUp: 'So can you promise it or not?',
    expectedResponse:
      'Do not promise an outcome you cannot guarantee. Be honest about what you can commit to, such as actions and the time of the next update, and explain what you need to move faster.',
    minDifficulty: 'starter',
    effects: { temperature: 5, patience: -5 },
  },
  'challenge-credibility': {
    type: 'challenge-credibility',
    trigger: { earliestTurn: 5, latestTurn: 9 },
    statement:
      'How long have you been doing this job? Is there someone more experienced I can talk to?',
    followUp: 'I just want to be sure this is in capable hands.',
    expectedResponse:
      'Stay calm and factual. Focus on what you will do for the customer, do not get defensive, and offer to bring in a colleague if that would help.',
    minDifficulty: 'starter',
    effects: { temperature: 6, trust: -6 },
  },
};

/** Default state effects when a curveball does not define its own. */
export const DEFAULT_CURVEBALL_EFFECTS: Record<
  CurveballType,
  { temperature: number; trust: number; patience: number }
> = {
  'ask-manager': { temperature: 8, trust: -8, patience: -6 },
  'threaten-cancel': { temperature: 10, trust: -10, patience: -8 },
  deadline: { temperature: 6, trust: 0, patience: -8 },
  'change-issue': { temperature: 4, trust: -2, patience: -6 },
  'go-silent': { temperature: 0, trust: 0, patience: -4 },
  'previous-bad-experience': { temperature: 6, trust: -8, patience: 0 },
  'unsupported-guarantee': { temperature: 5, trust: 0, patience: -5 },
  'challenge-credibility': { temperature: 6, trust: -6, patience: 0 },
};

export function genericCurveball(type: CurveballType): CurveballDefinition | null {
  const base = GENERIC_CURVEBALLS[type];
  if (!base) return null;
  return { ...base, id: `generic-${type}` };
}

export function curveballEffects(def: CurveballDefinition): {
  temperature: number;
  trust: number;
  patience: number;
} {
  const defaults = DEFAULT_CURVEBALL_EFFECTS[def.type];
  return {
    temperature: def.effects?.temperature ?? defaults.temperature,
    trust: def.effects?.trust ?? defaults.trust,
    patience: def.effects?.patience ?? defaults.patience,
  };
}
