import type { Locator, Page } from '@playwright/test';
import type { PublicScenarioDTO } from '../shared/domain/api.ts';
import {
  CALL_STAGE_LABELS,
  CURVEBALL_LABELS,
  IMPACT_LABELS,
  ISSUE_TYPE_LABELS,
  PROFICIENCY_LABELS,
  START_TEMPERATURE_LABELS,
  STYLE_LABELS,
} from '../shared/domain/vocab.ts';
import { expect, test } from './support/fixtures.ts';
import { leakedSecrets, libraryScenarios } from './support/scenario-library.ts';

// Choosing a scenario, setting up the call, and reading the case brief. The workspace is a split view:
// the product, issue type and difficulty filters and the list on the left, the chosen scenario on the
// right. What is chosen lives in the address, so a view can be shared and survives a refresh. (The
// narrow-screen version of the same workspace is walked in mobile.spec.ts.)

const MARCUS = 'outlook-shared-mailbox-missing'; // starter, first contact, calm, terse, novice
const EXCHANGE = 'exchange-mail-delays-follow-up'; // standard, a follow-up with an earlier contact
const RETIRED = 'locked-out-after-password-reset'; // a scenario of the old library, which is gone

const countText = (shown: number, total: number) =>
  shown === total ? `${total} scenarios` : `${shown} of ${total} scenarios`;

const productLine = (scenario: PublicScenarioDTO) =>
  [scenario.product.name, scenario.product.area].filter(Boolean).join(' \u00b7 ');

/** The scenario count under the heading, which is a polite status. */
const count = (page: Page) =>
  page
    .getByRole('main')
    .getByRole('status')
    .filter({ hasText: /\bscenarios?$/ });

const list = (page: Page) => page.getByRole('group', { name: 'Scenarios', exact: true });

/** The details of the chosen scenario, a region named by the scenario's title. */
const paneFor = (page: Page, scenario: Pick<PublicScenarioDTO, 'title'>): Locator =>
  page.getByRole('region', { name: scenario.title, exact: true });

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

