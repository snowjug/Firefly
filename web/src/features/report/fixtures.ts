import type { SessionDTO } from '#shared/domain/api.ts';
import type { TurnClassification } from '#shared/domain/classification.ts';
import { applyConfig } from '#shared/domain/config.ts';
import { CoachingReportSchema, type CoachingReport } from '#shared/domain/report.ts';
import type { ScenarioOverrides } from '#shared/domain/scenario.ts';
import { startingState, type StateEvent } from '#shared/domain/state.ts';
import type { DimensionId, EvaluationPhase, PracticeMode } from '#shared/domain/vocab.ts';
import type { SessionRow, TurnRow } from '#server/db/repository.ts';
import { simulate } from '#server/engine/simulate.ts';
import type { EvaluationInput } from '#server/engine/types.ts';
import { evaluateWithRules } from '#server/evaluator/rules.ts';
import { MOCK_PROMPTS } from '#server/providers/mock.ts';
import { getScenarioLibrary } from '#server/scenarios/index.ts';
import { toSessionDTO } from '#server/services/dto.ts';

// Fixtures for the report page, made by the REAL simulation engine, the REAL rules evaluator and
// the REAL session mapping (`toSessionDTO`), so the wording, the evidence, the state markers and
// the shape of every field are exactly what the server sends. Nothing here is written by hand
// except what the trainee said. Used by the tests and by the development gallery only.

/** What the mock provider is called in stored sessions. */
export const FIXTURE_PROVIDER_LABEL = 'Demo mode (built-in rules engine)';

const GENERATED_AT = new Date('2026-11-19T14:31:00.000Z');

export interface CallSpec {
  id: string;
  scenarioId: string;
  overrides?: ScenarioOverrides;
  mode?: PracticeMode;
  /** What the trainee said, turn by turn. */
  lines: readonly string[];
  /** The 1-based numbers (among the trainee's turns) of the turns that were spoken, not typed. */
  spoken?: readonly number[];
  /** The call stopped before a natural close. */
  endedEarly?: boolean;
  startedAt?: string;
}

export interface CallFixture {
  spec: CallSpec;
  /** The completed session exactly as `GET /api/sessions/:id` returns it. */
  session: SessionDTO;
  /** The same report as `session.report`, validated against `CoachingReportSchema`. */
  report: CoachingReport;
  input: EvaluationInput;
  row: SessionRow;
  turnRows: TurnRow[];
  events: StateEvent[];
}

const DEFAULT_START = '2026-11-19T14:19:08.000Z';

/** How long a typed or spoken turn takes, so the transcript clock looks like a real call. */
const secondsFor = (text: string) => Math.round(7 + text.length / 6);

export async function buildCall(spec: CallSpec): Promise<CallFixture> {
  const library = getScenarioLibrary();
  const base = library.find((s) => s.id === spec.scenarioId);
  if (!base) throw new Error(`No scenario ${spec.scenarioId}`);
  const mode = spec.mode ?? 'immersive';
  const scenario = applyConfig(base, spec.overrides ?? {}, { mode, seed: 7 });
  const sim = await simulate(scenario, [...spec.lines]);

  const classifications: Record<number, TurnClassification> = {};
  sim.turns.forEach((turn, i) => (classifications[2 + 2 * i] = turn.classification));

  const startedAtMs = Date.parse(spec.startedAt ?? DEFAULT_START);
  const spoken = new Set(spec.spoken ?? []);
  let clock = 0;
  let traineeNumber = 0;
  const turnRows: TurnRow[] = sim.transcript.map((turn) => {
    if (turn.index > 1) clock += turn.role === 'trainee' ? secondsFor(turn.text) : 3;
    if (turn.role === 'trainee') traineeNumber += 1;
    return {
      idx: turn.index,
      role: turn.role,
      text: turn.text,
      source: turn.index === 1 ? 'opening' : turn.role === 'trainee' ? 'trainee' : 'demo',
      inputMode: turn.role === 'trainee' && spoken.has(traineeNumber) ? 'voice' : 'text',
      clientMessageId: turn.role === 'trainee' ? `fixture-${spec.id}-${turn.index}` : null,
      classification: classifications[turn.index] ?? null,
      createdAt: new Date(startedAtMs + clock * 1000).toISOString(),
    };
  });
  const endedAt = new Date(startedAtMs + (clock + 6) * 1000).toISOString();

  const input: EvaluationInput = {
    scenario,
    turns: sim.transcript,
    classifications,
    stateEvents: sim.events,
    discovery: sim.runtime.discovery,
    startState: startingState({
      startingTemperature: scenario.config.startingTemperature,
      difficulty: scenario.config.difficulty,
      callStage: scenario.config.callStage,
      impact: scenario.config.impact,
    }),
    finalState: sim.runtime.customer,
    endedEarly: spec.endedEarly ?? false,
    durationSeconds: clock + 6,
    provider: { kind: 'mock', label: FIXTURE_PROVIDER_LABEL },
    library: library.map((s) => ({
      id: s.id,
      title: s.title,
      difficulty: s.difficulty,
      coachingFocus: s.coachingFocus,
    })),
  };
  const report = CoachingReportSchema.parse(evaluateWithRules(input, { now: GENERATED_AT }));

  const row: SessionRow = {
    id: spec.id,
    profileId: 'fixture-profile',
    scenarioId: scenario.scenarioId,
    scenarioTitle: scenario.title,
    scenarioVersion: scenario.scenarioVersion,
    scenario,
    mode,
    providerKind: 'mock',
    providerLabel: FIXTURE_PROVIDER_LABEL,
    promptVersions: MOCK_PROMPTS,
    isSample: false,
    status: 'completed',
    evaluationPhase: 'saved',
    evaluationError: null,
    runtime: sim.runtime,
    clientRequestId: null,
    startedAt: new Date(startedAtMs).toISOString(),
    endedAt,
    completion: report.completion.status,
    overallScore: report.summary.overallScore,
    dimensionScores: Object.fromEntries(report.dimensions.map((d) => [d.id, d.score])) as Partial<
      Record<DimensionId, number>
    >,
    updatedAt: endedAt,
  };
  const session = toSessionDTO(row, turnRows, sim.events, report);
  return { spec, session, report, input, row, turnRows, events: sim.events };
}

