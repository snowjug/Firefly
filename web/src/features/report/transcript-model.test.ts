import { describe, expect, it } from 'vitest';
import type { SessionDTO } from '#shared/domain/api.ts';
import { DIMENSION_IDS } from '#shared/domain/vocab.ts';
import { CALLS, CALL_NAMES } from './fixtures.ts';
import { evidenceTurns, isVerifiedQuote, turnLookup } from './evidence-model.ts';
import {
  TRANSCRIPT_FILTERS,
  buildTranscript,
  citedTurns,
  filterCounts,
  findMatches,
  hasSpokenTurns,
  locateQuote,
  matchesFilter,
  segmentText,
  shownTurns,
  turnId,
  type QuoteCheck,
  type TurnView,
} from './transcript-model.ts';

/** The check the page uses: the trainee really said the quote in the turn it names. */
const checkFor = (session: SessionDTO): QuoteCheck => {
  const lookup = turnLookup(evidenceTurns(session));
  return (turnIndex, quote) => isVerifiedQuote(lookup, turnIndex, quote);
};
const build = (name: keyof typeof CALLS) =>
  buildTranscript(CALLS[name].session, CALLS[name].report, checkFor(CALLS[name].session));
const trusting: QuoteCheck = () => true;

const view = (index: number, text: string, role: TurnView['role'] = 'trainee'): TurnView => ({
  index,
  role,
  speaker: role === 'trainee' ? 'You' : 'Customer',
  clock: '0:00',
  text,
  spoken: false,
  markers: [],
  citedFor: [],
});

describe('buildTranscript', () => {
  it('has one entry per turn, in order, with the words exactly as they were said', () => {
    for (const name of CALL_NAMES) {
      const { session } = CALLS[name];
      const turns = build(name);
      expect(
        turns.map((t) => t.index),
        name,
      ).toEqual(session.turns.map((t) => t.index));
      expect(
        turns.map((t) => t.text),
        name,
      ).toEqual(session.turns.map((t) => t.text));
    }
  });

  it('names the speakers and reads the clock from the start of the call', () => {
    const turns = build('strong');
    expect(turns[0]).toMatchObject({
      index: 1,
      role: 'customer',
      speaker: 'Priya Nair',
      clock: '0:00',
    });
    expect(turns[1]).toMatchObject({ index: 2, role: 'trainee', speaker: 'You' });
    expect(turns.at(-1)?.clock).toMatch(/^\d+:\d{2}$/);
  });

  it('knows which turns were spoken, and only the trainee\u2019s', () => {
    const spoken = build('voice').filter((t) => t.spoken);
    expect(spoken).toHaveLength(5);
    expect(spoken.every((t) => t.role === 'trainee')).toBe(true);
    expect(hasSpokenTurns(CALLS.voice.session)).toBe(true);
    expect(hasSpokenTurns(CALLS.strong.session)).toBe(false);
  });

  it('turns the engine\u2019s markers into labelled tags, in the report\u2019s words', () => {
    const turns = build('strong');
    const fourth = turns[3] as TurnView;
    expect(fourth.markers.map((m) => m.tag)).toEqual(['Mood: eased', 'Fact uncovered']);
    expect(fourth.markers.find((m) => m.kind === 'discovery')?.text).toBe(
      'Only sales-organised meetings are affected',
    );
    const sixth = turns[5] as TurnView;
    expect(sixth.markers.map((m) => m.tag)).toEqual(['Fact uncovered', 'Fact partly uncovered']);
  });

  it('never prints the engine\u2019s word for an unexpected turn', () => {
    for (const name of CALL_NAMES) {
      for (const turn of build(name)) {
        for (const marker of turn.markers) expect(marker.text, name).not.toMatch(/curveball/i);
      }
    }
    const tags = build('curveball').flatMap((t) => t.markers);
    expect(tags.filter((m) => m.kind === 'unexpected').map((m) => m.tag)).toEqual([
      'Unexpected turn',
    ]);
  });

  it('shows no markers and no citations before there is a report', () => {
    const { session } = CALLS.strong;
    const turns = buildTranscript(
      { ...session, turns: session.turns.map(({ markers: _m, ...t }) => t) },
      null,
      trusting,
    );
    expect(turns.every((t) => t.markers.length === 0 && t.citedFor.length === 0)).toBe(true);
  });

  it('does not cite a turn for a quote the turn does not say', () => {
    const { session, report } = CALLS.strong;
    const [first] = report.strengths;
    if (!first) throw new Error('fixture changed');
    const altered = {
      ...report,
      dimensions: report.dimensions.map((d) => ({ ...d, evidence: [] })),
      improvements: [],
      strengths: [{ ...first, quote: 'words that are not in the turn' }],
    };
    const turns = buildTranscript(session, altered, checkFor(session));
    expect(turns.filter((t) => t.citedFor.length > 0)).toEqual([]);
  });
});

