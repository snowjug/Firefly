import { act, cleanup, fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CoachingReport } from '#shared/domain/report.ts';
import { CARE_LABELS, DIMENSIONS, DIMENSION_IDS } from '#shared/domain/vocab.ts';
import { ApiError } from '../../lib/api.ts';
import { formatDuration } from '../../lib/format.ts';
import { ReportView } from './ReportView.tsx';
import { toBriefHref } from './brief-href.ts';
import { CALLS, SCENARIO_INDEX, asVersion1, withReport, type CallName } from './fixtures.ts';
import {
  FakeIntersectionObserver,
  must,
  renderAtReport,
  scriptedClient,
  stubIntersectionObserver,
  stubMatchMedia,
  stubScroll,
  type FakeClient,
} from './test-utils.tsx';

// Role queries over a whole report are slow in jsdom, and slower on a busy machine.
vi.setConfig({ testTimeout: 20_000 });

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function show(name: CallName, client: FakeClient = scriptedClient(CALLS[name].session)) {
  const { session, report } = CALLS[name];
  return {
    client,
    ...renderAtReport(
      <ReportView session={session} report={report} client={client} reveal={false} />,
    ),
  };
}

function showReport(name: CallName, report: CoachingReport, client?: FakeClient) {
  const session = withReport(CALLS[name], report);
  const fake = client ?? scriptedClient(session);
  return {
    client: fake,
    ...renderAtReport(
      <ReportView session={session} report={report} client={fake} reveal={false} />,
    ),
  };
}

const region = (name: string) => screen.getByRole('region', { name });

/** The summary block at the top: the one header of the page. */
const top = () => screen.getByRole('heading', { level: 1 }).closest('header') as HTMLElement;

/** The value beside a label in the summary block's list of facts. */
function fact(label: string): HTMLElement {
  const term = within(top()).getByText(label, { selector: 'dt' });
  const value = term.parentElement?.querySelector('dd');
  if (!value) throw new Error(`No value for ${label}`);
  return value;
}

/** The row for a skill in the scores. */
function row(skill: string): HTMLElement {
  const item = region('Scores').querySelector<HTMLElement>(`li[data-rp-origin="${skill}"]`);
  if (!item) throw new Error(`No score row for ${skill}`);
  return item;
}

const toggleOf = (item: HTMLElement) => within(item).getByRole('button', { name: /details$/ });

describe('the summary block', () => {
  it('names the page and the scenario, and says this is for training only', () => {
    show('strong');
    expect(screen.getByRole('heading', { level: 1, name: 'Coaching report' })).toBeInTheDocument();
    expect(top()).toHaveTextContent('Teams meeting recordings are missing');
    expect(within(top()).getByText('Training only')).toBeInTheDocument();
  });

  it('shows the Microsoft product on its accent tile, with its area, and takes the product’s hue', () => {
    show('strong');
    expect(within(top()).getByText('Microsoft Teams')).toBeInTheDocument();
    expect(within(top()).getByText('Meetings')).toBeInTheDocument();
    expect(top().className).toContain('ff-accent--purple');
    expect(top().querySelector('.rp-exec__tile svg')).not.toBeNull();
  });

  it('gives the stage, when, how long, and how the customer began and ended, in words with an arrow', () => {
    show('strong');
    expect(fact('Stage')).toHaveTextContent('First contact');
    expect(fact('Date')).toHaveTextContent(/19 Nov 2026/);
    expect(fact('Duration')).toHaveTextContent(
      formatDuration(CALLS.strong.session.durationSeconds),
    );
    const customer = fact('Customer');
    expect(customer).toHaveTextContent('Frustrated');
    expect(customer).toHaveTextContent('Calm');
    // A screen reader hears "Frustrated to Calm".
    expect(customer.textContent).toMatch(/Frustrated\s*to\s*Calm/);
  });

  it('shows no product for a call saved before the Microsoft scenarios, and does not guess one', () => {
    show('legacy');
    expect(top().querySelector('.rp-exec__tile')).toBeNull();
    expect(screen.queryByText(/Microsoft/)).not.toBeInTheDocument();
    expect(fact('Customer')).toHaveTextContent('Concerned');
    expect(fact('Customer')).toHaveTextContent('Calm');
  });

  it('says Ended early, and only for a call that ended early', () => {
    show('short');
    expect(screen.getByText('Ended early')).toBeInTheDocument();
    cleanup();
    show('strong');
    expect(screen.queryByText('Ended early')).not.toBeInTheDocument();
  });

  it('says it is demo mode when the call ran in demo mode, and not otherwise', () => {
    show('strong');
    expect(screen.getByText('Demo mode')).toBeInTheDocument();
    cleanup();
    const live = { ...CALLS.strong.session, providerKind: 'gemini' as const };
    renderAtReport(
      <ReportView
        session={live}
        report={CALLS.strong.report}
        client={scriptedClient(live)}
        reveal={false}
      />,
    );
    expect(screen.queryByText('Demo mode')).not.toBeInTheDocument();
  });

  it('has the first actions in the block: another call, the whole transcript and a printout', async () => {
    const { scroll, restore } = stubScroll();
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    try {
      show('strong');
      expect(within(top()).getByRole('link', { name: 'Try another call' })).toHaveAttribute(
        'href',
        '/scenarios',
      );
      await userEvent.click(within(top()).getByRole('button', { name: 'Print report' }));
      expect(print).toHaveBeenCalledTimes(1);
      await userEvent.click(within(top()).getByRole('button', { name: 'Review full transcript' }));
      expect(screen.getByRole('heading', { level: 2, name: 'Transcript' })).toHaveFocus();
      expect(scroll).toHaveBeenCalled();
    } finally {
      restore();
    }
  });

  it('carries a print header with the date and what the report is', () => {
    show('strong');
    expect(screen.getByText(/Practice coaching, not performance assessment\./)).toBeInTheDocument();
    expect(screen.getByText(/^Printed \d/)).toBeInTheDocument();
  });
});

describe('the summary', () => {
  it('gives the evaluator’s summary, and the average of the six skills as one modest line, not a big number', () => {
    show('strong');
    const summary = region('Summary');
    expect(summary).toHaveTextContent(CALLS.strong.report.summary.overall);
    expect(summary).toHaveTextContent('Practice signal 4.2 of 5, the average of six skills.');
    // The number is set in the same size as the sentence round it.
    expect(summary.querySelector('.rp-exec__number')?.tagName).toBe('SPAN');
    expect(summary.querySelector('.t-title1, .t-title2, .t-display')).toBeNull();
  });

  it('says there is no overall signal when the call was too short for one', () => {
    show('short');
    const summary = region('Summary');
    expect(summary).toHaveTextContent('No overall practice signal: not enough evidence.');
    expect(summary).not.toHaveTextContent(/\d of 5/);
  });

  it('says in one line that this is automatic practice feedback, not an assessment', () => {
    show('strong');
    expect(region('Summary')).toHaveTextContent(
      'Automatic practice feedback, not a performance assessment.',
    );
  });

  it('adds the note about limited evidence for a short or ended-early call, and only then', () => {
    show('short');
    expect(region('Summary')).toHaveTextContent(
      must(CALLS.short.report.completion.note, 'a completion note'),
    );
    cleanup();
    show('strong');
    expect(region('Summary')).not.toHaveTextContent('limited evidence');
  });
});

