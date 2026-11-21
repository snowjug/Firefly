import type { PublicStateDTO, SessionDTO, SessionScenarioView } from '#shared/domain/api.ts';
import { SPEECH_LANGUAGES, type SpeechLanguage } from '#shared/domain/speech.ts';
import {
  CALL_STAGE_LABELS,
  IMPACT_LABELS,
  TEMPERATURE_BANDS,
  type TemperatureBandId,
} from '#shared/domain/vocab.ts';
import type { BadgeTone, CustomerState, IconName } from '../../design/index.ts';
import type {
  CallPhase,
  CallProblem,
  CallSnapshot,
  CallStage,
  CallStatePoint,
  CallTurn,
} from '../call/contract.ts';
import { VOICE_STATE_TEXT, type VoiceState } from '../voice/states.ts';

// Everything the call screen decides about what to say, kept free of React so it can be tested on
// its own: the status label for each state, the connection badge, the customer's state, which
// controls are available and why, the recovery actions a problem offers, when the composer must
// wait, and the facts of the case. Components only draw what comes out. Labels are state labels, not
// sentences: the live call has no instructional text.

// ---- The status: one label for the call as it is now --------------------------------------------

/**
 * What the screen shows for the call, one at a time. These are the states of the product brief
 * (section 15), each mapped from a machine stage (`CallStage`, see contract.ts); "transcript
 * available" is the trainee's turn showing its words while the status says the customer is replying.
 * The words are the voice layer's (`VOICE_STATE_TEXT`) wherever it has a state of the same name.
 */
export type StatusId =
  | 'mic-not-requested'
  | 'requesting-permission'
  | 'permission-denied'
  | 'mic-unavailable'
  | 'connecting'
  | 'mic-ready'
  | 'listening'
  | 'speech-detected'
  | 'processing-speech'
  | 'generating-reply'
  | 'customer-speaking'
  | 'paused'
  | 'muted'
  | 'retry-required'
  | 'retrying'
  | 'limit-reached'
  | 'text-fallback'
  | 'offline'
  | 'ending'
  | 'evaluating'
  | 'completed';

/** How the waveform strip is drawn: whose voice, a quiet line, a shimmer, or dots while the customer thinks. */
export type WaveMode = 'idle' | 'trainee' | 'customer' | 'transcribing' | 'thinking';

export interface CallStatus {
  id: StatusId;
  /** The machine stage it comes from. */
  stage: CallStage;
  /** One to three words. */
  label: string;
  /** What the pre-flight's microphone row says: the same state, in a word or two. */
  row: string;
  icon: IconName;
  wave: WaveMode;
  /** Whose turn it is, which decides the colour. `alert` is a state that needs the trainee's action. */
  who: 'trainee' | 'customer' | 'alert' | 'none';
}

const voice = (state: VoiceState): string => VOICE_STATE_TEXT[state].label;

type StatusSpec = Pick<CallStatus, 'label' | 'icon' | 'wave' | 'who'> & { row?: string };

const STATUS: Record<StatusId, StatusSpec> = {
  // Before the call, in the pre-flight's microphone row ("Microphone: Not requested").
  'mic-not-requested': {
    label: voice('microphone-not-requested'),
    row: 'Not requested',
    icon: 'microphone',
    wave: 'idle',
    who: 'none',
  },
  'requesting-permission': {
    label: voice('requesting-permission'),
    icon: 'clock',
    wave: 'thinking',
    who: 'trainee',
  },
  'permission-denied': {
    label: voice('permission-denied'),
    row: 'Blocked',
    icon: 'microphone-off',
    wave: 'idle',
    who: 'alert',
  },
  'mic-unavailable': { label: 'Unavailable', icon: 'microphone-off', wave: 'idle', who: 'alert' },
  // During the call, in the status line under the customer.
  connecting: { label: 'Connecting', icon: 'refresh', wave: 'thinking', who: 'customer' },
  'mic-ready': {
    label: voice('microphone-ready'),
    icon: 'microphone',
    wave: 'idle',
    who: 'trainee',
  },
  listening: { label: voice('listening'), icon: 'microphone', wave: 'trainee', who: 'trainee' },
  'speech-detected': {
    label: voice('speech-detected'),
    icon: 'waveform',
    wave: 'trainee',
    who: 'trainee',
  },
  'processing-speech': {
    label: voice('processing-speech'),
    icon: 'caption',
    wave: 'transcribing',
    who: 'trainee',
  },
  'generating-reply': {
    label: voice('generating-customer-reply'),
    icon: 'more',
    wave: 'thinking',
    who: 'customer',
  },
  'customer-speaking': {
    label: voice('customer-speaking'),
    icon: 'speaker',
    wave: 'customer',
    who: 'customer',
  },
  paused: { label: voice('paused'), icon: 'pause', wave: 'idle', who: 'none' },
  muted: { label: voice('muted'), icon: 'microphone-off', wave: 'idle', who: 'none' },
  'retry-required': { label: voice('retry-required'), icon: 'warning', wave: 'idle', who: 'alert' },
  retrying: { label: 'Retrying', icon: 'refresh', wave: 'thinking', who: 'trainee' },
  'limit-reached': { label: 'Message limit', icon: 'flag', wave: 'idle', who: 'alert' },
  'text-fallback': {
    label: voice('text-fallback'),
    icon: 'keyboard',
    wave: 'idle',
    who: 'trainee',
  },
  offline: { label: 'Offline', icon: 'error', wave: 'idle', who: 'alert' },
  ending: { label: voice('ending-call'), icon: 'clock', wave: 'thinking', who: 'none' },
  evaluating: { label: voice('evaluating'), icon: 'document', wave: 'thinking', who: 'none' },
  completed: { label: voice('completed'), icon: 'check-circle', wave: 'idle', who: 'none' },
};