test.describe('choose a scenario', () => {
  test('every scenario in the library is a row with its product, difficulty, title and summary, and the first is chosen', async ({
    page,
    api,
  }) => {
    const scenarios = await api.scenarios();
    expect(scenarios).toHaveLength(16);
    await openWorkspace(page);
    await expect(page).toHaveTitle('Scenarios \u00b7 Firefly');
    await expect(page.getByRole('heading', { level: 1, name: 'Scenarios' })).toBeVisible();

    await test.step('the count and one radio for each scenario', async () => {
      await expect(count(page)).toHaveText('16 scenarios');
      await expect(list(page).getByRole('radio')).toHaveCount(16);
      for (const scenario of scenarios) {
        const row = page.locator(`[data-scenario="${scenario.id}"]`);
        await expect(row.getByRole('radio', { name: scenario.title, exact: true })).toBeAttached();
        await expect(row).toContainText(productLine(scenario));
        await expect(row).toContainText(
          scenario.difficulty.charAt(0).toUpperCase() + scenario.difficulty.slice(1),
        );
        await expect(row).toContainText(scenario.listSummary);
      }
    });

    await test.step('the three filters, with the number of scenarios each choice would show', async () => {
      const product = page.getByRole('combobox', { name: 'Product' });
      await expect(product).toHaveValue('');
      // Products are grouped by family, each with its count.
      await expect(product.locator('optgroup')).toHaveCount(4);
      await expect(product.locator('optgroup').first()).toHaveAttribute('label', 'Microsoft 365');
      await expect(product.locator('option[value="windows-11"]')).toHaveText('Windows 11 (2)');
      const issue = page.getByRole('combobox', { name: 'Issue type' });
      await expect(issue).toHaveValue('');
      await expect(issue.locator('option[value="permissions"]')).toHaveText(
        `${ISSUE_TYPE_LABELS.permissions} (3)`,
      );
      const difficulty = page.getByRole('group', { name: 'Difficulty' });
      await expect(difficulty.getByRole('radio', { name: /^All\b/ })).toBeChecked();
      await expect(
        difficulty.getByRole('radio', { name: /^Starter\b.*4 scenarios$/ }),
      ).toBeVisible();
      await expect(
        difficulty.getByRole('radio', { name: /^Standard\b.*8 scenarios$/ }),
      ).toBeVisible();
      await expect(
        difficulty.getByRole('radio', { name: /^Challenge\b.*4 scenarios$/ }),
      ).toBeVisible();
    });

    await test.step('the first scenario is chosen, and its details are shown beside the list', async () => {
      const first = scenarios.find(
        (scenario) => scenario.id === 'teams-cannot-join-external-meetings',
      );
      expect(first, 'the library has the Teams scenario').toBeDefined();
      const chosen = first as PublicScenarioDTO;
      await expect(page.getByRole('radio', { name: chosen.title, exact: true })).toBeChecked();
      const pane = paneFor(page, chosen);
      await expect(pane.getByRole('heading', { level: 2, name: chosen.title })).toBeVisible();
      await expect(pane).toContainText(productLine(chosen));
      await expect(pane).toContainText(chosen.summary);
      for (const term of ['Impact', 'Call stage', 'Style', 'Duration']) {
        await expect(
          pane.getByRole('term').filter({ hasText: new RegExp(`^${term}$`) }),
        ).toHaveCount(1);
      }
      await expect(pane).toContainText(`About ${chosen.estimatedMinutes} min`);
      // The customer as the call starts.
      await expect(pane.getByRole('heading', { name: 'Starting state' })).toBeVisible();
      await expect(pane).toContainText(chosen.persona.name);
      await expect(pane).toContainText('Synthetic customer');
      await expect(pane.getByRole('group', { name: 'Preset' })).toBeVisible();
      await expect(pane.getByRole('button', { name: /^Customise/ })).toHaveAttribute(
        'aria-expanded',
        'false',
      );
      await expect(pane.getByRole('link', { name: 'Review brief' })).toHaveAttribute(
        'href',
        new RegExp(`^/scenarios/${chosen.id}/brief`),
      );
    });
  });

  test('choosing another scenario shows its details and records the choice in the address', async ({
    page,
    api,
  }) => {
    const scenarios = await api.scenarios();
    const other = scenarios.find((scenario) => scenario.id === MARCUS) as PublicScenarioDTO;
    await openWorkspace(page);
    await page.getByRole('radio', { name: other.title, exact: true }).check();

    await expect(
      paneFor(page, other).getByRole('heading', { level: 2, name: other.title }),
    ).toBeVisible();
    await expect(paneFor(page, other)).toContainText(other.persona.name);
    await expect.poll(() => new URL(page.url()).searchParams.get('scenario')).toBe(other.id);
    await expect(page.getByRole('radio', { name: other.title, exact: true })).toBeChecked();
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
    await expect(count(page)).toHaveText('16 scenarios');
    await expect(page.getByRole('searchbox')).toHaveCount(0);
    await expect(list(page).getByRole('radio')).toHaveCount(16);
    // The address is tidied to what the workspace understands.
    await expect.poll(() => new URL(page.url()).searchParams.get('q')).toBeNull();
  });

  test('each filter keeps exactly the scenarios that match it, filters combine, and Clear filters brings everything back', async ({
    page,
    api,
  }) => {
    const scenarios = await api.scenarios();
    const total = scenarios.length;
    await openWorkspace(page);
    const counted = async (expected: PublicScenarioDTO[]) => {
      await expect(count(page)).toHaveText(countText(expected.length, total));
      await expect(list(page).getByRole('radio')).toHaveCount(expected.length);
    };

    await test.step('product', async () => {
      await page.getByRole('combobox', { name: 'Product' }).selectOption('windows-11');
      await counted(scenarios.filter((scenario) => scenario.product.id === 'windows-11'));
      await expect.poll(() => new URL(page.url()).searchParams.get('f_product')).toBe('windows-11');
      // A scenario that is filtered out is not the chosen one: the first that remains is.
      const shown = await list(page).getByRole('radio', { checked: true }).count();
      expect(shown).toBe(1);
    });

    await test.step('issue type, alongside the product', async () => {
      await page.getByRole('combobox', { name: 'Product' }).selectOption('');
      await page.getByRole('combobox', { name: 'Issue type' }).selectOption('permissions');
      await counted(scenarios.filter((scenario) => scenario.issueType === 'permissions'));
      // An option with nothing behind it cannot be chosen, so pick the issue of an Azure scenario.
      const azure = scenarios.find(
        (scenario) => scenario.product.id === 'azure',
      ) as PublicScenarioDTO;
      await page.getByRole('combobox', { name: 'Issue type' }).selectOption('');
      await page.getByRole('combobox', { name: 'Product' }).selectOption('azure');
      await page.getByRole('combobox', { name: 'Issue type' }).selectOption(azure.issueType);
      await counted(
        scenarios.filter(
          (scenario) => scenario.issueType === azure.issueType && scenario.product.id === 'azure',
        ),
      );
      await page.getByRole('combobox', { name: 'Issue type' }).selectOption('');
    });

    await test.step('difficulty, with the product still chosen', async () => {
      await page
        .getByRole('group', { name: 'Difficulty' })
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
    });

    await test.step('Clear filters puts all of them back and leaves focus on the first filter', async () => {
      await page.getByRole('button', { name: 'Clear filters' }).click();
      await counted(scenarios);
      await expect(page.getByRole('combobox', { name: 'Product' })).toHaveValue('');
      await expect(page.getByRole('combobox', { name: 'Product' })).toBeFocused();
      await expect(
        page.getByRole('group', { name: 'Difficulty' }).getByRole('radio', { name: /^All\b/ }),
      ).toBeChecked();
      await expect
        .poll(() =>
          [...new URL(page.url()).searchParams.keys()].filter((key) => key.startsWith('f_')),
        )
        .toEqual([]);
    });
  });

  test('a filter that leaves nothing says so, and Clear filters is there', async ({ page }) => {
    await page.goto('/scenarios?f_product=dynamics-365&f_difficulty=starter');
    await expect(page.getByRole('heading', { level: 2, name: 'No scenarios match' })).toBeVisible();
    await expect(count(page)).toHaveText('0 of 16 scenarios');
    await expect(page.getByText('No scenario selected')).toBeVisible();
    await page.getByRole('button', { name: 'Clear filters' }).first().click();
    await expect(count(page)).toHaveText('16 scenarios');
    await expect(list(page).getByRole('radio')).toHaveCount(16);
  });

  test('a link to a scenario that has been retired says so once and shows the library', async ({
    page,
  }) => {
    await page.goto(`/scenarios?scenario=${RETIRED}`);
    await expect(count(page)).toHaveText('16 scenarios');
    const notice = page.getByText('That scenario is no longer in the library. Choose another.');
    await expect(notice).toBeVisible();
    // The first scenario is chosen instead, and the address says so.
    await expect(list(page).getByRole('radio', { checked: true })).toHaveCount(1);
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
    await expect(count(page)).toHaveText('16 scenarios');
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
  test('the preset and every setting update the summary, mark what was changed, and travel in the address and the brief link', async ({
    page,
    api,
  }) => {
    const scenarios = await api.scenarios();
    const scenario = scenarios.find((item) => item.id === MARCUS) as PublicScenarioDTO;
    await openWorkspace(page, `?scenario=${MARCUS}`);
    const pane = paneFor(page, scenario);
    const customise = pane.getByRole('button', { name: /^Customise/ });
    const summary = pane.locator('.scn-pane__summary-line');
    const changed = pane.locator('.scn-cf__changed');
    const reset = pane.getByRole('button', { name: 'Reset to scenario defaults' });

    await test.step('it starts as the scenario was written, with nothing marked as changed', async () => {
      await expect(
        pane.getByRole('group', { name: 'Preset' }).getByRole('radio', { name: 'Starter' }),
      ).toBeChecked();
      await expect(summary).toContainText('Starter');
      await expect(summary).toContainText('Low impact');
      await expect(summary).toContainText('Calm');
      await customise.click();
      await expect(customise).toHaveAttribute('aria-expanded', 'true');
      await expect(changed).toHaveCount(0);
      await expect(reset).toHaveAttribute('aria-disabled', 'true');
      // A starter call has live hints on, as its own default.
      await expect(pane.getByRole('switch', { name: /^Live hints/ })).toBeChecked();
    });

    await test.step('the preset', async () => {
      await pane
        .getByRole('group', { name: 'Preset' })
        .getByRole('radio', { name: 'Challenge' })
        .check();
      await expect(summary).toContainText('Challenge');
      // Live hints follow the preset: off for a challenge call.
      await expect(pane.getByRole('switch', { name: /^Live hints/ })).not.toBeChecked();
      await pane.getByRole('button', { name: 'About presets' }).click();
      await expect(pane.getByText(/High pressure, incomplete first information/)).toBeVisible();
    });

    await test.step('impact', async () => {
      await pane
        .getByRole('group', { name: /^Impact/ })
        .getByRole('radio', { name: IMPACT_LABELS.high.label })
        .check();
      await expect(summary).toContainText('High impact');
      await expect(
        pane
          .getByRole('term')
          .filter({ hasText: /^Impact$/ })
          .locator('xpath=following-sibling::dd[1]'),
      ).toContainText(IMPACT_LABELS.high.label);
    });

    await test.step('starting state', async () => {
      await pane
        .getByRole('group', { name: /^Starting state/ })
        .getByRole('radio', { name: 'Angry' })
        .check();
      await expect(summary).toContainText(START_TEMPERATURE_LABELS.angry.label.split(/[\s/]/)[0]!);
    });

    await test.step('proficiency', async () => {
      await pane
        .getByRole('group', { name: /^Proficiency/ })
        .getByRole('radio', { name: PROFICIENCY_LABELS.expert.label })
        .check();
    });

    await test.step('style', async () => {
      await pane.getByRole('combobox', { name: 'Style' }).selectOption('talkative');
      await expect(pane).toContainText(`${STYLE_LABELS.talkative.label}, expert user`);
    });

    await test.step('call stage', async () => {
      await pane.getByRole('combobox', { name: 'Call stage' }).selectOption('follow-up');
      await expect(
        pane
          .getByRole('term')
          .filter({ hasText: /^Call stage$/ })
          .locator('xpath=following-sibling::dd[1]'),
      ).toHaveText(CALL_STAGE_LABELS['follow-up'].label);
    });

    await test.step('complications: choose one, and the page says how many, never which', async () => {
      await pane
        .getByRole('group', { name: /^Complications/ })
        .getByRole('radio', { name: 'Choose' })
        .check();
      await pane.getByRole('checkbox', { name: CURVEBALL_LABELS['ask-manager'].label }).check();
      await expect(pane.getByText(/1 of 2 chosen/)).toBeVisible();
      await expect(summary).not.toContainText(CURVEBALL_LABELS['ask-manager'].label);
      await expect(
        pane
          .getByRole('term')
          .filter({ hasText: /^Style$/ })
          .locator('xpath=following-sibling::dd[1]'),
      ).not.toContainText(/manager/i);
    });

    await test.step('live hints (off by default for a challenge call)', async () => {
      const hints = pane.getByRole('switch', { name: /^Live hints/ });
      await expect(hints).not.toBeChecked();
      await hints.check();
      await expect(hints).toBeChecked();
    });

    await test.step('every setting that was changed says so, in words, and the disclosure counts them', async () => {
      await expect(changed).toHaveCount(7);
      await expect(customise).toContainText('7 changed');
      await expect(reset).not.toHaveAttribute('aria-disabled', 'true');
    });

    await test.step('the brief link carries every setting', async () => {
      const link = pane.getByRole('link', { name: 'Review brief' });
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
      await expect(again.getByRole('button', { name: /^Customise/ })).toContainText('7 changed');
    });

    await test.step('Reset to scenario defaults puts everything back', async () => {
      await pane.getByRole('button', { name: /^Customise/ }).click();
      await pane.getByRole('button', { name: 'Reset to scenario defaults' }).click();
      await expect(
        pane.getByRole('group', { name: 'Preset' }).getByRole('radio', { name: 'Starter' }),
      ).toBeChecked();
      await expect(pane.locator('.scn-cf__changed')).toHaveCount(0);
      await expect(summary).toContainText('Low impact');
      const href = new URL(
        (await pane.getByRole('link', { name: 'Review brief' }).getAttribute('href')) ?? '',
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
    await pane.getByRole('link', { name: 'Review brief' }).click();
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
    const first = libraryScenarios()[0]!;
    expect(first.secrets.length).toBeGreaterThan(4);
    expect(leakedSecrets(`Intro. ${first.secrets[0]} Outro.`, first.secrets)).toEqual([
      first.secrets[0],
    ]);
  });

  test('the brief of every scenario, with every disclosure open', async ({ page }) => {
    test.setTimeout(180_000);
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

  test('the scenario details of every scenario, with the setup open', async ({ page }) => {
    test.setTimeout(180_000);
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
      });
    }
  });
});
