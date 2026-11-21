import { describe, expect, it } from 'vitest';
import { createVad, VAD_DEFAULTS, type VadEvent } from './vad.ts';
import { CAPTURE_TUNING } from './tuning.ts';
import { blocks, concat, noise, silence, sine, syllables } from '../testing/signals.ts';

const RATE = 16000;

interface Timed {
  atMs: number;
  event: VadEvent;
}

/** Feeds audio in small blocks and records when (in stream time) each event came out. */
function run(
  vad: ReturnType<typeof createVad>,
  audio: Float32Array,
  rate = RATE,
  blockSize = 160,
): Timed[] {
  const out: Timed[] = [];
  let seen = 0;
  for (const block of blocks(audio, blockSize)) {
    seen += block.length;
    for (const event of vad.push(block)) out.push({ atMs: (seen / rate) * 1000, event });
  }
  return out;
}

const types = (events: Timed[]) => events.map((entry) => entry.event.type);
const utterances = (events: Timed[]) =>
  events.flatMap((entry) => (entry.event.type === 'utterance' ? [entry.event] : []));
const dropped = (events: Timed[]) =>
  events.flatMap((entry) => (entry.event.type === 'dropped' ? [entry.event.reason] : []));

describe('createVad', () => {
  it('stays quiet for silence and for a quiet room', () => {
    const vad = createVad({ sampleRate: RATE });
    expect(run(vad, concat(silence(2000, RATE), noise(2000, RATE, 0.002)))).toEqual([]);
    expect(vad.speaking).toBe(false);
  });

  it('starts speech after about 120 ms above the threshold', () => {
    const vad = createVad({ sampleRate: RATE });
    const events = run(vad, concat(silence(600, RATE), sine(400, RATE)));
    const start = events.find((entry) => entry.event.type === 'speech-start');
    expect(start).toBeDefined();
    // The tone begins at 600 ms.
    expect((start?.atMs ?? 0) - 600).toBeGreaterThanOrEqual(110);
    expect((start?.atMs ?? 0) - 600).toBeLessThanOrEqual(150);
  });

  it('ends the utterance after the end-of-turn silence, keeping a short tail', () => {
    const vad = createVad({ sampleRate: RATE });
    const events = run(vad, concat(silence(600, RATE), sine(1000, RATE), silence(2500, RATE)));
    expect(types(events)).toEqual(['speech-start', 'utterance']);
    const end = events[1] as Timed;
    // Speech ends at 1600 ms; the utterance is complete one end-of-turn silence (1.4 s) later.
    expect(VAD_DEFAULTS.endSilenceMs).toBe(CAPTURE_TUNING.endpointSilenceMs);
    expect(end.atMs - 1600).toBeGreaterThanOrEqual(CAPTURE_TUNING.endpointSilenceMs - 40);
    expect(end.atMs - 1600).toBeLessThanOrEqual(CAPTURE_TUNING.endpointSilenceMs + 80);
    const utterance = utterances(events)[0];
    expect(utterance?.reason).toBe('silence');
    expect(utterance?.speechMs).toBeGreaterThanOrEqual(980);
    // 300 ms before + 1000 ms of speech + 300 ms of tail.
    expect(utterance?.durationMs).toBeGreaterThanOrEqual(1580);
    expect(utterance?.durationMs).toBeLessThanOrEqual(1640);
  });

  it('keeps 300 ms from before the speech so the first word is not clipped', () => {
    const vad = createVad({ sampleRate: RATE });
    const audio = concat(silence(1000, RATE), sine(800, RATE, 0.4), silence(1500, RATE));
    const utterance = utterances(run(vad, audio))[0];
    expect(utterance).toBeDefined();
    const samples = utterance?.samples as Float32Array;
    const onset = samples.findIndex((value) => Math.abs(value) > 0.05);
    expect((onset / RATE) * 1000).toBeGreaterThanOrEqual(290);
    expect((onset / RATE) * 1000).toBeLessThanOrEqual(320);
    // And the whole of the tone is there: the onset is not eaten by the 120 ms it took to notice it.
    const loud = samples.filter((value) => Math.abs(value) > 0.05).length;
    expect(loud).toBeGreaterThan(RATE * 0.8 * 0.55);
  });

  it('drops an utterance shorter than 400 ms', () => {
    const vad = createVad({ sampleRate: RATE });
    const events = run(vad, concat(silence(500, RATE), sine(250, RATE), silence(2000, RATE)));
    expect(types(events)).toEqual(['speech-start', 'dropped']);
    expect(dropped(events)).toEqual(['too-short']);
  });

  it('does not count a 100 ms click as speech at all', () => {
    const vad = createVad({ sampleRate: RATE });
    expect(run(vad, concat(silence(500, RATE), sine(100, RATE), silence(2000, RATE)))).toEqual([]);
  });

  it('drops an utterance that is only low-level noise', () => {
    const vad = createVad({ sampleRate: RATE });
    const events = run(
      vad,
      concat(silence(500, RATE), noise(900, RATE, 0.01), silence(2000, RATE)),
    );
    expect(dropped(events)).toEqual(['low-level']);
    expect(utterances(events)).toHaveLength(0);
  });

  it('cuts a very long utterance at 30 s, emits it, and carries on listening', () => {
    const vad = createVad({ sampleRate: RATE });
    const events = run(
      vad,
      concat(silence(400, RATE), sine(35_000, RATE), silence(2000, RATE)),
      RATE,
      1600,
    );
    const heard = utterances(events);
    expect(heard.map((entry) => entry.reason)).toEqual(['limit', 'silence']);
    expect(heard[0]?.durationMs).toBeLessThanOrEqual(30_000);
    expect(heard[0]?.durationMs).toBeGreaterThan(29_900);
    // The rest of the speech is in the second utterance, nothing is lost or repeated.
    expect(heard[1]?.speechMs).toBeGreaterThan(4000);
    expect(types(events).filter((type) => type === 'speech-start')).toHaveLength(1);
  });

  it('follows the noise floor: a steady noisy room is not speech, but speech over it is', () => {
    const vad = createVad({ sampleRate: RATE });
    const room = noise(3000, RATE, 0.02, 7);
    expect(run(vad, room)).toEqual([]);
    expect(vad.noiseFloor).toBeGreaterThan(0.005);
    const events = run(vad, concat(sine(900, RATE, 0.4), noise(2000, RATE, 0.02, 9)));
    expect(utterances(events)).toHaveLength(1);
  });

  it('adapts to a quieter room too, so soft speech is still heard', () => {
    const vad = createVad({ sampleRate: RATE });
    run(vad, noise(1500, RATE, 0.0005, 3));
    expect(vad.noiseFloor).toBeLessThan(0.002);
    const events = run(vad, concat(sine(900, RATE, 0.03), silence(2000, RATE)));
    expect(utterances(events)).toHaveLength(1);
  });

  it('does not split one sentence at the small dips between syllables', () => {
    const vad = createVad({ sampleRate: RATE });
    const events = run(vad, concat(silence(500, RATE), syllables(2500, RATE), silence(2000, RATE)));
    expect(types(events)).toEqual(['speech-start', 'utterance']);
    expect(utterances(events)[0]?.speechMs).toBeGreaterThan(2300);
  });

  it('keeps two sentences apart when the pause between them is long enough', () => {
    const vad = createVad({ sampleRate: RATE });
    const pause = CAPTURE_TUNING.endpointSilenceMs + 200;
    const audio = concat(
      silence(500, RATE),
      sine(800, RATE),
      silence(pause, RATE),
      sine(800, RATE),
      silence(pause, RATE),
    );
    expect(utterances(run(vad, audio))).toHaveLength(2);
  });

  it('does not end the turn at a pause to think: a 1.2 s hesitation stays one utterance', () => {
    const vad = createVad({ sampleRate: RATE });
    const audio = concat(
      silence(500, RATE),
      sine(900, RATE),
      silence(1200, RATE),
      sine(900, RATE),
      silence(2500, RATE),
    );
    const events = run(vad, audio);
    expect(types(events)).toEqual(['speech-start', 'utterance']);
    // Both halves and the hesitation between them are in the one utterance.
    expect(utterances(events)[0]?.speechMs).toBeGreaterThan(900 + 1200 + 900 - 60);
  });

  it('drops scattered bursts that add up to less than the voiced minimum', () => {
    const vad = createVad({ sampleRate: RATE });
    // A 140 ms burst starts speech and 100 ms more comes later: 240 ms voiced in a 440 ms stretch.
    const audio = concat(
      silence(500, RATE),
      sine(140, RATE),
      silence(200, RATE),
      sine(100, RATE),
      silence(2500, RATE),
    );
    const events = run(vad, audio);
    expect(dropped(events)).toEqual(['too-short']);
    expect(utterances(events)).toHaveLength(0);
    expect(CAPTURE_TUNING.minVoicedMs).toBe(250);
  });

  it('keeps speech with gaps in it once enough of it is voiced', () => {
    const vad = createVad({ sampleRate: RATE });
    const audio = concat(
      silence(500, RATE),
      sine(160, RATE),
      silence(200, RATE),
      sine(200, RATE),
      silence(2500, RATE),
    );
    const heard = utterances(run(vad, audio));
    expect(heard).toHaveLength(1);
    expect(heard[0]?.speechMs).toBeGreaterThanOrEqual(540);
  });

  it('ends the utterance at once on flush, and has nothing to flush when idle', () => {
    const vad = createVad({ sampleRate: RATE });
    expect(vad.flush()).toEqual([]);
    run(vad, concat(silence(500, RATE), sine(1000, RATE)));
    expect(vad.speaking).toBe(true);
    const flushed = vad.flush();
    expect(flushed.map((event) => event.type)).toEqual(['utterance']);
    expect(flushed[0]).toMatchObject({ reason: 'flush' });
    expect(vad.speaking).toBe(false);
    expect(vad.flush()).toEqual([]);
  });

  it('gives the same result however the audio is cut into blocks', () => {
    const audio = concat(silence(700, RATE), syllables(1800, RATE), silence(1800, RATE));
    const shape = (size: number) =>
      run(createVad({ sampleRate: RATE }), audio, RATE, size).map((entry) =>
        entry.event.type === 'utterance'
          ? { ...entry.event, samples: entry.event.samples.length }
          : entry.event,
      );
    expect(shape(128)).toEqual(shape(1000));
    expect(shape(128)).toEqual(shape(333));
  });

  it('works at the rates browsers use', () => {
    for (const rate of [48000, 44100, 16000, 8000]) {
      const vad = createVad({ sampleRate: rate });
      const events = run(
        vad,
        concat(silence(600, rate), sine(1000, rate, 0.3, 300), silence(2000, rate)),
        rate,
        Math.round(rate / 100),
      );
      expect(types(events)).toEqual(['speech-start', 'utterance']);
      const utterance = utterances(events)[0];
      expect(utterance?.sampleRate).toBe(rate);
      expect(utterance?.durationMs).toBeGreaterThan(1500);
      expect(utterance?.durationMs).toBeLessThan(1700);
    }
  });

  it('can be tuned, and forgets everything on reset', () => {
    const vad = createVad({ sampleRate: RATE, endSilenceMs: 400, minUtteranceMs: 100 });
    const events = run(vad, concat(silence(500, RATE), sine(300, RATE), silence(900, RATE)));
    expect(types(events)).toEqual(['speech-start', 'utterance']);
    run(vad, noise(1000, RATE, 0.02));
    vad.reset();
    expect(vad.speaking).toBe(false);
    expect(vad.noiseFloor).toBeLessThan(0.001);
  });
});
