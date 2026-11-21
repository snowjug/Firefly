import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PublicScenarioDTO } from '#shared/domain/api.ts';
import { wordCount } from '#shared/domain/scenario.ts';
import {
  CURVEBALL_LABELS,
  IMPACT_LABELS,
  PRODUCT_FAMILY_LABELS,
  STYLE_LABELS,
} from '#shared/domain/vocab.ts';
import { api } from '../../lib/api.ts';
import type * as ApiModule from '../../lib/api.ts';
import { detectFeatures, type VoiceFeatures } from '../voice/support.ts';
import type * as SupportModule from '../voice/support.ts';
import { sortScenarios } from './catalogue.ts';
import {
  AZURE_SPEECH,
  SAMPLE,
  appConfig,
  publicScenarios,
  scenarioById,
} from './testing/fixtures.ts';
import {
  mockApi,
  networkError,
  renderApp,
  stubOnline,
  stubViewport,
  type RenderOptions,
} from './testing/harness.tsx';
import { defaultVoiceFor, voiceLabel } from './voice-choice.ts';

vi.mock('../../lib/api.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof ApiModule>();
  return {
    ...actual,
    api: { config: vi.fn(), scenarios: vi.fn(), scenario: vi.fn(), createSession: vi.fn() },
  };
});
vi.mock('../voice/support.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof SupportModule>();
  return { ...actual, detectFeatures: vi.fn() };
});

const FULL_BROWSER: VoiceFeatures = {
  secureContext: true,
  microphone: true,
  audioContext: true,
  worklet: true,
  recognition: true,
  synthesis: true,
  audioElement: true,
};

const all = publicScenarios();
const sorted = sortScenarios(all);
const first = sorted[0] as PublicScenarioDTO;
const second = sorted[1] as PublicScenarioDTO;

beforeEach(() => {
  mockApi();
  vi.mocked(detectFeatures).mockReturnValue(FULL_BROWSER);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.mocked(api.scenarios).mockReset();
});

const list = () => screen.findByRole('group', { name: 'Scenarios' });
const row = async (title: string) => within(await list()).getByRole('radio', { name: title });
const rows = async () => within(await list()).getAllByRole('radio');
const control = (name: string | RegExp) => screen.getByRole('group', { name });
const choose = (group: HTMLElement, name: string | RegExp) =>
  userEvent.click(within(group).getByRole('radio', { name }));
const review = () => screen.getByRole('link', { name: 'Review brief' });
const openCustomise = async () => {
  const button = await screen.findByRole('button', { name: /^Customise/ });
  if (button.getAttribute('aria-expanded') !== 'true') await userEvent.click(button);
};
const count = (text: string) => expect(screen.getByText(text)).toBeInTheDocument();

/** What a row says besides its title: the text its description points at. */
function described(radio: HTMLElement): string[] {
  return (radio.getAttribute('aria-describedby') ?? '')
    .split(' ')
    .map((id) => document.getElementById(id)?.textContent ?? '');
}

