import type { Locator, Page } from '@playwright/test';
import type { PublicScenarioDTO } from '../shared/domain/api.ts';
import { formatEstimate } from '../shared/domain/duration.ts';
import {
  CALL_STAGE_LABELS,
  CURVEBALL_LABELS,
  DIFFICULTIES,
  DIMENSIONS,
  IMPACT_LABELS,
  PROFICIENCY_LABELS,
  START_TEMPERATURE_LABELS,
} from '../shared/domain/vocab.ts';
import { expect, test } from './support/fixtures.ts';
import { settled } from './support/page-probes.ts';
import {
  cardOrder,
  countText,
  emptyFilter,
  leakedSecrets,
  libraryCount,
  libraryScenario,
  libraryScenarios,
  libraryWhere,
  scenarioNoun,
  timeoutFor,
} from './support/scenario-library.ts';

// Choosing a scenario, setting up the call, and reading the case brief. The workspace is one page in
// three areas: the product rail, a carousel of the scenarios it leaves, and the details of the chosen
// one (what it is on the left, how to run it and "Start configuration" on the right). What is chosen
// lives in the address, so a view can be shared and survives a refresh. How the carousel itself
// behaves (keys, dragging, touch, the peek, themes) is in carousel.spec.ts.
//
// How many scenarios there are, how many of a product or a difficulty, and which card comes first are
// read from the library (support/scenario-library.ts), never typed: the library grows.

const MARCUS = 'outlook-shared-mailbox-missing'; // starter, first contact, calm, terse, novice
const EXCHANGE = 'exchange-mail-delays-follow-up'; // standard, a follow-up with an earlier contact
const RETIRED = 'locked-out-after-password-reset'; // a scenario of the old library, which is gone

const productLine = (scenario: PublicScenarioDTO) =>
  [scenario.product.name, scenario.product.area].filter(Boolean).join(' \u00b7 ');

/** The card's line under its title: the impact, the mood and the call stage the scenario starts as. */
const STAGE_WORDS = {
  'first-contact': 'First contact',
  'follow-up': 'Follow-up',
  escalated: 'Escalated',
  closure: 'Closure',
} as const;
const metaLine = (scenario: PublicScenarioDTO) =>
  [
    `${IMPACT_LABELS[scenario.impact].label} impact`,
    START_TEMPERATURE_LABELS[scenario.startingTemperature].label.split(/[\s/]/)[0],
    STAGE_WORDS[scenario.callStage],
  ].join(' \u00b7 ');

/** The name of a rail chip or a filter option that would show `n` scenarios: its label, then the count. */
const withCount = (label: string, n: number) => new RegExp(`^${label}\\b.*\\b${scenarioNoun(n)}$`);

/** What a card calls a scenario: the short title. It is also the name of the card's radio button. */
const cardName = (scenario: Pick<PublicScenarioDTO, 'title' | 'shortTitle'>) =>
  scenario.shortTitle.trim() ? scenario.shortTitle : scenario.title;

/** The scenario count under the heading, which is a polite status. */
const count = (page: Page) =>
  page
    .getByRole('main')
    .getByRole('status')
    .filter({ hasText: /\bscenarios?$/ });

/** The carousel of cards: a region named "Scenarios". */
const gallery = (page: Page) => page.getByRole('region', { name: 'Scenarios', exact: true });
const rail = (page: Page) => page.getByRole('group', { name: 'Product', exact: true });
const difficulty = (page: Page) => page.getByRole('group', { name: 'Difficulty', exact: true });

/** The card of a scenario: the radio that chooses it is inside. */
const cardOf = (page: Page, scenario: Pick<PublicScenarioDTO, 'id'>): Locator =>
  page.locator(`[data-scenario="${scenario.id}"]`);
const radioOf = (page: Page, scenario: Pick<PublicScenarioDTO, 'title' | 'shortTitle'>): Locator =>
  gallery(page).getByRole('radio', { name: cardName(scenario), exact: true });

/** The details of the chosen scenario, a region named by the scenario's title. */
const paneFor = (page: Page, scenario: Pick<PublicScenarioDTO, 'title'>): Locator =>
  page.getByRole('region', { name: scenario.title, exact: true });

/** What a fact says in the details: the text that follows its term. */
const fact = (pane: Locator, term: string): Locator =>
  pane
    .getByRole('term')
    .filter({ hasText: new RegExp(`^${term}$`) })
    .locator('xpath=following-sibling::dd[1]');

/**
 * Opens the workspace and waits until it has settled: the list is loaded and the address has caught
 * up with the scenario it chose. A choice made in the same instant the list arrives can be overwritten
 * by that tidying of the address, which no person can do but a script can, so the journeys start from
 * the settled page.
 */
async function openWorkspace(page: Page, search = '') {
  await page.goto(`/scenarios${search}`);
  await expect(count(page)).toBeVisible();
  await expect(page).toHaveURL(/[?&]scenario=/);
}

/**
 * What a thumb has to find on the page (inside `main`: the shell's header and footer are not this
 * page's) that is under `min` px either way. A radio or a checkbox is drawn by what it sits in, so
 * the box of its option, or its label, is the one measured.
 */
async function smallTargets(page: Page, min: number): Promise<string[]> {
  return page.evaluate((limit) => {
    const found: string[] = [];
    const controls = document.querySelectorAll<HTMLElement>(
      'main a[href], main button, main select, main summary, main input:not([type="hidden"])',
    );
    for (const control of controls) {
      if (control.closest('[hidden], .visually-hidden') || !control.checkVisibility()) continue;
      let box = control.getBoundingClientRect();
      if (control.matches('input[type="radio"], input[type="checkbox"]') && box.width < 2) {
        box = (control.closest('label') ?? control).getBoundingClientRect();
      }
      if (box.width === 0 || box.height === 0 || Math.min(box.width, box.height) >= limit) continue;
      const name = control.getAttribute('aria-label') ?? control.textContent ?? '';
      found.push(
        `${control.tagName.toLowerCase()} "${name.replace(/\s+/g, ' ').trim().slice(0, 30)}" ${Math.round(box.width)}x${Math.round(box.height)}`,
      );
    }
    return found;
  }, min);
}

