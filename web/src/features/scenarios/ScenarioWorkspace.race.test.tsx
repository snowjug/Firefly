import { act, cleanup, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PublicScenarioDTO } from '#shared/domain/api.ts';
import { api } from '../../lib/api.ts';
import type * as ApiModule from '../../lib/api.ts';
import type * as CarouselModule from '../../design/carousel/Carousel.tsx';
import { sortScenarios } from './catalogue.ts';
import { cardTitle } from './labels.ts';
import { publicScenarios } from './testing/fixtures.ts';
import { mockApi, renderApp } from './testing/harness.tsx';

// The workspace tidies its address once the scenarios have arrived (it adds the scenario it
// selected). That tidying was worked out in the render that showed the gallery and ran a moment
// later, in an effect. A choice made in between (a filter or a scenario) was then overwritten by the
// tidying of a screen the person had already moved on from, and silently lost.
//
// These tests make the choice at the one moment that is hard to hit by hand: while the gallery is
// being put on the page, after the render that worked out the tidying and before the effect that
// applies it.

vi.mock('../../lib/api.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof ApiModule>();
  return {
    ...actual,
    api: { config: vi.fn(), scenarios: vi.fn(), scenario: vi.fn(), createSession: vi.fn() },
  };
});

// What happens the moment the gallery is first put on the page: the carousel itself is the real one.
const whenGalleryCommits = vi.hoisted(() => ({ run: null as (() => void) | null }));

vi.mock('../../design/carousel/Carousel.tsx', async (importOriginal) => {
  const actual = await importOriginal<typeof CarouselModule>();
  const { createElement, useLayoutEffect } = await import('react');
  function GalleryThatSaysWhen(props: Parameters<typeof actual.Carousel>[0]) {
    useLayoutEffect(() => {
      const run = whenGalleryCommits.run;
      whenGalleryCommits.run = null;
      run?.();
    }, []);
    return createElement(actual.Carousel, props);
  }
  return { ...actual, Carousel: GalleryThatSaysWhen };
});

const scenarios = publicScenarios();
const sorted = sortScenarios(scenarios);
const second = sorted[1] as PublicScenarioDTO;

beforeEach(() => {
  mockApi();
});
afterEach(() => {
  cleanup();
  whenGalleryCommits.run = null;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Opens the workspace with the scenarios still on their way, and lets them arrive; `choice` is made as they do. */
async function arriveWhile(choice: () => void) {
  let arrive: (list: PublicScenarioDTO[]) => void = () => undefined;
  vi.mocked(api.scenarios).mockReturnValue(new Promise((resolve) => (arrive = resolve)));
  const app = renderApp('/scenarios');
  expect(app.where()).toBe('/scenarios');

  whenGalleryCommits.run = choice;
  await act(async () => arrive(scenarios));
  expect(whenGalleryCommits.run, 'the choice was made as the gallery arrived').toBeNull();
  return app;
}

/** Lets anything left over from the tidying happen, then looks again. */
const settle = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 60)));

const gallery = () => screen.getByRole('region', { name: 'Scenarios' });

describe('a choice made as the gallery arrives is kept', () => {
  it('a filter', async () => {
    const app = await arriveWhile(() => {
      within(screen.getByRole('group', { name: 'Product' }))
        .getByRole('radio', { name: /^Azure/ })
        .click();
    });

    await waitFor(() => expect(app.query().get('f_product')).toBe('azure'));
    await settle();
    expect(app.query().get('f_product')).toBe('azure');
    expect(
      within(screen.getByRole('group', { name: 'Product' })).getByRole('radio', { name: /^Azure/ }),
    ).toBeChecked();
    expect(within(gallery()).getAllByRole('radio')).toHaveLength(
      scenarios.filter((scenario) => scenario.product.id === 'azure').length,
    );
  });

  it('a scenario', async () => {
    const app = await arriveWhile(() => {
      within(gallery())
        .getByRole('radio', { name: cardTitle(second) })
        .click();
    });

    await waitFor(() => expect(app.query().get('scenario')).toBe(second.id));
    await settle();
    expect(app.query().get('scenario')).toBe(second.id);
    expect(within(gallery()).getByRole('radio', { name: cardTitle(second) })).toBeChecked();
    expect(screen.getByRole('heading', { level: 2, name: second.title })).toBeVisible();
  });

  it('and the address is still tidied afterwards when nothing was chosen', async () => {
    const app = await arriveWhile(() => undefined);
    await waitFor(() => expect(app.query().get('scenario')).toBe(sorted[0]?.id));
  });
});
