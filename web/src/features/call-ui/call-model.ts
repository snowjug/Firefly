import type { PublicStateDTO, SessionDTO } from '#shared/domain/api.ts';
import { SPEECH_LANGUAGES, type SpeechLanguage } from '#shared/domain/speech.ts';
import {
  TEMPERATURE_BANDS,
  type Difficulty,
  type TemperatureBandId,
} from '#shared/domain/vocab.ts';
import type { BadgeTone, CustomerState, IconName } from '../../design/index.ts';
import type {
  CallPhase,
  CallProblem,
  CallSnapshot,
  CallStatePoint,
  CallTurn,
} from '../call/contract.ts';

// Everything the call screen decides about what to say, kept free of React so it can be tested on
// its own: the words of the status line, the customer's state and its trend, the connection badge,
// the temperature trace, and when the composer must wait. Components only draw what comes out.

// ---- The status line: the four stages of a turn -------------------------------------------------

export type VoiceStage =
  | 'connecting'
  | 'your-turn'
  | 'listening'
  | 'hearing'
  | 'transcribing'
  | 'thinking'
  | 'speaking'
  | 'muted'
  | 'paused'
  | 'text'
  | 'blocked'
  | 'ending';

/** How the waveform strip is drawn: whose voice, or a quiet line, or dots while something works. */
export type WaveMode = 'idle' | 'trainee' | 'customer' | 'transcribing' | 'thinking';

export interface CallStatus {
  stage: VoiceStage;
  /** The large line: one whole sentence, also what the stage means for a screen reader. */
  label: string;
  /** One short line of guidance under it. */
  detail: string;
  icon: IconName;
  wave: WaveMode;
  /** Whose turn the stage belongs to, which decides its colour. `alert` is a problem that stops the call. */
  who: 'trainee' | 'customer' | 'alert' | 'none';
}

export type StatusInput = Pick<
  CallSnapshot,
  'phase' | 'mode' | 'muted' | 'paused' | 'speechDetected' | 'handsFree'
> & {
  problem?: Pick<CallProblem, 'code' | 'severity'> | null;
  hint?: CallSnapshot['hint'];
};

function mutedStatus(): CallStatus {
  return {
    stage: 'muted',
    label: 'Microphone muted',
    detail: 'Turn off mute to talk.',
    icon: 'microphone-off',
    wave: 'idle',
    who: 'none',
  };
}

function alertStatus(label: string, detail: string, icon: IconName): CallStatus {
  return { stage: 'blocked', label, detail, icon, wave: 'idle', who: 'alert' };
}

/** What the status line says while a problem stops the call, so it never claims "Your turn". */
function blockedStatus(problem: StatusInput['problem']): CallStatus | null {
  if (!problem || problem.severity !== 'blocking') return null;
  if (problem.code.startsWith('microphone-')) {
    return alertStatus(
      'Microphone unavailable',
      'Type your reply, or try the microphone again.',
      'microphone-off',
    );
  }
  switch (problem.code) {
    case 'turn-limit':
      return alertStatus('Message limit reached', 'End the call to get your report.', 'flag');
    case 'offline':
      return alertStatus(
        'You are offline',
        'Your message is kept. Try again when you are back online.',
        'warning',
      );
    case 'reply-failed':
    case 'reply-timeout':
      return alertStatus(
        'The customer has not replied',
        'Your message is kept. Use Try again to send it.',
        'warning',
      );
    case 'save-failed':
      return alertStatus(
        'Your message may not be saved',
        'Your words are kept. Use Try again to send them.',
        'warning',
      );
    case 'rate-limited':
      return alertStatus(
        'Please wait a moment',
        'Your message is kept. Use Try again in a moment.',
        'warning',
      );
    case 'session-ended':
    case 'session-unavailable':
      return alertStatus('The call cannot continue', 'Your transcript is saved.', 'warning');
    default:
      return alertStatus('The call needs attention', 'Read the message below.', 'warning');
  }
}