describe('the scores', () => {
  it('is six rows, one for each skill, in rubric order, in one list', () => {
    show('strong');
    const rows = within(region('Scores')).getAllByRole('heading', { level: 3 });
    expect(rows).toHaveLength(6);
    DIMENSION_IDS.forEach((id, index) => {
      expect(rows[index]).toHaveTextContent(DIMENSIONS[id].label);
    });
    expect(within(region('Scores')).getAllByRole('listitem')).toHaveLength(6);
  });

  it('writes each score as a number, "of 5" and a word, and names the row button by all of it', () => {
    show('weak');
    for (const d of CALLS.weak.report.dimensions) {
      const label = DIMENSIONS[d.id].label;
      const item = row(label);
      // A score no quote backs says "first look" where the rubric word would be, and never the word.
      const word = item.hasAttribute('data-first-look') ? 'first look' : d.label;
      expect(item).toHaveTextContent(`${d.score}`);
      expect(item).toHaveTextContent(`of 5`);
      expect(item).toHaveTextContent(word);
      if (word === 'first look')
        expect(item.querySelector('.rp-skill__score')).not.toHaveTextContent(d.label);
      expect(toggleOf(item)).toHaveAccessibleName(new RegExp(`^${label} ${d.score} of 5 ${word}`));
    }
  });

  it('says how many quotes back each score, counting only quotes the transcript backs', () => {
    show('strong');
    expect(row('Opening & Rapport')).toHaveTextContent('2 quotes');
    expect(row('Empathy & De-escalation')).toHaveTextContent('1 quote');
    cleanup();
    show('weak');
    // No quote: the one calm label stands where the count would be.
    expect(row('Opening & Rapport')).toHaveAttribute('data-first-look');
    expect(row('Opening & Rapport')).toHaveTextContent('Limited evidence');
  });

  it('gives the reason in a line on the row, ending where a sentence does when it can', () => {
    show('strong');
    const why = row('Opening & Rapport').querySelector('.rp-skill__why');
    expect(why).toHaveTextContent(
      'You greeted Priya by name, introduced yourself and said why you were sorry in the first turn.',
    );
  });

  it('keeps the first sentences of a long reason on the row, never cut in the middle, and the rest in the details', async () => {
    const { report } = CALLS.strong;
    const first = 'You greeted Priya by name and introduced yourself at once.';
    const rest =
      'Then you named the missing recordings and the client review so that she knew she had been heard before any question was asked of her at all.';
    showReport('strong', {
      ...report,
      dimensions: report.dimensions.map((d) =>
        d.id === 'opening-rapport' ? { ...d, rationale: `${first} ${rest}` } : d,
      ),
    });
    const item = row('Opening & Rapport');
    expect(item.querySelector('.rp-skill__why')?.textContent).toBe(first);
    expect(item.querySelector('.rp-skill__why')?.textContent).not.toContain('\u2026');
    expect(within(item).getByText('More on this score')).not.toBeVisible();
    await userEvent.click(toggleOf(item));
    expect(within(item).getByText('More on this score')).toBeVisible();
    expect(within(item).getByText(rest)).toBeVisible();
  });

  it('shows a first sentence longer than the budget whole, with nothing more to open for it', () => {
    const { report } = CALLS.strong;
    const long =
      'You greeted Priya by name and introduced yourself at once, then named the missing recordings and the client review so that she knew she had been heard before any question was asked of her at all.';
    showReport('strong', {
      ...report,
      dimensions: report.dimensions.map((d) =>
        d.id === 'opening-rapport' ? { ...d, rationale: long } : d,
      ),
    });
    const item = row('Opening & Rapport');
    expect(item.querySelector('.rp-skill__why')?.textContent).toBe(long);
    expect(within(item).queryByText('More on this score')).not.toBeInTheDocument();
  });

  it('shows one calm label, only on a row no quote backs, and not on a row that has quotes', () => {
    show('short');
    for (const d of CALLS.short.report.dimensions) {
      const item = row(DIMENSIONS[d.id].label);
      if (item.hasAttribute('data-first-look')) {
        expect(item).toHaveTextContent('Limited evidence');
        expect(item).toHaveTextContent('first look');
        expect(item.querySelector('.ff-badge--warning')).toBeNull();
      } else {
        expect(item).not.toHaveTextContent('Limited evidence');
        expect(item).not.toHaveTextContent('Not enough evidence');
      }
    }
    expect(within(region('Scores')).queryByText('Not enough evidence')).not.toBeInTheDocument();
    cleanup();
    show('strong');
    expect(within(region('Scores')).queryByText('Limited evidence')).not.toBeInTheDocument();
  });

  it('keeps the details closed until asked, then opens them in place with the button', async () => {
    show('strong');
    const item = row('Clarity');
    const button = toggleOf(item);
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).toHaveTextContent('Expand details');
    const panel = document.getElementById(button.getAttribute('aria-controls') ?? '');
    expect(panel).toHaveAttribute('hidden');
    expect(within(item).queryByRole('link')).not.toBeInTheDocument();

    await userEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(button).toHaveTextContent('Hide details');
    expect(panel).not.toHaveAttribute('hidden');
    expect(panel).toBeVisible();

    await userEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(panel).toHaveAttribute('hidden');
  });

  it('shows the quotes with their turns and what to improve when opened, and no confidence note for a row with quotes', async () => {
    show('strong');
    const item = row('Scoping & Discovery');
    await userEvent.click(toggleOf(item));
    const d = must(
      CALLS.strong.report.dimensions.find((x) => x.id === 'scoping-discovery'),
      'the scoping skill',
    );
    for (const e of d.evidence) {
      expect(item).toHaveTextContent(e.quote);
      expect(
        within(item).getByRole('link', { name: `See turn ${e.turnIndex} in the transcript` }),
      ).toHaveAttribute('href', `#turn-${e.turnIndex}`);
    }
    expect(item).toHaveTextContent(d.guidance);
    expect(item).not.toHaveTextContent('Evidence confidence');
  });

  it('says "Insufficient evidence" when nothing backs a score, and how thin evidence should be read', async () => {
    show('short');
    const item = row('Empathy & De-escalation');
    await userEvent.click(toggleOf(item));
    expect(item).toHaveTextContent('Insufficient evidence');
    expect(item).not.toHaveTextContent('No quotable moment stood out');
    expect(item).toHaveTextContent('Not enough in this call to judge this skill');
  });

  it('opens and closes every row with Expand all and Collapse all, and says so once', async () => {
    show('strong');
    const scores = region('Scores');
    await userEvent.click(within(scores).getByRole('button', { name: 'Expand all' }));
    expect(within(scores).getAllByRole('button', { name: /Hide details$/ })).toHaveLength(6);
    expect(screen.getByText('All six skills opened.')).toBeInTheDocument();
    await userEvent.click(within(scores).getByRole('button', { name: 'Collapse all' }));
    expect(within(scores).getAllByRole('button', { name: /Expand details$/ })).toHaveLength(6);
  });

  it('can be opened and closed from the keyboard alone', async () => {
    show('strong');
    const button = toggleOf(row('Closing'));
    button.focus();
    expect(button).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(button).toHaveAttribute('aria-expanded', 'true');
    await userEvent.keyboard(' ');
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });

  it('names every one of the six row buttons differently, by its skill', () => {
    show('strong');
    const names = within(region('Scores'))
      .getAllByRole('button', { name: /Expand details$/ })
      .map((b) => b.getAttribute('aria-label'));
    expect(new Set(names).size).toBe(6);
  });

  it('brings the rows in when the section first scrolls into view, and has them there at once under reduced motion', () => {
    const observer = stubIntersectionObserver();
    try {
      show('strong');
      const matrix = region('Scores').querySelector('.rp-skills') as HTMLElement;
      expect(matrix).not.toHaveAttribute('data-revealed');
      const [watcher] = FakeIntersectionObserver.watching(matrix);
      act(() => {
        watcher?.reportElement(matrix, true);
      });
      expect(matrix).toHaveAttribute('data-revealed');
    } finally {
      observer.restore();
    }
    cleanup();
    const media = stubMatchMedia((query) => query.includes('prefers-reduced-motion: reduce'));
    const reduced = stubIntersectionObserver();
    try {
      show('strong');
      expect(region('Scores').querySelector('.rp-skills')).toHaveAttribute('data-revealed');
    } finally {
      media();
      reduced.restore();
    }
  });
});

