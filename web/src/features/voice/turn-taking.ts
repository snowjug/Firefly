import { CAPTURE_TUNING } from './capture/tuning.ts';
import type { Capture, CaptureHandlers, CaptureSession } from './capture/types.ts';
import type {
  Playback,
  PlaybackHandlers,
  PlaybackJob,
  PlaybackStop,
  PlayRequest,
} from './playback/types.ts';

// Controlled turn-taking, as a small piece of logic that does not depend on the call machine. Firefly
// does not let the trainee talk over the customer and have the customer's voice stop by itself
// ("barge-in"): the customer speaks, the trainee can press "Stop customer audio" at any time, and the
// microphone opens after the customer's voice has ended, with a short settle in between. A
// microphone next to speakers hears the customer's own voice, and a detector cannot tell that echo
// from the trainee: see barge-in.test.ts, which shows the false triggers. So nothing here records
// while the customer speaks, and nothing here stops the customer on a sound.
//
// The call machine enforces the same rule on its own; this is the part that holds even if another
// caller forgets: a guarded capture refuses to open the microphone while it is not the trainee's turn.

export type TurnOwner = 'trainee' | 'customer';

export interface TurnGate {
  /** The customer's voice has been asked for (it may still be on its way): nothing may record. */
  customerStarted(): void;
  /** The customer's voice ended, failed, was blocked or was stopped. The trainee may record after the settle. */
  customerStopped(): void;
  /** Whether the microphone may open now. */
  canListen(): boolean;
  /** Whose turn it is. */
  owner(): TurnOwner;
  /** How long until the microphone may open, in milliseconds (0 when it may). */
  waitMs(): number;
}

export function createTurnGate(options: { now?: () => number; settleMs?: number } = {}): TurnGate {
  const now = options.now ?? Date.now;
  const settleMs = options.settleMs ?? CAPTURE_TUNING.settleAfterPlaybackMs;
  let speaking = false;
  // When the customer last stopped; the trainee's turn begins once the settle has passed.
  let stoppedAt = Number.NEGATIVE_INFINITY;
  const wait = () =>
    speaking ? Number.POSITIVE_INFINITY : Math.max(0, stoppedAt + settleMs - now());
  return {
    customerStarted() {
      speaking = true;
    },
    customerStopped() {
      if (speaking) stoppedAt = now();
      speaking = false;
    },
    canListen: () => wait() === 0,
    owner: () => (wait() === 0 ? 'trainee' : 'customer'),
    waitMs: wait,
  };
}

const INERT: CaptureSession = { finish() {}, cancel() {} };

/**
 * A capture that never opens the microphone while the customer is speaking or has only just stopped.
 * Asked to listen then, it records nothing, says so through `onBlocked`, and returns a session that
 * does nothing. At any other time it is the capture it wraps.
 */
export function guardCapture(capture: Capture, gate: TurnGate): Capture {
  return {
    engine: capture.engine,
    prepare: () => capture.prepare(),
    listen(handlers: CaptureHandlers): CaptureSession {
      if (!gate.canListen()) {
        queueMicrotask(() => handlers.onBlocked?.('customer-speaking'));
        return INERT;
      }
      return capture.listen(handlers);
    },
    dispose: () => capture.dispose(),
  };
}

/**
 * A playback that tells the gate when the customer's voice is wanted and when it is over, in every
 * way it can end: finished, failed, blocked by the browser, or stopped ("Stop customer audio"). Stopping
 * returns what `stop` of the wrapped job returns, so the transcript can say the customer was cut off.
 */
export function gatePlayback(playback: Playback, gate: TurnGate): Playback {
  return {
    engine: playback.engine,
    prime: () => playback.prime(),
    play(request: PlayRequest, handlers: PlaybackHandlers): PlaybackJob {
      gate.customerStarted();
      const job = playback.play(request, {
        ...handlers,
        onEnd: () => {
          gate.customerStopped();
          handlers.onEnd();
        },
        onBlocked: () => {
          gate.customerStopped();
          handlers.onBlocked();
        },
        onFailure: (kind) => {
          gate.customerStopped();
          handlers.onFailure(kind);
        },
      });
      return {
        stop(): PlaybackStop {
          const result = job.stop();
          gate.customerStopped();
          return result;
        },
      };
    },
    dispose() {
      playback.dispose();
      gate.customerStopped();
    },
  };
}