/** The words for what is happening now. Pausing wins over everything; mute only over the quiet phases. */
export function describeStatus(input: StatusInput): CallStatus {
  const { phase, mode, muted, paused, speechDetected, handsFree, hint } = input;
  if (phase === 'ending' || phase === 'completed') {
    return {
      stage: 'ending',
      label: 'Ending the call',
      detail: 'Saving the transcript and preparing your report.',
      icon: 'clock',
      wave: 'idle',
      who: 'none',
    };
  }
  const blocked = blockedStatus(input.problem);
  if (blocked) return blocked;
  if (paused) {
    return {
      stage: 'paused',
      label: 'Call paused',
      detail: 'Resume the call to talk or to hear the customer.',
      icon: 'pause',
      wave: 'idle',
      who: 'none',
    };
  }
  switch (phase) {
    case 'transcribing':
      return {
        stage: 'transcribing',
        label: 'Transcribing what you said',
        detail: 'Turning your speech into text.',
        icon: 'caption',
        wave: 'transcribing',
        who: 'trainee',
      };
    case 'processing':
      return {
        stage: 'thinking',
        label: 'The customer is thinking',
        detail: 'They will reply in a moment.',
        icon: 'more',
        wave: 'thinking',
        who: 'customer',
      };
    case 'customer-speaking':
      return {
        stage: 'speaking',
        label: 'The customer is speaking',
        detail: 'Press Interrupt to take your turn.',
        icon: 'speaker',
        wave: 'customer',
        who: 'customer',
      };
    case 'listening':
      if (muted) return mutedStatus();
      return speechDetected
        ? {
            stage: 'hearing',
            label: 'Hearing you',
            detail: 'Press Stop talking when you have finished.',
            icon: 'microphone',
            wave: 'trainee',
            who: 'trainee',
          }
        : {
            stage: 'listening',
            label: 'Listening',
            detail: handsFree
              ? 'Speak when you are ready. Pause when you have finished.'
              : 'Speak when you are ready, then press Stop talking.',
            icon: 'microphone',
            wave: 'trainee',
            who: 'trainee',
          };
    case 'ready-for-next-turn':
    case 'ready':
    case 'idle':
    case 'requesting-microphone':
      if (mode === 'text' && (phase === 'ready-for-next-turn' || phase === 'ready')) {
        return {
          stage: 'text',
          label: 'Text-only call. Type your reply.',
          detail: 'The microphone is off. The customer is shown as captions.',
          icon: 'keyboard',
          wave: 'idle',
          who: 'trainee',
        };
      }
      if (phase === 'ready-for-next-turn') {
        if (muted) return mutedStatus();
        return {
          stage: 'your-turn',
          label: 'Your turn',
          // A hint here means nothing was heard, and hands-free stops reopening after three of those.
          detail:
            handsFree && !hint
              ? 'Hands-free opens the microphone by itself. If it stays closed, press Talk or type a reply.'
              : 'Press Talk and speak, or type a reply.',
          icon: 'microphone',
          wave: 'idle',
          who: 'trainee',
        };
      }
      return {
        stage: 'connecting',
        label: 'Connecting',
        detail: 'Getting the call ready.',
        icon: 'refresh',
        wave: 'idle',
        who: 'none',
      };
  }
}

// ---- The connection badge in the command bar ---------------------------------------------------

export interface ConnectionStatus {
  key: 'live' | 'muted' | 'paused' | 'text' | 'reconnecting' | 'offline';
  label: string;
  tone: BadgeTone;
  icon: IconName;
}

/**
 * The state of the call as a whole. The browser's own online state is read by the page and passed
 * in, so a fixture can show any of these without touching the network.
 */
export function describeConnection(
  input: Pick<CallSnapshot, 'mode' | 'muted' | 'paused' | 'problem'>,
  online: boolean,
): ConnectionStatus {
  if (!online) return { key: 'offline', label: 'Offline', tone: 'danger', icon: 'error' };
  if (input.problem?.code === 'offline') {
    return { key: 'reconnecting', label: 'Reconnecting', tone: 'warning', icon: 'refresh' };
  }
  if (input.paused) return { key: 'paused', label: 'Paused', tone: 'neutral', icon: 'pause' };
  if (input.mode === 'text') {
    return { key: 'text', label: 'Text-only call', tone: 'info', icon: 'keyboard' };
  }
  if (input.muted) {
    return { key: 'muted', label: 'Muted', tone: 'warning', icon: 'microphone-off' };
  }
  return { key: 'live', label: 'Live call', tone: 'success', icon: 'waveform' };
}

