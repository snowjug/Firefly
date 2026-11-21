import { createVad, type VadEndReason, type VadEvent, type VadOptions } from './vad.ts';
import type { MicrophoneHandle } from './microphone.ts';
import type { Capture, CaptureHandlers, CaptureSession, SpeechEndReason } from './types.ts';
import { encodeWav, wavBlob } from './wav.ts';

// Capture for the server's speech service: the microphone's samples arrive from the worklet in small
// blocks, the voice-activity detector finds where the trainee starts and stops speaking, and each
// utterance is encoded as a 16 kHz mono WAV in memory. The audio is handed over once and never kept:
// this module holds no reference to it after `onAudio` has been called.

export interface ServerCaptureOptions {
  microphone: MicrophoneHandle;
  /** The longest recording the server accepts, in milliseconds. */
  maxUtteranceMs?: number;
  vad?: Partial<VadOptions>;
}

const END_REASONS: Record<VadEndReason, SpeechEndReason> = {
  silence: 'silence',
  limit: 'limit',
  flush: 'stopped',
};

export function createServerCapture(options: ServerCaptureOptions): Capture {
  const { microphone } = options;
  let closeOpenPass: (() => void) | null = null;

  return {
    engine: 'server-speech',
    prepare() {
      // The microphone and the worklet were prepared when the call began.
    },
    listen(handlers: CaptureHandlers): CaptureSession {
      // Only one pass is ever open: a new pass ends any earlier one without reporting anything.
      closeOpenPass?.();
      const worklet = microphone.worklet;
      if (!worklet) {
        queueMicrotask(() => handlers.onFailure({ kind: 'microphone', reason: 'unsupported' }));
        return { finish() {}, cancel() {} };
      }

      const vad = createVad({
        ...options.vad,
        sampleRate: microphone.sampleRate,
        ...(options.maxUtteranceMs ? { maxUtteranceMs: options.maxUtteranceMs } : {}),
      });
      let closed = false;
      const close = () => {
        if (closed) return;
        closed = true;
        worklet.port.onmessage = null;
        microphone.setListening(false);
        vad.reset();
        if (closeOpenPass === close) closeOpenPass = null;
      };
      closeOpenPass = close;

      const onEvent = (event: VadEvent): void => {
        if (closed) return;
        if (event.type === 'speech-start') {
          handlers.onSpeechStart();
        } else if (event.type === 'dropped') {
          handlers.onSpeechDropped();
        } else {
          const blob = wavBlob(encodeWav(event.samples, event.sampleRate));
          const { durationMs, reason } = event;
          close();
          handlers.onSpeechEnd({ reason: END_REASONS[reason] });
          handlers.onAudio(blob, { durationMs });
        }
      };

      worklet.port.onmessage = (message: MessageEvent<Float32Array>) => {
        if (closed) return;
        for (const event of vad.push(message.data)) onEvent(event);
      };
      microphone.setListening(true);
      // The tap on the microphone is open now: say so, unless the pass was ended in the meantime.
      queueMicrotask(() => {
        if (!closed) handlers.onListening?.();
      });

      return {
        finish() {
          if (closed) return;
          let emitted = false;
          for (const event of vad.flush()) {
            emitted ||= event.type === 'utterance';
            onEvent(event);
          }
          if (!emitted && !closed) {
            close();
            handlers.onNothing();
          }
        },
        cancel: close,
      };
    },
    dispose() {
      closeOpenPass?.();
    },
  };
}
