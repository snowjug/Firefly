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
 * The words are the voice layer's (`VOICE_STATE_TEXT`) wherever it has a state of the same name,
 * except for the trainee's own turn: its "Typing" reads as the customer typing and its bare
 * "Listening" does not say whose turn it is, so the screen says "Your turn" and "Listening to you".
 * The announcements stay the voice layer's.
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

/** How the status strip's signal is drawn: whose voice, nothing at all (`idle`), a shimmer, or dots while the customer thinks. */
export type WaveMode = 'idle' | 'trainee' | 'customer' | 'transcribing' | 'thinking';

export interface CallStatus {
  id: StatusId;
  /** The machine stage it comes from. */
  stage: CallStage;
  /** One to three words. */
  label: string;
  /** What the pre-flight's microphone row says: the same state, in a word or two. */
  row: string;
  /**
   * What the voice strip's own signal is called to assistive technology, where the label does not
   * already say it: the three points that show the customer is working out a reply say "Customer is
   * responding". Null everywhere else, because the status label is the name and a second one would
   * only make it be read twice.
   */
  signal: string | null;
  icon: IconName;
  wave: WaveMode;
  /** Whose turn it is, which decides the colour. `alert` is a state that needs the trainee's action. */
  who: 'trainee' | 'customer' | 'alert' | 'none';
}

const voice = (state: VoiceState): string => VOICE_STATE_TEXT[state].label;

type StatusSpec = Pick<CallStatus, 'label' | 'icon' | 'wave' | 'who'> & {
  row?: string;
  signal?: string;
};

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
  listening: { label: 'Listening to you', icon: 'microphone', wave: 'trainee', who: 'trainee' },
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
    signal: 'Customer is responding',
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
    label: 'Your turn',
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
    const { row, signal, ...spec } = STATUS[id];
    return { id, stage, row: row ?? spec.label, signal: signal ?? null, ...spec };
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
  // says it. Once the microphone is open again it is "Listening to you", and a typed call stays on
  // "Your turn".
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

// ---- The presence: how the customer's avatar shows the state ----------------------------------

/**
 * What the ring around the customer's avatar is doing, which is the status said without words:
 * a ring that turns while the call connects, a quieter one while something is worked out, a slow
 * breath while the microphone waits, a halo that follows the voice while the trainee is heard and
 * while the customer speaks, and a still, dimmed ring while the call is held. Everything else is
 * still. The status label is the accessible form of every one of these: the ring says nothing to
 * assistive technology.
 */
export type PresenceMode =
  'still' | 'connecting' | 'working' | 'listening' | 'hearing' | 'speaking' | 'held';

const PRESENCE: Record<StatusId, PresenceMode> = {
  'mic-not-requested': 'still',
  'requesting-permission': 'connecting',
  'permission-denied': 'still',
  'mic-unavailable': 'still',
  connecting: 'connecting',
  'mic-ready': 'still',
  listening: 'listening',
  'speech-detected': 'hearing',
  'processing-speech': 'working',
  'generating-reply': 'working',
  'customer-speaking': 'speaking',
  paused: 'held',
  muted: 'still',
  'retry-required': 'still',
  retrying: 'working',
  'limit-reached': 'still',
  'text-fallback': 'still',
  offline: 'still',
  ending: 'working',
  evaluating: 'working',
  completed: 'still',
};

export function describePresence(id: StatusId): PresenceMode {
  return PRESENCE[id];
}

// ---- Live captions -----------------------------------------------------------------------------

export interface Caption {
  who: 'customer' | 'you';
  /**
   * Changes when a different line starts (so the strip crossfades from one to the next) and stays
   * the same while the words of one line grow.
   */
  key: string;
  text: string;
}

/**
 * What the caption strip under the customer shows: the customer's line while it is spoken, and the
 * trainee's own words while they speak and while the sentence is being finished. Between turns there
 * is nothing. The strip is not the record (the transcript is) and says nothing to assistive
 * technology, so this only decides what is drawn.
 */
