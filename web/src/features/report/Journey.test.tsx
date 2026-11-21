import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import JourneyChart from './JourneyChart.tsx';
import { ReportView } from './ReportView.tsx';
import { CALLS, type CallName } from './fixtures.ts';
import { EvidenceProvider, HIGHLIGHT_MS } from './evidence.tsx';
import { renderAtReport, scriptedClient, stubScroll } from './test-utils.tsx';

// Role queries over a whole report are slow in jsdom, and slower on a busy machine.
vi.setConfig({ testTimeout: 20_000 });

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function show(name: CallName) {
  const { session, report } = CALLS[name];
  return renderAtReport(
    <ReportView
      session={session}
      report={report}
      client={scriptedClient(session)}
      reveal={false}
    />,
  );
}

const section = () => screen.getByRole('region', { name: 'Customer journey' });
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

// This file renders the chart through the report, so the placeholder for its own chunk is on screen
// first and the chart arrives a moment later.
describe('the chart', () => {
  it('shows a placeholder while it loads, with the words and the list already there', async () => {
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

  it('makes every point after the start a control with a name that says the turn and where the customer was', async () => {
    show('strong');
    const buttons = await points();
    expect(buttons).toHaveLength(CALLS.strong.report.journey.points.length - 1);
    expect(buttons[1]).toHaveAccessibleName(
      'Turn 4: Frustrated to Concerned. See turn 4 in the transcript',
    );
    expect(buttons[0]).toHaveAccessibleName(
      'Turn 2: Still Frustrated, temperature eased. See turn 2 in the transcript',
    );
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

  it('says what a point is while it has focus, and goes back to the sentence when it loses it', async () => {
    const user = userEvent.setup();
    show('strong');
    const buttons = await points();
    await focus(buttons[1]);
    expect(await readout()).toHaveTextContent(
      'Turn 4: Frustrated to Concerned. Asked a focused question about scope',
    );
    await user.tab();
    expect(await readout()).toHaveTextContent('The customer started Frustrated and ended Calm.');
  });

  it('also says it when the pointer is over a point', async () => {
    const user = userEvent.setup();
    show('strong');
    const buttons = await points();
    await user.hover(buttons[1] as HTMLElement);
    expect(await readout()).toHaveTextContent(/^Turn 4: Frustrated to Concerned/);
    await user.unhover(buttons[1] as HTMLElement);
    expect(await readout()).toHaveTextContent('The customer started Frustrated and ended Calm.');
  });

  it('shows the matching turn when a point is chosen with Enter, Space or a click', async () => {
    const { scroll, restore } = stubScroll();
    const user = userEvent.setup();
    try {
      show('strong');
      const buttons = await points();
      buttons[1]?.focus();
      await user.keyboard('{Enter}');
      const turn = document.getElementById('turn-4') as HTMLElement;
      expect(turn).toHaveFocus();
      expect(turn).toHaveClass('rp-turn--cited');
      expect(scroll).toHaveBeenCalled();
      // The words the trainee said at that turn are marked too.
      expect(turn.querySelector('mark')).toHaveTextContent(
        'Is it happening in every meeting, or only for some organisers?',
      );
      expect(screen.getByRole('button', { name: 'Back to Customer journey' })).toBeInTheDocument();

      buttons[3]?.focus();
      await user.keyboard(' ');
      expect(document.getElementById('turn-8')).toHaveFocus();

      await user.click(buttons[0] as HTMLElement);
      expect(document.getElementById('turn-2')).toHaveFocus();
    } finally {
      restore();
    }
  });

  it('goes back to the point it came from, with focus on it', async () => {
    const { restore } = stubScroll();
    const user = userEvent.setup();
    try {
      show('strong');
      const buttons = await points();
      buttons[2]?.focus();
      await user.keyboard('{Enter}');
      await user.click(screen.getByRole('button', { name: 'Back to Customer journey' }));
      expect(buttons[2]).toHaveFocus();
      expect(screen.queryByRole('button', { name: /^Back to/ })).not.toBeInTheDocument();
    } finally {
      restore();
    }
  });

  it('marks the turn only for a few seconds, and keeps the way back', async () => {
    const { restore } = stubScroll();
    try {
      show('strong');
      const buttons = await points();
      vi.useFakeTimers();
      await focus(buttons[1]);
      act(() => {
        fireEvent.keyDown(buttons[1] as Element, { key: 'Enter' });
      });
      const turn = document.getElementById('turn-4') as HTMLElement;
      expect(turn).toHaveClass('rp-turn--cited');
      expect(within(turn).getByText('Cited')).toBeInTheDocument();
      act(() => {
        vi.advanceTimersByTime(HIGHLIGHT_MS + 50);
      });
      expect(turn).not.toHaveClass('rp-turn--cited');
      expect(within(turn).queryByText('Cited')).not.toBeInTheDocument();
      expect(turn.querySelector('mark')).toBeNull();
      expect(screen.getByRole('button', { name: 'Back to Customer journey' })).toBeInTheDocument();
    } finally {
      restore();
    }
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

  it('is only a picture, with nothing to press, when the transcript has none of its turns', async () => {
    render(
      <EvidenceProvider turnIndexes={[]}>
        <JourneyChart journey={CALLS.strong.report.journey} />
      </EvidenceProvider>,
    );
    const picture = screen.getByRole('img', { name: /Customer temperature through the call/ });
    expect(picture).toBeInTheDocument();
    expect(within(picture).queryAllByRole('button')).toHaveLength(0);
  });
});
