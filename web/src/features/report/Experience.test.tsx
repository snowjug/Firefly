import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CURVEBALL_LABELS } from '#shared/domain/vocab.ts';
import type { CoachingReport } from '#shared/domain/report.ts';
import { ReportView } from './ReportView.tsx';
import JourneyChart from './JourneyChart.tsx';
import { CHART_FOOTNOTE } from './copy.ts';
import { CALLS, withReport, type CallName } from './fixtures.ts';
import { EvidenceProvider, HIGHLIGHT_MS } from './evidence.tsx';
import { evidenceTurns } from './evidence-model.ts';
import { journeyListItems } from './journey-model.ts';
import { must, renderAtReport, scriptedClient, stubScroll } from './test-utils.tsx';

// The customer's experience: the temperature chart (a drawing with real controls), the important
// points as rows with the customer's own words, the unexpected turn, and the table that stands in
// for the chart.

// Role queries over a whole report are slow in jsdom, and slower on a busy machine.
vi.setConfig({ testTimeout: 20_000 });

let restoreScroll: () => void;

beforeEach(() => {
  restoreScroll = stubScroll().restore;
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
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

const section = () => screen.getByRole('region', { name: 'Customer experience' });
const chart = () =>
  within(section()).findByRole('group', { name: /Customer temperature through the call/ });
const points = async () => within(await chart()).getAllByRole('button');
/** What the chart says about itself, above the drawing. */
const readout = async () =>
  (await chart()).closest('.rp-chart')?.querySelector('.rp-chart__readout') as HTMLElement;
const focus = (element: Element | undefined) =>
  act(() => {
    (element as HTMLElement | SVGElement).focus();
  });
const turn = (index: number) => document.getElementById(`turn-${index}`) as HTMLElement;
const turnText = (name: CallName, index: number) =>
  must(
    CALLS[name].session.turns.find((t) => t.index === index),
    `turn ${index}`,
  ).text;
const momentRows = () => [...section().querySelectorAll<HTMLElement>('.rp-moment')];

// The chart is drawn by its own chunk: the placeholder is on screen first and the chart arrives a
// moment later.
describe('the chart', () => {
  it('shows a placeholder while it loads, with the words already there', async () => {
    show('strong');
    expect(
      within(section()).getByText('Loading the customer temperature chart'),
    ).toBeInTheDocument();
    expect(
      within(section()).getByText('The customer started Frustrated and ended Calm.'),
    ).toBeInTheDocument();
    const drawn = await chart();
    expect(drawn).toHaveAccessibleName(/started Frustrated and ended Calm/);
    expect(drawn).toHaveAccessibleName(/listed below the chart/);
    expect(
      within(section()).queryByText('Loading the customer temperature chart'),
    ).not.toBeInTheDocument();
  });

  it('names the five bands in text and has a key for the markers', async () => {
    show('strong');
    const drawn = await chart();
    for (const band of ['Escalating', 'Angry', 'Frustrated', 'Concerned', 'Calm']) {
      expect(drawn).toHaveTextContent(band);
    }
    const key = within(section()).getByRole('list', { name: 'Chart key' });
    expect(
      within(key)
        .getAllByRole('listitem')
        .map((i) => i.textContent),
    ).toEqual(['Start', 'Turn', 'Turning point', 'Unexpected turn', 'End']);
  });

  it('says under the key that its heights show direction, not measurements, and how its points are used', async () => {
    show('strong');
    const drawn = await chart();
    const note = within(section()).getByText(CHART_FOOTNOTE);
    expect(note).toHaveTextContent(
      'The customer is simulated, so heights show direction, not exact measurements. Select a point to see what happened there; the arrow keys move between points.',
    );
    // Under the key, inside the chart, so it moves with it.
    expect(note.previousElementSibling).toBe(
      within(section()).getByRole('list', { name: 'Chart key' }),
    );
    expect(drawn.closest('.rp-chart')).toContainElement(note);
  });

  it('shows which way is calmer, on the axis', async () => {
    show('strong');
    const drawn = await chart();
    expect(drawn.querySelector('.rp-chart__cue')).toHaveTextContent('Calmer');
  });

  it('spreads its points by turn: the same gap in turns is the same width', async () => {
    show('strong');
    const drawn = await chart();
    const xs = [...drawn.querySelectorAll('.rp-chart__point')].map((point) => {
      const match = /translate\(([\d.]+)/.exec(point.getAttribute('transform') ?? '');
      return Number(match?.[1]);
    });
    const turns = CALLS.strong.report.journey.points.map((p) => Math.max(1, p.turnIndex));
    const perTurn = (xs[xs.length - 1]! - xs[0]!) / (turns[turns.length - 1]! - turns[0]!);
    xs.forEach((x, i) => {
      expect(x - xs[0]!).toBeCloseTo(((turns[i] as number) - (turns[0] as number)) * perTurn, 0);
    });
  });

  it('makes every point after the start a control, named by the turn, where the customer was and what it does', async () => {
    show('strong');
    const buttons = await points();
    expect(buttons).toHaveLength(CALLS.strong.report.journey.points.length - 1);
    expect(buttons[1]).toHaveAccessibleName('Turn 4: Frustrated to Concerned. Show the exact turn');
    expect(buttons[0]).toHaveAccessibleName(
      'Turn 2: Still Frustrated, temperature eased. Show the exact turn',
    );
    for (const button of buttons) expect(button).toHaveAttribute('aria-pressed', 'false');
  });

  it('has one tab stop for the whole chart, and the arrow keys move it', async () => {
    const user = userEvent.setup();
    show('strong');
    const buttons = await points();
    expect(buttons.filter((b) => b.getAttribute('tabindex') === '0')).toHaveLength(1);
    expect(buttons[0]).toHaveAttribute('tabindex', '0');

    buttons[0]?.focus();
    expect(buttons[0]).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(buttons[1]).toHaveFocus();
    expect(buttons[1]).toHaveAttribute('tabindex', '0');
    expect(buttons[0]).toHaveAttribute('tabindex', '-1');
    await user.keyboard('{ArrowLeft}{ArrowLeft}');
    expect(buttons[0]).toHaveFocus();
    await user.keyboard('{End}');
    expect(buttons.at(-1)).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(buttons.at(-1)).toHaveFocus();
    await user.keyboard('{Home}');
    expect(buttons[0]).toHaveFocus();
  });

  it('leaves the chart on Tab instead of walking through every point', async () => {
    const user = userEvent.setup();
    show('strong');
    const buttons = await points();
    buttons[0]?.focus();
    await user.tab();
    for (const button of buttons) expect(button).not.toHaveFocus();
  });

  it('says what a point is while it has focus or the pointer, and goes back to the sentence when it is gone', async () => {
    const user = userEvent.setup();
    show('strong');
    const buttons = await points();
    await focus(buttons[1]);
    expect(await readout()).toHaveTextContent(
      'Turn 4: Frustrated to Concerned. Asked a focused question about scope',
    );
    await user.tab();
    expect(await readout()).toHaveTextContent('The customer started Frustrated and ended Calm.');
    await user.hover(buttons[1] as HTMLElement);
    expect(await readout()).toHaveTextContent(/^Turn 4: Frustrated to Concerned/);
    await user.unhover(buttons[1] as HTMLElement);
    expect(await readout()).toHaveTextContent('The customer started Frustrated and ended Calm.');
  });

  it('shows the exact turn under the chart when a point is chosen, with its words marked and the turn marked in the transcript', async () => {
    const user = userEvent.setup();
    show('strong');
    const buttons = await points();
    buttons[1]?.focus();
    await user.keyboard('{Enter}');
    const panel = section().querySelector('.rp-journey__panel') as HTMLElement;
    expect(panel).toHaveTextContent('Turn 4: Frustrated to Concerned');
    expect(panel).toHaveTextContent(turnText('strong', 4));
    expect(panel.querySelector('mark')).toHaveTextContent(
      'Is it happening in every meeting, or only for some organisers?',
    );
    expect(buttons[1]).toHaveAttribute('aria-pressed', 'true');
    expect(buttons[1]?.getAttribute('class')).toContain('rp-chart__point--chosen');
    expect(turn(4)).toHaveClass('rp-turn--marked');
    expect(within(turn(4)).getByRole('button', { name: /^Turn 4/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('says where the turn is when a point is chosen, and chooses another point or the same one again', async () => {
    const user = userEvent.setup();
    show('strong');
    const buttons = await points();
    await user.click(buttons[3] as HTMLElement);
    expect(
      document.querySelector('[role="status"][aria-live="polite"][aria-atomic="true"]'),
    ).toHaveTextContent('Showing turn 8, under the chart.');
    expect(section().querySelector('.rp-journey__panel')).toHaveTextContent('Turn 8');
    await user.click(buttons[5] as HTMLElement);
    expect(section().querySelector('.rp-journey__panel')).toHaveTextContent('Turn 12');
    expect(buttons[3]).toHaveAttribute('aria-pressed', 'false');
    await user.click(buttons[5] as HTMLElement);
    expect(section().querySelector('.rp-journey__panel')).toBeNull();
    expect(buttons[5]).toHaveAttribute('aria-pressed', 'false');
  });

  it('opens the turn in the full transcript from the panel, and Back returns to the chart', async () => {
    const user = userEvent.setup();
    show('strong');
    const buttons = await points();
    await user.click(buttons[1] as HTMLElement);
    const panel = section().querySelector('.rp-journey__panel') as HTMLElement;
    await user.click(within(panel).getByRole('button', { name: 'Open in transcript' }));
    expect(turn(4)).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Back to Customer experience' })).toBeInTheDocument();
  });

  it('keeps the long call usable: every point is a control, and End reaches the last', async () => {
    const user = userEvent.setup();
    show('long');
    const buttons = await points();
    expect(buttons).toHaveLength(CALLS.long.report.journey.points.length - 1);
    expect(buttons.length).toBeGreaterThan(30);
    buttons[0]?.focus();
    await user.keyboard('{End}');
    expect(buttons.at(-1)).toHaveFocus();
  });

  it('is only a picture, with nothing to press, when the transcript has none of its turns', () => {
    render(
      <EvidenceProvider turns={[]}>
        <JourneyChart
          journey={CALLS.strong.report.journey}
          chosenTurn={null}
          onChoose={() => undefined}
        />
      </EvidenceProvider>,
    );
    const picture = screen.getByRole('img', { name: /Customer temperature through the call/ });
    expect(within(picture).queryAllByRole('button')).toHaveLength(0);
  });

  it('calls only the turns of the transcript points', () => {
    const { session } = CALLS.strong;
    render(
      <EvidenceProvider turns={evidenceTurns({ ...session, turns: session.turns.slice(0, 6) })}>
        <JourneyChart
          journey={CALLS.strong.report.journey}
          chosenTurn={null}
          onChoose={() => undefined}
        />
      </EvidenceProvider>,
    );
    expect(
      within(screen.getByRole('group', { name: /Customer temperature/ })).getAllByRole('button'),
    ).toHaveLength(3);
  });
});

describe('the important points', () => {
  it('are the start, each turning point and the end, in order, with whose turn it was and what moved', () => {
    show('strong');
    const rows = momentRows();
    expect(rows).toHaveLength(4);
    expect(rows.map((row) => row.querySelector('.rp-moment__title')?.textContent)).toEqual([
      'Start of the call',
      'Your turn 4: eased from Frustrated',
      'Your turn 10: eased from Concerned',
      'End of the call, after your turn 14',
    ]);
  });

  it('do not say the customer’s state twice: it is the label, and the heading says what moved', () => {
    show('strong');
    for (const row of momentRows()) {
      const state = row.querySelector('.ff-badge')?.textContent ?? '';
      const title = row.querySelector('.rp-moment__title')?.textContent ?? '';
      // "Eased from Frustrated" may name the state the customer came from, never the one they are in.
      expect(title.replace(/from \w+/, '')).not.toContain(state);
    }
  });

  it('have the chart’s own marker for the kind of point, on every row', () => {
    show('strong');
    const rows = momentRows();
    expect(rows).toHaveLength(4);
    for (const row of rows) expect(row.querySelector('.rp-moment__head .rp-glyph')).not.toBeNull();
    const kinds = journeyListItems(CALLS.strong.report.journey).map((i) => i.point.kind);
    expect(kinds).toEqual(['start', 'turning-point', 'turning-point', 'end']);
  });

  it('give the reason, and the customer’s own words from the transcript, never a paraphrase', () => {
    show('strong');
    const [start, second] = momentRows() as [HTMLElement, HTMLElement];
    expect(second).toHaveTextContent('Asked a focused question about scope');
    // Their reply is in turn 5, to the trainee's turn 4: the label says so.
    expect(within(second).getByText('Their reply, turn 5')).toBeInTheDocument();
    expect(second).toHaveTextContent(turnText('strong', 5));
    expect(
      within(second).getByRole('link', { name: 'See turn 5 in the transcript' }),
    ).toBeInTheDocument();
    expect(within(start).getByText('Customer opened with')).toBeInTheDocument();
    expect(start).toHaveTextContent(turnText('strong', 1));
  });

  it('name each customer state in words as well as colour', () => {
    show('strong');
    const [start] = momentRows() as [HTMLElement];
    expect(within(start).getByText('Frustrated')).toBeInTheDocument();
  });

  it('open the exact turn in place, one at a time, and mark it in the transcript', async () => {
    show('strong');
    const [start, second] = momentRows() as [HTMLElement, HTMLElement];
    const open = within(second).getByRole('button', { name: /^Show the exact turn for Turn 4/ });
    expect(open).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(open);
    expect(open).toHaveAttribute('aria-expanded', 'true');
    expect(open).toHaveAccessibleName(/^Hide the exact turn for Turn 4/);
    expect(second.querySelector('.rp-ev')).toHaveTextContent(turnText('strong', 4));
    expect(turn(4)).toHaveClass('rp-turn--marked');
    await userEvent.click(within(start).getByRole('button', { name: /^Show the exact turn for/ }));
    expect(open).toHaveAttribute('aria-expanded', 'false');
    expect(start.querySelector('.rp-ev')).not.toBeNull();
    expect(second.querySelector('.rp-ev')).toBeNull();
  });

  it('close again when chosen again', async () => {
    show('strong');
    const [, second] = momentRows() as [HTMLElement, HTMLElement];
    const toggle = within(second).getByRole('button', { name: /^Show the exact turn for/ });
    await userEvent.click(toggle);
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(second.querySelector('.rp-ev')).toBeNull();
  });

  it('mark the turn their link leads to for only a few seconds, and keep the way back', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    show('strong');
    const [, second] = momentRows() as [HTMLElement, HTMLElement];
    const link = within(second).getByRole('link', { name: 'See turn 5 in the transcript' });
    await act(async () => {
      link.click();
    });
    expect(turn(5)).toHaveClass('rp-turn--cited');
    act(() => {
      vi.advanceTimersByTime(HIGHLIGHT_MS + 50);
    });
    expect(turn(5)).not.toHaveClass('rp-turn--cited');
    expect(screen.getByRole('button', { name: 'Back to Customer experience' })).toBeInTheDocument();
  });
});

describe('the unexpected turn', () => {
  it('says what it was, where it came after the trainee’s turn and how it ended up, and links to it', () => {
    show('curveball');
    const block = section().querySelector('.rp-unexpected') as HTMLElement;
    const { curveball } = CALLS.curveball.report;
    const unexpected = must(curveball, 'an unexpected turn');
    expect(
      within(block).getByRole('heading', { level: 3, name: 'Unexpected turn' }),
    ).toBeInTheDocument();
    expect(block).toHaveTextContent(CURVEBALL_LABELS[unexpected.type].label);
    expect(block).toHaveTextContent(`After turn ${unexpected.firedAtTurn}`);
    expect(
      within(block).getByRole('link', {
        name: `See turn ${unexpected.firedAtTurn} in the transcript`,
      }),
    ).toBeInTheDocument();
    expect(block.textContent).not.toMatch(/curveball/i);
  });

  it('is not there when the call had none', () => {
    show('strong');
    expect(section().querySelector('.rp-unexpected')).toBeNull();
  });
});

describe('a report with little to show', () => {
  it('says in a line that no temperature was recorded, with no chart, no empty list and no table', () => {
    const { report } = CALLS.strong;
    show('strong', {
      ...report,
      curveball: null,
      journey: { ...report.journey, points: [], milestones: undefined },
    });
    expect(section()).toHaveTextContent('The customer temperature was not recorded for this call.');
    expect(within(section()).queryByRole('group')).not.toBeInTheDocument();
    expect(within(section()).queryByRole('heading', { name: 'Important points' })).toBeNull();
    expect(section().querySelector('ol')).toBeNull();
    expect(within(section()).queryByText('Show as a table')).not.toBeInTheDocument();
  });

  it('has no list of important points when no point is one, and keeps the chart and the table', async () => {
    const { report } = CALLS.strong;
    show('strong', {
      ...report,
      curveball: null,
      journey: {
        ...report.journey,
        points: report.journey.points.map((point) => ({ ...point, kind: 'turn' as const })),
      },
    });
    expect(within(section()).queryByRole('heading', { name: 'Important points' })).toBeNull();
    expect(section().querySelector('.rp-moments')).toBeNull();
    expect(await chart()).toBeInTheDocument();
    expect(within(section()).getByText('Show as a table')).toBeInTheDocument();
  });
});

describe('the table', () => {
  it('is closed until asked, has a caption and one row for every point, with a link to its turn', async () => {
    show('strong');
    const details = section().querySelector('details') as HTMLDetailsElement;
    expect(details.open).toBe(false);
    await userEvent.click(within(section()).getByText('Show as a table'));
    expect(details.open).toBe(true);
    const table = within(details).getByRole('table', {
      name: 'Customer temperature at each point in the call',
    });
    expect(within(table).getAllByRole('row')).toHaveLength(
      CALLS.strong.report.journey.points.length + 1,
    );
    expect(within(table).getAllByRole('link')).toHaveLength(
      CALLS.strong.report.journey.points.length - 1,
    );
  });

  it('names the kind of every point with the marker the chart uses for it', async () => {
    show('strong');
    await userEvent.click(within(section()).getByText('Show as a table'));
    const markers = section().querySelectorAll('.rp-table__point .rp-glyph');
    expect(markers).toHaveLength(CALLS.strong.report.journey.points.length);
  });

  it('is directly under the chart, before the list of important points', async () => {
    show('strong');
    await chart();
    const details = section().querySelector('details') as HTMLDetailsElement;
    expect(details.previousElementSibling).toBe(
      section().querySelector('.rp-journey__chart') as HTMLElement,
    );
    const important = within(section()).getByRole('heading', { name: 'Important points' });
    expect(
      details.compareDocumentPosition(important) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('is open on paper, and closed again afterwards', () => {
    show('strong');
    const details = section().querySelector('details') as HTMLDetailsElement;
    act(() => {
      window.dispatchEvent(new Event('beforeprint'));
    });
    expect(details.open).toBe(true);
    act(() => {
      window.dispatchEvent(new Event('afterprint'));
    });
    expect(details.open).toBe(false);
  });
});
