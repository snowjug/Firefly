import { useCallback, useEffect, useRef, useState } from 'react';
import { LEVEL_INTERVAL_MS, smoothLevel } from '../voice/capture/levels.ts';
import { acquireMicrophone, type MicrophoneHandle } from '../voice/capture/microphone.ts';
import { MicrophoneError } from '../voice/capture/types.ts';
import type { MicCheck } from './mic-readiness.ts';

// The microphone check on the brief. It opens the microphone only when the trainee presses the
// button (a click is the gesture the browser needs, and the permission prompt is the consent), shows
// the level for a few seconds, and lets go of every track on every way out: heard, silent, failed,
// stopped by the trainee, device unplugged, or the page closed. Nothing is recorded or kept.

/** The level (0 to 1) that counts as sound, and how long it must last. */
const HEARD_LEVEL = 0.2;
const HEARD_MS = 400;
/** How long to listen before saying nothing was heard. */
const LISTEN_MS = 8000;

export function useMicCheck() {
  const [check, setCheck] = useState<MicCheck>({ status: 'idle' });
  // The level is written straight to the meter element, so it never re-renders the page.
  const meter = useRef<HTMLSpanElement>(null);
  const stopRef = useRef<(() => void) | null>(null);

  const begin = useCallback(() => {
    if (stopRef.current) return;
    setCheck({ status: 'requesting' });
    const controller = new AbortController();
    let handle: MicrophoneHandle | null = null;
    let timer: ReturnType<typeof setInterval> | undefined;
    let limit: ReturnType<typeof setTimeout> | undefined;
    let closed = false;

    const close = (next: MicCheck) => {
      if (closed) return;
      closed = true;
      clearInterval(timer);
      clearTimeout(limit);
      controller.abort();
      handle?.release();
      stopRef.current = null;
      meter.current?.style.setProperty('--level', '0');
      setCheck(next);
    };
    stopRef.current = () => close({ status: 'idle' });

    acquireMicrophone({ worklet: false, signal: controller.signal })
      .then((acquired) => {
        if (closed) {
          acquired.release();
          return;
        }
        handle = acquired;
        acquired.onEnded(() => close({ status: 'failed', reason: 'missing' }));
        acquired.setListening(true);
        setCheck({ status: 'listening' });
        let level = 0;
        let heard = 0;
        timer = setInterval(() => {
          level = smoothLevel(level, acquired.readLevel());
          meter.current?.style.setProperty('--level', String(level));
          heard = level >= HEARD_LEVEL ? heard + LEVEL_INTERVAL_MS : 0;
          if (heard >= HEARD_MS) close({ status: 'ok' });
        }, LEVEL_INTERVAL_MS);
        limit = setTimeout(() => close({ status: 'silent' }), LISTEN_MS);
      })
      .catch((error: unknown) => {
        close({
          status: 'failed',
          reason: error instanceof MicrophoneError ? error.reason : 'busy',
        });
      });
  }, []);

  const stop = useCallback(() => stopRef.current?.(), []);

  // Leaving the page lets go of the microphone.
  useEffect(() => () => stopRef.current?.(), []);

  return { check, begin, stop, meter };
}
