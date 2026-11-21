import { describe, expect, it } from 'vitest';
import { DIMENSION_IDS } from '#shared/domain/vocab.ts';
import { CALL_NAMES, callFixtures } from './fixtures.ts';
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
  type TurnView,
} from './transcript-model.ts';

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
  it('has one entry per turn, in order, with the words exactly as they were said', async () => {
    const calls = await callFixtures();
    for (const name of CALL_NAMES) {
      const { session, report } = calls[name];
      const turns = buildTranscript(session, report);
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

  it('names the speakers and reads the clock from the start of the call', async () => {
    const { strong } = await callFixtures();
    const turns = buildTranscript(strong.session, strong.report);
    expect(turns[0]).toMatchObject({
      index: 1,
      role: 'customer',
      speaker: 'Daniel Osei',
      clock: '0:00',
    });
    expect(turns[1]).toMatchObject({ index: 2, role: 'trainee', speaker: 'You' });
    expect(turns.at(-1)?.clock).toMatch(/^\d+:\d{2}$/);
  });

  it('flags the turns that were spoken, and only the trainee\u2019s', async () => {
    const { voice, strong } = await callFixtures();
    const spoken = buildTranscript(voice.session, voice.report).filter((t) => t.spoken);
    expect(spoken.length).toBe(5);
    expect(spoken.every((t) => t.role === 'trainee')).toBe(true);
    expect(hasSpokenTurns(voice.session)).toBe(true);
    expect(hasSpokenTurns(strong.session)).toBe(false);
  });

  it('turns the engine\u2019s markers into labelled tags, in the report\u2019s words', async () => {
    const { strong } = await callFixtures();
    const second = buildTranscript(strong.session, strong.report)[1] as TurnView;
    expect(second.markers.map((m) => m.tag)).toEqual([
      'Mood: eased',
      'Mood: eased',
      'Mood: eased',
      'Fact uncovered',
    ]);
    const fact = second.markers.find((m) => m.kind === 'discovery');
    expect(fact?.text).toBe('The exact permission message');
  });

  it('never prints the engine\u2019s word for an unexpected turn', async () => {
    const calls = await callFixtures();
    for (const name of CALL_NAMES) {
      const { session, report } = calls[name];
      for (const turn of buildTranscript(session, report)) {
        for (const marker of turn.markers) expect(marker.text, name).not.toMatch(/curveball/i);
      }
    }
    const { curveball } = calls;
    const tags = buildTranscript(curveball.session, curveball.report).flatMap((t) => t.markers);
    expect(tags.filter((m) => m.kind === 'unexpected').map((m) => m.tag)).toEqual([
      'Unexpected turn',
      'Unexpected turn',
    ]);
  });

  it('shows no markers and no citations before there is a report', async () => {
    const { strong } = await callFixtures();
    const { turns } = {
      turns: buildTranscript(
        { ...strong.session, turns: strong.session.turns.map(({ markers: _m, ...t }) => t) },
        null,
      ),
    };
    expect(turns.every((t) => t.markers.length === 0 && t.citedFor.length === 0)).toBe(true);
  });
});

describe('citedTurns', () => {
  it('lists every turn the evidence, strengths and opportunities quote, with the skills that quote it', async () => {
    const { strong } = await callFixtures();
    const cited = citedTurns(strong.report);
    for (const d of strong.report.dimensions) {
      for (const e of d.evidence) expect(cited.get(e.turnIndex)).toContain(d.id);
    }
    for (const s of strong.report.strengths) expect(cited.get(s.turnIndex)).toContain(s.dimension);
    for (const i of strong.report.improvements) {
      if (i.turnIndex !== null) expect(cited.get(i.turnIndex)).toContain(i.dimension);
    }
  });

  it('keeps each turn\u2019s skills in rubric order, once each', async () => {
    const { strong } = await callFixtures();
    for (const skills of citedTurns(strong.report).values()) {
      expect(new Set(skills).size).toBe(skills.length);
      const order = skills.map((id) => DIMENSION_IDS.indexOf(id));
      expect(order).toEqual([...order].sort((a, b) => a - b));
    }
  });

  it('is empty with no report', () => {
    expect(citedTurns(null).size).toBe(0);
  });
});

describe('filters', () => {
  it('count what they find', async () => {
    const { strong } = await callFixtures();
    const turns = buildTranscript(strong.session, strong.report);
    const counts = filterCounts(turns);
    expect(counts.all).toBe(15);
    expect(counts.evidence).toBe(turns.filter((t) => t.citedFor.length > 0).length);
    expect(counts.discovery).toBe(4);
    expect(counts.mood).toBeGreaterThan(0);
    expect(counts.unexpected).toBe(0);
  });

  it('show everything for All turns', async () => {
    const { strong } = await callFixtures();
    const turns = buildTranscript(strong.session, strong.report);
    const shown = shownTurns(turns, 'all');
    expect(shown.map((s) => s.turn.index)).toEqual(turns.map((t) => t.index));
    expect(shown.some((s) => s.context)).toBe(false);
  });

  it('show only the cited turns for Evidence', async () => {
    const { strong } = await callFixtures();
    const turns = buildTranscript(strong.session, strong.report);
    const shown = shownTurns(turns, 'evidence');
    expect(shown.length).toBe(filterCounts(turns).evidence);
    expect(shown.every((s) => !s.context && s.turn.citedFor.length > 0)).toBe(true);
  });

  it.each(['discovery', 'mood', 'unexpected'] as const)(
    'keep the customer\u2019s reply beside each turn the %s filter finds',
    async (filter) => {
      const { curveball } = await callFixtures();
      const turns = buildTranscript(curveball.session, curveball.report);
      const shown = shownTurns(turns, filter);
      const found = shown.filter((s) => !s.context);
      expect(found.length).toBe(filterCounts(turns)[filter]);
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

  it('find the unexpected turn and the replies around it in a call that had one', async () => {
    const { curveball } = await callFixtures();
    const turns = buildTranscript(curveball.session, curveball.report);
    const shown = shownTurns(turns, 'unexpected').map((s) => s.turn.index);
    expect(shown).toContain(curveball.report.curveball?.firedAtTurn);
    expect(shown).toContain((curveball.report.curveball?.firedAtTurn ?? 0) + 1);
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

  it('finds every quote, question and evidence phrase the real evaluator cites, in the turn it cites', async () => {
    const calls = await callFixtures();
    const missing: string[] = [];
    for (const name of CALL_NAMES) {
      const { session, report } = calls[name];
      const textOf = (index: number) => session.turns.find((t) => t.index === index)?.text ?? '';
      const check = (where: string, index: number | null, quote: string | null) => {
        if (index === null || !quote) return;
        if (!locateQuote(textOf(index), quote))
          missing.push(`${name} ${where} turn ${index}: ${quote}`);
      };
      for (const d of report.dimensions)
        for (const e of d.evidence) check(d.id, e.turnIndex, e.quote);
      for (const s of report.strengths) check(`strength ${s.title}`, s.turnIndex, s.quote);
      for (const i of report.improvements) check(`improvement ${i.title}`, i.turnIndex, i.quote);
      for (const r of report.discovery.results)
        check(`fact ${r.label}`, r.revealedAtTurn, r.revealingQuestion);
      for (const p of report.journey.points) check(`journey ${p.kind}`, p.turnIndex, p.quote);
    }
    expect(missing).toEqual([]);
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
