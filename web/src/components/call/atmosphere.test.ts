import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { PublicStateDTO } from '#shared/domain/api.ts';
import {
  CURVEBALL_LABELS,
  PRACTICE_MODES,
  TEMPERATURE_BANDS,
  type PracticeMode,
  type TemperatureBandId,
} from '#shared/domain/vocab.ts';
import {
  atmosphereFor,
  CUES_OFF_STATUS,
  cueLevelFor,
  DISCOVERY_COPY,
  EASING_ENERGY_CAP,
  MOOD_ATMOSPHERE,
  SHIFT_COPY,
  shiftAnnouncement,
  type Atmosphere,
} from './atmosphere.ts';
import type { ChatShift } from './useCall.ts';

const TRENDS: readonly PublicStateDTO['trend'][] = ['rising', 'steady', 'falling'];

function state(
  band: TemperatureBandId = 'calm',
  trend: PublicStateDTO['trend'] = 'steady',
  silent = false,
): PublicStateDTO {
  const label = TEMPERATURE_BANDS.find((candidate) => candidate.id === band)?.label ?? band;
  return { band: { id: band, label }, trend, discoveredCount: 0, silent, shifts: 0 };
}

const numbers = ({ tension, open, warmth, energy }: Atmosphere) => [tension, open, warmth, energy];

/** tension, open, warmth, energy: the numbers the design calls for, written out once more. */
const SPEC: Record<TemperatureBandId, number[]> = {
  calm: [0.08, 1, 0.42, 0.22],
  concerned: [0.3, 0.8, 0.55, 0.36],
  frustrated: [0.56, 0.58, 0.74, 0.52],
  angry: [0.8, 0.36, 0.86, 0.66],
  escalating: [0.94, 0.24, 0.92, 0.74],
};

describe('cue level', () => {
  it('shows every cue in guided practice and none in immersive practice', () => {
    expect(cueLevelFor('guided')).toBe('full');
    expect(cueLevelFor('immersive')).toBe('none');
    expect(PRACTICE_MODES.map((mode) => cueLevelFor(mode))).toEqual(['none', 'full']);
  });

  it('shows nothing for a mode it does not know', () => {
    expect(cueLevelFor('mystery' as PracticeMode)).toBe('none');
  });
});

describe('atmosphere with full cues', () => {
  it('uses the numbers of each band', () => {
    for (const { id } of TEMPERATURE_BANDS) {
      expect(numbers(atmosphereFor(state(id), 'full')), id).toEqual(SPEC[id]);
      expect(MOOD_ATMOSPHERE[id], id).toEqual({
        tension: SPEC[id]?.[0],
        open: SPEC[id]?.[1],
        warmth: SPEC[id]?.[2],
        energy: SPEC[id]?.[3],
      });
    }
  });

  it('names the band and passes the trend and silence through', () => {
    const frustrated = atmosphereFor(state('frustrated', 'rising'), 'full');
    expect(frustrated).toMatchObject({
      mood: 'frustrated',
      trend: 'rising',
      label: 'Frustrated',
      silent: false,
    });
    expect(atmosphereFor(state('angry', 'steady', true), 'full')).toMatchObject({
      mood: 'angry',
      silent: true,
    });
  });

  it('slows the room while the customer eases, and changes nothing else about it', () => {
    for (const { id } of TEMPERATURE_BANDS) {
      const base = atmosphereFor(state(id, 'steady'), 'full');
      const rising = atmosphereFor(state(id, 'rising'), 'full');
      const easing = atmosphereFor(state(id, 'falling'), 'full');
      expect(rising.energy, id).toBe(base.energy);
      expect(easing.energy, id).toBe(Math.min(base.energy, EASING_ENERGY_CAP));
      expect(easing.energy, id).toBe(0.2);
      expect([easing.tension, easing.open, easing.warmth], id).toEqual([
        base.tension,
        base.open,
        base.warmth,
      ]);
    }
  });

  it('is recovering only while easing back from a mood that is not calm', () => {
    for (const { id } of TEMPERATURE_BANDS) {
      for (const trend of TRENDS) {
        const expected = trend === 'falling' && id !== 'calm';
        expect(atmosphereFor(state(id, trend), 'full').recovering, `${id} ${trend}`).toBe(expected);
      }
    }
  });

  it('always says the mood in words', () => {
    expect(atmosphereFor(state('frustrated', 'rising'), 'full').status).toBe(
      'Customer mood: Frustrated, rising.',
    );
    expect(atmosphereFor(state('calm', 'steady'), 'full').status).toBe('Customer mood: Calm.');
    expect(atmosphereFor(state('concerned', 'falling'), 'full').status).toBe(
      'Customer mood: Concerned, easing.',
    );
    for (const { id, label } of TEMPERATURE_BANDS) {
      for (const trend of TRENDS) {
        const status = atmosphereFor(state(id, trend), 'full').status;
        expect(status, `${id} ${trend}`).toMatch(new RegExp(`^Customer mood: ${label}\\b.*\\.$`));
      }
    }
  });

  it('adds that the customer has gone quiet', () => {
    expect(atmosphereFor(state('calm', 'steady', true), 'full').status).toBe(
      'Customer mood: Calm. The customer has gone quiet.',
    );
    expect(atmosphereFor(state('frustrated', 'rising', true), 'full').status).toBe(
      'Customer mood: Frustrated, rising. The customer has gone quiet.',
    );
  });

  it('does not break on a band it does not know', () => {
    const odd = { ...state(), band: { id: 'constructor' as TemperatureBandId, label: 'Odd' } };
    const atmosphere = atmosphereFor(odd, 'full');
    expect(atmosphere).toMatchObject({ mood: 'neutral', label: 'Odd' });
    expect(numbers(atmosphere)).toEqual(SPEC.calm);
    expect(atmosphere.status).toBe('Customer mood: Odd.');
  });
});

