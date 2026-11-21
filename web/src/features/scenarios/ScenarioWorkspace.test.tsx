import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PublicScenarioDTO } from '#shared/domain/api.ts';
import { ISSUE_TYPE_LABELS } from '#shared/domain/vocab.ts';
import { api } from '../../lib/api.ts';
import type * as ApiModule from '../../lib/api.ts';
import { groupByIssue } from './catalogue.ts';
import { SAMPLE, publicScenarios, scenarioById, sessionSummary } from './testing/fixtures.ts';
import {
  mockApi,
  networkError,
  renderApp,
  stubOnline,
  stubViewport,
  type RenderOptions,
} from './testing/harness.tsx';

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

const all = publicScenarios();
const groups = groupByIssue(all);
const firstTitle = groups[0]?.scenarios[0]?.title as string;
const secondTitle = groups[0]?.scenarios[1]?.title as string;
const secondId = groups[0]?.scenarios[1]?.id as string;

beforeEach(() => {
  mockApi();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.mocked(api.scenarios).mockReset();
});

const scenarioGroup = () => screen.findByRole('group', { name: 'Choose a scenario' });
const rowFor = async (title: string) =>
  within(await scenarioGroup()).getByRole('radio', { name: title });
const setupGroup = (name: RegExp) => screen.getByRole('group', { name });
const setup = {
  difficulty: () => setupGroup(/^Difficulty/),
  impact: () => setupGroup(/^Business impact/),
  mood: () => setupGroup(/^Customer starting temperature/),
  proficiency: () => setupGroup(/^Technical proficiency/),
  curveballs: () => setupGroup(/^Curveballs/),
};
const chooseOption = (group: HTMLElement, name: string) =>
  userEvent.click(within(group).getByRole('radio', { name }));
const briefLink = () => screen.getByRole('link', { name: /Continue to call brief/ });