test.describe('choose a scenario', () => {
  test('the library is one carousel of cards with the product, the short title, how it starts, the time and the level, and the first is chosen', async ({
    page,
    api,
  }) => {
    const scenarios = await api.scenarios();
    const total = libraryCount();
    expect(scenarios, 'the server lists every scenario of the library').toHaveLength(total);
    await openWorkspace(page);
    await expect(page).toHaveTitle('Scenarios \u00b7 Firefly');
    await expect(page.getByRole('heading', { level: 1, name: 'Scenarios' })).toBeVisible();

    await test.step('the count, and one card with one radio button for each scenario', async () => {
      await expect(count(page)).toHaveText(countText(total));
      await expect(gallery(page).getByRole('radio')).toHaveCount(total);
      await expect(gallery(page).getByRole('listitem')).toHaveCount(total);
      for (const scenario of scenarios) {
        const card = cardOf(page, scenario);
        await expect(
          card.getByRole('radio', { name: cardName(scenario), exact: true }),
        ).toBeAttached();
        // The product is said in a short name that the full name contains ("Teams", "Windows").
        const product = (await card.locator('.scn-card__product').innerText()).trim();
        expect(product.length, `${scenario.id} has a product name`).toBeGreaterThan(0);
        expect(scenario.product.name).toContain(product);
        await expect(card.locator('.scn-card__meta')).toHaveText(
          /^(Low|Medium|High) impact \u00b7 \S.* \u00b7 (First contact|Follow-up|Escalated|Closure)$/,
        );
        await expect(card).toContainText(formatEstimate(scenario.estimatedMinutes));
        // The level is said in words as well as in bars.
        await expect(card).toContainText(
          scenario.difficulty.charAt(0).toUpperCase() + scenario.difficulty.slice(1),
        );
        // A card is quick to scan: no summary, only a title of a few words.
        expect(
          cardName(scenario).split(/\s+/).length,
          `${scenario.id}: title length`,
        ).toBeLessThanOrEqual(6);
        await expect(card).not.toContainText(scenario.listSummary);
      }
    });

    await test.step('the first scenario is "Selected" in words, the others invite "Use scenario"', async () => {
      // The cards are laid out by product, then easiest first, then title: the first one is chosen.
      const first = scenarios.find((scenario) => scenario.id === cardOrder()[0]?.id);
      expect(first, 'the server lists the scenario that comes first').toBeDefined();
      const chosen = first as PublicScenarioDTO;
      await expect(radioOf(page, chosen)).toBeChecked();
      await expect(cardOf(page, chosen)).toContainText('Selected');
      await expect(cardOf(page, chosen).locator('.scn-card__meta')).toHaveText(metaLine(chosen));
      await expect(gallery(page).getByRole('radio', { checked: true })).toHaveCount(1);
      await expect(page.locator('[data-scenario]:not([data-selected])').first()).toContainText(
        'Use scenario',
      );
    });

    await test.step('the product rail: All and a chip for each product, each with how many it would show', async () => {
      const chips = rail(page).getByRole('radio');
      const products = new Set(scenarios.map((scenario) => scenario.product.id));
      await expect(chips).toHaveCount(products.size + 1);
      await expect(chips.first()).toHaveAccessibleName(withCount('All', total));
      await expect(chips.first()).toBeChecked();
      // Power Platform has a scenario, and the rail puts it last.
      await expect(chips.last()).toHaveAccessibleName(/^Power Platform\b/);
      for (const [label, product] of [
        ['Windows', 'windows-11'],
        ['Teams', 'teams'],
      ] as const) {
        const own = libraryWhere({ product }).length;
        await expect(
          rail(page).getByRole('radio', { name: withCount(label, own) }),
          `${label} would show ${own}`,
        ).toBeAttached();
      }
    });

    await test.step('the difficulty filter, with the number of scenarios each choice would show', async () => {
      await expect(difficulty(page).getByRole('radio', { name: /^All\b/ })).toBeChecked();
      for (const level of DIFFICULTIES) {
        const own = libraryWhere({ difficulty: level }).length;
        const label = level.charAt(0).toUpperCase() + level.slice(1);
        await expect(
          difficulty(page).getByRole('radio', { name: withCount(label, own) }),
          `${label} would show ${own}`,
        ).toBeAttached();
      }
    });

    await test.step('there is no issue-type filter any more', async () => {
      await expect(page.getByRole('combobox', { name: 'Issue type' })).toHaveCount(0);
      await expect(page.getByRole('combobox', { name: 'Product' })).toHaveCount(0);
    });

    await test.step('the details of the first scenario are below the carousel, and nothing else is hidden away', async () => {
      const chosen = scenarios.find(
        (scenario) => scenario.id === cardOrder()[0]?.id,
      ) as PublicScenarioDTO;
      const pane = paneFor(page, chosen);
      await expect(pane.getByRole('heading', { level: 2, name: chosen.title })).toBeVisible();
      await expect(pane).toContainText(productLine(chosen));
      for (const term of [
        'Issue',
        'Business impact',
        'Customer',
        'Customer state',
        'Call stage',
        'Difficulty',
        'Estimated duration',
        'Coaching focus',
      ]) {
        await expect(
          pane.getByRole('term').filter({ hasText: new RegExp(`^${term}$`) }),
        ).toHaveCount(1);
      }
      await expect(fact(pane, 'Issue')).toHaveText(chosen.publicBrief.issue);
      await expect(fact(pane, 'Business impact')).toContainText(IMPACT_LABELS[chosen.impact].label);
      await expect(fact(pane, 'Customer')).toContainText(chosen.persona.name);
      await expect(fact(pane, 'Customer')).toContainText(
        `${chosen.persona.role}, ${chosen.persona.organisation}`,
      );
      await expect(fact(pane, 'Customer')).toContainText('Synthetic customer');
      await expect(fact(pane, 'Estimated duration')).toContainText(
        formatEstimate(chosen.estimatedMinutes),
      );
      for (const id of chosen.coachingFocus) {
        await expect(fact(pane, 'Coaching focus')).toContainText(DIMENSIONS[id].label);
      }
      // The way to set it up: a preset, a practice mode, and the rest behind "Customise".
      await expect(pane.getByRole('group', { name: 'Preset' })).toBeVisible();
      await expect(pane.getByRole('group', { name: 'Practice mode' })).toBeVisible();
      await expect(pane.getByRole('button', { name: /^Customise/ })).toHaveAttribute(
        'aria-expanded',
        'false',
      );
      await expect(pane.getByRole('link', { name: 'Start configuration' })).toHaveAttribute(
        'href',
        new RegExp(`^/scenarios/${chosen.id}/brief`),
      );
      await expect(pane.getByRole('link', { name: 'Review brief' })).toHaveCount(0);
    });
  });

  test('choosing another scenario shows its details and records the choice in the address', async ({
    page,
    api,
  }) => {
    const scenarios = await api.scenarios();
    const other = scenarios.find((scenario) => scenario.id === MARCUS) as PublicScenarioDTO;
    await openWorkspace(page);
    await radioOf(page, other).check();

    await expect(
      paneFor(page, other).getByRole('heading', { level: 2, name: other.title }),
    ).toBeVisible();
    await expect(paneFor(page, other)).toContainText(other.persona.name);
    await expect.poll(() => new URL(page.url()).searchParams.get('scenario')).toBe(other.id);
    await expect(radioOf(page, other)).toBeChecked();
    await expect(cardOf(page, other)).toContainText('Selected');
    await expect(gallery(page).getByRole('radio', { checked: true })).toHaveCount(1);
    // It opens with its own settings: its own difficulty is the preset, and nothing is marked changed.
    await expect(
      paneFor(page, other)
        .getByRole('group', { name: 'Preset' })
        .getByRole('radio', { name: 'Starter' }),
    ).toBeChecked();
    await expect(
      paneFor(page, other).getByRole('button', { name: /^Customise/ }),
    ).toHaveAccessibleName('Customise');
  });

  test('has no search box: an old search link opens the whole library', async ({ page }) => {
    await page.goto('/scenarios?q=checkout');
    await expect(count(page)).toHaveText(countText(libraryCount()));
    await expect(page.getByRole('searchbox')).toHaveCount(0);
    await expect(gallery(page).getByRole('radio')).toHaveCount(libraryCount());
    // The address is tidied to what the workspace understands.
    await expect.poll(() => new URL(page.url()).searchParams.get('q')).toBeNull();
  });

  test('an old link with an issue-type filter still opens, shows the whole library and drops the filter', async ({
    page,
  }) => {
    await page.goto('/scenarios?f_issue=permissions');
    await expect(count(page)).toHaveText(countText(libraryCount()));
    await expect(gallery(page).getByRole('radio')).toHaveCount(libraryCount());
    await expect.poll(() => new URL(page.url()).searchParams.get('f_issue')).toBeNull();
  });

  test('the rail and the difficulty each keep exactly the scenarios that match, they combine, and Clear filters brings everything back', async ({
    page,
    api,
  }) => {
    const scenarios = await api.scenarios();
    const total = scenarios.length;
    await openWorkspace(page);
    const counted = async (expected: PublicScenarioDTO[]) => {
      await expect(count(page)).toHaveText(countText(expected.length, total));
      await expect(gallery(page).getByRole('radio')).toHaveCount(expected.length);
    };

    await test.step('product', async () => {
      await rail(page)
        .getByRole('radio', { name: /^Windows\b/ })
        .check();
      await counted(scenarios.filter((scenario) => scenario.product.id === 'windows-11'));
      await expect.poll(() => new URL(page.url()).searchParams.get('f_product')).toBe('windows-11');
      // A scenario that is filtered out is not the chosen one: the first that remains is.
      await expect(gallery(page).getByRole('radio', { checked: true })).toHaveCount(1);
      await expect(rail(page).getByRole('radio', { name: /^Windows\b/ })).toBeChecked();
    });

    await test.step('difficulty, with the product still chosen', async () => {
      await rail(page)
        .getByRole('radio', { name: /^Azure\b/ })
        .check();
      await difficulty(page)
        .getByRole('radio', { name: /^Challenge/ })
        .check();
      await counted(
        scenarios.filter(
          (scenario) => scenario.difficulty === 'challenge' && scenario.product.id === 'azure',
        ),
      );
      await expect
        .poll(() => new URL(page.url()).searchParams.get('f_difficulty'))
        .toBe('challenge');
      await expect(page.getByRole('button', { name: 'Clear filters' })).toBeVisible();
    });

    await test.step('Clear filters puts all of them back and leaves focus on "All" in the rail', async () => {
      await page.getByRole('button', { name: 'Clear filters' }).click();
      await counted(scenarios);
      await expect(rail(page).getByRole('radio', { name: /^All\b/ })).toBeChecked();
      await expect(rail(page).getByRole('radio', { name: /^All\b/ })).toBeFocused();
      await expect(difficulty(page).getByRole('radio', { name: /^All\b/ })).toBeChecked();
      await expect
        .poll(() =>
          [...new URL(page.url()).searchParams.keys()].filter((key) => key.startsWith('f_')),
        )
        .toEqual([]);
      await expect(page.getByRole('button', { name: 'Clear filters' })).toHaveCount(0);
    });
  });

  test('a filter that leaves nothing says so, and Clear filters is there', async ({ page }) => {
    // A product and a difficulty that no scenario has both of: which pair it is depends on the library.
    const empty = emptyFilter();
    await page.goto(`/scenarios?f_product=${empty.product}&f_difficulty=${empty.difficulty}`);
    await expect(page.getByRole('heading', { level: 2, name: 'No scenarios match' })).toBeVisible();
    await expect(count(page)).toHaveText(countText(0));
    await expect(page.getByText('No scenario selected')).toBeVisible();
    await page.getByRole('button', { name: 'Clear filters' }).first().click();
    await expect(count(page)).toHaveText(countText(libraryCount()));
    await expect(gallery(page).getByRole('radio')).toHaveCount(libraryCount());
  });

  test('a link to a scenario that has been retired says so once and shows the library', async ({
    page,
  }) => {
    await page.goto(`/scenarios?scenario=${RETIRED}`);
    await expect(count(page)).toHaveText(countText(libraryCount()));
    const notice = page.getByText('That scenario is no longer in the library. Choose another.');
    await expect(notice).toBeVisible();
    // The first scenario is chosen instead, and the address says so.
    await expect(gallery(page).getByRole('radio', { checked: true })).toHaveCount(1);
    await expect.poll(() => new URL(page.url()).searchParams.get('scenario')).not.toBe(RETIRED);
    await page.getByRole('button', { name: 'Dismiss' }).click();
    await expect(notice).toHaveCount(0);
  });

  test('there is no history: a profile with a finished call and an open one sees the same list, with nothing recent and nothing in progress', async ({
    page,
    api,
  }) => {
    await api.completedCall();
    await api.createCall({ scenarioId: EXCHANGE });
    await openWorkspace(page);
    await expect(count(page)).toHaveText(countText(libraryCount()));
    await expect(page.getByRole('button', { name: /recent calls|history/i })).toHaveCount(0);
    await expect(page.getByRole('link', { name: /recent calls|history|view report/i })).toHaveCount(
      0,
    );
    await expect(
      page.getByText(/call in progress|resume (your )?call|continue (your )?call/i),
    ).toHaveCount(0);
    // The page asks the server for the library and for nothing that belongs to the profile.
    const asked: string[] = [];
    page.on('request', (request) => asked.push(new URL(request.url()).pathname));
    await page.reload();
    await expect(count(page)).toBeVisible();
    expect(asked.filter((path) => path.startsWith('/api/sessions'))).toEqual([]);
  });
});

