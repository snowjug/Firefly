import { act, cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CoachingReport } from '#shared/domain/report.ts';
import { ReportView } from './ReportView.tsx';
import { CALLS, withReport, type CallName } from './fixtures.ts';
import {
  renderAtReport,
  scriptedClient,
  stubMatchMedia,
  stubScroll,
  type FakeClient,
} from './test-utils.tsx';

// The call journey: the moments of the call, chosen on a rail (wide) or in a list (narrow), the exact
// turn that shows each, and the agreement with the transcript in both directions.

// Role queries over a whole report are slow in jsdom, and slower on a busy machine.
vi.setConfig({ testTimeout: 20_000 });

let restoreScroll: () => void;
let restoreMedia: (() => void) | null = null;

beforeEach(() => {
  restoreScroll = stubScroll().restore;
});

afterEach(() => {
  cleanup();
  restoreScroll();
  restoreMedia?.();
  restoreMedia = null;
});

const wide = () => {
  restoreMedia = stubMatchMedia((query) => query.includes('min-width: 48em'));
};

function show(name: CallName, report: CoachingReport = CALLS[name].report) {
  const call = CALLS[name];
  const client: FakeClient = scriptedClient(call.session);
  return renderAtReport(
    <ReportView
      session={withReport(call, report)}
      report={report}
      client={client}
      reveal={false}
    />,
  );
}

const section = () => screen.getByRole('region', { name: 'Call journey' });
const rail = () => within(section()).getByRole('tablist', { name: 'Moments in the call' });
const tabs = () => within(rail()).getAllByRole('tab');
const tabNamed = (name: RegExp | string) => within(rail()).getByRole('tab', { name });
const panel = () => within(section()).getByRole('tabpanel');
const turn = (index: number) => document.getElementById(`turn-${index}`) as HTMLElement;
/** The words the page has just announced politely to a screen reader. */
const announced = () =>
  document.querySelector('[role="status"][aria-live="polite"][aria-atomic="true"]')?.textContent ??
  '';

/** The strong call, with the greeting backed only by a quote its turn does not say. */
function tamperedGreeting(): CoachingReport {
  const { report } = CALLS.strong;
  return {
    ...report,
    care: undefined,
    journey: {
      ...report.journey,
      milestones: report.journey.milestones?.map((m) =>
        m.id === 'greeting' ? { ...m, quote: 'words nobody said' } : m,
      ),
    },
  };
}

/**
 * The strong call, with "confirmed what the issue was" listed among the behaviours it did not show:
 * the call needed it and never got there, so the journey has a moment that was not reached.
 */
function issueNeeded(): CoachingReport {
  const { report } = CALLS.strong;
  return {
    ...report,
    care: report.care?.map((p) =>
      p.id === 'communicate'
        ? {
            ...p,
            behaviours: [
              ...p.behaviours,
              {
                id: 'communicate.context-confirmed',
                principle: 'communicate',
                label: 'Confirmed the context',
                status: 'not-shown',
                evidence: [],
                note: null,
              } as const,
            ],
          }
        : p,
    ),
  };
}

/** A ResizeObserver that tells the page the width of the element it watches, when a test says so. */
class FakeResizeObserver {
  static instances: FakeResizeObserver[] = [];
  private element: Element | null = null;
  private readonly callback: ResizeObserverCallback;
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    FakeResizeObserver.instances.push(this);
  }
  observe(element: Element) {
    this.element = element;
  }
  unobserve() {}
  disconnect() {
    this.element = null;
  }
  static widthOf(className: string, width: number) {
    const observer = FakeResizeObserver.instances.find((o) =>
      o.element?.classList.contains(className),
    );
    if (!observer) throw new Error(`Nothing observes .${className}`);
    observer.callback(
      [{ target: observer.element, contentRect: { width } } as unknown as ResizeObserverEntry],
      observer as never,
    );
  }
}

