import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AnnouncerProvider } from '../../design/primitives/LiveRegion.tsx';
import { ApiError, api } from '../../lib/api.ts';
import { FEATURED } from './landing-copy.ts';
import { FeaturedScenarios } from './FeaturedScenarios.tsx';
import { ARRIVAL_STEPS } from '../scenarios/arrival.ts';
import { makeScenario, stubIntersection, watching } from './test-utils.ts';
import { PRODUCT_IDS } from '#shared/domain/vocab.ts';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// The first test to show the gallery compiles it; give a busy machine room.
vi.setConfig({ testTimeout: 30_000 });

const library = () => [
  ...PRODUCT_IDS.map((product) => makeScenario(`${product}-a`, product, 'standard')),
  makeScenario('teams-b', 'teams', 'starter'),
];
const network = () => new ApiError(0, 'network', 'Cannot reach Firefly.', true);

function setUp() {
  return {
    user: userEvent.setup(),
    ...render(
      <MemoryRouter>
        <AnnouncerProvider>
          <FeaturedScenarios />
        </AnnouncerProvider>
      </MemoryRouter>,
    ),
  };
}
const section = () => screen.getByRole('region', { name: FEATURED.title });
// The gallery is its own chunk: the first visit compiles it, which can take a while on a busy machine.
const gallery = () => screen.findByRole('region', { name: 'Scenario cards' }, { timeout: 20_000 });

