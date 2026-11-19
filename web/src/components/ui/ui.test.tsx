import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { ISSUE_TYPES } from '#shared/domain/vocab.ts';
import { ThemeProvider } from '../../lib/theme.tsx';
import { issueVisual } from './IssueIcon.tsx';
import { ProgressBar } from './ProgressBar.tsx';
import { ScoreRing } from './ScoreRing.tsx';
import { StatCard } from './StatCard.tsx';
import { Tabs, panelId, tabId } from './Tabs.tsx';

describe('ProgressBar', () => {
  it('exposes the measurement and clamps the fill', () => {
    const { rerender } = render(<ProgressBar label="Scoping" value={4} max={5} />);
    const bar = screen.getByRole('progressbar', { name: 'Scoping' });
    expect(bar).toHaveAttribute('aria-valuenow', '4');
    expect(bar).toHaveAttribute('aria-valuemax', '5');
    expect(bar.style.getPropertyValue('--value')).toBe('0.8');
    rerender(<ProgressBar label="Scoping" value={9} max={5} />);
    expect(screen.getByRole('progressbar').style.getPropertyValue('--value')).toBe('1');
    rerender(<ProgressBar label="Scoping" value={-1} max={5} />);
    expect(screen.getByRole('progressbar').style.getPropertyValue('--value')).toBe('0');
  });
});

describe('ScoreRing', () => {
  it('reads as plain words and shows decimals only when there are some', () => {
    const { rerender } = render(
      <ThemeProvider>
        <ScoreRing value={4.2} />
      </ThemeProvider>,
    );
    expect(screen.getByRole('img', { name: 'Overall score: 4.2 out of 5' })).toBeInTheDocument();
    rerender(
      <ThemeProvider>
        <ScoreRing value={3} label="Skill" max={5} />
      </ThemeProvider>,
    );
    expect(screen.getByRole('img', { name: 'Skill: 3 out of 5' })).toBeInTheDocument();
  });
});

describe('StatCard', () => {
  it('shows the number, what it counts and an optional note', () => {
    render(<StatCard icon="chart" value={8} label="Scenarios completed" note="since March" />);
    expect(screen.getByText('8')).toBeInTheDocument();
    expect(screen.getByText('Scenarios completed')).toBeInTheDocument();
    expect(screen.getByText('since March')).toBeInTheDocument();
  });
});

describe('IssueIcon', () => {
  it('has a distinct icon for every issue type', () => {
    const icons = ISSUE_TYPES.map((issue) => issueVisual(issue).icon);
    expect(new Set(icons).size).toBeGreaterThanOrEqual(6);
  });
});

function Demo() {
  const [value, setValue] = useState('all');
  return (
    <>
      <Tabs
        label="Badges"
        prefix="b"
        value={value}
        onChange={setValue}
        tabs={[
          { id: 'all', label: 'All', count: 6 },
          { id: 'progress', label: 'In progress' },
          { id: 'challenges', label: 'Challenges' },
        ]}
      />
      <div role="tabpanel" id={panelId('b', value)} aria-labelledby={tabId('b', value)}>
        Showing {value}
      </div>
    </>
  );
}

describe('Tabs', () => {
  it('has one tab stop and moves with the arrow keys, Home and End', async () => {
    const user = userEvent.setup();
    render(<Demo />);
    const [all, progress, challenges] = screen.getAllByRole('tab');
    expect(all).toHaveAttribute('aria-selected', 'true');
    expect(progress).toHaveAttribute('tabindex', '-1');

    await user.tab();
    expect(all).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(progress).toHaveFocus();
    expect(progress).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Showing progress');
    await user.keyboard('{End}');
    expect(challenges).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(all).toHaveFocus();
    await user.keyboard('{ArrowLeft}');
    expect(challenges).toHaveFocus();
    await user.keyboard('{Home}');
    expect(all).toHaveFocus();
  });

  it('shows counts and selects on click', async () => {
    const user = userEvent.setup();
    render(<Demo />);
    expect(screen.getByRole('tab', { name: /All/ })).toHaveTextContent('6');
    await user.click(screen.getByRole('tab', { name: 'Challenges' }));
    expect(screen.getByRole('tabpanel')).toHaveAccessibleName('Challenges');
  });
});
