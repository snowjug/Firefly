import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act, cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderApp } from './test-kit.tsx';

// The pages are plain stand-ins: these tests are about how the shell brings a page in. The scenarios
// page is held back until a test lets it go, to see what is shown while a page is on its way.
const gate = vi.hoisted(() => {
  let release!: () => void;
  const wait = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { wait, release };
});

vi.mock('../pages/Landing.tsx', () => ({ default: () => <h1>Landing page</h1> }));
vi.mock('../pages/About.tsx', () => ({ default: () => <h1>About page</h1> }));
vi.mock('../pages/ResponsibleAi.tsx', () => ({ default: () => <h1>Responsible AI page</h1> }));
vi.mock('../pages/Scenarios.tsx', async () => {
  await gate.wait;
  return { default: () => <h1>Scenarios page</h1> };
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const stage = () => document.querySelector('.ff-route') as HTMLElement;
const line = () => document.querySelector('.ff-progress-line');

describe('how a routed page arrives', () => {
  it('does not animate the page the app loaded with', async () => {
    renderApp('/about');
    await screen.findByRole('heading', { level: 1, name: 'About page' });
    expect(stage()).not.toHaveAttribute('data-enter');
  });

  it('draws a page reached by navigation into a new element that enters, and the page it replaces is gone', async () => {
    const user = userEvent.setup();
    renderApp('/about');
    await screen.findByRole('heading', { level: 1, name: 'About page' });
    const before = stage();
    await user.click(
      within(screen.getByRole('contentinfo')).getByRole('link', { name: 'Responsible AI' }),
    );
    await screen.findByRole('heading', { level: 1, name: 'Responsible AI page' });
    expect(stage()).not.toBe(before);
    expect(stage()).toHaveAttribute('data-enter');
    expect(document.querySelectorAll('.ff-route')).toHaveLength(1);
    expect(screen.queryByRole('heading', { name: 'About page' })).not.toBeInTheDocument();
  });

  it('leaves the landing page to sequence its own entrance, even when it is reached by navigation', async () => {
    const { router } = renderApp('/about');
    await screen.findByRole('heading', { level: 1, name: 'About page' });
    await act(async () => {
      await router.navigate('/');
    });
    await screen.findByRole('heading', { level: 1, name: 'Landing page' });
    expect(stage()).not.toHaveAttribute('data-enter');
  });

  it('does not replay for a change of the query or the fragment of the same address', async () => {
    const { router } = renderApp('/about');
    await screen.findByRole('heading', { level: 1, name: 'About page' });
    const before = stage();
    await act(async () => {
      await router.navigate('/about?tab=2#more');
    });
    expect(stage()).toBe(before);
    expect(stage()).not.toHaveAttribute('data-enter');
  });

  it('does not start for a page that arrives inside a view transition, which crossfades it already', async () => {
    const real = Element.prototype.matches;
    vi.spyOn(Element.prototype, 'matches').mockImplementation(function (
      this: Element,
      selector: string,
    ) {
      return selector === ':active-view-transition' || real.call(this, selector);
    });
    const { router } = renderApp('/about');
    await screen.findByRole('heading', { level: 1, name: 'About page' });
    await act(async () => {
      await router.navigate('/responsible-ai');
    });
    await screen.findByRole('heading', { level: 1, name: 'Responsible AI page' });
    expect(stage()).not.toHaveAttribute('data-enter');
  });

  it('counts going back to the address the app loaded with as a navigation like any other', async () => {
    const { router } = renderApp('/about');
    await screen.findByRole('heading', { level: 1, name: 'About page' });
    await act(async () => {
      await router.navigate('/responsible-ai');
    });
    await screen.findByRole('heading', { level: 1, name: 'Responsible AI page' });
    await act(async () => {
      await router.navigate(-1);
    });
    await screen.findByRole('heading', { level: 1, name: 'About page' });
    expect(stage()).toHaveAttribute('data-enter');
  });
});

describe('the progress line while a page is on its way', () => {
  it('draws nothing for a navigation that is over quickly', async () => {
    const { router } = renderApp('/');
    await screen.findByRole('heading', { level: 1, name: 'Landing page' });
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    await act(async () => {
      await router.navigate('/about');
    });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(line()).toBeNull();
  });

  it('is drawn once the wait has gone on for about 200 ms, and is gone the moment the page arrives', async () => {
    const { router } = renderApp('/');
    await screen.findByRole('heading', { level: 1, name: 'Landing page' });
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    act(() => {
      void router.navigate('/scenarios');
    });
    expect(line()).toBeNull();
    act(() => {
      vi.advanceTimersByTime(190);
    });
    expect(line(), 'still nothing after 190 ms').toBeNull();
    act(() => {
      vi.advanceTimersByTime(20);
    });
    expect(line(), 'drawn after 210 ms').not.toBeNull();
    expect(line()).toHaveAttribute('aria-hidden', 'true');
    // The old page stays in place until the new one is ready.
    expect(screen.getByRole('heading', { level: 1, name: 'Landing page' })).toBeInTheDocument();

    vi.useRealTimers();
    gate.release();
    await screen.findByRole('heading', { level: 1, name: 'Scenarios page' });
    expect(line()).toBeNull();
  });
});

describe('the stylesheet of the page entrance', () => {
  const css = readFileSync(join(process.cwd(), 'web/src/app/shell/shell.css'), 'utf8').replace(
    /\/\*[\s\S]*?\*\//g,
    '',
  );
  const ENTER = /\.ff-route\[data-enter\]\s*\{/;

  it('plays only on a screen and only while motion is allowed, so under reduced motion the page is simply there', () => {
    const start = css.search(ENTER);
    expect(start).toBeGreaterThan(-1);
    const head = css.slice(0, start);
    expect(head.slice(head.lastIndexOf('@media'), start)).toContain(
      '@media screen and (prefers-reduced-motion: no-preference)',
    );
  });

  it('rises by the shared distance and fades, on the shared curve, and never has a rule that would start it later', () => {
    expect(css).toMatch(
      /\.ff-route\[data-enter\]\s*\{[^}]*animation:\s*ff-route-in var\(--dur-slow\) var\(--ease-decelerate\)/,
    );
    const keyframes = /@keyframes ff-route-in\s*\{[\s\S]*?\n\}/.exec(css)?.[0] ?? '';
    expect(keyframes).toMatch(/opacity:\s*0/);
    expect(keyframes).toMatch(/translateY\(var\(--move-sm\)\)/);
    // A rule that stood the animation down (`animation: none` under some condition) would start it
    // when the condition ended: whether a page enters is decided once, in RouteStage.
    expect(css).not.toMatch(/\.ff-route[^{]*\{\s*animation:\s*none/);
  });
});
