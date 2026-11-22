import type {
  ClosingCheckDTO,
  PublicStateDTO,
  SessionDTO,
  SessionScenarioView,
  TurnDTO,
} from '#shared/domain/api.ts';
import type { TemperatureBandId } from '#shared/domain/vocab.ts';
import { hintText } from '../call/hints.ts';
import { describeProblem, type ProblemContext } from '../call/problems.ts';
import type {
  CallProblem,
  CallProblemCode,
  CallSnapshot,
  CallStatePoint,
  CallSupport,
  CallTurn,
} from '../call/contract.ts';
import type { StatusId } from './call-model.ts';
import type { InitialUi } from './CallWorkspace.tsx';

// Typed snapshots for every state the call screen can be in, built from a made-up scenario (a
// Microsoft Teams audio problem reported by Priya Raman, an IT coordinator at the fictional
// Harbourline Logistics). They feed the dev gallery (`gallery-call.html?state=<name>`), the tests
// and the screenshots. Nothing here talks to a server, and nothing depends on the scenario library:
// each fixture is a plain `CallSnapshot`, which is the whole contract between the call engine and the
// screen. The words of every problem and hint are the engine's own.

export const FIXTURE_START = '2026-11-21T09:00:00.000Z';
const at = (seconds: number) => new Date(Date.parse(FIXTURE_START) + seconds * 1000).toISOString();

// ---- The scenario -------------------------------------------------------------------------------

export const SCENARIO: SessionScenarioView = {
  scenarioId: 'fixture-teams-audio-drops',
  title: 'Meeting audio drops for one team',
  summary:
    'Several people on a warehouse team lose audio in Teams meetings. The IT coordinator wants to know what changed and when it will stop.',
  issueType: 'feature-not-working',
  tags: ['meetings', 'audio'],
  estimatedMinutes: 8,
  product: {
    id: 'teams',
    name: 'Microsoft Teams',
    family: 'microsoft-365',
    familyLabel: 'Microsoft 365',
    area: 'Meetings',
  },
  caseReference: 'FX-20418',
  publicBrief: {
    issue: 'Audio cuts out for several people on the warehouse team during Teams meetings.',
    impact: {
      low: 'One person is affected and a workaround exists.',
      medium: 'The warehouse team cannot hold its daily handover meeting.',
      high: 'Shift handovers across two sites are failing.',
    },
    objective: 'Find what changed, then agree a next step and when the customer hears back.',
    knownContext: 'The team joins from shared Windows desktop PCs with USB headsets.',
    environment: 'Teams desktop app on Windows 11, wired network.',
  },
  persona: {
    name: 'Priya Raman',
    role: 'IT coordinator',
    organisation: 'Harbourline Logistics',
  },
  brief: {
    situation: 'An IT coordinator reports that audio drops during Teams meetings.',
    goal: 'Find what changed, then agree a next step.',
    groundRules: ['The customer and organisation are fictional.'],
  },
  config: {
    impact: 'medium',
    startingTemperature: 'anxious',
    proficiency: 'intermediate',
    style: 'demanding',
    callStage: 'first-contact',
    difficulty: 'standard',
    mode: 'immersive',
    curveballsEnabled: true,
  },
  expectedDiscoveryAreas: [
    'When it started',
    'Which headsets and app versions',
    'What changed recently',
    'What has been tried',
  ],
  coachingFocus: ['scoping-discovery', 'clarity'],
};

/** A call saved before scenarios named a product or had a public brief. */
const LEGACY_SCENARIO: SessionScenarioView = {
  ...SCENARIO,
  product: null,
  caseReference: null,
  publicBrief: null,
};

// ---- Turns --------------------------------------------------------------------------------------

type How = 'voice' | 'text';
type Line = readonly [seconds: number, text: string, how?: How];

function customerTurn(index: number, seconds: number, text: string): CallTurn {
  return {
    key: `t${index}`,
    index,
    role: 'customer',
    text,
    inputMode: 'text',
    createdAt: at(seconds),
    status: 'sent',
    clientMessageId: null,
    interrupted: false,
  };
}

function traineeTurn(index: number, seconds: number, text: string, how: How): CallTurn {
  return {
    key: `t${index}`,
    index,
    role: 'trainee',
    text,
    inputMode: how,
    createdAt: at(seconds),
    status: 'sent',
    clientMessageId: `client-${index}`,
    interrupted: false,
  };
}

const CUSTOMER: readonly Line[] = [
  [
    0,
    'Hello, yes. We have a problem with Teams audio. It cuts out for people on our warehouse team during meetings.',
  ],
  [
    38,
    'Since Monday. Four or five people, all on the shared desktop PCs. The sound drops for a few seconds, comes back, then drops again.',
  ],
  [
    76,
    'They use USB headsets, the same ones as before. Nothing changed on our side as far as I know.',
  ],
  [
    118,
    'We did get a Windows update pushed last week. Could that be it? I can ask the desktop team.',
  ],
  [
    160,
    'The daily handover meeting is at six this evening. If it keeps dropping, about forty people miss their shift notes.',
  ],
  [203, 'Okay. I will ask them for the driver version. How long will you need after that?'],
  [246, 'That works. Could you send me what you need in writing so I can forward it?'],
  [289, 'Yes, I have the desktop team on another line. Give me a moment.'],
  [331, 'They say the headset driver was updated on Monday morning, version 10.0.22621.'],
  [372, 'Right. So do we roll it back, or wait for you?'],
  [415, 'Understood. And will you tell me before six whether it is safe to roll back?'],
  [458, 'Good. That is what I needed to hear. Thank you for taking this seriously.'],
];

const TRAINEE: readonly Line[] = [
  [
    19,
    "Hello Priya, thanks for calling Microsoft support. I'm sorry the audio is cutting out. When did it start?",
  ],
  [58, 'Thanks, that is clear. Which headsets and which Teams version are those people using?'],
  [98, 'Understood. Did anything change on those PCs or the network around Monday?'],
  [
    140,
    "Good thought. A recent update could matter, so let's check it. Meanwhile I'll look at the meeting quality data.",
    'text',
  ],
  [
    183,
    "I understand the pressure of the six o'clock handover. I'll own this case and update you by 3 PM.",
  ],
  [226, 'Once you have the driver version, send it over and I will compare it with known issues.'],
  [268, "Of course. I'll email the questions now so you can forward them to the desktop team."],
  [310, "Take your time, I'll stay on the line."],
  [352, 'Thank you. Let me check whether that driver version matches the pattern you describe.'],
  [394, "Please hold off on a rollback for now. I'll confirm the safe next step within the hour."],
  [437, 'Yes. I will call you back before six, whatever I find.'],
  [480, "You're welcome. I'll speak to you shortly."],
];

