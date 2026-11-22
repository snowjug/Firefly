import { describe, expect, it } from 'vitest';
import { DIMENSION_IDS } from '#shared/domain/vocab.ts';
import {
  BEATS,
  LOOP_MS,
  MAX_LOOPS,
  PREVIEW_EXAMPLES,
  WAVE_BARS,
  WAVE_IDLE,
  callStatus,
  finalFrame,
  frameAt,
  waveScales,
} from './preview-script.ts';

const TEAMS = PREVIEW_EXAMPLES[0] as (typeof PREVIEW_EXAMPLES)[number];
const words = (text: string) => text.trim().split(/\s+/).length;
const everyFiftyMs = Array.from({ length: LOOP_MS / 50 + 1 }, (_, index) => index * 50);

describe('the Teams call is the one the landing page promises, word for word', () => {
  it('is the first and default example', () => {
    expect(TEAMS.id).toBe('teams');
    expect(TEAMS.product).toBe('teams');
  });

  it('says exactly these three lines: customer, trainee, customer', () => {
    expect(TEAMS.lines.map(({ speaker, text }) => [speaker, text])).toEqual([
      ['customer', 'Good morning. Is this Microsoft support?'],
      ['trainee', "Yes, you've reached support. My name is Alex. How can I help today?"],
      ['customer', 'Our Teams meetings stopped working for external guests this morning.'],
    ]);
  });

  it('moves the customer from calm to concerned', () => {
    expect(TEAMS.states).toEqual(['calm', 'concerned']);
  });
});

describe.each(PREVIEW_EXAMPLES.map((example) => [example.tab, example] as const))(
  'the %s example',
  (_name, example) => {
    it('is a customer, a trainee and the customer again, each line short', () => {
      expect(example.lines.map((line) => line.speaker)).toEqual([
        'customer',
        'trainee',
        'customer',
      ]);
      for (const line of example.lines) {
        expect(words(line.text), line.text).toBeLessThanOrEqual(16);
      }
    });

    it('ends in a report of the first three skills, each with words from the trainee and a score from 1 to 5', () => {
      expect(example.report.map((row) => row.skill)).toEqual(DIMENSION_IDS.slice(0, 3));
      for (const row of example.report) {
        expect(Number.isInteger(row.score) && row.score >= 1 && row.score <= 5, row.skill).toBe(
          true,
        );
        expect(words(row.quote), row.quote).toBeLessThanOrEqual(12);
      }
    });

    it('cites trainee turns only: the customer speaks first, so they are even and in order', () => {
      const turns = example.report.map((row) => row.turn);
      expect(turns.every((turn) => turn % 2 === 0)).toBe(true);
      expect(turns).toEqual([...turns].sort((a, b) => a - b));
    });

    it('quotes the trainee word for word where the report points at the call it just showed', () => {
      const [opening] = example.report;
      const said = example.lines[1]?.text ?? '';
      expect(said, `${opening?.quote} is in "${said}"`).toContain(opening?.quote ?? '?');
    });

    it('has a customer who feels something different at the end than at the start', () => {
      expect(example.states[0]).not.toBe(example.states[1]);
    });
  },
);

describe('the examples as a set', () => {
  it('has three, each with a name for its tab and its own id', () => {
    expect(PREVIEW_EXAMPLES.map((example) => example.tab)).toEqual([
      'Teams',
      'Outlook',
      'Entra ID',
    ]);
    expect(new Set(PREVIEW_EXAMPLES.map((example) => example.id)).size).toBe(3);
  });
});

