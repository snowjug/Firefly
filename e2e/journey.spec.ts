import { expect, test, type Page } from '@playwright/test';
import { composer, createCall, endViaApi, say, sayViaApi } from './helpers.ts';

/** Picks one word of a setup row: every row is a radio group named by its legend. */
const choose = (page: Page, row: string, option: string) =>
  page
    .getByRole('group', { name: row, exact: true })
    .getByRole('radio', { name: option, exact: true })
    .check();

/**
 * Searches the missions the way it is done now there is no search box in a top bar: from the
 * palette, whose last row opens the library with the words already in its search.
 */
async function searchMissionsFromPalette(page: Page, words: string) {
  await page.getByRole('button', { name: 'Search and commands' }).click();
  const palette = page.getByRole('dialog', { name: 'Search and commands' });
  await palette.getByRole('combobox').fill(words);
  await palette.getByRole('option', { name: /^Search missions for/ }).click();
}

/** The library's own line about how many missions the search leaves lit. */
const showingMissions = (page: Page, lit: number) =>
  page.getByRole('status').filter({ hasText: new RegExp(`^Showing ${lit} of \\d+ missions$`) });

test.describe('a trainee journey through the interface', () => {
  test('from the landing page, through sign-in, setup and a Starter call, to the report, history and recognition', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(
      page.getByRole('heading', { level: 1, name: /Practice difficult customer conversations/ }),
    ).toBeVisible();
    await page
      .getByRole('link', { name: /^Begin/ })
      .first()
      .click();
    await expect(page).toHaveURL(/\/sign-in$/);

    // Identity is a local profile: a name is enough, and nothing is sent anywhere.
    await page.getByLabel('Name').fill('Sam Rivera');
    await page.getByRole('button', { name: 'Create profile' }).click();
    await expect(page).toHaveURL(/\/home$/);
    await expect(page.getByRole('heading', { level: 1, name: /, Sam\.$/ })).toBeVisible();

    // Find a mission from the palette, then configure the call on one page.
    await searchMissionsFromPalette(page, 'export');
    await expect(page).toHaveURL(/\/scenarios\?q=export$/);
    await expect(page.getByRole('searchbox', { name: 'Find a signal' })).toHaveValue('export');
    await expect(showingMissions(page, 1)).toBeVisible();
    const mission = 'A user needs help finding a feature';
    await page.getByRole('tabpanel').getByRole('link', { name: mission }).click();
    await expect(page).toHaveURL(/\/scenarios\/cannot-find-export-feature\/setup$/);
    await expect(page.getByRole('heading', { level: 1, name: mission })).toBeVisible();
    await expect(page.getByText('Customised')).toHaveCount(0);

    await choose(page, 'Business impact', 'High');
    await choose(page, 'Customer temperature', 'Frustrated');
    await choose(page, 'Communication style', 'Terse');
    await choose(page, 'Technical proficiency', 'Novice');
    await choose(page, 'Call stage', 'Follow-up on an open case');
    await choose(page, 'Difficulty', 'Starter');
    // What was changed is said in words, and can be put back.
    await expect(page.getByText('Customised')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reset to scenario defaults' })).toBeVisible();
    // Hidden facts are part of every scenario: shown, never editable.
    await expect(page.getByRole('switch', { name: 'Hidden facts' })).toBeDisabled();

    await page.getByRole('button', { name: 'Enter the call' }).click();
    await expect(page).toHaveURL(/\/calls\/[\w-]+$/);
    // The call is set up as it was calibrated.
    await page.getByRole('button', { name: 'Call details' }).click();
    const setUp = page.getByRole('dialog', { name: 'Call details' });
    await expect(setUp.getByText('Follow-up on an open case', { exact: true })).toBeVisible();
    await expect(setUp.getByText('High impact', { exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(setUp).toBeHidden();

    const conversation = page.getByRole('region', { name: 'Conversation' });
    await expect(conversation.getByRole('listitem')).toHaveCount(1);
    await say(
      page,
      "Hello, I'm Sam. Thanks for following up. What are you trying to do on the invoices page?",
    );
    await expect(conversation.getByRole('listitem')).toHaveCount(3);
    await say(
      page,
      'I understand this has taken longer than it should. What does the toolbar show on that page?',
    );
    await expect(conversation.getByRole('listitem')).toHaveCount(5);
    await say(
      page,
      "I'll look into this now and call you back at 3pm with an update. Is there anything else you need?",
    );
    await expect(conversation.getByRole('listitem')).toHaveCount(7);

    // Ending the call opens the full coaching report.
    await page.getByRole('button', { name: 'End call', exact: true }).click();
    await page.getByRole('button', { name: 'End call and get feedback' }).click();
    await expect(page).toHaveURL(/\/sessions\/[\w-]+\/report$/, { timeout: 20_000 });
    await expect(
      page.getByRole('heading', { level: 1, name: `Call feedback: ${mission}` }),
    ).toBeVisible();
    await expect(page.getByText('Practice coaching report')).toBeVisible();
    await expect(page.getByRole('img', { name: /Overall score: [\d.]+ out of 5/ })).toBeVisible();

    // The report: six skills with evidence, and evidence that leads to the exact turn.
    await expect(page.getByRole('heading', { level: 2, name: 'Six skill scores' })).toBeVisible();
    for (const skill of [
      'Opening & Rapport',
      'Scoping & Discovery',
      'Empathy & De-escalation',
      'Clarity',
      'Ownership & Next Steps',
      'Closing',
    ]) {
      await expect(page.getByRole('heading', { level: 3, name: skill, exact: true })).toBeVisible();
    }
    for (const section of [
      'What went well',
      'Opportunities to improve',
      'Discovery',
      'Customer temperature',
      'Rewards from this call',
      'Next practice target',
      'About this report',
    ]) {
      await expect(page.getByRole('heading', { level: 2, name: section })).toBeVisible();
    }
    await page
      .getByRole('link', { name: /Turn \d+, view in transcript/ })
      .first()
      .click();
    await expect(page).toHaveURL(/\/transcript\?turn=\d+/);
    await expect(page.locator('li[data-linked="true"]')).toBeVisible();

    // The call is on the History trail (a step with its title) and still there after a reload, and
    // its report reopens.
    await page.goto('/history');
    await expect(
      page.getByRole('heading', { level: 1, name: 'My practice history' }),
    ).toBeVisible();
    const trailStep = page.getByRole('heading', { level: 4, name: mission });
    await expect(trailStep).toHaveCount(1);
    await page.reload();
    await expect(trailStep).toHaveCount(1);
    await page.getByRole('link', { name: /^View report/ }).click();
    await expect(page.getByRole('heading', { level: 2, name: 'Six skill scores' })).toBeVisible();

    // Rewards live in Progress now. The old address lands on its Recognition part, which explains
    // itself, and there is no ranking anywhere.
    await page.goto('/rewards');
    await expect(page).toHaveURL(/\/progress#recognition$/);
    await expect(page.getByRole('heading', { level: 1, name: 'My progress' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'Recognition' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 3, name: 'How points work' })).toBeVisible();
    await expect(page.getByText(/leaderboard|rank(?:ing)? #|\bXP\b/i)).toHaveCount(0);

    // Progress now has something to show, without a ranking.
    await page.goto('/progress');
    await expect(page.getByRole('heading', { level: 2, name: 'Skill by skill' })).toBeVisible();
    await expect(page.getByText(/leaderboard|rank(?:ing)? #/i)).toHaveCount(0);
  });

  test('a Challenge call can be run end to end from the keyboard-driven composer', async ({
    page,
  }) => {
    const call = await createCall(page, 'checkout-outage-before-investor-event', 'challenge');
    await page.goto(`/calls/${call.id}`);
    await expect(composer(page)).toBeVisible();
    // The call's details say how it is set up: a Challenge call, and so an immersive one.
    await page.getByRole('button', { name: 'Call details' }).click();
    const details = page.getByRole('dialog', { name: 'Call details' });
    await expect(details.getByText('Challenge', { exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(details).toBeHidden();
    // Challenge calls start immersive: no mood or signal counts are shown during the call.
    await expect(page.getByText(/signals? found/)).toHaveCount(0);
    await expect(page.getByText('Customer mood', { exact: true })).toHaveCount(0);

    await say(
      page,
      "I'm sorry about the outage, I can hear how stressful this is with the investors at 11. What do customers see when they pay?",
    );
    await say(
      page,
      'Has anything changed on your side recently, like a release or a configuration change?',
    );
    await say(
      page,
      "I'll take ownership of this and get an engineer on it now. I'll call you at 10:15 with a status update.",
    );
    await page.getByRole('button', { name: 'End call', exact: true }).click();
    await page.getByRole('button', { name: 'End call and get feedback' }).click();
    await expect(page).toHaveURL(/\/sessions\/[\w-]+\/report$/, { timeout: 20_000 });
    await expect(page.getByRole('heading', { level: 2, name: 'Discovery' })).toBeVisible();
  });

  test("the palette's search row opens the library with the words already typed in", async ({
    page,
  }) => {
    await page.goto('/home');
    await searchMissionsFromPalette(page, 'workspace');
    await expect(page).toHaveURL(/\/scenarios\?q=workspace$/);
    await expect(page.getByRole('searchbox', { name: 'Find a signal' })).toHaveValue('workspace');
    await expect(showingMissions(page, 1)).toBeVisible();
    // The list view keeps only the one mission that matches, as a link that starts with its title.
    await page.getByRole('tab', { name: 'List' }).click();
    const matches = page.getByRole('tabpanel').getByRole('link');
    await expect(matches).toHaveCount(1);
    await expect(matches).toHaveAccessibleName(/^Team cannot open the shared project workspace/);
  });

  test('older links to the pre-call brief land on the setup page', async ({ page }) => {
    await page.goto('/scenarios/cannot-find-export-feature/brief');
    await expect(page).toHaveURL(/\/scenarios\/cannot-find-export-feature\/setup$/);
    await expect(
      page.getByRole('heading', { level: 1, name: 'A user needs help finding a feature' }),
    ).toBeVisible();
    await page.goto('/about');
    await expect(page).toHaveURL(/\/help$/);
  });
});

test.describe('what the simulation does', () => {
  test('the customer reacts to empathy and blame, and the report shows how the mood moved', async ({
    page,
  }) => {
    const call = await createCall(page, 'locked-out-after-password-reset', 'standard', {
      startingTemperature: 'frustrated',
    });
    const send = async (text: string) => {
      const response = await page.request.post(`/api/sessions/${call.id}/messages`, {
        data: { text, clientMessageId: crypto.randomUUID() },
      });
      expect(response.ok()).toBeTruthy();
      return (await response.json()) as { state: { trend: string; band: { label: string } } };
    };
    const calmer = await send(
      "I'm sorry you're locked out, that sounds really frustrating. Can you tell me what happens when you sign in?",
    );
    expect(calmer.state.trend).toBe('falling');
    const worse = await send(
      'You should have read the instructions before changing your password.',
    );
    expect(worse.state.trend).toBe('rising');
    await sayViaApi(
      page,
      call.id,
      "I'm sorry, that was unfair of me. I'll check the account now and call you back by 3pm.",
    );
    await endViaApi(page, call.id);

    await page.goto(`/sessions/${call.id}/report`);
    const timeline = page.getByRole('img', { name: /Customer mood timeline/ });
    await expect(timeline).toBeVisible();
    await page.getByRole('button', { name: 'Show as table' }).click();
    await expect(
      page.getByRole('table', { name: 'Customer mood at each point in the call' }),
    ).toBeVisible();
  });

  test('a hidden fact can be found, another can stay missed, and the report says which', async ({
    page,
  }) => {
    const call = await createCall(page, 'locked-out-after-password-reset', 'standard');
    await sayViaApi(
      page,
      call.id,
      "Hi, I'm Sam. I'm sorry you're locked out. What happens when you try to sign in?",
    );
    await sayViaApi(
      page,
      call.id,
      'Is your work email set up on any other device, like your phone?',
    );
    await sayViaApi(
      page,
      call.id,
      "Thank you. I'll check the account and call you back by 3pm with an update.",
    );
    await endViaApi(page, call.id);

    await page.goto(`/sessions/${call.id}/report`);
    const discovery = page.locator('section').filter({
      has: page.getByRole('heading', { level: 2, name: 'Discovery' }),
    });
    await expect(discovery.getByText('Found', { exact: true }).first()).toBeVisible();
    await expect(discovery.getByText('Missed', { exact: true }).first()).toBeVisible();
    await expect(discovery.getByText('A question worth asking').first()).toBeVisible();
  });

  test('a curveball can land mid-call and the report says how it was handled', async ({ page }) => {
    const call = await createCall(page, 'team-cannot-open-shared-workspace', 'standard');
    const questions = [
      'What exactly happens when you try to open the workspace?',
      'When did it last work?',
      'Who is affected, just you or the whole team?',
      'What does the message on the screen say?',
      'Has anything changed recently?',
      'What have you tried so far?',
    ];
    let manager = false;
    for (const text of questions) {
      const response = await page.request.post(`/api/sessions/${call.id}/messages`, {
        data: { text, clientMessageId: crypto.randomUUID() },
      });
      const body = (await response.json()) as { customerTurn: { text: string } };
      if (/manager/i.test(body.customerTurn.text)) manager = true;
    }
    expect(manager, 'the customer should ask for a manager when nobody has taken ownership').toBe(
      true,
    );
    await sayViaApi(
      page,
      call.id,
      "I'm sorry this is holding up your deliverable. I'll take this on and call you back at 2pm with an update.",
    );
    await endViaApi(page, call.id);

    await page.goto(`/sessions/${call.id}/report`);
    await expect(page.getByRole('heading', { level: 2, name: 'Curveball' })).toBeVisible();
    await expect(page.getByText('Asks for a manager').first()).toBeVisible();
  });

  test('a short call is called "ended early", earns no points, and every report section is there', async ({
    page,
  }) => {
    const call = await createCall(page);
    await sayViaApi(page, call.id, 'Hi how shall i help u');
    await sayViaApi(page, call.id, 'No, I cannot help with that.');
    await endViaApi(page, call.id);
    await page.goto(`/sessions/${call.id}/report`);

    // The header and the notes that qualify the result.
    await expect(page.getByText('Ended early').first()).toBeVisible();
    await expect(page.getByText(/Customer at the end:/)).toBeVisible();
    await expect(
      page.getByText(
        'This call stopped before a wrap-up, so the Closing score rests on limited evidence.',
      ),
    ).toBeVisible();
    // Too little was said to give an overall score, and the report says so instead of inventing one.
    await expect(page.getByText('No overall score for this call.')).toBeVisible();

    // The six skills, the sections the product owner asked to keep, and the way to challenge them.
    await expect(page.getByRole('heading', { level: 2, name: 'Six skill scores' })).toBeVisible();
    await expect(page.getByText('Evidence from your call').first()).toBeVisible();
    await expect(page.getByText('To strengthen this').first()).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'Discovery' })).toBeVisible();
    await expect(page.getByText('What the customer had held back').first()).toBeVisible();
    await expect(
      page.getByRole('heading', { level: 2, name: 'Customer temperature' }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { level: 2, name: 'Next practice target' }),
    ).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'About this report' })).toBeVisible();
    await page.getByRole('button', { name: 'Report incorrect feedback' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText(/never paste/i);
    await page.keyboard.press('Escape');

    // Rewards say plainly that a call that ends early earns nothing.
    await expect(
      page.getByRole('heading', { level: 2, name: 'Rewards from this call' }),
    ).toBeVisible();
    await expect(page.getByText(/end early earn no points/i)).toBeVisible();

    await expect(composer(page)).toHaveCount(0);
  });
});
