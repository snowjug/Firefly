import { cleanup, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CoachingReport } from '#shared/domain/report.ts';
import { ReportView } from './ReportView.tsx';
import { CALLS, CALL_NAMES, withReport, type CallName } from './fixtures.ts';
import { evidenceTurns, isVerifiedQuote, quoteMatchesTurn, turnLookup } from './evidence-model.ts';
import { renderAtReport, scriptedClient, stubMatchMedia, stubScroll } from './test-utils.tsx';

// The rule the whole report stands on: no quote is ever shown as evidence unless the transcript turn
// it names says it. This renders every fixture call, whole, and checks every quote on the page
// against the transcript; then it damages the report in every place that carries a quote and checks
// that none of the damage reaches the page.

// Role queries over a whole report are slow in jsdom, and slower on a busy machine.
vi.setConfig({ testTimeout: 40_000 });

let restoreScroll: () => void;
beforeEach(() => {
  restoreScroll = stubScroll().restore;
});
afterEach(() => {
  cleanup();
  restoreScroll();
});

function show(name: CallName, report: CoachingReport = CALLS[name].report) {
  const call = CALLS[name];
  return renderAtReport(
    <ReportView
      session={withReport(call, report)}
      report={report}
      client={scriptedClient(call.session)}
      reveal={false}
    />,
  );
}

const lookupOf = (name: CallName) => turnLookup(evidenceTurns(CALLS[name].session));
const unquote = (text: string) => text.replace(/^\u201c/, '').replace(/\u201d$/, '');

interface ShownQuote {
  words: string;
  who: string;
  turn: number;
}

/** Every quote the page shows as a figure: the words, who said them and the turn they cite. */
function shownQuotes(): ShownQuote[] {
  return [...document.querySelectorAll<HTMLElement>('figure.rp-quote')].map((figure) => {
    const href = figure.querySelector('a[href^="#turn-"]')?.getAttribute('href');
    const label = figure.querySelector('.rp-quote__foot')?.textContent ?? '';
    const turn = Number(href?.replace('#turn-', '') ?? label.match(/Turn (\d+)/)?.[1]);
    return {
      words: unquote(figure.querySelector('blockquote')?.textContent ?? ''),
      who: figure.querySelector('.rp-quote__who')?.textContent ?? '',
      turn,
    };
  });
}

/** The words of the "You said" line of every better wording on the page. */
function saidLines(): string[] {
  return [...document.querySelectorAll('.rp-bw__line--before .rp-bw__text')].map((line) =>
    unquote((line.textContent ?? '').replace(/Removed: /g, '')),
  );
}

describe('every quote on the page, for every call', () => {
  it.each(CALL_NAMES)('%s: is words that the turn it cites really says', (name) => {
    show(name);
    const lookup = lookupOf(name);
    const quotes = shownQuotes();
    expect(quotes.length).toBeGreaterThan(0);
    for (const quote of quotes) {
      const turn = lookup.get(quote.turn);
      expect(turn, `${name}: a quote cites turn ${quote.turn}`).toBeDefined();
      if (quote.who === 'You') {
        expect(turn?.role).toBe('trainee');
        expect(quoteMatchesTurn(turn?.text ?? '', quote.words), `${name}: ${quote.words}`).toBe(
          true,
        );
      } else {
        // The customer's own turn, whole.
        expect(turn?.role).toBe('customer');
        expect(quote.words).toBe(turn?.text);
      }
    }
  });

  it.each(CALL_NAMES)('%s: every "You said" line is something the trainee said', (name) => {
    show(name);
    const lookup = lookupOf(name);
    const said = [...lookup.values()].filter((turn) => turn.role === 'trainee');
    for (const line of saidLines()) {
      expect(
        said.some((turn) => quoteMatchesTurn(turn.text, line)),
        `${name}: ${line}`,
      ).toBe(true);
    }
  });

  it.each(CALL_NAMES)('%s: every marked word is inside the turn it is drawn in', (name) => {
    show(name);
    for (const mark of document.querySelectorAll('.rp-mark--quote')) {
      const turn = mark.closest('.rp-ev__turn, .rp-turn');
      expect(turn?.textContent, name).toContain(mark.textContent ?? '');
    }
  });
});

