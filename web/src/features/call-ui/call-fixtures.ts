import type {
  PublicStateDTO,
  SessionDTO,
  SessionScenarioView,
  TurnDTO,
} from '#shared/domain/api.ts';
import type { TemperatureBandId } from '#shared/domain/vocab.ts';
import type {
  CallProblem,
  CallSnapshot,
  CallStatePoint,
  CallSupport,
  CallTurn,
} from '../call/contract.ts';
import type { InitialUi } from './CallWorkspace.tsx';

// Typed snapshots for every state the call screen can be in, built from the real scenario "Locked
// out after a password reset" (a fictional front-desk coordinator, Maya Okafor). They feed the dev
// gallery (`gallery-call.html?state=<name>`), the tests and the screenshots. Nothing here talks to a
// server: each fixture is a plain `CallSnapshot`, which is the whole contract between the call
// engine and the screen. The words of every problem are the engine's own.

export const FIXTURE_START = '2026-11-21T09:00:00.000Z';
const at = (seconds: number) => new Date(Date.parse(FIXTURE_START) + seconds * 1000).toISOString();

// ---- The scenario -------------------------------------------------------------------------------

const SCENARIO: SessionScenarioView = {
  scenarioId: 'locked-out-after-password-reset',
  title: 'Locked out after a password reset',
  summary:
    'A front-desk coordinator cannot sign in to the staff portal after changing her password this morning.',
  issueType: 'sign-in-access',
  tags: ['sign-in', 'password', 'single user'],
  estimatedMinutes: 8,
  persona: {
    name: 'Maya Okafor',
    role: 'Front-desk coordinator',
    organisation: 'Fabrikam Dental Group',
  },
  brief: {
    situation:
      'A front-desk coordinator is calling because she cannot sign in to the staff portal. She is polite and a little worried about holding up her morning.',
    goal: 'Understand what is happening and why, then agree how she will get back in.',
    groundRules: [
      'The customer, organisation and product are fictional.',
      'Ask questions to find out what you need; the customer will not volunteer everything.',
    ],
  },
  config: {
    impact: 'low',
    startingTemperature: 'calm',
    proficiency: 'novice',
    style: 'talkative',
    callStage: 'first-contact',
    difficulty: 'starter',
    mode: 'immersive',
    curveballsEnabled: false,
  },
  expectedDiscoveryAreas: [
    'The exact message on screen',
    'Other devices using the account',
    'When it started',
    'What has been tried',
  ],
  coachingFocus: ['scoping-discovery', 'clarity'],
};

// ---- Turns --------------------------------------------------------------------------------------

type Spoken = 'voice' | 'text';
type Line = readonly [seconds: number, text: string, how?: Spoken];

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