describe('the CARE review', () => {
  const tabs = () => within(region('CARE review')).getAllByRole('tab');
  const panel = () => within(region('CARE review')).getByRole('tabpanel');

  it('is a selector of four tabs, each with how much of the principle the call showed', () => {
    show('strong');
    expect(tabs().map((t) => t.textContent)).toEqual([
      'Communicate effectively 5 of 5 shown',
      'Be accountable 3 of 3 shown',
      'Be resourceful 2 of 4 shown',
      'Be empathetic 3 of 3 shown',
    ]);
    expect(tabs()[0]).toHaveAttribute('aria-selected', 'true');
    expect(tabs()[0]).toHaveAccessibleName(/^Communicate effectively\s*5 of 5 shown/);
    expect(tabs()[2]).toHaveAccessibleName(/^Be resourceful\s*2 of 4 shown/);
  });

  it('has all four sections in the page, and shows only the one chosen', () => {
    show('strong');
    const all = screen.getAllByRole('tabpanel', { hidden: true });
    expect(all).toHaveLength(4);
    expect(all.filter((p) => p.getAttribute('aria-hidden') !== 'true')).toHaveLength(1);
    expect(panel()).toHaveTextContent('Clear greeting, focused questions and a recap');
    // The other three are in the page (for paper) with their headings.
    const names = all.map((p) => p.querySelector('h3')?.textContent);
    expect(names).toEqual(Object.values(CARE_LABELS));
  });

  it('shows the observation, one quote that holds up and fits, and one next action', () => {
    show('strong');
    const open = panel();
    expect(
      within(open).getByRole('heading', { level: 3, name: 'Communicate effectively' }),
    ).toBeInTheDocument();
    expect(open).toHaveTextContent('What was observed');
    // The first behaviour the report lists as shown is the one quoted, and it is named under the quote.
    expect(open).toHaveTextContent('Hello Priya');
    expect(within(open).getAllByRole('blockquote')).toHaveLength(1);
    expect(
      within(open).getByRole('link', { name: 'See turn 2 in the transcript' }),
    ).toHaveAttribute('href', '#turn-2');
    expect(open).toHaveTextContent('Shown: Greeted the customer by name');
    expect(open).toHaveTextContent('Next action');
    expect(open).toHaveTextContent(
      'Confirm the organisation and one affected meeting early, so every check starts on the right tenant.',
    );
    expect(open.querySelector('.rp-care__next')).toHaveTextContent(
      'Confirm the organisation and one affected meeting early, so every check starts on the right tenant.',
    );
    expect(open).toHaveTextContent('From the skill Opening & Rapport.');
  });

  it('never puts the same words under two principles', async () => {
    show('strong');
    const quotes: string[] = [];
    for (const tab of tabs()) {
      await userEvent.click(tab);
      const text = panel().querySelector('.rp-care__panel blockquote, blockquote')?.textContent;
      if (text) quotes.push(text);
    }
    expect(quotes).toHaveLength(4);
    expect(new Set(quotes).size).toBe(4);
  });

  it('sets what the level rests on beside the level: the behaviours shown, and how the case was met', () => {
    show('strong');
    const head = panel().querySelector('.rp-care__head') as HTMLElement;
    expect(head).toHaveTextContent('Strong');
    expect(head.querySelector('.rp-care__basis')).toHaveTextContent('5 of 5 behaviours shown');
  });

  it('moves with the arrow keys, Home and End, and shows the matching section', async () => {
    const user = userEvent.setup();
    show('strong');
    tabs()[0]?.focus();
    await user.keyboard('{ArrowRight}');
    expect(tabs()[1]).toHaveFocus();
    expect(tabs()[1]).toHaveAttribute('aria-selected', 'true');
    expect(panel()).toHaveTextContent('Took ownership early');
    await user.keyboard('{End}');
    expect(tabs()[3]).toHaveAttribute('aria-selected', 'true');
    expect(panel()).toHaveTextContent('Acknowledged both the missing recordings');
    await user.keyboard('{ArrowRight}');
    expect(tabs()[0]).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{Home}');
    expect(tabs()[0]).toHaveFocus();
  });

  it('has one tab stop for the selector and the section after it', async () => {
    show('strong');
    expect(tabs().filter((t) => t.getAttribute('tabindex') === '0')).toHaveLength(1);
    await userEvent.click(tabs()[2] as HTMLElement);
    expect(tabs().filter((t) => t.getAttribute('tabindex') === '0')).toEqual([tabs()[2]]);
  });

  it('draws the sliding line from the chosen tab, and moves it when another is chosen', async () => {
    show('strong');
    const list = within(region('CARE review')).getByRole('tablist');
    expect(list.style.getPropertyValue('--care-x')).not.toBe('');
    expect(list.style.getPropertyValue('--care-w')).not.toBe('');
    expect(list.querySelector('.rp-care__indicator')).toHaveAttribute('aria-hidden', 'true');
    await userEvent.click(tabs()[1] as HTMLElement);
    expect(list.style.getPropertyValue('--care-x')).not.toBe('');
  });

  it('is one row at every width: the same weight of name whether chosen or not', () => {
    show('strong');
    // Nothing about a tab's name changes when it is chosen, so choosing one never reflows the others.
    for (const name of document.querySelectorAll('.rp-care__tabname')) {
      expect(name.className).toBe('rp-care__tabname');
    }
  });

  it('counts the behaviours shown beside the level, and keeps them closed', async () => {
    show('strong');
    await userEvent.click(tabs()[2] as HTMLElement);
    const open = panel();
    expect(open.querySelector('.rp-care__basis')).toHaveTextContent(
      '2 of 4 behaviours shown (1 partly)',
    );
    expect(
      within(open).getByRole('button', { name: 'Show behaviours for Be resourceful' }),
    ).toHaveAttribute('aria-expanded', 'false');
  });

  it('shows each behaviour with its status in words, its note and at most one quote when opened', async () => {
    show('strong');
    await userEvent.click(tabs()[2] as HTMLElement);
    const open = panel();
    await userEvent.click(
      within(open).getByRole('button', { name: 'Show behaviours for Be resourceful' }),
    );
    expect(open).toHaveTextContent('Scoped who was affected');
    expect(open).toHaveTextContent('Partly shown');
    expect(open).toHaveTextContent('The deadline was acknowledged, but its scale was not asked.');
    expect(open).toHaveTextContent('Not shown');
    expect(open).toHaveTextContent('Not asked in this call.');
    expect(
      within(open).getAllByRole('link', { name: /See turn \d+ in the transcript/ }).length,
    ).toBeGreaterThanOrEqual(3);
    for (const item of open.querySelectorAll('.rp-behaviour')) {
      expect(item.querySelectorAll('blockquote').length).toBeLessThanOrEqual(1);
    }
  });

  it('says "Insufficient evidence" for a principle no quote backs, and still gives a next action', async () => {
    show('weak');
    const open = panel();
    expect(open).toHaveTextContent('Insufficient evidence');
    expect(within(open).queryByRole('blockquote')).not.toBeInTheDocument();
    expect(open).toHaveTextContent('Next action');
  });

  it('says Limited evidence for every principle of a short call, and offers no behaviours for one that has none', async () => {
    show('short');
    expect(within(region('CARE review')).getAllByText('Limited evidence')).toHaveLength(4);
    await userEvent.click(tabs()[1] as HTMLElement);
    expect(within(panel()).queryByRole('button', { name: /behaviours/ })).not.toBeInTheDocument();
  });

  it('keeps the CBCF position honest: said plainly first, then in the report’s own words, and never claims alignment', () => {
    show('strong');
    const note = region('CARE review').querySelector('.rp-care__cbcf') as HTMLElement;
    expect(note.textContent).toMatch(
      /^Firefly does not map this review to CBCF\.\s*CBCF mapping is not applied: awaiting authoritative source confirmation\.$/,
    );
    expect(region('CARE review')).toHaveTextContent(
      'CBCF mapping is not applied: awaiting authoritative source confirmation.',
    );
    expect(document.body.textContent).not.toMatch(
      /CBCF[- ]?(compliant|compliance|aligned|alignment|mapped to)/i,
    );
    expect(document.body.textContent).not.toMatch(/aligned (with|to) CBCF/i);
  });

  it('is left out for a report saved before CARE was read from the call', () => {
    show('legacy');
    expect(screen.queryByRole('region', { name: 'CARE review' })).not.toBeInTheDocument();
    expect(screen.queryByText('Communicate effectively')).not.toBeInTheDocument();
    expect(
      within(screen.getByRole('navigation', { name: 'On this page' })).queryByRole('link', {
        name: 'CARE review',
      }),
    ).not.toBeInTheDocument();
  });
});

