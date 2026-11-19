import { expect, test, type Page } from '@playwright/test';
import { composer, createCall, endViaApi, say, sayViaApi } from './helpers.ts';

const radio = (page: Page, name: string) => page.getByRole('radio', { name, exact: true });

test.describe('a trainee journey through the interface', () => {
  test('from the landing page, through sign-in, setup and a Starter call, to the report, rewards and history', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(
      page.getByRole('heading', { level: 1, name: /Practice real conversations/ }),
    ).toBeVisible();
    await page
      .getByRole('link', { name: /Get started/ })
      .first()
      .click();
    await expect(page).toHaveURL(/\/sign-in$/);

    // Identity is a local profile: a name is enough, and nothing is sent anywhere.
    await page.getByLabel('Name').fill('Sam Rivera');
    await page.getByRole('button', { name: /Continue/ }).click();
    await expect(page).toHaveURL(/\/home$/);
    await expect(page.getByRole('heading', { level: 1, name: /, Sam$/ })).toBeVisible();

    // Find a scenario from the top bar, then configure the call on one page.
    const search = page.getByRole('searchbox', { name: 'Search all scenarios' });
    await search.fill('export');
    await search.press('Enter');
    await expect(page).toHaveURL(/\/scenarios\?q=export$/);
    await expect(page.getByRole('article')).toHaveCount(1);
    await page.getByRole('link', { name: 'Start A user needs help finding a feature' }).click();
    await expect(page).toHaveURL(/\/scenarios\/cannot-find-export-feature\/setup$/);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Configure your scenario' }),
    ).toBeVisible();
    await expect(page.getByText('Customised')).toHaveCount(0);

    await radio(page, 'High').check({ force: true });
    await radio(page, 'Frustrated').check({ force: true });
    await radio(page, 'Terse').check({ force: true });
    await radio(page, 'Novice').check({ force: true });
    await page.getByLabel('Call stage').selectOption({ label: 'Follow-up on an open case' });
    await radio(page, 'Starter').check({ force: true });
    // What was changed is said in words, and can be put back.
    await expect(page.getByText('Customised')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reset to scenario defaults' })).toBeVisible();
    // Hidden facts are part of every scenario: shown, never editable.
    await expect(page.getByRole('switch', { name: 'Hidden facts' })).toBeDisabled();

    await page.getByRole('button', { name: 'Start call simulation' }).click();
    await expect(page).toHaveURL(/\/calls\/[\w-]+$/);

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
    await expect(page.getByRole('heading', { level: 1, name: 'Call feedback' })).toBeVisible();
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
      await expect(page.getByRole('heading', { level: 3, name: skill })).toBeVisible();
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

    // The call is in History (as a row) and still there after a reload, and its report reopens.
    await page.goto('/history');
    await expect(
      page.getByRole('heading', { level: 1, name: 'My practice history' }),
    ).toBeVisible();
    await expect(
      page.getByRole('row', { name: /A user needs help finding a feature/ }),
    ).toHaveCount(1);
    await page.reload();
    await expect(
      page.getByRole('row', { name: /A user needs help finding a feature/ }),
    ).toHaveCount(1);
    await page.getByRole('link', { name: /^View report/ }).click();
    await expect(page.getByRole('heading', { level: 2, name: 'Six skill scores' })).toBeVisible();

    // Rewards explain themselves, and there is no ranking anywhere.
    await page.goto('/rewards');
    await expect(page.getByRole('heading', { level: 1, name: 'Rewards' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'How points work' })).toBeVisible();
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
    await expect(page.getByText('Challenge', { exact: true }).first()).toBeVisible();
    // Challenge calls start immersive: no mood or fact counts are shown during the call.
    await expect(page.getByText(/uncovered so far/)).toHaveCount(0);

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

  test('the top bar search opens the library with the words already typed in', async ({ page }) => {
    await page.goto('/home');
    const topSearch = page.getByRole('searchbox', { name: 'Search all scenarios' });
    await topSearch.fill('workspace');
    await topSearch.press('Enter');
    await expect(page).toHaveURL(/\/scenarios\?q=workspace$/);
    await expect(
      page.getByRole('searchbox', { name: 'Search scenarios', exact: true }),
    ).toHaveValue('workspace');
    await expect(page.getByRole('article')).toHaveCount(1);
  });

  test('older links to the pre-call brief land on the setup page', async ({ page }) => {
    await page.goto('/scenarios/cannot-find-export-feature/brief');
    await expect(page).toHaveURL(/\/scenarios\/cannot-find-export-feature\/setup$/);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Configure your scenario' }),
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