/** The same call while the server is still building the report: no markers and no report yet. */
export function evaluatingSession(call: CallFixture, phase: EvaluationPhase): SessionDTO {
  return toSessionDTO(
    {
      ...call.row,
      status: 'completing',
      evaluationPhase: phase,
      completion: null,
      overallScore: null,
      dimensionScores: null,
    },
    call.turnRows,
    [],
    null,
  );
}

/** The same call after the evaluation failed. The messages are the ones the server really writes. */
export function failedSession(
  call: CallFixture,
  error: { message: string; retryable: boolean },
): SessionDTO {
  return toSessionDTO(
    {
      ...call.row,
      status: 'evaluation_failed',
      evaluationPhase: null,
      evaluationError: error,
      completion: null,
      overallScore: null,
      dimensionScores: null,
    },
    call.turnRows,
    [],
    null,
  );
}

/** A completed call whose stored report cannot be read (the server then sends `report: null`). */
export function unreadableReportSession(call: CallFixture): SessionDTO {
  return toSessionDTO(call.row, call.turnRows, call.events, { version: 2 });
}

export const SERVER_EVALUATION_ERRORS = {
  internal: {
    message: 'The coaching report could not be generated. Your transcript is safe; try again.',
    retryable: true,
  },
  providerBusy: {
    message: 'The AI provider is busy right now. Please try again in a moment.',
    retryable: true,
  },
  notConfigured: {
    message: 'The AI provider rejected the credentials. Check the Firefly provider configuration.',
    retryable: false,
  },
} as const;

// ---- The calls ---------------------------------------------------------------------------------
// What the trainee says is the only thing written by hand. The customer's replies, the markers, the
// scores and every word of the coaching come from the engine and the evaluator.

