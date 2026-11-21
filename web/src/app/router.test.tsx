import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { classifyRouteError } from './shell/RouteError.tsx';
import { renderApp } from './test-kit.tsx';

// The pages are replaced by plain stand-ins, so these tests are about the router and the shell and
// keep passing whatever the real pages say.
const page = vi.hoisted(() => ({ crash: false }));

vi.mock('../pages/Landing.tsx', () => ({
  default: () => (
    <>
      <h1>Landing page</h1>
      <section id="overview" aria-label="Overview">
        <h2>Overview</h2>
      </section>
      <section id="how-it-works" aria-label="How it works">
        <h2>How it works</h2>
      </section>
    </>
  ),
}));
vi.mock('../pages/ResponsibleAi.tsx', () => ({ default: () => <h1>Responsible AI page</h1> }));
vi.mock('../pages/About.tsx', () => ({ default: () => <h1>About page</h1> }));
vi.mock('../pages/NotFound.tsx', () => ({ default: () => <h1>Not found page</h1> }));
vi.mock('../pages/Scenarios.tsx', async () => {
  const { useAppSection } = await import('./section.tsx');
  return {
    default: function Scenarios() {
      useAppSection('Scenarios');
      if (page.crash) throw new Error('secret raw message');
      return <h1>Scenarios page</h1>;
    },
  };
});
vi.mock('../pages/Brief.tsx', async () => {
  const { useAppSection } = await import('./section.tsx');
  return {
    default: function Brief() {
      useAppSection('Call brief', { backTo: '/scenarios', backLabel: 'Scenarios' });
      return <h1>Brief page</h1>;
    },
  };
});
vi.mock('../pages/Report.tsx', () => ({ default: () => <h1>Report page</h1> }));
vi.mock('../pages/Call.tsx', () => ({ default: () => <h1>Call page</h1> }));

