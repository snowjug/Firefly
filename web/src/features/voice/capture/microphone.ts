import {
  getAudioContextConstructor,
  getAudioWorkletNodeConstructor,
  getMediaDevices,
} from '../support.ts';
import { levelFromRms, rmsOf } from './levels.ts';
import { MicrophoneError, type MicrophoneFailure } from './types.ts';

// The microphone for one spoken call: the permission, the stream, and a small audio graph that
// measures the level and (for the server's speech service) hands the samples to a worklet. It is
// only ever created by an explicit "begin", only reads audio while a listening pass is open, and
// `release` stops every track so the browser's recording indicator goes off.

/** Same-origin, so a `script-src 'self'` policy allows it. */
export const WORKLET_URL = '/audio/capture-worklet.js';
export const WORKLET_NAME = 'firefly-capture';
const CAPTURE_SAMPLE_RATE = 16000;
const RUNNING_WAIT_MS = 1000;

export interface MicrophoneHandle {
  /** The rate the samples from `worklet` are at (16 kHz when the browser allows it). */
  readonly sampleRate: number;
  /** Delivers blocks of samples while listening; null when the worklet could not be used. */
  readonly worklet: AudioWorkletNode | null;
  /** Opens or closes the flow of audio to the level meter and the worklet. */
  setListening(on: boolean): void;
  /** Disables the microphone track, so nothing is captured while the call is muted. */
  setEnabled(on: boolean): void;
  /** The loudness right now, 0 to 1; 0 whenever nobody is listening. */
  readLevel(): number;
  /** Called when the device is unplugged or access is withdrawn. Returns a function that stops it. */
  onEnded(listener: () => void): () => void;
  /** Stops every track, disconnects every node and closes the audio context. Safe to repeat. */
  release(): void;
}

export interface AcquireOptions {
  /** Load the capture worklet too (the server's speech service needs it). */
  worklet: boolean;
  /**
   * Abandons the request: the audio context is closed at once, and a microphone the browser grants
   * later is stopped as soon as it arrives (a permission prompt cannot be withdrawn).
   */
  signal?: AbortSignal;
}

const CONSTRAINTS: MediaStreamConstraints = {
  audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
  video: false,
};

/** Maps what `getUserMedia` throws onto the few reasons the trainee can act on. */
export function mapMicrophoneError(error: unknown): MicrophoneFailure {
  const name = (error as { name?: unknown } | null)?.name;
  switch (name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
    case 'SecurityError':
      return 'denied';
    case 'NotFoundError':
    case 'DevicesNotFoundError':
    case 'OverconstrainedError':
      return 'missing';
    case 'TypeError':
      return 'unsupported';
    default:
      // NotReadableError, TrackStartError, AbortError and anything unknown: the device did not start.
      return 'busy';
  }
}

function openContext(sampleRate?: number): AudioContext | null {
  const Context = getAudioContextConstructor();
  if (!Context) return null;
  try {
    return sampleRate === undefined ? new Context() : new Context({ sampleRate });
  } catch {
    // A rate the device cannot do throws NotSupportedError.
    return null;
  }
}

function closeQuietly(context: AudioContext | null): void {
  if (!context || context.state === 'closed') return;
  try {
    void context.close().catch(() => undefined);
  } catch {
    // Already closed.
  }
}

function sourceFor(context: AudioContext, stream: MediaStream): MediaStreamAudioSourceNode | null {
  try {
    return context.createMediaStreamSource(stream);
  } catch {
    // Some browsers cannot connect a microphone to a context at a different rate.
    return null;
  }
}

async function isRunning(context: AudioContext): Promise<boolean> {
  if (context.state === 'running') return true;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      context.resume(),
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, RUNNING_WAIT_MS);
      }),
    ]);
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
  return (context.state as AudioContextState) === 'running';
}

/**
 * Asks for the microphone and builds the audio graph. Call it from a click or tap: the audio context
 * and the permission request are both started before the first `await`, inside the gesture.
 * Rejects with a `MicrophoneError` when the microphone cannot be used.
 */
