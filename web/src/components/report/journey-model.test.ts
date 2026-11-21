import { describe, expect, it } from 'vitest';
import {
  atmosphereAt,
  discoveryMoment,
  filamentPieces,
  foundBy,
  journeyDiscoveries,
  layoutStrip,
  placeDiscoveries,
  trendOf,
} from './journey-model.ts';
import { PEAKED_JOURNEY, makeReport, point } from './report.fixtures.ts';
import { buildMoments, layoutChart } from './timeline-model.ts';

const numbersOf = (d: string) => (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);

describe('the filament between the points of a journey', () => {
  const moments = buildMoments(PEAKED_JOURNEY);
  const layout = layoutChart(moments, 720);

  it('has one stretch for every point after the first, each ending on its own point', () => {
    const pieces = filamentPieces(moments, layout.xs, layout.ys);
    expect(pieces.map((piece) => piece.to)).toEqual([1, 2, 3, 4, 5]);
    for (const piece of pieces) {
      const values = numbersOf(piece.d);
      const x = values[values.length - 2] as number;
      const y = values[values.length - 1] as number;
      expect(x).toBeCloseTo(layout.xs[piece.to] as number, 0);
      expect(y).toBeCloseTo(layout.ys[piece.to] as number, 0);
      const startX = values[0] as number;
      expect(startX).toBeCloseTo(layout.xs[piece.to - 1] as number, 0);
    }
  });

  it('is drawn straight for a calm customer and unsteady for a tense one', () => {
    const calm = buildMoments([point(1, 8, 'start', 0), point(3, 6, 'turn', -2)]);
    const calmLayout = layoutChart(calm, 600);
    const [calmPiece] = filamentPieces(calm, calmLayout.xs, calmLayout.ys);
    expect(numbersOf((calmPiece as { d: string }).d)).toHaveLength(4);

    const tense = buildMoments([point(1, 70, 'start', 0), point(3, 76, 'turn', 6)]);
    const tenseLayout = layoutChart(tense, 600);
    const [tensePiece] = filamentPieces(tense, tenseLayout.xs, tenseLayout.ys);
    expect(numbersOf((tensePiece as { d: string }).d).length).toBeGreaterThan(8);
    expect((tensePiece as { join: string }).join).toBe('miter');
  });

  it('breaks the line when the customer is escalating, and softens it while they ease', () => {
    const escalating = buildMoments([point(1, 90, 'start', 0), point(3, 96, 'turn', 6)]);
    const eased = buildMoments([point(1, 90, 'start', 0), point(3, 84, 'turn', -6)]);
    const place = (list: ReturnType<typeof buildMoments>) => {
      const l = layoutChart(list, 600);
      return filamentPieces(list, l.xs, l.ys)[0] as { dash: string | null };
    };
    expect(place(escalating).dash).not.toBeNull();
    expect(place(eased).dash).toBeNull();
  });

  it('jogs the line sideways where a curveball landed', () => {
    const plain = buildMoments([point(1, 30, 'start', 0), point(3, 30, 'turn', 0)]);
    const jolted = buildMoments([point(1, 30, 'start', 0), point(3, 30, 'curveball', 0)]);
    const reach = (list: ReturnType<typeof buildMoments>) => {
      const l = layoutChart(list, 600);
      const piece = filamentPieces(list, l.xs, l.ys)[0] as { d: string; kink: boolean };
      const ys = numbersOf(piece.d).filter((_, i) => i % 2 === 1);
      return { kink: piece.kink, spread: Math.max(...ys) - Math.min(...ys) };
    };
    expect(reach(plain).kink).toBe(false);
    expect(reach(jolted).kink).toBe(true);
    expect(reach(jolted).spread).toBeGreaterThan(reach(plain).spread + 5);
  });

  it('draws the same line for the same call every time', () => {
    const a = filamentPieces(moments, layout.xs, layout.ys);
    const b = filamentPieces(moments, layout.xs, layout.ys);
    expect(a).toEqual(b);
  });

  it('copes with a single point and with points on top of each other', () => {
    const one = buildMoments([point(1, 40, 'start', 0)]);
    expect(filamentPieces(one, [10], [10])).toEqual([]);
    const pair = buildMoments([point(1, 40, 'start', 0), point(2, 40, 'end', 0)]);
    expect(filamentPieces(pair, [5, 5], [5, 5])[0]?.d).toBe('M5 5L5 5');
  });
});

