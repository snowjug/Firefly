import { act, cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CoachingReport } from '#shared/domain/report.ts';
import { wordCount } from '#shared/domain/scenario.ts';
import { SCORE_DESCRIPTIONS } from '#shared/domain/vocab.ts';
import { ReportView } from './ReportView.tsx';
import { CARE_WORDS } from './Care.tsx';
import { IMPROVEMENT_WORDS, STRENGTH_WORDS } from './Coaching.tsx';
import { SUMMARY_WORDS } from './Executive.tsx';
import { CALLS, withReport, type CallName } from './fixtures.ts';
import { renderAtReport, scriptedClient } from './test-utils.tsx';

// Role queries over a whole report are slow in jsdom, and slower on a busy machine.
vi.setConfig({ testTimeout: 20_000 });

// The report's copy budget (brief section 26): summary at most 45 words; each strength at most 35
// words plus its quote; each improvement at most 45 words plus its quote and alternative; the rubric
// in an expandable region. The words are counted from the rendered page, not from the data, because
// the evaluator may send more than the budget and the page must still keep to it.

afterEach(cleanup);

function show(name: CallName, report: CoachingReport = CALLS[name].report) {
  return renderAtReport(
    <ReportView
      session={withReport(CALLS[name], report)}
      report={report}
      client={scriptedClient(CALLS[name].session)}
      reveal={false}
    />,
  );
}

const budgeted = (key: string) => [
  ...document.querySelectorAll<HTMLElement>(`[data-budget="${key}"]`),
];

/** The words of an element, without its buttons ("Show more" is a control, not copy). */
function copyOf(element: HTMLElement): string {
  return [...element.children]
    .filter((child) => child.tagName !== 'BUTTON')
    .map((child) => child.textContent ?? '')
    .join(' ');
}

const SENTENCE =
  'The coaching has a good deal to say about this moment and the evaluator wrote all of it down. ';
const long = (text: string, sentences = 8) => `${text} ${SENTENCE.repeat(sentences)}`.trim();

/** The strong call, with every budgeted text far longer than its budget. */
function overlong(): CoachingReport {
  const { report } = CALLS.strong;
  return {
    ...report,
    summary: { ...report.summary, overall: long(report.summary.overall, 6) },
    strengths: report.strengths.map((s) => ({ ...s, whyItHelped: long(s.whyItHelped, 3) })),
    improvements: report.improvements.map((i) => ({ ...i, risk: long(i.risk, 3) })),
    dimensions: report.dimensions.map((d) => ({ ...d, guidance: long(d.guidance, 3) })),
    care: report.care?.map((p) => ({ ...p, summary: long(p.summary, 3) })),
  };
}

describe('the summary', () => {
  it('is at most 45 words', () => {
    for (const name of ['strong', 'weak', 'short', 'curveball', 'legacy'] as const) {
      show(name);
      const [summary] = budgeted('summary');
      expect(wordCount(summary?.textContent ?? ''), name).toBeLessThanOrEqual(SUMMARY_WORDS);
      cleanup();
    }
  });

  it('stays at 45 words when the evaluator sends far more, and gives the rest behind Show more', async () => {
    const report = overlong();
    expect(wordCount(report.summary.overall)).toBeGreaterThan(100);
    show('strong', report);
    const [summary] = budgeted('summary');
    expect(wordCount(summary?.textContent ?? '')).toBeLessThanOrEqual(SUMMARY_WORDS);
    // It ends cleanly, not in the middle of a word.
    expect(summary?.textContent).toMatch(/[.\u2026]$/);

    const more = within(screen.getByRole('region', { name: 'Summary' })).getByRole('button', {
      name: 'Show more',
    });
    expect(more).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(more);
    expect(more).toHaveAttribute('aria-expanded', 'true');
    expect(summary).toHaveTextContent(report.summary.overall.slice(-60));
    expect(wordCount(summary?.textContent ?? '')).toBe(wordCount(report.summary.overall));
    await userEvent.click(
      within(screen.getByRole('region', { name: 'Summary' })).getByRole('button', {
        name: 'Show less',
      }),
    );
    expect(wordCount(summary?.textContent ?? '')).toBeLessThanOrEqual(SUMMARY_WORDS);
  });

  it('has no Show more when the summary fits', () => {
    show('strong');
    expect(
      within(screen.getByRole('region', { name: 'Summary' })).queryByRole('button', {
        name: 'Show more',
      }),
    ).not.toBeInTheDocument();
  });
});

describe('strengths', () => {
  it('are at most 35 words each, title and reason together, plus their quote', () => {
    for (const name of ['strong', 'curveball', 'legacy'] as const) {
      show(name);
      const items = budgeted('strength');
      expect(items.length, name).toBeGreaterThan(0);
      for (const item of items) {
        expect(wordCount(copyOf(item)), `${name}: ${item.textContent}`).toBeLessThanOrEqual(
          STRENGTH_WORDS,
        );
      }
      cleanup();
    }
  });

  it('stay at 35 words when the evaluator sends more, with the quote and the link unchanged', async () => {
    const report = overlong();
    show('strong', report);
    for (const item of budgeted('strength')) {
      expect(wordCount(copyOf(item))).toBeLessThanOrEqual(STRENGTH_WORDS);
      const row = item.closest('li') as HTMLElement;
      expect(within(row).getByRole('blockquote')).toBeInTheDocument();
      expect(
        within(row).getAllByRole('link', { name: /See turn \d+ in the transcript/ }).length,
      ).toBeGreaterThan(0);
      await userEvent.click(within(row).getByRole('button', { name: 'Show more' }));
      expect(wordCount(copyOf(item))).toBeGreaterThan(STRENGTH_WORDS);
    }
  });
});

