import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppProviders } from '../../App.tsx';
import { stubRaf } from '../../design/interaction/test-utils.ts';
import { SectionProvider } from '../section.tsx';
import { makeConfig, stubConfig } from '../test-kit.tsx';
import { AppHeader } from './AppHeader.tsx';
import { PublicHeader } from './PublicHeader.tsx';
import { indicatorFrame } from './use-sliding-indicator.ts';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(window, 'scrollY');
});

describe('where the sliding indicator goes', () => {
  it('spans the item’s text: its own horizontal padding is taken off both ends', () => {
    expect(
      indicatorFrame({ left: 100, top: 6, width: 120, height: 44 }, { left: 12, right: 12 }),
    ).toEqual({ x: 112, w: 96, by: 50, cy: 28 });
  });

  it('is the bottom edge for an underline and the vertical centre for a bar, to half a pixel', () => {
    const frame = indicatorFrame(
      { left: 10.2, top: 3, width: 81, height: 45 },
      { left: 0, right: 0 },
    );
    expect(frame.by).toBe(48);
    expect(frame.cy).toBe(25.5);
    expect(frame.x).toBe(10);
  });

  it('is never narrower than nothing, even for an item with more padding than width', () => {
    expect(
      indicatorFrame({ left: 0, top: 0, width: 10, height: 10 }, { left: 8, right: 8 }).w,
    ).toBe(0);
  });
});

describe('the public header’s indicator', () => {
  const links: Record<string, { left: number; top: number; width: number; height: number }> = {
    Scenarios: { left: 100, top: 6, width: 96, height: 44 },
    'Responsible AI': { left: 200, top: 6, width: 130, height: 44 },
  };

  /** jsdom has no layout: give the two links a box, and the navigation the part of an offset parent. */
  function layOut() {
    const box = (element: HTMLElement) => links[element.textContent?.trim() ?? ''];
    vi.spyOn(HTMLElement.prototype, 'offsetParent', 'get').mockImplementation(function (
      this: HTMLElement,
    ) {
      return this.closest('nav');
    });
    vi.spyOn(HTMLElement.prototype, 'offsetLeft', 'get').mockImplementation(function (
      this: HTMLElement,
    ) {
      return box(this)?.left ?? 0;
    });
    vi.spyOn(HTMLElement.prototype, 'offsetTop', 'get').mockImplementation(function (
      this: HTMLElement,
    ) {
      return box(this)?.top ?? 0;
    });
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (
      this: HTMLElement,
    ) {
      return box(this)?.width ?? 0;
    });
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (
      this: HTMLElement,
    ) {
      return box(this)?.height ?? 0;
    });
  }

  function renderAt(path: string) {
    layOut();
    const raf = stubRaf();
    const user = userEvent.setup();
    const view = render(
      <MemoryRouter initialEntries={[path]}>
        <PublicHeader />
      </MemoryRouter>,
    );
    const nav = screen.getByRole('navigation', { name: 'Primary' });
    return { ...view, raf, user, nav };
  }

  it('is ONE element, drawn by the navigation and hidden from assistive technology', () => {
    const { nav } = renderAt('/');
    const indicators = nav.querySelectorAll('.ff-header__indicator');
    expect(indicators).toHaveLength(1);
    expect(indicators[0]).toHaveAttribute('aria-hidden', 'true');
    expect(within(nav).getAllByRole('link')).toHaveLength(2);
  });

  it('is hidden where no link is current, which is the home page', () => {
    const { nav } = renderAt('/');
    expect(nav.style.getPropertyValue('--ind-o')).toBe('0');
  });

  it('sits under the current link’s text, measured from the link itself', () => {
    const { nav } = renderAt('/responsible-ai');
    expect(nav.style.getPropertyValue('--ind-o')).toBe('1');
    expect(nav.style.getPropertyValue('--ind-x')).toBe('200px');
    expect(nav.style.getPropertyValue('--ind-w')).toBe('130');
    expect(nav.style.getPropertyValue('--ind-by')).toBe('50px');
    expect(nav.style.getPropertyValue('--ind-cy')).toBe('28px');
  });

  it('slides to the next current link when the route changes, and does not animate its first placement', async () => {
    const { nav, raf, user } = renderAt('/responsible-ai');
    expect(nav).not.toHaveAttribute('data-placed');
    raf.frame(16);
    expect(nav).toHaveAttribute('data-placed');
    await user.click(within(nav).getByRole('link', { name: 'Scenarios' }));
    expect(nav.style.getPropertyValue('--ind-x')).toBe('100px');
    expect(nav.style.getPropertyValue('--ind-w')).toBe('96');
    expect(nav, 'a move between two links keeps its transition').toHaveAttribute('data-placed');
  });

  it('fades in where it belongs, rather than sliding in from where it was, after being hidden', async () => {
    const { nav, raf, user } = renderAt('/');
    raf.frame(16);
    expect(nav.style.getPropertyValue('--ind-o')).toBe('0');
    await user.click(within(nav).getByRole('link', { name: 'Responsible AI' }));
    expect(nav.style.getPropertyValue('--ind-o')).toBe('1');
    expect(nav.style.getPropertyValue('--ind-x')).toBe('200px');
    // The transform transition is off for this one change; it is back a frame later.
    expect(nav).not.toHaveAttribute('data-placed');
    raf.frame(32);
    expect(nav).toHaveAttribute('data-placed');
  });

  it('hides again when the route has no link in the navigation', async () => {
    const { nav, user } = renderAt('/responsible-ai');
    await user.click(screen.getByRole('link', { name: 'Firefly home' }));
    expect(nav.style.getPropertyValue('--ind-o')).toBe('0');
  });

  it('measures nothing and stays hidden where a link is not displayed (a closed menu has no offset parent)', () => {
    layOut();
    vi.spyOn(HTMLElement.prototype, 'offsetParent', 'get').mockReturnValue(null);
    render(
      <MemoryRouter initialEntries={['/responsible-ai']}>
        <PublicHeader />
      </MemoryRouter>,
    );
    const nav = screen.getByRole('navigation', { name: 'Primary' });
    expect(nav.style.getPropertyValue('--ind-o')).toBe('0');
  });
});

