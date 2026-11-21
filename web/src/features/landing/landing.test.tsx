import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DIFFICULTY_PROFILES } from '#shared/domain/state.ts';
import {
  DIMENSIONS,
  DIMENSION_IDS,
  ISSUE_TYPE_LABELS,
  START_TEMPERATURE_LABELS,
} from '#shared/domain/vocab.ts';
import Landing from '../../pages/Landing.tsx';
import { mockConfig, renderPublicPage } from '../content/test-support.tsx';
import { CALL_MINUTES, SCENARIO_EXAMPLES } from './scenario-examples.ts';
import { LANDING_TITLE } from './use-landing-title.ts';

// The first test to visit the page compiles it; give a busy machine room.
vi.setConfig({ testTimeout: 30_000 });

describe('the landing page', () => {
  beforeEach(() => mockConfig());
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('is titled exactly as the brief says', async () => {
    await renderPublicPage('/');
    expect(LANDING_TITLE).toBe('Firefly: practise customer conversations');
    await waitFor(() => expect(document.title).toBe(LANDING_TITLE));
  });

  it('opens with the promise, the way in and a reassurance', async () => {
    await renderPublicPage('/');
    const main = screen.getByRole('main');
    expect(within(main).getByRole('heading', { level: 1 })).toHaveTextContent(
      'Practise the conversation before it becomes a real customer call.',
    );
    expect(within(main).getByText('Customer call practice for support engineers')).toBeVisible();
    expect(
      within(main).getByText(
        'Choose a realistic support scenario, speak with an AI customer and receive evidence-based coaching after the call.',
      ),
    ).toBeVisible();
    for (const link of within(main).getAllByRole('link', { name: 'Start a simulation' })) {
      expect(link).toHaveAttribute('href', '/scenarios');
    }
    expect(within(main).getByRole('link', { name: 'See how it works' })).toHaveAttribute(
      'href',
      '/#how-it-works',
    );
    // "employee-performance" sits in its own span so it never breaks at the hyphen.
    expect(within(main).getByText(/^Every customer is fictional\./)).toHaveTextContent(
      'Every customer is fictional. Scores are for coaching practice, not employee-performance assessment.',
    );
  });

  it('has a labelled region for each section, with the anchors the header links to', async () => {
    await renderPublicPage('/');
    const names = screen
      .getAllByRole('region')
      .map((region) => region.getAttribute('aria-labelledby'))
      .map((id) => (id ? document.getElementById(id)?.textContent : null));
    expect(names).toEqual([
      'A safe place to practise support conversations',
      'How it works',
      'Seven kinds of customer issue',
      'Coaching based on what was actually said',
      'Responsible use',
      'Begin your first simulated call',
    ]);
    expect(
      screen.getByRole('region', { name: 'A safe place to practise support conversations' }),
    ).toHaveAttribute('id', 'overview');
    expect(screen.getByRole('region', { name: 'How it works' })).toHaveAttribute(
      'id',
      'how-it-works',
    );
    const nav = screen.getByRole('navigation', { name: 'Primary' });
    expect(within(nav).getByRole('link', { name: 'Overview' })).toHaveAttribute(
      'href',
      '/#overview',
    );
    expect(within(nav).getByRole('link', { name: 'How it works' })).toHaveAttribute(
      'href',
      '/#how-it-works',
    );
  });

  it('puts three short facts in a row, as a list and not as cards', async () => {
    await renderPublicPage('/');
    const region = screen.getByRole('region', {
      name: 'A safe place to practise support conversations',
    });
    const facts = within(within(region).getByRole('list')).getAllByRole('listitem');
    expect(facts.map((fact) => fact.textContent)).toEqual([
      'Spoken or typedTalk to the customer, or type if you prefer. Every call can be typed.',
      'An unscripted customerTheir mood moves with what you say, and they share important details only when you ask relevant questions.',
      'Coaching from your own wordsEvery score is tied to the exact things you said.',
    ]);
  });

  it('explains how it works as three connected steps in an ordered list', async () => {
    await renderPublicPage('/');
    const region = screen.getByRole('region', { name: 'How it works' });
    const steps = within(region).getByRole('list');
    expect(steps.tagName).toBe('OL');
    const items = within(steps).getAllByRole('listitem');
    expect(
      items.map((item) => within(item).getByRole('heading', { level: 3 }).textContent),
    ).toEqual(['Choose a scenario', 'Conduct the call', 'Review the coaching report']);
    // The numbers beside the steps are drawn for the eye; the list already numbers the steps.
    expect(steps.querySelectorAll('[aria-hidden="true"]')).toHaveLength(3);
    expect(
      within(region).getByRole('heading', { level: 3, name: 'Why practise out loud' }),
    ).toBeVisible();
    expect(within(region).getByText(/any call can be typed\./)).toBeVisible();
  });

  it('shows one real example for each kind of issue, with its difficulty and starting mood', async () => {
    await renderPublicPage('/');
    const region = screen.getByRole('region', { name: 'Seven kinds of customer issue' });
    const rows = [...region.querySelectorAll<HTMLElement>('dl > div')];
    expect(rows).toHaveLength(SCENARIO_EXAMPLES.length);
    SCENARIO_EXAMPLES.forEach((example, index) => {
      const row = within(rows[index] as HTMLElement);
      expect(row.getByText(ISSUE_TYPE_LABELS[example.issueType])).toBeVisible();
      expect(row.getByText(example.title)).toBeVisible();
      expect(row.getByText(DIFFICULTY_PROFILES[example.difficulty].label)).toBeVisible();
      expect(
        row.getByText(START_TEMPERATURE_LABELS[example.startingTemperature].label),
      ).toBeVisible();
    });
    expect(within(region).getByRole('link', { name: 'Browse all scenarios' })).toHaveAttribute(
      'href',
      '/scenarios',
    );
  });

  it('shows the coaching report ingredients with the real skill names and score words', async () => {
    await renderPublicPage('/');
    const region = screen.getByRole('region', { name: 'Coaching based on what was actually said' });
    expect(
      within(region).getByText(
        'After the call Firefly scores six skills from 1 to 5 and shows its evidence.',
      ),
    ).toBeVisible();

    const table = within(region).getByRole('table', {
      name: 'Six coaching skills, each scored from 1 to 5',
    });
    const rows = within(table).getAllByRole('row');
    expect(rows).toHaveLength(DIMENSION_IDS.length);
    DIMENSION_IDS.forEach((id, index) => {
      expect(within(rows[index] as HTMLElement).getByRole('rowheader')).toHaveTextContent(
        DIMENSIONS[id].label,
      );
      expect(rows[index]).toHaveTextContent(/\d of 5\s*(Developing|Strong|Excellent)/);
    });

    expect(within(region).getByText('Why it worked.')).toBeVisible();
    const evidence = region.querySelector('blockquote');
    expect(evidence).toHaveTextContent(
      'When did it start, and has anything changed on your side recently?',
    );
    expect(evidence).toHaveTextContent('Turn 4');
    expect(within(region).getByText('Try saying')).toBeVisible();
    expect(within(region).getByText('Found')).toBeVisible();
    expect(within(region).getByText('Missed')).toBeVisible();
    expect(within(region).getByText(/A question worth asking:/)).toBeVisible();
    expect(
      within(region).getByText(
        'Illustration using a fictional call. A real report is built from your own transcript.',
      ),
    ).toBeVisible();
  });

  it('gives the mood trace a table for people who cannot see the drawing', async () => {
    await renderPublicPage('/');
    const table = screen.getByRole('table', { name: 'Customer mood through the fictional call' });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows.map((row) => row.textContent)).toEqual([
      'StartFrustrated',
      'Turn 4Frustrated',
      'Turn 6Angry',
      'Turn 8Frustrated',
      'EndConcerned',
    ]);
    // The drawing itself is hidden from assistive technology; its start and end are written out.
    const axis = screen.getByText('Escalating');
    expect(axis.closest('[aria-hidden="true"]')).not.toBeNull();
    const start = screen.getAllByText('Start').find((element) => !element.closest('table'));
    expect(start?.closest('p')).toHaveTextContent('StartFrustratedEndConcerned');
  });

  it('uses the indigo accent for one thing only: who wrote the coaching', async () => {
    const { container } = await renderPublicPage('/');
    expect(screen.getAllByText('Written by the coaching evaluator')).toHaveLength(1);
    // The design system draws that marker with its `ai` tone; nothing else on the page may.
    expect(container.querySelectorAll('.ff-badge--ai')).toHaveLength(1);
  });

  it('states responsible use in four sentences and links to the full page', async () => {
    await renderPublicPage('/');
    const region = screen.getByRole('region', { name: 'Responsible use' });
    expect(
      within(region)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual([
      'Fictional customers and scenarios only. Never enter real customer information.',
      'Firefly is a training aid. Scores are for coaching practice, not employee-performance assessment.',
      'AI-generated feedback can be incomplete or wrong. Treat it as a starting point for a conversation with a mentor.',
      'Firefly does not store your audio. Speech is turned into text and the audio is discarded.',
    ]);
    expect(
      within(region).getByRole('link', { name: 'How Firefly uses AI and speech' }),
    ).toHaveAttribute('href', '/responsible-ai');
  });

  it('ends with the call length the scenario library really has, and the way in', async () => {
    await renderPublicPage('/');
    const region = screen.getByRole('region', { name: 'Begin your first simulated call' });
    expect(
      within(region).getByText(
        `A call takes between ${CALL_MINUTES.min} and ${CALL_MINUTES.max} minutes, depending on the scenario.`,
      ),
    ).toBeVisible();
    expect(within(region).getByRole('link', { name: 'Start a simulation' })).toHaveAttribute(
      'href',
      '/scenarios',
    );
  });
});

describe('the landing page without a server', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders at once and asks the network for nothing', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    render(
      <MemoryRouter>
        <Landing />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { level: 1 })).toBeVisible();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
