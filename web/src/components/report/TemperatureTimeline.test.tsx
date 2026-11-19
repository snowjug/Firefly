import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { TemperatureTimeline } from './TemperatureTimeline.tsx';
import { PEAKED_JOURNEY, longJourney, point } from './report.fixtures.ts';

const href = (turn: number) => `/sessions/s1/transcript?turn=${turn}`;

function renderTimeline(points = PEAKED_JOURNEY) {
  return render(
    <MemoryRouter>
      <TemperatureTimeline points={points} turnHref={href} />
    </MemoryRouter>,
  );
}

describe('TemperatureTimeline', () => {
  it('summarises the whole journey in the chart label', () => {
    renderTimeline();
    expect(
      screen.getByRole('img', {
        name: 'Customer mood timeline: started Frustrated, peaked Angry at turn 6, ended Calm.',
      }),
    ).toBeInTheDocument();
  });

  it('shows the point where the mood moved most, with its reason, quote and transcript link', () => {
    renderTimeline();
    const panel = screen.getByRole('group', { name: 'Selected moment' });
    expect(within(panel).getByText('Turn 8')).toBeInTheDocument();
    expect(within(panel).getByText('Took clear ownership')).toBeInTheDocument();
    expect(
      within(panel).getByText(/I will take this on and call you at 3pm\./),
    ).toBeInTheDocument();
    expect(within(panel).getByText('Eased from Angry to Concerned.')).toBeInTheDocument();
    expect(within(panel).getByRole('link', { name: /view in transcript/i })).toHaveAttribute(
      'href',
      href(8),
    );
  });

  it('moves between points with the arrow keys and selects with Enter', async () => {
    const user = userEvent.setup();
    renderTimeline();
    const selected = screen.getByRole('button', { name: /^Turn 8,/ });
    expect(selected).toHaveAttribute('aria-current', 'true');

    selected.focus();
    await user.keyboard('{ArrowLeft}');
    const turn6 = screen.getByRole('button', { name: /^Turn 6, Angry, rose/ });
    expect(turn6).toHaveFocus();
    expect(turn6).not.toHaveAttribute('aria-current');

    await user.keyboard('{Enter}');
    expect(turn6).toHaveAttribute('aria-current', 'true');
    const panel = screen.getByRole('group', { name: 'Selected moment' });
    expect(within(panel).getByText('Blamed the customer or another team')).toBeInTheDocument();

    await user.keyboard('{Home}');
    expect(screen.getByRole('button', { name: /^Turn 1, Frustrated, start/ })).toHaveFocus();
    await user.keyboard('{End}');
    expect(screen.getByRole('button', { name: /^Turn 10, Calm/ })).toHaveFocus();
  });

  it('steps through the moments with the previous and next buttons', async () => {
    const user = userEvent.setup();
    renderTimeline();
    await user.click(screen.getByRole('button', { name: 'Next moment' }));
    expect(screen.getByRole('button', { name: /^Turn 10,/ })).toHaveAttribute(
      'aria-current',
      'true',
    );
    // The last point has nothing after it: the button stays in place but is marked unavailable.
    expect(screen.getByRole('button', { name: 'Next moment' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });

  it('offers the same data as a table', async () => {
    const user = userEvent.setup();
    renderTimeline();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    const toggle = screen.getByRole('button', { name: 'Show as table' });
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const table = screen.getByRole('table', { name: 'Customer mood at each point in the call' });
    expect(within(table).getAllByRole('row')).toHaveLength(PEAKED_JOURNEY.length + 1);
    expect(within(table).getByRole('link', { name: 'Turn 6' })).toHaveAttribute('href', href(6));
    expect(within(table).getAllByText('Eased').length).toBeGreaterThan(0);
  });

  it('never shows the raw 0-100 temperature values', () => {
    const { container } = renderTimeline();
    for (const value of PEAKED_JOURNEY.map((p) => p.temperature)) {
      expect(container.textContent).not.toMatch(new RegExp(`\\b${value}\\b`));
    }
  });

  it('marks the start and the end under the turn numbers, with a grid line at each turn shown', () => {
    const { container } = renderTimeline();
    expect([...container.querySelectorAll('.tl-edge')].map((node) => node.textContent)).toEqual([
      'Start',
      'End',
    ]);
    expect(container.querySelectorAll('.tl-vgrid')).toHaveLength(
      container.querySelectorAll('.tl-tick').length,
    );
  });

  it('renders a two-point journey', () => {
    renderTimeline([point(1, 52, 'start', 0), point(2, 22, 'end', -30)]);
    expect(
      screen.getByRole('img', {
        name: 'Customer mood timeline: started Frustrated, ended Concerned.',
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^Turn \d+,/ })).toHaveLength(2);
  });

  it('renders a 40-point journey with thinned ticks', () => {
    const { container } = renderTimeline(longJourney(41));
    expect(screen.getAllByRole('button', { name: /^Turn \d+,/ })).toHaveLength(41);
    const ticks = container.querySelectorAll('.tl-tick');
    expect(ticks.length).toBeGreaterThan(3);
    expect(ticks.length).toBeLessThan(41);
  });

  it('says so when there is nothing to draw', () => {
    renderTimeline([]);
    expect(screen.getByText(/not enough recorded moments/i)).toBeInTheDocument();
  });
});
