import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../lib/api.ts';
import type * as ApiModule from '../../lib/api.ts';
import { AmbientProvider } from '../../lib/motion/ambient.tsx';
import { ThemeProvider } from '../../lib/theme.tsx';
import { makeScenario } from '../scenario/scenario-fixtures.ts';
import { Palette, resetPaletteForTests } from './Palette.tsx';
import { removeViewTransitionStub, stubViewTransitions, Where } from './shell-test-kit.tsx';

vi.mock('../../lib/api.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof ApiModule>();
  return { ...actual, api: { scenarios: vi.fn() } };
});

const scenarios = vi.mocked(api.scenarios);

function Harness({ onClose }: { onClose: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open palette
      </button>
      <Where />
      <main id="main" tabIndex={-1}>
        <h1>Page</h1>
      </main>
      {open ? (
        <Palette
          onClose={() => {
            onClose();
            setOpen(false);
          }}
        />
      ) : null}
    </>
  );
}

function renderPalette(onClose: () => void = () => undefined) {
  const root = document.createElement('div');
  root.id = 'root';
  document.body.appendChild(root);
  const router = createMemoryRouter([{ path: '*', element: <Harness onClose={onClose} /> }], {
    initialEntries: ['/start'],
  });
  const view = render(
    <ThemeProvider>
      <AmbientProvider>
        <RouterProvider router={router} />
      </AmbientProvider>
    </ThemeProvider>,
    { container: root },
  );
  return { router, root, ...view };
}

async function open(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Open palette' }));
  const dialog = await screen.findByRole('dialog', { name: 'Search and commands' });
  return { dialog, input: within(dialog).getByRole('combobox') };
}

const MISSIONS = [
  makeScenario({ id: 'locked-out', title: 'Locked out after a password reset' }),
  makeScenario({ id: 'team-workspace', title: 'Team cannot open the shared workspace' }),
];

beforeEach(() => {
  vi.resetAllMocks();
  stubViewTransitions();
  localStorage.clear();
  resetPaletteForTests();
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.removeAttribute('data-motion');
  scenarios.mockResolvedValue(MISSIONS);
});

afterEach(() => {
  removeViewTransitionStub();
  document.getElementById('root')?.remove();
  document.body.style.overflow = '';
});

describe('the palette dialog', () => {
  it('is a labelled combobox over a listbox, with the first row highlighted', async () => {
    const user = userEvent.setup();
    renderPalette();
    const { dialog, input } = await open(user);
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(input).toHaveFocus();
    expect(input).toHaveAccessibleName('Search and commands');
    expect(input).toHaveAttribute('aria-expanded', 'true');
    expect(input).toHaveAttribute('aria-autocomplete', 'list');
    const list = within(dialog).getByRole('listbox', { name: 'Results' });
    expect(input).toHaveAttribute('aria-controls', list.id);
    const options = within(list).getAllByRole('option');
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
    expect(options.slice(1).every((o) => o.getAttribute('aria-selected') === 'false')).toBe(true);
    expect(input).toHaveAttribute('aria-activedescendant', options[0]?.id);
    expect(
      within(list)
        .getAllByRole('group')
        .map((g) => g.getAttribute('aria-labelledby')),
    ).not.toContain(null);
    expect(within(list).getByRole('group', { name: 'Go to' })).toBeInTheDocument();
    expect(within(list).getByRole('group', { name: 'Display' })).toBeInTheDocument();
  });

  it('fetches the missions when it opens and not before, and lists them', async () => {
    const user = userEvent.setup();
    renderPalette();
    expect(scenarios).not.toHaveBeenCalled();
    const { dialog } = await open(user);
    expect(scenarios).toHaveBeenCalledTimes(1);
    expect(
      await within(dialog).findByRole('option', { name: /Locked out after a password reset/ }),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole('group', { name: 'Missions' })).toBeInTheDocument();
  });

  it('opens the page of a mission that was chosen, and moves focus to the page', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderPalette(onClose);
    const { input } = await open(user);
    await user.type(input, 'workspace{Enter}');
    expect(await screen.findByTestId('where')).toHaveTextContent('/scenarios/team-workspace/setup');
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('main')).toHaveFocus());
  });

  it('still offers pages and commands when the missions cannot be loaded, and says so', async () => {
    scenarios.mockRejectedValue(new Error('offline'));
    const user = userEvent.setup();
    renderPalette();
    const { dialog } = await open(user);
    expect(
      await within(dialog).findByText('Missions are unavailable right now.'),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole('option', { name: /^Settings/ })).toBeInTheDocument();
    expect(within(dialog).queryByRole('group', { name: 'Missions' })).not.toBeInTheDocument();
  });

  it('says it is loading the missions until they arrive', async () => {
    let resolve: (list: typeof MISSIONS) => void = () => undefined;
    scenarios.mockReturnValue(new Promise((done) => (resolve = done)));
    const user = userEvent.setup();
    renderPalette();
    const { dialog } = await open(user);
    expect(within(dialog).getByText(/Loading missions/)).toBeInTheDocument();
    await act(async () => resolve(MISSIONS));
    expect(within(dialog).queryByText(/Loading missions/)).not.toBeInTheDocument();
  });

  it('remembers the missions, so a second opening shows them at once', async () => {
    const user = userEvent.setup();
    renderPalette();
    const first = await open(user);
    await within(first.dialog).findByRole('option', { name: /Locked out/ });
    await user.keyboard('{Escape}');
    const second = await open(user);
    expect(within(second.dialog).getByRole('option', { name: /Locked out/ })).toBeInTheDocument();
  });
});

