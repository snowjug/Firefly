import { describe, expect, it } from 'vitest';
import { TEMPERATURE_BANDS } from '#shared/domain/vocab.ts';
import { fakeVoice } from '../testing/fakes.ts';
import { deliveryFor, normaliseLang, pickVoice, rankVoice } from './voices.ts';

const SEEDS = ['Alex Morgan', 'Sam Patel', 'Dana Wu', 'Marcus Reid', 'Priya Nair', 'Lee Chen'];

describe('pickVoice', () => {
  const local = [
    fakeVoice('Local English (United States)', 'en-US', true, true),
    fakeVoice('Local English (United Kingdom) A', 'en-GB', true),
    fakeVoice('Local English (United Kingdom) B', 'en-GB', true),
    fakeVoice('Local Fran\u00e7ais', 'fr-FR', true),
  ];

  it('only considers voices in the requested language', () => {
    for (const seed of SEEDS) {
      expect(pickVoice(local, seed, 'en-GB')?.lang).toBe('en-GB');
    }
    expect(pickVoice([fakeVoice('Voix', 'fr-FR')], 'x', 'en-GB')).toBeNull();
    expect(pickVoice([], 'x', 'en-GB')).toBeNull();
  });

  it('prefers a voice for the exact region, then falls back to any English one', () => {
    expect(pickVoice([fakeVoice('US only', 'en-US')], 'x', 'en-GB')?.name).toBe('US only');
    expect(pickVoice(local, 'x', 'en-US')?.name).toBe('Local English (United States)');
  });

  it('falls back from the language chosen to any English voice, whatever its region, and only then to none', () => {
    // The five voices a Windows browser lists: none of them for en-GB.
    const windows = [
      fakeVoice('Microsoft David - English (United States)', 'en-US', true),
      fakeVoice('Microsoft Ravi - English (India)', 'en-IN', true),
      fakeVoice('Microsoft Heera - English (India)', 'en-IN', true),
      fakeVoice('Microsoft Mark - English (United States)', 'en-US', true),
      fakeVoice('Microsoft Zira - English (United States)', 'en-US', true),
    ];
    for (const seed of SEEDS) {
      expect(windows).toContain(pickVoice(windows, seed, 'en-GB'));
      expect(windows).toContain(pickVoice(windows, seed, 'en-AU'));
    }
    // The browser's default voice is preferred among equals.
    const withDefault = windows.map((voice) =>
      voice.name.includes('Zira') ? { ...voice, default: true } : voice,
    ) as SpeechSynthesisVoice[];
    for (const seed of SEEDS) {
      expect(pickVoice(withDefault, seed, 'en-GB')?.name).toMatch(/Zira/);
    }
    // No English voice at all: none is chosen, and the browser speaks with its own default.
    expect(
      pickVoice([fakeVoice('Microsoft Hortense - French (France)', 'fr-FR')], 'x', 'en-GB'),
    ).toBeNull();
  });

  it('prefers natural and online voices when the browser offers them', () => {
    const natural = fakeVoice('Online Natural English (United Kingdom)', 'en-GB', false);
    const online = fakeVoice('Plain English (United Kingdom)', 'en-GB', false);
    for (const seed of SEEDS) {
      expect(pickVoice([...local, online, natural], seed, 'en-GB')?.name).toBe(natural.name);
      expect(pickVoice([...local, online], seed, 'en-GB')?.name).toBe(online.name);
    }
  });

  it('chooses from the features of a voice, never from its name', () => {
    const renamed = fakeVoice('Zzz Quiet Voice', 'en-GB', false);
    const quality = fakeVoice('Premium Zzz', 'en-GB', true);
    expect(rankVoice(quality, 'en-GB')).toBeGreaterThan(
      rankVoice(fakeVoice('Zzz', 'en-GB', true), 'en-GB'),
    );
    expect(rankVoice(renamed, 'en-GB')).toBeGreaterThan(
      rankVoice(fakeVoice('Zzz', 'en-GB', true), 'en-GB'),
    );
  });

  it("ranks the system's old speech-synthesis voices below the voices meant for real use", () => {
    const classic = {
      ...fakeVoice('Whatever', 'en-US', true, true),
      voiceURI: 'com.apple.speech.synthesis.voice.Whatever',
    };
    const modern = {
      ...fakeVoice('Samantha', 'en-US', true),
      voiceURI: 'com.apple.voice.compact.en-US.Samantha',
    };
    for (const seed of SEEDS) expect(pickVoice([classic, modern], seed, 'en-US')).toBe(modern);
  });

  it('gives one customer one voice, whatever order the browser lists them in', () => {
    const chosen = SEEDS.map((seed) => pickVoice(local, seed, 'en-GB')?.name);
    expect(SEEDS.map((seed) => pickVoice([...local].reverse(), seed, 'en-GB')?.name)).toEqual(
      chosen,
    );
    expect(new Set(chosen).size).toBeGreaterThan(1);
  });

  it('understands the underscore Android uses in language tags', () => {
    expect(normaliseLang('en_GB')).toBe('en-gb');
    expect(pickVoice([fakeVoice('English United Kingdom', 'en_GB')], 'x', 'en-GB')?.name).toBe(
      'English United Kingdom',
    );
  });
});

describe('deliveryFor', () => {
  it('delivers a tenser mood a little faster and higher, within safe limits', () => {
    const rates = TEMPERATURE_BANDS.map((band) => deliveryFor(band.id, 'Alex Morgan').rate);
    expect(rates).toEqual([0.96, 1, 1.05, 1.1, 1.14]);
    for (const seed of SEEDS) {
      const pitches = TEMPERATURE_BANDS.map((band) => deliveryFor(band.id, seed).pitch);
      expect(pitches[0]).toBeGreaterThanOrEqual(0.92);
      expect(pitches[0]).toBeLessThanOrEqual(1.1 + 1e-9);
      expect(pitches).toEqual([...pitches].sort((a, b) => a - b));
      expect(Math.max(...pitches)).toBeLessThanOrEqual(1.2);
      expect(deliveryFor('calm', seed)).toEqual(deliveryFor('calm', seed));
    }
  });
});