export const STATUS_IDS = Object.keys(STATUS) as StatusId[];

export type StatusInput = Pick<
  CallSnapshot,
  'stage' | 'mode' | 'phase' | 'speechDetected' | 'microphone'
> & {
  problem?: Pick<CallProblem, 'code' | 'severity' | 'retry'> | null;
  /** The browser's own online state. Left out, it is online. */
  online?: boolean;
  /**
   * The microphone is really open (`CallSnapshot.micOpen`). Left out, it is: only a snapshot that
   * says it is not open yet shows "Microphone ready" while the trainee has already asked to talk.
   */
  micOpen?: boolean;
};

const isMicrophoneProblem = (code: string) => code.startsWith('microphone-');

/**
 * The status label for the call. The end of the call wins over everything, then being offline, then
 * a pause; a problem that stops the call replaces the quiet states ("Microphone ready", "Muted") so
 * the screen never says it is the trainee's turn while it is not, and a voice step that failed on
 * the trainee's turn says "Try again". A microphone lost mid-call is not such a problem: the call
 * carries on in text mode, and says so.
 */
export function describeStatus(input: StatusInput): CallStatus {
  const { stage, mode, phase, problem, online = true } = input;
  const make = (id: StatusId): CallStatus => {
    const { row, ...spec } = STATUS[id];
    return { id, stage, row: row ?? spec.label, ...spec };
  };
  if (stage === 'completed') return make('completed');
  if (stage === 'evaluating') return make('evaluating');
  if (stage === 'ending') return make('ending');
  if (!online) return make('offline');
  if (stage === 'idle') {
    if (problem && isMicrophoneProblem(problem.code)) {
      return make(problem.code === 'microphone-denied' ? 'permission-denied' : 'mic-unavailable');
    }
    return make('mic-not-requested');
  }
  if (stage === 'mic-permission') return make('requesting-permission');
  if (stage === 'paused') return make('paused');
  if (stage === 'retrying') return make('retrying');

  if (
    problem?.severity === 'blocking' &&
    !isMicrophoneProblem(problem.code) &&
    (stage === 'ready' || stage === 'muted' || stage === 'offline')
  ) {
    if (problem.code === 'turn-limit') return make('limit-reached');
    // Another tab ended the call: the page is about to open the report.
    if (problem.code === 'session-ended') return make('completed');
    return make('retry-required');
  }

  // A voice step that failed (speech that could not be turned into text, the customer's voice that
  // could not be made or played) is "Try again" while it is the trainee's turn, as the voice layer
  // says it. Once the microphone is open again it is Listening, and a typed call stays Typing.
  if (
    mode === 'voice' &&
    stage === 'ready' &&
    (problem?.retry === 'transcribe' || problem?.retry === 'speak')
  ) {
    return make('retry-required');
  }

  switch (stage) {
    case 'customer-speaking':
      return make('customer-speaking');
    case 'processing':
      return make('generating-reply');
    case 'transcribing':
    case 'endpointing':
      return make('processing-speech');
    case 'listening':
      // The trainee asked to talk but the microphone is still starting (or waiting for the
      // customer's voice to clear): it is not "Listening" until it really is.
      if (input.micOpen === false) return make('mic-ready');
      return make(input.speechDetected ? 'speech-detected' : 'listening');
    case 'muted':
      return make('muted');
    case 'offline':
      return make('retry-required');
    default:
      if (mode === 'text') return make('text-fallback');
      return make(phase === 'ready' ? 'connecting' : 'mic-ready');
  }
}

