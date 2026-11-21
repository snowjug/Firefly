import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SpokenTurn } from '../../lib/api.ts';
import { acquireMicrophone } from './capture/microphone.ts';
import { createServerCapture } from './capture/server-capture.ts';
import type { CaptureHandlers } from './capture/types.ts';
import { createVad, VAD_DEFAULTS, type VadEvent } from './capture/vad.ts';
import { createServerPlayback } from './playback/server-playback.ts';
import type { PlayRequest } from './playback/types.ts';
import { installFakes, type FakeEnv } from './testing/fakes.ts';
import { blocks, concat, noise, silence, syllables } from './testing/signals.ts';
import { createTurnGate, gatePlayback, guardCapture } from './turn-taking.ts';

// DECISION: Firefly does not offer barge-in (the trainee talking over the customer and the customer's
// voice stopping by itself). It offers controlled turn-taking: the customer speaks, the trainee can
// press "Stop customer audio" at any time, and the microphone opens after the customer has finished.
//
// WHY: a microphone next to speakers hears the speakers. To stop the customer when the trainee
// speaks, the detector must tell the trainee from the customer's own voice coming back. These tests
// show that the detector Firefly uses cannot, by feeding it the customer's voice at the levels a
// leak could have, and that no threshold separates the two. A false trigger would cut the customer
// off for no reason, or send the customer's own words back as the trainee's reply.
//
// WHAT THIS IS NOT: it is a simulation with synthetic signals, not a measurement of any laptop,
// speaker, browser or echo canceller. Browsers do try to cancel echo (the microphone is opened with
// echoCancellation on), and how well it works depends on the device; these tests cannot show that it
// works or that it fails. They show that Firefly has no way of knowing. Barge-in would need evidence
// from real hardware in real browsers, which is outside what automated tests here can give.

const RATE = 16_000;

/** Speech-like sound (syllable-sized bursts with dips between) at a given loudness (RMS, 0 to 1). */
const speechLike = (ms: number, rms: number) => syllables(ms, RATE, rms * Math.SQRT2, 260, 60);

/** The room, then a sound arriving in it. */
const inRoom = (sound: Float32Array) => concat(noise(600, RATE, 0.002, 5), sound);

const dbfs = (rms: number) => Math.round(20 * Math.log10(rms));

function hear(
  audio: Float32Array,
  options: Partial<Parameters<typeof createVad>[0]> = {},
): VadEvent[] {
  const vad = createVad({ sampleRate: RATE, ...options });
  return blocks(audio, 160).flatMap((block) => vad.push(block));
}

const triggered = (events: VadEvent[]) => events.some((event) => event.type === 'speech-start');

// The quietest real speech the detector has to keep hearing: the existing VAD tests include a soft
// talker at an amplitude of 0.03 (an RMS of about 0.021, or -34 dBFS).
const SOFT_SPEECH_RMS = 0.021;
// Levels at which the customer's own voice could reach the microphone, from very well cancelled to not.
const LEAK_LEVELS = [0.01, 0.02, 0.04, 0.08];

describe("the customer's own voice leaking into the microphone", () => {
  it.each(LEAK_LEVELS)('is taken for the trainee starting to speak, at %f RMS', (rms) => {
    // A reply of 2.5 s, as the microphone would hear it.
    expect(triggered(hear(inRoom(speechLike(2500, rms)))), `${dbfs(rms)} dBFS`).toBe(true);
  });

  it("becomes a whole utterance of the customer's own words once the reply ends", () => {
    const events = hear(concat(inRoom(speechLike(2500, 0.04)), silence(2000, RATE)));
    const utterances = events.filter((event) => event.type === 'utterance');
    expect(utterances).toHaveLength(1);
    expect(utterances[0]).toMatchObject({ reason: 'silence' });
  });

  it('is only ignored when it is quieter than the detector can hear at all', () => {
    // Below the lowest start threshold nothing is heard: the only safe level is "gone".
    const faint = VAD_DEFAULTS.minStartRms * 0.5;
    expect(triggered(hear(inRoom(speechLike(2500, faint))))).toBe(false);
    expect(triggered(hear(inRoom(speechLike(2500, VAD_DEFAULTS.minStartRms * 1.6))))).toBe(true);
  });
});

describe('no loudness threshold tells the trainee from the leak', () => {
  const THRESHOLDS = [VAD_DEFAULTS.minStartRms, 0.01, 0.02, 0.03, 0.05, 0.08, 0.12];

  // What each threshold does with a soft-spoken trainee and with a leak louder than that trainee.
  const table = THRESHOLDS.map((threshold) => ({
    threshold,
    hearsSoftTrainee: triggered(
      hear(inRoom(speechLike(2500, SOFT_SPEECH_RMS)), { minStartRms: threshold }),
    ),
    triggeredByLeak: triggered(hear(inRoom(speechLike(2500, 0.04)), { minStartRms: threshold })),
  }));

  it('hears a quiet trainee only at thresholds that also let a louder leak through', () => {
    for (const row of table) {
      expect(
        row.hearsSoftTrainee && !row.triggeredByLeak,
        `threshold ${row.threshold}: heard the quiet trainee and ignored the leak`,
      ).toBe(false);
    }
  });

  it('either stops the customer for nothing or cannot hear the trainee, at every threshold tried', () => {
    for (const row of table) {
      expect(row.triggeredByLeak || !row.hearsSoftTrainee).toBe(true);
    }
    // Both failures are real: the shipped threshold hears everyone, leak included, and a threshold
    // high enough to ignore the leak is deaf to the quiet trainee.
    expect(table[0]).toMatchObject({ hearsSoftTrainee: true, triggeredByLeak: true });
    expect(table.some((row) => !row.triggeredByLeak && !row.hearsSoftTrainee)).toBe(true);
  });
});