describe('the scenario list on a wide screen', () => {
  beforeEach(() => stubViewport(true));

  it('lists every scenario as a row, by product, with its product, title, short line and difficulty', async () => {
    renderApp('/scenarios');
    expect(await screen.findByRole('heading', { level: 1, name: 'Scenarios' })).toBeVisible();
    const radios = await rows();
    expect(radios).toHaveLength(all.length);
    expect(radios.map((radio) => radio.getAttribute('value'))).toEqual(sorted.map((s) => s.id));

    const teams = scenarioById(SAMPLE.standard);
    const [meta, summary] = described(await row(teams.title));
    expect(meta).toContain('Microsoft Teams \u00b7 Meetings');
    expect(meta).toContain('Standard');
    expect(summary).toBe(teams.listSummary);
    // Rows, not cards: no heading and no button inside a row.
    expect(within(await list()).queryAllByRole('heading')).toEqual([]);
    expect(within(await list()).queryAllByRole('button')).toEqual([]);
  });

  it('keeps every list description to 18 words, the summary to 60 and each filter label to 3', async () => {
    renderApp('/scenarios');
    for (const radio of await rows()) {
      expect(wordCount(described(radio)[1] ?? '')).toBeLessThanOrEqual(18);
    }
    const selected = screen.getByRole('region', { name: first.title });
    expect(
      wordCount(within(selected).getByText(first.summary).textContent ?? ''),
    ).toBeLessThanOrEqual(60);
    for (const name of ['Product', 'Issue type', 'Difficulty']) {
      expect(wordCount(name)).toBeLessThanOrEqual(3);
    }
    expect(screen.getByRole('combobox', { name: 'Product' })).toBeVisible();
    expect(screen.getByRole('combobox', { name: 'Issue type' })).toBeVisible();
    expect(control('Difficulty')).toBeVisible();
  });

  it('selects the first scenario when the address names none, and writes that in the address', async () => {
    const app = renderApp('/scenarios');
    expect(await row(first.title)).toBeChecked();
    await waitFor(() => expect(app.query().get('scenario')).toBe(first.id));
    expect(await screen.findByRole('heading', { level: 2, name: first.title })).toBeVisible();
    expect(app.router.state.historyAction).toBe('REPLACE');
  });

  it('moves the choice with the arrow keys and keeps the details in step', async () => {
    const user = userEvent.setup();
    const app = renderApp('/scenarios');
    (await row(first.title)).focus();
    await user.keyboard('{ArrowDown}');

    expect(await row(second.title)).toBeChecked();
    expect(await screen.findByRole('heading', { level: 2, name: second.title })).toBeVisible();
    await waitFor(() => expect(app.query().get('scenario')).toBe(second.id));
    expect(await row(second.title)).toHaveFocus();
  });

  it('puts the moving indicator by the chosen row and hides it when none is chosen', async () => {
    const user = userEvent.setup();
    renderApp('/scenarios');
    const group = await list();
    const strip = group.closest('.scn-list') as HTMLElement;
    await waitFor(() => expect(strip.style.getPropertyValue('--scn-ind-o')).toBe('1'));
    expect(strip.querySelector('.scn-ind')).toHaveAttribute('aria-hidden', 'true');
    expect(strip.querySelector('[data-selected]')?.querySelector('input')).toBeChecked();

    await user.selectOptions(screen.getByRole('combobox', { name: 'Product' }), 'teams');
    await waitFor(() => expect(strip.querySelectorAll('[data-selected]')).toHaveLength(1));
  });

  it('fades the details in when another scenario is chosen', async () => {
    const user = userEvent.setup();
    renderApp('/scenarios');
    const before = (await screen.findByRole('heading', { level: 2, name: first.title })).closest(
      '.scn-fade',
    );
    expect(before).not.toBeNull();
    (await row(first.title)).focus();
    await user.keyboard('{ArrowDown}');
    const heading = await screen.findByRole('heading', { level: 2, name: second.title });
    expect(heading.closest('.scn-fade')).not.toBe(before);
  });

  it('gives every control a name, so nothing is read as "edit text" or "button"', async () => {
    renderApp('/scenarios');
    await list();
    for (const box of screen.getAllByRole('combobox')) expect(box).toHaveAccessibleName();
    for (const radio of screen.getAllByRole('radio')) expect(radio).toHaveAccessibleName();
    for (const button of screen.getAllByRole('button')) expect(button).toHaveAccessibleName();
  });
});