describe('atmosphere with no cues', () => {
  const quiet: Atmosphere = {
    mood: 'neutral',
    trend: 'steady',
    tension: 0.08,
    open: 1,
    warmth: 0.42,
    energy: 0.22,
    recovering: false,
    silent: false,
    label: '',
    status: 'Customer mood cues are off in immersive practice.',
  };

  it('is the calm room with no label, and no word of what is going on', () => {
    expect(atmosphereFor(state('angry', 'rising', true), 'none')).toEqual(quiet);
    expect(CUES_OFF_STATUS).toBe(quiet.status);
  });

  it('is the same whatever the customer is doing', () => {
    for (const { id } of TEMPERATURE_BANDS) {
      for (const trend of TRENDS) {
        for (const silent of [false, true]) {
          expect(atmosphereFor(state(id, trend, silent), 'none'), `${id} ${trend}`).toEqual(quiet);
        }
      }
    }
  });

  it('never leaks the band, the trend or silence anywhere in what it returns', () => {
    const giveaways = [
      ...TEMPERATURE_BANDS.flatMap((band) => [band.id, band.label.toLowerCase()]),
      'rising',
      'falling',
      'easing',
      'quiet',
    ];
    for (const { id } of TEMPERATURE_BANDS) {
      const text = JSON.stringify(atmosphereFor(state(id, 'rising', true), 'none')).toLowerCase();
      for (const word of giveaways) expect(text, `${id} / ${word}`).not.toContain(word);
    }
  });

  it('hands out a fresh object each time, so one screen cannot change another', () => {
    const first = atmosphereFor(state(), 'none');
    first.tension = 1;
    first.status = 'changed';
    expect(atmosphereFor(state(), 'none')).toEqual(quiet);
  });
});

describe('copy', () => {
  it('has the words for a signal and for a shift', () => {
    expect(DISCOVERY_COPY).toEqual({ label: 'Signal found', announcement: 'A signal was found.' });
    expect(SHIFT_COPY).toEqual({
      curveball: 'The conversation changed.',
      silent: 'The customer has gone quiet.',
    });
  });

  it('says nothing of what a curveball was', () => {
    const giveaways = Object.values(CURVEBALL_LABELS)
      .flatMap(({ label }) => label.toLowerCase().match(/[a-z]{5,}/g) ?? [])
      .filter((word) => word !== 'quiet');
    expect(giveaways.length).toBeGreaterThan(5);
    for (const word of giveaways) {
      expect(SHIFT_COPY.curveball.toLowerCase(), word).not.toContain(word);
      expect(DISCOVERY_COPY.announcement.toLowerCase(), word).not.toContain(word);
    }
  });
});