/** Alternates customer and trainee lines, the customer opening, numbering turns from 1. */
function conversation(count: number, customer = CUSTOMER, trainee = TRAINEE): CallTurn[] {
  const turns: CallTurn[] = [];
  for (let index = 1; index <= count; index += 1) {
    const isCustomer = index % 2 === 1;
    const pool = isCustomer ? customer : trainee;
    const line = pool[Math.floor((index - 1) / 2) % pool.length] as Line;
    const [seconds, text, how = 'voice'] = line;
    // Lines repeat in a long call: each turn gets its own place in time.
    const lap = Math.floor((index - 1) / (2 * pool.length));
    const when = seconds + lap * 520;
    turns.push(isCustomer ? customerTurn(index, when, text) : traineeTurn(index, when, text, how));
  }
  return turns;
}

/** A message that has not been answered: being transcribed, sent or kept after a failure. */
function exchange(
  seconds: number,
  text: string,
  status: CallTurn['status'],
  how: How,
  extra: Partial<CallTurn> = {},
): CallTurn {
  return {
    key: 'exchange-1',
    index: null,
    role: 'trainee',
    text,
    inputMode: how,
    createdAt: at(seconds),
    status,
    clientMessageId: 'exchange-1',
    interrupted: false,
    ...extra,
  };
}

// ---- The customer's state -----------------------------------------------------------------------

const BAND_LABELS: Record<TemperatureBandId, string> = {
  calm: 'Calm',
  concerned: 'Concerned',
  frustrated: 'Frustrated',
  angry: 'Angry',
  escalating: 'Escalating',
};

function state(
  band: TemperatureBandId,
  trend: PublicStateDTO['trend'],
  discoveredCount = 0,
): PublicStateDTO {
  return {
    band: { id: band, label: BAND_LABELS[band] },
    trend,
    discoveredCount,
    silent: false,
    shifts: 0,
  };
}

/** One point per customer reply: the first is the opening line. */
function history(...bands: TemperatureBandId[]): CallStatePoint[] {
  return bands.map((band, index) => ({
    turnIndex: index * 2 + 1,
    band,
    label: BAND_LABELS[band],
  }));
}

// ---- Support and problems -----------------------------------------------------------------------

const SERVER_SPEECH: CallSupport = {
  capture: 'server-speech',
  playback: 'server-speech',
  provider: 'azure-speech',
  chromium: true,
  secureContext: true,
  reason: null,
  captureLabel: 'Azure AI Speech',
  playbackLabel: 'Azure AI Speech',
};
const DEMO_SPEECH: CallSupport = {
  ...SERVER_SPEECH,
  provider: 'mock',
  captureLabel: 'Demo speech (scripted)',
  playbackLabel: 'Demo speech (scripted)',
  speechDemo: true,
};
const BROWSER_SPEECH: CallSupport = {
  capture: 'browser-recognition',
  playback: 'browser-synthesis',
  provider: 'none',
  chromium: true,
  secureContext: true,
  reason: null,
  captureLabel: 'Browser speech recognition (online)',
  playbackLabel: 'Browser voice',
};
const NO_VOICE: CallSupport = {
  capture: 'none',
  playback: 'none',
  provider: 'none',
  chromium: true,
  secureContext: true,
  reason: 'This browser cannot use a microphone. You can still type your replies.',
  captureLabel: 'Typed replies only',
  playbackLabel: 'Captions only',
};

/** The engine's own copy for a problem, so the fixtures read exactly as the real screen does. */
const problem = (code: CallProblemCode, context: ProblemContext = {}): CallProblem =>
  describeProblem(code, context);

/** What the engine announces: a whole sentence, politely unless the microphone is the problem. */
const said = (
  text: string,
  politeness: 'polite' | 'assertive' = 'polite',
): NonNullable<CallSnapshot['announcement']> => ({ id: 1, text, politeness });

// ---- Building a snapshot ------------------------------------------------------------------------

function toTurnDTO(turn: CallTurn): TurnDTO {
  return {
    index: turn.index ?? 0,
    role: turn.role,
    text: turn.text,
    createdAt: turn.createdAt,
    source: turn.role === 'trainee' ? 'trainee' : turn.index === 1 ? 'opening' : 'demo',
    inputMode: turn.inputMode,
  };
}

interface Build {
  scenario?: SessionScenarioView;
  /** Overrides on the session's scenario configuration. */
  config?: Partial<SessionScenarioView['config']>;
  sessionStatus?: SessionDTO['status'];
}

function sessionFor(
  turns: readonly CallTurn[],
  customerState: PublicStateDTO,
  build: Build,
): SessionDTO {
  const stored = turns.filter((turn) => turn.status === 'sent');
  const scenario = build.scenario ?? SCENARIO;
  return {
    id: 'ses_fixture_priya',
    scenarioId: scenario.scenarioId,
    scenarioTitle: scenario.title,
    issueType: scenario.issueType,
    difficulty: scenario.config.difficulty,
    startingTemperature: scenario.config.startingTemperature,
    impact: scenario.config.impact,
    style: scenario.config.style,
    mode: build.config?.mode ?? scenario.config.mode,
    providerKind: 'mock',
    providerLabel: 'Demo mode (built-in rules engine)',
    status: build.sessionStatus ?? 'active',
    startedAt: FIXTURE_START,
    endedAt: null,
    durationSeconds: null,
    traineeTurns: stored.filter((turn) => turn.role === 'trainee').length,
    completion: null,
    overallScore: null,
    dimensionScores: null,
    scenario: { ...scenario, config: { ...scenario.config, ...build.config } },
    turns: stored.map(toTurnDTO),
    state: customerState,
    awaitingReply: null,
    evaluationPhase: null,
    evaluationError: null,
    report: null,
  };
}

