import { afterEach, describe, expect, it } from 'vitest';
import { acquireMicrophone, mapMicrophoneError, WORKLET_URL } from './microphone.ts';
import { MicrophoneError } from './types.ts';
import { installFakes, type FakeEnv, type FakeWorkletNode } from '../testing/fakes.ts';

let env: FakeEnv;
afterEach(() => env.uninstall());

async function failure(promise: Promise<unknown>): Promise<MicrophoneError> {
  try {
    await promise;
  } catch (error) {
    return error as MicrophoneError;
  }
  throw new Error('Expected the microphone request to fail.');
}

describe('mapMicrophoneError', () => {
  it('turns what getUserMedia throws into a reason the trainee can act on', () => {
    env = installFakes();
    const named = (name: string) => ({ name });
    expect(mapMicrophoneError(named('NotAllowedError'))).toBe('denied');
    expect(mapMicrophoneError(named('PermissionDeniedError'))).toBe('denied');
    expect(mapMicrophoneError(named('SecurityError'))).toBe('denied');
    expect(mapMicrophoneError(named('NotFoundError'))).toBe('missing');
    expect(mapMicrophoneError(named('DevicesNotFoundError'))).toBe('missing');
    expect(mapMicrophoneError(named('NotReadableError'))).toBe('busy');
    expect(mapMicrophoneError(named('AbortError'))).toBe('busy');
    expect(mapMicrophoneError(named('TypeError'))).toBe('unsupported');
    expect(mapMicrophoneError(new Error('who knows'))).toBe('busy');
    expect(mapMicrophoneError(null)).toBe('busy');
  });
});