export const CALL_SPECS = {
  /** A thorough call: greeting, empathy, focused questions, ownership with a time, a recap and a close. */
  strong: {
    id: 'fx-strong',
    scenarioId: 'team-cannot-open-shared-workspace',
    overrides: { curveballs: [] },
    lines: [
      "Hello Daniel, this is Sam from Contoso support. I'm sorry your team can't open the project workspace, and I can see how much that holds you up. Can you tell me exactly what message you and your team see when you try to open it?",
      'Thank you. Is it happening to everyone on the team, or can some people still open it?',
      'Did anything change on your side, or in who has access to the workspace, shortly before it stopped working, even something routine?',
      "That's very helpful. When did it last open for you, and have you already raised this with anyone else?",
      "I understand you have been passed between IT and the vendor, and I'm sorry. I'll take ownership of this case now and look at the permissions change first.",
      "To recap: access was reorganised last night, some people can still open the workspace, and your team is blocked this morning. I'll check the permission change and call you back by 11:30 with an update, even if I don't have the fix yet.",
      'Is there anything else I can help with in the meantime? Thank you for explaining this so clearly, Daniel.',
    ],
  },
  /** Blame, an unverifiable promise and a vague close, with an unexpected turn left unanswered. */
  weak: {
    id: 'fx-weak',
    scenarioId: 'recurring-midday-slowdowns',
    lines: [
      'Have you tried restarting it? Reset the app and clear your cache.',
      'You should have checked the status page first. That is not a big deal.',
      'It will definitely be fixed in 10 minutes.',
      'We will get back to you soon.',
      'ok',
    ],
  },
  /** Two turns, then the call stopped: no overall score and limited evidence. */
  short: {
    id: 'fx-short',
    scenarioId: 'cannot-find-export-feature',
    mode: 'guided',
    endedEarly: true,
    lines: [
      'Hello, this is Sam from support. How can I help today?',
      'Can you tell me what you can see across the top of the invoice list?',
    ],
  },
  /** A mixed call in which the customer raises an earlier bad experience and the trainee handles it. */
  curveball: {
    id: 'fx-curveball',
    scenarioId: 'follow-up-no-recent-update',
    lines: [
      "Hello Linh, thanks for calling. This is Sam from Contoso support. What's been happening with the reminders?",
      'Which phones or devices are missing the reminders?',
      'Have you already sent us screenshots or logs about this?',
      'When did the reminders last arrive on those phones?',
      "I'm sorry nobody called you back, that is not good enough. I'll take this case myself and call you by 3 pm today with an update, even if I don't have the fix yet.",
      'Is there anything else I can help with? Thank you for your patience, Linh.',
    ],
  },
  /** The customer asks for a manager and the next replies do not answer it. */
  unresolved: {
    id: 'fx-unresolved',
    scenarioId: 'team-cannot-open-shared-workspace',
    lines: [
      'Hi Daniel, this is Sam from Contoso support. What message does your team see when they open it?',
      'Is it everyone on the team?',
      'When did it last work?',
      'Have you tried a different browser?',
      'I see. Can you tell me which browser that was?',
      'And what version is it?',
      'Okay, thanks. Bye.',
    ],
  },
  /** A guided call spoken aloud: the transcript is what speech recognition returned. */
  voice: {
    id: 'fx-voice',
    scenarioId: 'licence-seat-not-assigned',
    mode: 'guided',
    spoken: [1, 2, 3, 4, 5],
    lines: [
      'hello tomasz this is sam from contoso support thanks for calling what can i help you with today',
      'i am sorry the new designer cannot start work yet can you tell me when the new hire joined and what happens when they sign in',
      'thank you and how many seats do you have in total and how many are in use at the moment',
      'who looks after the subscription for your team is that you or someone else',
      "i will take ownership of this and check the seat list now i will call you back by two o'clock with an update",
    ],
  },
  /** Thirty-one turns each way, to check that a long transcript stays quick to read and search. */
  long: {
    id: 'fx-long',
    scenarioId: 'recurring-midday-slowdowns',
    lines: [
      "Hello Rhys, this is Sam from Contoso support. Thanks for calling. What's been happening with order entry?",
      "I'm sorry that has been disrupting your team. Roughly how slow is it: seconds or minutes?",
      'When did you first notice it?',
      'Is it at a particular time of day?',
      'Does it clear up by itself, or does someone have to do something?',
      'How long does it usually last when it happens?',
      'Is it everyone in the office, or only some people?',
      'Are the people in the east office affected as much as the others?',
      'Were there any changes around then, such as new users or new settings?',
      'Did anyone start a new daily job or export around the same time?',
      'What does the screen show while it is slow: a spinner, an error, or nothing?',
      'Is anything else slow at those times, like email or other tools?',
      'Have you tried working from somewhere else, for example off the VPN?',
      'What did you try the last time it happened?',
      'Thanks, that helps. Let me make sure I have this right: slowdowns around midday on weekdays, lasting about twenty minutes, mostly in the east office.',
      'Is that right?',
      'How much is this costing the team during those windows?',
      'Who else has noticed it, and have they said anything specific?',
      'Have you raised this with anyone before today?',
      "I'll take ownership of this and start by looking at what runs at midday.",
      'While I look into it, could you note the exact time the next slowdown starts?',
      'Could you also note whether the east office is slower than the others when it happens?',
      "I'd like to check the schedule of jobs on your side. Who manages those?",
      'Thank you. Can you send me the names of the new users who joined recently?',
      "That's useful. I'll compare the order export timing with your slow periods.",
      'Is the VPN client up to date on the east office machines?',
      "I'll call you back by three o'clock with what I have found.",
      'If anything changes before then, call this number and ask for me.',
      "To recap: slowdowns every weekday around midday for about twenty minutes, worst in the east office, and I'll call you by three.",
      'Is there anything else I can help with today?',
      'Thank you for your patience, Rhys. Goodbye.',
    ],
  },
} satisfies Record<string, CallSpec>;

export type CallName = keyof typeof CALL_SPECS;
export const CALL_NAMES = Object.keys(CALL_SPECS) as CallName[];

let cache: Promise<Record<CallName, CallFixture>> | null = null;

/** Every call, built once per module instance (a few hundred milliseconds in all). */
export function callFixtures(): Promise<Record<CallName, CallFixture>> {
  cache ??= Promise.all(CALL_NAMES.map((name) => buildCall(CALL_SPECS[name] as CallSpec))).then(
    (calls) =>
      Object.fromEntries(CALL_NAMES.map((name, i) => [name, calls[i]])) as Record<
        CallName,
        CallFixture
      >,
  );
  return cache;
}
