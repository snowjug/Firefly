import type { CallProblem, CallProblemCode } from './contract.ts';
import type { BrowserFamily } from '../voice/support.ts';

// What the trainee reads when something goes wrong. Every problem says what happened, what was kept,
// what to do (and what "Try again" does), and whether typing still works. Plain British English: no
// raw provider text, no codes, no stack traces, and it never blames the trainee. The engine passes
// only facts (a `context`); all the wording is here, so it can be read, reviewed and tested as one.

/** The step a problem happened in, which decides what "Try again" repeats. */
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
  /** The call does not exist (the server answered not found), so trying again cannot help. */
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

const TYPE_INSTEAD = 'You can also carry on by typing.';

function allowMicrophone(browser: BrowserFamily | undefined): string {
  switch (browser) {
    case 'edge':
      return 'Select the lock icon at the left of the address bar, open Permissions for this site, set Microphone to Allow, then choose Try again.';
    case 'chrome':
      return 'Select the icon at the left of the address bar (a lock or sliders), turn on Microphone, then choose Try again.';
    default:
      return "Allow the microphone for this site in your browser's settings, then choose Try again.";
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
      return 'Your message is kept here.';
    case 'speak':
      return 'Their reply is in the transcript.';
    case 'end':
      return 'Your call is still open and your transcript is saved.';
    case 'load':
      return 'Nothing in the call was changed.';
    default:
      return 'Your transcript so far is saved.';
  }
}

/** What "Try again" does, in the step that failed. */
function tryAgainDuring(step: ProblemStep | undefined): string {
  switch (step) {
    case 'send':
      return 'Choose Try again to send your message. It will not be sent twice.';
    case 'transcribe':
      return 'Choose Try again to say it again.';
    case 'speak':
      return 'Choose Try again to hear the reply.';
    case 'end':
      return 'Choose Try again to end the call.';
    case 'load':
      return 'Choose Try again to open the call again.';
    default:
      return 'Choose Try again once you are back online.';
  }
}