describe('strengths and improvement opportunities', () => {
  it('shows each strength with its skill, title, reason, exact quote and a link to its turn', () => {
    show('strong');
    const section = region('Strengths');
    for (const strength of CALLS.strong.report.strengths) {
      const item = within(section)
        .getByRole('heading', { level: 3, name: strength.title })
        .closest('li') as HTMLElement;
      expect(item).toHaveTextContent(DIMENSIONS[strength.dimension].label);
      expect(item).toHaveTextContent(strength.whyItHelped);
      expect(item).toHaveTextContent(strength.quote);
      expect(
        within(item).getByRole('link', {
          name: `See turn ${strength.turnIndex} in the transcript`,
        }),
      ).toHaveAttribute('href', `#turn-${strength.turnIndex}`);
    }
  });

  it('says so, and points to the improvements, when no strength stood out', () => {
    show('weak');
    expect(region('Strengths')).toHaveTextContent(
      'No clear strength stood out in this call. The improvements below are the best place to start.',
    );
  });

  it('shows each improvement with its risk and the words, and the plain statement for a gap', () => {
    show('strong');
    const section = region('Improvement opportunities');
    const gap = within(section)
      .getByRole('heading', { level: 3, name: 'Did not ask what had been tried' })
      .closest('li') as HTMLElement;
    expect(gap).toHaveTextContent('Something that did not happen');
    expect(within(gap).queryByRole('link')).not.toBeInTheDocument();
    const said = within(section)
      .getByRole('heading', { level: 3, name: 'Did not confirm the tenant' })
      .closest('li') as HTMLElement;
    expect(said).toHaveTextContent('Can you tell me exactly what you see in the meeting chat');
    expect(
      within(said).getByRole('link', { name: 'See turn 2 in the transcript' }),
    ).toBeInTheDocument();
  });

  it('puts the better wording inside each improvement, as a comparison with what was said', () => {
    show('weak');
    const section = region('Improvement opportunities');
    const item = within(section)
      .getByRole('heading', { level: 3, name: 'Blamed the customer' })
      .closest('li') as HTMLElement;
    const wording = within(item).getByRole('group', { name: 'Better wording' });
    expect(wording).toHaveTextContent('You said');
    expect(wording).toHaveTextContent('Try');
    expect(wording).toHaveTextContent("I'm sorry twelve of your staff can't work.");
    expect(wording).toHaveTextContent('It names the impact and moves straight to the problem.');
    expect(within(section).getAllByRole('group', { name: 'Better wording' })).toHaveLength(3);
    expect(screen.queryByRole('region', { name: 'Better wording' })).not.toBeInTheDocument();
  });

  it('says nothing was said when the improvement is about something that never happened', () => {
    show('strong');
    const gap = within(region('Improvement opportunities'))
      .getByRole('heading', { level: 3, name: 'Did not ask what had been tried' })
      .closest('li') as HTMLElement;
    const wording = within(gap).getByRole('group', { name: 'Better wording' });
    expect(wording).toHaveTextContent('Not said in this call');
    expect(wording).toHaveTextContent('what have you or your admin already tried');
  });

  it('says so when there is no improvement to show', () => {
    showReport('strong', { ...CALLS.strong.report, improvements: [] });
    expect(region('Improvement opportunities')).toHaveTextContent(
      'No specific improvement stood out in this call.',
    );
  });
});

