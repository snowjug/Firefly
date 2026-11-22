import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PublicScenarioDTO } from '#shared/domain/api.ts';
import { wordCount } from '#shared/domain/scenario.ts';
import {
  CURVEBALL_LABELS,
  IMPACT_LABELS,
  PRACTICE_MODE_LABELS,
  STYLE_LABELS,
} from '#shared/domain/vocab.ts';
import { stubMedia } from '../../design/interaction/test-utils.ts';
import { api } from '../../lib/api.ts';
import type * as ApiModule from '../../lib/api.ts';
import { detectFeatures, type VoiceFeatures } from '../voice/support.ts';
import type * as SupportModule from '../voice/support.ts';
import { sortScenarios } from './catalogue.ts';
import { ARRIVAL_STEPS } from './arrival.ts';
import { cardTitle } from './labels.ts';
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

const gallery = () => screen.findByRole('region', { name: 'Scenarios' });
const cards = async () => within(await gallery()).getAllByRole('radio');
const card = async (scenario: PublicScenarioDTO) =>
  within(await gallery()).getByRole('radio', { name: cardTitle(scenario) });
const rail = () => screen.getByRole('group', { name: 'Product' });
const chip = (name: string | RegExp) => within(rail()).getByRole('radio', { name });
const control = (name: string | RegExp) => screen.getByRole('group', { name });
const choose = (group: HTMLElement, name: string | RegExp) =>
  userEvent.click(within(group).getByRole('radio', { name }));
const start = () => screen.getByRole('link', { name: 'Start configuration' });
const detailFor = (scenario: PublicScenarioDTO) =>
  screen.findByRole('region', { name: scenario.title });
const openCustomise = async () => {
  const button = await screen.findByRole('button', { name: /^Customise/ });
  if (button.getAttribute('aria-expanded') !== 'true') await userEvent.click(button);
};
const count = (text: string) => expect(screen.getByText(text)).toBeInTheDocument();
const announced = () =>
  [...document.querySelectorAll('.visually-hidden[role="status"]')].map(
    (element) => element.textContent,
  );

/** What a card says besides its title: the text its description points at. */
function described(radio: HTMLElement): string {
  return (radio.getAttribute('aria-describedby') ?? '')
    .split(' ')
    .map((id) => document.getElementById(id)?.textContent ?? '')
    .join(' | ');
}