// ---- The customer's state ----------------------------------------------------------------------

export type Trend = PublicStateDTO['trend'];

const BAND_ORDER: readonly TemperatureBandId[] = TEMPERATURE_BANDS.map((band) => band.id);

/** 0 for calm up to 4 for escalating. */
export function bandRank(band: TemperatureBandId): number {
  return BAND_ORDER.indexOf(band);
}

/** The bands from the hottest to the calmest, which is the order the temperature trace lists them in. */
export const BANDS_TOP_DOWN = [...TEMPERATURE_BANDS].reverse();

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

// Plain observations about how the customer sounds. They never say why, and never what to do.
const DESCRIPTIONS: Record<TemperatureBandId, Record<Trend, string>> = {
  calm: {
    rising: 'Slightly less settled',
    steady: 'Calm and cooperative',
    falling: 'Calm and settling',
  },
  concerned: {
    rising: 'Getting more worried',
    steady: 'Worried',
    falling: 'Less worried than before',
  },
  frustrated: {
    rising: 'Getting more frustrated',
    steady: 'Short on patience',
    falling: 'Frustration is easing',
  },
  angry: {
    rising: 'Getting angrier',
    steady: 'Upset',
    falling: 'Still upset, but easing',
  },
  escalating: {
    rising: 'Escalating further',
    steady: 'Very upset',
    falling: 'Still very upset, but easing',
  },
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
  description: string;
  recovering: boolean;
}

/**
 * How the customer is now. "Recovering" is when they are easing and have been hotter earlier in the
 * call; a calm customer is never "recovering".
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
  const bandLabel = state.band.label;
  return {
    bandId,
    tone: recovering ? 'recovering' : bandId,
    label: recovering ? 'Recovering' : bandLabel,
    bandLabel,
    trend: state.trend,
    trendWord: TREND_WORDS[state.trend],
    trendIcon: TREND_ICONS[state.trend],
    description: recovering
      ? `Still ${bandLabel.toLowerCase()}, but easing`
      : DESCRIPTIONS[bandId][state.trend],
    recovering,
  };
}

/** The one sentence a screen reader hears when the customer's state changes. It never says why. */
export function stateChangeSentence(view: CustomerStateView): string {
  return view.recovering
    ? 'The customer seems to be recovering.'
    : `The customer now seems ${view.bandLabel.toLowerCase()}.`;
}

// ---- The temperature trace ---------------------------------------------------------------------

export interface TracePoint {
  turnIndex: number;
  band: TemperatureBandId;
  label: string;
  /** "Opening line", "Reply 3": which customer turn this mood follows. */
  after: string;
}

function afterLabel(turnIndex: number): string {
  return turnIndex <= 1 ? 'Opening line' : `Reply ${Math.ceil(turnIndex / 2)}`;
}

/** The points to draw, in order. With no history yet, the current state is the only point. */
export function tracePoints(
  history: readonly CallStatePoint[],
  state: PublicStateDTO | null,
): TracePoint[] {
  const source: CallStatePoint[] =
    history.length > 0
      ? [...history]
      : state
        ? [{ turnIndex: 1, band: state.band.id, label: state.band.label }]
        : [];
  return source.map((point) => ({ ...point, after: afterLabel(point.turnIndex) }));
}