describe('the scenario list on a wide screen', () => {
  beforeEach(() => stubViewport(true));

  it('lists every scenario under its issue type, in the vocabulary order', async () => {
    renderApp('/scenarios');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Choose a scenario' }),
    ).toBeVisible();
    const list = await scenarioGroup();

    const headings = within(list).getAllByRole('heading', { level: 2 });
    expect(headings).toHaveLength(groups.length);
    groups.forEach((group, index) => {
      expect(headings[index]).toHaveTextContent(group.label);
      expect(group.label).toBe(ISSUE_TYPE_LABELS[group.issueType]);
    });
    expect(within(list).getAllByRole('radio')).toHaveLength(all.length);
  });

  it('shows what a row needs: title, summary, difficulty, impact, mood, style, time and tags', async () => {
    renderApp('/scenarios');
    const row = await rowFor('Checkout is down and the clock is running');
    const description = (row.getAttribute('aria-describedby') ?? '')
      .split(' ')
      .map((id) => document.getElementById(id)?.textContent ?? '')
      .join(' ');
    for (const text of [
      'The head of digital at an online retailer',
      'Challenge',
      'High impact',
      'Starts angry',
      'Demanding',
      'About 12 min',
      'outage, executive pressure, checkout',
    ]) {
      expect(description).toContain(text);
    }
  });

  it('selects the first scenario when the address names none, and writes that in the address', async () => {
    const app = renderApp('/scenarios');
    expect(await await rowFor(firstTitle)).toBeChecked();
    await waitFor(() => expect(app.query().get('scenario')).toBe(groups[0]?.scenarios[0]?.id));
    expect(await screen.findByRole('heading', { level: 2, name: firstTitle })).toBeVisible();
    expect(app.router.state.historyAction).toBe('REPLACE');
  });

  it('moves the choice with the arrow keys and keeps the details in step', async () => {
    const user = userEvent.setup();
    const app = renderApp('/scenarios');
    const first = await rowFor(firstTitle);
    first.focus();
    await user.keyboard('{ArrowDown}');

    expect(await rowFor(secondTitle)).toBeChecked();
    expect(await screen.findByRole('heading', { level: 2, name: secondTitle })).toBeVisible();
    await waitFor(() => expect(app.query().get('scenario')).toBe(secondId));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('gives the list a focusable, named scroll area of its own', async () => {
    renderApp('/scenarios');
    const region = await screen.findByRole('region', { name: 'Scenario list' });
    expect(region).toHaveAttribute('tabindex', '0');
  });
});

describe('search and filters', () => {
  beforeEach(() => stubViewport(true));

  it('searches title, summary, tags, customer and issue type, and counts the matches', async () => {
    const user = userEvent.setup();
    const app = renderApp('/scenarios');
    await scenarioGroup();
    expect(screen.getByText('13 scenarios')).toBeInTheDocument();

    await user.type(screen.getByRole('searchbox', { name: 'Search scenarios' }), 'Lindqvist');
    const list = await scenarioGroup();
    expect(within(list).getAllByRole('radio')).toHaveLength(1);
    expect(
      within(list).getByRole('radio', {
        name: 'Closing out a case where the fix is not fully confirmed',
      }),
    ).toBeChecked();
    expect(screen.getByText('1 of 13 scenarios')).toBeInTheDocument();
    expect(app.query().get('q')).toBe('Lindqvist');
  });

  it('announces the count politely', async () => {
    renderApp('/scenarios');
    await scenarioGroup();
    const count = screen.getByText('13 scenarios');
    expect(count).toHaveAttribute('role', 'status');
    expect(count).toHaveAttribute('aria-live', 'polite');
  });

  it('filters by issue type, difficulty and business impact, each with a visible label', async () => {
    const user = userEvent.setup();
    const app = renderApp('/scenarios');
    await scenarioGroup();

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Issue type' }),
      'slow-performance',
    );
    expect(within(await scenarioGroup()).getAllByRole('radio')).toHaveLength(
      all.filter((s) => s.issueType === 'slow-performance').length,
    );
    expect(app.query().get('f_issue')).toBe('slow-performance');

    await user.selectOptions(screen.getByRole('combobox', { name: 'Difficulty' }), 'starter');
    expect(within(await scenarioGroup()).getAllByRole('radio')).toHaveLength(
      all.filter((s) => s.issueType === 'slow-performance' && s.difficulty === 'starter').length,
    );
    expect(app.query().get('f_difficulty')).toBe('starter');

    await user.selectOptions(screen.getByRole('combobox', { name: 'Difficulty' }), '');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Business impact' }), 'medium');
    const expected = all.filter((s) => s.issueType === 'slow-performance' && s.impact === 'medium');
    expect(within(await scenarioGroup()).getAllByRole('radio')).toHaveLength(expected.length);
    expect(app.query().get('f_impact')).toBe('medium');
    expect(app.query().get('difficulty')).toBeNull();
  });

  it('shows "Clear filters" only while something is filtered, and clears everything', async () => {
    const user = userEvent.setup();
    const app = renderApp('/scenarios');
    await scenarioGroup();
    expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument();

    await user.selectOptions(screen.getByRole('combobox', { name: 'Issue type' }), 'how-to');
    await user.type(screen.getByRole('searchbox', { name: 'Search scenarios' }), 'export');
    await user.click(await screen.findByRole('button', { name: 'Clear filters' }));

    expect(within(await scenarioGroup()).getAllByRole('radio')).toHaveLength(all.length);
    expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'Search scenarios' })).toHaveValue('');
    expect(screen.getByRole('searchbox', { name: 'Search scenarios' })).toHaveFocus();
    expect(app.query().get('q')).toBeNull();
    expect(app.query().get('f_issue')).toBeNull();
  });

  it('shows a filter at once too', async () => {
    const app = renderApp('/scenarios', { slowNavigation: 80 });
    await scenarioGroup();
    const issue = screen.getByRole('combobox', { name: 'Issue type' });
    fireEvent.change(issue, { target: { value: 'how-to' } });
    expect(issue).toHaveValue('how-to');

    await waitFor(() => expect(app.query().get('f_issue')).toBe('how-to'));
    expect(issue).toHaveValue('how-to');
  });

  it('says when nothing matches and offers a way out', async () => {
    const user = userEvent.setup();
    renderApp('/scenarios');
    await scenarioGroup();
    await user.type(screen.getByRole('searchbox', { name: 'Search scenarios' }), 'zzzz-nothing');

    expect(await screen.findByRole('heading', { name: 'No scenarios match' })).toBeVisible();
    expect(screen.getByText('0 of 13 scenarios')).toBeInTheDocument();
    expect(screen.getByText('No scenario selected')).toBeInTheDocument();
    const clear = screen.getAllByRole('button', { name: 'Clear filters' });
    await user.click(clear[clear.length - 1] as HTMLElement);
    expect(within(await scenarioGroup()).getAllByRole('radio')).toHaveLength(all.length);
  });

  it('selects another scenario when the chosen one is filtered out', async () => {
    const user = userEvent.setup();
    const app = renderApp('/scenarios');
    await scenarioGroup();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Difficulty' }), 'challenge');

    const challenge = all.filter((s) => s.difficulty === 'challenge');
    await waitFor(() => expect(challenge.map((s) => s.id)).toContain(app.query().get('scenario')));
    expect(within(await scenarioGroup()).getAllByRole('radio', { checked: true })).toHaveLength(1);
  });
});