describe('the timeline', () => {
  it('is in order: a line appears, is spoken, and the next one follows', () => {
    const { lines } = BEATS;
    lines.forEach(({ appear, speak: [from, to] }, index) => {
      expect(appear, `line ${index + 1} appears before it is spoken`).toBeLessThan(from);
      expect(from).toBeLessThan(to);
      if (index > 0)
        expect(lines[index - 1]?.speak[1], 'no two lines overlap').toBeLessThan(appear);
    });
  });

  it('ends the call after the last line, then shows the report, its quotes and, last, its scores', () => {
    const lastSpoken = BEATS.lines[2].speak[1];
    expect(BEATS.end).toBeGreaterThan(lastSpoken);
    expect(BEATS.report).toBeGreaterThanOrEqual(BEATS.end);
    expect(Math.min(...BEATS.quotes)).toBeGreaterThan(BEATS.report);
    expect(Math.min(...BEATS.scores)).toBeGreaterThan(Math.max(...BEATS.quotes));
    expect([...BEATS.quotes]).toEqual([...BEATS.quotes].sort((a, b) => a - b));
    expect([...BEATS.scores]).toEqual([...BEATS.scores].sort((a, b) => a - b));
  });

  it('leaves the last frame on screen for at least a second before the loop starts again', () => {
    expect(LOOP_MS - Math.max(...BEATS.scores)).toBeGreaterThanOrEqual(1000);
  });

  it('plays three loops and then rests', () => {
    expect(MAX_LOOPS).toBe(3);
  });
});

describe('frameAt', () => {
  it('starts with a customer who has not spoken yet: nothing shown, nobody speaking, calm and quiet', () => {
    expect(frameAt(TEAMS, 0)).toEqual({
      shown: 0,
      speaking: null,
      state: 'calm',
      level: 0,
      ended: false,
      report: false,
      quotes: 0,
      scores: 0,
    });
  });

  it('has the customer speaking their first line, with their voice up', () => {
    const frame = frameAt(TEAMS, 1500);
    expect(frame).toMatchObject({ shown: 1, speaking: 'customer', state: 'calm' });
    expect(frame.level).toBeGreaterThan(0.9);
  });

  it('has the trainee answering with the customer silent', () => {
    const frame = frameAt(TEAMS, 4500);
    expect(frame).toMatchObject({ shown: 2, speaking: 'trainee', level: 0, ended: false });
  });

  it('changes how the customer feels while they explain the problem, not before', () => {
    const [from, to] = BEATS.lines[2].speak;
    expect(frameAt(TEAMS, from + 100).state).toBe('calm');
    expect(frameAt(TEAMS, BEATS.stateChange).state).toBe('concerned');
    expect(BEATS.stateChange).toBeGreaterThan(from);
    expect(BEATS.stateChange).toBeLessThan(to);
  });

  it('ends the call, with nobody speaking, and then turns the card into the report', () => {
    const ended = frameAt(TEAMS, BEATS.end);
    expect(ended).toMatchObject({ ended: true, speaking: null, shown: 3, report: false });
    expect(frameAt(TEAMS, BEATS.report)).toMatchObject({ report: true, quotes: 0, scores: 0 });
  });

  it('never shows a score before all of the evidence it rests on has appeared', () => {
    for (const time of everyFiftyMs) {
      const frame = frameAt(TEAMS, time);
      if (frame.scores > 0) expect(frame.quotes, `at ${time} ms`).toBe(3);
    }
  });

  it('only ever adds: lines, quotes and scores never go away within a loop', () => {
    let before = frameAt(TEAMS, 0);
    for (const time of everyFiftyMs) {
      const frame = frameAt(TEAMS, time);
      expect(frame.shown, `lines at ${time} ms`).toBeGreaterThanOrEqual(before.shown);
      expect(frame.quotes, `quotes at ${time} ms`).toBeGreaterThanOrEqual(before.quotes);
      expect(frame.scores, `scores at ${time} ms`).toBeGreaterThanOrEqual(before.scores);
      if (before.ended) expect(frame.ended).toBe(true);
      if (before.report) expect(frame.report).toBe(true);
      before = frame;
    }
  });

  it('gives the same frame for the same time, and a level that is always a fraction', () => {
    for (const time of everyFiftyMs) {
      const frame = frameAt(TEAMS, time);
      expect(frameAt(TEAMS, time)).toEqual(frame);
      expect(frame.level).toBeGreaterThanOrEqual(0);
      expect(frame.level).toBeLessThanOrEqual(1);
    }
  });

  it('counts a time before the start as the start, and a time after the end, or one that is not a number, sensibly', () => {
    expect(frameAt(TEAMS, -500)).toEqual(frameAt(TEAMS, 0));
    expect(frameAt(TEAMS, LOOP_MS * 4)).toEqual(frameAt(TEAMS, LOOP_MS));
    expect(frameAt(TEAMS, Number.NaN)).toEqual(frameAt(TEAMS, 0));
  });

  it('shows the customer in the state of each example, at the start and once they have explained', () => {
    for (const example of PREVIEW_EXAMPLES) {
      expect(frameAt(example, 0).state).toBe(example.states[0]);
      expect(frameAt(example, LOOP_MS).state).toBe(example.states[1]);
    }
  });
});