test.describe('set up the call', () => {
  test('the preset, the practice mode and every setting update the summary, mark what was changed, and travel in the address and the link to the brief', async ({
    page,
    api,
  }) => {
    const scenarios = await api.scenarios();
    const scenario = scenarios.find((item) => item.id === MARCUS) as PublicScenarioDTO;
    await openWorkspace(page, `?scenario=${MARCUS}`);
    const pane = paneFor(page, scenario);
    const customise = pane.getByRole('button', { name: /^Customise/ });
    const summary = pane.locator('.scn-detail__summary-line');
    const changed = pane.locator('.scn-cf__changed');
    const reset = pane.getByRole('button', { name: 'Reset to scenario defaults' });
    const preset = (name: string) =>
      pane.getByRole('group', { name: 'Preset' }).getByRole('radio', { name });
    const practice = (name: RegExp) =>
      pane.getByRole('group', { name: 'Practice mode' }).getByRole('radio', { name });

    await test.step('it starts as the scenario was written, with nothing marked as changed', async () => {
      await expect(preset('Starter')).toBeChecked();
      await expect(summary).toContainText('Starter');
      await expect(summary).toContainText('Low impact');
      await expect(summary).toContainText('Calm');
      await customise.click();
      await expect(customise).toHaveAttribute('aria-expanded', 'true');
      await expect(changed).toHaveCount(0);
      await expect(reset).toHaveAttribute('aria-disabled', 'true');
      // A starter call is guided practice, as its own default.
      await expect(practice(/^Guided practice/)).toBeChecked();
      await expect(summary).toContainText('Guided practice');
    });

    await test.step('the preset, and the practice mode that goes with it', async () => {
      await preset('Challenge').check();
      await expect(summary).toContainText('Challenge');
      // The practice mode follows the preset: a challenge call has no tips on screen.
      await expect(practice(/^Assessment practice/)).toBeChecked();
      await expect(summary).toContainText('Assessment practice');
      await pane.getByRole('button', { name: 'About presets' }).click();
      await expect(pane.getByText(/High pressure, incomplete first information/)).toBeVisible();
    });

    await test.step('impact', async () => {
      await pane
        .getByRole('group', { name: /^Impact/ })
        .getByRole('radio', { name: IMPACT_LABELS.high.label })
        .check();
      await expect(summary).toContainText('High impact');
      await expect(fact(pane, 'Business impact')).toContainText(IMPACT_LABELS.high.label);
    });

    await test.step('starting state', async () => {
      await pane
        .getByRole('group', { name: /^Starting state/ })
        .getByRole('radio', { name: 'Angry' })
        .check();
      await expect(summary).toContainText(START_TEMPERATURE_LABELS.angry.label.split(/[\s/]/)[0]!);
      await expect(fact(pane, 'Customer state')).toContainText('Angry');
    });

    await test.step('proficiency', async () => {
      await pane
        .getByRole('group', { name: /^Proficiency/ })
        .getByRole('radio', { name: PROFICIENCY_LABELS.expert.label })
        .check();
    });

    await test.step('style', async () => {
      await pane.getByRole('combobox', { name: 'Style' }).selectOption('talkative');
      await expect(pane.getByRole('combobox', { name: 'Style' })).toHaveValue('talkative');
    });

    await test.step('call stage', async () => {
      await pane.getByRole('combobox', { name: 'Call stage' }).selectOption('follow-up');
      await expect(fact(pane, 'Call stage')).toHaveText(/follow-up/i);
    });

    await test.step('complications: choose one, and the page says how many, never which', async () => {
      await pane
        .getByRole('group', { name: /^Complications/ })
        .getByRole('radio', { name: 'Choose' })
        .check();
      await pane.getByRole('checkbox', { name: CURVEBALL_LABELS['ask-manager'].label }).check();
      await expect(pane.getByText(/1 of 2 chosen/)).toBeVisible();
      await expect(summary).not.toContainText(CURVEBALL_LABELS['ask-manager'].label);
      await expect(pane.locator('.scn-facts')).not.toContainText(
        CURVEBALL_LABELS['ask-manager'].label,
      );
    });

    await test.step('practice mode: assessment is the default for a challenge call, guided practice is one press away', async () => {
      await expect(practice(/^Assessment practice/)).toBeChecked();
      await practice(/^Guided practice/).check();
      await expect(practice(/^Guided practice/)).toBeChecked();
      await expect(summary).toContainText('Guided practice');
    });

    await test.step('every setting that was changed says so, in words, and the disclosure counts them', async () => {
      await expect(changed).toHaveCount(6);
      await expect(customise).toContainText('6 changed');
      await expect(reset).not.toHaveAttribute('aria-disabled', 'true');
    });

    await test.step('the link to the brief carries every setting', async () => {
      const link = pane.getByRole('link', { name: 'Start configuration' });
      const href = new URL((await link.getAttribute('href')) ?? '', page.url());
      expect(href.pathname).toBe(`/scenarios/${MARCUS}/brief`);
      expect(Object.fromEntries(href.searchParams)).toEqual({
        difficulty: 'challenge',
        impact: 'high',
        temperature: 'angry',
        proficiency: 'expert',
        style: 'talkative',
        stage: 'follow-up',
        curveballs: 'ask-manager',
        hints: 'on',
      });
    });

    await test.step('the workspace address keeps the choices, so a reload does not lose them', async () => {
      await expect
        .poll(() => new URL(page.url()).searchParams.get('curveballs'))
        .toBe('ask-manager');
      await page.reload();
      await expect(count(page)).toBeVisible();
      const again = paneFor(page, scenario);
      await expect(
        again.getByRole('group', { name: 'Preset' }).getByRole('radio', { name: 'Challenge' }),
      ).toBeChecked();
      await expect(
        again.getByRole('group', { name: 'Practice mode' }).getByRole('radio', { name: /^Guided/ }),
      ).toBeChecked();
      await expect(again.getByRole('button', { name: /^Customise/ })).toContainText('6 changed');
    });

    await test.step('Reset to scenario defaults puts everything back', async () => {
      await pane.getByRole('button', { name: /^Customise/ }).click();
      await pane.getByRole('button', { name: 'Reset to scenario defaults' }).click();
      await expect(preset('Starter')).toBeChecked();
      await expect(practice(/^Guided practice/)).toBeChecked();
      await expect(pane.locator('.scn-cf__changed')).toHaveCount(0);
      await expect(summary).toContainText('Low impact');
      const href = new URL(
        (await pane.getByRole('link', { name: 'Start configuration' }).getAttribute('href')) ?? '',
        page.url(),
      );
      expect([...href.searchParams.keys()]).toEqual([]);
    });
  });

  test('a lower preset trims the complications it does not allow, and says so', async ({
    page,
    api,
  }) => {
    const scenarios = await api.scenarios();
    const scenario = scenarios.find((item) => item.id === MARCUS) as PublicScenarioDTO;
    await openWorkspace(
      page,
      `?scenario=${MARCUS}&difficulty=challenge&curveballs=ask-manager,go-silent`,
    );
    const pane = paneFor(page, scenario);
    await pane
      .getByRole('group', { name: 'Preset' })
      .getByRole('radio', { name: 'Starter' })
      .check();
    await expect(
      pane.getByText(/Starter allows one complication\. Removed: .*Kept: /),
    ).toBeVisible();
    await expect.poll(() => new URL(page.url()).searchParams.get('curveballs')).toBe('ask-manager');
  });

  test('the two practice modes are named and explained, and choosing the one the preset does not give is a change that the address records', async ({
    page,
    api,
  }) => {
    const scenarios = await api.scenarios();
    const scenario = scenarios.find((item) => item.id === EXCHANGE) as PublicScenarioDTO;
    await openWorkspace(page, `?scenario=${EXCHANGE}`);
    const pane = paneFor(page, scenario);
    const modes = pane.getByRole('group', { name: 'Practice mode' });
    await expect(modes.getByRole('radio')).toHaveCount(2);
    await expect(modes).toContainText('Guided practice');
    await expect(modes).toContainText('Shows short tips and light cues during the call.');
    await expect(modes).toContainText('Assessment practice');
    await expect(modes).toContainText('No tips or cues on screen. Feels like a real call.');
    // The old on/off switch is gone.
    await expect(pane.getByRole('switch')).toHaveCount(0);
    await expect(pane.getByText('Live hints')).toHaveCount(0);

    // Standard is assessment by default; choosing guided is a change, and the address says so.
    await expect(modes.getByRole('radio', { name: /^Assessment practice/ })).toBeChecked();
    await modes.getByRole('radio', { name: /^Guided practice/ }).check();
    await expect.poll(() => new URL(page.url()).searchParams.get('hints')).toBe('on');
    // Choosing the default again takes the choice out of the address.
    await modes.getByRole('radio', { name: /^Assessment practice/ }).check();
    await expect.poll(() => new URL(page.url()).searchParams.get('hints')).toBeNull();
  });
});