export async function acquireMicrophone(options: AcquireOptions): Promise<MicrophoneHandle> {
  const devices = getMediaDevices();
  if (!devices) throw new MicrophoneError('unsupported');

  let context = openContext(CAPTURE_SAMPLE_RATE) ?? openContext();
  void context?.resume().catch(() => undefined);

  const { signal } = options;
  const onAbort = () => closeQuietly(context);
  signal?.addEventListener('abort', onAbort, { once: true });
  const abandoned = () => signal?.aborted === true;

  let stream: MediaStream;
  try {
    stream = await devices.getUserMedia(CONSTRAINTS);
  } catch (error) {
    signal?.removeEventListener('abort', onAbort);
    closeQuietly(context);
    throw new MicrophoneError(mapMicrophoneError(error));
  }
  if (abandoned()) {
    for (const track of stream.getTracks()) track.stop();
    closeQuietly(context);
    throw new MicrophoneError('busy', 'The microphone request was abandoned.');
  }

  let source = context ? sourceFor(context, stream) : null;
  if (context && !source) {
    // Fall back to the device's own rate; the recording is resampled to 16 kHz afterwards.
    closeQuietly(context);
    context = openContext();
    void context?.resume().catch(() => undefined);
    source = context ? sourceFor(context, stream) : null;
  }

  let analyser: AnalyserNode | null = null;
  let silent: GainNode | null = null;
  let worklet: AudioWorkletNode | null = null;
  if (context && source) {
    try {
      analyser = context.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0;
      // Browsers only run nodes that lead to the destination, so everything ends in a muted gain.
      silent = context.createGain();
      silent.gain.value = 0;
      silent.connect(context.destination);
      analyser.connect(silent);
    } catch {
      analyser = null;
    }
    const Worklet = getAudioWorkletNodeConstructor();
    if (options.worklet && Worklet && silent && (await isRunning(context))) {
      try {
        await context.audioWorklet.addModule(WORKLET_URL);
        worklet = new Worklet(context, WORKLET_NAME, {
          numberOfInputs: 1,
          numberOfOutputs: 1,
          channelCount: 1,
          channelCountMode: 'explicit',
          outputChannelCount: [1],
        });
        worklet.connect(silent);
      } catch {
        worklet = null;
      }
    }
  }

  const tracks = stream.getAudioTracks();
  const buffer = analyser ? new Float32Array(analyser.fftSize) : null;
  const endedListeners = new Set<() => void>();
  const notifyEnded = () => {
    for (const listener of [...endedListeners]) listener();
  };
  for (const track of tracks) track.addEventListener('ended', notifyEnded);

  let listening = false;
  let released = false;

  const setListening = (on: boolean): void => {
    if (released || on === listening || !source) return;
    listening = on;
    try {
      if (on) {
        if (analyser) source.connect(analyser);
        if (worklet) {
          source.connect(worklet);
          worklet.port.postMessage({ type: 'start' });
        }
      } else {
        if (analyser) source.disconnect(analyser);
        if (worklet) {
          worklet.port.postMessage({ type: 'stop' });
          source.disconnect(worklet);
        }
      }
    } catch {
      // A node that is already disconnected.
    }
  };

  const handle: MicrophoneHandle = {
    sampleRate: context?.sampleRate ?? CAPTURE_SAMPLE_RATE,
    worklet,
    setListening,
    setEnabled(on) {
      if (released) return;
      for (const track of tracks) track.enabled = on;
    },
    readLevel() {
      if (released || !listening || !analyser || !buffer) return 0;
      analyser.getFloatTimeDomainData(buffer);
      return levelFromRms(rmsOf(buffer));
    },
    onEnded(listener) {
      endedListeners.add(listener);
      return () => endedListeners.delete(listener);
    },
    release() {
      if (released) return;
      setListening(false);
      released = true;
      endedListeners.clear();
      for (const track of tracks) {
        track.removeEventListener('ended', notifyEnded);
      }
      for (const track of stream.getTracks()) track.stop();
      try {
        if (worklet) {
          worklet.port.postMessage({ type: 'close' });
          worklet.port.onmessage = null;
          worklet.port.close();
          worklet.disconnect();
        }
        source?.disconnect();
        analyser?.disconnect();
        silent?.disconnect();
      } catch {
        // Nodes that were never connected.
      }
      closeQuietly(context);
    },
  };

  signal?.removeEventListener('abort', onAbort);
  if (abandoned()) {
    // Abandoned while the graph was being built: let go of all of it.
    handle.release();
    throw new MicrophoneError('busy', 'The microphone request was abandoned.');
  }
  return handle;
}