describe('the filters and their counts', () => {
  beforeEach(() => stubViewport(true));

  it('group the products by family, each with how many scenarios it has', async () => {
    renderApp('/scenarios');
    await list();
    const product = screen.getByRole('combobox', { name: 'Product' });
    const groups = within(product).getAllByRole('group');
    expect(groups.map((group) => group.getAttribute('label'))).toEqual([
      PRODUCT_FAMILY_LABELS['microsoft-365'],
      PRODUCT_FAMILY_LABELS.windows,
      PRODUCT_FAMILY_LABELS.azure,
      PRODUCT_FAMILY_LABELS['dynamics-365'],
    ]);
    expect(within(product).getByRole('option', { name: 'All products' })).toBeInTheDocument();
    expect(
      within(product).getByRole('option', { name: 'Microsoft Teams (2)' }),
    ).toBeInTheDocument();
    expect(within(product).getByRole('option', { name: 'Azure (2)' })).toBeInTheDocument();
  });

  it('narrow the list, say so in the count, and write the choice in the address', async () => {
    const user = userEvent.setup();
    const app = renderApp('/scenarios');
    await list();
    count('16 scenarios');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Product' }), 'teams');
    expect(await rows()).toHaveLength(2);
    count('2 of 16 scenarios');
    expect(app.query().get('f_product')).toBe('teams');
    expect(app.router.state.historyAction).toBe('REPLACE');
  });

  it('update every other count when one filter changes, and put an empty choice out of reach', async () => {
    const user = userEvent.setup();
    renderApp('/scenarios');
    await list();
    const difficulty = control('Difficulty');
    expect(within(difficulty).getByRole('radio', { name: 'All, 16 scenarios' })).toBeChecked();
    expect(within(difficulty).getByRole('radio', { name: 'Starter, 5 scenarios' })).toBeVisible();

    await user.selectOptions(screen.getByRole('combobox', { name: 'Product' }), 'teams');
    expect(within(difficulty).getByRole('radio', { name: 'All, 2 scenarios' })).toBeChecked();
    expect(within(difficulty).getByRole('radio', { name: 'Starter, 0 scenarios' })).toBeDisabled();
    expect(within(difficulty).getByRole('radio', { name: 'Challenge, 1 scenario' })).toBeEnabled();
    const issue = screen.getByRole('combobox', { name: 'Issue type' });
    expect(within(issue).getByRole('option', { name: /^How-to question \(0\)/ })).toBeDisabled();
    expect(within(issue).getByRole('option', { name: /^Data missing \(1\)/ })).toBeEnabled();
  });

  it('filter by difficulty with the segmented control', async () => {
    const app = renderApp('/scenarios');
    await list();
    await choose(control('Difficulty'), 'Challenge, 4 scenarios');
    expect(await rows()).toHaveLength(4);
    expect(app.query().get('f_difficulty')).toBe('challenge');
    expect(app.query().get('difficulty')).toBeNull();
    await choose(control('Difficulty'), /^All/);
    expect(await rows()).toHaveLength(all.length);
  });

  it('show "Clear filters" only while something is filtered, and clear everything and move focus', async () => {
    const user = userEvent.setup();
    const app = renderApp('/scenarios');
    await list();
    expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Product' }), 'azure');
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Issue type' }),
      'billing-licence',
    );
    await user.click(await screen.findByRole('button', { name: 'Clear filters' }));

    expect(await rows()).toHaveLength(all.length);
    expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Product' })).toHaveValue('');
    expect(screen.getByRole('combobox', { name: 'Product' })).toHaveFocus();
    expect(app.query().get('f_product')).toBeNull();
    expect(app.query().get('f_issue')).toBeNull();
  });

  it('show a choice at once, without waiting for the address to catch up', async () => {
    const app = renderApp('/scenarios', { slowNavigation: 80 });
    await list();
    const product = screen.getByRole('combobox', { name: 'Product' });
    fireEvent.change(product, { target: { value: 'azure' } });
    expect(product).toHaveValue('azure');
    await waitFor(() => expect(app.query().get('f_product')).toBe('azure'));
    expect(product).toHaveValue('azure');
  });

  it('say when nothing matches and offer a way out, and leave the details empty', async () => {
    const user = userEvent.setup();
    renderApp('/scenarios?f_product=teams&f_difficulty=starter');
    expect(await screen.findByRole('heading', { name: 'No scenarios match' })).toBeVisible();
    count('0 of 16 scenarios');
    expect(screen.getByText('No scenario selected')).toBeInTheDocument();
    const clear = screen.getAllByRole('button', { name: 'Clear filters' });
    await user.click(clear[clear.length - 1] as HTMLElement);
    expect(await rows()).toHaveLength(all.length);
  });

  it('select another scenario when the chosen one is filtered out, and tidy the address', async () => {
    const app = renderApp('/scenarios');
    await list();
    await choose(control('Difficulty'), 'Challenge, 4 scenarios');
    const challenge = all.filter((s) => s.difficulty === 'challenge').map((s) => s.id);
    await waitFor(() => expect(challenge).toContain(app.query().get('scenario')));
    expect(await within(await list()).findAllByRole('radio', { checked: true })).toHaveLength(1);
  });

  it('announce the count politely', async () => {
    renderApp('/scenarios');
    await list();
    const status = screen.getByText('16 scenarios').closest('[role="status"]');
    expect(status).toHaveAttribute('aria-live', 'polite');
  });
});