function traineeTurn(index: number, seconds: number, text: string, how: Spoken): CallTurn {
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

/** Alternates customer and trainee lines, the customer opening, numbering turns from 1. */
function conversation(
  customer: readonly Line[],
  trainee: readonly Line[],
  count: number,
): CallTurn[] {
  const turns: CallTurn[] = [];
  for (let index = 1; index <= count; index += 1) {
    const isCustomer = index % 2 === 1;
    const pool = isCustomer ? customer : trainee;
    const line = pool[Math.floor((index - 1) / 2) % pool.length] as Line;
    const [seconds, text, how = 'voice'] = line;
    turns.push(
      isCustomer ? customerTurn(index, seconds, text) : traineeTurn(index, seconds, text, how),
    );
  }
  return turns;
}

const MAYA: readonly Line[] = [
  [
    0,
    "Hello? Hi, yes, I can't sign in to the staff portal. It stopped letting me in after I changed my password this morning.",
  ],
  [
    36,
    "Oh, thank you. It says something about waiting and trying again later, I think. Sorry, I'm not very technical. I just type my new password and it doesn't let me in.",
  ],
  [
    74,
    'It was fine yesterday. I changed my password at about ten past eight because the system said it was about to expire, and it has not let me in since.',
  ],
  [
    117,
    "Well, my work email is on my phone too. It keeps asking me to re-enter my password, but I've just been tapping it away.",
  ],
  [161, "Oh, okay. Is that bad? I hope I haven't broken something."],
  [
    205,
    'That makes sense, I suppose. So the phone has been trying the old password again and again?',
  ],
  [
    247,
    'I did not know it did that in the background. I thought it only asked when I opened the app.',
  ],
  [
    290,
    "Okay. And how long does the lock last? The first patients arrive at nine and I can't check anyone in without the portal.",
  ],
  [333, "That's a relief, thank you. Will it unlock by itself, or do you have to do something?"],
  [
    372,
    "Right, yes, I can see the app on my phone. It's the little envelope with the blue circle.",
  ],
  [410, 'Do I delete the account, or just change the password on it?'],
  [
    451,
    "Okay, I'm opening the settings now. It's asking me which account, and there are two listed.",
  ],
  [492, 'The second one, the one that ends with fabrikamdental. Is that the right one?'],
  [531, "Done. It says it's syncing now. Should I try the portal again?"],
  [570, "It worked! I'm in. Oh, thank you so much, that was really helpful."],
  [609, 'Will it happen again the next time my password changes?'],
  [648, "That's good to know. I'll tell the others at the desk so they do the same."],
  [
    690,
    'Actually, one more thing. My colleague Dan changed his password this morning too, and he is locked out as well.',
  ],
  [730, "I think so, yes. He's always on his phone between patients."],
  [772, "I'll ask him now. Hold on a moment."],
  [811, 'He says he has done it. What should he do next?'],
  [851, 'He is in! He says thank you.'],
  [890, 'Will you send us something so we remember for next time?'],
  [930, 'That would be perfect, thank you.'],
  [968, "No, I think that's everything for now."],
  [1004, 'Thank you. Bye for now.'],
  [1042, 'Sorry, one last thing. Does he need to do anything on his laptop as well?'],
  [1080, 'Okay, I will let him know. Thanks again.'],
  [1118, 'That is all from me. Have a lovely day.'],
  [1156, 'Goodbye.'],
];

const YOU: readonly Line[] = [
  [
    19,
    "Hi Maya, thanks for calling Northwind support. I'm sorry you're locked out first thing. Can you tell me what the sign-in screen says when you try?",
  ],
  [
    58,
    "That's fine, you're describing it really clearly. When did it last work, and what happened between then and now?",
  ],
  [
    98,
    'Thanks. Is your work email or the portal signed in on any other device, like your phone, that might still have the old password?',
  ],
  [140, 'That could well be the cause. Let me check the account on my side while we talk.', 'text'],
  [
    183,
    "It isn't bad at all, and you haven't broken anything. Your phone has been trying the old password in the background, and after enough tries the account locks itself to protect you.",
  ],
  [
    226,
    'Exactly. Each time the phone tries, the account sees another failed sign-in, so it locked for a short time.',
  ],
  [268, "Most mail apps do that, so it's a really common thing. It's easy to fix."],
  [
    311,
    'I understand the pressure with the first patients. The lock is only temporary, and I can clear it from my side now. I will confirm in a minute.',
  ],
  [352, "I'll unlock it for you now. It's done on my side, so you don't need to wait."],
  [
    391,
    "Great. Before you try again, let's fix the phone so it doesn't lock you out again. Can you open your mail app?",
  ],
  [431, 'Change the password on it rather than deleting the account, so you keep your mail.'],
  [472, 'Which accounts can you see listed in the settings?'],
  [511, "That's the one, yes. Tap it and enter the new password you chose this morning."],
  [551, 'Yes, give the portal a go now, and tell me what you see.'],
  [590, "Wonderful. I'm glad you're back in. Just so we're sure, can you open today's bookings?"],
  [
    628,
    'Not if the phone has the new password. The lock only happens when an old password keeps being tried.',
  ],
  [670, "That's a good idea. Passing it on will save them the same trouble."],
  [710, 'Thanks for telling me. Does Dan also have his work email on a phone or a tablet?'],
  [
    752,
    "Then it's very likely the same cause. Can he change the password on his phone first, before we unlock him?",
  ],
  [791, 'Of course, take your time. I will stay on the line.'],
  [831, "Great. I'll unlock his account now, and then he can try the portal again."],
  [871, "Lovely. I'll add both accounts to the case notes so the team knows what happened."],
  [911, "Yes, I'll send a short note by email with the steps, so you can share it with the desk."],
  [950, "You're welcome. Is there anything else you'd like to check before we finish?"],
  [988, "Then I'll let you get to your first patients. Thanks for your patience, Maya."],
  [1022, 'Take care.', 'text'],
  [1060, 'No, he only needs to change it on the phone. The laptop is fine.'],
  [1098, 'You are welcome. Glad we could sort it out.'],
  [1136, 'Anything else, just call again.'],
  [1174, 'Bye for now.', 'text'],
];

/** A harder call: the customer's patience runs out. Used for the angry and escalating fixtures. */
const TENSE_CUSTOMER: readonly Line[] = [
  [
    0,
    "I've already explained this to two people this morning. I can't get into the portal and nobody has told me anything.",
  ],
  [41, "Yes! That's what I just said. Can you just fix it? The first patients are already here."],
  [88, "I don't have time to read you screens. I need this unlocked now, not twenty questions."],
  [139, 'It says too many attempts. There. Now what? How long is this going to take?'],
  [
    193,
    "You said that last time. I want to speak to someone more senior if this isn't sorted in five minutes.",
  ],
  [
    249,
    "That is not good enough. I have people waiting at the desk and I'm writing their names on paper.",
  ],
  [
    301,
    "Why does nobody here know what is going on? I'm going to put this in writing to my manager.",
  ],
  [352, 'Fine. Do it. But I want a name and a time that someone will call me back.'],
];

const TENSE_YOU: readonly Line[] = [
  [
    17,
    "I'm sorry about that, Maya. Let me make sure I have this right. You can't sign in, and it began after your password change this morning?",
  ],
  [66, 'I understand, and I will do what I can quickly. What does the screen say when you try?'],
  [
    116,
    "I'm hearing that it's urgent. I'll check the account while you tell me what the message says.",
  ],
  [166, 'Thank you, that helps. I can see the account is locked, and I can clear it in a moment.'],
  [221, "That's fair. I'll unlock it now and stay with you until you're back in.", 'text'],
  [
    276,
    'I hear you, and I am sorry the desk is waiting. The account is unlocked now; please try again.',
  ],
  [327, 'Understood. I will note this on the case and give you my name now.'],
];

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

// ---- Support, problems ---------------------------------------------------------------------------

const SERVER_SPEECH: CallSupport = {
  capture: 'server-speech',
  playback: 'server-speech',
  secureContext: true,
  reason: null,
  captureLabel: 'Azure AI Speech',
  playbackLabel: 'Azure AI Speech',
};
const DEMO_SPEECH: CallSupport = {
  ...SERVER_SPEECH,
  captureLabel: 'Demo speech (scripted)',
  playbackLabel: 'Demo speech (scripted)',
  speechDemo: true,
};
const BROWSER_SPEECH: CallSupport = {
  capture: 'browser-recognition',
  playback: 'browser-synthesis',
  secureContext: true,
  reason: null,
  captureLabel: 'Browser speech recognition (online)',
  playbackLabel: 'Browser voice',
};
const NO_VOICE: CallSupport = {
  capture: 'none',
  playback: 'none',
  secureContext: true,
  reason: 'This browser cannot use a microphone. You can still type your replies.',
  captureLabel: 'Typed replies only',
  playbackLabel: 'Captions only',
};

const PROBLEMS = {
  voiceGenerationFailed: {
    code: 'voice-generation-failed',
    title: "The customer's voice could not be made this time.",
    preserved: 'Their reply is in the transcript.',
    advice: 'Read it there, or choose Try again to hear it. You can keep talking or typing.',
    retry: 'speak',
    textFallback: true,
    severity: 'degraded',
  },
  playbackBlocked: {
    code: 'playback-blocked',
    title: "Your browser is blocking the customer's voice.",
    preserved: 'Their reply is in the transcript.',
    advice: 'Press Play to hear it, or read the reply and carry on.',
    retry: 'speak',
    textFallback: true,
    severity: 'degraded',
  },
  transcriptionFailed: {
    code: 'transcription-failed',
    title: 'We could not turn your speech into text.',
    preserved:
      'Nothing was sent. Your recording was not kept, and your transcript so far is saved.',
    advice: 'Choose Try again to say it again, or type your reply instead.',
    retry: 'transcribe',
    textFallback: true,
    severity: 'degraded',
  },
  replyFailed: {
    code: 'reply-failed',
    title: 'The customer could not reply.',
    preserved: 'Your message is kept here.',
    advice: 'Choose Try again to send it again. It will not be sent twice.',
    retry: 'send',
    textFallback: false,
    severity: 'blocking',
  },
  offline: {
    code: 'offline',
    title: 'You appear to be offline.',
    preserved: 'Your message is kept here.',
    advice:
      'Check your connection. Choose Try again to send your message. It will not be sent twice.',
    retry: 'send',
    textFallback: false,
    severity: 'blocking',
  },
  turnLimit: {
    code: 'turn-limit',
    title: 'This call has reached its message limit.',
    preserved: 'Everything you said is saved.',
    advice: 'End the call to see your coaching.',
    retry: null,
    textFallback: false,
    severity: 'blocking',
  },
  microphoneDenied: {
    code: 'microphone-denied',
    title: 'The microphone is blocked for this site.',
    preserved: 'Nothing has been recorded or sent.',
    advice:
      'Select the lock icon at the left of the address bar, open Permissions for this site, set Microphone to Allow, then choose Try again. You can also carry on by typing.',
    retry: 'microphone',
    textFallback: true,
    severity: 'blocking',
  },
  microphoneLost: {
    code: 'microphone-missing',
    title: 'No microphone was found.',
    preserved: 'Your transcript so far is saved.',
    advice:
      'Check that a microphone is connected and switched on, then choose Try again. You can also carry on by typing.',
    retry: 'microphone',
    textFallback: true,
    severity: 'blocking',
  },
  endFailed: {
    code: 'end-failed',
    title: 'We could not end the call.',
    preserved: 'Your call is still open and your transcript is saved.',
    advice: 'Choose Try again, or keep going and end it later.',
    retry: 'end',
    textFallback: true,
    severity: 'degraded',
  },
  nothingToReview: {
    code: 'end-failed',
    title: 'There is nothing to review yet.',
    preserved: 'No message has been sent, so there is no transcript.',
    advice: 'Send a message to the customer first, or leave the call without a report.',
    retry: null,
    textFallback: true,
    severity: 'degraded',
  },
  sessionUnavailable: {
    code: 'session-unavailable',
    title: 'This call could not be opened.',
    preserved: 'Nothing in the call was changed.',
    advice: 'Check your connection and choose Try again, or go back and start the call again.',
    retry: 'load',
    textFallback: false,
    severity: 'blocking',
  },
} as const satisfies Record<string, CallProblem>;

// The engine's own words for soft guidance (`web/src/features/call/hints.ts`), so the fixtures read
// exactly as the real screen does.
const NOTHING_HEARD =
  'Nothing was heard. Check that the right microphone is selected, then speak again, or type your reply.';
const NO_WORDS =
  'Your voice was picked up, but no words could be made out. Speak again, or type your reply.';

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
  turns?: CallTurn[];
  /** Overrides on the session's scenario configuration. */
  config?: Partial<SessionScenarioView['config']>;
  state?: PublicStateDTO;
}