/** A spoken call at "your turn", which every other fixture changes a little. */
function snapshotOf(
  overrides: Partial<CallSnapshot> & { turns: CallTurn[] },
  build: Build = {},
): CallSnapshot {
  const turns = overrides.turns;
  const customerState = overrides.customerState ?? state('concerned', 'steady');
  const lastAt =
    turns.length > 0 ? Date.parse(turns[turns.length - 1]!.createdAt) : Date.parse(FIXTURE_START);
  return {
    loading: false,
    loadProblem: null,
    session: sessionFor(turns, customerState, build),
    phase: 'ready-for-next-turn',
    stage: 'ready',
    mode: 'voice',
    microphone: 'granted',
    muted: false,
    paused: false,
    handsFree: false,
    audio: 'on',
    speechDetected: false,
    micOpen: false,
    micLevel: 0,
    customerLevel: 0,
    customerLevelMeasured: false,
    interim: '',
    customerState,
    stateHistory: history('calm', 'concerned', 'concerned', 'concerned'),
    problem: null,
    hint: null,
    elapsedSeconds: Math.round((lastAt - Date.parse(FIXTURE_START)) / 1000) + 6,
    turnsRemaining: null,
    support: SERVER_SPEECH,
    voiceDetails: { voice: 'en-GB-SoniaNeural', style: 'none', language: 'en-GB' },
    announcement: null,
    ...overrides,
  };
}

const OPENING = conversation(1);
const EARLY = conversation(3);
const MIDDLE = conversation(7);
const LONGER = conversation(13);

// ---- The fixtures -------------------------------------------------------------------------------

export type FixtureGroup =
  | 'Screens'
  | 'Stages of a turn'
  | 'Hands-free'
  | 'Modes'
  | 'Problems'
  | 'Customer state'
  | 'Dialogs';

export interface CallFixture {
  title: string;
  group: FixtureGroup;
  description: string;
  snapshot: CallSnapshot;
  view?: {
    online?: boolean;
    preferText?: boolean;
    initialUi?: InitialUi;
    provider?: { demo: boolean; label: string };
    showInputMode?: boolean;
    /** How the server answers the closing check of a guided call, when the end dialog asks. */
    loadClosingCheck?: (signal: AbortSignal) => Promise<ClosingCheckDTO>;
  };
}

// ---- The closing check ----------------------------------------------------------------------------

export type ClosingCheckKind = 'mixed' | 'complete' | 'none' | 'loading' | 'failed';

const CLOSING_CHECKS: Record<'mixed' | 'complete' | 'none', ClosingCheckDTO['checks']> = {
  mixed: { plan: true, owner: true, updateTime: false, agreement: false },
  complete: { plan: true, owner: true, updateTime: true, agreement: true },
  none: { plan: false, owner: false, updateTime: false, agreement: false },
};

/**
 * The closing check as a server might answer it: at once, never (until it is told to stop), or with
 * a failure. The numbers are made up, and say nothing about the words of a call.
 */
export function closingCheckLoader(
  kind: ClosingCheckKind,
): (signal: AbortSignal) => Promise<ClosingCheckDTO> {
  return (signal) => {
    if (kind === 'failed') return Promise.reject(new Error('The check failed.'));
    if (kind === 'loading') {
      return new Promise<ClosingCheckDTO>((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(new DOMException('Stopped.', 'AbortError')));
      });
    }
    return Promise.resolve({
      sessionId: 'ses_fixture_priya',
      traineeTurns: 6,
      checks: CLOSING_CHECKS[kind],
    });
  };
}

const idle = (overrides: Partial<CallSnapshot> = {}): CallSnapshot =>
  snapshotOf({
    turns: OPENING,
    phase: 'idle',
    stage: 'idle',
    microphone: 'unknown',
    customerState: state('calm', 'steady'),
    stateHistory: history('calm'),
    elapsedSeconds: 0,
    ...overrides,
  });

const speakingTurns = MIDDLE;

/** The speaking customer's reply is the last turn and is already in the transcript. */
const speaking = snapshotOf({
  turns: speakingTurns,
  phase: 'customer-speaking',
  stage: 'customer-speaking',
  customerLevel: 0.55,
  customerLevelMeasured: true,
  customerState: state('concerned', 'rising'),
  announcement: said('The customer is speaking. You can stop the customer audio at any time.'),
});

/** A harder call: the customer's patience runs out. Used for the frustrated, angry and escalating fixtures. */
const TENSE_CUSTOMER: readonly Line[] = [
  [
    0,
    "I've already explained this to two people this morning. The audio keeps dropping and nobody has told me anything.",
  ],
  [41, "Yes! That's what I just said. Can you just fix it? The handover is at six."],
  [
    88,
    "I don't have time for twenty questions. I need this working, not a list of things to check.",
  ],
  [139, 'It says the headset is disconnected. There. Now what? How long is this going to take?'],
  [
    193,
    "You said that last time. I want to speak to someone more senior if this isn't sorted in an hour.",
  ],
  [
    249,
    'That is not good enough. Forty people are waiting on notes and I am sending them by email.',
  ],
  [301, 'Fine. But I want a time. An actual time, not "soon".'],
  [352, 'Then say it. By when will you call me?'],
];

const TENSE_TRAINEE: readonly Line[] = [
  [19, "I'm sorry about that, Priya. I have the case in front of me now. When did it start?"],
  [58, 'I understand. One quick question so I can point you the right way: which headsets?'],
  [98, 'That is fair. Let me give you the short version of what I am checking first.'],
  [160, 'I hear you. I will not make you repeat yourself, and I am checking the driver now.'],
  [215, "I'll note your request. My aim is to have an answer for you within the hour."],
  [
    270,
    "You're right to expect more. Here is what I will do: I will own this and call you by 3 PM.",
  ],
  [320, 'I will call you by 3 PM, and again before six if the fix is not in place.'],
  [372, 'By 3 PM. I will call you on this number.'],
];

const tense = conversation(15, TENSE_CUSTOMER, TENSE_TRAINEE);
const angryHistory = history(
  'calm',
  'concerned',
  'frustrated',
  'frustrated',
  'angry',
  'angry',
  'angry',
  'angry',
);

const SPOKEN_WORDS = 'Thanks Priya. Can I check which headset model and which Teams version';