/** Every place the report carries a quote, rewritten by `change`. */
function altered(
  report: CoachingReport,
  change: (quote: string, turnIndex: number | null) => { quote: string; turnIndex: number | null },
): CoachingReport {
  const edit = <T extends { quote: string; turnIndex: number }>(item: T): T => {
    const next = change(item.quote, item.turnIndex);
    return { ...item, quote: next.quote, turnIndex: next.turnIndex ?? item.turnIndex };
  };
  const optional = <T extends { quote: string | null; turnIndex: number | null }>(item: T): T => {
    if (item.quote === null) return item;
    const next = change(item.quote, item.turnIndex);
    return {
      ...item,
      quote: next.quote,
      turnIndex: item.turnIndex === null ? null : next.turnIndex,
    };
  };
  return {
    ...report,
    dimensions: report.dimensions.map((d) => ({ ...d, evidence: d.evidence.map(edit) })),
    strengths: report.strengths.map(edit),
    improvements: report.improvements.map(optional),
    care: report.care?.map((p) => ({
      ...p,
      behaviours: p.behaviours.map((b) => ({ ...b, evidence: b.evidence.map(edit) })),
    })),
    journey: {
      ...report.journey,
      points: report.journey.points.map(optional),
      milestones: report.journey.milestones?.map(optional),
    },
    discovery: {
      ...report.discovery,
      results: report.discovery.results.map((r) => {
        if (!r.revealingQuestion) return r;
        const next = change(r.revealingQuestion, r.revealedAtTurn);
        return {
          ...r,
          revealingQuestion: next.quote,
          revealedAtTurn: r.revealedAtTurn === null ? null : (next.turnIndex ?? r.revealedAtTurn),
        };
      }),
    },
  };
}

const FABRICATED = 'zebra xylophone quartz';

describe('a report whose quotes the transcript does not back', () => {
  it.each(['strong', 'weak', 'curveball', 'voice'] as const)(
    '%s: shows none of the made-up words anywhere, and says Insufficient evidence instead',
    (name) => {
      const report = altered(CALLS[name].report, (_quote, turnIndex) => ({
        quote: FABRICATED,
        turnIndex,
      }));
      show(name, report);
      expect(document.body.textContent).not.toContain(FABRICATED);
      // Only the customer's own turns can still be quoted, and they are the transcript's words.
      for (const quote of shownQuotes()) expect(quote.who).not.toBe('You');
      expect(saidLines()).toEqual([]);
      expect(screen.getAllByText('Insufficient evidence').length).toBeGreaterThan(0);
    },
  );

  it.each(['strong', 'weak', 'curveball'] as const)(
    '%s: shows nothing when the words are real but the turn is another one',
    (name) => {
      const lookup = lookupOf(name);
      const traineeTurns = [...lookup.values()].filter((turn) => turn.role === 'trainee');
      // Every quote now cites a trainee turn that does not say it.
      const report = altered(CALLS[name].report, (quote, turnIndex) => {
        const other = traineeTurns.find(
          (turn) => turn.index !== turnIndex && !quoteMatchesTurn(turn.text, quote),
        );
        return { quote, turnIndex: other?.index ?? turnIndex };
      });
      show(name, report);
      for (const quote of shownQuotes()) {
        if (quote.who !== 'You') continue;
        expect(
          isVerifiedQuote(lookup, quote.turn, quote.words),
          `${name}: ${quote.words} at turn ${quote.turn}`,
        ).toBe(true);
      }
    },
  );

  it('shows nothing when a quote cites a turn that does not exist', () => {
    const report = altered(CALLS.strong.report, (quote) => ({ quote, turnIndex: 999 }));
    show('strong', report);
    expect(shownQuotes().filter((quote) => quote.who === 'You')).toEqual([]);
    expect(screen.queryByRole('link', { name: /turn 999/ })).not.toBeInTheDocument();
  });

  it('shows no unconfirmed quote in the call journey either, wide or narrow', () => {
    const restore = stubMatchMedia((query) => query.includes('min-width: 48em'));
    try {
      const report = altered(CALLS.strong.report, (_quote, turnIndex) => ({
        quote: FABRICATED,
        turnIndex,
      }));
      show('strong', report);
      const journey = screen.getByRole('region', { name: 'Call journey' });
      expect(journey).not.toHaveTextContent(FABRICATED);
      expect(within(journey).queryAllByRole('blockquote')).toHaveLength(0);
      expect(journey.querySelector('mark')).toBeNull();
    } finally {
      restore();
    }
  });
});
