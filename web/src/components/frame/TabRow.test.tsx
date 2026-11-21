import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { TabRow, tabDomId, tabPanelDomId } from './index.ts';

const TABS = [
  { id: 'all', label: 'All', count: 6 },
  { id: 'progress', label: 'In progress' },
  { id: 'challenges', label: 'Challenges' },
];

function Demo({ initial = 'all' }: { initial?: string }) {
  const [active, setActive] = useState(initial);
  return (
    <>
      <TabRow label="Badges" tabs={TABS} active={active} onChange={setActive} panelId="b" />
      <div role="tabpanel" id={tabPanelDomId('b', active)} aria-labelledby={tabDomId('b', active)}>
        Showing {active}
      </div>
    </>
  );
}

describe('TabRow', () => {
  it('is a named tab list with one tab stop', async () => {
    const user = userEvent.setup();
    render(<Demo />);
    expect(screen.getByRole('tablist', { name: 'Badges' })).toBeInTheDocument();
    const [all, progress] = screen.getAllByRole('tab');
    expect(all).toHaveAttribute('aria-selected', 'true');
    expect(all).toHaveAttribute('tabindex', '0');
    expect(progress).toHaveAttribute('aria-selected', 'false');
    expect(progress).toHaveAttribute('tabindex', '-1');
    await user.tab();
    expect(all).toHaveFocus();
    await user.tab();
    expect(progress).not.toHaveFocus();
  });

  it('moves and selects with the arrow keys, Home and End, wrapping at the ends', async () => {
    const user = userEvent.setup();
    render(<Demo />);
    const [all, progress, challenges] = screen.getAllByRole('tab');
    await user.tab();
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
    await user.keyboard('{ArrowDown}');
    expect(progress).toHaveFocus();
    await user.keyboard('{ArrowUp}');
    expect(all).toHaveFocus();
  });

  it('selects on click and shows counts in the name', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TabRow label="Badges" tabs={TABS} active="all" onChange={onChange} />);
    expect(screen.getByRole('tab', { name: 'All 6' })).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Challenges' }));
    expect(onChange).toHaveBeenCalledWith('challenges');
  });

  it('ties every tab to its panel through the prefix', () => {
    render(<Demo initial="progress" />);
    const tab = screen.getByRole('tab', { name: 'In progress' });
    expect(tab).toHaveAttribute('id', tabDomId('b', 'progress'));
    expect(tab).toHaveAttribute('aria-controls', tabPanelDomId('b', 'progress'));
    expect(screen.getByRole('tabpanel')).toHaveAccessibleName('In progress');
  });

  it('leaves the list reachable when nothing is selected', () => {
    render(<TabRow label="Badges" tabs={TABS} active="gone" onChange={() => undefined} />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs[0]).toHaveAttribute('tabindex', '0');
    expect(tabs[1]).toHaveAttribute('tabindex', '-1');
  });

  it('slides the amber point from the old tab to the new one', async () => {
    const lefts: Record<string, number> = { All: 0, 'In progress': 120, Challenges: 300 };
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement,
    ) {
      const label = (this.textContent ?? '').replace(/\s*\d+$/, '');
      const left = lefts[label] ?? 0;
      return { left, right: left + 80, width: 80, top: 0, bottom: 40, height: 40 } as DOMRect;
    });
    const animate = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'animate', { value: animate, configurable: true });
    try {
      const user = userEvent.setup();
      render(<Demo />);
      expect(animate).not.toHaveBeenCalled();
      await user.click(screen.getByRole('tab', { name: 'Challenges' }));
      expect(animate).toHaveBeenCalledTimes(1);
      const [keyframes, options] = animate.mock.calls[0] as [Keyframe[], KeyframeAnimationOptions];
      expect(keyframes[0]?.transform).toBe('translate(-300px, 0px) scale(1)');
      expect(options.pseudoElement).toBe('::after');
    } finally {
      delete (HTMLElement.prototype as { animate?: unknown }).animate;
      vi.restoreAllMocks();
    }
  });
});