describe('loading, failure and retry', () => {
  beforeEach(() => stubViewport(true));

  it('shows placeholders while the scenarios load', async () => {
    vi.mocked(api.scenarios).mockReturnValue(new Promise(() => undefined));
    renderApp('/scenarios');
    expect(await screen.findByText('Loading scenarios')).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Scenarios' })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Product' })).not.toBeInTheDocument();
  });

  it('says what happened, and tries again', async () => {
    const user = userEvent.setup();
    vi.mocked(api.scenarios).mockRejectedValueOnce(networkError());
    renderApp('/scenarios');
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Scenarios could not be loaded');
    expect(alert).toHaveTextContent("Can't reach Firefly right now.");
    await user.click(within(alert).getByRole('button', { name: 'Try again' }));
    expect(await row(first.title)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('says so when the browser is offline', async () => {
    stubOnline(false);
    vi.mocked(api.scenarios).mockRejectedValueOnce(networkError());
    renderApp('/scenarios');
    expect(await screen.findByRole('alert')).toHaveTextContent('You are offline');
  });

  it('says when there are no scenarios at all, and can look again', async () => {
    const user = userEvent.setup();
    vi.mocked(api.scenarios).mockResolvedValueOnce([]);
    renderApp('/scenarios');
    expect(await screen.findByRole('heading', { name: 'No scenarios available' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await row(first.title)).toBeInTheDocument();
  });
});

describe('the address', () => {
  beforeEach(() => stubViewport(true));

  it('restores the filters, the scenario and every setting', async () => {
    renderApp(
      `/scenarios?f_product=teams&scenario=${SAMPLE.challenge}&impact=low&temperature=anxious&proficiency=novice&style=vague&stage=closure&curveballs=deadline&hints=on&difficulty=starter&voice=voice-d`,
    );
    expect(await row(scenarioById(SAMPLE.challenge).title)).toBeChecked();
    expect(screen.getByRole('combobox', { name: 'Product' })).toHaveValue('teams');
    expect(within(control('Preset')).getByRole('radio', { name: 'Starter' })).toBeChecked();

    await openCustomise();
    expect(within(control(/^Impact/)).getByRole('radio', { name: 'Low' })).toBeChecked();
    expect(
      within(control(/^Starting state/)).getByRole('radio', { name: 'Anxious' }),
    ).toBeChecked();
    expect(within(control(/^Proficiency/)).getByRole('radio', { name: 'Novice' })).toBeChecked();
    expect(screen.getByRole('combobox', { name: 'Style' })).toHaveValue('vague');
    expect(screen.getByRole('combobox', { name: 'Call stage' })).toHaveValue('closure');
    expect(screen.getByRole('combobox', { name: 'Customer voice' })).toHaveValue('voice-d');
    expect(within(control(/^Complications/)).getByRole('radio', { name: 'Choose' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: CURVEBALL_LABELS.deadline.label })).toBeChecked();
    expect(screen.getByRole('switch', { name: /Live hints/ })).toBeChecked();
  });

  it('ignores values it cannot use and tidies the address', async () => {
    const app = renderApp('/scenarios?scenario=nope&difficulty=extreme&f_product=notes&utm=1');
    expect(await row(first.title)).toBeChecked();
    await waitFor(() => expect(app.where()).toBe(`/scenarios?scenario=${first.id}`));
  });

  it('says so once when the address names a scenario that has gone', async () => {
    const user = userEvent.setup();
    renderApp('/scenarios?scenario=locked-out-after-password-reset');
    const notice = await screen.findByText(/That scenario is no longer in the library/);
    expect(await row(first.title)).toBeChecked();
    await user.click(
      within(notice.closest('[role="status"]') as HTMLElement).getByRole('button', {
        name: 'Dismiss',
      }),
    );
    expect(screen.queryByText(/no longer in the library/)).not.toBeInTheDocument();
  });

  it('only ever replaces the address, so Back leaves the workspace', async () => {
    const user = userEvent.setup();
    const app = renderApp('/scenarios');
    await list();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Product' }), 'teams');
    await choose(control('Preset'), 'Challenge');
    expect(app.router.state.historyAction).toBe('REPLACE');
    expect(app.query().get('difficulty')).toBe('challenge');
  });

  it('does not carry one scenario\u2019s changes to another', async () => {
    const user = userEvent.setup();
    const app = renderApp(`/scenarios?scenario=${SAMPLE.standard}&difficulty=challenge&hints=on`);
    expect(await row(scenarioById(SAMPLE.standard).title)).toBeChecked();
    await user.click(await row(scenarioById(SAMPLE.starter).title));
    await waitFor(() => expect(app.query().get('scenario')).toBe(SAMPLE.starter));
    expect(app.query().get('difficulty')).toBeNull();
    expect(app.query().get('hints')).toBeNull();
    expect(within(control('Preset')).getByRole('radio', { name: 'Starter' })).toBeChecked();
  });
});

describe('the chosen scenario', () => {
  beforeEach(() => stubViewport(true));
  const open = async (id: string, options?: RenderOptions) => {
    const app = renderApp(`/scenarios?scenario=${id}`, options);
    await screen.findByRole('heading', { level: 2, name: scenarioById(id).title });
    return app;
  };

  it('shows the product, impact, call stage, style, duration and a short description', async () => {
    await open(SAMPLE.challenge);
    const scenario = scenarioById(SAMPLE.challenge);
    const pane = screen.getByRole('region', { name: scenario.title });
    expect(within(pane).getByText('Microsoft Teams \u00b7 Calling')).toBeVisible();
    expect(within(pane).getByText(scenario.summary)).toBeVisible();
    const fact = (term: string) =>
      within(pane).getByText(term, { selector: 'dt' }).nextElementSibling;
    expect(fact('Impact')).toHaveTextContent(`High \u00b7 ${scenario.publicBrief.impact.high}`);
    expect(fact('Call stage')).toHaveTextContent('Escalated case');
    expect(fact('Style')).toHaveTextContent(`${STYLE_LABELS.demanding.label}, expert user`);
    expect(fact('Duration')).toHaveTextContent('About 12 min');
    expect(within(pane).getByRole('link', { name: 'Review brief' })).toBeVisible();
  });

  it('sits under the page\u2019s own heading, with its sections one level further down', async () => {
    await open(SAMPLE.challenge);
    expect(screen.getByRole('heading', { level: 1, name: 'Scenarios' })).toBeVisible();
    expect(screen.getByRole('heading', { level: 3, name: 'Starting state' })).toBeVisible();
    expect(screen.getByRole('button', { name: /^Customise/ }).closest('h3')).not.toBeNull();
  });

  it('shows the customer as the call will start, and moves it when the preset changes', async () => {
    await open(SAMPLE.standard);
    const pane = screen.getByRole('region', { name: scenarioById(SAMPLE.standard).title });
    const state = within(pane).getByRole('heading', { name: 'Starting state' })
      .parentElement as HTMLElement;
    expect(within(state).getByText('Priya Nair')).toBeVisible();
    expect(within(state).getByText('Synthetic customer')).toBeVisible();
    expect(within(state).getByText('Frustrated')).toBeVisible();
    const level = (name: string) =>
      within(state).getByText(name, { selector: 'dt' }).nextElementSibling;
    expect(level('Patience')).toHaveTextContent('Medium');

    await choose(control('Preset'), 'Challenge');
    expect(level('Patience')).toHaveTextContent('Low');
    expect(level('Trust')).toHaveTextContent('Low');
    await choose(control('Preset'), 'Starter');
    expect(level('Patience')).toHaveTextContent('High');
  });

  it('moves the customer when the starting state changes, and the facts when the impact does', async () => {
    await open(SAMPLE.standard);
    await openCustomise();
    await choose(control(/^Starting state/), 'Calm');
    const scenario = scenarioById(SAMPLE.standard);
    expect(
      within(screen.getByRole('region', { name: scenario.title })).getAllByText('Calm').length,
    ).toBeGreaterThan(0);
    await choose(control(/^Impact/), 'High');
    expect(screen.getByText(scenario.publicBrief.impact.high, { exact: false })).toBeVisible();
  });

  it('has the presets Starter, Standard and Challenge, at the scenario\u2019s own to begin with', async () => {
    await open(SAMPLE.standard);
    const preset = control('Preset');
    expect(
      within(preset)
        .getAllByRole('radio')
        .map((radio) => radio.getAttribute('value')),
    ).toEqual(['starter', 'standard', 'challenge']);
    expect(within(preset).getByRole('radio', { name: 'Standard' })).toBeChecked();
  });

  it('puts the setup, the preview and the link in step with every control, and the link in the address', async () => {
    const app = await open(SAMPLE.standard);
    await openCustomise();
    await choose(control('Preset'), 'Challenge');
    await choose(control(/^Impact/), 'High');
    await choose(control(/^Starting state/), 'Anxious');
    await choose(control(/^Proficiency/), 'Novice');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Style' }), 'vague');
    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: 'Call stage' }),
      'escalated',
    );

    await waitFor(() =>
      expect(review()).toHaveAttribute(
        'href',
        `/scenarios/${SAMPLE.standard}/brief?difficulty=challenge&impact=high&temperature=anxious&proficiency=novice&style=vague&stage=escalated`,
      ),
    );
    expect(app.query().get('stage')).toBe('escalated');
    expect(review()).toBeVisible();
  });

  it('keeps the link plain while nothing has been changed', async () => {
    await open(SAMPLE.standard);
    expect(review()).toHaveAttribute('href', `/scenarios/${SAMPLE.standard}/brief`);
  });
});

