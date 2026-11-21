import { act, cleanup, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PublicScenarioDTO } from '#shared/domain/api.ts';
import { api } from '../../lib/api.ts';
import type * as ApiModule from '../../lib/api.ts';
import { groupByIssue } from './catalogue.ts';
import type * as ListModule from './ScenarioList.tsx';
import { publicScenarios } from './testing/fixtures.ts';
import { mockApi, renderApp, stubViewport } from './testing/harness.tsx';

// The workspace tidies its address once the scenarios have arrived (it adds the scenario it
// selected). That tidying was worked out in the render that showed the list and ran a moment later,
// in an effect. A choice made in between (a filter, a search, a scenario) was then overwritten by the
// tidying of a screen the person had already moved on from, and silently lost.
//
// These tests make the choice at the one moment that is hard to hit by hand: while the list is being
// put on the page, after the render that worked out the tidying and before the effect that applies it.

vi.mock('../../lib/api.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof ApiModule>();
  return {
    ...actual,
    api: {
      config: vi.fn(),
      scenarios: vi.fn(),
      scenario: vi.fn(),
      createSession: vi.fn(),
      listSessions: vi.fn(),
    },
  };
});

// What happens the moment the list is first put on the page: the list itself is the real one.
const whenListCommits = vi.hoisted(() => ({ run: null as (() => void) | null }));

vi.mock('./ScenarioList.tsx', async (importOriginal) => {
  const actual = await importOriginal<typeof ListModule>();
  const { createElement, useLayoutEffect } = await import('react');
  function ListThatSaysWhen(props: Parameters<typeof actual.ScenarioList>[0]) {
    useLayoutEffect(() => {
      const run = whenListCommits.run;
      whenListCommits.run = null;
      run?.();
    }, []);
    return createElement(actual.ScenarioList, props);
  }
  return { ...actual, ScenarioList: ListThatSaysWhen };
});

const scenarios = publicScenarios();
const groups = groupByIssue(scenarios);
const second = groups[0]?.scenarios[1] as PublicScenarioDTO;

beforeEach(() => {
  mockApi();
  stubViewport(true);
});
afterEach(() => {
  cleanup();
  whenListCommits.run = null;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Opens the workspace with the list still on its way, and lets it arrive; `choice` is made as it does. */
async function arriveWhile(choice: () => void) {
  let arrive: (list: PublicScenarioDTO[]) => void = () => undefined;
  vi.mocked(api.scenarios).mockReturnValue(new Promise((resolve) => (arrive = resolve)));
  const app = renderApp('/scenarios');
  expect(app.where()).toBe('/scenarios');

  whenListCommits.run = choice;
  await act(async () => arrive(scenarios));
  expect(whenListCommits.run, 'the choice was made as the list arrived').toBeNull();
  return app;
}

/** Lets anything left over from the tidying happen, then looks again. */
const settle = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 60)));

const list = () => screen.getByRole('group', { name: 'Choose a scenario' });

describe('a choice made as the list arrives is kept', () => {
  it('a filter', async () => {
    const app = await arriveWhile(() => {
      const issue = screen.getByRole('combobox', { name: 'Issue type' }) as HTMLSelectElement;
      issue.value = 'how-to';
      issue.dispatchEvent(new Event('change', { bubbles: true }));
    });

    await waitFor(() => expect(app.query().get('f_issue')).toBe('how-to'));
    await settle();
    expect(app.query().get('f_issue')).toBe('how-to');
    expect(screen.getByRole('combobox', { name: 'Issue type' })).toHaveValue('how-to');
    expect(within(list()).getAllByRole('radio')).toHaveLength(
      scenarios.filter((scenario) => scenario.issueType === 'how-to').length,
    );
  });

  it('a search', async () => {
    const app = await arriveWhile(() => {
      const search = screen.getByRole('searchbox', { name: 'Search scenarios' });
      const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setValue?.call(search, 'Lindqvist');
      search.dispatchEvent(new Event('input', { bubbles: true }));
    });

    await waitFor(() => expect(app.query().get('q')).toBe('Lindqvist'));
    await settle();
    expect(app.query().get('q')).toBe('Lindqvist');
    expect(screen.getByRole('searchbox', { name: 'Search scenarios' })).toHaveValue('Lindqvist');
    expect(within(list()).getAllByRole('radio')).toHaveLength(1);
  });

  it('a scenario', async () => {
    const app = await arriveWhile(() => {
      within(list()).getByRole('radio', { name: second.title }).click();
    });

    await waitFor(() => expect(app.query().get('scenario')).toBe(second.id));
    await settle();
    expect(app.query().get('scenario')).toBe(second.id);
    expect(within(list()).getByRole('radio', { name: second.title })).toBeChecked();
    expect(screen.getByRole('heading', { level: 2, name: second.title })).toBeVisible();
  });

  it('and the address is still tidied afterwards when nothing was chosen', async () => {
    const app = await arriveWhile(() => undefined);
    await waitFor(() => expect(app.query().get('scenario')).toBe(groups[0]?.scenarios[0]?.id));
  });
});