describe('the header’s edge and shadow once the page has scrolled', () => {
  /** Moves the page to a scroll position and tells listeners, as the browser does. */
  function scrollTo(y: number) {
    Object.defineProperty(window, 'scrollY', { configurable: true, value: y });
    act(() => {
      window.dispatchEvent(new Event('scroll'));
    });
  }

  it('appears on the public header after a scroll of more than a few pixels, and goes at the top again', () => {
    const raf = stubRaf();
    render(
      <MemoryRouter>
        <PublicHeader />
      </MemoryRouter>,
    );
    const header = screen.getByRole('banner');
    expect(header).not.toHaveAttribute('data-scrolled');
    scrollTo(120);
    raf.frame(16);
    expect(header).toHaveAttribute('data-scrolled');
    scrollTo(0);
    raf.frame(32);
    expect(header).not.toHaveAttribute('data-scrolled');
  });

  it('is there at once for a page restored part-way down, with no flash of the plain bar', () => {
    stubRaf();
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 500 });
    render(
      <MemoryRouter>
        <PublicHeader />
      </MemoryRouter>,
    );
    expect(screen.getByRole('banner')).toHaveAttribute('data-scrolled');
  });

  it('applies to the app header as well', () => {
    stubConfig(makeConfig());
    const raf = stubRaf();
    render(
      <MemoryRouter>
        <AppProviders>
          <SectionProvider>
            <AppHeader />
          </SectionProvider>
        </AppProviders>
      </MemoryRouter>,
    );
    const header = screen.getByRole('banner');
    expect(header).not.toHaveAttribute('data-scrolled');
    scrollTo(60);
    raf.frame(16);
    expect(header).toHaveAttribute('data-scrolled');
  });
});

describe('the header’s stylesheet', () => {
  const css = readFileSync(join(process.cwd(), 'web/src/app/shell/header.css'), 'utf8').replace(
    /\/\*[\s\S]*?\*\//g,
    '',
  );
  const rule = (selector: string) => {
    const start = css.indexOf(`${selector} {`);
    return start < 0 ? '' : css.slice(start, css.indexOf('}', start) + 1);
  };

  it('no longer draws a line under each current link: the one indicator replaced it', () => {
    expect(css).not.toMatch(/\.ff-navlink\[aria-current='page'\]::after/);
    expect(css).toMatch(/\.ff-header__indicator\s*\{/);
  });

  it('moves the indicator by transform and opacity only, on the shared durations, and only once it is placed', () => {
    const placed = rule('.ff-header__nav[data-placed] .ff-header__indicator');
    expect(placed).toMatch(/transition:\s*transform var\(--motion-component\)/);
    expect(placed).toMatch(/opacity var\(--motion-control\)/);
    expect(placed).not.toMatch(/(width|height|left|top|inset)/);
    expect(rule('.ff-header__indicator')).not.toMatch(/transition:[^;]*transform/);
  });

  it('is a bar on the left of the current row in the collapsed menu, and a line under the text from 48em', () => {
    const base = rule('.ff-header__indicator');
    expect(base).toMatch(/translateY\(calc\(var\(--ind-cy, 0px\)/);
    const wide = css.slice(css.indexOf('@media (min-width: 48em)'));
    expect(wide).toMatch(/\.ff-header__indicator\s*\{[^}]*scaleX\(var\(--ind-w, 0\)\)/);
  });

  it('adds an edge and a soft shadow when scrolled, with no blur and no change of size', () => {
    expect(rule('.ff-header[data-scrolled]')).toMatch(
      /border-block-end-color:\s*var\(--acrylic-border\)/,
    );
    expect(rule('.ff-header[data-scrolled]')).toMatch(/box-shadow:\s*var\(--shadow-4\)/);
    const header = rule('.ff-header');
    expect(header).toMatch(/border-block-end:\s*var\(--stroke-w\) solid transparent/);
    expect(header).toMatch(/transition:\s*border-color [^;]*box-shadow/);
    expect(css).not.toMatch(/backdrop-filter/);
  });

  it('keeps the indicator visible when colours are forced', () => {
    const forced = css.slice(css.indexOf('@media (forced-colors: active)'));
    expect(forced).toMatch(/\.ff-header__indicator\s*\{[^}]*background:\s*Highlight/);
  });
});
