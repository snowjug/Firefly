import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import type { PublicScenarioDTO } from '#shared/domain/api.ts';
import type { MissionRecommendation, ScenarioPractice } from '#shared/domain/recommend.ts';
import type { Difficulty } from '#shared/domain/vocab.ts';
import { makeScenario } from '../scenario/scenario-fixtures.ts';
import { MissionMap } from './MissionMap.tsx';
import { practiceBrief, practiceText } from './practice-text.ts';

const make = (id: string, difficulty: Difficulty, minutes: number): PublicScenarioDTO =>
  makeScenario({ id, difficulty, estimatedMinutes: minutes, title: `Mission ${id}` });

const SCENARIOS = [
  make('a', 'starter', 7),
  make('b', 'starter', 9),
  make('c', 'standard', 10),
  make('d', 'challenge', 12),
];
const all = new Set(SCENARIOS.map((s) => s.id));
const NONE = new Map<string, ScenarioPractice>();

function renderMap(
  props: Partial<React.ComponentProps<typeof MissionMap>> = {},
  scenarios: PublicScenarioDTO[] = SCENARIOS,
) {
  const onPreview = vi.fn();
  render(
    <MemoryRouter>
      <MissionMap
        scenarios={scenarios}
        matchIds={all}
        practice={NONE}
        recommendation={null}
        onPreview={onPreview}
        {...props}
      />
    </MemoryRouter>,
  );
  return { onPreview, toolbar: screen.getByRole('toolbar', { name: 'Missions' }) };
}

const node = (name: RegExp | string) =>
  within(screen.getByRole('toolbar', { name: 'Missions' })).getByRole('button', {
    name: new RegExp(name),
  });

describe('practice text', () => {
  it('says plainly what has happened', () => {
    expect(practiceText(undefined)).toBe('Not attempted');
    expect(practiceText({ scenarioId: 'a', state: 'in-progress' } as ScenarioPractice)).toBe(
      'In progress',
    );
    const practised = {
      scenarioId: 'a',
      state: 'practised',
      completed: 2,
      best: 4.25,
    } as ScenarioPractice;
    expect(practiceText(practised)).toBe('Practised 2 times, best 4.3');
    expect(practiceBrief(practised)).toBe('Practised');
  });
});

describe('MissionMap', () => {
  it('shows every mission as a button and the first one in the details panel', () => {
    renderMap();
    for (const s of SCENARIOS) expect(node(s.title)).toBeInTheDocument();
    const panel = screen.getByRole('article', { name: 'Mission a' });
    expect(within(panel).getByRole('link', { name: 'Set up call: Mission a' })).toHaveAttribute(
      'href',
      '/scenarios/a/setup',
    );
    expect(node('Mission a')).toHaveAttribute('aria-pressed', 'true');
    expect(node('Mission b')).toHaveAttribute('aria-pressed', 'false');
    for (const row of ['Starter', 'Standard', 'Challenge']) {
      expect(screen.getByText(row, { selector: '.mm-band-label' })).toBeInTheDocument();
    }
  });

  it('selects a mission by click and keeps the Set up call link in step with it', async () => {
    const user = userEvent.setup();
    renderMap();
    await user.click(node('Mission c'));
    expect(screen.getByRole('article', { name: 'Mission c' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Set up call: Mission c' })).toBeInTheDocument();
    expect(node('Mission c')).toHaveAttribute('aria-pressed', 'true');
    expect(node('Mission a')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('status')).toHaveTextContent(/Selected: Mission c\. Standard\./);
  });

  it('opens the same preview as the list', async () => {
    const user = userEvent.setup();
    const { onPreview } = renderMap();
    await user.click(screen.getByRole('button', { name: 'Preview Mission a' }));
    expect(onPreview).toHaveBeenCalledWith(expect.objectContaining({ id: 'a' }));
  });

  it('can be used from the keyboard: one tab stop, arrows to move, Enter to select', async () => {
    const user = userEvent.setup();
    const { toolbar } = renderMap();
    const stops = within(toolbar)
      .getAllByRole('button')
      .filter((b) => b.getAttribute('tabindex') === '0');
    expect(stops).toHaveLength(1);
    expect(stops[0]).toBe(node('Mission a'));

    node('Mission a').focus();
    await user.keyboard('{ArrowRight}');
    expect(node('Mission b')).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).not.toBe(node('Mission b'));
    await user.keyboard('{Home}');
    expect(node('Mission a')).toHaveFocus();
    await user.keyboard('{End}');
    expect(node('Mission d')).toHaveFocus();
    // Moving does not select; Enter does.
    expect(screen.getByRole('article', { name: 'Mission a' })).toBeInTheDocument();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('article', { name: 'Mission d' })).toBeInTheDocument();
    expect(node('Mission d')).toHaveAttribute('aria-pressed', 'true');
  });

  it('keeps filtered-out missions in place but unreachable, and falls back when the selection is filtered out', async () => {
    const user = userEvent.setup();
    const matches = new Set(['b', 'c']);
    renderMap({ matchIds: matches });
    // Mission a does not match: it stays on the map but cannot be focused or pressed.
    const dimmed = document.querySelector('[data-mission="a"]') as HTMLElement;
    expect(dimmed).toHaveAttribute('data-match', 'false');
    expect(dimmed).toHaveAttribute('inert');
    expect(screen.getByRole('article', { name: 'Mission b' })).toBeInTheDocument();
    node('Mission b').focus();
    await user.keyboard('{ArrowLeft}');
    expect(node('Mission b')).toHaveFocus();
  });

  it('marks the recommended mission and gives the reason in the panel', () => {
    const recommendation = {
      scenario: SCENARIOS[2],
      kind: 'build-skill',
      dimension: 'scoping-discovery',
      difficulty: 'standard',
      reason: 'Scoping & Discovery is your lowest skill so far (average 2.4 of 5).',
    } as MissionRecommendation;
    renderMap({ recommendation });
    expect(within(node('Mission c')).getByText('Recommended')).toBeInTheDocument();
    const panel = screen.getByRole('article', { name: 'Mission c' });
    expect(within(panel).getByText('Recommended next mission')).toBeInTheDocument();
    expect(panel).toHaveTextContent('lowest skill so far (average 2.4 of 5)');
  });

  it('shows what has been practised, in words', () => {
    const practice = new Map<string, ScenarioPractice>([
      [
        'a',
        { scenarioId: 'a', state: 'practised', completed: 2, best: 4.5, latest: 4, lastAt: null },
      ],
      [
        'b',
        {
          scenarioId: 'b',
          state: 'in-progress',
          completed: 0,
          best: null,
          latest: null,
          lastAt: null,
        },
      ],
    ]);
    renderMap({ practice });
    expect(node('Mission a')).toHaveTextContent('Practised · 7 min');
    expect(node('Mission b')).toHaveTextContent('In progress · 9 min');
    expect(node('Mission c')).toHaveTextContent('Not attempted · 10 min');
    expect(node('Mission a')).toHaveAttribute('data-state', 'practised');
    expect(screen.getByRole('article')).toHaveTextContent('Practised 2 times, best 4.5');
  });
});