describe('discovery review', () => {
  const found = (name: RegExp | string) =>
    within(region('Discovery review'))
      .getByRole('heading', { level: 4, name })
      .closest('li') as HTMLElement;
  /** The button that opens a fact that was found: the whole line is its name. */
  const rowButton = (item: HTMLElement) => within(item).getByRole('button');

  it('says how many hidden facts were found, and splits them into found, partly found and missed', () => {
    show('strong');
    const section = region('Discovery review');
    expect(section).toHaveTextContent('3 of 5 hidden facts found');
    expect(
      within(section)
        .getAllByRole('heading', { level: 3 })
        .map((h) => h.textContent),
    ).toEqual(['Found (3)', 'Partly found (1)', 'Missed (1)']);
    // Within a group, the facts that mattered most come first.
    expect([...section.querySelectorAll('.rp-fact__title')].map((t) => t.textContent)).toEqual([
      'Storage settings changed last week',
      'Only sales-organised meetings are affected',
      'The first recording went missing on Monday',
      'Most missing recordings were meetings with external guests',
      'Two organisers lost their OneDrive licence',
    ]);
  });

  it('makes each fact that was found one line, with how much it mattered and the turn, closed at first', () => {
    show('strong');
    const item = found(/^Storage settings changed last week/);
    const button = rowButton(item);
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).toHaveTextContent('Storage settings changed last week');
    expect(button).toHaveTextContent('Critical');
    expect(button).toHaveTextContent('Turn 6');
    expect(within(item).getByText('You asked')).not.toBeVisible();
    expect(within(item).queryByRole('link')).not.toBeInTheDocument();
  });

  it('opens a found fact in place to the question that found it, what the customer answered and why it mattered', async () => {
    show('strong');
    const item = found(/^Storage settings changed last week/);
    const button = rowButton(item);
    await userEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(within(item).getByText('You asked')).toBeVisible();
    expect(item).toHaveTextContent('Did anything change recently, such as a licence update');
    expect(within(item).getByText('The customer answered')).toBeVisible();
    // The customer's reply to turn 6 is turn 7, exactly as it was said.
    expect(item).toHaveTextContent(
      "Our admin changed the storage settings last week, but I don't know exactly what.",
    );
    expect(
      within(item).getByRole('link', { name: 'See turn 6 in the transcript' }),
    ).toBeInTheDocument();
    expect(
      within(item).getByRole('link', { name: 'See turn 7 in the transcript' }),
    ).toBeInTheDocument();
    expect(within(item).getByText('Why it mattered')).toBeVisible();
    expect(item).toHaveTextContent('The cause sat in a recent change');
    expect(item).not.toHaveTextContent('A question worth asking');
    await userEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });

  it('shows how much a fact mattered in a different shape for each: critical strongest, with an icon', () => {
    show('strong');
    const critical = found(/^Storage settings changed last week/).querySelector('.ff-badge');
    expect(critical).toHaveTextContent('Critical');
    expect(critical?.querySelector('svg')).not.toBeNull();
    const important = found(/^Only sales-organised meetings are affected/).querySelector(
      '.ff-badge',
    );
    expect(important).toHaveTextContent('Important');
    expect(important?.className).not.toBe(critical?.className);
    const helpful = found(/^Most missing recordings/).querySelector('.ff-tag');
    expect(helpful).toHaveTextContent('Helpful');
  });

  it('shows a missed fact with why it mattered and a question worth asking, and the customer’s words behind an expand', async () => {
    show('strong');
    const item = found('Two organisers lost their OneDrive licence');
    expect(within(item).queryByRole('link')).not.toBeInTheDocument();
    expect(within(item).getByText('Why it mattered')).toBeInTheDocument();
    expect(within(item).getByText('A question worth asking')).toBeInTheDocument();
    expect(item).toHaveTextContent(
      'Do the organisers with missing recordings still have their OneDrive licence?',
    );
    const hidden = 'Two sales organisers were moved to a plan without OneDrive storage.';
    expect(within(item).getByText(hidden)).not.toBeVisible();
    const expand = within(item).getByRole('button', {
      name: 'Show what the customer would have said for Two organisers lost their OneDrive licence',
    });
    expect(expand).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(expand);
    expect(expand).toHaveAttribute('aria-expanded', 'true');
    expect(within(item).getByText(hidden)).toBeVisible();
  });

  it('shows a partly found fact with both: what was found and what was still missing', async () => {
    show('strong');
    const item = found(/^Most missing recordings were meetings with external guests/);
    expect(item).toHaveTextContent('Partly found');
    await userEvent.click(rowButton(item));
    expect(within(item).getByText('You asked')).toBeVisible();
    expect(within(item).getByText('A question worth asking')).toBeVisible();
  });

  it('has one callout for a question worth asking, and no second one that says the same', () => {
    show('strong');
    const section = region('Discovery review');
    expect(within(section).queryByText('Suggested question')).not.toBeInTheDocument();
    expect(within(section).queryByText('A better question')).not.toBeInTheDocument();
    // One for the missed fact and one for the partly found fact: never one for a fact that was found.
    expect(section.querySelectorAll('.rp-ask')).toHaveLength(2);
    expect(
      [...section.querySelectorAll('.rp-ask')].some((ask) =>
        ask.textContent?.includes(
          '\u201cDo the organisers with missing recordings still have their OneDrive licence?\u201d',
        ),
      ),
    ).toBe(true);
  });

  it('speaks to the trainee in one voice: "You asked", and no "the engineer"', async () => {
    show('strong');
    await userEvent.click(rowButton(found(/^Storage settings changed last week/)));
    expect(region('Discovery review')).toHaveTextContent('You asked');
    expect(region('Discovery review').textContent).not.toMatch(/\bthe engineer\b/i);
  });

  it('gives the whole width to the found or the missed facts when the other has none', () => {
    show('strong');
    expect(region('Discovery review').querySelector('.rp-discovery__columns')).toHaveClass(
      'rp-discovery__columns--two',
    );
    cleanup();
    show('weak');
    const columns = region('Discovery review').querySelector('.rp-discovery__columns');
    expect(columns).not.toHaveClass('rp-discovery__columns--two');
    expect(columns?.querySelectorAll('.rp-discovery__column')).toHaveLength(1);
    expect(region('Discovery review')).toHaveTextContent('Missed (3)');
  });

  it('opens every fact for paper, and closes them again afterwards', () => {
    show('strong');
    const button = rowButton(found(/^Storage settings changed last week/));
    expect(button).toHaveAttribute('aria-expanded', 'false');
    act(() => {
      window.dispatchEvent(new Event('beforeprint'));
    });
    expect(button).toHaveAttribute('aria-expanded', 'true');
    act(() => {
      window.dispatchEvent(new Event('afterprint'));
    });
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });

  it('has no callout when every fact was found, and says when there was nothing to find', () => {
    const results = CALLS.strong.report.discovery.results.filter((r) => r.status === 'discovered');
    showReport('strong', {
      ...CALLS.strong.report,
      discovery: { results, found: 3, partial: 0, missed: 0, total: 3 },
    });
    expect(screen.queryByText('A question worth asking')).not.toBeInTheDocument();
    cleanup();
    showReport('strong', {
      ...CALLS.strong.report,
      discovery: { results: [], found: 0, partial: 0, missed: 0, total: 0 },
    });
    expect(region('Discovery review')).toHaveTextContent(
      'This scenario had no hidden facts to find.',
    );
  });

  it('shows no answer when the call ended on the trainee’s question, and no question the turn does not say', async () => {
    const { report, session } = CALLS.strong;
    const results = report.discovery.results.map((r) =>
      r.factId === 'first-missing'
        ? { ...r, revealedAtTurn: 14, revealingQuestion: 'a question nobody asked' }
        : r,
    );
    renderAtReport(
      <ReportView
        session={{ ...session, turns: session.turns.slice(0, 14) }}
        report={{ ...report, discovery: { ...report.discovery, results } }}
        client={scriptedClient(session)}
        reveal={false}
      />,
    );
    const item = found(/^The first recording went missing on Monday/);
    await userEvent.click(rowButton(item));
    expect(item).toHaveTextContent('Insufficient evidence');
    expect(item).not.toHaveTextContent('a question nobody asked');
    expect(within(item).queryByText('The customer answered')).not.toBeInTheDocument();
  });
});

