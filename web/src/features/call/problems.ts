import { voiceError, type VoiceError } from '../voice/errors.ts';
import type { BrowserFamily } from '../voice/support.ts';
import type { CallProblem, CallProblemCode } from './contract.ts';

// What the trainee reads when something goes wrong. Every problem says what happened, what was kept,
// what to do (and what "Retry" does), and whether typing still works. Plain British English: no raw
// provider text, no codes, no stack traces, and it never blames the trainee. The words are short on
// purpose: the buttons under them (Retry, Use text, Replay, Continue without audio, End safely) say
// what can be done, so the copy only says what happened and what was kept. The engine passes only
// facts (a `context`); all the wording is here, so it can be read, reviewed and tested as one.
//
// Where the voice failed (the microphone, speech to text, the customer's voice), the words are the
// voice layer's own (`voiceError` in ../voice/errors.ts), so a failure reads the same on the call
// screen as in the voice preview and in the voice tests. Only what the voice layer cannot know is
// added here: that nothing was recorded before the call began, and how to allow a blocked microphone
// in the browser being used. The failures that are not the voice's (the model's reply, saving a
// message, ending the call, loading the session) are written here and stay in the call machine.

/** The step a problem happened in, which decides what "Retry" repeats. */
export type ProblemStep = 'load' | 'send' | 'transcribe' | 'speak' | 'end' | 'microphone';

export interface ProblemContext {
  during?: ProblemStep;
  /** The message is stored on the server; only the customer's reply is missing. */
  saved?: boolean;
  retryAfterSeconds?: number;
  /** Which browser this is, for how to allow the microphone. */
  browser?: BrowserFamily;
  /** The problem happened before the call started. */
  beforeCall?: boolean;
  /** A step ran out of time rather than failing. */
  timedOut?: boolean;
  /** Ending failed because no message was ever sent. */
  nothingToReview?: boolean;
  /** The call does not exist (the server answered not found), so retrying cannot help. */
  notFound?: boolean;
}

export const PROBLEM_CODES = [
  'microphone-denied',
  'microphone-missing',
  'microphone-busy',
  'microphone-unsupported',
  'transcription-failed',
  'speech-service-unavailable',
  'reply-failed',
  'reply-timeout',
  'voice-generation-failed',
  'playback-blocked',
  'playback-failed',
  'offline',
  'session-unavailable',
  'session-ended',
  'save-failed',
  'turn-limit',
  'rate-limited',
  'end-failed',
] as const satisfies readonly CallProblemCode[];

const STEP_RETRY: Record<ProblemStep, NonNullable<CallProblem['retry']>> = {
  load: 'load',
  send: 'send',
  transcribe: 'transcribe',
  speak: 'speak',
  end: 'end',
  microphone: 'microphone',
};

/** How to allow the microphone: the one piece of advice that needs real steps. */
function allowMicrophone(browser: BrowserFamily | undefined): string | null {
  switch (browser) {
    case 'edge':
      return 'Select the lock icon in the address bar, open Permissions for this site, set Microphone to Allow, then choose Retry.';
    case 'chrome':
      return 'Select the icon at the left of the address bar, turn on Microphone, then choose Retry.';
    default:
      return null;
  }
}

function waitFor(seconds: number | undefined): string {
  if (!seconds || seconds < 1) return 'Wait a moment';
  const rounded = Math.ceil(seconds);
  return `Wait ${rounded} ${rounded === 1 ? 'second' : 'seconds'}`;
}

/** What was kept, for a problem that can happen in different steps. */
function keptDuring(step: ProblemStep | undefined): string {
  switch (step) {
    case 'send':
      return 'Your message is kept.';
    case 'end':
      return 'Your call is still open and saved.';
    case 'load':
      return 'Nothing in the call was changed.';
    default:
      return 'Your transcript is saved.';
  }
}

