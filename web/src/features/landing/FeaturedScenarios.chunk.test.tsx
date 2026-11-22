import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../lib/api.ts';
import { FEATURED } from './landing-copy.ts';
import { FeaturedScenarios } from './FeaturedScenarios.tsx';
import { makeScenario } from './test-utils.ts';

// The gallery is another chunk. If that chunk cannot be fetched (a stale tab after a new version, a
// network that dropped half way) the page must not fail: the featured section says so, quietly.
vi.mock('./FeaturedCarousel.tsx', () => {
  throw new Error('The chunk did not arrive.');
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('the featured scenarios when the gallery’s code cannot be loaded', () => {
  it('shows the same quiet line, with a plain link to all the scenarios, and the rest of the section stays', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(api, 'scenarios').mockResolvedValue([makeScenario('teams-a', 'teams')]);
    render(
      <MemoryRouter>
        <FeaturedScenarios />
      </MemoryRouter>,
    );
    const section = screen.getByRole('region', { name: FEATURED.title });
    expect(await within(section).findByText(FEATURED.failed)).toBeVisible();
    expect(within(section).getByRole('link', { name: FEATURED.browse })).toHaveAttribute(
      'href',
      '/scenarios',
    );
    expect(within(section).getByRole('button', { name: FEATURED.retry })).toBeVisible();
    expect(within(section).getByRole('heading', { level: 2 })).toHaveTextContent(FEATURED.title);
  });
});