function sessionFor(turns: readonly CallTurn[], build: Build): SessionDTO {
  const stored = turns.filter((turn) => turn.status === 'sent');
  const publicState = build.state ?? state('concerned', 'steady');
  return {
    id: 'ses_fixture_maya',
    scenarioId: SCENARIO.scenarioId,
    scenarioTitle: SCENARIO.title,
    issueType: SCENARIO.issueType,
    difficulty: SCENARIO.config.difficulty,
    startingTemperature: SCENARIO.config.startingTemperature,
    impact: SCENARIO.config.impact,
    style: SCENARIO.config.style,
    mode: build.config?.mode ?? SCENARIO.config.mode,
    providerKind: 'mock',
    providerLabel: 'Demo mode (built-in rules engine)',
    status: 'active',
    startedAt: FIXTURE_START,
    endedAt: null,
    durationSeconds: null,
    traineeTurns: stored.filter((turn) => turn.role === 'trainee').length,
    completion: null,
    overallScore: null,
    dimensionScores: null,
    scenario: { ...SCENARIO, config: { ...SCENARIO.config, ...build.config } },
    turns: stored.map(toTurnDTO),
    state: publicState,
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
  const customerState = overrides.customerState ?? build.state ?? state('concerned', 'steady');
  const lastAt =
    turns.length > 0 ? Date.parse(turns[turns.length - 1]!.createdAt) : Date.parse(FIXTURE_START);
  const base: CallSnapshot = {
    loading: false,
    loadProblem: null,
    session: sessionFor(turns, { ...build, state: customerState }),
    phase: 'ready-for-next-turn',
    mode: 'voice',
    microphone: 'granted',
    muted: false,
    paused: false,
    handsFree: false,
    speechDetected: false,
    micLevel: 0,
    customerLevel: 0,
    interim: '',
    customerState,
    stateHistory: history('calm', 'calm', 'concerned', 'concerned'),
    problem: null,
    hint: null,
    elapsedSeconds: Math.round((lastAt - Date.parse(FIXTURE_START)) / 1000) + 6,
    turnsRemaining: null,
    support: SERVER_SPEECH,
    voiceDetails: { voice: 'en-GB-SoniaNeural', style: 'none', language: 'en-GB' },
    announcement: null,
    ...overrides,
  };
  return base;
}

const OPENING = conversation(MAYA, YOU, 1);
const EARLY = conversation(MAYA, YOU, 3);
const MIDDLE = conversation(MAYA, YOU, 7);
const LONGER = conversation(MAYA, YOU, 9);

function pending(
  index: number,
  seconds: number,
  text: string,
  status: CallTurn['status'],
  how: Spoken,
): CallTurn {
  return {
    key: `pending-${index}`,
    index: null,
    role: 'trainee',
    text,
    inputMode: how,
    createdAt: at(seconds),
    status,
    clientMessageId: `pending-${index}`,
    interrupted: false,
  };
}

// ---- The fixtures -------------------------------------------------------------------------------

export type FixtureGroup =
  | 'Screens'
  | 'Stages of a turn'
  | 'Call modes'
  | 'Problems'
  | 'Customer state'
  | 'Content and dialogs';

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
  };
}