beforeEach(() => {
  page.crash = false;
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('routes', () => {
  it.each([
    ['/', 'Landing page', 'public'],
    ['/responsible-ai', 'Responsible AI page', 'public'],
    ['/about', 'About page', 'public'],
    ['/scenarios', 'Scenarios page', 'app'],
    ['/scenarios/s1/brief', 'Brief page', 'app'],
    ['/sessions/x1/report', 'Report page', 'app'],
    ['/calls/c1', 'Call page', 'call'],
    ['/no/such/page', 'Not found page', 'public'],
  ])('%s shows "%s" in the %s layout', async (path, heading, layout) => {
    renderApp(path);
    expect(await screen.findByRole('heading', { level: 1, name: heading })).toBeInTheDocument();
    const main = screen.getByRole('main');
    expect(screen.getAllByRole('main')).toHaveLength(1);
    expect(main).toHaveAttribute('id', 'main');
    expect(main).toHaveAttribute('tabindex', '-1');
    expect(screen.getByRole('link', { name: 'Skip to main content' })).toHaveAttribute(
      'href',
      '#main',
    );
    if (layout === 'call') {
      // The call page draws its own command bar: no header, no navigation, no footer.
      expect(screen.queryByRole('banner')).not.toBeInTheDocument();
      expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
      expect(screen.queryByRole('contentinfo')).not.toBeInTheDocument();
    } else {
      expect(screen.getByRole('banner')).toBeInTheDocument();
      expect(screen.getAllByRole('navigation')).toHaveLength(1);
      expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument();
      expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    }
  });

  it('puts the skip link first in the tab order', async () => {
    const user = userEvent.setup();
    renderApp('/');
    await screen.findByRole('heading', { level: 1, name: 'Landing page' });
    await user.tab();
    expect(screen.getByRole('link', { name: 'Skip to main content' })).toHaveFocus();
  });

  it('lets a page name the section in the app header, with a way back', async () => {
    renderApp('/scenarios/s1/brief');
    await screen.findByRole('heading', { level: 1, name: 'Brief page' });
    const header = screen.getByRole('banner');
    expect(await within(header).findByText('Call brief')).toBeInTheDocument();
    expect(within(header).getByRole('link', { name: 'Back to Scenarios' })).toHaveAttribute(
      'href',
      '/scenarios',
    );
  });

  it('forgets the section when the page goes', async () => {
    const { router } = renderApp('/scenarios');
    await screen.findByRole('heading', { level: 1, name: 'Scenarios page' });
    expect(await within(screen.getByRole('banner')).findByText('Scenarios')).toBeInTheDocument();
    await router.navigate('/sessions/x1/report');
    await screen.findByRole('heading', { level: 1, name: 'Report page' });
    await waitFor(() =>
      expect(within(screen.getByRole('banner')).queryByText('Scenarios')).not.toBeInTheDocument(),
    );
  });
});

describe('focus and scroll after navigation', () => {
  it('leaves focus alone when the document has just loaded', async () => {
    renderApp('/about');
    await screen.findByRole('heading', { level: 1, name: 'About page' });
    expect(document.body).toHaveFocus();
  });

  it('moves focus to the new page\u2019s main after a client-side navigation, and scrolls to the top', async () => {
    const user = userEvent.setup();
    const { scrolling } = renderApp('/');
    await screen.findByRole('heading', { level: 1, name: 'Landing page' });
    await user.click(within(screen.getByRole('banner')).getByRole('link', { name: 'About' }));
    await screen.findByRole('heading', { level: 1, name: 'About page' });
    await waitFor(() => expect(screen.getByRole('main')).toHaveFocus());
    expect(scrolling.scrollTo).toHaveBeenCalledWith(0, 0);
  });

  it('scrolls to the section a hash link names, and moves focus there', async () => {
    const user = userEvent.setup();
    const { scrolling } = renderApp('/about');
    await screen.findByRole('heading', { level: 1, name: 'About page' });
    await user.click(
      within(screen.getByRole('banner')).getByRole('link', { name: 'How it works' }),
    );
    await screen.findByRole('heading', { level: 1, name: 'Landing page' });
    await waitFor(() => expect(document.getElementById('how-it-works')).toHaveFocus());
    expect(scrolling.scrollIntoView).toHaveBeenCalled();
  });

  it('follows a hash change on the same page, with no new page and no focus on main', async () => {
    const user = userEvent.setup();
    const { scrolling } = renderApp('/');
    await screen.findByRole('heading', { level: 1, name: 'Landing page' });
    await user.click(within(screen.getByRole('banner')).getByRole('link', { name: 'Overview' }));
    await waitFor(() => expect(document.getElementById('overview')).toHaveFocus());
    scrolling.scrollIntoView.mockClear();
    await user.click(
      within(screen.getByRole('banner')).getByRole('link', { name: 'How it works' }),
    );
    await waitFor(() => expect(document.getElementById('how-it-works')).toHaveFocus());
    expect(scrolling.scrollIntoView).toHaveBeenCalled();
    expect(screen.getByRole('main')).not.toHaveFocus();
  });

  it('scrolls to the hash when the page loads with one, without taking focus', async () => {
    const { scrolling } = renderApp('/#how-it-works');
    await screen.findByRole('heading', { level: 1, name: 'Landing page' });
    expect(scrolling.scrollIntoView).toHaveBeenCalled();
    expect(document.body).toHaveFocus();
  });
});

describe('when a page fails', () => {
  it('says what happened and what to do, never the raw message, and keeps the layout', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    page.crash = true;
    renderApp('/scenarios');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Something went wrong on this page' }),
    ).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent('secret raw message');
    expect(screen.getByRole('alert')).toHaveTextContent(/already saved are not affected/);
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to scenarios' })).toHaveAttribute(
      'href',
      '/scenarios',
    );
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
    // The header and footer are still there around the message.
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    expect(document.title).toBe('Something went wrong \u00b7 Firefly');
  });

  it('draws the page again when Try again is pressed', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const user = userEvent.setup();
    page.crash = true;
    renderApp('/scenarios');
    await screen.findByRole('heading', { level: 1, name: 'Something went wrong on this page' });
    page.crash = false;
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Scenarios page' }),
    ).toBeInTheDocument();
  });

  it('tells a page that never arrived from one that threw', () => {
    expect(
      classifyRouteError(new TypeError('Failed to fetch dynamically imported module: /x.js')),
    ).toBe('load');
    expect(classifyRouteError(new TypeError('error loading dynamically imported module'))).toBe(
      'load',
    );
    expect(classifyRouteError(new TypeError('Importing a module script failed.'))).toBe('load');
    expect(classifyRouteError(new Error('boom'))).toBe('unknown');
    expect(classifyRouteError('boom')).toBe('unknown');
  });
});
