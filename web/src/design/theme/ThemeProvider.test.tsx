import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AnnouncerProvider } from '../primitives/LiveRegion.tsx';
import { ThemeProvider } from './ThemeProvider.tsx';
import { ThemeSelect, ThemeToggle } from './ThemeToggle.tsx';
import { THEME_STORAGE_KEY } from './theme.ts';

// A media query the test can flip, the way the operating system does.
function stubSystem(initialDark: boolean) {
  const listeners = new Set<() => void>();
  let dark = initialDark;
  const colour = {
    get matches() {
      return dark;
    },
    addEventListener: (_: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
  };
  vi.stubGlobal('matchMedia', (query: string) =>
    query.includes('prefers-color-scheme')
      ? colour
      : { matches: false, addEventListener: () => {}, removeEventListener: () => {} },
  );
  return {
    set(next: boolean) {
      dark = next;
      act(() => listeners.forEach((listener) => listener()));
    },
  };
}

const page = () => document.documentElement;

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  page().removeAttribute('data-theme');
  page().removeAttribute('data-theme-preference');
  page().style.colorScheme = '';
});

describe('ThemeProvider', () => {
  it('puts the system theme on the page when nothing is saved', () => {
    stubSystem(true);
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );
    expect(page().dataset.theme).toBe('dark');
    expect(page().dataset.themePreference).toBe('system');
    expect(screen.getByRole('button', { name: 'Dark theme' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('puts a saved choice on the page, whatever the system says', () => {
    stubSystem(true);
    window.localStorage.setItem(THEME_STORAGE_KEY, 'light');
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );
    expect(page().dataset.theme).toBe('light');
    expect(screen.getByRole('button', { name: 'Dark theme' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('follows the system while the person has chosen nothing, and stops when they choose', () => {
    const system = stubSystem(false);
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );
    expect(page().dataset.theme).toBe('light');
    system.set(true);
    expect(page().dataset.theme).toBe('dark');
    system.set(false);
    expect(page().dataset.theme).toBe('light');
  });

  it('keeps an explicit choice when the system changes', async () => {
    const system = stubSystem(false);
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'Dark theme' }));
    expect(page().dataset.theme).toBe('dark');
    system.set(true);
    system.set(false);
    expect(page().dataset.theme).toBe('dark');
  });

  it('follows a choice made in another tab', () => {
    stubSystem(false);
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );
    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', { key: THEME_STORAGE_KEY, newValue: 'dark' }),
      );
    });
    expect(page().dataset.theme).toBe('dark');
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: THEME_STORAGE_KEY, newValue: null }));
    });
    expect(page().dataset.themePreference).toBe('system');
  });

  it('shows no controls where there is no provider', () => {
    stubSystem(false);
    const { container } = render(
      <>
        <ThemeToggle />
        <ThemeSelect />
      </>,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe('ThemeToggle', () => {
  it('switches theme and remembers it on this device, from the keyboard too', async () => {
    stubSystem(false);
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );
    await user.tab();
    const button = screen.getByRole('button', { name: 'Dark theme' });
    expect(button).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(page().dataset.theme).toBe('dark');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(button).toHaveAttribute('aria-pressed', 'true');
    await user.keyboard(' ');
    expect(page().dataset.theme).toBe('light');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
    expect(button).toHaveAttribute('aria-pressed', 'false');
  });

  it('keeps its name the same in both states, so the pressed state is what changes', async () => {
    stubSystem(false);
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );
    await user.click(screen.getByRole('button'));
    expect(screen.getByRole('button')).toHaveAccessibleName('Dark theme');
  });
});

describe('ThemeSelect', () => {
  it('offers Light, Dark and System as one group, with the saved choice selected', () => {
    stubSystem(false);
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    render(
      <ThemeProvider>
        <ThemeSelect />
      </ThemeProvider>,
    );
    const group = screen.getByRole('group', { name: 'Theme' });
    expect(group).toBeInTheDocument();
    expect(screen.getAllByRole('radio').map((radio) => radio.getAttribute('value'))).toEqual([
      'light',
      'dark',
      'system',
    ]);
    expect(screen.getByRole('radio', { name: 'Dark' })).toBeChecked();
  });

  it('applies a choice, remembers it, confirms it in words and then lets the words go', async () => {
    stubSystem(false);
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { container } = render(
      <AnnouncerProvider>
        <ThemeProvider>
          <ThemeSelect />
        </ThemeProvider>
      </AnnouncerProvider>,
    );
    const saved = () => container.querySelector('.ff-theme-select__saved') as HTMLElement;
    expect(saved()).not.toHaveAttribute('data-on');
    await user.click(screen.getByRole('radio', { name: 'Dark' }));
    expect(page().dataset.theme).toBe('dark');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(saved()).toHaveAttribute('data-on');
    expect(saved()).toHaveTextContent('Saved on this device');
    act(() => {
      vi.advanceTimersByTime(2600);
    });
    expect(saved()).not.toHaveAttribute('data-on');
  });

  it('says the choice once, through the page announcer, and adds no live region of its own', async () => {
    stubSystem(false);
    const user = userEvent.setup();
    render(
      <AnnouncerProvider>
        <ThemeProvider>
          <ThemeSelect />
        </ThemeProvider>
      </AnnouncerProvider>,
    );
    expect(screen.getAllByRole('status')).toHaveLength(1);
    await user.click(screen.getByRole('radio', { name: 'Dark' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Dark theme saved on this device.');
    expect(screen.getAllByRole('status')).toHaveLength(1);
  });

  it('does not claim "Saved" when the browser blocks storage: it applies the choice and says it is not kept', async () => {
    stubSystem(false);
    const blocked = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage is blocked.', 'SecurityError');
    });
    try {
      const user = userEvent.setup();
      const { container } = render(
        <AnnouncerProvider>
          <ThemeProvider>
            <ThemeSelect />
          </ThemeProvider>
        </AnnouncerProvider>,
      );
      await user.click(screen.getByRole('radio', { name: 'Dark' }));
      expect(page().dataset.theme).toBe('dark');
      expect(container.querySelector('.ff-theme-select__saved')).toHaveTextContent(
        'Not saved: storage is blocked',
      );
      expect(await screen.findByRole('status')).toHaveTextContent(
        'Dark theme applied. This browser is not keeping it.',
      );
    } finally {
      blocked.mockRestore();
    }
  });

  it('stores "System" as no choice and goes back to following the system', async () => {
    stubSystem(true);
    window.localStorage.setItem(THEME_STORAGE_KEY, 'light');
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <ThemeSelect />
      </ThemeProvider>,
    );
    expect(page().dataset.theme).toBe('light');
    await user.click(screen.getByRole('radio', { name: 'System' }));
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
    expect(page().dataset.theme).toBe('dark');
    expect(page().dataset.themePreference).toBe('system');
  });
});