describe('the frame the preview rests on', () => {
  it('is complete: every line, every quote and every score, the call over and the report showing', () => {
    for (const example of PREVIEW_EXAMPLES) {
      expect(finalFrame(example)).toEqual({
        shown: 3,
        speaking: null,
        state: example.states[1],
        level: 0,
        ended: true,
        report: true,
        quotes: 3,
        scores: 3,
      });
    }
  });
});

describe('callStatus', () => {
  it('says Speaking while the customer speaks, Listening otherwise and Call ended at the end', () => {
    expect(callStatus(frameAt(TEAMS, 0))).toBe('Listening');
    expect(callStatus(frameAt(TEAMS, 1500))).toBe('Speaking');
    expect(callStatus(frameAt(TEAMS, 4500))).toBe('Listening');
    expect(callStatus(frameAt(TEAMS, 8000))).toBe('Speaking');
    expect(callStatus(frameAt(TEAMS, BEATS.end))).toBe('Call ended');
    expect(callStatus(finalFrame(TEAMS))).toBe('Call ended');
  });
});

describe('waveScales', () => {
  it('is a low, level line while nobody speaks', () => {
    const scales = waveScales(1234, 0);
    expect(scales).toHaveLength(WAVE_BARS);
    expect(new Set(scales)).toEqual(new Set([WAVE_IDLE]));
  });

  it('rises with the level, and stays between the idle height and the full height', () => {
    const quiet = waveScales(500, 0.2);
    const loud = waveScales(500, 1);
    expect(loud.reduce((sum, scale) => sum + scale, 0)).toBeGreaterThan(
      quiet.reduce((sum, scale) => sum + scale, 0),
    );
    for (const scale of [...quiet, ...loud]) {
      expect(scale).toBeGreaterThanOrEqual(WAVE_IDLE);
      expect(scale).toBeLessThanOrEqual(1);
    }
  });

  it('is taller in the middle of the wave than at its edges over time, and not one bar copied across', () => {
    const times = Array.from({ length: 50 }, (_, index) => index * 40);
    const average = (bar: number) =>
      times.reduce((sum, time) => sum + (waveScales(time, 1)[bar] ?? 0), 0) / times.length;
    const edges = [0, 1, 2, WAVE_BARS - 3, WAVE_BARS - 2, WAVE_BARS - 1].map(average);
    const middle = [-3, -2, -1, 0, 1, 2].map((offset) => average(WAVE_BARS / 2 + offset));
    const mean = (values: number[]) =>
      values.reduce((sum, value) => sum + value, 0) / values.length;
    expect(mean(middle)).toBeGreaterThan(mean(edges));
    expect(new Set(waveScales(0, 1)).size).toBeGreaterThan(WAVE_BARS / 2);
  });

  it('moves with time, and draws the same wave for the same time', () => {
    expect(waveScales(100, 1)).not.toEqual(waveScales(400, 1));
    expect(waveScales(100, 1)).toEqual(waveScales(100, 1));
  });

  it('holds a level outside 0 to 1 to the ends', () => {
    expect(waveScales(300, 7)).toEqual(waveScales(300, 1));
    expect(waveScales(300, -3)).toEqual(waveScales(300, 0));
  });
});