describe('next practice', () => {
  it('recommends one scenario by title, product and difficulty, with the target skill as its heading and the learning focus', async () => {
    show('strong');
    const section = region('Next practice');
    // The skill it is for is the heading; the scenario is named under it.
    expect(within(section).getByRole('heading', { level: 3 })).toHaveTextContent(
      'Scoping & Discovery',
    );
    expect(section).toHaveTextContent('Target skill');
    expect(section).toHaveTextContent('Staff locked out after an MFA change');
    await within(section).findByText('Microsoft Entra ID');
    expect(section).toHaveTextContent('Standard');
    expect(section).toHaveTextContent('Learning focus');
    expect(section).toHaveTextContent(CALLS.strong.report.nextPractice.recommendation);
    expect(within(section).getByRole('link', { name: 'Practise this scenario' })).toHaveAttribute(
      'href',
      '/scenarios?scenario=entra-mfa-lockout&difficulty=standard',
    );
  });

  it('makes the way on the primary button', () => {
    show('strong');
    const cta = within(region('Next practice')).getByRole('link', {
      name: 'Practise this scenario',
    });
    expect(cta).toHaveClass('ff-button--primary');
  });

  it('gives the learning focus as one sentence shown whole, with no "Show more" and nothing cut', () => {
    const { report } = CALLS.strong;
    const focus =
      'In your next call, ask about three different areas before you suggest any fix (what exactly happens, when it started, what changed), then ask what the customer has already tried.';
    const example =
      'From this call, a question worth practising: \u201cDid anything change while you were away?\u201d';
    showReport('strong', {
      ...report,
      nextPractice: { ...report.nextPractice, recommendation: `${focus} ${example}` },
    });
    const section = region('Next practice');
    expect(section.querySelector('.rp-next__text')?.textContent).toBe(focus);
    expect(section.querySelector('.rp-next__more')?.textContent).toBe(example);
    expect(within(section).queryByRole('button', { name: 'Show more' })).not.toBeInTheDocument();
    expect(section.textContent).not.toContain('\u2026');
  });

  it('shows the skill and the title from the report while the scenario list is still on its way', () => {
    const waiting = scriptedClient(CALLS.weak.session);
    waiting.scenarios.mockReturnValue(new Promise(() => undefined));
    show('weak', waiting);
    const section = region('Next practice');
    expect(within(section).getByRole('heading', { level: 3 })).toHaveTextContent(
      CALLS.weak.report.nextPractice.dimension === 'empathy-deescalation'
        ? 'Empathy & De-escalation'
        : /.+/,
    );
    expect(section).toHaveTextContent('Shared calendar is not updating');
  });

  it('offers the scenario list instead when the suggested scenario no longer exists', async () => {
    show('legacy');
    const section = region('Next practice');
    expect(within(section).getByRole('link', { name: 'Choose a scenario' })).toHaveAttribute(
      'href',
      '/scenarios',
    );
    expect(section).not.toHaveTextContent('Recurring midday slowdowns');
    expect(within(section).getByRole('heading', { level: 3 })).toHaveTextContent(
      'Scoping & Discovery',
    );
  });

  it('offers the scenario list when no scenario is suggested', () => {
    showReport('weak', {
      ...CALLS.weak.report,
      nextPractice: {
        ...CALLS.weak.report.nextPractice,
        suggestedScenarioId: null,
        suggestedScenarioTitle: null,
      },
    });
    expect(
      within(region('Next practice')).getByRole('link', { name: 'Choose a scenario' }),
    ).toHaveAttribute('href', '/scenarios');
  });
});