const NO_STATE_YET = null;

const idle = (overrides: Partial<CallSnapshot> = {}): CallSnapshot =>
  snapshotOf({
    turns: OPENING,
    phase: 'idle',
    microphone: 'unknown',
    customerState: state('calm', 'steady'),
    stateHistory: history('calm'),
    elapsedSeconds: 0,
    ...overrides,
  });

const tense = conversation(TENSE_CUSTOMER, TENSE_YOU, 15);
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

/** The speaking customer's reply is the last turn and is already in the transcript. */
const speaking = snapshotOf({
  turns: MIDDLE,
  phase: 'customer-speaking',
  customerLevel: 0.55,
  customerState: state('concerned', 'rising'),
  announcement: { id: 1, text: 'The customer is speaking.' },
});

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
      customerState: NO_STATE_YET,
      stateHistory: [],
      phase: 'idle',
      microphone: 'unknown',
      elapsedSeconds: 0,
    }),
  },
  'load-error': {
    title: 'Could not load',
    group: 'Screens',
    description: 'The session could not be loaded at all: what happened, nothing lost, Try again.',
    snapshot: snapshotOf({
      turns: [],
      session: null,
      customerState: NO_STATE_YET,
      stateHistory: [],
      phase: 'idle',
      microphone: 'unknown',
      loadProblem: PROBLEMS.sessionUnavailable,
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
      customerState: NO_STATE_YET,
      stateHistory: [],
      phase: 'idle',
      microphone: 'unknown',
      elapsedSeconds: 0,
    }),
  },
  'preflight-voice': {
    title: 'Pre-flight: voice',
    group: 'Screens',
    description: 'Before the call, with a spoken call as the main action.',
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
    description:
      'The server runs the scripted demonstration: it does not understand audio, and says so.',
    snapshot: idle({ support: DEMO_SPEECH }),
  },
  'preflight-unsupported': {
    title: 'Pre-flight: voice unavailable',
    group: 'Screens',
    description:
      'This browser cannot hold a spoken call: the reason, and a typed call as the way on.',
    snapshot: idle({ support: NO_VOICE, microphone: 'unavailable' }),
  },
  'preflight-resume': {
    title: 'Pre-flight: resume',
    group: 'Screens',
    description: 'The call already has turns from the trainee: the transcript so far and the time.',
    snapshot: idle({
      turns: LONGER,
      elapsedSeconds: 392,
      stateHistory: history('calm', 'calm', 'concerned', 'concerned', 'concerned'),
    }),
  },
  'requesting-microphone': {
    title: 'Waiting for the microphone',
    group: 'Screens',
    description: "The browser's permission prompt is open.",
    snapshot: idle({ phase: 'requesting-microphone', microphone: 'prompt' }),
  },
  'microphone-denied': {
    title: 'Microphone blocked',
    group: 'Screens',
    description: 'A blocking microphone problem before the call, with its advice and two ways on.',
    snapshot: idle({ microphone: 'denied', problem: PROBLEMS.microphoneDenied }),
  },

  // ---- The stages of a turn -----------------------------------------------------------------
  ready: {
    title: 'Connecting',
    group: 'Stages of a turn',
    description: 'The microphone is allowed and the customer is about to speak their opening line.',
    snapshot: snapshotOf({
      turns: OPENING,
      phase: 'ready',
      customerState: state('calm', 'steady'),
      stateHistory: history('calm'),
      elapsedSeconds: 4,
      announcement: { id: 1, text: 'Asking for the microphone.' },
    }),
  },
  listening: {
    title: 'Listening (waiting for you)',
    group: 'Stages of a turn',
    description: 'The microphone is open and nobody is speaking yet.',
    snapshot: snapshotOf({
      turns: EARLY,
      phase: 'listening',
      micLevel: 0.12,
      customerState: state('calm', 'steady'),
      stateHistory: history('calm', 'calm'),
    }),
  },
  'speech-detected': {
    title: 'Hearing you',
    group: 'Stages of a turn',
    description:
      'The trainee is speaking: their level, and their words so far under the transcript.',
    snapshot: snapshotOf({
      turns: MIDDLE,
      phase: 'listening',
      speechDetected: true,
      micLevel: 0.66,
      interim: 'Okay, I can see the account has been locked because of too many',
      customerState: state('concerned', 'steady'),
    }),
  },
  transcribing: {
    title: 'Transcribing',
    group: 'Stages of a turn',
    description: 'The trainee stopped speaking; the speech is being turned into text.',
    snapshot: snapshotOf({
      turns: [...MIDDLE, pending(8, 140, '', 'transcribing', 'voice')],
      phase: 'transcribing',
      customerState: state('concerned', 'steady'),
    }),
  },
  processing: {
    title: 'The customer is thinking',
    group: 'Stages of a turn',
    description: 'The text was sent and the customer’s reply is being produced.',
    snapshot: snapshotOf({
      turns: [
        ...MIDDLE,
        pending(
          8,
          140,
          'That could well be the cause. Let me check the account on my side while we talk.',
          'sending',
          'voice',
        ),
      ],
      phase: 'processing',
      customerState: state('concerned', 'steady'),
    }),
  },
  'customer-speaking': {
    title: 'The customer is speaking',
    group: 'Stages of a turn',
    description: 'The customer’s voice plays; their words are already in the transcript.',
    snapshot: speaking,
  },
  'ready-for-next-turn': {
    title: 'Your turn',
    group: 'Stages of a turn',
    description: 'The customer finished; push-to-talk, a standard call with no hints.',
    snapshot: snapshotOf({ turns: LONGER, customerState: state('concerned', 'steady') }),
  },
  'hands-free': {
    title: 'Hands-free',
    group: 'Stages of a turn',
    description: 'Hands-free is on: the microphone reopens by itself.',
    snapshot: snapshotOf({
      turns: LONGER,
      handsFree: true,
      customerState: state('concerned', 'steady'),
    }),
  },
  interrupted: {
    title: 'Customer interrupted',
    group: 'Stages of a turn',
    description:
      'The trainee stopped the customer’s voice: the full reply stays in the transcript.',
    snapshot: snapshotOf({
      turns: MIDDLE.map((turn, index) =>
        index === MIDDLE.length - 1 ? { ...turn, interrupted: true } : turn,
      ),
      customerState: state('concerned', 'rising'),
    }),
  },
  muted: {
    title: 'Muted',
    group: 'Stages of a turn',
    description: 'The microphone is muted.',
    snapshot: snapshotOf({
      turns: LONGER,
      muted: true,
      customerState: state('concerned', 'steady'),
    }),
  },
  paused: {
    title: 'Paused',
    group: 'Stages of a turn',
    description: 'The whole voice loop is paused.',
    snapshot: snapshotOf({
      turns: LONGER,
      paused: true,
      customerState: state('concerned', 'steady'),
    }),
  },
  'nothing-heard': {
    title: 'Nothing was heard',
    group: 'Stages of a turn',
    description: 'A soft hint, not an error, beside the controls: nothing was picked up.',
    snapshot: snapshotOf({
      turns: LONGER,
      hint: NOTHING_HEARD,
      customerState: state('concerned', 'steady'),
      announcement: { id: 2, text: NOTHING_HEARD },
    }),
  },
  'no-words': {
    title: 'A voice, but no words',
    group: 'Stages of a turn',
    description:
      'The microphone heard a voice but recognition found no words: speak again, or type.',
    snapshot: snapshotOf({
      turns: LONGER,
      support: BROWSER_SPEECH,
      hint: NO_WORDS,
      customerState: state('concerned', 'steady'),
      announcement: { id: 2, text: NO_WORDS },
    }),
  },

  // ---- Call modes ---------------------------------------------------------------------------
  'text-only': {
    title: 'Text-only call',
    group: 'Call modes',
    description: 'The call was started without the microphone: the composer is always open.',
    snapshot: snapshotOf({
      turns: conversation(MAYA, YOU, 5).map((turn) =>
        turn.role === 'trainee' ? { ...turn, inputMode: 'text' as const } : turn,
      ),
      mode: 'text',
      microphone: 'unknown',
      support: { ...BROWSER_SPEECH, playback: 'none', playbackLabel: 'Captions only' },
      customerState: state('concerned', 'steady'),
    }),
  },
  'text-only-thinking': {
    title: 'Text-only: the customer is thinking',
    group: 'Call modes',
    description: 'A typed message was sent: Send waits, with its reason.',
    snapshot: snapshotOf({
      turns: [
        ...conversation(MAYA, YOU, 5).map((turn) =>
          turn.role === 'trainee' ? { ...turn, inputMode: 'text' as const } : turn,
        ),
        pending(6, 230, 'Is your work email on a phone or a tablet as well?', 'sending', 'text'),
      ],
      mode: 'text',
      microphone: 'unknown',
      phase: 'processing',
      support: { ...BROWSER_SPEECH, playback: 'none', playbackLabel: 'Captions only' },
      customerState: state('concerned', 'steady'),
    }),
  },
  'composer-open': {
    title: 'Typing on a voice call',
    group: 'Call modes',
    description: 'The reply box opened on a spoken call, with a draft.',
    snapshot: snapshotOf({ turns: LONGER, customerState: state('concerned', 'steady') }),
    view: {
      initialUi: {
        composerOpen: true,
        draft:
          'Thanks, Maya. Could you open the mail app on your phone and tell me which accounts you can see listed?',
      },
    },
  },
  'composer-limit': {
    title: 'Typing near the limit',
    group: 'Call modes',
    description: 'The counter has appeared and the message is over the limit.',
    snapshot: snapshotOf({ turns: LONGER, customerState: state('concerned', 'steady') }),
    view: {
      initialUi: {
        composerOpen: true,
        draft: 'Maya, '.concat(
          'here is a very long explanation of how the account locks and why the phone tries again. '.repeat(
            18,
          ),
        ),
      },
    },
  },
  'guided-hints': {
    title: 'Guided practice (hints on)',
    group: 'Call modes',
    description: 'Guided practice: the context-found count and the areas worth exploring.',
    snapshot: snapshotOf(
      {
        turns: LONGER,
        customerState: state('concerned', 'steady', 2),
      },
      { config: { mode: 'guided' } },
    ),
  },
  'live-model': {
    title: 'Live model',
    group: 'Call modes',
    description: 'A live provider is labelled with its real name, never as demo mode.',
    snapshot: snapshotOf({ turns: LONGER, customerState: state('concerned', 'steady') }),
    view: { provider: { demo: false, label: 'Azure OpenAI (gpt-4o)' } },
  },
  'browser-voice': {
    title: 'Browser voice and recognition',
    group: 'Call modes',
    description:
      "The browser's own voice and recognition: the label says which voice spoke, and that recognition can miss words.",
    snapshot: snapshotOf({
      turns: LONGER,
      support: {
        ...BROWSER_SPEECH,
        playbackLabel: 'Browser voice (on this device): Microsoft David, en-US',
      },
      voiceDetails: { voice: null, style: null, language: 'en-GB' },
      customerState: state('concerned', 'steady'),
    }),
    view: { initialUi: { settingsOpen: true } },
  },

  // ---- Problems -----------------------------------------------------------------------------
  'problem-voice-generation-failed': {
    title: 'Problem: the customer’s voice failed',
    group: 'Problems',
    description: 'A problem the call can carry on through.',
    snapshot: snapshotOf({
      turns: MIDDLE,
      problem: PROBLEMS.voiceGenerationFailed,
      customerState: state('concerned', 'rising'),
      announcement: { id: 3, text: `Problem: ${PROBLEMS.voiceGenerationFailed.title}` },
    }),
  },
  'problem-playback-blocked': {
    title: 'Problem: the browser blocked the voice',
    group: 'Problems',
    description: 'A visible Play customer reply button.',
    snapshot: snapshotOf({
      turns: MIDDLE,
      problem: PROBLEMS.playbackBlocked,
      customerState: state('concerned', 'rising'),
    }),
  },
  'problem-transcription-failed': {
    title: 'Problem: speech could not be turned into text',
    group: 'Problems',
    description: 'Nothing was sent; Try again or type instead.',
    snapshot: snapshotOf({
      turns: LONGER,
      problem: PROBLEMS.transcriptionFailed,
      customerState: state('concerned', 'steady'),
    }),
  },
  'problem-reply-failed': {
    title: 'Problem: the customer could not reply (can carry on)',
    group: 'Problems',
    description: 'A failed trainee turn, kept, with its own Try again.',
    snapshot: snapshotOf({
      turns: [
        ...MIDDLE,
        {
          ...pending(
            8,
            140,
            'That could well be the cause. Let me check the account on my side while we talk.',
            'failed',
            'voice',
          ),
        },
      ],
      problem: { ...PROBLEMS.replyFailed, severity: 'degraded' },
      customerState: state('concerned', 'steady'),
    }),
  },
  'blocking-reply-failed': {
    title: 'Blocking: the customer could not reply',
    group: 'Problems',
    description: 'As the engine reports it: the controls area gives way to the problem.',
    snapshot: snapshotOf({
      turns: [
        ...MIDDLE,
        pending(
          8,
          140,
          'That could well be the cause. Let me check the account on my side while we talk.',
          'failed',
          'voice',
        ),
      ],
      problem: PROBLEMS.replyFailed,
      customerState: state('concerned', 'steady'),
    }),
  },
  'problem-offline': {
    title: 'Offline',
    group: 'Problems',
    description: 'The browser is offline: the badge says so and Send waits.',
    snapshot: snapshotOf({
      turns: [
        ...MIDDLE,
        pending(
          8,
          140,
          'That could well be the cause. Let me check the account on my side while we talk.',
          'failed',
          'voice',
        ),
      ],
      problem: PROBLEMS.offline,
      customerState: state('concerned', 'steady'),
    }),
    view: { online: false },
  },
  'problem-microphone-lost': {
    title: 'The microphone stopped working',
    group: 'Problems',
    description:
      'The microphone was lost during the call, so the call carries on typed, with a way to try the microphone again.',
    snapshot: snapshotOf({
      turns: LONGER,
      mode: 'text',
      microphone: 'unavailable',
      problem: PROBLEMS.microphoneLost,
      customerState: state('concerned', 'steady'),
    }),
  },
  'turn-limit': {
    title: 'Message limit reached',
    group: 'Problems',
    description: 'Voice and typing are off; End call is the way on.',
    snapshot: snapshotOf({
      turns: conversation(MAYA, YOU, 29),
      problem: PROBLEMS.turnLimit,
      turnsRemaining: 0,
      customerState: state('calm', 'steady'),
      stateHistory: history('calm', 'calm', 'concerned', 'calm', 'calm', 'calm', 'calm'),
    }),
  },

  // ---- The customer's state -----------------------------------------------------------------
  'state-calm': {
    title: 'State: calm',
    group: 'Customer state',
    description: 'Calm and steady.',
    snapshot: snapshotOf({
      turns: LONGER,
      customerState: state('calm', 'steady'),
      stateHistory: history('calm', 'calm', 'calm', 'calm', 'calm'),
    }),
  },
  'state-concerned': {
    title: 'State: concerned',
    group: 'Customer state',
    description: 'Concerned and rising.',
    snapshot: snapshotOf({
      turns: LONGER,
      customerState: state('concerned', 'rising'),
      stateHistory: history('calm', 'calm', 'concerned', 'concerned', 'concerned'),
    }),
  },
  'state-frustrated': {
    title: 'State: frustrated',
    group: 'Customer state',
    description: 'Frustrated and rising.',
    snapshot: snapshotOf({
      turns: tense.slice(0, 9),
      customerState: state('frustrated', 'rising'),
      stateHistory: history('calm', 'concerned', 'frustrated', 'frustrated', 'frustrated'),
    }),
  },
  'state-angry': {
    title: 'State: angry',
    group: 'Customer state',
    description: 'Angry after a longer, tenser call.',
    snapshot: snapshotOf({
      turns: tense.slice(0, 13),
      customerState: state('angry', 'rising'),
      stateHistory: angryHistory.slice(0, 7),
    }),
  },
  'state-escalating': {
    title: 'State: escalating',
    group: 'Customer state',
    description: 'Escalating: the deepest red token, its own icon shape and its own word.',
    snapshot: snapshotOf({
      turns: tense,
      customerState: state('escalating', 'rising'),
      stateHistory: history(
        'calm',
        'concerned',
        'frustrated',
        'angry',
        'angry',
        'escalating',
        'escalating',
        'escalating',
      ),
    }),
  },
  'state-recovering': {
    title: 'State: recovering',
    group: 'Customer state',
    description: 'The customer is easing after a higher band: recovering, with its arrow.',
    snapshot: snapshotOf({
      turns: tense,
      customerState: state('frustrated', 'falling'),
      stateHistory: history(
        'calm',
        'concerned',
        'frustrated',
        'angry',
        'angry',
        'frustrated',
        'frustrated',
        'frustrated',
      ),
    }),
  },

  // ---- Content and dialogs ------------------------------------------------------------------
  'long-transcript': {
    title: 'A 60-turn transcript',
    group: 'Content and dialogs',
    description:
      'A long call: older turns are laid out lazily and the log still follows the newest.',
    snapshot: snapshotOf({
      turns: conversation(MAYA, YOU, 60),
      customerState: state('calm', 'falling'),
      stateHistory: history(
        'calm',
        'calm',
        'concerned',
        'concerned',
        'frustrated',
        'concerned',
        'concerned',
        'calm',
        'calm',
        'calm',
        'calm',
        'calm',
        'calm',
        'calm',
        'calm',
        'calm',
        'calm',
        'calm',
        'calm',
        'calm',
        'calm',
        'calm',
        'calm',
        'calm',
        'calm',
        'calm',
        'calm',
        'calm',
        'calm',
        'calm',
      ),
      elapsedSeconds: 1190,
    }),
  },
  'end-confirm': {
    title: 'End the call?',
    group: 'Content and dialogs',
    description: 'The question before a call ends: facts and what happens next.',
    snapshot: snapshotOf({
      turns: conversation(MAYA, YOU, 13),
      customerState: state('calm', 'steady'),
    }),
    view: { initialUi: { endOpen: true } },
  },
  'end-confirm-short': {
    title: 'End the call? (a short call)',
    group: 'Content and dialogs',
    description: 'Fewer than six turns from the trainee: the note about limited evidence.',
    snapshot: snapshotOf({
      turns: EARLY,
      customerState: state('calm', 'steady'),
      stateHistory: history('calm', 'calm'),
    }),
    view: { initialUi: { endOpen: true } },
  },
  'end-failed': {
    title: 'End the call: it failed',
    group: 'Content and dialogs',
    description: 'Ending did not work: the problem and Try again, inside the dialog.',
    snapshot: snapshotOf({
      turns: conversation(MAYA, YOU, 13),
      // A spoken call carries on paused after a failed ending: the microphone was let go of.
      paused: true,
      problem: PROBLEMS.endFailed,
      customerState: state('calm', 'steady'),
    }),
    view: { initialUi: { endOpen: true } },
  },
  'end-nothing-to-review': {
    title: 'End the call: nothing to review',
    group: 'Content and dialogs',
    description:
      'No message was ever sent, so there is no report: carry on, or leave without a report.',
    snapshot: snapshotOf({
      turns: OPENING,
      paused: true,
      problem: PROBLEMS.nothingToReview,
      customerState: state('calm', 'steady'),
      stateHistory: history('calm'),
    }),
    view: { initialUi: { endOpen: true } },
  },
  ending: {
    title: 'Ending the call',
    group: 'Content and dialogs',
    description: 'The call is closing: never blank, with the heading focused.',
    snapshot: snapshotOf({
      turns: conversation(MAYA, YOU, 13),
      phase: 'ending',
      customerState: state('calm', 'steady'),
      announcement: { id: 9, text: 'Ending the call.' },
    }),
  },
  'details-open': {
    title: 'Call details sheet',
    group: 'Content and dialogs',
    description: 'The context as a sheet, below 80em (open it with Details).',
    snapshot: snapshotOf({ turns: LONGER, customerState: state('concerned', 'steady') }),
    view: { initialUi: { detailsOpen: true } },
  },
  'voice-settings': {
    title: 'Voice settings',
    group: 'Content and dialogs',
    description: 'Hands-free, the language and a plain read-out of what is really in use.',
    snapshot: snapshotOf({ turns: LONGER, customerState: state('concerned', 'steady') }),
    view: { initialUi: { settingsOpen: true } },
  },
} satisfies Record<string, CallFixture>;

export type FixtureName = keyof typeof DEFINITIONS;

/** Every fixture, typed as a `CallFixture` so that the optional `view` can be read from any of them. */
export const FIXTURES: Record<FixtureName, CallFixture> = DEFINITIONS;

export const FIXTURE_NAMES = Object.keys(FIXTURES) as FixtureName[];

export function isFixtureName(name: string | null): name is FixtureName {
  return name !== null && Object.hasOwn(FIXTURES, name);
}