describe('citedTurns', () => {
  it('lists every turn the evidence, strengths and improvements quote, with the skills that quote it', () => {
    const { report } = CALLS.strong;
    const cited = citedTurns(report, checkFor(CALLS.strong.session));
    for (const d of report.dimensions) {
      for (const e of d.evidence) expect(cited.get(e.turnIndex)).toContain(d.id);
    }
    for (const s of report.strengths) expect(cited.get(s.turnIndex)).toContain(s.dimension);
    for (const i of report.improvements) {
      if (i.turnIndex !== null) expect(cited.get(i.turnIndex)).toContain(i.dimension);
    }
  });

  it('keeps each turn\u2019s skills in rubric order, once each', () => {
    for (const skills of citedTurns(CALLS.strong.report, trusting).values()) {
      expect(new Set(skills).size).toBe(skills.length);
      const order = skills.map((id) => DIMENSION_IDS.indexOf(id));
      expect(order).toEqual([...order].sort((a, b) => a - b));
    }
  });

  it('leaves out the turns whose quotes the check refuses, and keeps an opportunity that names a turn without quoting it', () => {
    const { report } = CALLS.strong;
    expect(citedTurns(report, () => false).size).toBe(0);
    expect(citedTurns(report, (turnIndex) => turnIndex === 2).size).toBe(1);
    const [improvement] = report.improvements;
    if (!improvement) throw new Error('fixture changed');
    const unquoted = {
      ...report,
      dimensions: [],
      strengths: [],
      improvements: [{ ...improvement, turnIndex: 4, quote: null }],
    };
    expect(citedTurns(unquoted, () => false).get(4)).toEqual([improvement.dimension]);
  });

  it('is empty with no report', () => {
    expect(citedTurns(null, trusting).size).toBe(0);
  });
});

describe('filters', () => {
  const strong = () => build('strong');
  const curveball = () => build('curveball');

  it('count what they find', () => {
    const turns = strong();
    const counts = filterCounts(turns);
    expect(counts.all).toBe(15);
    expect(counts.evidence).toBe(turns.filter((t) => t.citedFor.length > 0).length);
    expect(counts.discovery).toBe(3);
    expect(counts.mood).toBe(2);
    expect(counts.unexpected).toBe(0);
  });

  it('show everything for All turns', () => {
    const turns = strong();
    const shown = shownTurns(turns, 'all');
    expect(shown.map((s) => s.turn.index)).toEqual(turns.map((t) => t.index));
    expect(shown.some((s) => s.context)).toBe(false);
  });

  it('show only the cited turns for Evidence', () => {
    const turns = strong();
    const shown = shownTurns(turns, 'evidence');
    expect(shown.length).toBe(filterCounts(turns).evidence);
    expect(shown.every((s) => !s.context && s.turn.citedFor.length > 0)).toBe(true);
  });

  it.each(['discovery', 'mood', 'unexpected'] as const)(
    'keep the customer\u2019s reply beside each turn the %s filter finds',
    (filter) => {
      const turns = curveball();
      const shown = shownTurns(turns, filter);
      const found = shown.filter((s) => !s.context);
      expect(found.length).toBe(filterCounts(turns)[filter]);
      expect(found.length).toBeGreaterThan(0);
      expect(found.every((s) => matchesFilter(s.turn, filter))).toBe(true);
      for (const reply of shown.filter((s) => s.context)) {
        expect(reply.turn.role).toBe('customer');
        expect(found.some((s) => s.turn.index === reply.turn.index - 1)).toBe(true);
      }
      // In transcript order, with no turn twice.
      const order = shown.map((s) => s.turn.index);
      expect(order).toEqual([...new Set(order)].sort((a, b) => a - b));
    },
  );

  it('find the unexpected turn and the reply to it in a call that had one', () => {
    const shown = shownTurns(curveball(), 'unexpected').map((s) => s.turn.index);
    const fired = CALLS.curveball.report.curveball?.firedAtTurn ?? 0;
    expect(shown).toEqual([fired, fired + 1]);
  });

  it('are exactly the five the transcript offers', () => {
    expect(TRANSCRIPT_FILTERS).toEqual(['all', 'evidence', 'discovery', 'mood', 'unexpected']);
  });
});