describe('actions', () => {
  it('has the five actions: another call, the same scenario, the whole transcript, print and home', () => {
    show('curveball');
    const section = region('Actions');
    expect(within(section).getByRole('link', { name: 'Try another call' })).toHaveAttribute(
      'href',
      '/scenarios',
    );
    expect(within(section).getByRole('link', { name: 'Repeat scenario' })).toHaveAttribute(
      'href',
      toBriefHref(CALLS.curveball.session),
    );
    expect(
      within(section).getByRole('button', { name: 'Review full transcript' }),
    ).toBeInTheDocument();
    expect(within(section).getByRole('button', { name: 'Print report' })).toBeInTheDocument();
    expect(within(section).getByRole('link', { name: 'Return home' })).toHaveAttribute('href', '/');
    expect(section).not.toHaveTextContent('no longer available');
  });

  it('offers no share or export, because nothing here sends a report anywhere', () => {
    show('strong');
    expect(
      screen.queryByRole('button', { name: /share|export|download|email/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: /share|export|download|email/i }),
    ).not.toBeInTheDocument();
  });

  it('falls back to the scenario list, and says why, when the scenario of the call is gone', async () => {
    const { client } = show('legacy');
    const section = region('Actions');
    const repeat = within(section).getByRole('link', { name: 'Repeat scenario' });
    expect(repeat).toHaveAttribute('href', '/scenarios');
    expect(repeat).toHaveAccessibleDescription(
      'This scenario is no longer available, so Repeat scenario opens the scenario list.',
    );
    await vi.waitFor(() => expect(client.scenarios).toHaveBeenCalledTimes(1));
    // Following it lands on the list, not on a brief for a scenario that is gone.
    await userEvent.click(repeat);
    expect(await screen.findByText('Scenarios page')).toBeInTheDocument();
  });

  it('decides from the list of scenarios once it arrives, even for a call that has a product', async () => {
    const gone = scriptedClient(CALLS.strong.session);
    gone.scenarios.mockResolvedValue(
      SCENARIO_INDEX.filter((s) => s.id !== 'teams-recordings-missing'),
    );
    show('strong', gone);
    const link = await within(region('Actions')).findByRole('link', { name: 'Repeat scenario' });
    await vi.waitFor(() => expect(link).toHaveAttribute('href', '/scenarios'));
  });

  it('keeps the brief link when the list of scenarios cannot be loaded for a call that has a product', async () => {
    const down = scriptedClient(CALLS.strong.session);
    down.scenarios.mockRejectedValue(new ApiError(0, 'network', 'offline', true));
    show('strong', down);
    await vi.waitFor(() => expect(down.scenarios).toHaveBeenCalled());
    expect(
      within(region('Actions')).getByRole('link', { name: 'Repeat scenario' }),
    ).toHaveAttribute('href', toBriefHref(CALLS.strong.session));
  });

  it('works with a client that cannot list scenarios at all', () => {
    const plain = scriptedClient(CALLS.legacy.session);
    const { scenarios: _scenarios, ...rest } = plain;
    show('legacy', rest as FakeClient);
    expect(
      within(region('Actions')).getByRole('link', { name: 'Repeat scenario' }),
    ).toHaveAttribute('href', '/scenarios');
  });

  it('opens the transcript and prints from the buttons', async () => {
    const { restore } = stubScroll();
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    try {
      show('strong');
      const section = region('Actions');
      await userEvent.click(within(section).getByRole('button', { name: 'Print report' }));
      expect(print).toHaveBeenCalledTimes(1);
      await userEvent.click(
        within(section).getByRole('button', { name: 'Review full transcript' }),
      );
      expect(screen.getByRole('heading', { level: 2, name: 'Transcript' })).toHaveFocus();
    } finally {
      restore();
    }
  });

  it('asks before deleting, says what goes, and does nothing on Cancel', async () => {
    const { client } = show('strong');
    const opener = screen.getByRole('button', { name: 'Delete this call' });
    await userEvent.click(opener);
    const dialog = await screen.findByRole('dialog', { name: 'Delete this call?' });
    expect(dialog).toHaveTextContent(
      'The transcript and the coaching report for this call are removed from this device.',
    );
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(client.deleteSession).not.toHaveBeenCalled();
    expect(opener).toHaveFocus();
  });

  it('closes on Escape without deleting', async () => {
    const { client } = show('strong');
    await userEvent.click(screen.getByRole('button', { name: 'Delete this call' }));
    const dialog = await screen.findByRole('dialog');
    // The browser sends `cancel` for Escape; jsdom does not, so send it.
    fireEvent(dialog, new Event('cancel', { cancelable: true }));
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(client.deleteSession).not.toHaveBeenCalled();
  });

  it('deletes the call and goes to the scenarios when confirmed', async () => {
    const { client, router } = show('strong');
    await userEvent.click(screen.getByRole('button', { name: 'Delete this call' }));
    const dialog = await screen.findByRole('dialog', { name: 'Delete this call?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete call' }));
    expect(client.deleteSession).toHaveBeenCalledWith('fx-strong');
    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/scenarios'));
    expect(await screen.findByText('Scenarios page')).toBeInTheDocument();
  });

  it('keeps the dialog open and says why when the call could not be deleted', async () => {
    const client = scriptedClient(CALLS.strong.session);
    client.deleteSession.mockRejectedValue(
      new ApiError(500, 'internal', 'Something went wrong on our side. Please try again.', true),
    );
    const { router } = show('strong', client);
    await userEvent.click(screen.getByRole('button', { name: 'Delete this call' }));
    const dialog = await screen.findByRole('dialog', { name: 'Delete this call?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete call' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('The call was not deleted');
    expect(dialog).toHaveTextContent('Something went wrong on our side. Please try again.');
    expect(dialog).toHaveTextContent('Nothing was removed.');
    expect(router.state.location.pathname).toBe('/sessions/s1/report');
    expect(within(dialog).getByRole('button', { name: 'Delete call' })).toBeEnabled();
  });
});

describe('about this report', () => {
  const about = () => region('About this report');
  const details = () => about().querySelector('details') as HTMLDetailsElement;

  it('is closed until it is wanted', () => {
    show('strong');
    expect(details().open).toBe(false);
  });

  it('says in one plain line that coaching is practice feedback and that CBCF mapping is not applied', async () => {
    show('strong');
    await userEvent.click(screen.getByRole('heading', { level: 2, name: 'About this report' }));
    expect(details().open).toBe(true);
    expect(about()).toHaveTextContent(
      'Automatic practice feedback, not an assessment. CBCF mapping is not applied: it is awaiting an authoritative source.',
    );
  });

  it('says the same about an older report, without the status it never had', async () => {
    show('legacy');
    await userEvent.click(screen.getByRole('heading', { level: 2, name: 'About this report' }));
    expect(about()).toHaveTextContent(
      'Automatic practice feedback, not an assessment. CBCF mapping is not applied.',
    );
    expect(about()).not.toHaveTextContent('awaiting an authoritative source');
  });

  it('explains the 1 to 5 scale and the six skills', async () => {
    show('strong');
    await userEvent.click(screen.getByRole('heading', { level: 2, name: 'About this report' }));
    expect(about()).toHaveTextContent('5 of 5, Excellent');
    expect(about()).toHaveTextContent('Critical behaviours were absent or counterproductive.');
    for (const id of DIMENSION_IDS) {
      expect(about()).toHaveTextContent(DIMENSIONS[id].label);
    }
  });

  it('names who played the customer and who wrote the coaching, and says demo mode and synthetic', async () => {
    show('strong');
    await userEvent.click(screen.getByRole('heading', { level: 2, name: 'About this report' }));
    expect(about()).toHaveTextContent('Priya Nair, IT coordinator, Fabrikam Logistics (synthetic)');
    expect(about()).toHaveTextContent(
      "Firefly's built-in rules engine (demo mode), not a language model",
    );
    expect(about()).toHaveTextContent("Firefly's built-in rules evaluator (demo mode)");
    expect(about()).toHaveTextContent('Firefly rules evaluator (rules-2.0.0)');
    expect(about()).toHaveTextContent(CALLS.strong.report.trainingNote);
    expect(
      within(about()).getByRole('link', { name: 'How Firefly uses AI and speech' }),
    ).toHaveAttribute('href', '/responsible-ai');
  });

  it('names a language model by its real label when one wrote the coaching', async () => {
    const model: CoachingReport = {
      ...CALLS.strong.report,
      evaluator: {
        kind: 'model',
        name: 'Firefly model evaluator',
        version: 'v1',
        providerLabel: 'Gemini (gemini-3.5-flash-lite)',
      },
    };
    const session = {
      ...withReport(CALLS.strong, model),
      providerKind: 'gemini' as const,
      providerLabel: 'Gemini (gemini-3.5-flash-lite)',
    };
    renderAtReport(
      <ReportView
        session={session}
        report={model}
        client={scriptedClient(session)}
        reveal={false}
      />,
    );
    await userEvent.click(screen.getByRole('heading', { level: 2, name: 'About this report' }));
    expect(about()).toHaveTextContent('the language model Gemini (gemini-3.5-flash-lite)');
    expect(screen.queryByText('Demo mode')).not.toBeInTheDocument();
  });

  it('is opened, and its heading focused, from "About this report" in the summary', async () => {
    const { restore } = stubScroll();
    try {
      show('strong');
      await userEvent.click(
        within(region('Summary')).getByRole('link', { name: 'About this report' }),
      );
      expect(details().open).toBe(true);
      expect(screen.getByRole('heading', { level: 2, name: 'About this report' })).toHaveFocus();
    } finally {
      restore();
    }
  });
});

describe('the page as a document', () => {
  it('has one level-one heading and no skipped levels, for every call', () => {
    for (const name of ['strong', 'weak', 'short', 'curveball', 'legacy'] as const) {
      show(name);
      const levels = screen.getAllByRole('heading').map((h) => Number(h.tagName.slice(1)));
      expect(
        levels.filter((l) => l === 1),
        name,
      ).toHaveLength(1);
      levels.forEach((level, i) => {
        if (i > 0)
          expect(level, `${name} heading ${i}`).toBeLessThanOrEqual((levels[i - 1] as number) + 1);
      });
      cleanup();
    }
  });

  it('lists its parts as named regions in the order the navigation lists them, and the seven questions in order', () => {
    show('strong');
    const regions = screen
      .getAllByRole('region')
      .map(
        (r) => document.getElementById(r.getAttribute('aria-labelledby') as string)?.textContent,
      );
    const nav = within(screen.getByRole('navigation', { name: 'On this page' }))
      .getAllByRole('link')
      .map((l) => l.textContent);
    expect(regions).toEqual(nav);
    expect(regions).toEqual([
      'Summary',
      'Call journey',
      'Scores',
      'CARE review',
      'Customer experience',
      'Discovery review',
      'Strengths',
      'Improvement opportunities',
      'Next practice',
      'Actions',
      'Transcript',
      'About this report',
    ]);
  });

  it('leaves out the call journey when the report holds no moment, and still lists every other part', () => {
    showReport('legacy', {
      ...CALLS.legacy.report,
      discovery: { results: [], found: 0, partial: 0, missed: 0, total: 0 },
      journey: {
        ...CALLS.legacy.report.journey,
        points: CALLS.legacy.report.journey.points.map((p) => ({ ...p, kind: 'turn' as const })),
      },
    });
    expect(screen.queryByRole('region', { name: 'Call journey' })).not.toBeInTheDocument();
    expect(
      within(screen.getByRole('navigation', { name: 'On this page' })).queryByRole('link', {
        name: 'Call journey',
      }),
    ).not.toBeInTheDocument();
  });

  it('gives every table a caption and every control and link a name', () => {
    show('curveball');
    for (const table of document.querySelectorAll('table')) {
      expect(table.querySelector('caption')?.textContent?.trim(), 'table caption').toBeTruthy();
    }
    for (const control of [
      ...screen.getAllByRole('button'),
      ...screen.getAllByRole('link'),
      ...screen.getAllByRole('searchbox'),
      ...screen.getAllByRole('radio'),
    ]) {
      expect(control).toHaveAccessibleName();
    }
    for (const img of screen.queryAllByRole('img')) expect(img).toHaveAccessibleName();
  });

  it('has the same places in a Jump to disclosure for narrow screens', () => {
    show('strong');
    const jump = screen.getByRole('navigation', { name: 'Jump to' });
    expect(
      within(jump)
        .getAllByRole('link')
        .map((l) => l.textContent),
    ).toEqual(
      within(screen.getByRole('navigation', { name: 'On this page' }))
        .getAllByRole('link')
        .map((l) => l.textContent),
    );
  });

  it('says which part of the report is current as it is scrolled (the navigation marks it)', () => {
    show('strong');
    const nav = screen.getByRole('navigation', { name: 'On this page' });
    expect(within(nav).getByRole('link', { name: 'Summary' })).toHaveAttribute(
      'aria-current',
      'location',
    );
    expect(within(nav).getAllByRole('link')).toHaveLength(12);
  });

  it('jumps to a section and puts focus on its heading', async () => {
    const { scroll, restore } = stubScroll();
    try {
      show('strong');
      const nav = screen.getByRole('navigation', { name: 'On this page' });
      await userEvent.click(within(nav).getByRole('link', { name: 'Discovery review' }));
      expect(screen.getByRole('heading', { level: 2, name: 'Discovery review' })).toHaveFocus();
      expect(scroll).toHaveBeenCalled();
    } finally {
      restore();
    }
  });

  it('has no achievements, points, streaks or badges earned anywhere', () => {
    for (const name of ['strong', 'weak', 'short', 'curveball', 'legacy'] as const) {
      show(name);
      expect(document.body.textContent, name).not.toMatch(
        /achievement|streak|leaderboard|level up|unlocked|badge earned|\bXP\b|\d+ points\b/i,
      );
      cleanup();
    }
  });

  it('never calls the engine’s unexpected moment a curveball, in any call', () => {
    for (const name of ['strong', 'curveball', 'weak'] as const) {
      show(name);
      expect(document.body).not.toHaveTextContent(/curveball/i);
      cleanup();
    }
  });
});

// Version 1 reports (saved before CARE and milestones) still render, whole.
describe('an older report', () => {
  it('shows the six scores, the experience, discovery, strengths, improvements and the transcript', () => {
    showReport('strong', asVersion1(CALLS.strong.report));
    for (const name of [
      'Summary',
      'Call journey',
      'Scores',
      'Customer experience',
      'Discovery review',
      'Strengths',
      'Improvement opportunities',
      'Next practice',
      'Actions',
      'Transcript',
    ]) {
      expect(region(name)).toBeInTheDocument();
    }
    expect(within(region('Scores')).getAllByRole('listitem')).toHaveLength(6);
    expect(screen.queryByRole('region', { name: 'CARE review' })).not.toBeInTheDocument();
  });
});