describe('loading, failure and retry', () => {
  beforeEach(() => stubViewport(true));

  it('shows placeholders while the scenarios load', async () => {
    vi.mocked(api.scenarios).mockReturnValue(new Promise(() => undefined));
    renderApp('/scenarios');
    expect(await screen.findByText('Loading scenarios')).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Choose a scenario' })).not.toBeInTheDocument();
  });

  it('says what happened and retries', async () => {
    const user = userEvent.setup();
    vi.mocked(api.scenarios).mockRejectedValueOnce(networkError());
    renderApp('/scenarios');

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Scenarios could not be loaded');
    expect(alert).toHaveTextContent("Can't reach Firefly right now.");
    await user.click(within(alert).getByRole('button', { name: 'Try again' }));

    expect(await rowFor(firstTitle)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('says so when the browser is offline', async () => {
    stubOnline(false);
    vi.mocked(api.scenarios).mockRejectedValueOnce(networkError());
    renderApp('/scenarios');
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('You are offline');
  });
});

describe('the address', () => {
  beforeEach(() => stubViewport(true));

  it('restores the search, the filters, the scenario and every setting', async () => {
    renderApp(
      `/scenarios?q=billing&f_difficulty=starter&scenario=licence-seat-not-assigned&impact=high&temperature=angry&proficiency=expert&style=terse&stage=closure&curveballs=deadline&hints=on&difficulty=challenge`,
    );
    // The filters hide the scenario named in the address (it is Starter, so the filter keeps it).
    expect(await rowFor('A new hire has no premium seat')).toBeChecked();
    expect(screen.getByRole('searchbox', { name: 'Search scenarios' })).toHaveValue('billing');
    expect(screen.getByRole('combobox', { name: 'Difficulty' })).toHaveValue('starter');

    expect(within(setup.difficulty()).getByRole('radio', { name: 'Challenge' })).toBeChecked();
    expect(within(setup.impact()).getByRole('radio', { name: 'High' })).toBeChecked();
    expect(within(setup.mood()).getByRole('radio', { name: 'Angry / escalating' })).toBeChecked();
    expect(within(setup.proficiency()).getByRole('radio', { name: 'Expert' })).toBeChecked();
    expect(screen.getByRole('combobox', { name: /^Communication style/ })).toHaveValue('terse');
    expect(screen.getByRole('combobox', { name: /^Call stage/ })).toHaveValue('closure');
    expect(within(setup.curveballs()).getByRole('radio', { name: 'Choose' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Imposes a deadline/ })).toBeChecked();
    expect(screen.getByRole('switch', { name: /Live hints/ })).toBeChecked();
  });

  it('ignores values it cannot use and tidies the address', async () => {
    const app = renderApp('/scenarios?scenario=nope&difficulty=extreme&f_impact=huge&utm=1');
    expect(await rowFor(firstTitle)).toBeChecked();
    await waitFor(() =>
      expect(app.where()).toBe(`/scenarios?scenario=${groups[0]?.scenarios[0]?.id}`),
    );
  });

  it('only ever replaces the address, so Back leaves the workspace', async () => {
    const user = userEvent.setup();
    const app = renderApp('/scenarios');
    await scenarioGroup();
    await user.type(screen.getByRole('searchbox', { name: 'Search scenarios' }), 'a');
    await user.click(within(setup.difficulty()).getByRole('radio', { name: 'Challenge' }));
    expect(app.router.state.historyAction).toBe('REPLACE');
    expect(app.query().get('difficulty')).toBe('challenge');
  });

  it('does not carry one scenario\u2019s changes to another', async () => {
    const user = userEvent.setup();
    const app = renderApp(`/scenarios?scenario=${SAMPLE.standard}&difficulty=challenge&hints=on`);
    expect(await rowFor('Team cannot open the shared project workspace')).toBeChecked();
    await user.click(await rowFor('Locked out after a password reset'));

    await waitFor(() => expect(app.query().get('scenario')).toBe(SAMPLE.starter));
    expect(app.query().get('difficulty')).toBeNull();
    expect(app.query().get('hints')).toBeNull();
    expect(within(setup.difficulty()).getByRole('radio', { name: 'Starter' })).toBeChecked();
  });
});

describe('the call setup', () => {
  beforeEach(() => stubViewport(true));

  const open = async (id: string, options?: RenderOptions) => {
    const app = renderApp(`/scenarios?scenario=${id}`, options);
    await rowFor(scenarioById(id).title);
    await screen.findByRole('heading', { level: 2, name: scenarioById(id).title });
    return app;
  };

  it('starts at the scenario as written: nothing marked changed, no reset, a plain link', async () => {
    await open(SAMPLE.standard);
    expect(within(setup.difficulty()).getByRole('radio', { name: 'Standard' })).toBeChecked();
    expect(screen.queryByText('Changed from default')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Reset to scenario defaults' }),
    ).not.toBeInTheDocument();
    expect(briefLink()).toHaveAttribute('href', `/scenarios/${SAMPLE.standard}/brief`);
  });

  it('shows a choice at once, without waiting for the address to catch up', async () => {
    const app = await open(SAMPLE.standard, { slowNavigation: 80 });
    const challenge = within(setup.difficulty()).getByRole('radio', { name: 'Challenge' });
    fireEvent.click(challenge);
    // The router is slow to commit, and nothing has been awaited: the control already shows it.
    expect(challenge).toBeChecked();
    expect(within(setup.difficulty()).getByRole('radio', { name: 'Standard' })).not.toBeChecked();
    expect(app.query().get('difficulty')).toBeNull();

    await waitFor(() => expect(app.query().get('difficulty')).toBe('challenge'));
    expect(challenge).toBeChecked();
  });

  it('describes the current choice under each control', async () => {
    await open(SAMPLE.standard);
    expect(screen.getByText(/Moderate ambiguity, several hidden facts/)).toBeInTheDocument();
    expect(
      screen.getByText('Several users or one team blocked. The customer expects regular updates.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Short on patience and expecting progress.')).toBeInTheDocument();
    expect(screen.getByText('Direct. Asks for commitments and timelines.')).toBeInTheDocument();
    expect(
      screen.getByText('The customer is explaining the issue for the first time.'),
    ).toBeInTheDocument();
  });

  it('updates the preview, the summary bar and the link with every control', async () => {
    const user = userEvent.setup();
    await open(SAMPLE.standard);
    const chips = () => within(screen.getByRole('list', { name: 'Your choices' }));

    await chooseOption(setup.difficulty(), 'Challenge');
    expect(await screen.findByText('Expect up to two complications.')).toBeInTheDocument();
    expect(chips().getByText('Challenge')).toBeInTheDocument();

    await chooseOption(setup.impact(), 'High');
    expect(
      screen.getByText(/The business impact is high: production outage or broad impact\./),
    ).toBeInTheDocument();
    expect(chips().getByText('High impact')).toBeInTheDocument();

    await chooseOption(setup.mood(), 'Anxious');
    expect(screen.getByText(/^An anxious, demanding customer/)).toBeInTheDocument();
    expect(chips().getByText('Anxious')).toBeInTheDocument();

    await chooseOption(setup.proficiency(), 'Novice');
    expect(screen.getByText(/with novice technical proficiency/)).toBeInTheDocument();

    await user.selectOptions(
      screen.getByRole('combobox', { name: /^Communication style/ }),
      'vague',
    );
    expect(screen.getByText(/^An anxious, vague customer/)).toBeInTheDocument();
    expect(
      screen.getByText('Imprecise at first. Becomes specific when asked focused questions.'),
    ).toBeInTheDocument();

    await user.selectOptions(screen.getByRole('combobox', { name: /^Call stage/ }), 'escalated');
    expect(screen.getByText(/is calling about an escalated case\./)).toBeInTheDocument();
    expect(
      screen.getByText('Earlier contacts have not resolved it. Trust is already strained.'),
    ).toBeInTheDocument();

    expect(briefLink()).toHaveAttribute(
      'href',
      `/scenarios/${SAMPLE.standard}/brief?difficulty=challenge&impact=high&temperature=anxious&proficiency=novice&style=vague&stage=escalated`,
    );
  });

  it('shows what you are told for the chosen call stage', async () => {
    const user = userEvent.setup();
    const scenario = scenarioById(SAMPLE.starter);
    await open(SAMPLE.starter);
    const note = scenario.stageBriefs['follow-up'];
    expect(screen.queryByText(note)).not.toBeInTheDocument();
    await user.selectOptions(screen.getByRole('combobox', { name: /^Call stage/ }), 'follow-up');
    expect(await screen.findByText(note)).toBeInTheDocument();
  });

  it('marks a changed control in words, and offers Reset only then', async () => {
    await open(SAMPLE.standard);
    await chooseOption(setup.impact(), 'Low');
    expect(within(setup.impact()).getByText('Changed from default')).toBeInTheDocument();
    expect(within(setup.difficulty()).queryByText('Changed from default')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reset to scenario defaults' })).toBeInTheDocument();
  });

  it('resets every setting, says so, and puts focus on the setup heading', async () => {
    const user = userEvent.setup();
    const app = await open(SAMPLE.standard);
    await chooseOption(setup.difficulty(), 'Challenge');
    await chooseOption(setup.mood(), 'Calm');
    await user.click(screen.getByRole('button', { name: 'Reset to scenario defaults' }));

    expect(within(setup.difficulty()).getByRole('radio', { name: 'Standard' })).toBeChecked();
    expect(within(setup.mood()).getByRole('radio', { name: 'Frustrated' })).toBeChecked();
    expect(screen.queryByText('Changed from default')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Reset to scenario defaults' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Call setup' })).toHaveFocus();
    expect(await screen.findByText('Settings reset to the scenario defaults.')).toBeInTheDocument();
    await waitFor(() => expect(app.where()).toBe(`/scenarios?scenario=${SAMPLE.standard}`));
  });

  it('turns live hints on for Starter and off otherwise, until they are set', async () => {
    const user = userEvent.setup();
    await open(SAMPLE.standard);
    const hints = () => screen.getByRole('switch', { name: /Live hints during the call/ });
    expect(hints()).not.toBeChecked();

    await chooseOption(setup.difficulty(), 'Starter');
    expect(hints()).toBeChecked();
    expect(screen.queryByText('Changed from default', { selector: 'span span' })).not.toBeNull();

    await chooseOption(setup.difficulty(), 'Challenge');
    expect(hints()).not.toBeChecked();
    await user.click(hints());
    expect(hints()).toBeChecked();
    expect(briefLink().getAttribute('href')).toContain('hints=on');
    await chooseOption(setup.difficulty(), 'Starter');
    expect(hints()).toBeChecked();
  });

  describe('curveballs', () => {
    it('offers Off, the difficulty default and Choose', async () => {
      await open(SAMPLE.standard);
      const group = setup.curveballs();
      expect(
        within(group)
          .getAllByRole('radio')
          .map((r) => r.closest('div')?.textContent),
      ).toEqual(['Off', 'Default for this difficulty', 'Choose']);
      expect(
        within(group).getByRole('radio', { name: 'Default for this difficulty' }),
      ).toBeChecked();
      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    });

    it('switches off, and puts "none" in the address', async () => {
      const app = await open(SAMPLE.standard);
      await chooseOption(setup.curveballs(), 'Off');
      expect(screen.getByText('No complications are set.')).toBeInTheDocument();
      await waitFor(() => expect(app.query().get('curveballs')).toBe('none'));
    });

    it('lists what the scenario offers, with descriptions, when choosing', async () => {
      await open(SAMPLE.standard);
      await chooseOption(setup.curveballs(), 'Choose');
      const boxes = screen.getAllByRole('checkbox');
      expect(boxes).toHaveLength(scenarioById(SAMPLE.standard).curveballOptions.length);
      expect(
        screen.getByRole('checkbox', { name: 'Asks for a manager' }),
      ).toHaveAccessibleDescription('The customer asks to speak to someone more senior.');
      expect(screen.getByText(/0 of 1 chosen/)).toBeInTheDocument();
    });

    it('stops at the limit for the difficulty and says why', async () => {
      const user = userEvent.setup();
      const app = await open(SAMPLE.standard);
      await chooseOption(setup.curveballs(), 'Choose');
      await user.click(screen.getByRole('checkbox', { name: 'Asks for a manager' }));

      expect(
        await screen.findByText(
          /You have reached the limit for Standard: untick one to choose another\./,
        ),
      ).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: 'Imposes a deadline' })).toBeDisabled();
      expect(screen.getByRole('checkbox', { name: 'Asks for a manager' })).toBeEnabled();
      expect(app.query().get('curveballs')).toBe('ask-manager');

      await user.click(screen.getByRole('checkbox', { name: 'Asks for a manager' }));
      expect(screen.getByRole('checkbox', { name: 'Imposes a deadline' })).toBeEnabled();
      expect(screen.getByRole('checkbox', { name: 'Asks for a manager' })).not.toBeChecked();
    });

    it('allows two on Challenge, and trims the choice when the difficulty is lowered', async () => {
      const user = userEvent.setup();
      await open(SAMPLE.challenge);
      await chooseOption(setup.curveballs(), 'Choose');
      await user.click(screen.getByRole('checkbox', { name: 'Asks for a manager' }));
      await user.click(screen.getByRole('checkbox', { name: 'Imposes a deadline' }));
      expect(screen.getByRole('checkbox', { name: 'Goes quiet' })).toBeDisabled();

      await chooseOption(setup.difficulty(), 'Standard');
      // The note is on the page and, as a whole sentence, in the polite live region too.
      expect(
        (
          await screen.findAllByText(
            /Standard allows one complication\. Removed: \u201CImposes a deadline\u201D\. Kept: \u201CAsks for a manager\u201D\./,
          )
        ).length,
      ).toBeGreaterThanOrEqual(1);
      expect(screen.getByRole('checkbox', { name: 'Asks for a manager' })).toBeChecked();
      expect(screen.getByRole('checkbox', { name: 'Imposes a deadline' })).not.toBeChecked();
    });

    it('never says how an unexpected turn is triggered', async () => {
      await open(SAMPLE.challenge);
      await chooseOption(setup.curveballs(), 'Choose');
      const text = document.body.textContent ?? '';
      expect(text).not.toMatch(/trigger|after turn|when the customer|temperature reaches/i);
    });
  });
});