describe('findMatches', () => {
  const turns = [
    view(1, 'Hello, this is Sam. HELLO again.', 'customer'),
    view(2, 'We will call you back.\nWe will call at three.'),
    view(3, 'Nothing here.'),
  ];

  it('finds every occurrence, ignoring case, in reading order', () => {
    expect(findMatches(turns, 'hello')).toEqual([
      { turnIndex: 1, start: 0, end: 5 },
      { turnIndex: 1, start: 20, end: 25 },
    ]);
  });

  it('matches a phrase across a line break', () => {
    expect(findMatches(turns, 'back. we will')).toHaveLength(1);
  });

  it('finds nothing for an empty or blank search', () => {
    expect(findMatches(turns, '')).toEqual([]);
    expect(findMatches(turns, '   ')).toEqual([]);
  });

  it('treats what was typed as text, not as a pattern', () => {
    expect(findMatches([view(1, 'Call (now) or later? a+b')], '(now)')).toHaveLength(1);
    expect(findMatches([view(1, 'Call (now) or later? a+b')], 'a+b')).toHaveLength(1);
    expect(findMatches([view(1, 'anything')], '[')).toEqual([]);
  });
});

describe('locateQuote', () => {
  const text = "Hello Daniel, I'm sorry about this.\nCan you tell me what you see?";

  it('finds the words exactly where they were said, ignoring case', () => {
    expect(locateQuote(text, "i'm sorry about this")).toEqual({ start: 14, end: 34 });
    const range = locateQuote(text, "I'M SORRY ABOUT THIS.");
    expect(text.slice(range?.start, range?.end)).toBe("I'm sorry about this.");
  });

  it('includes the punctuation the quote ends with', () => {
    const range = locateQuote(text, 'Can you tell me what you see?');
    expect(text.slice(range?.start, range?.end)).toBe('Can you tell me what you see?');
  });

  it('finds a quote across a line break, as the report writes it with spaces', () => {
    const range = locateQuote(text, 'about this. Can you tell me');
    expect(range).not.toBeNull();
    expect(text.slice(range?.start, range?.end)).toBe('about this.\nCan you tell me');
  });

  it('treats curly and straight apostrophes alike', () => {
    expect(locateQuote('It\u2019s fine, I\u2019ll check', "it's fine, i'll check")).not.toBeNull();
    expect(locateQuote("It's fine, I'll check", 'It\u2019s fine, I\u2019ll check')).not.toBeNull();
  });

  it('finds a quote the report shortened with an ellipsis', () => {
    const range = locateQuote(text, 'Hello Daniel, I\u2019m sorry\u2026');
    expect(text.slice(range?.start, range?.end)).toBe("Hello Daniel, I'm sorry");
  });

  it('is null when the words are not in the turn, or are too short to mean anything', () => {
    expect(locateQuote(text, 'a completely different sentence')).toBeNull();
    expect(locateQuote(text, 'ab')).toBeNull();
    expect(locateQuote(text, '')).toBeNull();
  });
});

describe('segmentText', () => {
  it('is one plain piece when there is nothing to mark', () => {
    expect(segmentText('Hello there', [])).toEqual([
      { text: 'Hello there', quote: false, match: false, current: false },
    ]);
  });

  it('cuts at every edge so each piece has one look', () => {
    const pieces = segmentText('one two three', [
      { start: 0, end: 7, kind: 'quote' },
      { start: 4, end: 7, kind: 'current' },
      { start: 8, end: 13, kind: 'match' },
    ]);
    expect(pieces.map((p) => p.text)).toEqual(['one ', 'two', ' ', 'three']);
    expect(pieces.map((p) => [p.quote, p.match, p.current])).toEqual([
      [true, false, false],
      [true, true, true],
      [false, false, false],
      [false, true, false],
    ]);
    expect(pieces.map((p) => p.text).join('')).toBe('one two three');
  });

  it('ignores a range that is empty or outside the text', () => {
    const pieces = segmentText('abc', [
      { start: 2, end: 2, kind: 'match' },
      { start: 1, end: 9, kind: 'match' },
      { start: -1, end: 2, kind: 'match' },
    ]);
    expect(pieces).toEqual([{ text: 'abc', quote: false, match: false, current: false }]);
  });
});

describe('turnId', () => {
  it('is the anchor every link and the transcript agree on', () => {
    expect(turnId(6)).toBe('turn-6');
  });
});