test.describe('the case brief', () => {
  const CONFIGURED =
    'difficulty=challenge&impact=high&temperature=angry&proficiency=expert&style=talkative&stage=escalated&curveballs=none';

  test('has exactly six rows, optional detail behind disclosures, and the voice, the microphone and the three ways to start beside them', async ({
    page,
    api,
  }) => {
    const scenarios = await api.scenarios();
    const scenario = scenarios.find((item) => item.id === MARCUS) as PublicScenarioDTO;
    await page.goto(`/scenarios/${MARCUS}/brief`);
    await expect(page).toHaveTitle(`Case brief: ${scenario.title} \u00b7 Firefly`);
    await expect(page.getByRole('heading', { level: 1, name: 'Case brief' })).toBeVisible();
    await expect(page.getByText(scenario.title).first()).toBeVisible();
    await expect(page.getByText('Synthetic scenario', { exact: true })).toBeVisible();

    await test.step('the header carries the product, and the practice mode in its own name and a plain sentence', async () => {
      await expect(page.locator('.brf-head')).toContainText(productLine(scenario));
      await expect(page.locator('.brf-mode')).toHaveText(
        'Guided practice. Short tips appear during the call.',
      );
    });

    const caseFile = page.getByRole('region', { name: 'Support case' });
    await test.step('the case is six rows', async () => {
      await expect(caseFile.getByRole('term')).toHaveText([
        'Customer',
        'Product',
        'Issue',
        'Impact',
        'Call stage',
        'Objective',
      ]);
      await expect(caseFile).toContainText(scenario.persona.name);
      await expect(caseFile).toContainText(
        `${scenario.persona.role}, ${scenario.persona.organisation}`,
      );
      await expect(caseFile).toContainText(productLine(scenario));
      await expect(caseFile).toContainText(scenario.publicBrief.issue);
      await expect(caseFile).toContainText(scenario.publicBrief.impact[scenario.impact]);
      await expect(caseFile).toContainText(CALL_STAGE_LABELS[scenario.callStage].label);
      await expect(caseFile).toContainText(scenario.publicBrief.objective);
    });

    await test.step('known context and environment open on request, and stay closed until then', async () => {
      for (const name of ['Known context', 'Environment']) {
        const toggle = caseFile.getByRole('button', { name, exact: true });
        await expect(toggle).toHaveAttribute('aria-expanded', 'false');
      }
      // A first contact has no earlier contact to read about.
      await expect(caseFile.getByRole('button', { name: 'Previous contact' })).toHaveCount(0);
      const context = caseFile.getByText(scenario.publicBrief.knownContext as string);
      await expect(context).toBeHidden();
      await caseFile.getByRole('button', { name: 'Known context', exact: true }).click();
      await expect(context).toBeVisible();
    });

    await test.step('the side card: the customer voice, the microphone and the ways to start', async () => {
      const side = page.getByRole('complementary', { name: 'Voice call' });
      const voices = side.getByRole('combobox', { name: 'Customer voice' });
      await expect(voices.locator('option')).toHaveText([
        'Voice A - Warm',
        'Voice B - Direct',
        'Voice C - Measured',
        'Voice D - Concise',
      ]);
      await expect(side.getByRole('button', { name: 'Test voice' })).toBeVisible();
      // The microphone line says what is known, and the check is optional.
      await expect(side.getByRole('status').filter({ hasText: /microphone/i })).toBeVisible();
      await expect(side.getByRole('button', { name: 'Check microphone' })).toBeVisible();
      await expect(side.getByRole('button', { name: 'Start voice call' })).toBeEnabled();
      await expect(side.getByRole('link', { name: 'Edit scenario' })).toHaveAttribute(
        'href',
        new RegExp(`^/scenarios\\?scenario=${MARCUS}`),
      );
      await expect(side.getByRole('button', { name: 'Start a text-only call' })).toBeEnabled();
      // Demo speech says plainly that the customer does not really speak.
      await expect(side).toContainText('Demo speech');
    });
  });

  test('shows what was chosen, not what the scenario says by default, and says when a setting in the link cannot be used', async ({
    page,
  }) => {
    await page.goto(`/scenarios/${EXCHANGE}/brief?difficulty=challenge&impact=sky-high`);
    const caseFile = page.getByRole('region', { name: 'Support case' });
    await expect(page.getByRole('heading', { level: 1, name: 'Case brief' })).toBeVisible();
    // The impact in the link is not one of the three, so the scenario's own is used and the page says so.
    await expect(
      page.getByText(
        /Some settings in this link could not be used, so the scenario's own are used: Impact\./,
      ),
    ).toBeVisible();
    await expect(caseFile).toContainText(IMPACT_LABELS.medium.label);

    await page.goto(`/scenarios/${EXCHANGE}/brief?${CONFIGURED}`);
    await test.step('the chosen impact and stage', async () => {
      await expect(caseFile).toContainText(IMPACT_LABELS.high.label);
      await expect(caseFile).toContainText(CALL_STAGE_LABELS.escalated.label);
      await expect(caseFile).toContainText(/Case SIM-\d+/);
    });
    await test.step('the practice mode is the one the preset gives, or the one that was chosen', async () => {
      await expect(page.locator('.brf-mode')).toHaveText('Assessment practice. No tips on screen.');
      await page.goto(`/scenarios/${EXCHANGE}/brief?${CONFIGURED}&hints=on`);
      await expect(page.locator('.brf-mode')).toHaveText(
        'Guided practice. Short tips appear during the call.',
      );
    });
    await test.step('a call back has an earlier contact to read about', async () => {
      const previous = caseFile.getByRole('button', { name: 'Previous contact', exact: true });
      await expect(previous).toHaveAttribute('aria-expanded', 'false');
      await previous.click();
      await expect(previous).toHaveAttribute('aria-expanded', 'true');
    });
  });

  test('the first-use notice says what the microphone is for, has its details one press away, and goes once it has been read', async ({
    page,
  }) => {
    await page.goto(`/scenarios/${MARCUS}/brief`);
    const notice = page.getByRole('region', { name: 'Privacy notice' });
    await expect(notice).toContainText(
      'Firefly uses your microphone to transcribe this simulated call. Do not share real customer information.',
    );
    const details = notice.getByRole('button', { name: 'How your voice is handled' });
    await expect(details).toHaveAttribute('aria-expanded', 'false');
    await details.click();
    await expect(notice).toContainText('Your recording is discarded');
    await expect(notice).toContainText('No audio is saved');
    // Reading it opens nothing: the microphone has not been asked for.
    await notice.getByRole('button', { name: 'Got it' }).click();
    await expect(notice).toHaveCount(0);
    // The details stay available as a closed row, and the keyboard lands on it.
    await expect(page.getByRole('button', { name: 'How your voice is handled' })).toBeFocused();
    await page.reload();
    await expect(page.getByRole('region', { name: 'Privacy notice' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'How your voice is handled' })).toBeVisible();
  });

  test('the chosen voice is tried with "Test voice" and travels to the call', async ({
    page,
    api,
  }) => {
    await page.goto(`/scenarios/${MARCUS}/brief`);
    const side = page.getByRole('complementary', { name: 'Voice call' });
    const voices = side.getByRole('combobox', { name: 'Customer voice' });
    await voices.selectOption({ label: 'Voice B - Direct' });
    await expect.poll(() => new URL(page.url()).searchParams.get('voice')).toBe('voice-b');

    await test.step('a sample is asked for in that voice, and the microphone is not touched', async () => {
      const preview = page.waitForRequest(
        (request) =>
          request.method() === 'POST' &&
          new URL(request.url()).pathname === '/api/speech/preview' &&
          new URL(request.url()).searchParams.get('voice') === 'voice-b',
      );
      await side.getByRole('button', { name: 'Test voice' }).click();
      await preview;
      await expect(side.getByRole('button', { name: 'Test voice' })).toBeVisible();
    });

    await test.step('Start voice call opens the call with the voice in its address', async () => {
      await side.getByRole('button', { name: 'Start voice call' }).click();
      await expect(page).toHaveURL(/\/calls\/[^/?]+\?input=voice&voice=voice-b$/);
    });
    expect(api).toBeDefined();
  });

  test('sends the part of the day when a call is created, and the customer greets to match', async ({
    page,
  }) => {
    const bodies: Array<{ timeOfDay?: string }> = [];
    page.on('request', (request) => {
      if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/sessions') {
        bodies.push(request.postDataJSON() as { timeOfDay?: string });
      }
    });
    // Windows is a calm, talkative customer: the greeting names the part of the day.
    const scenario = 'windows-11-slow-after-update';

    await test.step('in the morning', async () => {
      await page.clock.setFixedTime(new Date(2026, 10, 21, 8, 15, 0));
      await page.goto(`/scenarios/${scenario}/brief`);
      await page.getByRole('button', { name: 'Start a text-only call' }).click();
      await expect(page).toHaveURL(/\/calls\/[^/?]+\?input=text/);
      expect(bodies.at(-1)?.timeOfDay).toBe('morning');
      await page.getByRole('button', { name: 'Start text call' }).click();
      await expect(page.getByRole('log', { name: 'Call transcript' })).toContainText(
        /good morning/i,
      );
    });

    await test.step('in the evening', async () => {
      await page.clock.setFixedTime(new Date(2026, 10, 21, 19, 30, 0));
      await page.goto(`/scenarios/${scenario}/brief`);
      await page.getByRole('button', { name: 'Start a text-only call' }).click();
      await expect(page).toHaveURL(/\/calls\/[^/?]+\?input=text/);
      expect(bodies.at(-1)?.timeOfDay).toBe('evening');
      await page.getByRole('button', { name: 'Start text call' }).click();
      await expect(page.getByRole('log', { name: 'Call transcript' })).toContainText(
        /good evening/i,
      );
    });
  });

  test('Edit scenario returns to the workspace with every choice intact', async ({ page, api }) => {
    const scenarios = await api.scenarios();
    const scenario = scenarios.find((item) => item.id === EXCHANGE) as PublicScenarioDTO;
    await page.goto(`/scenarios/${EXCHANGE}/brief?${CONFIGURED}`);

    await page.getByRole('link', { name: 'Edit scenario' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Scenarios' })).toBeVisible();

    const pane = paneFor(page, scenario);
    await expect(pane.getByRole('heading', { level: 2, name: scenario.title })).toBeVisible();
    await expect(radioOf(page, scenario)).toBeChecked();
    await expect(
      pane.getByRole('group', { name: 'Preset' }).getByRole('radio', { name: 'Challenge' }),
    ).toBeChecked();
    await pane.getByRole('button', { name: /^Customise/ }).click();
    await expect(
      pane.getByRole('group', { name: /^Impact/ }).getByRole('radio', { name: 'High' }),
    ).toBeChecked();
    await expect(
      pane.getByRole('group', { name: /^Starting state/ }).getByRole('radio', { name: 'Angry' }),
    ).toBeChecked();
    await expect(pane.getByRole('combobox', { name: 'Style' })).toHaveValue('talkative');
    await expect(pane.getByRole('combobox', { name: 'Call stage' })).toHaveValue('escalated');
    await expect(
      pane.getByRole('group', { name: /^Complications/ }).getByRole('radio', { name: 'Off' }),
    ).toBeChecked();

    // And on to the brief again: the address is the same.
    await pane.getByRole('link', { name: 'Start configuration' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Case brief' })).toBeVisible();
    expect(Object.fromEntries(new URL(page.url()).searchParams)).toEqual(
      Object.fromEntries(new URLSearchParams(CONFIGURED)),
    );
  });

  test('a scenario that does not exist, or has been retired, says so and offers the way back', async ({
    page,
    problems,
  }) => {
    problems.allow({ status: 404, url: '/api/scenarios/' });
    for (const id of ['not-a-real-scenario', RETIRED]) {
      await page.goto(`/scenarios/${id}/brief`);
      await expect(
        page.getByRole('heading', { level: 1, name: 'Scenario unavailable' }),
      ).toBeVisible();
      await expect(
        page.getByText('This scenario is no longer available. Nothing was started.'),
      ).toBeVisible();
    }
    await page.getByRole('link', { name: 'Choose a scenario' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Scenarios' })).toBeVisible();
  });

  test('puts the two ways to start in one block with the way back apart, the notice under the case, and the note beside the title, so the columns end about level', async ({
    page,
  }) => {
    await page.goto(`/scenarios/${MARCUS}/brief`);
    const side = page.getByRole('complementary', { name: 'Voice call' });
    const notice = page.getByRole('region', { name: 'Privacy notice' });
    await expect(notice).toBeVisible();

    const box = async (locator: Locator) => {
      const found = await locator.boundingBox();
      if (!found) throw new Error('The element has no box on screen.');
      return found;
    };
    await test.step('the main way to start, the typed one right under it, and the way back apart', async () => {
      const main = await box(side.getByRole('button', { name: 'Start voice call' }));
      const typed = await box(side.getByRole('button', { name: 'Start a text-only call' }));
      const back = await box(side.getByRole('link', { name: 'Edit scenario' }));
      const together = typed.y - (main.y + main.height);
      expect(together, 'the typed call comes right after the main one').toBeGreaterThanOrEqual(0);
      expect(together).toBeLessThan(12);
      expect(back.y - (typed.y + typed.height), 'the way back is further off').toBeGreaterThan(
        together,
      );
    });

    await test.step('the notice is under the case rows, in their column', async () => {
      await expect(side.getByRole('region', { name: 'Privacy notice' })).toHaveCount(0);
      const rows = await box(page.getByRole('region', { name: 'Support case' }));
      const under = await box(notice);
      expect(under.y).toBeGreaterThanOrEqual(rows.y + rows.height);
      expect(under.x).toBeCloseTo(rows.x, 0);
      // Neither column leaves the other a block of empty page.
      const left = under.y + under.height;
      const card = await box(side);
      expect(Math.abs(left - (card.y + card.height))).toBeLessThan(100);
    });

    await test.step('the note that the scenario is made up stands beside the title', async () => {
      const title = await box(page.getByRole('heading', { level: 1, name: 'Case brief' }));
      const note = await box(page.getByText('Synthetic scenario', { exact: true }));
      expect(note.x - (title.x + title.width)).toBeLessThan(40);
      expect(Math.abs(note.y + note.height / 2 - (title.y + title.height / 2))).toBeLessThan(12);
    });

    await test.step('the rules under the optional rows run from edge to edge of the card', async () => {
      const rows = await box(page.getByRole('region', { name: 'Support case' }));
      const known = await box(
        page.getByRole('region', { name: 'Support case' }).locator('.ff-disclosure--row').first(),
      );
      expect(known.x).toBeLessThanOrEqual(rows.x + 2);
      expect(known.x + known.width).toBeGreaterThanOrEqual(rows.x + rows.width - 2);
    });
  });
});

test.describe('a phone, 320 px wide', () => {
  test.use({ viewport: { width: 320, height: 640 }, hasTouch: true, isMobile: true });

  test('every control on the workspace is at least 40 px, the difficulty filter is four equal cells in one row, and the way on is the button alone', async ({
    page,
  }) => {
    await openWorkspace(page, `?scenario=${MARCUS}`);
    await page.getByRole('button', { name: /^Customise/ }).tap();

    await test.step('nothing is under 40 px, with the setup open', async () => {
      expect(await smallTargets(page, 40)).toEqual([]);
    });

    await test.step('the difficulty filter is one native group of four cells as wide as the column', async () => {
      await expect(difficulty(page).getByRole('radio')).toHaveCount(4);
      const cells = await difficulty(page)
        .locator('.ff-segmented__item')
        .evaluateAll((items) =>
          items.map((item) => {
            const { x, y, width, height } = item.getBoundingClientRect();
            return { x, y, width, height };
          }),
        );
      expect(new Set(cells.map((cell) => Math.round(cell.y))).size, 'one row').toBe(1);
      for (const cell of cells) expect(cell.height).toBeGreaterThanOrEqual(40);
      const widths = cells.map((cell) => cell.width);
      expect(Math.max(...widths) - Math.min(...widths), 'equal cells').toBeLessThan(1.5);
      const group = await difficulty(page).boundingBox();
      expect(group?.width, 'as wide as the column (320 less 16 each side)').toBeGreaterThan(280);
      const first = cells[0]!;
      const last = cells.at(-1)!;
      expect(last.x + last.width - first.x, 'the cells fill the group').toBeGreaterThan(
        (group?.width ?? 0) - 12,
      );
    });

    await test.step('the way on is the button alone, about 70 px high, and the words it would say are still there', async () => {
      const bar = page.locator('.scn-detail__bar');
      const barBox = await bar.boundingBox();
      expect(barBox?.height).toBeLessThan(80);
      const start = await bar.getByRole('link', { name: 'Start configuration' }).boundingBox();
      expect(start?.height).toBeGreaterThanOrEqual(44);
      expect(start?.width).toBeGreaterThan(280);
      const recap = bar.locator('.scn-detail__summary-line');
      await expect(recap).toContainText('Starter');
      expect(await recap.evaluate((line) => getComputedStyle(line).display)).not.toBe('none');
    });
  });

  test('every control on the brief is at least 40 px', async ({ page }) => {
    await page.goto(`/scenarios/${MARCUS}/brief`);
    await expect(page.getByRole('region', { name: 'Privacy notice' })).toBeVisible();
    expect(await smallTargets(page, 40)).toEqual([]);
  });
});

test.describe('nothing the customer keeps back is shown before it is asked for', () => {
  /** Opens every disclosure on the page, so what is folded away is read as well as what is shown. */
  async function openEverything(page: Page) {
    for (let round = 0; round < 3; round += 1) {
      const closed = page.locator('main button[aria-expanded="false"]:visible');
      const total = await closed.count();
      if (total === 0) return;
      // From the last to the first, so that opening one never moves the ones still to open.
      for (let index = total - 1; index >= 0; index -= 1) await closed.nth(index).click();
    }
  }

  test('the check can see a leak (a control, so that "nothing leaked" is not an empty result)', async () => {
    const first = libraryScenario(MARCUS);
    expect(first.secrets.length).toBeGreaterThan(4);
    expect(leakedSecrets(`Intro. ${first.secrets[0]} Outro.`, first.secrets)).toEqual([
      first.secrets[0],
    ]);
  });

  test('the brief of every scenario, with every disclosure open', async ({ page }) => {
    test.setTimeout(timeoutFor(10_000));
    for (const scenario of libraryScenarios()) {
      await test.step(scenario.title, async () => {
        // Guided practice is the brief that says the most; a call back has its earlier contact too.
        await page.goto(`/scenarios/${scenario.id}/brief?hints=on&stage=follow-up`);
        await expect(page.getByRole('region', { name: 'Support case' })).toBeVisible();
        await openEverything(page);
        const text = await page.locator('main').innerText();
        expect(text.length, 'the brief has text').toBeGreaterThan(200);
        expect(
          leakedSecrets(text, scenario.secrets),
          `The brief of "${scenario.title}" shows something the customer keeps back`,
        ).toEqual([]);
      });
    }
  });

  test('the carousel and the scenario details of every scenario, with the setup open', async ({
    page,
  }) => {
    test.setTimeout(timeoutFor(10_000));
    for (const scenario of libraryScenarios()) {
      await test.step(scenario.title, async () => {
        await openWorkspace(page, `?scenario=${scenario.id}`);
        const pane = paneFor(page, scenario);
        await expect(pane).toBeVisible();
        await pane.getByRole('button', { name: /^Customise/ }).click();
        const text = await pane.innerText();
        expect(text.length, 'the details have text').toBeGreaterThan(200);
        expect(
          leakedSecrets(text, scenario.secrets),
          `The details of "${scenario.title}" show something the customer keeps back`,
        ).toEqual([]);
        // The cards say little, and nothing that the customer keeps back.
        const cards = await gallery(page).innerText();
        expect(
          leakedSecrets(cards, scenario.secrets),
          `The cards beside "${scenario.title}" show something the customer keeps back`,
        ).toEqual([]);
      });
    }
  });
});

test.describe('motion', () => {
  /**
   * Notes each card as its arrival begins, from the first script on every page, so that no test has
   * to catch an animation in flight: the browser says when one starts, however slow the run.
   */
  const noteArrivals = (page: Page) =>
    page.addInitScript(() => {
      const noted: string[] = [];
      (window as unknown as { __arrived: string[] }).__arrived = noted;
      document.addEventListener(
        'animationstart',
        (event) => {
          if (event.animationName !== 'scn-card-arrive') return;
          const card = (event.target as Element).closest('[data-scenario]');
          noted.push(card?.getAttribute('data-scenario') ?? '');
        },
        true,
      );
    });
  const arrived = (page: Page) =>
    page.evaluate(() => (window as unknown as { __arrived: string[] }).__arrived.slice());

  test('a filter brings in only the cards it adds: the cards that stay do not move, and only the first few arrive', async ({
    page,
  }) => {
    const teams = libraryWhere({ product: 'teams' });
    const staying = new Set(teams.map((scenario) => scenario.id));
    await noteArrivals(page);
    await openWorkspace(page);
    await settled(page);

    const first = await arrived(page);
    await test.step('the first time there are cards, the first few arrive', async () => {
      expect(first.length, 'some cards arrive').toBeGreaterThan(0);
      expect(first.length, 'no more than eight arrive').toBeLessThanOrEqual(8);
    });

    await test.step('narrowing the row adds nothing, so nothing arrives', async () => {
      await rail(page)
        .getByRole('radio', { name: /^Teams\b/ })
        .check();
      await expect(gallery(page).getByRole('radio')).toHaveCount(teams.length);
      await expect(page.locator('.scn-card[data-arrive]')).toHaveCount(0);
      await settled(page);
      expect(await arrived(page)).toEqual(first);
    });

    await test.step('widening it again brings in the other cards, one after another, and not the ones that stayed', async () => {
      await rail(page)
        .getByRole('radio', { name: /^All\b/ })
        .check();
      await expect(gallery(page).getByRole('radio')).toHaveCount(libraryCount());
      const marked = await page.locator('.scn-card[data-arrive]').count();
      expect(marked, 'the new cards are marked').toBeGreaterThan(0);
      expect(marked, 'only the first eight arrive').toBeLessThanOrEqual(8);
      expect(marked).toBeLessThanOrEqual(libraryCount() - teams.length);
      for (const scenario of teams) {
        await expect(cardOf(page, scenario)).not.toHaveAttribute('data-arrive', /.*/);
      }
      // The browser really animated them (the stylesheet and the markup agree), each once, and never a card that stayed.
      await settled(page);
      const started = (await arrived(page)).slice(first.length);
      expect(started.length, 'the browser started their arrival').toBe(marked);
      expect(new Set(started).size, 'each card arrives once').toBe(started.length);
      for (const id of started) expect(staying.has(id), `${id} stayed`).toBe(false);
    });
  });

  test.describe('with reduced motion', () => {
    test.use({ reducedMotion: 'reduce' });

    test('shows every card at once: nothing arrives', async ({ page }) => {
      await noteArrivals(page);
      await openWorkspace(page);
      await expect(gallery(page).getByRole('radio')).toHaveCount(libraryCount());
      await rail(page)
        .getByRole('radio', { name: /^Teams\b/ })
        .check();
      await rail(page)
        .getByRole('radio', { name: /^All\b/ })
        .check();
      await expect(gallery(page).getByRole('radio')).toHaveCount(libraryCount());
      await settled(page);
      expect(await arrived(page)).toEqual([]);
    });
  });

  for (const motion of ['no-preference', 'reduce'] as const) {
    test(`the chosen card ${motion === 'reduce' ? 'does not rise when motion is reduced' : 'sits a little higher than the others'}`, async ({
      page,
    }) => {
      await page.emulateMedia({ reducedMotion: motion });
      await openWorkspace(page);
      await settled(page);
      /** How far a card is moved up the page by its transform, in pixels (0 for none). */
      const rise = (selector: string) =>
        page
          .locator(selector)
          .first()
          .evaluate((card) => {
            const value = getComputedStyle(card).transform;
            const numbers = value === 'none' ? [] : value.replace(/^matrix\(|\)$/g, '').split(',');
            return numbers.length === 6 ? -Number(numbers[5]) : 0;
          });
      const chosen = await rise('.scn-card[data-selected]');
      const other = await rise('.scn-card:not([data-selected])');
      expect(other, 'a card nobody points at is flat').toBeCloseTo(0);
      if (motion === 'reduce') expect(chosen).toBeCloseTo(0);
      else expect(chosen).toBeGreaterThan(0);
    });
  }
});