// ---- The connection badge in the top bar -------------------------------------------------------

export interface ConnectionStatus {
  key: 'live' | 'reconnecting' | 'offline';
  label: string;
  tone: BadgeTone;
  icon: IconName;
}

/**
 * Whether the call can reach the server. The browser's own online state is read by the page and
 * passed in, so a fixture can show any of these without touching the network; `reconnecting` is
 * the browser being back while a step that failed has not yet been sent again.
 */
export function describeConnection(input: {
  online: boolean;
  reconnecting?: boolean;
}): ConnectionStatus {
  if (!input.online) return { key: 'offline', label: 'Offline', tone: 'danger', icon: 'error' };
  if (input.reconnecting) {
    return { key: 'reconnecting', label: 'Reconnecting', tone: 'warning', icon: 'refresh' };
  }
  return { key: 'live', label: 'Live', tone: 'success', icon: 'check-circle' };
}

// ---- The customer's state ----------------------------------------------------------------------

export type Trend = PublicStateDTO['trend'];

const BAND_ORDER: readonly TemperatureBandId[] = TEMPERATURE_BANDS.map((band) => band.id);

/** 0 for calm up to 4 for escalating. */
function bandRank(band: TemperatureBandId): number {
  return BAND_ORDER.indexOf(band);
}

const TREND_WORDS: Record<Trend, 'rising' | 'steady' | 'easing'> = {
  rising: 'rising',
  steady: 'steady',
  falling: 'easing',
};

const TREND_ICONS: Record<Trend, IconName> = {
  rising: 'trend-up',
  steady: 'trend-flat',
  falling: 'trend-down',
};

export interface CustomerStateView {
  bandId: TemperatureBandId;
  /** The colour and icon family: the band, or `recovering` while a higher band is behind them. */
  tone: CustomerState;
  /** What the badge says: the band's name, or "Recovering". */
  label: string;
  bandLabel: string;
  trend: Trend;
  trendWord: 'rising' | 'steady' | 'easing';
  trendIcon: IconName;
  recovering: boolean;
}

/**
 * How the customer is now. "Recovering" is when they are easing and have been hotter earlier in the
 * call; a calm customer is never "recovering". It never shows a number and never says why.
 */
export function describeCustomerState(
  state: PublicStateDTO | null,
  history: readonly CallStatePoint[],
): CustomerStateView | null {
  if (!state) return null;
  const bandId = state.band.id;
  const rank = bandRank(bandId);
  const recovering =
    state.trend === 'falling' && rank > 0 && history.some((point) => bandRank(point.band) > rank);
  return {
    bandId,
    tone: recovering ? 'recovering' : bandId,
    label: recovering ? 'Recovering' : state.band.label,
    bandLabel: state.band.label,
    trend: state.trend,
    trendWord: TREND_WORDS[state.trend],
    trendIcon: TREND_ICONS[state.trend],
    recovering,
  };
}

/** The one sentence a screen reader hears when the customer's state changes. It never says why. */
export function stateChangeSentence(view: CustomerStateView): string {
  return view.recovering
    ? 'The customer seems to be recovering.'
    : `The customer now seems ${view.bandLabel.toLowerCase()}.`;
}

// ---- Times, counts and labels ------------------------------------------------------------------

/** m:ss for a number of seconds. */
export function clock(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(Number.isFinite(totalSeconds) ? totalSeconds : 0));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/** m:ss since the call started, or an empty string when either time cannot be read. */
export function clockSince(startedAt: string, at: string): string {
  const start = Date.parse(startedAt);
  const moment = Date.parse(at);
  if (Number.isNaN(start) || Number.isNaN(moment)) return '';
  return clock((moment - start) / 1000);
}

/** A time is only worth showing when a minute has passed since the last one that was shown. */
const TIME_EVERY_SECONDS = 60;

/**
 * Which turns carry a timestamp: the first, and then one a minute or more after the last that did.
 * A stamp on every line is noise; a stamp now and then is orientation. Returns turn key to m:ss.
 */