describe('the setup behind "Customise"', () => {
  beforeEach(() => stubViewport(true));
  const open = async (id: string, options?: RenderOptions) => {
    const app = renderApp(`/scenarios?scenario=${id}`, options);
    await screen.findByRole('heading', { level: 2, name: scenarioById(id).title });
    return app;
  };

  it('is closed to begin with, and opens with its settings at the scenario\u2019s own values', async () => {
    await open(SAMPLE.standard);
    const button = screen.getByRole('button', { name: /^Customise/ });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('group', { name: /^Impact/ })).not.toBeInTheDocument();
    await userEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(within(control(/^Impact/)).getByRole('radio', { name: 'Medium' })).toBeChecked();
    expect(screen.queryByText('Changed')).not.toBeInTheDocument();
  });

  it('keeps its help out of the page until it is asked for, one setting at a time', async () => {
    const user = userEvent.setup();
    await open(SAMPLE.standard);
    await openCustomise();
    const description = IMPACT_LABELS.medium.description;
    expect(screen.queryByText(description)).not.toBeVisible();
    const help = screen.getByRole('button', { name: 'About impact' });
    expect(help).toHaveAttribute('aria-expanded', 'false');
    await user.click(help);
    expect(help).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(description)).toBeVisible();
    expect(screen.queryByText(STYLE_LABELS.talkative.description)).not.toBeVisible();
    await user.click(help);
    expect(screen.getByText(description)).not.toBeVisible();
  });

  it('keeps the other settings\u2019 help out too, and the preset\u2019s', async () => {
    const user = userEvent.setup();
    await open(SAMPLE.standard);
    expect(screen.getByText(/Moderate ambiguity/)).not.toBeVisible();
    await user.click(screen.getByRole('button', { name: 'About presets' }));
    expect(screen.getByText(/Moderate ambiguity/)).toBeVisible();
  });

  it('marks a changed setting in words, counts the changes on the closed row, and offers Reset', async () => {
    const user = userEvent.setup();
    await open(SAMPLE.standard);
    const reset = () => screen.getByRole('button', { name: 'Reset to scenario defaults' });
    await openCustomise();
    expect(reset()).toHaveAttribute('aria-disabled', 'true');
    await choose(control(/^Impact/), 'Low');
    expect(
      within(screen.getByRole('button', { name: /^Customise/ })).getByText('1 changed'),
    ).toBeVisible();
    expect(control('Impact, changed')).toBeInTheDocument();
    expect(reset()).not.toHaveAttribute('aria-disabled');
    await user.click(reset());
    expect(within(control(/^Impact/)).getByRole('radio', { name: 'Medium' })).toBeChecked();
    expect(screen.queryByText('1 changed')).not.toBeInTheDocument();
    expect(reset()).toHaveFocus();
    expect(await screen.findByText('Settings reset to the scenario defaults.')).toBeInTheDocument();
  });

  it('starts with the scenario\u2019s own voice, and a chosen one goes in the address', async () => {
    const app = await open(SAMPLE.standard);
    await openCustomise();
    const select = screen.getByRole('combobox', { name: 'Customer voice' });
    const own = defaultVoiceFor(SAMPLE.standard);
    expect(select).toHaveValue(own);
    expect(within(select).getByRole('option', { name: voiceLabel(own) })).toBeInTheDocument();
    expect(
      within(select)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['Voice A - Warm', 'Voice B - Direct', 'Voice C - Measured', 'Voice D - Concise']);
    const other = own === 'voice-a' ? 'voice-b' : 'voice-a';
    await userEvent.selectOptions(select, other);
    await waitFor(() => expect(app.query().get('voice')).toBe(other));
    expect(screen.getByRole('button', { name: /^Customise/ })).toHaveTextContent('1 changed');
    await userEvent.selectOptions(select, own);
    await waitFor(() => expect(app.query().get('voice')).toBeNull());
  });

  it('offers only the voices the speech service lists, and none where nothing can speak the customer', async () => {
    mockApi({
      config: appConfig({
        speech: { ...AZURE_SPEECH, voices: (AZURE_SPEECH.voices ?? []).slice(0, 2) },
      }),
    });
    await open(SAMPLE.standard);
    await openCustomise();
    const select = screen.getByRole('combobox', { name: 'Customer voice' });
    await waitFor(() => expect(within(select).getAllByRole('option')).toHaveLength(2));
    cleanup();

    vi.mocked(detectFeatures).mockReturnValue({
      ...FULL_BROWSER,
      synthesis: false,
      audioElement: false,
    });
    mockApi();
    await open(SAMPLE.standard);
    await openCustomise();
    await screen.findByRole('group', { name: /^Impact/ });
    expect(screen.queryByRole('combobox', { name: 'Customer voice' })).not.toBeInTheDocument();
  });

  it('turns live hints on for Starter and off otherwise, until they are set', async () => {
    const user = userEvent.setup();
    await open(SAMPLE.standard);
    await openCustomise();
    const hints = () => screen.getByRole('switch', { name: /Live hints/ });
    expect(hints()).not.toBeChecked();
    await choose(control('Preset'), 'Starter');
    expect(hints()).toBeChecked();
    await choose(control('Preset'), 'Challenge');
    expect(hints()).not.toBeChecked();
    await user.click(hints());
    expect(hints()).toBeChecked();
    expect(review().getAttribute('href')).toContain('hints=on');
  });

  describe('complications', () => {
    const modes = () => control(/^Complications/);

    it('offer Off, the difficulty default and Choose, with the default to begin with', async () => {
      await open(SAMPLE.standard);
      await openCustomise();
      expect(
        within(modes())
          .getAllByRole('radio')
          .map((radio) => radio.getAttribute('value')),
      ).toEqual(['none', 'default', 'choose']);
      expect(within(modes()).getByRole('radio', { name: 'Default' })).toBeChecked();
      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    });

    it('switch off, and put "none" in the address', async () => {
      const app = await open(SAMPLE.standard);
      await openCustomise();
      await choose(modes(), 'Off');
      await waitFor(() => expect(app.query().get('curveballs')).toBe('none'));
    });

    it('list what the scenario offers by name only, and explain them when asked', async () => {
      const user = userEvent.setup();
      await open(SAMPLE.standard);
      await openCustomise();
      await choose(modes(), 'Choose');
      expect(screen.getAllByRole('checkbox')).toHaveLength(2);
      expect(
        screen.getByRole('checkbox', { name: CURVEBALL_LABELS['ask-manager'].label }),
      ).toBeVisible();
      expect(
        screen.getByText(CURVEBALL_LABELS['ask-manager'].description, { exact: false }),
      ).not.toBeVisible();
      await user.click(screen.getByRole('button', { name: 'About complications' }));
      expect(
        screen.getByText(CURVEBALL_LABELS['ask-manager'].description, { exact: false }),
      ).toBeVisible();
      expect(screen.getByText(/0 of 1 chosen/)).toBeVisible();
    });

    it('stop at the limit for the difficulty and say why', async () => {
      const user = userEvent.setup();
      const app = await open(SAMPLE.standard);
      await openCustomise();
      await choose(modes(), 'Choose');
      await user.click(screen.getByRole('checkbox', { name: 'Asks for a manager' }));
      expect(
        await screen.findByText(/1 of 1 chosen\. Untick one to choose another\./),
      ).toBeVisible();
      expect(screen.getByRole('checkbox', { name: 'Imposes a deadline' })).toBeDisabled();
      expect(app.query().get('curveballs')).toBe('ask-manager');
      await user.click(screen.getByRole('checkbox', { name: 'Asks for a manager' }));
      expect(screen.getByRole('checkbox', { name: 'Imposes a deadline' })).toBeEnabled();
    });

    it('allow two on Challenge, and trim the choice, in words, when the preset is lowered', async () => {
      const user = userEvent.setup();
      await open(SAMPLE.challenge);
      await openCustomise();
      await choose(modes(), 'Choose');
      await user.click(screen.getByRole('checkbox', { name: 'Asks for a manager' }));
      await user.click(screen.getByRole('checkbox', { name: 'Imposes a deadline' }));
      expect(screen.getByRole('checkbox', { name: 'Goes quiet' })).toBeDisabled();

      await choose(control('Preset'), 'Standard');
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

    it('never say how an unexpected turn is triggered', async () => {
      await open(SAMPLE.challenge);
      await openCustomise();
      await choose(modes(), 'Choose');
      await userEvent.click(screen.getByRole('button', { name: 'About complications' }));
      expect(document.body.textContent ?? '').not.toMatch(
        /trigger|after turn|temperature reaches/i,
      );
    });
  });
});