/** What "Retry" does, in the step that failed. */
function retryDuring(step: ProblemStep | undefined): string {
  switch (step) {
    case 'send':
      return 'Retry sends it once, never twice.';
    case 'end':
      return 'Retry to end the call.';
    case 'load':
      return 'Retry to open the call again.';
    default:
      return 'Retry once you are back online.';
  }
}

type Fields = Pick<CallProblem, 'retry' | 'textFallback' | 'severity'> &
  Partial<Pick<CallProblem, 'title' | 'preserved' | 'advice'>>;

/** A problem written in the voice layer's words, with only what this screen knows added to it. */
function spoken(code: CallProblemCode, error: VoiceError, fields: Fields): CallProblem {
  return {
    code,
    title: fields.title ?? error.message,
    preserved: fields.preserved ?? error.kept,
    advice: fields.advice ?? error.advice,
    retry: fields.retry,
    textFallback: fields.textFallback,
    severity: fields.severity,
    announce: error.announce,
  };
}

/** A microphone that cannot be used: nothing is recorded before the call, and the steps depend on the browser. */
function microphone(
  code: CallProblemCode,
  error: VoiceError,
  context: ProblemContext,
  fields: Fields,
): CallProblem {
  return spoken(code, error, {
    ...fields,
    ...(context.beforeCall ? { preserved: 'Nothing was recorded.' } : {}),
  });
}