export function timeMarks(turns: readonly CallTurn[], startedAt: string): Map<string, string> {
  const marks = new Map<string, string>();
  let shown = Number.NEGATIVE_INFINITY;
  for (const turn of turns) {
    const at = Date.parse(turn.createdAt);
    if (Number.isNaN(at)) continue;
    if (marks.size === 0 || at - shown >= TIME_EVERY_SECONDS * 1000) {
      const text = clockSince(startedAt, turn.createdAt);
      if (text) {
        marks.set(turn.key, text);
        shown = at;
      }
    }
  }
  return marks;
}

/** How many of the trainee's turns the server holds (a message still being sent does not count). */
export function traineeTurnCount(turns: readonly CallTurn[]): number {
  return turns.filter((turn) => turn.role === 'trainee' && turn.status === 'sent').length;
}

/** The trainee's words that were never saved: ending the call now would leave them out of the review. */
export function unsavedMessage(turns: readonly CallTurn[]): boolean {
  return turns.some(
    (turn) => turn.role === 'trainee' && turn.status === 'failed' && turn.index === null,
  );
}

/** Below this many of the trainee's turns, the report rests on limited evidence. */
export const SHORT_CALL_TURNS = 6;

export function latestCustomerTurn(turns: readonly CallTurn[]): CallTurn | undefined {
  return turns.findLast((turn) => turn.role === 'customer');
}

export const LANGUAGE_NAMES: Record<SpeechLanguage, string> = {
  'en-GB': 'English (United Kingdom)',
  'en-US': 'English (United States)',
  'en-IE': 'English (Ireland)',
  'en-AU': 'English (Australia)',
  'en-IN': 'English (India)',
};

/** Who writes the customer's replies, said without dressing the built-in rules up as a live model. */
export function providerDescription(provider: { demo: boolean; label: string }): string {
  return provider.demo
    ? "Demo mode: Firefly's built-in rules engine"
    : `Live model: ${provider.label}`;
}

/** The first of the browser's languages that speech supports, or undefined to leave the default. */
export function preferredLanguage(tags: readonly string[]): SpeechLanguage | undefined {
  for (const tag of tags) {
    const match = SPEECH_LANGUAGES.find((code) => code.toLowerCase() === tag.toLowerCase());
    if (match) return match;
  }
  return undefined;
}

/**
 * Where "Back to brief" goes: the brief for this scenario, with the choices the call was made with,
 * in the query keys the brief reads (`difficulty`, `impact`, `temperature`, `proficiency`, `style`,
 * `stage`, `hints` and, when complications were switched off, `curveballs=none`). A brief that does
 * not know a key ignores it. Which complications were chosen is not part of the call as the browser
 * sees it, so a chosen set comes back as the scenario's default.
 */
export function briefPathFor(session: SessionDTO): string {
  const { config } = session.scenario;
  const query = new URLSearchParams({
    difficulty: config.difficulty,
    impact: config.impact,
    temperature: config.startingTemperature,
    proficiency: config.proficiency,
    style: config.style,
    stage: config.callStage,
    hints: config.mode === 'guided' ? 'on' : 'off',
  });
  if (!config.curveballsEnabled) query.set('curveballs', 'none');
  return `/scenarios/${encodeURIComponent(session.scenarioId)}/brief?${query.toString()}`;
}

// ---- The controls ------------------------------------------------------------------------------

export interface TalkControl {
  /** `talk` opens the microphone, `done` finishes the utterance, `voice` goes back to voice from text. */
  kind: 'talk' | 'done' | 'voice';
  /** The visible label, and the accessible name. */
  label: string;
  icon: IconName;
  /** Looks and acts disabled but stays in the tab order, so focus is never lost between states. */
  disabled: boolean;
  /** The microphone was asked for and is still starting: the control shows that it is working. */
  busy: boolean;
}

export interface ControlsView {
  talk: TalkControl;
  /** Mute is a toggle that reports whether it is on. */
  mute: { visible: boolean; pressed: boolean; disabled: boolean };
  /** Stops the customer's audio: the only way to take the turn before it finishes (no barge-in). */
  stopAudio: { visible: boolean; disabled: boolean };
  /** Switches to text. The way back is the talk control, which becomes "Return to voice". */
  text: { visible: boolean; disabled: boolean };
  pause: { visible: boolean; resume: boolean; disabled: boolean };
  replay: { visible: boolean; disabled: boolean };
}

export interface ControlsInput extends Pick<
  CallSnapshot,
  'phase' | 'stage' | 'mode' | 'muted' | 'paused' | 'audio'