/** The full copy for one problem. Every field is set for every code. */
export function describeProblem(code: CallProblemCode, context: ProblemContext = {}): CallProblem {
  switch (code) {
    case 'microphone-denied':
      return {
        code,
        title: 'The microphone is blocked for this site.',
        preserved: context.beforeCall
          ? 'Nothing has been recorded or sent.'
          : 'Your transcript so far is saved.',
        advice: `${allowMicrophone(context.browser)} ${TYPE_INSTEAD}`,
        retry: 'microphone',
        textFallback: true,
        severity: 'blocking',
      };
    case 'microphone-missing':
      return {
        code,
        title: 'No microphone was found.',
        preserved: context.beforeCall
          ? 'Nothing has been recorded.'
          : 'Your transcript so far is saved.',
        advice: `Check that a microphone is connected and switched on, then choose Try again. ${TYPE_INSTEAD}`,
        retry: 'microphone',
        textFallback: true,
        severity: 'blocking',
      };
    case 'microphone-busy':
      return {
        code,
        title: context.timedOut
          ? 'The microphone did not respond.'
          : 'The microphone did not start.',
        preserved: context.beforeCall
          ? 'Nothing has been recorded.'
          : 'Your transcript so far is saved.',
        advice: `Another app may be using it. Close any app that uses the microphone, check the permission prompt near the address bar, then choose Try again. ${TYPE_INSTEAD}`,
        retry: 'microphone',
        textFallback: true,
        severity: 'blocking',
      };
    case 'microphone-unsupported':
      return {
        code,
        title: 'This browser cannot record your voice here.',
        preserved: context.beforeCall
          ? 'Nothing has been recorded.'
          : 'Your transcript so far is saved.',
        advice:
          'A spoken call needs Microsoft Edge or Google Chrome on a secure (https) connection. You can carry on by typing.',
        retry: null,
        textFallback: true,
        severity: 'blocking',
      };
    case 'transcription-failed':
      return {
        code,
        title: context.timedOut
          ? 'Turning your speech into text took too long.'
          : 'We could not turn your speech into text.',
        preserved:
          'Nothing was sent. Your recording was not kept, and your transcript so far is saved.',
        advice: 'Choose Try again to say it again, or type your reply instead.',
        retry: 'transcribe',
        textFallback: true,
        severity: 'degraded',
      };
    case 'speech-service-unavailable':
      return {
        code,
        title: 'The speech service is not available right now.',
        preserved: 'Nothing was sent, and your transcript so far is saved.',
        advice: 'Type your reply instead, or choose Try again to see whether it is back.',
        retry: 'transcribe',
        textFallback: true,
        severity: 'degraded',
      };
    case 'reply-failed':
      return {
        code,
        title: 'The customer could not reply.',
        preserved: context.saved ? 'Your message was saved.' : 'Your message is kept here.',
        advice: 'Choose Try again to send it again. It will not be sent twice.',
        retry: 'send',
        textFallback: false,
        severity: 'blocking',
      };
    case 'reply-timeout':
      return {
        code,
        title: 'The customer is taking too long to reply.',
        preserved: 'Your message is kept, and sending it again will not duplicate it.',
        advice: 'Choose Try again to wait for the reply again.',
        retry: 'send',
        textFallback: false,
        severity: 'blocking',
      };
    case 'voice-generation-failed':
      return {
        code,
        title: "The customer's voice could not be made this time.",
        preserved: 'Their reply is in the transcript.',
        advice: 'Read it there, or choose Try again to hear it. You can keep talking or typing.',
        retry: 'speak',
        textFallback: true,
        severity: 'degraded',
      };
    case 'playback-blocked':
      return {
        code,
        title: "Your browser is blocking the customer's voice.",
        preserved: 'Their reply is in the transcript.',
        advice: 'Press Play to hear it, or read the reply and carry on.',
        retry: 'speak',
        textFallback: true,
        severity: 'degraded',
      };
    case 'playback-failed':
      return {
        code,
        title: "The customer's voice stopped unexpectedly.",
        preserved: 'Their reply is in the transcript.',
        advice: 'Read it there, or choose Try again to hear it again.',
        retry: 'speak',
        textFallback: true,
        severity: 'degraded',
      };
    case 'offline': {
      const step = context.during;
      // A call that could not be ended is still open, so being offline there does not stop it: the
      // notice can be dismissed, and the call carries on.
      const stillOpen = step === 'end';
      return {
        code,
        title: 'You appear to be offline.',
        preserved: keptDuring(step),
        advice: `Check your connection. ${tryAgainDuring(step)}`,
        retry: STEP_RETRY[step ?? 'send'],
        textFallback: false,
        severity: stillOpen ? 'degraded' : 'blocking',
      };
    }
    case 'session-unavailable':
      return context.notFound
        ? {
            code,
            title: 'We could not find this call.',
            preserved: 'Nothing was changed.',
            advice:
              'It may have been deleted, or the link may not be right. Go back to the scenarios to start a new call.',
            retry: null,
            textFallback: false,
            severity: 'blocking',
          }
        : {
            code,
            title: 'This call could not be opened.',
            preserved: 'Nothing in the call was changed.',
            advice:
              'Check your connection and choose Try again, or go back and start the call again.',
            retry: 'load',
            textFallback: false,
            severity: 'blocking',
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
      };
    case 'save-failed':
      return {
        code,
        title: 'We could not be sure your message was saved.',
        preserved: 'Your message is kept here.',
        advice: 'Choose Try again. It will not be sent twice, even if it was saved.',
        retry: 'send',
        textFallback: false,
        severity: 'blocking',
      };
    case 'turn-limit':
      return {
        code,
        title: 'This call has reached its message limit.',
        preserved: 'Everything you said is saved.',
        advice: 'End the call to see your coaching.',
        retry: null,
        textFallback: false,
        severity: 'blocking',
      };
    case 'rate-limited': {
      const step = context.during === 'transcribe' ? 'transcribe' : 'send';
      return {
        code,
        title: 'Messages are going a little too fast.',
        preserved:
          step === 'transcribe'
            ? 'Nothing was sent, and your transcript so far is saved.'
            : 'Your message is kept here.',
        advice: `${waitFor(context.retryAfterSeconds)}, then choose Try again${
          step === 'transcribe' ? ' to say it again' : ''
        }.`,
        retry: STEP_RETRY[step],
        textFallback: false,
        severity: step === 'transcribe' ? 'degraded' : 'blocking',
      };
    }
    case 'end-failed':
      return context.nothingToReview
        ? {
            code,
            title: 'There is nothing to review yet.',
            preserved: 'No message has been sent, so there is no transcript.',
            advice: 'Send a message to the customer first, or leave the call without a report.',
            retry: null,
            textFallback: true,
            severity: 'degraded',
          }
        : {
            code,
            title: 'We could not end the call.',
            preserved: 'Your call is still open and your transcript is saved.',
            advice: 'Choose Try again, or keep going and end it later.',
            retry: 'end',
            textFallback: true,
            severity: 'degraded',
          };
  }
}