export function describeCaption(input: {
  statusId: StatusId;
  turns: readonly CallTurn[];
  interim: string;
}): Caption | null {
  const { statusId, turns, interim } = input;
  if (statusId === 'customer-speaking') {
    const turn = latestCustomerTurn(turns);
    const text = turn?.text.trim();
    return turn && text ? { who: 'customer', key: `customer:${turn.key}`, text } : null;
  }
  if (
    statusId === 'listening' ||
    statusId === 'speech-detected' ||
    statusId === 'processing-speech'
  ) {
    const words = interim.trim();
    return words ? { who: 'you', key: 'you', text: words } : null;
  }
  return null;
}

/** The words of a caption, each of which settles in as it arrives. */
export function captionWords(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
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

// ---- The state trace ------------------------------------------------------------------------------

/** The most points the trace draws: a long call shows its latest stretch. */
export const TRACE_POINTS = 24;

export interface TracePoint {
  x: number;
  y: number;
  band: TemperatureBandId;
}

/**
 * Where the trace's points go in a box: the oldest at the left, the newest at the right, and the
 * hotter the customer, the higher the point. Only the last `TRACE_POINTS` are drawn. It is a shape
 * and never carries a number: the customer's state is a word, and so is this.
 */
export function traceShape(
  history: readonly CallStatePoint[],
  box: { width: number; height: number; pad: number },
): TracePoint[] {
  const recent = history.slice(-TRACE_POINTS);
  const hottest = BAND_ORDER.length - 1;
  const across = box.width - 2 * box.pad;
  const up = box.height - 2 * box.pad;
  return recent.map((point, index) => ({
    band: point.band,
    x: recent.length === 1 ? box.width - box.pad : box.pad + (index * across) / (recent.length - 1),
    y: box.height - box.pad - (bandRank(point.band) / hottest) * up,
  }));
}

/** The trace in words for a screen reader: each state the customer was in, oldest first, no numbers. */
export function describeTrace(history: readonly CallStatePoint[]): string {
  const names: string[] = [];
  for (const point of history) {
    const name = point.label.toLowerCase();
    if (names.at(-1) !== name) names.push(name);
  }
  if (names.length === 0) return '';
  return `Customer state so far: ${names.slice(-5).join(', then ')}.`;
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

/**
 * The time on each turn, as m:ss since the call started. Every turn has one, the same quiet way, so
 * the log reads evenly: a stamp on some turns and not others looks like a mistake. Returns turn key
 * to m:ss; a turn whose time cannot be read has none. (It is a map so a turn is looked up by key.)
 */
export function timeMarks(turns: readonly CallTurn[], startedAt: string): Map<string, string> {
  const marks = new Map<string, string>();
  for (const turn of turns) {
    const text = clockSince(startedAt, turn.createdAt);
    if (text) marks.set(turn.key, text);
  }
  return marks;
}

/** How many of the trainee's turns the server holds (a message still being sent does not count). */
export function traineeTurnCount(turns: readonly CallTurn[]): number {
  return turns.filter((turn) => turn.role === 'trainee' && turn.status === 'sent').length;
}

/** How many turns the customer has had. */
export function customerTurnCount(turns: readonly CallTurn[]): number {
  return turns.filter((turn) => turn.role === 'customer').length;
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
  /**
   * `talk` opens the microphone, `done` finishes the utterance, `voice` goes back to voice from text.
   * In a hands-free call `resume` ends a hold, and `none` means nothing needs pressing: the
   * microphone opens by itself.
   */
  kind: 'talk' | 'done' | 'voice' | 'resume' | 'none';
  /** The visible label, and the accessible name. */
  label: string;
  icon: IconName;
  /** Looks and acts disabled but stays in the tab order, so focus is never lost between states. */
  disabled: boolean;
  /** The microphone was asked for and is still starting: the control shows that it is working. */
  busy: boolean;
}

export interface ControlsView {
  /**
   * A hands-free spoken call: the first row is one reserved slot that holds a single control at a
   * time (or nothing), not a big Talk that is always there. Push to talk and typed calls are not.
   */
  slot: boolean;
  talk: TalkControl;
  /**
   * "Done speaking" in a hands-free call: a quiet way to end the turn early, there only while the
   * trainee's speech has been heard (and, disabled, while the sentence is being finished).
   */
  finish: { visible: boolean; disabled: boolean };
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
  /** Hands-free is on (`CallSnapshot.handsFree`). Left out, it is off: push to talk, as the screen was. */
  handsFree?: boolean;
  /** The trainee's voice has been heard in this turn (`CallSnapshot.speechDetected`). */
  speechHeard?: boolean;
  /**
   * Hands-free has not given up: the microphone opens by itself for each turn (`CallSnapshot.
   * autoListening`). False after repeated empty recognitions. Left out, it is read as false, as the
   * contract says, so a snapshot that does not say shows Talk and never leaves a dead end.
   */
  autoListening?: boolean;
  /** A problem card is showing: the microphone does not reopen by itself until it is dealt with. */
  cardShown?: boolean;
}

const NO_TALK: TalkControl = {
  kind: 'none',
  label: '',
  icon: 'microphone',
  disabled: true,
  busy: false,
};

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
 *
 * Push to talk is the screen as it always was: one big control that is Talk, then Done speaking.
 * In a hands-free call the microphone opens by itself, so that control goes: the call is a presence,
 * and the first row is a slot that holds only what a press is really for. That is Resume on a call
 * that is held, Talk where the microphone will not open by itself (after repeated empty
 * recognitions, or while a problem card is showing), Done speaking while the trainee's speech has
 * been heard, and Stop customer audio while the customer speaks. Otherwise it is empty.
 */
export function describeControls(input: ControlsInput): ControlsView {
  const { phase, stage, mode, muted, paused, audio, canReplay, blocked, limitReached } = input;
  const micOpen = input.micOpen ?? true;
  const closing = phase === 'ending' || phase === 'completed';
  const starting = phase === 'idle' || phase === 'requesting-microphone';
  const none = { visible: false, disabled: true };

  if (mode === 'text') {
    return {
      slot: false,
      talk: {
        kind: 'voice',
        label: 'Return to voice',
        icon: 'microphone',
        disabled: phase !== 'ready-for-next-turn' || limitReached,
        busy: false,
      },
      finish: none,
      mute: { ...none, pressed: false },
      stopAudio: none,
      text: none,
      pause: { ...none, resume: false },
      replay: none,
    };
  }

  const pressToTalk: TalkControl =
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
  const shared = {
    mute: { visible: true, pressed: muted, disabled: closing || starting },
    text: { visible: true, disabled: closing || !TURN_PHASES.includes(phase) },
    replay: {
      visible: audio === 'on',
      disabled:
        !canReplay ||
        paused ||
        (phase !== 'ready-for-next-turn' && phase !== 'customer-speaking' && phase !== 'listening'),
    },
  };

  if (!input.handsFree) {
    return {
      slot: false,
      talk: pressToTalk,
      finish: none,
      stopAudio: { visible: true, disabled: phase !== 'customer-speaking' && phase !== 'ready' },
      pause: { visible: true, resume: paused, disabled: closing || starting },
      ...shared,
    };
  }

  // Hands-free. The microphone opens by itself while hands-free has not given up and nothing needs
  // the trainee first; a press is only for the cases where it will not.
  const listensByItself = input.autoListening === true && !input.cardShown;
  const waiting = stage === 'mic-permission';
  const pressNeeded =
    !waiting && !paused && phase === 'ready-for-next-turn' && !listensByItself && !blocked;
  const talk: TalkControl = paused
    ? { kind: 'resume', label: 'Resume', icon: 'play', disabled: closing || starting, busy: false }
    : waiting
      ? { kind: 'talk', label: 'Talk', icon: 'microphone', disabled: true, busy: true }
      : pressNeeded && !limitReached
        ? pressToTalk
        : NO_TALK;
  const heard = input.speechHeard ?? false;
  return {
    slot: true,
    talk,
    finish: {
      visible: stage === 'endpointing' || (stage === 'listening' && micOpen && heard),
      disabled: stage === 'endpointing',
    },
    // Only while the customer speaks: it is how the trainee takes the turn (no barge-in).
    stopAudio: { visible: phase === 'customer-speaking', disabled: false },
    // A held call has Resume in the slot, so there is one of it and not two.
    pause: { visible: !paused, resume: false, disabled: closing || starting },
    ...shared,
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
  /**
   * The customer is replying to what was just sent. The box then shows that message, quietly, and
   * cannot be edited until the reply is in, so it never reads as a message that was not sent.
   */
  waiting?: boolean;
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
    return { canSend: false, reason: 'Waiting for the customer.', waiting: true };
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