/** A sentence for the chart's accessible name: where the customer started, where they are, which way. */
export function traceSummary(
  points: readonly TracePoint[],
  view: CustomerStateView | null,
): string {
  const last = points[points.length - 1];
  if (!last) return 'The customer temperature trace has no points yet.';
  const trend = view ? `, ${view.trendWord}` : '';
  const first = points[0] as TracePoint;
  if (points.length === 1) return `Customer temperature: ${last.label} now${trend}.`;
  return `Customer temperature over ${points.length} points: started ${first.label}, now ${last.label}${trend}.`;
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

/** How many of the trainee's turns the server holds (a message still being sent does not count). */
export function traineeTurnCount(turns: readonly CallTurn[]): number {
  return turns.filter((turn) => turn.role === 'trainee' && turn.status === 'sent').length;
}

/** Below this many of the trainee's turns, the report rests on limited evidence. */
export const SHORT_CALL_TURNS = 6;

export function latestCustomerTurn(turns: readonly CallTurn[]): CallTurn | undefined {
  return turns.findLast((turn) => turn.role === 'customer');
}

export const DIFFICULTY_NAMES: Record<Difficulty, string> = {
  starter: 'Starter',
  standard: 'Standard',
  challenge: 'Challenge',
};

export const LANGUAGE_NAMES: Record<SpeechLanguage, string> = {
  'en-GB': 'English (United Kingdom)',
  'en-US': 'English (United States)',
  'en-IE': 'English (Ireland)',
  'en-AU': 'English (Australia)',
  'en-IN': 'English (India)',
};

export function timesWord(count: number): string {
  if (count === 1) return 'once';
  if (count === 2) return 'twice';
  return `${count} times`;
}

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

// ---- The main voice control ---------------------------------------------------------------------

export interface TalkControl {
  kind: 'talk' | 'stop' | 'interrupt';
  /** What it is called, and says: "Talk", "Stop talking" or "Interrupt". */
  label: string;
  icon: IconName;
  /** Looks and acts disabled but stays in the tab order, so focus is never lost between stages. */
  disabled: boolean;
  /** Why it is disabled, shown beside it. Null when it is not. */
  reason: string | null;
  /** The control is the stop control while the microphone is open, so it reports that. */
  pressed: boolean | undefined;
}

/** What the large round control is for in this phase. */
export function describeTalkControl(input: {
  phase: CallPhase;
  muted: boolean;
  paused: boolean;
  limitReached: boolean;
}): TalkControl {
  const { phase, muted, paused, limitReached } = input;
  const talk = (reason: string | null): TalkControl => ({
    kind: 'talk',
    label: 'Talk',
    icon: 'microphone',
    disabled: reason !== null,
    reason,
    pressed: false,
  });
  if (phase === 'ending' || phase === 'completed') return talk('The call is ending.');
  if (paused) return talk('Call paused. Resume it to talk.');
  if (limitReached) return talk('This call has reached its message limit.');
  switch (phase) {
    case 'listening':
      return {
        kind: 'stop',
        label: 'Stop talking',
        icon: 'stop',
        disabled: false,
        reason: null,
        pressed: true,
      };
    case 'customer-speaking':
      return {
        kind: 'interrupt',
        label: 'Interrupt',
        icon: 'speaker-off',
        disabled: false,
        reason: null,
        pressed: undefined,
      };
    case 'transcribing':
      return talk('Turning your speech into text. One moment.');
    case 'processing':
      return talk('Waiting for the customer to reply.');
    case 'ready-for-next-turn':
      return talk(muted ? 'Microphone muted. Turn off mute to talk.' : null);
    case 'ready':
    case 'idle':
    case 'requesting-microphone':
      return talk('Getting the call ready.');
  }
}

// ---- What the composer may do ------------------------------------------------------------------

export interface ComposerGate {
  canSend: boolean;
  /** Why sending waits, in words the person can act on. Null when it does not. */
  reason: string | null;
}

const BLOCKED_BY_PROBLEM: Partial<Record<CallProblem['code'], string>> = {
  offline: 'You are offline. You can send again once you are back online.',
  'session-unavailable': 'This call cannot take new messages.',
  'session-ended': 'This call has ended, so it cannot take new messages.',
};
const RETRY_FIRST = 'Your last message has not been sent yet. Use Try again first.';

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
    return { canSend: false, reason: 'You have reached the limit for this call.' };
  }
  if (phase === 'processing') {
    return { canSend: false, reason: 'Waiting for the customer to reply.' };
  }
  if (problem && problem.severity === 'blocking' && !problem.textFallback) {
    return { canSend: false, reason: BLOCKED_BY_PROBLEM[problem.code] ?? RETRY_FIRST };
  }
  return { canSend: true, reason: null };
}