describe('on a narrow screen', () => {
  beforeEach(() => stubViewport(false));

  it('shows the list as links, with the filters in a region that opens', async () => {
    const user = userEvent.setup();
    renderApp('/scenarios');
    const links = within(await screen.findByRole('list', { name: 'Scenarios' })).getAllByRole(
      'link',
    );
    expect(links).toHaveLength(all.length);
    expect(links[0]).toHaveTextContent(first.title);
    expect(screen.queryByRole('region', { name: first.title })).not.toBeInTheDocument();

    const toggle = screen.getByRole('button', { name: 'Filters' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('combobox', { name: 'Product' })).not.toBeInTheDocument();
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Product' }), 'teams');
    expect(screen.getByRole('button', { name: 'Filters (1)' })).toBeInTheDocument();
    expect(
      within(screen.getByRole('list', { name: 'Scenarios' })).getAllByRole('link'),
    ).toHaveLength(2);
  });

  it('opens the details when a row is pressed, one step on from the list, with focus on the title', async () => {
    const user = userEvent.setup();
    const app = renderApp('/scenarios');
    await user.click(await screen.findByRole('link', { name: second.title }));

    const title = await screen.findByRole('heading', { level: 1, name: second.title });
    await waitFor(() => expect(title).toHaveFocus());
    expect(app.query().get('scenario')).toBe(second.id);
    expect(app.router.state.historyAction).toBe('PUSH');
    expect(screen.getByRole('link', { name: 'Review brief' })).toBeVisible();
    expect(screen.queryByRole('list', { name: 'Scenarios' })).not.toBeInTheDocument();
  });

  it('returns to the list with the Back button of the browser, and with the one in the page', async () => {
    const user = userEvent.setup();
    const app = renderApp('/scenarios');
    await user.click(await screen.findByRole('link', { name: second.title }));
    await screen.findByRole('heading', { level: 1, name: second.title });

    await user.click(screen.getByRole('button', { name: 'Scenarios' }));
    const back = await screen.findByRole('link', { name: second.title });
    expect(app.router.state.historyAction).toBe('POP');
    expect(app.query().get('scenario')).toBeNull();
    await waitFor(() => expect(back).toHaveFocus());

    await user.click(back);
    await screen.findByRole('heading', { level: 1, name: second.title });
    await app.router.navigate(-1);
    expect(await screen.findByRole('list', { name: 'Scenarios' })).toBeVisible();
  });

  it('moves between the links with the arrow keys, Home and End', async () => {
    const user = userEvent.setup();
    renderApp('/scenarios');
    const links = within(await screen.findByRole('list', { name: 'Scenarios' })).getAllByRole(
      'link',
    );
    links[0]?.focus();
    await user.keyboard('{ArrowDown}');
    expect(links[1]).toHaveFocus();
    await user.keyboard('{End}');
    expect(links[links.length - 1]).toHaveFocus();
    await user.keyboard('{ArrowUp}');
    expect(links[links.length - 2]).toHaveFocus();
    await user.keyboard('{Home}');
    expect(links[0]).toHaveFocus();
  });

  it('starts with the details open when the address names a scenario, and the page\u2019s Back replaces it', async () => {
    const user = userEvent.setup();
    const app = renderApp(`/scenarios?scenario=${SAMPLE.challenge}&difficulty=starter`);
    await screen.findByRole('heading', { level: 1, name: scenarioById(SAMPLE.challenge).title });
    expect(within(control('Preset')).getByRole('radio', { name: 'Starter' })).toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Scenarios' }));
    expect(await screen.findByRole('list', { name: 'Scenarios' })).toBeVisible();
    expect(app.query().get('scenario')).toBeNull();
    expect(app.router.state.historyAction).toBe('REPLACE');
  });

  it('keeps the filters in the address when the details open', async () => {
    const user = userEvent.setup();
    const app = renderApp('/scenarios?f_product=teams');
    await user.click(await screen.findByRole('link', { name: /Meeting recordings/ }));
    await screen.findByRole('heading', { level: 1 });
    expect(app.query().get('f_product')).toBe('teams');
  });

  it('has one heading for the page when the details are open: the scenario\u2019s title, as the page\u2019s own', async () => {
    const { title } = scenarioById(SAMPLE.challenge);
    renderApp(`/scenarios?scenario=${SAMPLE.challenge}`);
    await screen.findByRole('heading', { level: 1, name: title });
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.queryByRole('heading', { level: 2, name: title })).not.toBeInTheDocument();
    // The sections under it are one level down, so the order of headings has no gap.
    expect(screen.getByRole('heading', { level: 2, name: 'Starting state' })).toBeVisible();
    expect(screen.getByRole('button', { name: /^Customise/ }).closest('h2')).not.toBeNull();
  });
});

describe('a server that does not send every field yet', () => {
  beforeEach(() => stubViewport(true));

  it('offers no complications to choose from, but still Off and the default', async () => {
    const stale = publicScenarios().map(
      ({ curveballOptions: _omitted, ...rest }) => rest,
    ) as unknown as PublicScenarioDTO[];
    vi.mocked(api.scenarios).mockResolvedValue(stale);
    renderApp(`/scenarios?scenario=${SAMPLE.standard}`);
    await screen.findByRole('heading', { level: 2, name: scenarioById(SAMPLE.standard).title });
    await openCustomise();
    const modes = control(/^Complications/);
    expect(within(modes).getByRole('radio', { name: 'Off' })).toBeVisible();
    expect(within(modes).getByRole('radio', { name: 'Default' })).toBeChecked();
    expect(within(modes).queryByRole('radio', { name: 'Choose' })).not.toBeInTheDocument();
  });
});