describe('so the customer is never stopped by sound, and the microphone is shut while they speak', () => {
  let env: FakeEnv;
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    env.uninstall();
    vi.useRealTimers();
  });

  const settle = async () => {
    for (let i = 0; i < 6; i++) await Promise.resolve();
    await vi.advanceTimersByTimeAsync(0);
  };
  const spoken: SpokenTurn = {
    audio: new Blob(['audio']),
    contentType: 'audio/mpeg',
    provider: 'mock',
    voice: 'mock-voice',
    style: 'none',
  };
  const request: PlayRequest = {
    sessionId: 'session-12345678',
    turnIndex: 2,
    text: 'I have been waiting three weeks.',
    language: 'en-GB',
    mood: 'frustrated',
    voiceSeed: 'Alex Morgan',
  };
  const handlers = (log: string[]): CaptureHandlers => ({
    onListening: () => log.push('listening'),
    onSpeechStart: () => log.push('speech-start'),
    onSpeechEnd: () => log.push('speech-end'),
    onSpeechDropped: () => log.push('dropped'),
    onInterim: () => undefined,
    onAudio: () => log.push('audio'),
    onText: () => undefined,
    onNothing: () => log.push('nothing'),
    onFailure: () => log.push('failure'),
    onBlocked: () => log.push('blocked'),
  });

  it("without the gate, a leak of the customer's voice makes a turn out of the customer's own words", async () => {
    env = installFakes();
    const microphone = await acquireMicrophone({ worklet: true });
    const log: string[] = [];
    createServerCapture({ microphone }).listen(handlers(log));
    await settle();
    // The customer is speaking, and the speakers feed it back into the open microphone.
    env.audio.feed(inRoom(speechLike(2500, 0.04)));
    env.audio.feed(silence(2000, RATE));
    expect(log).toEqual(['listening', 'speech-start', 'speech-end', 'audio']);
    microphone.release();
  });

  it('with the gate, nothing listens while the customer speaks, so there is no leak to hear', async () => {
    env = installFakes();
    const gate = createTurnGate();
    const microphone = await acquireMicrophone({ worklet: true });
    const capture = guardCapture(createServerCapture({ microphone }), gate);
    const playback = gatePlayback(createServerPlayback({ speakTurn: async () => spoken }), gate);

    const customer: string[] = [];
    const job = playback.play(request, {
      onStart: () => customer.push('start'),
      onDuration: () => undefined,
      onEnd: () => customer.push('end'),
      onBlocked: () => customer.push('blocked'),
      onFailure: (kind) => customer.push(`failure:${kind}`),
      onLevel: () => undefined,
      onDetails: () => undefined,
    });
    await settle();
    expect(customer).toEqual(['start']);

    const log: string[] = [];
    capture.listen(handlers(log));
    await settle();
    // The microphone stays shut, and the same leak, fed to where the worklet would be, is not heard.
    env.audio.feed(inRoom(speechLike(2500, 0.08)));
    env.audio.feed(silence(2000, RATE));
    expect(log).toEqual(['blocked']);
    expect(env.audio.listeningWorklets()).toHaveLength(0);
    // The customer was not stopped by any of it.
    expect(customer).toEqual(['start']);
    expect(env.element.playing()).toHaveLength(1);

    // The trainee can stop the customer whenever they choose, by the control and not by sound.
    expect(job.stop()).toMatchObject({ interrupted: true });
    expect(env.element.playing()).toHaveLength(0);
    microphone.release();
    playback.dispose();
  });
});

describe('nothing in the voice layer can connect a sound to stopping the customer', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const read = (folder: string) => {
    const directory = join(here, folder);
    return readdirSync(directory)
      .filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'))
      .map((name) => ({ name, source: readFileSync(join(directory, name), 'utf8') }));
  };
  const importsOf = (source: string) =>
    [...source.matchAll(/from\s+'([^']+)'/g)].map((match) => match[1] as string);

  it('keeps the detector and the microphone away from playback', () => {
    const files = read('capture');
    expect(files.length).toBeGreaterThanOrEqual(5);
    for (const { name, source } of files) {
      for (const path of importsOf(source)) {
        expect(path, `capture/${name} imports ${path}`).not.toMatch(/playback|turn-taking/);
      }
    }
  });

  it('lets playback use only the capture helpers that measure and encode, never the detector', () => {
    const allowed = new Set(['../capture/levels.ts', '../capture/wav.ts']);
    const uses = read('playback').flatMap(({ name, source }) =>
      importsOf(source)
        .filter((value) => value.includes('capture'))
        .map((path) => ({ name, path })),
    );
    // The scan finds something to check.
    expect(uses.length).toBeGreaterThan(0);
    for (const { name, path } of uses) {
      expect(allowed.has(path), `playback/${name} imports ${path}`).toBe(true);
    }
  });
});
