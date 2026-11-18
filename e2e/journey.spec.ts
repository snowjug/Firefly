import { expect, test, type Page } from '@playwright/test';
import { composer, createCall, endViaApi, say, sayViaApi } from './helpers.ts';

const option = (page: Page, name: string) => page.getByRole('radio', { name, exact: true });

async function next(page: Page) {
  await page.getByRole('button', { name: 'Next' }).click();
}

test.describe('a trainee journey through the interface', () => {
  test('from the library, through setup and a Starter call, to the report and history', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(
      page.getByRole('heading', {
        level: 1,
        name: /Practice difficult customer conversations before they become real ones/,
      }),
    ).toBeVisible();
    await page
      .getByRole('link', { name: /Start a simulation/ })
      .first()
      .click();
    await expect(page).toHaveURL(/\/scenarios$/);

    // Find a scenario by searching, then set the call up one decision at a time.
    await page.getByRole('searchbox', { name: 'Search scenarios' }).fill('export');
    await expect(page.getByRole('article')).toHaveCount(1);
    await page
      .getByRole('link', { name: /Set up call: A user needs help finding a feature/ })
      .click();

    await expect(
      page.getByRole('heading', { level: 2, name: 'Is this the issue you want to practise?' }),
    ).toBeVisible();
    await next(page);
    await option(page, 'High').check({ force: true });
    await next(page);
    await option(page, 'Frustrated').check({ force: true });
    await next(page);
    await option(page, 'Terse').check({ force: true });
    await option(page, 'Novice').check({ force: true });
    await next(page);
    await option(page, 'Follow-up on an open case').check({ force: true });
    await next(page);
    await option(page, 'Starter').check({ force: true });
    await next(page);
    await expect(
      page.getByRole('heading', { level: 2, name: 'Should the customer do something unexpected?' }),
    ).toBeVisible();
    await next(page);

    // The review marks what you changed, in words.
    await expect(page.getByRole('heading', { level: 2, name: 'Review your call' })).toBeVisible();
    await expect(page.getByText('Changed from default').first()).toBeVisible();
    await page.getByRole('button', { name: 'Continue to brief' }).click();

    // The brief shows what a trainee may know, then starts the call.
    await expect(page.getByRole('heading', { level: 2, name: 'Your goal' })).toBeVisible();
    await page.getByRole('button', { name: 'Begin call' }).click();
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

    await page.getByRole('button', { name: 'End call', exact: true }).click();
    await page.getByRole('button', { name: 'End call and get feedback' }).click();
    await expect(page).toHaveURL(/\/sessions\/[\w-]+\/report$/, { timeout: 20_000 });

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
    await page
      .getByRole('link', { name: /Turn \d+, view in transcript/ })
      .first()
      .click();
    await expect(page).toHaveURL(/\/transcript\?turn=\d+/);
    await expect(page.locator('li[data-linked="true"]')).toBeVisible();

    // The call is in History and still there after a reload, and its report reopens.
    await page.goto('/history');
    await expect(page.getByRole('article')).toHaveCount(1);
    await page.reload();
    await expect(page.getByRole('article')).toHaveCount(1);
    await page.getByRole('link', { name: 'Open report' }).click();
    await expect(page.getByRole('heading', { level: 2, name: 'Six skill scores' })).toBeVisible();

    // Progress now has something to show, without a ranking.
    await page.goto('/progress');
    await expect(page.getByRole('heading', { level: 2, name: 'Skill by skill' })).toBeVisible();
    await expect(page.getByText(/leaderboard|rank(?:ing)? #|streak/i)).toHaveCount(0);
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

  test('a long conversation stays usable and a short call is called "ended early"', async ({
    page,
  }) => {
    const call = await createCall(page);
    await sayViaApi(page, call.id, 'Hello, what is going on?');
    await endViaApi(page, call.id);
    await page.goto(`/sessions/${call.id}/report`);
    await expect(page.getByText('Ended early').first()).toBeVisible();
    await expect(
      page.getByText(
        'This call stopped before a wrap-up, so the Closing score rests on limited evidence.',
      ),
    ).toBeVisible();
    await expect(composer(page)).toHaveCount(0);
  });
});
