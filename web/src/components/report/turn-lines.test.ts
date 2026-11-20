import { describe, expect, it } from 'vitest';
import type { TurnDTO } from '#shared/domain/api.ts';
import { makeTurns, point } from './report.fixtures.ts';
import { turnLines } from './turn-lines.ts';

// Turns 1..10: the customer speaks on the odd turns, the learner on the even ones. The fixture
// marks a hidden fact at turn 4 and a curveball at turn 8.
const turns = makeTurns(10);
const points = [
  point(1, 52, 'start', 0),
  point(2, 58, 'turn', 6),
  point(4, 66, 'turning-point', 8),
  point(6, 70, 'turn', 4),
  point(8, 38, 'turning-point', -32),
  point(10, 14, 'end', -24),
];
const PLAIN = { band: null, easing: false, kink: false, signal: false };

describe('turnLines', () => {
  const lines = turnLines(points, turns, null);

  it('draws one line for every turn', () => {
    expect(lines).toHaveLength(10);
  });

  it('draws a customer turn from the mood after what was said just before it', () => {
    expect(lines[0]?.band?.id).toBe('frustrated');
    // Turn 5 follows the learner's turn 4, after which the customer was Angry.
    expect(lines[4]?.band?.id).toBe('angry');
    // Turn 9 follows turn 8, which brought them down to Concerned.
    expect(lines[8]?.band?.id).toBe('concerned');
  });

  it('draws a learner’s turn from the mood it was said into', () => {
    expect(lines[5]?.band?.id).toBe('angry');
    expect(lines[7]?.band?.id).toBe('angry');
    expect(lines[9]?.band?.id).toBe('concerned');
  });

  it('marks a turn where the customer was easing back from a tense state', () => {
    expect(lines[8]?.easing).toBe(true);
    expect(lines[4]?.easing).toBe(false);
  });

  it('draws a turn plain where the report recorded nothing yet', () => {
    const late = turnLines([point(4, 66, 'start', 0)], turns, null);
    expect(late[0]).toEqual(PLAIN);
    expect(late[1]).toEqual(PLAIN);
    expect(late[4]?.band?.id).toBe('angry');
  });

  it('draws every turn plain for a call with no recorded journey', () => {
    expect(turnLines([], turns).every((line) => line.band === null)).toBe(true);
  });

  it('jogs the line at a curveball and lights it at a hidden fact, from the markers or the report', () => {
    expect(lines[7]?.kink).toBe(true);
    expect(lines[3]?.signal).toBe(true);
    expect(lines[2]).toMatchObject({ kink: false, signal: false });

    const unmarked: TurnDTO[] = makeTurns(10).map((turn) => ({ ...turn, markers: undefined }));
    const fromReport = turnLines(points, unmarked, 6);
    expect(fromReport[5]?.kink).toBe(true);
    expect(fromReport.filter((line) => line.kink)).toHaveLength(1);
    expect(fromReport.some((line) => line.signal)).toBe(false);
  });
});