describe('keyboard', () => {
  it('walks the rows with the arrow keys, wrapping, and with Home and End', async () => {
    const user = userEvent.setup();
    renderPalette();
    const { dialog, input } = await open(user);
    const options = () => within(dialog).getAllByRole('option');
    const selected = () => options().findIndex((o) => o.getAttribute('aria-selected') === 'true');
    await user.keyboard('{ArrowDown}{ArrowDown}');
    expect(selected()).toBe(2);
    expect(input).toHaveAttribute('aria-activedescendant', options()[2]?.id);
    await user.keyboard('{ArrowUp}{ArrowUp}{ArrowUp}');
    expect(selected()).toBe(options().length - 1);
    await user.keyboard('{ArrowDown}');
    expect(selected()).toBe(0);
    await user.keyboard('{End}');
    expect(selected()).toBe(options().length - 1);
    await user.keyboard('{Home}');
    expect(selected()).toBe(0);
    expect(input).toHaveFocus();
  });

  it('filters as it is typed and starts again from the best match', async () => {
    const user = userEvent.setup();
    renderPalette();
    const { dialog, input } = await open(user);
    await user.keyboard('{ArrowDown}{ArrowDown}');
    await user.type(input, 'hist');
    const options = within(dialog).getAllByRole('option');
    expect(options[0]).toHaveTextContent('History');
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
    expect(options.at(-1)).toHaveTextContent('Search missions for \u201chist\u201d');
    expect(within(dialog).queryByRole('option', { name: /^Settings/ })).not.toBeInTheDocument();
  });

  it('says how many results there are, once typing pauses, and says when there are none', async () => {
    const user = userEvent.setup();
    renderPalette();
    const { dialog, input } = await open(user);
    const status = within(dialog).getByRole('status');
    expect(status).toBeEmptyDOMElement();
    await user.type(input, 'hist');
    await waitFor(() => expect(status).toHaveTextContent('1 result.'));
    await user.clear(input);
    await user.type(input, 'zzqx');
    await waitFor(() => expect(status).toHaveTextContent('No pages or missions match'));
    expect(status).toHaveTextContent('Press Enter to search missions for \u201czzqx\u201d.');
  });

  it('runs the highlighted row on Enter: a page', async () => {
    const user = userEvent.setup();
    const { router } = renderPalette();
    const { input } = await open(user);
    await user.type(input, 'progress{Enter}');
    await waitFor(() => expect(router.state.location.pathname).toBe('/progress'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('runs the highlighted row on Enter: the library search, with the words typed', async () => {
    const user = userEvent.setup();
    const { router } = renderPalette();
    const { input } = await open(user);
    await user.type(input, 'sign in{Enter}');
    await waitFor(() => expect(router.state.location.pathname).toBe('/scenarios'));
    expect(router.state.location.search).toBe('?q=sign%20in');
  });

  it('closes on Escape and gives focus back to what had it', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderPalette(onClose);
    const opener = screen.getByRole('button', { name: 'Open palette' });
    await open(user);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(opener).toHaveFocus();
  });

  it('keeps Tab inside, between the field and the close button', async () => {
    const user = userEvent.setup();
    renderPalette();
    const { dialog, input } = await open(user);
    const close = within(dialog).getByRole('button', { name: 'Close' });
    await user.tab();
    expect(close).toHaveFocus();
    await user.tab();
    expect(input).toHaveFocus();
    await user.tab({ shift: true });
    expect(close).toHaveFocus();
    await user.tab({ shift: true });
    expect(input).toHaveFocus();
  });

  it('holds the page still behind it and lets go on close', async () => {
    const user = userEvent.setup();
    const { root } = renderPalette();
    await open(user);
    expect(root).toHaveAttribute('inert');
    expect(document.body.style.overflow).toBe('hidden');
    await user.keyboard('{Escape}');
    expect(root).not.toHaveAttribute('inert');
    expect(document.body.style.overflow).toBe('');
  });
});

describe('commands', () => {
  it('switches the theme and closes, with focus back where it was', async () => {
    const user = userEvent.setup();
    renderPalette();
    localStorage.setItem('firefly.theme', JSON.stringify('dark'));
    const opener = screen.getByRole('button', { name: 'Open palette' });
    const { input } = await open(user);
    await user.type(input, 'light theme{Enter}');
    await waitFor(() => expect(document.documentElement).toHaveAttribute('data-theme', 'light'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it('pauses ambient motion, and then offers to resume it', async () => {
    const user = userEvent.setup();
    renderPalette();
    let { input } = await open(user);
    await user.type(input, 'pause{Enter}');
    await waitFor(() => expect(document.documentElement).toHaveAttribute('data-ambient', 'paused'));
    expect(JSON.parse(localStorage.getItem('firefly.ambient') ?? 'null')).toBe('paused');
    ({ input } = await open(user));
    await user.type(input, 'resume');
    expect(within(screen.getByRole('dialog')).getAllByRole('option')[0]).toHaveTextContent(
      'Resume ambient motion',
    );
  });

  it('does not offer ambient motion when reduced motion has switched it off', async () => {
    localStorage.setItem('firefly.motion', JSON.stringify('reduce'));
    const user = userEvent.setup();
    renderPalette();
    const { dialog } = await open(user);
    expect(
      within(dialog).queryByRole('option', { name: /ambient motion/ }),
    ).not.toBeInTheDocument();
    expect(within(dialog).getByRole('option', { name: /theme/ })).toBeInTheDocument();
  });
});

describe('pointer', () => {
  it('highlights the row under the pointer and runs the one that is clicked', async () => {
    const user = userEvent.setup();
    const { router } = renderPalette();
    const { dialog, input } = await open(user);
    const history = within(dialog).getByRole('option', { name: /^History/ });
    await user.hover(history);
    expect(history).toHaveAttribute('aria-selected', 'true');
    expect(input).toHaveAttribute('aria-activedescendant', history.id);
    expect(input).toHaveFocus();
    await user.click(history);
    await waitFor(() => expect(router.state.location.pathname).toBe('/history'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes from the close button and from a press outside, but not from one inside', async () => {
    const user = userEvent.setup();
    renderPalette();
    const { dialog, input } = await open(user);
    await user.click(input);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await open(user);
    const scrim = screen.getByRole('dialog').parentElement as HTMLElement;
    await user.pointer({ keys: '[MouseLeft>]', target: scrim });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
