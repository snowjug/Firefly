import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter, RouterProvider, createMemoryRouter } from 'react-router';
import type { AppConfigDTO } from '#shared/domain/api.ts';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppProviders } from '../App.tsx';
import { SectionProvider, useAppSection } from './section.tsx';
import { AppHeader } from './shell/AppHeader.tsx';
import { Footer } from './shell/Footer.tsx';
import { PublicHeader } from './shell/PublicHeader.tsx';
import { RootError, ErrorMessage } from './shell/RouteError.tsx';
import { OfflineNotice } from './shell/Shell.tsx';
import { Wordmark } from './shell/Wordmark.tsx';
import { makeConfig, stubConfig } from './test-kit.tsx';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function inRouter(ui: ReactNode, path = '/') {
  return <MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>;
}

describe('PublicHeader', () => {
  it('has the wordmark, two links with real addresses, and the main action', () => {
    render(inRouter(<PublicHeader />));
    const nav = screen.getByRole('navigation', { name: 'Primary' });
    expect(
      within(nav)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Scenarios', 'Responsible AI']);
    expect(within(nav).getByRole('link', { name: 'Scenarios' })).toHaveAttribute(
      'href',
      '/scenarios',
    );
    expect(within(nav).getByRole('link', { name: 'Responsible AI' })).toHaveAttribute(
      'href',
      '/responsible-ai',
    );
    expect(screen.getByRole('link', { name: 'Start call' })).toHaveAttribute('href', '/scenarios');
    expect(screen.getByRole('link', { name: 'Firefly home' })).toHaveAttribute('href', '/');
  });

  it('marks the page you are on', () => {
    render(inRouter(<PublicHeader />, '/responsible-ai'));
    expect(screen.getByRole('link', { name: 'Responsible AI' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: 'Scenarios' })).not.toHaveAttribute('aria-current');
  });

  it('collapses the links into a disclosure: aria-expanded, aria-controls, Escape closes and returns focus', async () => {
    const user = userEvent.setup();
    render(inRouter(<PublicHeader />));
    const menu = screen.getByRole('button', { name: 'Menu' });
    const nav = screen.getByRole('navigation', { name: 'Primary' });
    expect(menu).toHaveAttribute('aria-expanded', 'false');
    expect(menu).toHaveAttribute('aria-controls', nav.id);
    expect(nav).not.toHaveAttribute('data-open');

    await user.click(menu);
    expect(menu).toHaveAttribute('aria-expanded', 'true');
    expect(nav).toHaveAttribute('data-open');

    await user.tab();
    expect(screen.getByRole('link', { name: 'Scenarios' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(menu).toHaveAttribute('aria-expanded', 'false');
    expect(menu).toHaveFocus();
  });

  it('closes when focus leaves it, and when a link is followed', async () => {
    const user = userEvent.setup();
    render(
      inRouter(
        <>
          <PublicHeader />
          <button type="button">Elsewhere</button>
        </>,
      ),
    );
    const menu = screen.getByRole('button', { name: 'Menu' });
    await user.click(menu);
    expect(menu).toHaveAttribute('aria-expanded', 'true');
    await user.click(screen.getByRole('button', { name: 'Elsewhere' }));
    expect(menu).toHaveAttribute('aria-expanded', 'false');

    await user.click(menu);
    await user.click(screen.getByRole('link', { name: 'Responsible AI' }));
    expect(menu).toHaveAttribute('aria-expanded', 'false');
  });

  it('opens and closes with one press each, never twice', async () => {
    const user = userEvent.setup();
    render(inRouter(<PublicHeader />));
    const menu = screen.getByRole('button', { name: 'Menu' });
    await user.click(menu);
    expect(menu).toHaveAttribute('aria-expanded', 'true');
    await user.click(menu);
    expect(menu).toHaveAttribute('aria-expanded', 'false');
    await user.click(menu);
    expect(menu).toHaveAttribute('aria-expanded', 'true');
  });
});

describe('AppHeader', () => {
  function Page({ title, backTo }: { title: string; backTo?: string }) {
    useAppSection(title, backTo ? { backTo, backLabel: 'Scenarios' } : {});
    return null;
  }
  function renderHeader(
    config: AppConfigDTO | null = makeConfig(),
    page: ReactNode = <Page title="Scenarios" />,
  ) {
    const fetchStub = stubConfig(config);
    const view = render(
      inRouter(
        <AppProviders>
          <SectionProvider>
            <AppHeader />
            {page}
          </SectionProvider>
        </AppProviders>,
      ),
    );
    return { fetchStub, ...view };
  }

  it('shows the section the page named, and a Responsible AI link', async () => {
    renderHeader();
    const header = screen.getByRole('banner');
    expect(await within(header).findByText('Scenarios')).toBeInTheDocument();
    expect(within(header).getByRole('navigation', { name: 'Primary' })).toBeInTheDocument();
    expect(within(header).getByRole('link', { name: 'Responsible AI' })).toHaveAttribute(
      'href',
      '/responsible-ai',
    );
  });

  it('says Demo mode when the server is in demo mode, and never calls it live', async () => {
    renderHeader(makeConfig({ demo: true }));
    expect(await screen.findByText('Demo mode')).toBeInTheDocument();
    expect(screen.queryByText(/^Live/)).not.toBeInTheDocument();
  });

  it('shows the real provider label when the server is live', async () => {
    renderHeader(makeConfig({ demo: false, label: 'Azure OpenAI (gpt-4o)' }));
    expect(await screen.findByText('Live: Azure OpenAI (gpt-4o)')).toBeInTheDocument();
    expect(screen.queryByText('Demo mode')).not.toBeInTheDocument();
  });

  it('shows nothing about the provider if the config did not load, rather than guessing', async () => {
    const { fetchStub } = renderHeader(null);
    await waitFor(() => expect(fetchStub).toHaveBeenCalled());
    await act(async () => undefined);
    const header = screen.getByRole('banner');
    expect(header).not.toHaveTextContent(/Demo mode|Live:/);
    // The disclosure button is still there, named for what it opens.
    expect(within(header).getByRole('button', { name: 'Menu' })).toBeInTheDocument();
  });

  it('carries a notice the server gave, in the disclosure', async () => {
    renderHeader(makeConfig({ demo: true, notice: 'The language model key is missing.' }));
    await screen.findByText('Demo mode');
    expect(screen.getByText(/The language model key is missing\./)).toBeInTheDocument();
  });

  it('explains what the status means, honestly, in a disclosure that Escape closes', async () => {
    const user = userEvent.setup();
    renderHeader();
    const button = await screen.findByRole('button', { name: 'Demo mode' });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    await user.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(
      screen.getByText(/built-in rules engine, not a live language model/),
    ).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).toHaveFocus();
  });

  it('offers a Back control and the parent as a link when the page sits below another', async () => {
    renderHeader(makeConfig(), <Page title="Call brief" backTo="/scenarios" />);
    const header = screen.getByRole('banner');
    expect(await within(header).findByText('Call brief')).toBeInTheDocument();
    expect(within(header).getByRole('link', { name: 'Back to Scenarios' })).toHaveAttribute(
      'href',
      '/scenarios',
    );
    expect(within(header).getByRole('link', { name: 'Scenarios' })).toHaveAttribute(
      'href',
      '/scenarios',
    );
  });

  it('is harmless for a page to ask for a section where there is no app header', () => {
    expect(() => render(<Page title="Anything" />)).not.toThrow();
  });
});

describe('OfflineNotice', () => {
  it('says nothing while online, and says what is kept when the connection drops', () => {
    const online = vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(true);
    render(<OfflineNotice />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    online.mockReturnValue(false);
    act(() => window.dispatchEvent(new Event('offline')));
    expect(screen.getByRole('status')).toHaveTextContent(
      'You are offline. Firefly keeps your work and reconnects when you are back.',
    );
    online.mockReturnValue(true);
    act(() => window.dispatchEvent(new Event('online')));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});

describe('Footer', () => {
  it('says what Firefly is in one line, links to two pages and the source, and has no version string', () => {
    render(inRouter(<Footer />));
    const footer = screen.getByRole('contentinfo');
    expect(footer).toHaveTextContent('A training aid. Customers and scenarios are fictional.');
    expect(within(footer).getByRole('link', { name: 'Responsible AI' })).toHaveAttribute(
      'href',
      '/responsible-ai',
    );
    expect(within(footer).getByRole('link', { name: 'About' })).toHaveAttribute('href', '/about');
    const source = within(footer).getByRole('link', { name: /Source on GitHub/ });
    expect(source).toHaveAttribute('href', 'https://github.com/snowjug/Firefly');
    expect(source).toHaveAttribute('target', '_blank');
    expect(source).toHaveAttribute('rel', 'noopener noreferrer');
    expect(source).toHaveAccessibleName('Source on GitHub, opens in a new tab');
    expect(footer).not.toHaveTextContent(/version|v\d+\.\d+/i);
  });

  it('adds no navigation landmark of its own', () => {
    render(inRouter(<Footer />));
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });
});

describe('Wordmark', () => {
  it('is a link home named for the product, with a decorative mark', () => {
    const { container } = render(inRouter(<Wordmark to="/" />));
    expect(screen.getByRole('link', { name: 'Firefly home' })).toHaveAttribute('href', '/');
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('is plain text without a destination', () => {
    render(<Wordmark />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText('Firefly')).toBeInTheDocument();
  });
});

describe('ErrorMessage', () => {
  it('says a page is missing, offers no retry for it, and does not claim anything about saved work', () => {
    render(inRouter(<ErrorMessage kind="not-found" />));
    expect(
      screen.getByRole('heading', { level: 1, name: 'We cannot find that page' }),
    ).toBeVisible();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Check the address, or start from the scenarios.',
    );
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Saved calls/)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to scenarios' })).toHaveAttribute(
      'href',
      '/scenarios',
    );
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
  });

  it('says a page did not load, in words that depend on whether you are online, and retries once per press', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    const { rerender } = render(inRouter(<ErrorMessage kind="load" online onRetry={onRetry} />));
    expect(screen.getByRole('alert')).toHaveTextContent('Check your connection, then try again.');
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Saved calls and reports are not affected.',
    );
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    rerender(inRouter(<ErrorMessage kind="load" online={false} onRetry={onRetry} />));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'You are offline. Reconnect, then try again.',
    );
  });

  it('never shows an error’s own message', () => {
    render(inRouter(<ErrorMessage kind="unknown" onRetry={() => undefined} />));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Something went wrong on this page',
    );
    expect(document.body).not.toHaveTextContent(/stack|TypeError|undefined|at \w+\.\w+/);
  });
});

describe('RootError', () => {
  it('stands alone when a whole layout fails: a skip link, a main, a calm message and the way on', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    function Boom(): never {
      throw new Error('secret raw message');
    }
    const router = createMemoryRouter([{ path: '/', element: <Boom />, ErrorBoundary: RootError }]);
    render(<RouterProvider router={router} />);
    expect(screen.getByRole('link', { name: 'Skip to main content' })).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main');
    expect(
      screen.getByRole('heading', { level: 1, name: 'Something went wrong on this page' }),
    ).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent('secret raw message');
    expect(screen.getByRole('link', { name: 'Go to scenarios' })).toBeInTheDocument();
  });
});
