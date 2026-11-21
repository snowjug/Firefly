import { describe, expect, it } from 'vitest';
import { VOICE_IDS, voiceChoice, type VoiceId } from '#shared/domain/voices.ts';
import { TEMPERATURE_BANDS } from '#shared/domain/vocab.ts';
import { fakeVoice } from '../testing/fakes.ts';
import {
  deliveryFor,
  describeBrowserVoices,
  normaliseLang,
  pickVoice,
  pickVoiceForChoice,
  rankVoice,
} from './voices.ts';

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

  it("with a chosen voice, leaves the pitch plain and adds only the voice's own small pace", () => {
    for (const band of TEMPERATURE_BANDS) {
      const plain = deliveryFor(band.id, 'Alex Morgan');
      const chosen = VOICE_IDS.map((voice) => deliveryFor(band.id, 'Alex Morgan', voice));
      // The same customer seed does not change what a chosen voice sounds like.
      expect(chosen).toEqual(VOICE_IDS.map((voice) => deliveryFor(band.id, 'Sam Patel', voice)));
      chosen.forEach((delivery, index) => {
        const pace = voiceChoice(VOICE_IDS[index] as VoiceId).paceDelta;
        expect(delivery.rate).toBeCloseTo(plain.rate * (1 + pace / 100), 5);
        expect(delivery.pitch).toBeLessThanOrEqual(1.2);
        expect(delivery.pitch).toBeGreaterThanOrEqual(1);
      });
    }
    // Restrained: no choice is more than a few percent from the mood's own pace, and never theatrical.
    for (const voice of VOICE_IDS) {
      const { rate } = deliveryFor('escalating', 'x', voice);
      expect(rate).toBeLessThanOrEqual(1.3);
      expect(rate).toBeGreaterThanOrEqual(0.8);
    }
  });
});

describe('pickVoiceForChoice', () => {
  const four = [
    fakeVoice('Voice One (United Kingdom)', 'en-GB', true),
    fakeVoice('Voice Two (United Kingdom)', 'en-GB', true),
    fakeVoice('Voice Three (United Kingdom)', 'en-GB', true),
    fakeVoice('Voice Four (United Kingdom)', 'en-GB', true),
  ];

  it('gives every choice a voice of its own when the browser has four of the same standing', () => {
    const picked = VOICE_IDS.map((id) => pickVoiceForChoice(four, id, 'en-GB')?.name);
    expect(new Set(picked).size).toBe(4);
  });

  it('shares voices when there are fewer than four, and uses the one voice there is for all', () => {
    const two = four.slice(0, 2);
    const picked = VOICE_IDS.map((id) => pickVoiceForChoice(two, id, 'en-GB')?.name);
    expect(new Set(picked).size).toBe(2);
    const one = VOICE_IDS.map((id) => pickVoiceForChoice(four.slice(0, 1), id, 'en-GB')?.name);
    expect(new Set(one).size).toBe(1);
  });

  it('gives a choice the same voice whatever order the browser lists them in', () => {
    const reversed = [...four].reverse();
    for (const id of VOICE_IDS) {
      expect(pickVoiceForChoice(reversed, id, 'en-GB')).toBe(pickVoiceForChoice(four, id, 'en-GB'));
    }
  });

  it('deals only from the best voices in the language', () => {
    const online = fakeVoice('Online Natural English (United Kingdom)', 'en-GB', false);
    const plain = fakeVoice('Plain English (United Kingdom)', 'en-GB', true);
    const french = fakeVoice('Voix (France)', 'fr-FR', false);
    for (const id of VOICE_IDS) {
      expect(pickVoiceForChoice([plain, french, online], id, 'en-GB')).toBe(online);
    }
  });

  it('has no voice to give when the browser has none in the language', () => {
    expect(pickVoiceForChoice([fakeVoice('Voix', 'fr-FR')], 'voice-a', 'en-GB')).toBeNull();
    expect(pickVoiceForChoice([], 'voice-d', 'en-GB')).toBeNull();
  });
});

describe('describeBrowserVoices', () => {
  // All of the same standing (local, same language), so every one of them is dealt a choice.
  const voices = (count: number) =>
    Array.from({ length: count }, (_, index) =>
      fakeVoice(`English Voice ${index + 1} (United Kingdom)`, 'en-GB', true),
    );

  it('says nothing when the four choices really are four voices', () => {
    const report = describeBrowserVoices(voices(4), 'en-GB');
    expect(report).toMatchObject({ distinct: 4, tellApart: true, note: null });
    expect(report.choices.map((choice) => choice.id)).toEqual([...VOICE_IDS]);
    expect(new Set(report.choices.map((choice) => choice.name)).size).toBe(4);
    for (const choice of report.choices) expect(typeof choice.local).toBe('boolean');
  });

  it('says honestly when two or three voices are all the browser has', () => {
    const report = describeBrowserVoices(voices(2), 'en-GB');
    expect(report.distinct).toBe(2);
    expect(report.tellApart).toBe(false);
    expect(report.note).toMatch(/2 English voices/);
    expect(report.note).toMatch(/sound alike/);
  });

  it('says honestly when the browser has one English voice, and the choices differ only in pace', () => {
    const report = describeBrowserVoices(voices(1), 'en-GB');
    expect(report).toMatchObject({ distinct: 1, tellApart: false });
    expect(report.note).toMatch(/one English voice/);
    expect(report.note).toMatch(/pace/);
  });

  it('says honestly when it has none, and names no voice', () => {
    const report = describeBrowserVoices([fakeVoice('Voix', 'fr-FR')], 'en-GB');
    expect(report).toMatchObject({ distinct: 0, tellApart: false });
    expect(report.note).toMatch(/default voice/);
    expect(report.choices.every((choice) => choice.name === null && choice.local === null)).toBe(
      true,
    );
  });

  it('agrees with the voice that really speaks for each choice', () => {
    const list = voices(3);
    const report = describeBrowserVoices(list, 'en-GB');
    for (const choice of report.choices) {
      expect(choice.name).toBe(pickVoiceForChoice(list, choice.id, 'en-GB')?.name);
    }
  });
});