describe('on a wide screen: a rail of moments', () => {
  beforeEach(wide);

  it('lists the moments of the call in call order, each with its turn, or with "Not reached"', () => {
    show('strong', issueNeeded());
    expect(tabs().map((tab) => tab.textContent)).toEqual([
      'Greeting, Turn 2',
      'Issue established, Not reached',
      'Impact established, Turn 2',
      'Fact found: Only sales-organised meetings are affected, Turn 4',
      'Tension eased, Turn 4',
      'Fact found: Storage settings changed last week, Turn 6',
      'Fact partly found: Most missing recordings were meetings with external guests, Turn 6',
      'Fact found: The first recording went missing on Monday, Turn 8',
      'Ownership, Turn 8',
      'Tension eased, Turn 10',
      'Next steps, Turn 10',
      'Summary, Turn 12',
      'Closing, Turn 14',
    ]);
  });

  it('draws no moment for something the call never needed', () => {
    show('strong');
    expect(tabs().map((tab) => tab.textContent)).not.toContain('Issue established, Not reached');
    expect(tabs()).toHaveLength(12);
    expect(within(rail()).queryByText(/Not reached|Not seen/)).toBeNull();
  });

  it('has one tab stop, with the first moment that was seen selected and its exact turn shown', () => {
    show('strong');
    expect(tabs().filter((tab) => tab.tabIndex === 0)).toHaveLength(1);
    expect(tabs()[0]).toHaveAttribute('aria-selected', 'true');
    expect(tabs()[0]).toHaveAttribute('tabindex', '0');
    const shown = panel();
    expect(shown).toHaveAttribute('aria-labelledby', tabs()[0]?.id);
    expect(shown).toHaveTextContent('Turn 2');
    expect(shown).toHaveTextContent(CALLS.strong.session.turns[1]?.text ?? '');
    expect(within(shown).getByRole('button', { name: 'Open in transcript' })).toBeInTheDocument();
  });

  it('shows the turn before and the turn after, labelled, so the moment makes sense', () => {
    show('strong');
    const shown = panel();
    expect(within(shown).getByText('Before')).toBeInTheDocument();
    expect(within(shown).getByText('After')).toBeInTheDocument();
    expect(shown).toHaveTextContent('Turn 1, Priya Nair');
    expect(shown).toHaveTextContent('Turn 3, Priya Nair');
  });

  it('marks the words the moment is about, inside the turn, and changes nothing else in it', async () => {
    show('strong');
    await userEvent.click(tabNamed(/^Next steps/));
    const turnText = CALLS.strong.session.turns.find((t) => t.index === 10)?.text ?? '';
    const marked = [...panel().querySelectorAll('mark')].map((m) => m.textContent).join('');
    expect(marked).not.toBe('');
    expect(turnText).toContain(marked.replace(/[.?!]$/, ''));
    // The turn is whole, with the marked words inside it.
    expect(panel().querySelector('.rp-ev__turn--current')?.textContent).toContain(turnText);
  });

  it('says plainly that a moment was not reached, with no words and nothing to open', async () => {
    show('strong', issueNeeded());
    await userEvent.click(tabNamed(/^Issue established/));
    const shown = panel();
    expect(shown).toHaveTextContent('Not reached in this call.');
    expect(shown.querySelector('mark')).toBeNull();
    expect(within(shown).queryByRole('button', { name: 'Open in transcript' })).toBeNull();
    expect(shown.querySelector('blockquote')).toBeNull();
  });

  it('moves with the arrow keys, Home and End, wraps round, and selects as it goes', async () => {
    const user = userEvent.setup();
    show('strong', issueNeeded());
    tabs()[0]?.focus();
    await user.keyboard('{ArrowRight}');
    expect(tabs()[1]).toHaveFocus();
    expect(tabs()[1]).toHaveAttribute('aria-selected', 'true');
    expect(tabs()[1]).toHaveAttribute('tabindex', '0');
    expect(tabs()[0]).toHaveAttribute('tabindex', '-1');
    expect(panel()).toHaveTextContent('Not reached in this call.');
    await user.keyboard('{End}');
    expect(tabs().at(-1)).toHaveFocus();
    expect(panel()).toHaveTextContent('Turn 14');
    await user.keyboard('{ArrowRight}');
    expect(tabs()[0]).toHaveFocus();
    await user.keyboard('{ArrowLeft}');
    expect(tabs().at(-1)).toHaveFocus();
    await user.keyboard('{Home}');
    expect(tabs()[0]).toHaveFocus();
  });

  it('leaves the rail on Tab for the exact turn, instead of walking through every moment', async () => {
    const user = userEvent.setup();
    show('strong');
    tabs()[0]?.focus();
    await user.tab();
    expect(panel()).toHaveFocus();
  });

  it('marks the turn in the transcript when a moment is chosen, and names the moment there', async () => {
    show('strong');
    await userEvent.click(tabNamed(/^Fact found: Storage settings changed last week/));
    expect(turn(6)).toHaveClass('rp-turn--marked');
    expect(document.querySelectorAll('.rp-turn--marked')).toHaveLength(1);
    expect(within(turn(6)).getByRole('button', { name: /^Turn 6/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(turn(6)).toHaveTextContent('On the call journey: Fact found');
    expect(within(turn(6)).getByRole('link', { name: 'Show on the call journey' })).toHaveAttribute(
      'href',
      '#journey',
    );
  });

  it('marks nothing in the transcript for a moment that was not reached', async () => {
    show('strong', issueNeeded());
    await userEvent.click(tabNamed(/^Fact found: Storage settings changed last week/));
    await userEvent.click(tabNamed(/^Issue established/));
    expect(document.querySelectorAll('.rp-turn--marked')).toHaveLength(0);
  });

  it('goes to the turn in the full transcript from "Open in transcript", and back again', async () => {
    show('strong');
    await userEvent.click(tabNamed(/^Ownership/));
    await userEvent.click(within(panel()).getByRole('button', { name: 'Open in transcript' }));
    expect(turn(8)).toHaveFocus();
    await userEvent.click(screen.getByRole('button', { name: 'Back to Call journey' }));
    expect(screen.queryByRole('button', { name: /^Back to/ })).not.toBeInTheDocument();
  });

  it('selects the nearest moment when a turn is chosen in the transcript, and says so', async () => {
    show('strong');
    await userEvent.click(within(turn(12)).getByRole('button', { name: /^Turn 12/ }));
    expect(tabs().find((tab) => tab.getAttribute('aria-selected') === 'true')).toHaveTextContent(
      'Summary, Turn 12',
    );
    expect(turn(12)).toHaveClass('rp-turn--marked');
    expect(announced()).toBe('Call journey: Summary, turn 12, selected.');
  });

  it('says it is the nearest moment when the turn chosen is not one of them', async () => {
    show('strong');
    await userEvent.click(within(turn(13)).getByRole('button', { name: /^Turn 13/ }));
    expect(announced()).toMatch(/^Call journey: .+, the nearest moment to turn 13, selected\.$/);
    expect(turn(13)).toHaveClass('rp-turn--marked');
  });

  it('takes the mark off when the marked turn is chosen again, and keeps the moment selected', async () => {
    show('strong');
    const pick = within(turn(12)).getByRole('button', { name: /^Turn 12/ });
    await userEvent.click(pick);
    await userEvent.click(pick);
    expect(document.querySelectorAll('.rp-turn--marked')).toHaveLength(0);
    expect(pick).toHaveAttribute('aria-pressed', 'false');
    expect(tabNamed(/^Summary/)).toHaveAttribute('aria-selected', 'true');
  });

  it('has no moment to choose, and no section, when the report holds none', () => {
    const report = CALLS.strong.report;
    const empty: CoachingReport = {
      ...report,
      care: undefined,
      journey: { ...report.journey, milestones: undefined, points: [] },
      curveball: null,
      discovery: { ...report.discovery, results: [], total: 0, found: 0, partial: 0, missed: 0 },
    };
    show('strong', empty);
    expect(screen.queryByRole('region', { name: 'Call journey' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tablist', { name: 'Moments in the call' })).not.toBeInTheDocument();
  });

  it('shows "Insufficient evidence" for a moment the transcript does not confirm, never its words', async () => {
    show('strong', tamperedGreeting());
    const greeting = tabNamed(/^Greeting/);
    expect(greeting).toHaveTextContent('Insufficient evidence');
    await userEvent.click(greeting);
    expect(panel()).toHaveTextContent('Insufficient evidence');
    expect(panel()).not.toHaveTextContent('words nobody said');
    expect(panel().querySelector('mark')).toBeNull();
    expect(document.querySelectorAll('.rp-turn--marked')).toHaveLength(0);
  });
});

describe('a call that was ended early', () => {
  beforeEach(wide);

  it('has one moment where the call stopped, and what it never got to after it, not reached', () => {
    show('short');
    expect(tabs().map((tab) => tab.textContent)).toEqual([
      'Greeting, Turn 2',
      'Impact established, Not reached',
      'Fact found: The calendar is shown in the Outlook desktop app, Turn 4',
      'Call ended, After turn 5',
      'Ownership, Not reached',
      'Closing, Not reached',
    ]);
  });

  it('shows the turn it stopped on when that moment is chosen', async () => {
    show('short');
    await userEvent.click(tabNamed(/^Call ended/));
    const shown = panel();
    expect(shown).toHaveTextContent('Call ended');
    expect(shown).toHaveTextContent(/The call ended early, after \d trainee turns?\./);
    expect(shown).toHaveTextContent(CALLS.short.session.turns.at(-1)?.text ?? '');
    expect(within(shown).getByRole('button', { name: 'Open in transcript' })).toBeInTheDocument();
    expect(turn(5)).toHaveClass('rp-turn--marked');
  });

  it('marks what was not reached as such, so it can be drawn quietly, and what happened as seen', () => {
    show('short');
    const states = tabs().map((tab) => tab.getAttribute('data-state'));
    expect(states).toEqual(['seen', 'not-seen', 'seen', 'seen', 'not-seen', 'not-seen']);
    expect(tabNamed(/^Call ended/)).toHaveAttribute('data-kind', 'ended');
  });
});

describe('one row or a list: never a rail that wraps', () => {
  beforeEach(wide);

  let restore: () => void;
  beforeEach(() => {
    FakeResizeObserver.instances = [];
    const original = globalThis.ResizeObserver;
    globalThis.ResizeObserver = FakeResizeObserver as unknown as typeof ResizeObserver;
    restore = () => {
      globalThis.ResizeObserver = original;
    };
  });
  afterEach(() => restore());

  it('is a rail when every moment fits in the row, and a list when they do not', () => {
    show('strong');
    // Twelve moments need 12 x 80 px.
    act(() => FakeResizeObserver.widthOf('rp-tl__measure', 1200));
    expect(screen.getByRole('tablist', { name: 'Moments in the call' })).toBeInTheDocument();
    act(() => FakeResizeObserver.widthOf('rp-tl__measure', 896));
    expect(screen.queryByRole('tablist', { name: 'Moments in the call' })).not.toBeInTheDocument();
    expect(
      within(section())
        .getAllByRole('button')
        .filter((button) => button.hasAttribute('aria-expanded')),
    ).toHaveLength(12);
    act(() => FakeResizeObserver.widthOf('rp-tl__measure', 960));
    expect(screen.getByRole('tablist', { name: 'Moments in the call' })).toBeInTheDocument();
  });

  it('is a rail for a short journey in the same room, because it fits', () => {
    show('short');
    act(() => FakeResizeObserver.widthOf('rp-tl__measure', 640));
    expect(screen.getByRole('tablist', { name: 'Moments in the call' })).toBeInTheDocument();
    expect(tabs()).toHaveLength(6);
  });
});

describe('on a narrow screen: a list of moments', () => {
  /** The button of each moment: the only buttons in the list that open and close. */
  const rows = () =>
    within(section())
      .getAllByRole('button')
      .filter((button) => button.hasAttribute('aria-expanded'));

  it('is a list of buttons that open their turn in place, and none is open at first', () => {
    show('strong');
    expect(screen.queryByRole('tablist', { name: 'Moments in the call' })).not.toBeInTheDocument();
    expect(rows()).toHaveLength(12);
    for (const row of rows()) expect(row).toHaveAttribute('aria-expanded', 'false');
  });

  it('names the fact a "Fact found" moment is about, in words on its row', () => {
    show('strong');
    const fact = rows().find((row) => row.textContent?.includes('Fact found')) as HTMLElement;
    expect(fact.querySelector('.rp-tl__fact')).toHaveTextContent(
      'Only sales-organised meetings are affected',
    );
    // Said once to a screen reader: the name has the fact, then the turn.
    expect(fact).toHaveAccessibleName(
      'Fact found: Only sales-organised meetings are affected, Turn 4',
    );
  });

  it('opens one moment at a time, right under it, and opening another closes the first', async () => {
    show('strong', issueNeeded());
    const [greeting, issue] = rows() as [HTMLElement, HTMLElement];
    await userEvent.click(greeting);
    expect(greeting).toHaveAttribute('aria-expanded', 'true');
    const inline = document.getElementById(greeting.getAttribute('aria-controls') ?? '');
    expect(inline).not.toHaveAttribute('hidden');
    expect(inline).toHaveTextContent(CALLS.strong.session.turns[1]?.text ?? '');
    await userEvent.click(issue);
    expect(greeting).toHaveAttribute('aria-expanded', 'false');
    expect(issue).toHaveAttribute('aria-expanded', 'true');
    expect(document.getElementById(issue.getAttribute('aria-controls') ?? '')).toHaveTextContent(
      'Not reached in this call.',
    );
  });

  it('closes an open moment when it is chosen again, and keeps it chosen', async () => {
    show('strong');
    const [greeting] = rows() as [HTMLElement];
    await userEvent.click(greeting);
    await userEvent.click(greeting);
    expect(greeting).toHaveAttribute('aria-expanded', 'false');
    expect(turn(2)).toHaveClass('rp-turn--marked');
  });

  it('moves between moments with the arrow keys without opening them', async () => {
    const user = userEvent.setup();
    show('strong');
    rows()[0]?.focus();
    await user.keyboard('{ArrowDown}');
    expect(rows()[1]).toHaveFocus();
    expect(rows()[1]).toHaveAttribute('aria-expanded', 'false');
    await user.keyboard('{End}');
    expect(rows().at(-1)).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(rows()[0]).toHaveFocus();
    await user.keyboard('{ArrowUp}');
    expect(rows().at(-1)).toHaveFocus();
    await user.keyboard('{Home}');
    expect(rows()[0]).toHaveFocus();
  });

  it('opens the moment nearest a turn chosen in the transcript', async () => {
    show('strong');
    await userEvent.click(within(turn(12)).getByRole('button', { name: /^Turn 12/ }));
    const open = rows().filter((row) => row.getAttribute('aria-expanded') === 'true');
    expect(open).toHaveLength(1);
    expect(open[0]).toHaveTextContent('Summary');
  });

  it('shows "Insufficient evidence" for a moment the transcript does not confirm', async () => {
    show('strong', tamperedGreeting());
    const greeting = rows()[0] as HTMLElement;
    expect(greeting).toHaveTextContent('Insufficient evidence');
    await userEvent.click(greeting);
    expect(document.getElementById(greeting.getAttribute('aria-controls') ?? '')).toHaveTextContent(
      'Insufficient evidence',
    );
    expect(section()).not.toHaveTextContent('words nobody said');
  });
});

describe('on paper', () => {
  it('lists every moment with its turn, whether the rail or the list was on screen', () => {
    wide();
    show('strong', issueNeeded());
    act(() => {
      window.dispatchEvent(new Event('beforeprint'));
    });
    expect(screen.queryByRole('tablist', { name: 'Moments in the call' })).not.toBeInTheDocument();
    // Nothing on paper asks the reader to choose.
    expect(section()).not.toHaveTextContent('Choose a moment');
    expect(section()).toHaveTextContent('The moments of the call in order');
    const items = within(section()).getAllByRole('listitem');
    expect(items).toHaveLength(13);
    expect(items[0]).toHaveTextContent('Greeting');
    expect(items[0]).toHaveTextContent('Turn 2');
    expect(items[1]).toHaveTextContent('Issue established');
    expect(items[1]).toHaveTextContent('Not reached');
    act(() => {
      window.dispatchEvent(new Event('afterprint'));
    });
    expect(screen.getByRole('tablist', { name: 'Moments in the call' })).toBeInTheDocument();
  });
});