describe('the featured scenarios: loading', () => {
  it('has its heading and its line at once, grey cards, and a word for a screen reader', () => {
    vi.spyOn(api, 'scenarios').mockReturnValue(new Promise(() => undefined));
    setUp();
    expect(
      within(section()).getByRole('heading', { level: 2, name: 'Featured scenarios' }),
    ).toBeVisible();
    expect(within(section()).getByText(FEATURED.lead)).toBeVisible();
    const busy = within(section()).getByText(FEATURED.loading).closest('[aria-busy="true"]');
    expect(busy).not.toBeNull();
    expect(busy?.querySelectorAll('.lp-featured__skeleton')).toHaveLength(4);
    expect(screen.queryByRole('region', { name: 'Scenario cards' })).toBeNull();
    expect(screen.queryByRole('link', { name: FEATURED.all })).toBeNull();
  });

  it('asks the server for the scenarios once, and for nothing else', () => {
    const scenarios = vi.spyOn(api, 'scenarios').mockReturnValue(new Promise(() => undefined));
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    setUp();
    expect(scenarios).toHaveBeenCalledTimes(1);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('the featured scenarios: loaded', () => {
  it('shows the gallery: one card for each product, each a link into the workspace with that scenario chosen', async () => {
    vi.spyOn(api, 'scenarios').mockResolvedValue(library());
    setUp();
    const cards = await gallery();
    const items = within(cards).getAllByRole('listitem');
    expect(items).toHaveLength(12);
    const links = within(cards).getAllByRole('link', { name: /Use scenario/ });
    expect(links).toHaveLength(12);
    const hrefs = links.map((link) => link.getAttribute('href'));
    expect(new Set(hrefs).size).toBe(12);
    for (const href of hrefs) expect(href).toMatch(/^\/scenarios\?scenario=[\w-]+$/);
    // The gentlest scenario of a product leads: Teams has two, and the starter is the one shown.
    expect(hrefs).toContain('/scenarios?scenario=teams-b');
    expect(hrefs).not.toContain('/scenarios?scenario=teams-a');
  });

  it('offers a plain link to all the scenarios, and takes the grey cards away', async () => {
    vi.spyOn(api, 'scenarios').mockResolvedValue(library());
    setUp();
    await gallery();
    expect(within(section()).getByRole('link', { name: FEATURED.all })).toHaveAttribute(
      'href',
      '/scenarios',
    );
    expect(screen.queryByText(FEATURED.loading)).toBeNull();
    expect(section().querySelector('.lp-featured__skeleton')).toBeNull();
  });

  it('is named, so a screen reader can find the gallery among the page’s regions', async () => {
    vi.spyOn(api, 'scenarios').mockResolvedValue(library());
    setUp();
    expect(await gallery()).toHaveAttribute('aria-roledescription', 'carousel');
  });
});

describe('the featured scenarios: how the cards arrive', () => {
  const cards = (root: HTMLElement) => [...root.querySelectorAll<HTMLElement>('.scn-card')];
  const step = (card: HTMLElement) => Number(card.style.getPropertyValue('--reveal-i'));

  it('rest on their first frame until the row has been seen, then arrive together, one after another', async () => {
    stubIntersection();
    vi.spyOn(api, 'scenarios').mockResolvedValue(library());
    setUp();
    const row = await gallery();
    const shown = cards(row);
    expect(shown).toHaveLength(12);
    const arriving = shown.filter((card) => card.hasAttribute('data-arrive'));
    expect(arriving.length).toBeGreaterThan(0);
    for (const card of arriving) expect(card).toHaveAttribute('data-arrive', 'waiting');

    // One observer watches the whole row, not one for each card.
    const observer = watching(row.parentElement as HTMLElement);
    expect(observer).toBeDefined();
    observer?.report(false);
    for (const card of arriving) expect(card).toHaveAttribute('data-arrive', 'waiting');
    observer?.report(true);
    for (const card of arriving) expect(card).toHaveAttribute('data-arrive', 'now');
    // They stop watching once the row has been seen: it arrives once.
    expect(watching(row.parentElement as HTMLElement)).toBeUndefined();
  });

  it('come in a beat apart, in the order they are shown, and only the first few: the rest are simply there', async () => {
    stubIntersection();
    vi.spyOn(api, 'scenarios').mockResolvedValue(library());
    setUp();
    const shown = cards(await gallery());
    shown.forEach((card, index) => {
      if (index < ARRIVAL_STEPS) expect(step(card), `card ${index}`).toBe(index);
      else expect(card, `card ${index}`).not.toHaveAttribute('data-arrive');
    });
  });

  it('do not wait where the browser cannot say what is in view, so nothing stays hidden', async () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    vi.spyOn(api, 'scenarios').mockResolvedValue(library());
    setUp();
    const shown = cards(await gallery());
    for (const card of shown) expect(card.getAttribute('data-arrive')).not.toBe('waiting');
  });

  it('keep every card a link into the workspace, whether or not it has arrived', async () => {
    stubIntersection();
    vi.spyOn(api, 'scenarios').mockResolvedValue(library());
    setUp();
    const row = await gallery();
    expect(within(row).getAllByRole('link', { name: /Use scenario/ })).toHaveLength(12);
  });
});

describe('the featured scenarios: when they cannot be shown', () => {
  it('says so in one quiet line, with a way to try again and a plain link to all the scenarios', async () => {
    vi.spyOn(api, 'scenarios').mockRejectedValue(network());
    setUp();
    expect(await within(section()).findByText(FEATURED.failed)).toBeVisible();
    expect(within(section()).getByRole('button', { name: FEATURED.retry })).toBeVisible();
    expect(within(section()).getByRole('link', { name: FEATURED.browse })).toHaveAttribute(
      'href',
      '/scenarios',
    );
    expect(screen.queryByRole('region', { name: 'Scenario cards' })).toBeNull();
    expect(section().querySelector('.lp-featured__skeleton')).toBeNull();
    // The heading and the line are still there: the section is never a broken block.
    expect(within(section()).getByRole('heading', { level: 2 })).toHaveTextContent(FEATURED.title);
  });

  it('tries again on request, and shows the gallery when the second try works', async () => {
    const scenarios = vi
      .spyOn(api, 'scenarios')
      .mockRejectedValueOnce(network())
      .mockResolvedValue(library());
    const { user } = setUp();
    await user.click(await within(section()).findByRole('button', { name: FEATURED.retry }));
    expect(await gallery()).toBeInTheDocument();
    expect(scenarios).toHaveBeenCalledTimes(2);
    expect(within(section()).queryByText(FEATURED.failed)).toBeNull();
  });

  it('says that the visitor is offline, when they are, instead of blaming the scenarios', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    vi.spyOn(api, 'scenarios').mockRejectedValue(network());
    setUp();
    expect(await within(section()).findByText(FEATURED.offline)).toBeVisible();
    expect(within(section()).getByRole('button', { name: FEATURED.retry })).toBeVisible();
    expect(within(section()).getByRole('link', { name: FEATURED.browse })).toBeVisible();
  });

  it('treats a library with nothing in it as nothing to show, not as an empty gallery', async () => {
    vi.spyOn(api, 'scenarios').mockResolvedValue([]);
    setUp();
    expect(await within(section()).findByText(FEATURED.failed)).toBeVisible();
    expect(screen.queryByRole('region', { name: 'Scenario cards' })).toBeNull();
  });

  it('tells a screen reader once, through the page’s one announcer', async () => {
    vi.spyOn(api, 'scenarios').mockRejectedValue(network());
    setUp();
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(FEATURED.failed));
  });
});