describe('acquireMicrophone', () => {
  it('asks for one mono stream with echo cancellation, noise suppression and gain control', async () => {
    env = installFakes();
    await acquireMicrophone({ worklet: false });
    expect(env.mic.getUserMedia).toHaveBeenCalledTimes(1);
    expect(env.mic.getUserMedia.mock.calls[0]?.[0]).toEqual({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
      },
      video: false,
    });
  });

  it('starts the audio context and the permission request before anything is awaited, inside the click', () => {
    env = installFakes();
    void acquireMicrophone({ worklet: true });
    // Nothing has been awaited yet: both already exist.
    expect(env.mic.getUserMedia).toHaveBeenCalledTimes(1);
    expect(env.contexts).toHaveLength(1);
    expect(env.contexts[0]?.sampleRate).toBe(16000);
  });

  it('maps a refusal, a missing device, a busy device and an unsupported browser', async () => {
    env = installFakes();
    for (const [mode, reason] of [
      ['deny', 'denied'],
      ['missing', 'missing'],
      ['busy', 'busy'],
      ['unsupported', 'unsupported'],
    ] as const) {
      env.mic.mode = mode;
      const error = await failure(acquireMicrophone({ worklet: false }));
      expect(error).toBeInstanceOf(MicrophoneError);
      expect(error.reason).toBe(reason);
    }
    // Nothing was left open by the failures.
    expect(env.audio.openContexts()).toHaveLength(0);
    expect(env.mic.openTracks()).toHaveLength(0);
  });

  it('is unsupported without navigator.mediaDevices', async () => {
    env = installFakes({ microphone: false });
    expect((await failure(acquireMicrophone({ worklet: false }))).reason).toBe('unsupported');
  });

  it('loads the worklet from the same origin and reports the rate it records at', async () => {
    env = installFakes();
    const microphone = await acquireMicrophone({ worklet: true });
    expect(WORKLET_URL).toBe('/audio/capture-worklet.js');
    expect(env.audio.moduleUrls).toEqual(['/audio/capture-worklet.js']);
    expect(microphone.worklet).not.toBeNull();
    expect(microphone.sampleRate).toBe(16000);
  });

  it('falls back to the default rate when 16 kHz is not possible, and says so', async () => {
    env = installFakes();
    env.audio.supportsFixedRate = false;
    const microphone = await acquireMicrophone({ worklet: true });
    expect(microphone.sampleRate).toBe(48000);
    expect(microphone.worklet).not.toBeNull();
  });

  it('falls back to the device rate when the browser will not connect a microphone to a 16 kHz context', async () => {
    env = installFakes();
    env.audio.sourceNeedsDeviceRate = true;
    const microphone = await acquireMicrophone({ worklet: true });
    expect(microphone.sampleRate).toBe(48000);
    expect(env.contexts[0]?.state).toBe('closed');
  });

  it('has no worklet when it cannot load, but still gives a microphone and a meter', async () => {
    env = installFakes();
    env.audio.workletFails = true;
    const microphone = await acquireMicrophone({ worklet: true });
    expect(microphone.worklet).toBeNull();
    expect(env.mic.openTracks()).toHaveLength(1);
  });

  it('has no worklet when the context will not run', async () => {
    env = installFakes();
    env.audio.startSuspended = true;
    env.audio.resumeStaysSuspended = true;
    const microphone = await acquireMicrophone({ worklet: true });
    expect(microphone.worklet).toBeNull();
  });

  it('only reads audio while listening: the meter reads 0 until then and again afterwards', async () => {
    env = installFakes();
    env.audio.analyserRms = 0.1;
    const microphone = await acquireMicrophone({ worklet: true });
    expect(microphone.readLevel()).toBe(0);
    expect(env.audio.listeningWorklets()).toHaveLength(0);
    const idleEdges = env.edgeCount();

    microphone.setListening(true);
    expect(microphone.readLevel()).toBeGreaterThan(0.5);
    expect(env.audio.listeningWorklets()).toHaveLength(1);
    expect(env.edgeCount()).toBeGreaterThan(idleEdges);

    microphone.setListening(true); // repeating changes nothing
    microphone.setListening(false);
    expect(microphone.readLevel()).toBe(0);
    expect(env.audio.listeningWorklets()).toHaveLength(0);
    expect(env.edgeCount()).toBe(idleEdges);
  });

  it('disables the track when muted, without letting go of the microphone', async () => {
    env = installFakes();
    const microphone = await acquireMicrophone({ worklet: false });
    microphone.setEnabled(false);
    expect(env.mic.tracks.every((track) => !track.enabled)).toBe(true);
    expect(env.mic.openTracks()).toHaveLength(1);
    microphone.setEnabled(true);
    expect(env.mic.tracks.every((track) => track.enabled)).toBe(true);
  });

  it('tells the page when the device goes away', async () => {
    env = installFakes();
    const microphone = await acquireMicrophone({ worklet: false });
    let ended = 0;
    const stop = microphone.onEnded(() => ended++);
    env.mic.tracks[0]?.unplug();
    expect(ended).toBe(1);
    stop();
    env.mic.tracks[0]?.unplug();
    expect(ended).toBe(1);
  });

  it('lets go of everything on release: tracks stopped, nodes disconnected, context closed, listeners removed', async () => {
    env = installFakes();
    const microphone = await acquireMicrophone({ worklet: true });
    const worklet = microphone.worklet as unknown as FakeWorkletNode;
    microphone.setListening(true);
    expect(env.listenerCount()).toBeGreaterThan(0);
    expect(worklet.port.closed).toBe(false);

    microphone.release();
    expect(env.mic.openTracks()).toHaveLength(0);
    expect(env.audio.openContexts()).toHaveLength(0);
    expect(env.edgeCount()).toBe(0);
    expect(env.listenerCount()).toBe(0);
    expect(env.audio.listeningWorklets()).toHaveLength(0);
    // The worklet is told to stop and its message port is closed, not left for the garbage collector.
    expect(worklet.closed).toBe(true);
    expect(worklet.port.closed).toBe(true);
    expect(worklet.port.onmessage).toBeNull();
    // Further use does nothing, and releasing again is harmless.
    microphone.setListening(true);
    microphone.setEnabled(true);
    expect(microphone.readLevel()).toBe(0);
    expect(() => microphone.release()).not.toThrow();
  });
});
