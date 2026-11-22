import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DESKTOP_MOUSE, stubMedia } from '../../design/interaction/test-utils.ts';
import { STEPS } from './landing-copy.ts';
import { Steps } from './Steps.tsx';
import { live, stubIntersection } from './test-utils.ts';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const list = () => within(screen.getByRole('region', { name: 'How it works' })).getByRole('list');

describe('the three steps', () => {
  it('are a plain ordered list of three, each a title and a few words, whatever the state', () => {
    stubIntersection();
    render(<Steps />);
    expect(list().tagName).toBe('OL');
    const steps = within(list()).getAllByRole('listitem');
    expect(steps).toHaveLength(3);
    steps.forEach((step, index) => {
      expect(step).toHaveTextContent(`${STEPS[index]?.title}${STEPS[index]?.text}`);
      // Real text, at full strength, before they are lit and after.
      expect(within(step).getByText(STEPS[index]?.title ?? '?')).toBeVisible();
    });
  });

  it('draw the lines between them as decoration: two, hidden from assistive technology', () => {
    stubIntersection();
    const { container } = render(<Steps />);
    const lines = container.querySelectorAll('.lp-step__link');
    expect(lines).toHaveLength(2);
    for (const line of lines) expect(line).toHaveAttribute('aria-hidden', 'true');
  });

  it('wait, unlit, until the list has scrolled into view', () => {
    stubIntersection();
    render(<Steps />);
    expect(list()).not.toHaveAttribute('data-active');
    live()[0]?.report(false);
    expect(list()).not.toHaveAttribute('data-active');
  });

  it('light once it has, and stay lit when it scrolls away again', () => {
    stubIntersection();
    render(<Steps />);
    live()[0]?.report(true);
    expect(list()).toHaveAttribute('data-active');
    expect(live(), 'it stops watching once it has been seen').toHaveLength(0);
    cleanup();
  });

  it('lights them in order, a beat apart: each step carries its place in the stagger', () => {
    stubIntersection();
    render(<Steps />);
    const places = within(list())
      .getAllByRole('listitem')
      .map((step) => step.style.getPropertyValue('--i'));
    expect(places).toEqual(['0', '1', '2']);
  });

  it('is not lit by a sliver at the edge of the window: it waits until its top is a little way up', () => {
    const Observer = stubIntersection();
    render(<Steps />);
    expect(Observer.all[0]?.options?.rootMargin).toMatch(/-\d+%/);
  });

  it('shows all three lit at once for a visitor who has asked for less motion', () => {
    stubMedia({ ...DESKTOP_MOUSE, '(prefers-reduced-motion: reduce)': true });
    stubIntersection();
    render(<Steps />);
    expect(list()).toHaveAttribute('data-active');
  });

  it('shows all three lit where there is no way to know what is in view, so nothing stays dim', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    render(<Steps />);
    expect(list()).toHaveAttribute('data-active');
  });
});
