import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '../../lib/theme.tsx';
import { CommandDock } from './CommandDock.tsx';

// jsdom lays nothing out, so every item is given a 100 px wide slot on a ruler 600 px wide: the
// pip's position is then the centre of the item it is on.
const SLOT = 100;
let box: { mockRestore(): void };

function mount(path: string, finePointer = true) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: finePointer && query === '(hover: hover) and (pointer: fine)',
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
  render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[path]}>
        <CommandDock />
      </MemoryRouter>
    </ThemeProvider>,
  );
  return {
    pip: () => document.querySelector('.dock__pip') as HTMLElement,
    x: () =>
      (document.querySelector('.dock__pip') as HTMLElement).style.getPropertyValue('--pip-x'),
    link: (name: string) => screen.getByRole('link', { name }),
  };
}

beforeEach(() => {
  box = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement,
  ) {
    const links = [...document.querySelectorAll('.dock__link')];
    const index = links.indexOf(this);
    const left = index >= 0 ? index * SLOT : 0;
    return { left, right: left + SLOT, width: index >= 0 ? SLOT : 600 } as DOMRect;
  });
});
afterEach(() => {
  box.mockRestore();
  vi.unstubAllGlobals();
});

describe('the dock pip', () => {
  it('rests on the centre of the current destination', () => {
    const dock = mount('/history');
    expect(dock.x()).toBe('250.0px');
    expect(dock.pip()).toHaveAttribute('data-on', 'true');
  });

  it('rests nowhere on a page that belongs to no destination', () => {
    const dock = mount('/help');
    expect(dock.pip()).toHaveAttribute('data-on', 'false');
  });

  it('leans to the destination under a fine pointer, and comes back when it leaves', async () => {
    const user = userEvent.setup();
    const dock = mount('/home');
    expect(dock.x()).toBe('50.0px');
    await user.hover(dock.link('Progress'));
    expect(dock.x()).toBe('350.0px');
    await user.hover(dock.link('Studio'));
    expect(dock.x()).toBe('450.0px');
    await user.unhover(dock.link('Studio'));
    expect(dock.x()).toBe('50.0px');
  });

  it('does not lean on a device without a fine pointer', async () => {
    const user = userEvent.setup();
    const dock = mount('/home', false);
    await user.hover(dock.link('Progress'));
    expect(dock.x()).toBe('50.0px');
  });

  it('follows keyboard focus as closely as a pointer, and returns when focus leaves', async () => {
    const user = userEvent.setup();
    const dock = mount('/home', false);
    await user.tab();
    await user.tab();
    expect(dock.link('Missions')).toHaveFocus();
    expect(dock.x()).toBe('150.0px');
    await user.tab({ shift: true });
    await user.tab({ shift: true });
    expect(document.body).toHaveFocus();
    expect(dock.x()).toBe('50.0px');
  });

  it('is not allowed to move until it has been put in place', () => {
    const dock = mount('/home');
    // The first frame places it without a glide; the transition is switched on a frame later.
    expect(dock.pip()).not.toHaveAttribute('data-ready');
  });
});