> {
  /** There is a customer reply to hear again. */
  canReplay: boolean;
  /** A problem needs handling before the trainee can talk or type again. */
  blocked: boolean;
  limitReached: boolean;
  /** The microphone is really open (`CallSnapshot.micOpen`). Left out, it is. */
  micOpen?: boolean;
}

const TURN_PHASES: readonly CallPhase[] = [
  'ready',
  'listening',
  'customer-speaking',
  'ready-for-next-turn',
];

/**
 * What each control is for and whether it can be used. A control that cannot be used right now is
 * disabled but stays in the tab order; the status label beside it says why. Voice controls leave a
 * typed call entirely, so text mode is not a voice screen with half its buttons dead.
 */
export function describeControls(input: ControlsInput): ControlsView {
  const { phase, stage, mode, muted, paused, audio, canReplay, blocked, limitReached } = input;
  const micOpen = input.micOpen ?? true;
  const closing = phase === 'ending' || phase === 'completed';
  const starting = phase === 'idle' || phase === 'requesting-microphone';
  const none = { visible: false, disabled: true };

  if (mode === 'text') {
    return {
      talk: {
        kind: 'voice',
        label: 'Return to voice',
        icon: 'microphone',
        disabled: phase !== 'ready-for-next-turn' || limitReached,
        busy: false,
      },
      mute: { ...none, pressed: false },
      stopAudio: none,
      text: none,
      pause: { ...none, resume: false },
      replay: none,
    };
  }

  const talk: TalkControl =
    stage === 'listening' && !micOpen
      ? // Asked for, not open yet: still "Talk", working, until the microphone really is open.
        { kind: 'talk', label: 'Talk', icon: 'microphone', disabled: true, busy: true }
      : stage === 'listening' || stage === 'endpointing'
        ? {
            kind: 'done',
            label: 'Done speaking',
            icon: 'stop',
            disabled: stage === 'endpointing',
            busy: false,
          }
        : {
            kind: 'talk',
            label: 'Talk',
            icon: 'microphone',
            disabled: phase !== 'ready-for-next-turn' || muted || paused || blocked || limitReached,
            busy: false,
          };
  return {
    talk,
    mute: { visible: true, pressed: muted, disabled: closing || starting },
    stopAudio: { visible: true, disabled: phase !== 'customer-speaking' && phase !== 'ready' },
    text: { visible: true, disabled: closing || !TURN_PHASES.includes(phase) },
    pause: { visible: true, resume: paused, disabled: closing || starting },
    replay: {
      visible: audio === 'on',
      disabled:
        !canReplay ||
        paused ||
        (phase !== 'ready-for-next-turn' && phase !== 'customer-speaking' && phase !== 'listening'),
    },
  };
}

// ---- Recovery: what a problem lets the trainee do ----------------------------------------------

export type RecoveryAction =
  'retry' | 'use-text' | 'replay' | 'continue-without-audio' | 'end-safely' | 'end';

export interface RecoveryOption {
  action: RecoveryAction;
  label: string;
  icon: IconName;
}

const OPTION: Record<RecoveryAction, RecoveryOption> = {
  retry: { action: 'retry', label: 'Retry', icon: 'refresh' },
  'use-text': { action: 'use-text', label: 'Use text', icon: 'keyboard' },
  replay: { action: 'replay', label: 'Replay', icon: 'play' },
  'continue-without-audio': {
    action: 'continue-without-audio',
    label: 'Continue without audio',
    icon: 'speaker-off',
  },
  'end-safely': { action: 'end-safely', label: 'End safely', icon: 'phone-end' },
  end: { action: 'end', label: 'End call', icon: 'phone-end' },
};

/** A problem of the customer's voice (it could not be made, or played): what the trainee can do is hear it again. */
const isVoiceProblem = (problem: CallProblem) => problem.retry === 'speak';
const SAFE_END_PROBLEMS: readonly string[] = ['reply-failed', 'reply-timeout', 'save-failed'];

/**
 * The actions a problem offers, in order, the first being the one most likely to be wanted. Every
 * problem offers a way forward and none offers an action that cannot work: a voice that could not be
 * made offers Retry and Continue without audio, one that could not be played Replay and Continue
 * without audio, a lost microphone or failed speech Retry and Use text (only where typing is not
 * already the mode), a failed message Retry and End safely, and being offline just Retry. The words
 * follow the voice layer's own recovery data for the failures that are its.
 */
