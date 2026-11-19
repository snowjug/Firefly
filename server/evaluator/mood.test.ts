import { describe, expect, it } from 'vitest';
import type { StateEvent } from '#shared/domain/state.ts';
import {
  describeCall,
  describeHarm,
  describeHelp,
  describeTemperatureChange,
  isHarm,
  measureMove,
  netMoves,
  printsRawMoodNumber,
  temperatureMove,
  withoutRawMoodNumbers,
} from './mood.ts';

const event = (key: StateEvent['key'], previous: number, next: number): StateEvent => ({
  turnIndex: 2,
  key,
  previous,
  next,
  delta: next - previous,
  category: 'empathy',
  reason: 'A reason',
});

describe('the size of a change, in words', () => {
  it.each([
    [0, null],
    [4, null],
    [-4, null],
    [5, 'rose a little'],
    [9, 'rose a little'],
    [10, 'rose sharply'],
    [25, 'rose sharply'],
    [-5, 'eased a little'],
    [-9, 'eased a little'],
    [-10, 'eased noticeably'],
    [-19, 'eased noticeably'],
    [-20, 'eased a lot'],
    [-45, 'eased a lot'],
  ])('temperature change %i is %s', (delta, words) => {
    expect(temperatureMove(delta)).toBe(words);
  });

  it.each([
    [4, null],
    [-4, null],
    [5, 'rose a little'],
    [10, 'rose noticeably'],
    [25, 'rose a lot'],
    [-5, 'fell a little'],
    [-10, 'fell sharply'],
  ])('trust, patience or confidence change %i is %s', (delta, words) => {
    expect(measureMove(delta)).toBe(words);
  });
});

describe('describing what the customer did', () => {
  it('adds the changes of one measure across events and keeps where it began and ended', () => {
    const moves = netMoves([
      event('temperature', 52, 49),
      event('trust', 40, 46),
      event('temperature', 49, 42),
    ]);
    expect(moves).toEqual([
      { key: 'temperature', delta: -10, from: 52, to: 42 },
      { key: 'trust', delta: 6, from: 40, to: 46 },
    ]);
    expect(moves.map(isHarm)).toEqual([false, false]);
    expect(netMoves([event('temperature', 40, 50), event('trust', 50, 44)]).map(isHarm)).toEqual([
      true,
      true,
    ]);
  });

  it('names the band only when the band changed, and never prints a raw value', () => {
    expect(describeHelp('Declan', [event('temperature', 65, 59)])).toBe(
      "Declan's temperature eased a little (Angry to Frustrated)",
    );
    expect(describeHelp('Declan', [event('temperature', 58, 52)])).toBe(
      "Declan's temperature eased a little",
    );
    expect(describeHarm('Declan', [event('temperature', 50, 62)])).toBe(
      "Declan's temperature rose sharply (Frustrated to Angry)",
    );
  });

  it('joins temperature with the biggest other measure, naming the customer once', () => {
    const text = describeHarm('Maya', [
      event('temperature', 34, 44),
      event('trust', 46, 36),
      event('patience', 50, 45),
    ]);
    expect(text).toBe(
      "Maya's temperature rose sharply (Concerned to Frustrated) and trust fell sharply",
    );
    expect(describeHelp('Maya', [event('ownershipConfidence', 40, 65)])).toBe(
      "Maya's confidence that someone owns the problem rose a lot",
    );
  });

  it('keeps only the first measure when asked to be brief', () => {
    const events = [event('temperature', 34, 44), event('trust', 46, 36)];
    expect(describeHarm('Maya', events, true)).toBe(
      "Maya's temperature rose sharply (Concerned to Frustrated)",
    );
  });

  it('says nothing when every change was too small to matter', () => {
    expect(describeHelp('Maya', [event('temperature', 33, 29), event('trust', 40, 44)])).toBeNull();
    expect(describeHarm('Maya', [event('temperature', 27, 29)])).toBeNull();
    expect(describeTemperatureChange('Maya', 55, 58)).toBeNull();
  });

  it('separates what hurt from what helped', () => {
    const events = [event('temperature', 52, 62), event('trust', 40, 50)];
    expect(describeHarm('Maya', events)).toBe(
      "Maya's temperature rose sharply (Frustrated to Angry)",
    );
    expect(describeHelp('Maya', events)).toBe("Maya's trust rose noticeably");
  });

  it('ignores measures the report does not talk about', () => {
    expect(
      describeHarm('Maya', [event('urgency', 40, 90), event('clarification', 0, 30)]),
    ).toBeNull();
  });
});

describe('the whole call in one phrase', () => {
  it('says how far the temperature moved and between which bands', () => {
    expect(describeCall('Declan', 72, 34)).toBe(
      "Declan's temperature eased a lot, from Angry at the start to Concerned at the end",
    );
    expect(describeCall('Maya', 34, 52)).toBe(
      "Maya's temperature rose sharply, from Concerned at the start to Frustrated at the end",
    );
  });

  it('says it held steady when it barely moved, and names the band when it moved within one', () => {
    expect(describeCall('Maya', 52, 50)).toBe("Maya's temperature held steady at Frustrated");
    expect(describeCall('Maya', 58, 45)).toBe(
      "Maya's temperature eased noticeably, staying Frustrated",
    );
  });
});

describe('raw customer-state numbers', () => {
  const raw = [
    "Maya's temperature fell from 52 to 44.",
    'Her trust rose from 27 to 32 after that.',
    'Confidence reached 85.',
    'The patience was 30.',
  ];

  it.each(raw)('is recognised in "%s"', (text) => {
    expect(printsRawMoodNumber(text)).toBe(true);
  });

  it('is not triggered by ordinary numbers or by the words alone', () => {
    for (const text of [
      'You promised an update in 20 minutes.',
      "Maya's temperature eased a little.",
      'Trust the process, then call back later.',
      'The call lasted 12 minutes. Her trust held.',
    ]) {
      expect(printsRawMoodNumber(text)).toBe(false);
    }
  });

  it('drops only the offending sentences', () => {
    expect(
      withoutRawMoodNumbers(
        "You listened well. Maya's temperature fell from 52 to 44. A clear next step followed.",
      ),
    ).toBe('You listened well. A clear next step followed.');
    expect(withoutRawMoodNumbers("Maya's temperature fell from 52 to 44.")).toBe('');
  });
});
