import type { SpeechLanguage, TranscribeResponse } from '#shared/domain/speech.ts';
import {
  apiError,
  isUsableTranscript,
  noSpeechError,
  poorTranscriptionError,
  type VoiceError,
} from './errors.ts';

// Turning one spoken utterance into words, once. The utterance has a client message id that is made
// when the trainee stops speaking and stays the same through every retry, so asking again can never
// make a second turn: the same id while a request is running shares that one request, the same id
// after it succeeded gives back the same answer without asking the server again, and the message that
// is finally sent carries the same id, which the server also treats as the same message.
//
// The recording is held in memory only for as long as a failed attempt may still be retried. Once
// the words are back, or the trainee types instead, or leaves the call, it is let go. It is never
// written anywhere.

/** Sends one recording to the speech service (`api.transcribe`). */
export type Transcribe = (
  audio: Blob,
  language: SpeechLanguage,
  signal?: AbortSignal,
) => Promise<TranscribeResponse>;

export type TranscribeOutcome =
  /** The words. Delivered once per id: asking again gives back this same object. */
  | { kind: 'transcript'; id: string; text: string; durationMs: number }
  /** The service heard no speech in the recording. */
  | { kind: 'no-speech'; id: string; error: VoiceError }
  /** It failed (or heard nothing usable). `error` says what to offer. */
  | { kind: 'failed'; id: string; error: VoiceError }
  /** The request was abandoned by `discard` or `dispose`; nobody is waiting for the answer. */
  | { kind: 'cancelled'; id: string };

export interface Transcriber {
  /**
   * Turns one utterance into words. The same id while it is running shares the one request, and
   * after it succeeded returns the same outcome without asking the server again.
   */
  run(id: string, audio: Blob, language: SpeechLanguage): Promise<TranscribeOutcome>;
  /**
   * After a failure that can be retried: sends the same recording again, under the same id. Resolves
   * `null` when there is nothing to retry (it succeeded, was discarded, or the recording was let go).
   */
  retry(id: string): Promise<TranscribeOutcome | null>;
  /** The trainee typed instead, or gave up: abandons any request and lets go of the recording. */
  discard(id: string): void;
  /** Whether a recording is still held for this id. Only after a failure that can be retried. */
  holds(id: string): boolean;
  /** Abandons everything and lets go of every recording. Safe to call again. */
  dispose(): void;
}

export const TRANSCRIBE_TIMEOUT_MS = 20_000;

interface Utterance {
  language: SpeechLanguage;
  /** The recording, held while a retry is still possible. */
  audio: Blob | null;
  controller: AbortController | null;
  pending: Promise<TranscribeOutcome> | null;
  /** The answer, once there is one that must not be asked for again. */
  done: TranscribeOutcome | null;
}

const isTimeout = (reason: unknown): boolean =>
  reason instanceof DOMException && reason.name === 'TimeoutError';

/** The work's result, or a rejection with the signal's reason as soon as it aborts, even if the work ignores the signal. */
function abortable<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(signal.reason);
    if (signal.aborted) {
      onAbort();
      return;
    }
    signal.addEventListener('abort', onAbort, { once: true });
    work.then(
      (value) => {
        signal.removeEventListener('abort', onAbort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener('abort', onAbort);
        reject(error);
      },
    );
  });
}

export function createTranscriber(options: {
  transcribe: Transcribe;
  timeoutMs?: number;
}): Transcriber {
  const timeoutMs = options.timeoutMs ?? TRANSCRIBE_TIMEOUT_MS;
  const utterances = new Map<string, Utterance>();
  let disposed = false;

  const cancelled = (id: string): TranscribeOutcome => ({ kind: 'cancelled', id });

  async function attempt(id: string, held: Utterance): Promise<TranscribeOutcome> {
    const audio = held.audio;
    if (audio === null) return cancelled(id);
    const controller = new AbortController();
    held.controller = controller;
    const timer = setTimeout(
      () =>
        controller.abort(
          new DOMException('Timed out waiting for the speech service.', 'TimeoutError'),
        ),
      timeoutMs,
    );
    try {
      const response = await abortable(
        options.transcribe(audio, held.language, controller.signal),
        controller.signal,
      );
      if (controller.signal.aborted) throw controller.signal.reason;
      held.audio = null;
      if (response.status === 'no-speech' || response.text.trim() === '') {
        return { kind: 'no-speech', id, error: noSpeechError() };
      }
      // Words that are only filler sounds are not a message, and the recording is not worth sending again.
      if (!isUsableTranscript(response.text)) {
        return { kind: 'failed', id, error: poorTranscriptionError() };
      }
      return {
        kind: 'transcript',
        id,
        text: response.text.trim(),
        durationMs: response.durationMs,
      };
    } catch (error) {
      const reason: unknown = controller.signal.aborted ? controller.signal.reason : error;
      // Abandoned on purpose (discard or dispose), as opposed to timed out.
      if (controller.signal.aborted && !isTimeout(reason)) return cancelled(id);
      const failure = apiError(reason, 'transcription', { recordingKept: true });
      // The recording is only kept for a failure that Retry can send again.
      if (failure.retryAction !== 'resend-recording') held.audio = null;
      return { kind: 'failed', id, error: failure };
    } finally {
      clearTimeout(timer);
      held.controller = null;
    }
  }

  function start(id: string, held: Utterance): Promise<TranscribeOutcome> {
    const pending = attempt(id, held).then((outcome) => {
      held.pending = null;
      if (outcome.kind === 'transcript' || outcome.kind === 'no-speech') held.done = outcome;
      // A failure that let go of the recording has nothing left to retry.
      if (outcome.kind === 'failed' && held.audio === null) held.done = outcome;
      return outcome;
    });
    held.pending = pending;
    return pending;
  }

  function discard(id: string): void {
    const held = utterances.get(id);
    if (!held) return;
    held.audio = null;
    held.controller?.abort(
      new DOMException('The trainee gave up on this recording.', 'AbortError'),
    );
    utterances.delete(id);
  }

  return {
    run(id, audio, language) {
      if (disposed) return Promise.resolve(cancelled(id));
      const existing = utterances.get(id);
      if (existing?.pending) return existing.pending;
      if (existing?.done) return Promise.resolve(existing.done);
      const held: Utterance = existing ?? {
        language,
        audio,
        controller: null,
        pending: null,
        done: null,
      };
      held.language = language;
      held.audio = audio;
      utterances.set(id, held);
      return start(id, held);
    },
    retry(id) {
      const held = utterances.get(id);
      if (disposed || !held) return Promise.resolve(null);
      if (held.pending) return held.pending;
      if (held.done || held.audio === null) return Promise.resolve(null);
      return start(id, held);
    },
    discard,
    holds: (id) => utterances.get(id)?.audio != null,
    dispose() {
      disposed = true;
      for (const id of [...utterances.keys()]) discard(id);
      utterances.clear();
    },
  };
}