/** The full copy for one problem. Every field is set for every code. */
export function describeProblem(code: CallProblemCode, context: ProblemContext = {}): CallProblem {
  switch (code) {
    case 'microphone-denied': {
      const steps = allowMicrophone(context.browser);
      return microphone(code, voiceError('microphone-denied'), context, {
        ...(steps ? { advice: steps } : {}),
        retry: 'microphone',
        textFallback: true,
        severity: 'blocking',
      });
    }
    case 'microphone-missing':
      return microphone(code, voiceError('microphone-missing'), context, {
        retry: 'microphone',
        textFallback: true,
        severity: 'blocking',
      });
    case 'microphone-busy':
      return microphone(code, voiceError('microphone-busy'), context, {
        ...(context.timedOut ? { title: 'The microphone did not respond.' } : {}),
        retry: 'microphone',
        textFallback: true,
        severity: 'blocking',
      });
    case 'microphone-unsupported':
      return microphone(code, voiceError('microphone-unsupported'), context, {
        retry: null,
        textFallback: true,
        severity: 'blocking',
      });
    case 'transcription-failed':
      return spoken(
        code,
        voiceError(context.timedOut ? 'transcription-timeout' : 'transcription-failed'),
        { retry: 'transcribe', textFallback: true, severity: 'degraded' },
      );
    case 'speech-service-unavailable':
      // Trying again cannot help, so only typing is offered.
      return spoken(code, voiceError('speech-unavailable'), {
        retry: null,
        textFallback: true,
        severity: 'degraded',
      });
    case 'reply-failed':
      return {
        code,
        title: 'The customer could not reply.',
        preserved: context.saved ? 'Your message was saved.' : 'Your message is kept.',
        advice: 'Retry sends it once, never twice.',
        retry: 'send',
        textFallback: false,
        severity: 'blocking',
        announce: 'polite',
      };
    case 'reply-timeout':
      return {
        code,
        title: 'The customer is taking too long.',
        preserved: 'Your message is kept.',
        advice: 'Retry waits again and never sends it twice.',
        retry: 'send',
        textFallback: false,
        severity: 'blocking',
        announce: 'polite',
      };
    case 'voice-generation-failed':
      return spoken(code, voiceError(context.timedOut ? 'voice-timeout' : 'voice-failed'), {
        retry: 'speak',
        textFallback: true,
        severity: 'degraded',
      });
    case 'playback-blocked':
      return spoken(code, voiceError('playback-blocked'), {
        retry: 'speak',
        textFallback: true,
        severity: 'degraded',
      });
    case 'playback-failed':
      return spoken(code, voiceError('playback-failed'), {
        retry: 'speak',
        textFallback: true,
        severity: 'degraded',
      });
    case 'offline': {
      const step = context.during;
      const retry = STEP_RETRY[step ?? 'send'];
      // A call that could not be ended is still open, so being offline there does not stop it: the
      // notice can be dismissed, and the call carries on.
      const severity = step === 'end' ? 'degraded' : 'blocking';
      // Speech to text and the customer's voice have their own words for losing the network, and
      // typing still works while they are lost: only the voice is.
      if (step === 'transcribe' || step === 'speak') {
        return spoken(
          code,
          voiceError('offline', { stage: step === 'speak' ? 'voice' : 'transcription' }),
          { retry, textFallback: true, severity: 'degraded' },
        );
      }
      return {
        code,
        title: 'You appear to be offline.',
        preserved: keptDuring(step),
        advice: `Check your connection. ${retryDuring(step)}`,
        retry,
        textFallback: false,
        severity,
        announce: 'polite',
      };
    }
    case 'session-unavailable':
      return context.notFound
        ? {
            code,
            title: 'We could not find this call.',
            preserved: 'Nothing was changed.',
            advice: 'It may have been deleted. Go back to the scenarios to start a new call.',
            retry: null,
            textFallback: false,
            severity: 'blocking',
            announce: 'polite',
          }
        : {
            code,
            title: 'This call could not be opened.',
            preserved: 'Nothing in the call was changed.',
            advice: 'Check your connection and retry, or go back and start again.',
            retry: 'load',
            textFallback: false,
            severity: 'blocking',
            announce: 'polite',
          };
    case 'session-ended':
      return {
        code,
        title: 'This call has already ended.',
        preserved: 'Your transcript is saved.',
        advice: 'Open the report to see your coaching.',
        retry: null,
        textFallback: false,
        severity: 'blocking',
        announce: 'polite',
      };
    case 'save-failed':
      return {
        code,
        title: 'We could not confirm your message was saved.',
        preserved: 'Your message is kept.',
        advice: 'Retry sends it once, even if it was saved.',
        retry: 'send',
        textFallback: false,
        severity: 'blocking',
        announce: 'polite',
      };
    case 'turn-limit':
      return {
        code,
        title: 'This call reached its message limit.',
        preserved: 'Everything you said is saved.',
        advice: 'End the call to see your review.',
        retry: null,
        textFallback: false,
        severity: 'blocking',
        announce: 'polite',
      };
    case 'rate-limited': {
      if (context.during === 'transcribe') {
        // Speech to text has its own words for this, and typing still works while it waits.
        const seconds = context.retryAfterSeconds;
        return spoken(
          code,
          voiceError('rate-limited', {
            stage: 'transcription',
            ...(seconds === undefined ? {} : { retryAfterSeconds: seconds }),
          }),
          {
            advice: `${waitFor(seconds)}, then choose Retry, or type your reply.`,
            retry: 'transcribe',
            textFallback: true,
            severity: 'degraded',
          },
        );
      }
      return {
        code,
        title: 'Messages are going too fast.',
        preserved: 'Your message is kept.',
        advice: `${waitFor(context.retryAfterSeconds)}, then choose Retry.`,
        retry: 'send',
        textFallback: false,
        severity: 'blocking',
        announce: 'polite',
      };
    }
    case 'end-failed':
      return context.nothingToReview
        ? {
            code,
            title: 'There is nothing to review yet.',
            preserved: 'No message has been sent.',
            advice: 'Send a message first, or leave without a report.',
            retry: null,
            textFallback: true,
            severity: 'degraded',
            announce: 'polite',
          }
        : {
            code,
            title: 'We could not end the call.',
            preserved: 'Your call is still open and saved.',
            advice: 'Retry, or keep going and end it later.',
            retry: 'end',
            textFallback: true,
            severity: 'degraded',
            announce: 'polite',
          };
  }
}