const DEFINITIONS = {
  // ---- Screens before and around the workspace ---------------------------------------------
  loading: {
    title: 'Loading',
    group: 'Screens',
    description: 'The call is being fetched: the shape of the workspace as a skeleton.',
    snapshot: snapshotOf({
      turns: [],
      loading: true,
      session: null,
      customerState: null,
      stateHistory: [],
      phase: 'idle',
      stage: 'idle',
      microphone: 'unknown',
      elapsedSeconds: 0,
    }),
  },
  'load-error': {
    title: 'Could not load',
    group: 'Screens',
    description: 'The session could not be loaded at all: what happened, nothing lost, Retry.',
    snapshot: snapshotOf({
      turns: [],
      session: null,
      customerState: null,
      stateHistory: [],
      phase: 'idle',
      stage: 'idle',
      microphone: 'unknown',
      loadProblem: problem('session-unavailable', { during: 'load' }),
      elapsedSeconds: 0,
    }),
  },
  unavailable: {
    title: 'Call unavailable',
    group: 'Screens',
    description: 'There is no such call.',
    snapshot: snapshotOf({
      turns: [],
      session: null,
      customerState: null,
      stateHistory: [],
      phase: 'idle',
      stage: 'idle',
      microphone: 'unknown',
      elapsedSeconds: 0,
    }),
  },
  'report-opening': {
    title: 'The call is over',
    group: 'Screens',
    description: 'The call has already ended: shown for the moment before the report opens.',
    snapshot: snapshotOf({ turns: MIDDLE }, { sessionStatus: 'completing' }),
  },
  'preflight-voice': {
    title: 'Pre-flight: microphone not requested',
    group: 'Screens',
    description: 'Before the call: nothing has asked for the microphone, and voice leads.',
    snapshot: idle(),
  },
  'preflight-text': {
    title: 'Pre-flight: typed call first (?input=text)',
    group: 'Screens',
    description: 'The address asked for a typed call, so the typed action leads.',
    snapshot: idle(),
    view: { preferText: true },
  },
  'preflight-browser-speech': {
    title: 'Pre-flight: browser speech',
    group: 'Screens',
    description: "The browser's own speech service does the recognising and the speaking.",
    snapshot: idle({ support: BROWSER_SPEECH }),
    view: { provider: { demo: false, label: 'Azure OpenAI (gpt-4o)' } },
  },
  'preflight-demo-speech': {
    title: 'Pre-flight: demo speech',
    group: 'Screens',
    description: 'The server runs the scripted demonstration: it does not understand audio.',
    snapshot: idle({ support: DEMO_SPEECH }),
  },
  'preflight-unsupported': {
    title: 'Pre-flight: voice unavailable',
    group: 'Screens',
    description: 'This browser cannot hold a spoken call: the reason, and text as the way on.',
    snapshot: idle({ support: NO_VOICE, microphone: 'unavailable' }),
  },
  'preflight-resume': {
    title: 'Pre-flight: resume',
    group: 'Screens',
    description: 'The call already has turns from the trainee: the time and the transcript.',
    snapshot: idle({ turns: LONGER, elapsedSeconds: 392 }),
  },
  'requesting-permission': {
    title: 'Waiting for permission',
    group: 'Screens',
    description: "The browser's permission prompt is open.",
    snapshot: idle({
      phase: 'requesting-microphone',
      stage: 'mic-permission',
      microphone: 'prompt',
    }),
  },
  'permission-denied': {
    title: 'Microphone blocked',
    group: 'Screens',
    description: 'Permission was refused before the call: what was kept, Retry and Use text.',
    snapshot: idle({
      microphone: 'denied',
      problem: problem('microphone-denied', { beforeCall: true, browser: 'edge' }),
      announcement: said(
        'The microphone is blocked. You can type your replies instead.',
        'assertive',
      ),
    }),
  },
  'microphone-unavailable': {
    title: 'No microphone',
    group: 'Screens',
    description: 'No microphone was found before the call.',
    snapshot: idle({
      microphone: 'unavailable',
      problem: problem('microphone-missing', { beforeCall: true }),
    }),
  },

  // ---- The stages of a turn -----------------------------------------------------------------
  connecting: {
    title: 'Connecting',
    group: 'Stages of a turn',
    description: 'The microphone is allowed and the customer is about to speak their opening line.',
    snapshot: snapshotOf({
      turns: OPENING,
      phase: 'ready',
      stage: 'ready',
      customerState: state('calm', 'steady'),
      stateHistory: history('calm'),
      elapsedSeconds: 4,
    }),
  },
  'mic-ready': {
    title: 'Microphone ready (your turn)',
    group: 'Stages of a turn',
    description: 'Push to talk: the microphone is allowed and waits for Talk.',
    snapshot: snapshotOf({ turns: EARLY, announcement: said('Microphone ready.') }),
  },
  'mic-opening': {
    title: 'Opening the microphone',
    group: 'Stages of a turn',
    description:
      'Talk was pressed and the microphone is not open yet: Talk works, and nothing says Listening.',
    snapshot: snapshotOf({
      turns: EARLY,
      phase: 'listening',
      stage: 'listening',
      micOpen: false,
    }),
  },
  listening: {
    title: 'Listening',
    group: 'Stages of a turn',
    description:
      'Hands-free: the microphone is open and nobody is speaking yet. Nothing is pressed: the ring breathes.',
    snapshot: snapshotOf({
      turns: EARLY,
      phase: 'listening',
      stage: 'listening',
      handsFree: true,
      autoListening: true,
      micOpen: true,
      micLevel: 0.06,
      announcement: said('Listening. Speak when you are ready.'),
    }),
  },
  'speech-detected': {
    title: 'Hearing you',
    group: 'Stages of a turn',
    description:
      'Hands-free: the trainee is speaking. The ring follows the voice, the words appear as they go, and Done speaking is there to end the turn early.',
    snapshot: snapshotOf({
      turns: EARLY,
      phase: 'listening',
      stage: 'listening',
      handsFree: true,
      autoListening: true,
      micOpen: true,
      speechDetected: true,
      micLevel: 0.6,
      interim: SPOKEN_WORDS,
    }),
  },
  'processing-speech': {
    title: 'Processing speech',
    group: 'Stages of a turn',
    description: 'The utterance is being turned into text: a shimmer, never a percentage.',
    snapshot: snapshotOf({
      turns: [...EARLY, exchange(98, '', 'transcribing', 'voice')],
      phase: 'transcribing',
      stage: 'transcribing',
      announcement: said('Turning your speech into text.'),
    }),
  },
  'transcript-available': {
    title: 'Transcript available, customer replying',
    group: 'Stages of a turn',
    description: "The words are in the transcript and the customer's reply is being made.",
    snapshot: snapshotOf({
      turns: [
        ...EARLY,
        exchange(
          98,
          'Did anything change on those PCs or the network on Monday?',
          'sending',
          'voice',
        ),
      ],
      phase: 'processing',
      stage: 'processing',
      announcement: said('The customer is preparing a reply.'),
    }),
  },
  'customer-speaking': {
    title: 'Customer speaking',
    group: 'Stages of a turn',
    description:
      'The customer\u2019s voice plays: Stop customer audio is the way to take the turn.',
    snapshot: speaking,
  },
  'customer-speaking-browser-voice': {
    title: 'Customer speaking (a voice the page cannot measure)',
    group: 'Stages of a turn',
    description:
      'A browser voice: the strip draws a calm fixed pattern, not a level it cannot know.',
    snapshot: { ...speaking, customerLevelMeasured: false },
  },
  paused: {
    title: 'Paused',
    group: 'Stages of a turn',
    description: 'The voice loop is paused: no listening, and the customer is on hold.',
    snapshot: snapshotOf({
      turns: MIDDLE,
      paused: true,
      stage: 'paused',
      announcement: said('The call is paused.'),
    }),
  },
  muted: {
    title: 'Muted',
    group: 'Stages of a turn',
    description: 'The microphone is muted while it would otherwise wait for the trainee.',
    snapshot: snapshotOf({
      turns: MIDDLE,
      muted: true,
      stage: 'muted',
      announcement: said('Your microphone is muted.'),
    }),
  },
  retrying: {
    title: 'Retrying',
    group: 'Stages of a turn',
    description: 'A message that failed is being sent again, under the same id.',
    snapshot: snapshotOf({
      turns: [
        ...MIDDLE,
        exchange(310, 'Take your time, I will stay on the line.', 'sending', 'voice'),
      ],
      phase: 'processing',
      stage: 'retrying',
      announcement: said('Retrying.'),
    }),
  },
  'retry-required': {
    title: 'Try again (message not sent)',
    group: 'Stages of a turn',
    description:
      'The customer could not reply: the message stays in the transcript, Retry is offered.',
    snapshot: snapshotOf({
      turns: [
        ...MIDDLE,
        exchange(310, 'Take your time, I will stay on the line.', 'failed', 'voice'),
      ],
      problem: problem('reply-failed'),
      announcement: said('Problem: The customer could not reply. Your message is kept.'),
    }),
  },
  offline: {
    title: 'Offline',
    group: 'Stages of a turn',
    description: 'The browser reports it has no network.',
    snapshot: snapshotOf({
      turns: [
        ...MIDDLE,
        exchange(310, 'Take your time, I will stay on the line.', 'failed', 'voice'),
      ],
      stage: 'offline',
      problem: problem('offline', { during: 'send' }),
    }),
    view: { online: false },
  },
  reconnecting: {
    title: 'Reconnecting',
    group: 'Stages of a turn',
    description: 'The browser is back but the step that failed has not been sent again yet.',
    snapshot: snapshotOf({
      turns: [
        ...MIDDLE,
        exchange(310, 'Take your time, I will stay on the line.', 'failed', 'voice'),
      ],
      stage: 'offline',
      problem: problem('offline', { during: 'send' }),
    }),
  },
  ending: {
    title: 'Ending call',
    group: 'Stages of a turn',
    description: 'A message in flight is being finished before the call closes.',
    snapshot: snapshotOf({
      turns: MIDDLE,
      phase: 'ending',
      stage: 'ending',
      announcement: said('Ending the call.'),
    }),
  },
  evaluating: {
    title: 'Preparing review',
    group: 'Stages of a turn',
    description: 'The call is being closed and the review prepared.',
    snapshot: snapshotOf({
      turns: MIDDLE,
      phase: 'ending',
      stage: 'evaluating',
      announcement: said('Preparing your review.'),
    }),
  },
  completed: {
    title: 'Call ended',
    group: 'Stages of a turn',
    description: 'The call is closed; the report opens next.',
    snapshot: snapshotOf({
      turns: MIDDLE,
      phase: 'completed',
      stage: 'completed',
      announcement: said('The call is complete.'),
    }),
  },

  // ---- A hands-free call: the microphone opens by itself, and the customer is a presence ----
  'hands-free-connecting': {
    title: 'Hands-free: connecting',
    group: 'Hands-free',
    description:
      'The microphone is allowed and the opening line is being made: a ring turns slowly round the customer, and there is nothing to press.',
    snapshot: snapshotOf({
      turns: OPENING,
      phase: 'ready',
      stage: 'ready',
      handsFree: true,
      autoListening: true,
      customerState: state('calm', 'steady'),
      stateHistory: history('calm'),
      elapsedSeconds: 2,
    }),
  },
  'hands-free-customer-speaking': {
    title: 'Hands-free: customer speaking',
    group: 'Hands-free',
    description:
      "The customer's line is in the captions and the ring follows the sound that plays. Stop customer audio is the one control in the slot.",
    snapshot: { ...speaking, handsFree: true, autoListening: true },
  },
  'hands-free-customer-speaking-browser-voice': {
    title: 'Hands-free: customer speaking (a voice the page cannot measure)',
    group: 'Hands-free',
    description:
      "A browser voice: the ring is the avatar's own fixed pulse, never a level it cannot know.",
    snapshot: {
      ...speaking,
      handsFree: true,
      autoListening: true,
      customerLevel: 0.4,
      customerLevelMeasured: false,
    },
  },
  'hands-free-processing': {
    title: 'Hands-free: the customer is replying',
    group: 'Hands-free',
    description: 'The words are sent: a quiet arc turns, the captions fade, nothing is pressed.',
    snapshot: snapshotOf({
      turns: [
        ...EARLY,
        exchange(
          98,
          'Did anything change on those PCs or the network on Monday?',
          'sending',
          'voice',
        ),
      ],
      phase: 'processing',
      stage: 'processing',
      handsFree: true,
      autoListening: true,
    }),
  },
  'hands-free-ready': {
    title: 'Hands-free: about to listen',
    group: 'Hands-free',
    description:
      'The customer has finished and the microphone is about to open by itself: no Talk, and the ring is still until it is.',
    snapshot: snapshotOf({
      turns: EARLY,
      handsFree: true,
      autoListening: true,
      announcement: said('Microphone ready.'),
    }),
  },
  'hands-free-still-listening': {
    title: 'Hands-free: still listening',
    group: 'Hands-free',
    description:
      'After 15 seconds of quiet a soft line says it is still listening. It fades in, in place, and nothing moves.',
    snapshot: snapshotOf({
      turns: EARLY,
      phase: 'listening',
      stage: 'listening',
      handsFree: true,
      autoListening: true,
      micOpen: true,
      micLevel: 0.02,
      hint: hintText({ code: 'still-listening' }),
    }),
  },
  'hands-free-long-words': {
    title: 'Hands-free: a long turn',
    group: 'Hands-free',
    description:
      'The trainee has said more than three lines: the captions keep the newest, and the oldest line leaves at the top.',
    snapshot: snapshotOf({
      turns: EARLY,
      phase: 'listening',
      stage: 'listening',
      handsFree: true,
      autoListening: true,
      micOpen: true,
      speechDetected: true,
      micLevel: 0.45,
      interim: `${SPOKEN_WORDS} you are using, and whether the people affected are on the same build. Also, when did you last see it work, and has anything been installed or updated since then on those PCs or on the network they share?`,
    }),
  },
  'hands-free-muted': {
    title: 'Hands-free: muted',
    group: 'Hands-free',
    description: 'The microphone is muted: the ring is still, and the status says so.',
    snapshot: snapshotOf({
      turns: MIDDLE,
      muted: true,
      stage: 'muted',
      handsFree: true,
      autoListening: true,
      announcement: said('Your microphone is muted.'),
    }),
  },
  'hands-free-paused': {
    title: 'Hands-free: on hold',
    group: 'Hands-free',
    description:
      'The call is held: the ring is still and dashed, and Resume is the one thing to press.',
    snapshot: snapshotOf({
      turns: MIDDLE,
      paused: true,
      stage: 'paused',
      handsFree: true,
      autoListening: true,
      announcement: said('The call is paused.'),
    }),
  },
  'hands-free-idle-paused': {
    title: 'Hands-free: paused after ten quiet minutes',
    group: 'Hands-free',
    description: 'The call paused itself after ten minutes without sound, and says why.',
    snapshot: snapshotOf({
      turns: MIDDLE,
      paused: true,
      stage: 'paused',
      handsFree: true,
      autoListening: true,
      hint: hintText({ code: 'idle-paused' }),
      announcement: said('The call is paused.'),
    }),
  },
  'hands-free-capped': {
    title: 'Hands-free: stopped after empty recognitions',
    group: 'Hands-free',
    description:
      'Three recognitions in a row came back with no words, so the microphone waits: Talk is the one thing to press.',
    snapshot: snapshotOf({
      turns: MIDDLE,
      handsFree: true,
      autoListening: false,
      hint: hintText({ code: 'no-words' }),
    }),
  },

  // ---- Modes ---------------------------------------------------------------------------------
  'text-fallback': {
    title: 'Typing',
    group: 'Modes',
    description: 'The reply box is the way to hold the call; Return to voice is one press away.',
    snapshot: snapshotOf({
      turns: MIDDLE,
      mode: 'text',
      stage: 'ready',
      announcement: said('You are typing your replies.'),
    }),
  },
  'text-thinking': {
    title: 'Typing: the customer is replying',
    group: 'Modes',
    description: 'A typed message is being answered. Sending waits, the draft is kept.',
    snapshot: snapshotOf({
      turns: [
        ...MIDDLE,
        exchange(310, 'Take your time, I will stay on the line.', 'sending', 'text'),
      ],
      mode: 'text',
      phase: 'processing',
      stage: 'processing',
    }),
    view: { initialUi: { draft: 'Is the driver version on that PC' } },
  },
  'text-limit': {
    title: 'Typing: message limit',
    group: 'Modes',
    description: 'The call has reached its message limit: End call is the way on.',
    snapshot: snapshotOf({
      turns: LONGER,
      mode: 'text',
      turnsRemaining: 0,
      problem: problem('turn-limit'),
    }),
  },
  'text-microphone-lost': {
    title: 'Typing after the microphone was lost',
    group: 'Modes',
    description: 'The microphone stopped mid-call: the call carries on by typing, and says why.',
    snapshot: snapshotOf({
      turns: MIDDLE,
      mode: 'text',
      microphone: 'unavailable',
      problem: problem('microphone-missing'),
    }),
  },
  'audio-off': {
    title: 'Customer audio off',
    group: 'Modes',
    description: 'The trainee continued without audio: replies are captions.',
    snapshot: snapshotOf({
      turns: MIDDLE,
      audio: 'off',
      hint: hintText({ code: 'no-voice' }),
    }),
  },
  'captions-only': {
    title: 'Captions only',
    group: 'Modes',
    description: 'This browser cannot speak the customer\u2019s replies at all.',
    snapshot: snapshotOf({
      turns: MIDDLE,
      audio: 'none',
      support: { ...BROWSER_SPEECH, playback: 'none', playbackLabel: 'Captions only' },
      hint: hintText({ code: 'captions-only' }),
    }),
  },
  interrupted: {
    title: 'Customer audio stopped',
    group: 'Modes',
    description:
      'The trainee stopped the customer\u2019s voice: the full reply is in the transcript.',
    snapshot: snapshotOf({
      turns: MIDDLE.map((turn) => (turn.index === 7 ? { ...turn, interrupted: true } : turn)),
      announcement: said('Microphone ready.'),
    }),
  },
  'nothing-heard': {
    title: 'Nothing heard',
    group: 'Modes',
    description: 'The microphone heard nothing: a soft hint, and Talk to try again.',
    snapshot: snapshotOf({ turns: MIDDLE, hint: hintText({ code: 'nothing-heard' }) }),
  },
  'guided-hints': {
    title: 'Guided practice',
    group: 'Modes',
    description:
      'Guided practice adds the areas worth exploring to the case, a thin trace of how the customer has felt, and the tips strip.',
    snapshot: snapshotOf(
      { turns: MIDDLE, customerState: state('concerned', 'steady', 3) },
      { config: { mode: 'guided' } },
    ),
  },
  'guided-tips-hidden': {
    title: 'Guided practice, tips put away',
    group: 'Modes',
    description: 'Hide tips was pressed: one quiet "Show tips" button is left.',
    snapshot: snapshotOf(
      { turns: MIDDLE, customerState: state('concerned', 'steady', 3) },
      { config: { mode: 'guided' } },
    ),
    view: { initialUi: { tipsHidden: true } },
  },
  'guided-customer-speaking': {
    title: 'Guided practice, customer speaking',
    group: 'Modes',
    description: 'While the customer speaks no tip moves; the strip is as it was.',
    snapshot: snapshotOf(
      {
        turns: speakingTurns,
        phase: 'customer-speaking',
        stage: 'customer-speaking',
        customerLevel: 0.55,
        customerLevelMeasured: true,
        customerState: state('concerned', 'rising'),
      },
      { config: { mode: 'guided' } },
    ),
  },
  'guided-challenge': {
    title: 'Challenge call, Guided practice chosen',
    group: 'Modes',
    description: 'A challenge call shows tips only because Guided practice was chosen.',
    snapshot: snapshotOf(
      { turns: MIDDLE, customerState: state('concerned', 'steady', 3) },
      { config: { mode: 'guided', difficulty: 'challenge' } },
    ),
  },
  'challenge-assessment': {
    title: 'Challenge call, Assessment practice',
    group: 'Modes',
    description: 'A challenge call by default: no tips, no cues.',
    snapshot: snapshotOf(
      { turns: MIDDLE },
      { config: { mode: 'immersive', difficulty: 'challenge' } },
    ),
  },
  'live-model': {
    title: 'Live model',
    group: 'Modes',
    description: 'A live model writes the customer: the bar says so and not "demo".',
    snapshot: snapshotOf({ turns: MIDDLE }),
    view: { provider: { demo: false, label: 'Azure OpenAI (gpt-4o)' } },
  },
  'legacy-call': {
    title: 'A call saved before Microsoft scenarios',
    group: 'Modes',
    description: 'No product and no public brief: nothing is guessed, the older goal is used.',
    snapshot: snapshotOf({ turns: MIDDLE }, { scenario: LEGACY_SCENARIO }),
  },
  'long-transcript': {
    title: 'A long call',
    group: 'Modes',
    description: 'Sixty-four turns: the transcript stays responsive.',
    snapshot: snapshotOf({
      turns: conversation(64),
      stateHistory: angryHistory,
      customerState: state('frustrated', 'falling'),
    }),
  },
  notes: {
    title: 'Private notes',
    group: 'Modes',
    description: 'The trainee\u2019s own notes, only on this screen.',
    snapshot: snapshotOf({ turns: MIDDLE }),
    view: { initialUi: { notes: 'Driver 10.0.22621 updated Monday. Ask for the rollback plan.' } },
  },

  // ---- Problems ------------------------------------------------------------------------------
  'problem-voice-generation': {
    title: 'The customer\u2019s voice could not be made',
    group: 'Problems',
    description:
      'A voice problem: Retry and Continue without audio. The reply is in the transcript.',
    snapshot: snapshotOf({ turns: MIDDLE, problem: problem('voice-generation-failed') }),
  },
  'problem-voice-timeout': {
    title: 'The customer\u2019s voice took too long',
    group: 'Problems',
    description: 'The voice was not ready in time: the same two ways forward, said differently.',
    snapshot: snapshotOf({
      turns: MIDDLE,
      problem: problem('voice-generation-failed', { timedOut: true }),
    }),
  },
  'problem-voice-offline': {
    title: 'The connection dropped during the voice',
    group: 'Problems',
    description: 'Offline while the voice was made: Retry once back, or Continue without audio.',
    snapshot: snapshotOf({
      turns: MIDDLE,
      stage: 'offline',
      problem: problem('offline', { during: 'speak' }),
    }),
    view: { online: false },
  },
  'problem-playback-blocked': {
    title: 'The browser blocked the voice',
    group: 'Problems',
    description: 'Autoplay was refused: Replay is a press, which the browser allows.',
    snapshot: snapshotOf({ turns: MIDDLE, problem: problem('playback-blocked') }),
  },
  'problem-playback-failed': {
    title: 'The voice could not be played',
    group: 'Problems',
    description: 'The sound started and failed: Replay, or Continue without audio.',
    snapshot: snapshotOf({ turns: MIDDLE, problem: problem('playback-failed') }),
  },
  'problem-transcription-failed': {
    title: 'Transcribing failed',
    group: 'Problems',
    description: 'Nothing was sent: Retry to say it again, or Use text.',
    snapshot: snapshotOf({ turns: MIDDLE, problem: problem('transcription-failed') }),
  },
  'problem-transcription-timeout': {
    title: 'Transcribing took too long',
    group: 'Problems',
    description: 'The recording is kept for one more try: Retry sends the same recording.',
    snapshot: snapshotOf({
      turns: MIDDLE,
      problem: problem('transcription-failed', { timedOut: true }),
    }),
  },
  'problem-speech-unavailable': {
    title: 'Speech is not available',
    group: 'Problems',
    description: 'The server has no speech service: Retry would not help, so only Use text.',
    snapshot: snapshotOf({ turns: MIDDLE, problem: problem('speech-service-unavailable') }),
  },
  'problem-save-failed': {
    title: 'The message may not be saved',
    group: 'Problems',
    description: 'Retry sends it once even if it was saved; End safely is the other way out.',
    snapshot: snapshotOf({
      turns: [
        ...MIDDLE,
        exchange(310, 'Take your time, I will stay on the line.', 'failed', 'text'),
      ],
      mode: 'text',
      problem: problem('save-failed'),
    }),
  },
  'problem-turn-limit': {
    title: 'Message limit',
    group: 'Problems',
    description: 'The limit was reached: End call is the one action.',
    snapshot: snapshotOf({ turns: LONGER, turnsRemaining: 0, problem: problem('turn-limit') }),
  },

  // ---- The customer's state -------------------------------------------------------------------
  'state-calm': {
    title: 'Calm',
    group: 'Customer state',
    description: 'A calm customer.',
    snapshot: snapshotOf({
      turns: EARLY,
      customerState: state('calm', 'steady'),
      stateHistory: history('calm', 'calm'),
    }),
  },
  'state-concerned': {
    title: 'Concerned',
    group: 'Customer state',
    description: 'A concerned customer, getting more worried.',
    snapshot: snapshotOf({
      turns: EARLY,
      customerState: state('concerned', 'rising'),
      stateHistory: history('calm', 'concerned'),
    }),
  },
  'state-frustrated': {
    title: 'Frustrated',
    group: 'Customer state',
    description: 'A frustrated customer.',
    snapshot: snapshotOf({
      turns: tense.slice(0, 9),
      customerState: state('frustrated', 'rising'),
      stateHistory: history('calm', 'concerned', 'frustrated', 'frustrated', 'frustrated'),
    }),
  },
  'state-angry': {
    title: 'Angry',
    group: 'Customer state',
    description: 'An angry customer.',
    snapshot: snapshotOf({
      turns: tense,
      customerState: state('angry', 'steady'),
      stateHistory: angryHistory,
    }),
  },
  'state-escalating': {
    title: 'Escalating',
    group: 'Customer state',
    description: 'A very upset customer: the label and the icon change, nothing flashes or shakes.',
    snapshot: snapshotOf({
      turns: tense,
      customerState: state('escalating', 'rising'),
      stateHistory: [...angryHistory, { turnIndex: 17, band: 'escalating', label: 'Escalating' }],
    }),
  },
  'state-recovering': {
    title: 'Recovering',
    group: 'Customer state',
    description: 'The customer is easing after being angrier earlier.',
    snapshot: snapshotOf({
      turns: tense,
      customerState: state('frustrated', 'falling'),
      stateHistory: angryHistory,
    }),
  },

  // ---- Dialogs -------------------------------------------------------------------------------
  'end-confirm': {
    title: 'End the call?',
    group: 'Dialogs',
    description: 'The question: the accurate length, messages and state; Continue call has focus.',
    snapshot: snapshotOf({ turns: LONGER }),
    view: { initialUi: { endOpen: true } },
  },
  'end-ready-to-close': {
    title: 'Ready to close? (some done)',
    group: 'Dialogs',
    description:
      'Guided practice: the same question as a neutral check of four things, two of them done.',
    snapshot: snapshotOf({ turns: LONGER }, { config: { mode: 'guided' } }),
    view: { initialUi: { endOpen: true }, loadClosingCheck: closingCheckLoader('mixed') },
  },
  'end-ready-to-close-complete': {
    title: 'Ready to close? (all done)',
    group: 'Dialogs',
    description: 'All four are done: the words are the same, and nothing is awarded.',
    snapshot: snapshotOf({ turns: LONGER }, { config: { mode: 'guided' } }),
    view: { initialUi: { endOpen: true }, loadClosingCheck: closingCheckLoader('complete') },
  },
  'end-ready-to-close-loading': {
    title: 'Ready to close? (waiting for the check)',
    group: 'Dialogs',
    description: 'A short skeleton while the check loads. End and review is available at once.',
    snapshot: snapshotOf({ turns: LONGER }, { config: { mode: 'guided' } }),
    view: { initialUi: { endOpen: true }, loadClosingCheck: closingCheckLoader('loading') },
  },
  'end-ready-to-close-failed': {
    title: 'Ready to close? (the check failed)',
    group: 'Dialogs',
    description: 'The check left out, with no message about it. The question and the buttons stay.',
    snapshot: snapshotOf({ turns: LONGER }, { config: { mode: 'guided' } }),
    view: { initialUi: { endOpen: true }, loadClosingCheck: closingCheckLoader('failed') },
  },
  'end-confirm-short': {
    title: 'End the call? (short call)',
    group: 'Dialogs',
    description: 'A short call says its review will rest on limited evidence.',
    snapshot: snapshotOf({ turns: EARLY }),
    view: { initialUi: { endOpen: true } },
  },
  'end-unsaved': {
    title: 'End the call? (a message was not sent)',
    group: 'Dialogs',
    description:
      'The last message never reached the server: ending now leaves it out of the review.',
    snapshot: snapshotOf({
      turns: [
        ...MIDDLE,
        exchange(310, 'Take your time, I will stay on the line.', 'failed', 'text'),
      ],
      problem: problem('reply-failed'),
    }),
    view: { initialUi: { endOpen: true } },
  },
  'end-failed': {
    title: 'Ending failed',
    group: 'Dialogs',
    description: 'The call is still open: the failure is told in the dialog, with Retry.',
    snapshot: snapshotOf({ turns: MIDDLE, problem: problem('end-failed') }),
    view: { initialUi: { endOpen: true } },
  },
  'end-nothing-to-review': {
    title: 'Nothing to review',
    group: 'Dialogs',
    description: 'No message was ever sent: carry on, or leave without a report.',
    snapshot: snapshotOf({
      turns: OPENING,
      problem: problem('end-failed', { nothingToReview: true }),
    }),
    view: { initialUi: { endOpen: true } },
  },
  'case-sheet': {
    title: 'Case (sheet)',
    group: 'Dialogs',
    description: 'Below 80em the case opens as a sheet from the bar.',
    snapshot: snapshotOf({ turns: MIDDLE }),
    view: { initialUi: { caseOpen: true } },
  },
  'voice-settings': {
    title: 'Voice settings',
    group: 'Dialogs',
    description: 'Hands-free, customer audio, language and what is really in use.',
    snapshot: snapshotOf({ turns: MIDDLE, handsFree: true }),
    view: { initialUi: { settingsOpen: true } },
  },
} satisfies Record<string, CallFixture>;