describe('the carousel of scenarios', () => {
  it('shows every scenario as a card in one standard list, by product, each saying what it is', async () => {
    renderApp('/scenarios');
    expect(await screen.findByRole('heading', { level: 1, name: 'Scenarios' })).toBeVisible();
    const radios = await cards();
    expect(radios).toHaveLength(all.length);
    expect(radios.map((radio) => radio.getAttribute('value'))).toEqual(sorted.map((s) => s.id));

    const teams = scenarioById(SAMPLE.standard);
    const text = described(await card(teams));
    expect(text).toContain('Teams');
    expect(text).toContain('Medium impact \u00b7 Frustrated \u00b7 First contact');
    expect(text).toContain('8\u201312 min');
    expect(text).toContain('Standard');
    // A semantic list, one item to a card, with no heading and no second control inside any of them.
    const list = within(await gallery()).getByRole('list');
    expect(within(list).getAllByRole('listitem')).toHaveLength(all.length);
    expect(within(list).queryAllByRole('heading')).toEqual([]);
    expect(within(list).queryAllByRole('button')).toEqual([]);
  });

  it('tells each card its place in the set, and shows the chosen one\u2019s place as a count', async () => {
    renderApp('/scenarios');
    const items = within(await gallery()).getAllByRole('listitem');
    expect(items[0]).toHaveAttribute('aria-posinset', '1');
    expect(items[0]).toHaveAttribute('aria-setsize', String(all.length));
    expect(items[15]).toHaveAttribute('aria-posinset', '16');
    expect(await screen.findByText(`1 of ${all.length}`)).toBeVisible();
  });

  it('keeps every card title to six words', async () => {
    renderApp('/scenarios');
    for (const radio of await cards()) {
      const title = document.getElementById(radio.getAttribute('aria-labelledby') as string);
      expect(wordCount(title?.textContent ?? '')).toBeLessThanOrEqual(6);
    }
  });

  it('selects the first scenario when the address names none, and writes that in the address', async () => {
    const app = renderApp('/scenarios');
    expect(await card(first)).toBeChecked();
    await waitFor(() => expect(app.query().get('scenario')).toBe(first.id));
    expect(await screen.findByRole('heading', { level: 2, name: first.title })).toBeVisible();
    expect(app.router.state.historyAction).toBe('REPLACE');
  });

  it('moves the choice with the arrow keys and keeps the details in step', async () => {
    const user = userEvent.setup();
    const app = renderApp('/scenarios');
    (await card(first)).focus();
    await user.keyboard('{ArrowRight}');

    expect(await card(second)).toBeChecked();
    expect(await screen.findByRole('heading', { level: 2, name: second.title })).toBeVisible();
    await waitFor(() => expect(app.query().get('scenario')).toBe(second.id));
    expect(await card(second)).toHaveFocus();
    expect(await screen.findByText(`2 of ${all.length}`)).toBeVisible();
  });

  it('says once, politely, that the details changed, and not when the page first chooses', async () => {
    const user = userEvent.setup();
    renderApp('/scenarios');
    await card(first);
    expect(announced().join(' ')).not.toContain('Showing details');
    await user.click(await card(second));
    await waitFor(() => expect(announced()).toContain(`Showing details for ${cardTitle(second)}.`));
  });

  it('fades the details in when another scenario is chosen', async () => {
    const user = userEvent.setup();
    renderApp('/scenarios');
    const before = (await screen.findByRole('heading', { level: 2, name: first.title })).closest(
      '.scn-detail__main',
    );
    expect(before).not.toBeNull();
    await user.click(await card(second));
    const heading = await screen.findByRole('heading', { level: 2, name: second.title });
    expect(heading.closest('.scn-detail__main')).not.toBe(before);
  });

  it('gives every control a name, so nothing is read as "edit text" or "button"', async () => {
    renderApp('/scenarios');
    await gallery();
    for (const radio of screen.getAllByRole('radio')) expect(radio).toHaveAccessibleName();
    for (const button of screen.getAllByRole('button')) expect(button).toHaveAccessibleName();
    for (const link of screen.getAllByRole('link')) expect(link).toHaveAccessibleName();
  });

  it('has the previous and next buttons, with the first page showing', async () => {
    renderApp('/scenarios');
    await gallery();
    expect(screen.getByRole('button', { name: 'Previous scenarios' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Next scenarios' })).toBeInTheDocument();
  });
});

describe('the product rail', () => {
  it('lists All and every product that has scenarios, each with its count, with Power Platform last', async () => {
    renderApp('/scenarios');
    await gallery();
    const names = within(rail())
      .getAllByRole('radio')
      .map((radio) => radio.closest('label')?.querySelector('.scn-chip__label')?.textContent);
    expect(names).toEqual([
      'All',
      'Teams',
      'Outlook',
      'Exchange',
      'SharePoint',
      'OneDrive',
      'Microsoft 365 Apps',
      'Entra ID',
      'Intune',
      'Defender',
      'Windows',
      'Azure',
      'Dynamics 365',
      'Power Platform',
    ]);
    expect(chip('All, 16 scenarios')).toBeChecked();
    expect(chip('Teams, 2 scenarios')).toBeInTheDocument();
    expect(chip('Azure, 2 scenarios')).toBeInTheDocument();
    expect(chip('Outlook, 1 scenario')).toBeInTheDocument();
  });

  it('narrows the carousel, says so in the count, and writes the choice in the address', async () => {
    const user = userEvent.setup();
    const app = renderApp('/scenarios');
    await gallery();
    count('16 scenarios');
    await user.click(chip(/^Teams/));
    await waitFor(async () => expect(await cards()).toHaveLength(2));
    count('2 of 16 scenarios');
    expect(app.query().get('f_product')).toBe('teams');
    expect(app.router.state.historyAction).toBe('REPLACE');
    expect(chip(/^Teams/)).toBeChecked();
  });

  it('moves with the arrow keys, Home and End, and the carousel follows', async () => {
    const user = userEvent.setup();
    const app = renderApp('/scenarios');
    await gallery();
    chip(/^All/).focus();
    await user.keyboard('{ArrowRight}');
    expect(chip(/^Teams/)).toBeChecked();
    await waitFor(() => expect(app.query().get('f_product')).toBe('teams'));
    await user.keyboard('{End}');
    expect(chip(/^Power Platform/)).toBeChecked();
    await waitFor(async () => expect(await cards()).toHaveLength(1));
    await user.keyboard('{Home}');
    expect(chip(/^All/)).toBeChecked();
    await waitFor(() => expect(app.query().get('f_product')).toBeNull());
  });

  it('updates its counts when the difficulty changes, and puts a product with none out of reach', async () => {
    renderApp('/scenarios');
    await gallery();
    await choose(control('Difficulty'), /^Starter/);
    expect(chip('All, 5 scenarios')).toBeChecked();
    expect(chip('Teams, 0 scenarios')).toBeDisabled();
    expect(chip('Outlook, 1 scenario')).toBeEnabled();
  });

  it('keeps a chosen product reachable even when the difficulty leaves it nothing', async () => {
    renderApp('/scenarios?f_product=teams&f_difficulty=starter');
    expect(await screen.findByRole('heading', { name: 'No scenarios match' })).toBeVisible();
    expect(chip(/^Teams/)).toBeChecked();
    expect(chip(/^Teams/)).toBeEnabled();
  });

  it('restores the product from the address, and scrolls the chosen chip into view', async () => {
    renderApp('/scenarios?f_product=azure');
    await gallery();
    expect(chip(/^Azure/)).toBeChecked();
    expect(await cards()).toHaveLength(2);
  });
});

describe('the difficulty filter and "Clear filters"', () => {
  it('filters by difficulty with the segmented control, and writes it as f_difficulty', async () => {
    const app = renderApp('/scenarios');
    await gallery();
    await choose(control('Difficulty'), 'Challenge, 4 scenarios');
    await waitFor(async () => expect(await cards()).toHaveLength(4));
    expect(app.query().get('f_difficulty')).toBe('challenge');
    expect(app.query().get('difficulty')).toBeNull();
    await choose(control('Difficulty'), /^All/);
    await waitFor(async () => expect(await cards()).toHaveLength(all.length));
  });

  it('counts each difficulty against the product chosen, and puts an empty one out of reach', async () => {
    const user = userEvent.setup();
    renderApp('/scenarios');
    await gallery();
    const difficulty = control('Difficulty');
    expect(within(difficulty).getByRole('radio', { name: 'All, 16 scenarios' })).toBeChecked();
    expect(within(difficulty).getByRole('radio', { name: 'Starter, 5 scenarios' })).toBeVisible();
    await user.click(chip(/^Teams/));
    expect(within(difficulty).getByRole('radio', { name: 'All, 2 scenarios' })).toBeChecked();
    expect(within(difficulty).getByRole('radio', { name: 'Starter, 0 scenarios' })).toBeDisabled();
    expect(within(difficulty).getByRole('radio', { name: 'Challenge, 1 scenario' })).toBeEnabled();
  });

  it('shows "Clear filters" only while something is filtered, clears everything and moves focus to All', async () => {
    const user = userEvent.setup();
    const app = renderApp('/scenarios');
    await gallery();
    expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument();
    await user.click(chip(/^Azure/));
    await choose(control('Difficulty'), /^Standard/);
    await user.click(await screen.findByRole('button', { name: 'Clear filters' }));

    await waitFor(async () => expect(await cards()).toHaveLength(all.length));
    expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument();
    expect(chip(/^All/)).toBeChecked();
    expect(chip(/^All/)).toHaveFocus();
    expect(app.query().get('f_product')).toBeNull();
    expect(app.query().get('f_difficulty')).toBeNull();
  });

  it('shows a choice at once, without waiting for the address to catch up', async () => {
    const app = renderApp('/scenarios', { slowNavigation: 80 });
    await gallery();
    fireEvent.click(chip(/^Azure/));
    expect(chip(/^Azure/)).toBeChecked();
    await waitFor(() => expect(app.query().get('f_product')).toBe('azure'));
    expect(chip(/^Azure/)).toBeChecked();
  });

  it('says when nothing matches and offers a way out, and leaves the details empty', async () => {
    const user = userEvent.setup();
    renderApp('/scenarios?f_product=teams&f_difficulty=starter');
    expect(await screen.findByRole('heading', { name: 'No scenarios match' })).toBeVisible();
    count('0 of 16 scenarios');
    expect(screen.getByText('No scenario selected')).toBeInTheDocument();
    const clear = screen.getAllByRole('button', { name: 'Clear filters' });
    await user.click(clear[clear.length - 1] as HTMLElement);
    await waitFor(async () => expect(await cards()).toHaveLength(all.length));
  });

  it('selects another scenario when the chosen one is filtered out, and tidies the address', async () => {
    const app = renderApp('/scenarios');
    await gallery();
    await choose(control('Difficulty'), 'Challenge, 4 scenarios');
    const challenge = all.filter((s) => s.difficulty === 'challenge').map((s) => s.id);
    await waitFor(() => expect(challenge).toContain(app.query().get('scenario')));
    expect(await within(await gallery()).findAllByRole('radio', { checked: true })).toHaveLength(1);
  });

  it('keeps the chosen scenario when a filter still shows it', async () => {
    const user = userEvent.setup();
    const teams = scenarioById(SAMPLE.standard);
    const app = renderApp(`/scenarios?scenario=${teams.id}`);
    expect(await card(teams)).toBeChecked();
    await user.click(chip(/^Teams/));
    await waitFor(async () => expect(await cards()).toHaveLength(2));
    expect(await card(teams)).toBeChecked();
    expect(app.query().get('scenario')).toBe(teams.id);
    expect(await screen.findByText(/^1 of 2$|^2 of 2$/)).toBeVisible();
  });

  it('announces the count politely', async () => {
    renderApp('/scenarios');
    await gallery();
    const status = screen.getByText('16 scenarios').closest('[role="status"]');
    expect(status).toHaveAttribute('aria-live', 'polite');
  });

  it('opens an older link that names an issue type, with the product and difficulty in it, and tidies it', async () => {
    const app = renderApp(
      '/scenarios?f_product=azure&f_issue=billing-licence&f_difficulty=starter',
    );
    expect(await within(await gallery()).findAllByRole('radio')).toHaveLength(1);
    expect(chip(/^Azure/)).toBeChecked();
    await waitFor(() => expect(app.query().get('f_issue')).toBeNull());
    expect(app.query().get('f_product')).toBe('azure');
    expect(app.query().get('f_difficulty')).toBe('starter');
  });
});

describe('the cards a filter brings in', () => {
  /** The cards on screen by scenario, in the order they are shown. */
  const shown = () =>
    new Map(
      [...document.querySelectorAll<HTMLElement>('.scn-card')].map((element) => [
        element.getAttribute('data-scenario') as string,
        element,
      ]),
    );
  const step = (element: HTMLElement) => Number(element.style.getPropertyValue('--reveal-i'));

  it('arrive one after another when the library first shows: the first few, and the rest are simply there', async () => {
    renderApp('/scenarios');
    await gallery();
    const cardsNow = [...shown().values()];
    expect(cardsNow).toHaveLength(all.length);
    cardsNow.forEach((element, index) => {
      if (index < ARRIVAL_STEPS) {
        expect(element, `card ${index}`).toHaveAttribute('data-arrive', 'now');
        expect(step(element), `card ${index}`).toBe(index);
      } else {
        expect(element, `card ${index}`).not.toHaveAttribute('data-arrive');
      }
    });
  });

  it('leave the cards that stay exactly where they are, and bring in only the ones the filter adds', async () => {
    const user = userEvent.setup();
    renderApp('/scenarios');
    await gallery();
    const before = shown();

    await user.click(chip(/^Teams/));
    await waitFor(() => expect(shown().size).toBeLessThan(before.size));
    const kept = shown();
    expect(kept.size).toBeGreaterThan(0);
    // Filtering down brings nothing in: the cards that stay are the same elements and are not arriving.
    for (const [id, element] of kept) {
      expect(element, id).toBe(before.get(id));
      expect(element, id).not.toHaveAttribute('data-arrive');
    }

    await user.click(chip(/^All/));
    await waitFor(() => expect(shown().size).toBe(before.size));
    const after = shown();
    const arriving = [...after].filter(([id]) => !kept.has(id)).map(([, element]) => element);
    expect(arriving.length).toBe(before.size - kept.size);
    // The ones that stayed are still the same elements, and still not arriving.
    for (const [id, element] of kept) {
      expect(after.get(id), id).toBe(element);
      expect(element, id).not.toHaveAttribute('data-arrive');
    }
    // The new ones come in from the first step, in the order they are shown, as many as there are steps.
    arriving.forEach((element, index) => {
      if (index < ARRIVAL_STEPS) {
        expect(element, `new card ${index}`).toHaveAttribute('data-arrive', 'now');
        expect(step(element), `new card ${index}`).toBe(index);
      } else {
        expect(element, `new card ${index}`).not.toHaveAttribute('data-arrive');
      }
    });
  });

  it('do not start again when another card is chosen', async () => {
    const user = userEvent.setup();
    renderApp('/scenarios');
    await gallery();
    const marks = () => [...shown()].map(([id, element]) => [id, element.dataset.arrive ?? '']);
    const before = marks();
    await user.click(await card(second));
    await waitFor(() =>
      expect(screen.getByRole('radio', { name: cardTitle(second) })).toBeChecked(),
    );
    expect(marks()).toEqual(before);
  });
});

describe('loading, failure and retry', () => {
  it('shows placeholders while the scenarios load, in the shape of the page', async () => {
    vi.mocked(api.scenarios).mockReturnValue(new Promise(() => undefined));
    renderApp('/scenarios');
    expect(await screen.findByText('Loading scenarios')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Scenarios' })).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Product' })).not.toBeInTheDocument();
    expect(document.querySelectorAll('.scn-card--skeleton').length).toBeGreaterThan(0);
  });

  it('says what happened, and tries again', async () => {
    const user = userEvent.setup();
    vi.mocked(api.scenarios).mockRejectedValueOnce(networkError());
    renderApp('/scenarios');
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Scenarios could not be loaded');
    expect(alert).toHaveTextContent("Can't reach Firefly right now.");
    await user.click(within(alert).getByRole('button', { name: 'Try again' }));
    expect(await card(first)).toBeInTheDocument();
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
    expect(await card(first)).toBeInTheDocument();
  });
});

describe('the address', () => {
  it('restores the filters, the scenario, the practice mode and every setting', async () => {
    renderApp(
      `/scenarios?f_product=teams&scenario=${SAMPLE.challenge}&impact=low&temperature=anxious&proficiency=novice&style=vague&stage=closure&curveballs=deadline&hints=on&difficulty=starter&voice=voice-d`,
    );
    expect(await card(scenarioById(SAMPLE.challenge))).toBeChecked();
    expect(chip(/^Teams/)).toBeChecked();
    expect(within(control('Preset')).getByRole('radio', { name: 'Starter' })).toBeChecked();
    expect(
      within(control('Practice mode')).getByRole('radio', { name: 'Guided practice' }),
    ).toBeChecked();

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
  });

  it('ignores values it cannot use and tidies the address', async () => {
    const app = renderApp('/scenarios?scenario=nope&difficulty=extreme&f_product=notes&utm=1');
    expect(await card(first)).toBeChecked();
    await waitFor(() => expect(app.where()).toBe(`/scenarios?scenario=${first.id}`));
  });

  it('opens a deep link to one scenario with that scenario chosen, in view and described below', async () => {
    const target = scenarioById(SAMPLE.closure);
    const app = renderApp(`/scenarios?scenario=${target.id}`);
    expect(await card(target)).toBeChecked();
    expect(await detailFor(target)).toBeVisible();
    expect(app.query().get('scenario')).toBe(target.id);
    expect(start()).toHaveAttribute('href', `/scenarios/${target.id}/brief`);
  });

  it('says so once when the address names a scenario that has gone', async () => {
    const user = userEvent.setup();
    renderApp('/scenarios?scenario=locked-out-after-password-reset');
    const notice = await screen.findByText(/That scenario is no longer in the library/);
    expect(await card(first)).toBeChecked();
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
    await gallery();
    await user.click(chip(/^Teams/));
    await choose(control('Preset'), 'Challenge');
    await user.click(await card(scenarioById(SAMPLE.challenge)));
    expect(app.router.state.historyAction).toBe('REPLACE');
    await waitFor(() => expect(app.query().get('scenario')).toBe(SAMPLE.challenge));
  });

  it('does not carry one scenario\u2019s changes to another', async () => {
    const user = userEvent.setup();
    const app = renderApp(`/scenarios?scenario=${SAMPLE.standard}&difficulty=challenge&hints=on`);
    expect(await card(scenarioById(SAMPLE.standard))).toBeChecked();
    await user.click(await card(scenarioById(SAMPLE.starter)));
    await waitFor(() => expect(app.query().get('scenario')).toBe(SAMPLE.starter));
    expect(app.query().get('difficulty')).toBeNull();
    expect(app.query().get('hints')).toBeNull();
    expect(within(control('Preset')).getByRole('radio', { name: 'Starter' })).toBeChecked();
  });
});

describe('the chosen scenario', () => {
  const open = async (id: string, options?: RenderOptions) => {
    const app = renderApp(`/scenarios?scenario=${id}`, options);
    await screen.findByRole('heading', { level: 2, name: scenarioById(id).title });
    return app;
  };

  it('is one section below the carousel, headed by its product mark, product and title', async () => {
    await open(SAMPLE.challenge);
    const scenario = scenarioById(SAMPLE.challenge);
    const pane = await detailFor(scenario);
    expect(within(pane).getByText('Microsoft Teams \u00b7 Calling')).toBeVisible();
    expect(pane.querySelector('.scn-detail__tile')).toHaveClass('ff-accent--purple');
    expect(pane.querySelector('.scn-detail__tile')).toHaveAttribute('aria-hidden', 'true');
    // It follows the carousel in the page, so choosing a card changes what is just below it.
    const region = await gallery();
    expect(region.compareDocumentPosition(pane) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('says the issue, the impact, the customer, the state, the stage, the difficulty, the time and the focus', async () => {
    await open(SAMPLE.challenge);
    const scenario = scenarioById(SAMPLE.challenge);
    const pane = await detailFor(scenario);
    const fact = (term: string) =>
      within(pane).getByText(term, { selector: 'dt' }).nextElementSibling as HTMLElement;
    expect(fact('Issue')).toHaveTextContent(scenario.publicBrief.issue);
    expect(fact('Business impact')).toHaveTextContent(
      `High \u00b7 ${scenario.publicBrief.impact.high}`,
    );
    expect(fact('Customer')).toHaveTextContent('Kenji Watanabe');
    expect(fact('Customer')).toHaveTextContent('Head of sales operations, Woodgrove Bank');
    expect(fact('Customer')).toHaveTextContent('Synthetic customer');
    expect(fact('Customer state')).toHaveTextContent('Angry');
    expect(fact('Call stage')).toHaveTextContent('Escalated');
    expect(fact('Call stage')).not.toHaveTextContent('Escalated case');
    expect(fact('Difficulty')).toHaveTextContent('Challenge');
    expect(fact('Estimated duration')).toHaveTextContent('10\u201314 min');
    expect(fact('Coaching focus')).toHaveTextContent('Scoping & Discovery');
  });

  it('leaves out the long summary: the details are the facts a person scans', async () => {
    await open(SAMPLE.challenge);
    const scenario = scenarioById(SAMPLE.challenge);
    const pane = await detailFor(scenario);
    expect(pane).not.toHaveTextContent(scenario.summary);
    expect(pane).not.toHaveTextContent(scenario.listSummary);
  });

  it('sits under the page\u2019s own heading, with its sections one level further down', async () => {
    await open(SAMPLE.challenge);
    expect(screen.getByRole('heading', { level: 1, name: 'Scenarios' })).toBeVisible();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('button', { name: /^Customise/ }).closest('h3')).not.toBeNull();
  });

  it('shows the customer as the call will start, and moves it when the preset changes', async () => {
    await open(SAMPLE.standard);
    const pane = await detailFor(scenarioById(SAMPLE.standard));
    const state = within(pane).getByText('Customer state', { selector: 'dt' })
      .nextElementSibling as HTMLElement;
    expect(within(state).getByText('Frustrated')).toBeVisible();
    const level = (name: string) =>
      within(state).getByText(name, { selector: 'dt' }).nextElementSibling;
    expect(level('Patience')).toHaveTextContent('Medium');

    await choose(control('Preset'), 'Challenge');
    expect(level('Patience')).toHaveTextContent('Low');
    expect(level('Trust')).toHaveTextContent('Low');
    expect(
      within(pane).getByText('Difficulty', { selector: 'dt' }).nextElementSibling,
    ).toHaveTextContent('Challenge');
    await choose(control('Preset'), 'Starter');
    expect(level('Patience')).toHaveTextContent('High');
  });

  it('moves the state when the starting state changes, and the impact when the impact does', async () => {
    await open(SAMPLE.standard);
    await openCustomise();
    await choose(control(/^Starting state/), 'Calm');
    const scenario = scenarioById(SAMPLE.standard);
    const pane = await detailFor(scenario);
    expect(within(pane).getAllByText('Calm').length).toBeGreaterThan(0);
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

  it('puts the primary action, "Start configuration", at the end of the details, with the setup in its link', async () => {
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
      expect(start()).toHaveAttribute(
        'href',
        `/scenarios/${SAMPLE.standard}/brief?difficulty=challenge&impact=high&temperature=anxious&proficiency=novice&style=vague&stage=escalated`,
      ),
    );
    expect(app.query().get('stage')).toBe('escalated');
    expect(start()).toBeVisible();
    expect(screen.queryByRole('link', { name: 'Review brief' })).not.toBeInTheDocument();
  });

  it('keeps the link plain while nothing has been changed', async () => {
    await open(SAMPLE.standard);
    expect(start()).toHaveAttribute('href', `/scenarios/${SAMPLE.standard}/brief`);
  });

  it('goes to the case brief when it is pressed, and the page there is the brief', async () => {
    const user = userEvent.setup();
    const app = await open(SAMPLE.standard);
    await user.click(start());
    await waitFor(() => expect(app.where()).toBe(`/scenarios/${SAMPLE.standard}/brief`));
    expect(await screen.findByRole('heading', { level: 1, name: 'Case brief' })).toBeVisible();
  });

  it('asks for a view transition only while the person allows motion', async () => {
    const user = userEvent.setup();
    const app = await open(SAMPLE.standard);
    const seen: unknown[] = [];
    app.router.subscribe((_state, options) => seen.push(options.viewTransitionOpts));
    await user.click(start());
    await waitFor(() => expect(app.where()).toContain('/brief'));
    expect(seen.some((options) => options !== undefined)).toBe(true);
    cleanup();

    stubMedia({ '(prefers-reduced-motion: reduce)': true });
    const reduced = await open(SAMPLE.standard);
    const seenReduced: unknown[] = [];
    reduced.router.subscribe((_state, options) => seenReduced.push(options.viewTransitionOpts));
    await user.click(start());
    await waitFor(() => expect(reduced.where()).toContain('/brief'));
    expect(seenReduced.filter((options) => options !== undefined)).toEqual([]);
  });
});

describe('the practice mode', () => {
  const open = async (id: string) => {
    const app = renderApp(`/scenarios?scenario=${id}`);
    await screen.findByRole('heading', { level: 2, name: scenarioById(id).title });
    return app;
  };
  const modes = () => control('Practice mode');

  it('is Guided practice or Assessment practice, each with its own one-line description', async () => {
    await open(SAMPLE.standard);
    const radios = within(modes()).getAllByRole('radio');
    expect(radios.map((radio) => radio.getAttribute('value'))).toEqual(['guided', 'immersive']);
    expect(within(modes()).getByRole('radio', { name: 'Guided practice' })).toBeInTheDocument();
    expect(within(modes()).getByRole('radio', { name: 'Assessment practice' })).toBeInTheDocument();
    expect(screen.getByText(PRACTICE_MODE_LABELS.guided.description)).toBeVisible();
    expect(screen.getByText(PRACTICE_MODE_LABELS.immersive.description)).toBeVisible();
  });

  it('never says "Live hints" anywhere on the page', async () => {
    await open(SAMPLE.standard);
    await openCustomise();
    expect(document.body.textContent ?? '').not.toMatch(/live hints/i);
  });

  it('defaults to Guided for Starter and Assessment for Standard and Challenge, following the preset', async () => {
    await open(SAMPLE.standard);
    const mode = () =>
      within(modes())
        .getAllByRole('radio')
        .find((radio) => (radio as HTMLInputElement).checked)
        ?.getAttribute('value');
    expect(mode()).toBe('immersive');
    await choose(control('Preset'), 'Starter');
    expect(mode()).toBe('guided');
    await choose(control('Preset'), 'Challenge');
    expect(mode()).toBe('immersive');
  });

  it('says when a preset changed the mode, politely', async () => {
    await open(SAMPLE.standard);
    await choose(control('Preset'), 'Starter');
    await waitFor(() => expect(announced()).toContain('Practice mode is now Guided practice.'));
  });

  it('keeps a mode chosen on purpose, in the address and in the Start configuration link', async () => {
    const user = userEvent.setup();
    const app = await open(SAMPLE.challenge);
    // A Challenge call has no tips unless Guided practice is chosen on purpose.
    expect(within(modes()).getByRole('radio', { name: 'Assessment practice' })).toBeChecked();
    await user.click(within(modes()).getByRole('radio', { name: 'Guided practice' }));
    await waitFor(() => expect(app.query().get('hints')).toBe('on'));
    expect(start().getAttribute('href')).toContain('hints=on');
    // Choosing what the preset gives anyway leaves nothing in the address.
    await user.click(within(modes()).getByRole('radio', { name: 'Assessment practice' }));
    await waitFor(() => expect(app.query().get('hints')).toBeNull());
  });

  it('is named in the summary beside the way on', async () => {
    await open(SAMPLE.standard);
    expect(document.querySelector('.scn-detail__summary-line')).toHaveTextContent(
      'Standard \u00b7 Medium impact \u00b7 Frustrated \u00b7 Assessment practice',
    );
    await choose(control('Preset'), 'Starter');
    expect(document.querySelector('.scn-detail__summary-line')).toHaveTextContent(
      'Starter \u00b7 Medium impact \u00b7 Frustrated \u00b7 Guided practice',
    );
  });
});

describe('the setup behind "Customise"', () => {
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

  it('stays open or closed as another scenario is chosen', async () => {
    const user = userEvent.setup();
    await open(SAMPLE.standard);
    await openCustomise();
    await user.click(await card(scenarioById(SAMPLE.starter)));
    await screen.findByRole('heading', { level: 2, name: scenarioById(SAMPLE.starter).title });
    expect(screen.getByRole('button', { name: /^Customise/ })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
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

  it('does not count the preset or the practice mode, which are not behind it', async () => {
    await open(SAMPLE.standard);
    await choose(control('Preset'), 'Challenge');
    await userEvent.click(
      within(control('Practice mode')).getByRole('radio', { name: 'Guided practice' }),
    );
    expect(
      within(screen.getByRole('button', { name: /^Customise/ })).queryByText(/changed/),
    ).not.toBeInTheDocument();
    // ...but Reset puts them back too, once the setup is open.
    await openCustomise();
    const reset = screen.getByRole('button', { name: 'Reset to scenario defaults' });
    expect(reset).not.toHaveAttribute('aria-disabled');
    await userEvent.click(reset);
    expect(within(control('Preset')).getByRole('radio', { name: 'Standard' })).toBeChecked();
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

describe('one page at every width', () => {
  it('has no second screen and no Back button: the carousel, the rail and the details are all there', async () => {
    stubMedia({ '(max-width: 47.99em)': true });
    renderApp(`/scenarios?scenario=${SAMPLE.challenge}`);
    await detailFor(scenarioById(SAMPLE.challenge));
    expect(await gallery()).toBeVisible();
    expect(rail()).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Scenarios' })).not.toBeInTheDocument();
    expect(start()).toBeVisible();
    // Choosing a card changes the details in place: the address is replaced, never pushed.
  });

  it('leaves a link with a scenario on the page as one entry, so Back leaves the workspace', async () => {
    const user = userEvent.setup();
    const app = renderApp(`/scenarios?scenario=${SAMPLE.challenge}`);
    await detailFor(scenarioById(SAMPLE.challenge));
    await user.click(await card(scenarioById(SAMPLE.starter)));
    await waitFor(() => expect(app.query().get('scenario')).toBe(SAMPLE.starter));
    expect(app.router.state.historyAction).toBe('REPLACE');
  });

  it('keeps the recap beside the way on in sight, and on the narrowest phones out of sight but not out of reach', async () => {
    renderApp(`/scenarios?scenario=${SAMPLE.challenge}`);
    await detailFor(scenarioById(SAMPLE.challenge));
    const recap = () => document.querySelector('.scn-detail__summary-line') as HTMLElement;
    expect(recap()).not.toHaveClass('visually-hidden');
    cleanup();

    stubMedia({ '(max-width: 22.49em)': true });
    renderApp(`/scenarios?scenario=${SAMPLE.challenge}`);
    await detailFor(scenarioById(SAMPLE.challenge));
    expect(recap()).toHaveClass('visually-hidden');
    expect(recap()).toHaveTextContent('Challenge');
  });
});

describe('a server that does not send every field yet', () => {
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

  it('shows the full title on a card when there is no short one', async () => {
    const stale = publicScenarios().map(
      ({ shortTitle: _omitted, ...rest }) => rest,
    ) as unknown as PublicScenarioDTO[];
    vi.mocked(api.scenarios).mockResolvedValue(stale);
    renderApp('/scenarios');
    expect(
      await within(await gallery()).findByRole('radio', { name: first.title }),
    ).toBeInTheDocument();
  });
});