describe('on a narrow screen', () => {
  beforeEach(() => stubViewport(false));

  it('shows the list, with the filters in a region that opens', async () => {
    const user = userEvent.setup();
    renderApp('/scenarios');
    await scenarioGroup();
    expect(screen.queryByRole('heading', { level: 2, name: firstTitle })).not.toBeInTheDocument();

    const toggle = screen.getByRole('button', { name: 'Filters' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('combobox', { name: 'Issue type' })).not.toBeInTheDocument();
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Issue type' }), 'how-to');
    expect(screen.getByRole('button', { name: 'Filters (1)' })).toBeInTheDocument();
    expect(within(await scenarioGroup()).getAllByRole('radio')).toHaveLength(
      all.filter((s) => s.issueType === 'how-to').length,
    );
  });

  it('opens the details in a sheet when a row is chosen, and closes it with the choice kept', async () => {
    const user = userEvent.setup();
    const app = renderApp('/scenarios');
    const row = await rowFor(secondTitle);
    await user.click(row);

    const sheet = await screen.findByRole('dialog', { name: secondTitle });
    expect(within(sheet).getByRole('link', { name: /Continue to call brief/ })).toBeInTheDocument();
    expect(
      within(sheet).getByRole('heading', { level: 3, name: 'What you are told' }),
    ).toBeInTheDocument();
    expect(within(sheet).getByRole('group', { name: /^Difficulty/ })).toBeInTheDocument();
    await waitFor(() => expect(app.query().get('scenario')).toBe(secondId));

    await user.click(within(sheet).getByRole('button', { name: 'Back to scenarios' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(await rowFor(secondTitle)).toBeChecked();
    expect(await rowFor(secondTitle)).toHaveFocus();
    expect(app.query().get('scenario')).toBe(secondId);
  });

  it('closes the sheet on Escape too', async () => {
    const user = userEvent.setup();
    renderApp('/scenarios');
    await user.click(await rowFor(firstTitle));
    const sheet = await screen.findByRole('dialog', { name: firstTitle });
    fireEvent(sheet, new Event('cancel', { cancelable: true }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('opens the sheet again when the chosen row is pressed again', async () => {
    const user = userEvent.setup();
    renderApp('/scenarios');
    await user.click(await rowFor(firstTitle));
    await user.click(await screen.findByRole('button', { name: 'Back to scenarios' }));
    await user.click(await rowFor(firstTitle));
    expect(await screen.findByRole('dialog', { name: firstTitle })).toBeInTheDocument();
  });

  it('does not open the sheet for the arrow keys, and offers a button instead', async () => {
    const user = userEvent.setup();
    renderApp('/scenarios');
    const first = await rowFor(firstTitle);
    first.focus();
    await user.keyboard('{ArrowDown}');
    expect(await rowFor(secondTitle)).toBeChecked();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(await screen.findByRole('button', { name: 'Review and set up' }));
    expect(await screen.findByRole('dialog', { name: secondTitle })).toBeInTheDocument();
  });

  it('starts with the sheet open when the address names a scenario', async () => {
    renderApp(`/scenarios?scenario=${SAMPLE.challenge}&difficulty=starter`);
    const sheet = await screen.findByRole('dialog', { name: scenarioById(SAMPLE.challenge).title });
    expect(within(sheet).getByRole('radio', { name: 'Starter' })).toBeChecked();
  });

  it('keeps targets at least 44 px tall: the primary action is a real, full-width link', async () => {
    const user = userEvent.setup();
    renderApp('/scenarios');
    await user.click(await rowFor(firstTitle));
    const link = await screen.findByRole('link', { name: /Continue to call brief/ });
    expect(link.className).toContain('ff-button--medium');
  });
});

describe('calls in progress and recent calls', () => {
  beforeEach(() => stubViewport(true));

  const active = sessionSummary({
    id: 'session-active',
    status: 'active',
    endedAt: null,
    durationSeconds: null,
    overallScore: null,
    completion: null,
  });

  it('reminds you of a call in progress, with the way back into it', async () => {
    mockApi({ active });
    renderApp('/scenarios');
    const banner = await screen.findByText(
      /You have a call in progress: Locked out after a password reset\./,
    );
    expect(banner).toBeVisible();
    expect(screen.getByRole('link', { name: 'Resume' })).toHaveAttribute(
      'href',
      '/calls/session-active',
    );
  });

  it('says nothing when no call is in progress', async () => {
    renderApp('/scenarios');
    await scenarioGroup();
    expect(screen.queryByText(/call in progress/)).not.toBeInTheDocument();
  });

  it('says nothing when it cannot be found out whether one is', async () => {
    vi.mocked(api.listSessions).mockRejectedValue(networkError());
    renderApp('/scenarios');
    await scenarioGroup();
    expect(screen.queryByText(/call in progress/)).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('lists the latest calls with what to do next for each', async () => {
    const user = userEvent.setup();
    mockApi({
      sessions: [
        active,
        sessionSummary({
          id: 'session-done',
          scenarioId: SAMPLE.standard,
          scenarioTitle: 'Team cannot open the shared project workspace',
          status: 'completed',
          overallScore: 3.4,
          durationSeconds: 540,
        }),
        sessionSummary({
          id: 'session-eval',
          status: 'completing',
          overallScore: null,
          completion: null,
        }),
        sessionSummary({
          id: 'session-failed',
          status: 'evaluation_failed',
          overallScore: null,
          completion: null,
        }),
      ],
    });
    renderApp('/scenarios');
    await scenarioGroup();
    await user.click(screen.getByRole('button', { name: 'Recent calls' }));

    const dialog = await screen.findByRole('dialog', { name: 'Recent calls' });
    const rows = await within(dialog).findAllByRole('listitem');
    expect(rows).toHaveLength(4);

    const done = rows[1] as HTMLElement;
    expect(
      within(done).getByText('Team cannot open the shared project workspace'),
    ).toBeInTheDocument();
    expect(done).toHaveTextContent('Daniel Osei');
    expect(done).toHaveTextContent('9 min');
    expect(done).toHaveTextContent('Overall 3.4 of 5');
    expect(within(done).getByText('Completed')).toBeInTheDocument();
    expect(within(done).getByRole('link', { name: /View report/ })).toHaveAttribute(
      'href',
      '/sessions/session-done/report',
    );

    expect(within(rows[0] as HTMLElement).getByText('In progress')).toBeInTheDocument();
    expect(within(rows[0] as HTMLElement).getByRole('link', { name: /Resume/ })).toHaveAttribute(
      'href',
      '/calls/session-active',
    );
    expect(within(rows[2] as HTMLElement).getByText('Evaluating')).toBeInTheDocument();
    expect(within(rows[2] as HTMLElement).getByRole('link', { name: /Open/ })).toHaveAttribute(
      'href',
      '/sessions/session-eval/report',
    );
    expect(within(rows[3] as HTMLElement).getByRole('link', { name: /Open/ })).toHaveAttribute(
      'href',
      '/sessions/session-failed/report',
    );
    expect(within(dialog).queryByText(/total|average|trend/i)).not.toBeInTheDocument();
  });

  it('lists no more than ten calls', async () => {
    const user = userEvent.setup();
    mockApi({
      sessions: Array.from({ length: 14 }, (_, index) =>
        sessionSummary({ id: `session-${String(index).padStart(4, '0')}` }),
      ),
    });
    renderApp('/scenarios');
    await scenarioGroup();
    await user.click(screen.getByRole('button', { name: 'Recent calls' }));
    const dialog = await screen.findByRole('dialog', { name: 'Recent calls' });
    expect(await within(dialog).findAllByRole('listitem')).toHaveLength(10);
    expect(vi.mocked(api.listSessions)).toHaveBeenCalledWith({ limit: 10 }, expect.anything());
  });

  it('says there are no calls yet, and closes back to where it was opened', async () => {
    const user = userEvent.setup();
    renderApp('/scenarios');
    await scenarioGroup();
    const opener = screen.getByRole('button', { name: 'Recent calls' });
    await user.click(opener);
    const dialog = await screen.findByRole('dialog', { name: 'Recent calls' });
    expect(await within(dialog).findByText('No calls yet.')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it('explains a failure to load the calls and tries again', async () => {
    const user = userEvent.setup();
    renderApp('/scenarios');
    await scenarioGroup();
    vi.mocked(api.listSessions).mockRejectedValueOnce(networkError());
    await user.click(screen.getByRole('button', { name: 'Recent calls' }));
    const dialog = await screen.findByRole('dialog', { name: 'Recent calls' });
    expect(
      await within(dialog).findByText('Recent calls could not be loaded.'),
    ).toBeInTheDocument();
    expect(dialog).toHaveTextContent('Nothing was changed');

    vi.mocked(api.listSessions).mockResolvedValue({ sessions: [sessionSummary()], total: 1 });
    await user.click(within(dialog).getByRole('button', { name: 'Try again' }));
    expect(
      await within(dialog).findByText('Locked out after a password reset'),
    ).toBeInTheDocument();
  });
});

describe('a server that does not send every field yet', () => {
  beforeEach(() => stubViewport(true));

  // An older server has no stage notes and no list of curveballs to choose from.
  const stale = publicScenarios().map(
    ({ stageBriefs: _stageBriefs, curveballOptions: _curveballOptions, ...rest }) => rest,
  ) as unknown as PublicScenarioDTO[];

  it('still shows the situation, and the way to start, without the stage notes', async () => {
    vi.mocked(api.scenarios).mockResolvedValue(stale);
    const scenario = scenarioById(SAMPLE.standard);
    renderApp(`/scenarios?scenario=${SAMPLE.standard}&stage=escalated`);

    expect(await screen.findByRole('heading', { level: 2, name: scenario.title })).toBeVisible();
    expect(screen.getByRole('heading', { level: 3, name: 'What you are told' })).toBeVisible();
    expect(screen.getAllByText(scenario.brief.situation).length).toBeGreaterThan(0);
    expect(screen.getByRole('combobox', { name: /^Call stage/ })).toHaveValue('escalated');
    expect(briefLink()).toHaveAttribute('href', expect.stringContaining('stage=escalated'));
  });

  it('offers no curveballs to choose from, but still Off and the default', async () => {
    vi.mocked(api.scenarios).mockResolvedValue(stale);
    renderApp(`/scenarios?scenario=${SAMPLE.standard}`);
    await screen.findByRole('heading', { level: 2, name: scenarioById(SAMPLE.standard).title });

    const group = setup.curveballs();
    expect(within(group).getByRole('radio', { name: 'Off' })).toBeVisible();
    expect(within(group).getByRole('radio', { name: 'Default for this difficulty' })).toBeChecked();
    expect(within(group).queryByRole('radio', { name: 'Choose' })).not.toBeInTheDocument();
  });
});