export type FixtureName = keyof typeof DEFINITIONS;

export const FIXTURES: Record<FixtureName, CallFixture> = DEFINITIONS;

export const FIXTURE_NAMES = Object.keys(FIXTURES) as FixtureName[];

export function isFixtureName(name: string | null): name is FixtureName {
  return name !== null && Object.prototype.hasOwnProperty.call(FIXTURES, name);
}

/**
 * The fixture that shows each status label, so a test can walk every state of the call. "Transcript
 * available" is the trainee's turn showing its words while the status says the customer is thinking.
 */
export const STATUS_FIXTURES: Record<StatusId, FixtureName> = {
  'mic-not-requested': 'preflight-voice',
  'requesting-permission': 'requesting-permission',
  'permission-denied': 'permission-denied',
  'mic-unavailable': 'microphone-unavailable',
  connecting: 'connecting',
  'mic-ready': 'mic-ready',
  listening: 'listening',
  'speech-detected': 'speech-detected',
  'processing-speech': 'processing-speech',
  'generating-reply': 'transcript-available',
  'customer-speaking': 'customer-speaking',
  paused: 'paused',
  muted: 'muted',
  'retry-required': 'retry-required',
  retrying: 'retrying',
  'limit-reached': 'problem-turn-limit',
  'text-fallback': 'text-fallback',
  offline: 'offline',
  ending: 'ending',
  evaluating: 'evaluating',
  completed: 'completed',
};