export function recoveryOptions(
  problem: CallProblem,
  context: { mode: CallSnapshot['mode']; begun?: boolean } = { mode: 'voice' },
): RecoveryOption[] {
  const out: RecoveryAction[] = [];
  const { code } = problem;
  if (isVoiceProblem(problem)) {
    out.push(code === 'playback-blocked' || code === 'playback-failed' ? 'replay' : 'retry');
    out.push('continue-without-audio');
  } else if (code === 'turn-limit') {
    out.push('end');
  } else {
    if (problem.retry !== null) out.push('retry');
    // Typing is offered where it still works; in a typed call it is already the mode.
    if (problem.textFallback && (context.mode === 'voice' || context.begun === false)) {
      out.push('use-text');
    }
    if (SAFE_END_PROBLEMS.includes(code)) out.push('end-safely');
  }
  return out.map((action) => OPTION[action]);
}

/** Whether advice is too long to sit under a problem's title: it goes behind a "How to fix" disclosure. */
export function adviceIsLong(advice: string): boolean {
  return advice.split(/\s+/).filter(Boolean).length > 16;
}

/**
 * Whether the problem is what an attempt to end the call left behind: ending failed, or ending
 * failed because the browser was offline. The call is still open then, and carrying on clears it.
 */
export function isEndFailure(problem: CallProblem | null): problem is CallProblem {
  return (
    problem !== null &&
    (problem.code === 'end-failed' || (problem.code === 'offline' && problem.retry === 'end'))
  );
}

// ---- What the composer may do ------------------------------------------------------------------

export interface ComposerGate {
  canSend: boolean;
  /** Why sending waits, in a few words. Null when it does not. */
  reason: string | null;
}

const BLOCKED_BY_PROBLEM: Partial<Record<CallProblem['code'], string>> = {
  offline: 'You are offline.',
  'session-unavailable': 'This call cannot take messages.',
  'session-ended': 'This call has ended.',
};
const RETRY_FIRST = 'Retry your last message first.';

/** Sending waits while the customer replies, when the call is over, or when a problem needs handling first. */
export function composerGate(input: {
  phase: CallPhase;
  problem: CallProblem | null;
}): ComposerGate {
  const { phase, problem } = input;
  if (phase === 'ending' || phase === 'completed') {
    return { canSend: false, reason: 'The call is ending.' };
  }
  if (problem?.code === 'turn-limit') {
    return { canSend: false, reason: 'Message limit reached.' };
  }
  if (phase === 'processing') {
    return { canSend: false, reason: 'Waiting for the customer.' };
  }
  if (problem && problem.severity === 'blocking' && !problem.textFallback) {
    return { canSend: false, reason: BLOCKED_BY_PROBLEM[problem.code] ?? RETRY_FIRST };
  }
  return { canSend: true, reason: null };
}

// ---- The case ----------------------------------------------------------------------------------

export interface CaseFacts {
  /** The Microsoft product, or null for a call saved before scenarios named one. */
  product: { name: string; area: string; family: string } | null;
  /** A made-up reference; never a real service request number. */
  caseReference: string | null;
  /** What the case says is wrong, in the case brief's words; null for a call saved before briefs. */
  issue: string | null;
  impact: { label: string; detail: string };
  callStage: string;
  objective: string;
  /** Expandable details from the public brief; empty when there are none. */
  more: Array<{ label: string; text: string }>;
}

/**
 * What the trainee was told about the case, so it can be read again while the call happens. It
 * comes from the public brief only (never a hidden fact), and falls back to the older brief's goal
 * and the impact's own description for a call saved before public briefs existed.
 */
export function describeCase(scenario: SessionScenarioView): CaseFacts {
  const { config, product, publicBrief } = scenario;
  const impact = IMPACT_LABELS[config.impact];
  const more: CaseFacts['more'] = [];
  if (publicBrief?.knownContext)
    more.push({ label: 'Known context', text: publicBrief.knownContext });
  // There is nothing to say about an earlier contact on a first call, as in the case brief.
  if (publicBrief?.previousContact && config.callStage !== 'first-contact') {
    more.push({ label: 'Previous contact', text: publicBrief.previousContact });
  }
  if (publicBrief?.environment) more.push({ label: 'Environment', text: publicBrief.environment });
  return {
    product: product
      ? { name: product.name, area: product.area, family: product.familyLabel }
      : null,
    caseReference: scenario.caseReference,
    issue: publicBrief?.issue ?? null,
    impact: {
      label: impact.label,
      detail: publicBrief?.impact[config.impact] ?? impact.description,
    },
    callStage: CALL_STAGE_LABELS[config.callStage].label,
    objective: publicBrief?.objective ?? scenario.brief.goal,
    more,
  };
}
