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
import { callScreen } from './support/call-screen.ts';
import { leakedSecrets, libraryScenarios } from './support/scenario-library.ts';

// Journeys 2, 3 and 4: choosing a scenario, setting up the call, and reading the brief.

const SHARED_WORKSPACE = 'team-cannot-open-shared-workspace';

const countText = (shown: number, total: number) =>
  shown === total ? `${total} scenarios` : `${shown} of ${total} scenarios`;

function paneFor(page: Page, scenario: PublicScenarioDTO): Locator {
  return page.getByRole('region', { name: scenario.title });
}

/**
 * Opens the workspace and waits until it has settled: the list is loaded and the address has caught
 * up with the first scenario it chose. A choice made in the same instant the list arrives can be
 * overwritten by that tidying of the address (the app replaces the address once the list is there),
 * which no person can do but a script can, so the journeys start from the settled page.
 */
async function openWorkspace(page: Page) {
  await page.goto('/scenarios');
  await expect(page.getByText('13 scenarios', { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/[?&]scenario=/);
}

test.describe('choose a scenario', () => {
  test('every scenario in the library is listed under its issue type, and the first is chosen', async ({
    page,
    api,
  }) => {
    const scenarios = await api.scenarios();
    expect(scenarios).toHaveLength(13);
    await openWorkspace(page);
    await expect(page).toHaveTitle(/Choose a scenario/);
    await expect(page.getByRole('heading', { level: 1, name: 'Choose a scenario' })).toBeVisible();

    await test.step('the count and one radio for each scenario', async () => {
      await expect(page.getByText('13 scenarios', { exact: true })).toBeVisible();
      const list = page.getByRole('group', { name: 'Choose a scenario' });
      await expect(list.getByRole('radio')).toHaveCount(13);
      for (const scenario of scenarios) {
        await expect(list.getByRole('radio', { name: scenario.title, exact: true })).toBeAttached();
      }
    });

    await test.step('grouped by issue type, each heading with its count', async () => {
      const kinds = new Set(scenarios.map((scenario) => scenario.issueType));
      expect(kinds.size).toBe(7);
      for (const kind of kinds) {
        const total = scenarios.filter((scenario) => scenario.issueType === kind).length;
        await expect(
          page.getByRole('heading', {
            level: 2,
            name: `${ISSUE_TYPE_LABELS[kind]} ${total} ${total === 1 ? 'scenario' : 'scenarios'}`,
          }),
        ).toBeVisible();
      }
    });

    await test.step('the first scenario is chosen and its details are shown', async () => {
      const first = scenarios[0] as PublicScenarioDTO;
      await expect(page.getByRole('radio', { name: first.title, exact: true })).toBeChecked();
      const pane = paneFor(page, first);
      await expect(pane.getByRole('heading', { level: 2, name: first.title })).toBeVisible();
      for (const heading of ['What you are told', 'Your goal', 'Ground rules', 'Call setup']) {
        await expect(pane.getByRole('heading', { level: 3, name: heading })).toBeVisible();
      }
      await expect(pane.getByText(first.persona.name).first()).toBeVisible();
      await expect(pane.getByRole('link', { name: 'Continue to call brief' })).toBeVisible();
    });
  });

  test('choosing another scenario shows its details and records the choice in the address', async ({
    page,
    api,
  }) => {
    const scenarios = await api.scenarios();
    const other = scenarios.find(
      (scenario) => scenario.id === SHARED_WORKSPACE,
    ) as PublicScenarioDTO;
    await openWorkspace(page);
    await page.getByRole('radio', { name: other.title, exact: true }).check();

    await expect(
      paneFor(page, other).getByRole('heading', { level: 2, name: other.title }),
    ).toBeVisible();
    await expect(paneFor(page, other).getByText(other.persona.name).first()).toBeVisible();
    await expect.poll(() => new URL(page.url()).searchParams.get('scenario')).toBe(other.id);
    // A scenario that is not the first opens with its own settings, not the previous one's.
    await expect(page.getByRole('radio', { name: other.title, exact: true })).toBeChecked();
  });

  test('searching narrows the list, no match says so, and clearing brings every scenario back', async ({
    page,
  }) => {
    await openWorkspace(page);
    const search = page.getByRole('searchbox', { name: 'Search scenarios' });
    const list = page.getByRole('group', { name: 'Choose a scenario' });

    await test.step('a word in a title narrows the list to that scenario', async () => {
      await search.fill('checkout');
      await expect(page.getByText('1 of 13 scenarios', { exact: true })).toBeVisible();
      await expect(list.getByRole('radio')).toHaveCount(1);
      await expect(list.getByRole('radio', { name: /Checkout is down/ })).toBeChecked();
      await expect.poll(() => new URL(page.url()).searchParams.get('q')).toBe('checkout');
    });

    await test.step('a customer name is searched too', async () => {
      await search.fill('Maya Okafor');
      await expect(list.getByRole('radio')).toHaveCount(1);
      await expect(
        list.getByRole('radio', { name: /Locked out after a password reset/ }),
      ).toBeVisible();
    });

    await test.step('words that match nothing show the empty state', async () => {
      await search.fill('zzzz qqqq');
      await expect(
        page.getByRole('heading', { level: 2, name: 'No scenarios match' }),
      ).toBeVisible();
      await expect(page.getByText('0 of 13 scenarios', { exact: true })).toBeVisible();
      await expect(list.getByRole('radio')).toHaveCount(0);
      await expect(page.getByText('No scenario selected')).toBeVisible();
    });

    await test.step('Clear filters restores all of them and puts focus back in the search box', async () => {
      await page.getByRole('button', { name: 'Clear filters' }).first().click();
      await expect(page.getByText('13 scenarios', { exact: true })).toBeVisible();
      await expect(list.getByRole('radio')).toHaveCount(13);
      await expect(search).toHaveValue('');
      await expect(search).toBeFocused();
      await expect.poll(() => new URL(page.url()).searchParams.get('q')).toBeNull();
    });
  });

  test('each filter keeps exactly the scenarios that match it, and filters combine', async ({
    page,
    api,
  }) => {
    const scenarios = await api.scenarios();
    const total = scenarios.length;
    await openWorkspace(page);
    const list = page.getByRole('group', { name: 'Choose a scenario' });
    const counted = async (expected: PublicScenarioDTO[]) => {
      await expect(
        page.getByText(countText(expected.length, total), { exact: true }),
      ).toBeVisible();
      await expect(list.getByRole('radio')).toHaveCount(expected.length);
    };

    await test.step('issue type', async () => {
      await page
        .getByRole('combobox', { name: 'Issue type' })
        .selectOption({ label: ISSUE_TYPE_LABELS['service-outage'] });
      await counted(scenarios.filter((scenario) => scenario.issueType === 'service-outage'));
    });

    await test.step('difficulty, alongside the issue type', async () => {
      await page.getByRole('combobox', { name: 'Issue type' }).selectOption({ label: 'All' });
      await page.getByRole('combobox', { name: 'Difficulty' }).selectOption({ label: 'Challenge' });
      await counted(scenarios.filter((scenario) => scenario.difficulty === 'challenge'));
      await expect
        .poll(() => new URL(page.url()).searchParams.get('f_difficulty'))
        .toBe('challenge');
    });

    await test.step('business impact, together with the difficulty', async () => {
      await page
        .getByRole('combobox', { name: 'Business impact' })
        .selectOption({ label: IMPACT_LABELS.high.label });
      await counted(
        scenarios.filter(
          (scenario) => scenario.difficulty === 'challenge' && scenario.impact === 'high',
        ),
      );
    });

    await test.step('Clear filters puts all of them back', async () => {
      await page.getByRole('button', { name: 'Clear filters' }).click();
      await counted(scenarios);
      await expect(page.getByRole('combobox', { name: 'Difficulty' })).toHaveValue('');
    });
  });

  test('Recent calls is empty for a new visitor, and a call in progress is offered back at the top and in the list', async ({
    page,
    api,
  }) => {
    await openWorkspace(page);
    const recent = page.getByRole('button', { name: 'Recent calls' });

    await test.step('with no calls the list says so, and closing it gives focus back', async () => {
      await recent.click();
      const dialog = page.getByRole('dialog', { name: 'Recent calls' });
      await expect(dialog.getByText('No calls yet.')).toBeVisible();
      await dialog.getByRole('button', { name: 'Close', exact: true }).click();
      await expect(dialog).toBeHidden();
      await expect(recent).toBeFocused();
    });

    const call = await api.createCall({ scenarioId: 'locked-out-after-password-reset' });
    await page.reload();

    await test.step('a call that is open is shown at the top, with the way back in', async () => {
      await expect(
        page.getByText('You have a call in progress: Locked out after a password reset.'),
      ).toBeVisible();
      await page.getByRole('button', { name: 'Recent calls' }).click();
      const dialog = page.getByRole('dialog', { name: 'Recent calls' });
      await expect(dialog.getByRole('listitem')).toHaveCount(1);
      await expect(dialog).toContainText('In progress');
      await dialog.getByRole('link', { name: /^Resume/ }).click();
      await expect(page).toHaveURL(new RegExp(`/calls/${call.id}$`));
      await expect(callScreen(page).preflight.heading).toBeVisible();
    });
  });
});

test.describe('set up the call', () => {
  test('every setting updates the preview and the summary, and the brief link carries them in its address', async ({
    page,
    api,
  }) => {
    const scenarios = await api.scenarios();
    const scenario = scenarios.find((item) => item.id === SHARED_WORKSPACE) as PublicScenarioDTO;
    await page.goto(`/scenarios?scenario=${SHARED_WORKSPACE}`);
    const pane = paneFor(page, scenario);
    const group = (name: string) => pane.getByRole('group', { name: new RegExp(`^${name}`) });
    const preview = pane.getByRole('heading', { level: 4, name: 'Call preview' }).locator('..');
    const summary = pane.getByRole('list', { name: 'Your choices' });

    await test.step('it starts as the scenario was written, with nothing marked as changed', async () => {
      await expect(group('Difficulty').getByRole('radio', { name: 'Standard' })).toBeChecked();
      await expect(summary).toContainText('Standard');
      await expect(summary).toContainText('Medium impact');
      await expect(pane.getByText('Changed from default')).toHaveCount(0);
      await expect(pane.getByRole('button', { name: 'Reset to scenario defaults' })).toHaveCount(0);
    });

    await test.step('difficulty', async () => {
      await group('Difficulty').getByRole('radio', { name: 'Challenge' }).check();
      await expect(summary).toContainText('Challenge');
    });

    await test.step('business impact', async () => {
      await group('Business impact').getByRole('radio', { name: IMPACT_LABELS.high.label }).check();
      await expect(summary).toContainText('High impact');
      await expect(preview).toContainText(/business impact is high/i);
    });

    await test.step('starting temperature', async () => {
      await group('Customer starting temperature')
        .getByRole('radio', { name: START_TEMPERATURE_LABELS.angry.label })
        .check();
      await expect(summary).toContainText(/angry/i);
      await expect(preview).toContainText(/angry/i);
    });

    await test.step('technical proficiency', async () => {
      await group('Technical proficiency')
        .getByRole('radio', { name: PROFICIENCY_LABELS.novice.label })
        .check();
      await expect(preview).toContainText(/novice technical proficiency/i);
    });

    await test.step('communication style', async () => {
      await pane
        .getByRole('combobox', { name: /^Communication style/ })
        .selectOption({ label: STYLE_LABELS.terse.label });
      await expect(preview).toContainText(/terse/i);
    });

    await test.step('call stage', async () => {
      await pane
        .getByRole('combobox', { name: /^Call stage/ })
        .selectOption({ label: CALL_STAGE_LABELS['follow-up'].label });
      await expect(preview).toContainText(/following up on an open case/i);
    });

    await test.step('curveballs: choose one, and the preview says how many but never which', async () => {
      await group('Curveballs').getByRole('radio', { name: 'Choose' }).check();
      await pane.getByRole('checkbox', { name: CURVEBALL_LABELS['ask-manager'].label }).check();
      await expect(preview).toContainText(/one complication/i);
      await expect(preview).not.toContainText(CURVEBALL_LABELS['ask-manager'].label);
      await expect(preview).not.toContainText(/manager/i);
    });

    await test.step('live hints (off by default for a challenge call)', async () => {
      const hints = pane.getByRole('switch', { name: /^Live hints during the call/ });
      await expect(hints).not.toBeChecked();
      await hints.check();
      await expect(hints).toBeChecked();
    });

    await test.step('every control that was changed says so, in words', async () => {
      await expect(pane.getByText('Changed from default')).toHaveCount(8);
      await expect(pane.getByRole('button', { name: 'Reset to scenario defaults' })).toBeVisible();
    });

    await test.step('the address of the brief link carries every setting', async () => {
      const link = pane.getByRole('link', { name: 'Continue to call brief' });
      const href = new URL((await link.getAttribute('href')) ?? '', page.url());
      expect(href.pathname).toBe(`/scenarios/${SHARED_WORKSPACE}/brief`);
      expect(Object.fromEntries(href.searchParams)).toEqual({
        difficulty: 'challenge',
        impact: 'high',
        temperature: 'angry',
        proficiency: 'novice',
        style: 'terse',
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
      await expect(group('Difficulty').getByRole('radio', { name: 'Challenge' })).toBeChecked();
      await expect(pane.getByText('Changed from default')).toHaveCount(8);
    });

    await test.step('Reset to scenario defaults puts everything back', async () => {
      await pane.getByRole('button', { name: 'Reset to scenario defaults' }).click();
      await expect(group('Difficulty').getByRole('radio', { name: 'Standard' })).toBeChecked();
      await expect(pane.getByText('Changed from default')).toHaveCount(0);
      await expect(summary).toContainText('Medium impact');
    });
  });
});

test.describe('the call brief', () => {
  const CONFIGURED =
    'difficulty=challenge&impact=high&temperature=angry&proficiency=novice&style=terse&stage=follow-up&curveballs=ask-manager&hints=on';

  test('shows who is calling, the situation, the objective, the impact and the choices made, with the speech explainer beside them', async ({
    page,
    api,
  }) => {
    const scenarios = await api.scenarios();
    const scenario = scenarios.find((item) => item.id === SHARED_WORKSPACE) as PublicScenarioDTO;
    await page.goto(`/scenarios/${SHARED_WORKSPACE}/brief?${CONFIGURED}`);
    await expect(page).toHaveTitle(new RegExp(`Call brief: ${scenario.title}`));
    await expect(page.getByRole('heading', { level: 1, name: 'Call brief' })).toBeVisible();

    const caseFile = page.getByRole('region', { name: 'Support case' });
    await test.step('the case, as labelled rows', async () => {
      for (const term of [
        'Customer',
        'Issue summary',
        'Situation',
        'Business impact',
        'Call stage',
        "Customer's starting state",
        'How the customer communicates',
        'Your objective',
        'Ground rules',
        'Difficulty',
        'Expected duration',
        'Live hints',
        'Complications',
      ]) {
        await expect(
          caseFile.getByRole('term').filter({ hasText: new RegExp(`^${term}$`) }),
        ).toHaveCount(1);
      }
      await expect(caseFile).toContainText(scenario.persona.name);
      await expect(caseFile).toContainText(scenario.persona.role);
      await expect(caseFile).toContainText(scenario.persona.organisation);
      await expect(caseFile).toContainText(scenario.summary);
      await expect(caseFile).toContainText(scenario.brief.situation);
      await expect(caseFile).toContainText(scenario.brief.goal);
    });

    await test.step('what was chosen, not what the scenario says by default', async () => {
      await expect(caseFile).toContainText(IMPACT_LABELS.high.label);
      await expect(caseFile).toContainText(CALL_STAGE_LABELS['follow-up'].label);
      await expect(caseFile).toContainText(START_TEMPERATURE_LABELS.angry.label);
      await expect(caseFile).toContainText(STYLE_LABELS.terse.label);
      await expect(caseFile).toContainText('Challenge');
      await expect(caseFile).toContainText('This call may include an unexpected turn.');
      // It says that something may happen, never what.
      await expect(caseFile).not.toContainText(CURVEBALL_LABELS['ask-manager'].label);
    });

    await test.step('the speech explainer says what this server and this browser will really do', async () => {
      const aside = page.getByRole('complementary', { name: 'Before you start' });
      await expect(aside.getByRole('heading', { level: 3, name: 'Speak, or type.' })).toBeVisible();
      await expect(aside).toContainText('your browser asks to use your microphone');
      await expect(aside).toContainText(
        'Your speech is sent through Firefly to Demo speech (scripted)',
      );
      await expect(aside).toContainText('It does not understand audio and returns scripted text');
      await expect(aside).toContainText('Firefly does not store the audio');
      await expect(aside).toContainText('The customer does not speak');
      await expect(aside).toContainText(
        "Demo mode: the customer is played by Firefly's built-in rules engine.",
      );
      await expect(
        aside.getByRole('link', { name: 'How Firefly uses AI and speech' }),
      ).toHaveAttribute('href', '/responsible-ai');
      await expect(aside.getByRole('button', { name: 'Start voice call' })).toBeEnabled();
      await expect(aside.getByRole('button', { name: 'Start a text-only call' })).toBeEnabled();
    });
  });

  test('keeps back everything the customer keeps back, for every scenario in the library', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const library = libraryScenarios();

    await test.step('the check can see a leak (a control, so that "nothing leaked" is not an empty result)', async () => {
      const first = library[0]!;
      expect(first.secrets.length).toBeGreaterThan(4);
      expect(leakedSecrets(`Intro. ${first.secrets[0]} Outro.`, first.secrets)).toEqual([
        first.secrets[0],
      ]);
    });

    for (const scenario of library) {
      await test.step(scenario.title, async () => {
        // Guided practice is the brief that says the most (it lists the areas worth exploring).
        await page.goto(`/scenarios/${scenario.id}/brief?hints=on`);
        await expect(page.getByRole('region', { name: 'Support case' })).toBeVisible();
        const text = await page.locator('body').innerText();
        expect(
          leakedSecrets(text, scenario.secrets),
          `The brief of "${scenario.title}" shows something the customer keeps back`,
        ).toEqual([]);
      });
    }
  });

  test('Edit scenario returns to the workspace with every choice intact', async ({ page, api }) => {
    const scenarios = await api.scenarios();
    const scenario = scenarios.find((item) => item.id === SHARED_WORKSPACE) as PublicScenarioDTO;
    await page.goto(`/scenarios/${SHARED_WORKSPACE}/brief?${CONFIGURED}`);

    await page.getByRole('link', { name: 'Edit scenario' }).first().click();
    await expect(page.getByRole('heading', { level: 1, name: 'Choose a scenario' })).toBeVisible();

    const pane = paneFor(page, scenario);
    await expect(pane.getByRole('heading', { level: 2, name: scenario.title })).toBeVisible();
    await expect(
      pane.getByRole('group', { name: /^Difficulty/ }).getByRole('radio', { name: 'Challenge' }),
    ).toBeChecked();
    await expect(
      pane.getByRole('group', { name: /^Business impact/ }).getByRole('radio', { name: 'High' }),
    ).toBeChecked();
    await expect(pane.getByRole('combobox', { name: /^Call stage/ })).toHaveValue('follow-up');
    await expect(pane.getByRole('combobox', { name: /^Communication style/ })).toHaveValue('terse');
    await expect(
      pane.getByRole('checkbox', { name: CURVEBALL_LABELS['ask-manager'].label }),
    ).toBeChecked();
    await expect(pane.getByRole('switch', { name: /^Live hints during the call/ })).toBeChecked();
    await expect(pane.getByText('Changed from default')).toHaveCount(8);

    // And on to the brief again: the address is the same.
    await pane.getByRole('link', { name: 'Continue to call brief' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Call brief' })).toBeVisible();
    expect(Object.fromEntries(new URL(page.url()).searchParams)).toEqual(
      Object.fromEntries(new URLSearchParams(CONFIGURED)),
    );
  });

  test('a scenario that does not exist says so, and offers the way back', async ({
    page,
    problems,
  }) => {
    problems.allow({ status: 404, url: '/api/scenarios/' });
    await page.goto('/scenarios/not-a-real-scenario/brief');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Scenario unavailable' }),
    ).toBeVisible();
    await expect(page.getByText('Nothing was started.')).toBeVisible();
    await page.getByRole('link', { name: 'Choose a scenario' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Choose a scenario' })).toBeVisible();
  });
});