describe('improvements', () => {
  it('are at most 45 words each, title and risk together, plus their quote and better wording', () => {
    for (const name of ['strong', 'weak', 'curveball', 'legacy'] as const) {
      show(name);
      const items = budgeted('improvement');
      expect(items.length, name).toBeGreaterThan(0);
      for (const item of items) {
        expect(wordCount(copyOf(item)), `${name}: ${item.textContent}`).toBeLessThanOrEqual(
          IMPROVEMENT_WORDS,
        );
      }
      cleanup();
    }
  });

  it('stay at 45 words when the evaluator sends more, and the better wording is still whole', async () => {
    const report = overlong();
    show('strong', report);
    for (const item of budgeted('improvement')) {
      expect(wordCount(copyOf(item))).toBeLessThanOrEqual(IMPROVEMENT_WORDS);
    }
    const section = screen.getByRole('region', { name: 'Improvement opportunities' });
    const tried = [...section.querySelectorAll('.rp-bw__line--after .rp-bw__text')].map((text) =>
      (text.textContent ?? '').replace(/Added: /g, '').replace(/^\u201c|\u201d$/g, ''),
    );
    expect(tried).toEqual(report.improvements.map((improvement) => improvement.betterPhrasing));
    await userEvent.click(
      within(section).getAllByRole('button', { name: 'Show more' })[0] as HTMLElement,
    );
    expect(wordCount(copyOf(budgeted('improvement')[0] as HTMLElement))).toBeGreaterThan(
      IMPROVEMENT_WORDS,
    );
  });
});

describe('the CARE review', () => {
  it('shows at most 30 words of what was observed and of the next action, for every principle', () => {
    for (const name of ['strong', 'curveball'] as const) {
      show(name);
      for (const key of ['care', 'care-next']) {
        const texts = budgeted(key);
        expect(texts.length, `${name} ${key}`).toBe(CALLS[name].report.care?.length);
        for (const text of texts) {
          expect(
            wordCount(text.textContent ?? ''),
            `${name}: ${text.textContent}`,
          ).toBeLessThanOrEqual(CARE_WORDS);
        }
      }
      cleanup();
    }
  });

  it('keeps to 30 words when the evaluator sends more, and gives the rest behind Show more', async () => {
    show('strong', overlong());
    for (const key of ['care', 'care-next']) {
      for (const text of budgeted(key)) {
        expect(wordCount(text.textContent ?? '')).toBeLessThanOrEqual(CARE_WORDS);
      }
    }
    const [first] = budgeted('care');
    const more = first?.nextElementSibling as HTMLElement;
    expect(more).toHaveTextContent('Show more');
    await userEvent.click(more);
    expect(wordCount(first?.textContent ?? '')).toBeGreaterThan(CARE_WORDS);
  });
});

describe('the rest of the report', () => {
  it('keeps the rubric in a closed region, and opens it on request', async () => {
    show('strong');
    const about = screen.getByRole('region', { name: 'About this report' });
    const details = about.querySelector('details') as HTMLDetailsElement;
    expect(details.open).toBe(false);
    expect(within(about).getByText(SCORE_DESCRIPTIONS[1] as string)).not.toBeVisible();
    await userEvent.click(
      within(about).getByRole('heading', { level: 2, name: 'About this report' }),
    );
    expect(within(about).getByText(SCORE_DESCRIPTIONS[1] as string)).toBeVisible();
  });

  it('shows only the facts the header is for: stage, date, duration and how the customer felt', () => {
    show('strong');
    const labels = [...document.querySelectorAll('.rp-exec__facts dt')].map((dt) => dt.textContent);
    expect(labels).toEqual(['Stage', 'Date', 'Duration', 'Customer']);
  });

  it('keeps the details of every score, CARE principle and fact closed until asked', () => {
    show('strong');
    const closed = screen.getAllByRole('button', {
      name: /Expand details|^Show behaviours|^Show what the customer would have said/,
    });
    expect(closed.length).toBeGreaterThan(6);
    for (const button of closed) {
      expect(button).toHaveAttribute('aria-expanded', 'false');
    }
  });

  it('opens everything for paper, so a printout is complete, and closes it again afterwards', async () => {
    show('strong', overlong());
    expect(screen.getAllByRole('button', { name: /Expand details/ })).toHaveLength(6);
    act(() => {
      window.dispatchEvent(new Event('beforeprint'));
    });
    expect(screen.queryAllByRole('button', { name: /Expand details/ })).toHaveLength(0);
    expect(
      (
        screen
          .getByRole('region', { name: 'About this report' })
          .querySelector('details') as HTMLDetailsElement
      ).open,
    ).toBe(true);
    // The whole summary, not its first 45 words.
    const [summary] = budgeted('summary');
    expect(wordCount(summary?.textContent ?? '')).toBeGreaterThan(SUMMARY_WORDS);
    act(() => {
      window.dispatchEvent(new Event('afterprint'));
    });
    expect(screen.getAllByRole('button', { name: /Expand details/ })).toHaveLength(6);
    expect(wordCount(budgeted('summary')[0]?.textContent ?? '')).toBeLessThanOrEqual(SUMMARY_WORDS);
  });
});