describe('shift announcements', () => {
  const band = (direction?: ChatShift['direction']): ChatShift => ({
    afterKey: 't3',
    kind: 'band',
    from: { id: 'calm', label: 'Calm' },
    to: { id: 'angry', label: 'Angry' },
    direction,
  });
  const silent: ChatShift = { afterKey: 't3', kind: 'silent' };
  const curveball: ChatShift = { afterKey: 't3', kind: 'curveball' };

  it('says who got more tense or calmer, without naming the moods', () => {
    expect(shiftAnnouncement(band('tenser'), 'Maya', 'full')).toBe('Maya is more tense.');
    expect(shiftAnnouncement(band('calmer'), 'Maya', 'full')).toBe('Maya is calmer.');
    expect(shiftAnnouncement(band('tenser'), 'Maya', 'full')).not.toMatch(/calm|angry/i);
    expect(shiftAnnouncement(band(), 'Maya', 'full')).toBe("Maya's mood changed.");
  });

  it('speaks of the customer when no name is given', () => {
    expect(shiftAnnouncement(band('calmer'), '  ', 'full')).toBe('The customer is calmer.');
    expect(shiftAnnouncement(band(), '', 'full')).toBe("The customer's mood changed.");
  });

  it('says only that the customer went quiet, or that the conversation changed', () => {
    expect(shiftAnnouncement(silent, 'Maya', 'full')).toBe('The customer has gone quiet.');
    expect(shiftAnnouncement(curveball, 'Maya', 'full')).toBe('The conversation changed.');
  });

  it('gives the same words for a curveball whatever else is attached to it', () => {
    const loaded = {
      ...curveball,
      from: { id: 'calm', label: 'Calm' },
      to: { id: 'escalating', label: 'Escalating' },
      direction: 'tenser',
    } as ChatShift;
    for (const name of ['Maya', 'Ali Reza', '', 'The Manager Who Wants To Cancel']) {
      expect(shiftAnnouncement(curveball, name, 'full'), name).toBe(SHIFT_COPY.curveball);
      expect(shiftAnnouncement(loaded, name, 'full'), name).toBe(SHIFT_COPY.curveball);
    }
  });

  it('is silent when cues are off', () => {
    for (const shift of [band('tenser'), band('calmer'), band(), silent, curveball]) {
      expect(shiftAnnouncement(shift, 'Maya', 'none')).toBe('');
    }
  });
});

describe('tokens.css', () => {
  // The room is drawn by CSS from the same numbers. If the two ever drift, the room and what the
  // code believes about it disagree, so this reads the stylesheet itself.
  const tokens = readFileSync(
    resolve(dirname(fileURLToPath(import.meta.url)), '../../styles/tokens.css'),
    'utf8',
  );

  const block = (selector: string): Record<string, number> => {
    const escaped = selector.replace(/[[\]'.*+?^${}()|\\]/g, '\\$&');
    const match = new RegExp(`^${escaped}\\s*\\{([^}]*)\\}`, 'm').exec(tokens);
    if (!match) throw new Error(`tokens.css has no ${selector} block`);
    const found: Record<string, number> = {};
    for (const [, name, value] of (match[1] ?? '').matchAll(
      /--atm-(tension|open|warmth|energy):\s*([\d.]+)\s*;/g,
    )) {
      found[name as string] = Number(value);
    }
    return found;
  };

  it('has a block for every band, and for no other', () => {
    const declared = [...tokens.matchAll(/^\[data-mood='([\w-]+)'\]\s*\{/gm)].map(
      (match) => match[1],
    );
    expect(declared.sort()).toEqual(TEMPERATURE_BANDS.map((band) => band.id).sort());
  });

  it('gives each band the same four numbers as the code', () => {
    for (const { id } of TEMPERATURE_BANDS) {
      expect(block(`[data-mood='${id}']`), id).toEqual(MOOD_ATMOSPHERE[id]);
    }
  });

  it('starts every room as the calm one, which is also the room with no cues', () => {
    const [tension, open, warmth, energy] = numbers(atmosphereFor(state('angry'), 'none'));
    expect(block('[data-mood]')).toEqual({ tension, open, warmth, energy });
    expect(block('[data-mood]')).toEqual(MOOD_ATMOSPHERE.calm);
  });

  it('slows the room by the same amount while the customer eases', () => {
    expect(block("[data-mood][data-trend='falling']")).toEqual({ energy: EASING_ENERGY_CAP });
  });
});