describe('the strip across the head of the page', () => {
  it('spaces the points evenly and keeps every one inside the strip', () => {
    const moments = buildMoments(PEAKED_JOURNEY);
    const strip = layoutStrip(moments, 900, 72);
    const gaps = strip.xs.slice(1).map((x, i) => x - (strip.xs[i] as number));
    for (const gap of gaps) expect(gap).toBeCloseTo(gaps[0] as number, 5);
    for (const y of strip.ys) {
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(strip.baseY);
    }
    expect(strip.xs[0]).toBeGreaterThan(0);
    expect(strip.xs[strip.xs.length - 1]).toBeLessThan(900);
  });

  it('puts a hotter moment higher than a calmer one', () => {
    const strip = layoutStrip(
      buildMoments([point(1, 10, 'start', 0), point(2, 90, 'end', 80)]),
      600,
    );
    expect((strip.ys[1] as number) < (strip.ys[0] as number)).toBe(true);
  });
});

describe('signals found, placed on the journey', () => {
  const facts = makeReport().discovery.results;

  it('keeps only the facts that came out, in the order they came out', () => {
    expect(journeyDiscoveries(facts).map((d) => [d.turn, d.status])).toEqual([
      [2, 'partial'],
      [4, 'discovered'],
    ]);
  });

  it('belongs to the first moment at or after its turn, or the last when it came later', () => {
    const moments = buildMoments(PEAKED_JOURNEY); // turns 1, 2, 4, 6, 8, 10
    expect(discoveryMoment(4, moments)).toBe(2);
    expect(discoveryMoment(5, moments)).toBe(3);
    expect(discoveryMoment(30, moments)).toBe(5);
    expect(discoveryMoment(1, moments)).toBe(0);
  });

  it('stands between two points when it fell between their turns', () => {
    const moments = buildMoments(PEAKED_JOURNEY);
    const layout = layoutChart(moments, 800);
    const [between] = placeDiscoveries(
      [{ turn: 5, label: 'x', status: 'discovered' }],
      moments,
      layout.xs,
      layout.ys,
    );
    expect(between?.moment).toBe(3);
    expect(between?.x).toBeGreaterThan(layout.xs[2] as number);
    expect(between?.x).toBeLessThan(layout.xs[3] as number);
    const [exact] = placeDiscoveries(
      [{ turn: 4, label: 'x', status: 'discovered' }],
      moments,
      layout.xs,
      layout.ys,
    );
    expect(exact?.x).toBeCloseTo(layout.xs[2] as number, 5);
  });

  it('counts the signals found by a moment', () => {
    const placed = [{ moment: 1 }, { moment: 3 }, { moment: 3 }];
    expect([0, 1, 2, 3, 4].map((m) => foundBy(m, placed))).toEqual([0, 1, 1, 3, 3]);
  });
});

describe('the presence frozen at a moment', () => {
  it('has the cues on whichever way the call was practised', () => {
    const atmosphere = atmosphereAt({ id: 'angry', label: 'Angry' }, 'rising');
    expect(atmosphere.mood).toBe('angry');
    expect(atmosphere.label).toBe('Angry');
    expect(atmosphere.tension).toBeGreaterThan(
      atmosphereAt({ id: 'calm', label: 'Calm' }, 'steady').tension,
    );
  });

  it('reads the direction of a move as a trend', () => {
    expect(trendOf('rose')).toBe('rising');
    expect(trendOf('eased')).toBe('falling');
    expect(trendOf('steady')).toBe('steady');
    expect(trendOf('start')).toBe('steady');
  });
});
