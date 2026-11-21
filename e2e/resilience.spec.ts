import { expect, test } from './support/fixtures.ts';
import { GOOD_CALL } from './support/api.ts';
import { callScreen, sendTyped, startTypedCall } from './support/call-screen.ts';
import { expectNoRawFailureText } from './support/raw-text.ts';

// Resilience: a page that is reloaded, an address that is stale, a connection that drops and a call
// that has grown long. Each of these must leave the person with what they had and a way on.

test.describe.configure({ timeout: 90_000 });

test.describe('a call that is reloaded', () => {
  test('resumes with the transcript intact, and carries on', async ({ page, api }) => {
    const { call, screen } = await startTypedCall(page, api);
    await sendTyped(screen, 'Hello, my name is Sam. Can you tell me what is happening?');
    await expect(screen.turns).toHaveCount(3);
    await sendTyped(screen, 'When did it last work, and did anything change before it stopped?');
    await expect(screen.turns).toHaveCount(5);
    const before = (await api.session(call.id)).turns.map((turn) => turn.text);

    await page.reload();

    await test.step('the pre-flight says the call is still open and shows the transcript so far', async () => {
      await expect(page.getByRole('heading', { level: 1, name: 'Resume your call' })).toBeVisible();
      await expect(
        page.getByText('Your call is still open and your transcript so far is saved.'),
      ).toBeVisible();
      const soFar = page
        .locator('section')
        .filter({ has: page.getByRole('heading', { level: 2, name: 'Transcript so far' }) });
      await expect(soFar).toContainText('Hello, my name is Sam.');
      await expect(soFar).toContainText('When did it last work');
    });

    await test.step('resuming brings the whole transcript back, and the call goes on', async () => {
      await page.getByRole('button', { name: 'Resume as a text-only call' }).click();
      await expect(screen.turns).toHaveCount(5);
      for (const [index, text] of before.entries()) {
        await expect(screen.turns.nth(index)).toContainText(text.slice(0, 40));
      }
      await sendTyped(screen, 'What have you already tried so far?');
      await expect(screen.turns).toHaveCount(7);
      expect((await api.session(call.id)).traineeTurns).toBe(3);
    });
  });

  test('a message the customer never answered is kept and offers Try again, and is not sent twice', async ({
    page,
    api,
    problems,
  }) => {
    problems.allow({ status: 502, url: '/messages' });
    const { call, screen } = await startTypedCall(page, api);
    await api.failNext('customer', 1);
    await sendTyped(screen, 'Hello, my name is Sam. Can you tell me what is happening?');

    await test.step('the customer could not reply: what happened, what was kept, what to do', async () => {
      await expect(page.getByText('The customer could not reply.')).toBeVisible();
      await expect(page.getByText('Your message was saved.')).toBeVisible();
      await expect(
        page.getByText('Choose Try again to send it again. It will not be sent twice.'),
      ).toBeVisible();
      await expect(screen.turns.last()).toContainText('Not sent. Your words are kept.');
    });

    await test.step('a reload keeps the unanswered message, and it can still be retried', async () => {
      await page.reload();
      await expect(page.getByRole('heading', { level: 1, name: 'Resume your call' })).toBeVisible();
      await page.getByRole('button', { name: 'Resume as a text-only call' }).click();
      await expect(screen.turns).toHaveCount(2);
      await expect(screen.turns.last()).toContainText('Hello, my name is Sam.');
      await expect(screen.turns.last()).toContainText('Not sent. Your words are kept.');
      await page.getByRole('button', { name: 'Try again' }).first().click();
      await expect(screen.turns).toHaveCount(3);
      await expect(page.getByText('Not sent. Your words are kept.')).toHaveCount(0);
    });

    await test.step('the call holds one message, not two', async () => {
      const saved = await api.session(call.id);
      expect(saved.turns.filter((turn) => turn.role === 'trainee')).toHaveLength(1);
      expect(saved.awaitingReply).toBeNull();
    });
  });
});

test.describe('an address that is stale', () => {
  test('a call that does not exist says so and leads back to the scenarios', async ({
    page,
    problems,
  }) => {
    problems.allow({ status: 404, url: '/api/sessions/' });
    await page.goto('/calls/not-a-call');
    await expect(
      page.getByRole('heading', {
        level: 1,
        name: /could not find this call|could not be opened/i,
      }),
    ).toBeVisible();
    await page.getByRole('link', { name: 'Back to scenarios' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Choose a scenario' })).toBeVisible();
  });

  test('a report that does not exist says so, and offers a scenario or home', async ({
    page,
    problems,
  }) => {
    problems.allow({ status: 404, url: '/api/sessions/' });
    await page.goto('/sessions/not-a-call/report');
    await expect(page.getByRole('heading', { level: 1, name: 'Report unavailable' })).toBeVisible();
    await expect(page.getByText('We could not find this call')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Choose a scenario' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Return home' })).toBeVisible();
  });

  test('a call that was deleted is gone from its call page and its report page', async ({
    page,
    api,
    problems,
  }) => {
    problems.allow({ status: 404, url: '/api/sessions/' });
    const done = await api.completedCall({ lines: GOOD_CALL.slice(0, 2) });
    await page.request.delete(`/api/sessions/${done.id}`);
    await page.goto(`/sessions/${done.id}/report`);
    await expect(page.getByRole('heading', { level: 1, name: 'Report unavailable' })).toBeVisible();
    await page.goto(`/calls/${done.id}`);
    await expect(
      page.getByRole('heading', {
        level: 1,
        name: /could not find this call|could not be opened/i,
      }),
    ).toBeVisible();
  });

  test('the address of a finished call opens its report, and the report of a call in progress opens the call', async ({
    page,
    api,
  }) => {
    const done = await api.completedCall({ lines: GOOD_CALL.slice(0, 2) });
    await page.goto(`/calls/${done.id}`);
    await expect(page).toHaveURL(new RegExp(`/sessions/${done.id}/report$`));
    await expect(page.getByRole('heading', { level: 1, name: 'Coaching report' })).toBeVisible();

    const live = await api.createCall();
    await page.goto(`/sessions/${live.id}/report`);
    await expect(page).toHaveURL(new RegExp(`/calls/${live.id}$`));
    await expect(callScreen(page).preflight.heading).toBeVisible();
  });
});

test.describe('a connection that drops', () => {
  test('says so, keeps the message and the transcript, and sends it when the connection is back', async ({
    page,
    api,
    context,
    problems,
  }) => {
    problems.allowOffline();
    const { screen } = await startTypedCall(page, api);
    await sendTyped(screen, 'Hello, my name is Sam. Can you tell me what is happening?');
    await expect(screen.turns).toHaveCount(3);

    await context.setOffline(true);
    await expect(page.getByText('Offline', { exact: true })).toBeVisible();

    await test.step('a message sent offline is kept, with what to do', async () => {
      await sendTyped(screen, 'When did it last work, and did anything change before it stopped?');
      await expect(page.getByText('You appear to be offline.')).toBeVisible();
      await expect(page.getByText('Your message is kept here.')).toBeVisible();
      await expect(screen.turns).toHaveCount(4);
      await expect(screen.turns.nth(0)).toBeVisible();
      await expect(screen.turns.nth(1)).toContainText('Hello, my name is Sam.');
      await expect(screen.turns.last()).toContainText('Not sent. Your words are kept.');
    });

    await test.step('back online, Try again sends it once and the customer replies', async () => {
      await context.setOffline(false);
      await expect(page.getByText('Offline', { exact: true })).toBeHidden();
      await page.getByRole('button', { name: 'Try again' }).first().click();
      await expect(screen.turns).toHaveCount(5);
      await expect(page.getByText('You appear to be offline.')).toHaveCount(0);
    });
  });

  test('the scenario list says it cannot load when the connection is down, and loads when Try again is pressed online', async ({
    page,
    context,
    problems,
  }) => {
    problems.allowOffline();
    // Both pages are visited online first, so that their code is in the browser when the network goes.
    await page.goto('/');
    await page.getByRole('banner').getByRole('link', { name: 'Start simulation' }).click();
    await expect(page.getByText('13 scenarios', { exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'Firefly home' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      'Practise the conversation',
    );

    await context.setOffline(true);
    await page.getByRole('banner').getByRole('link', { name: 'Start simulation' }).click();
    await expect(page.getByText('Scenarios could not be loaded', { exact: true })).toBeVisible();
    await expect(
      page.getByText(/You are offline, so the scenarios could not be loaded/),
    ).toBeVisible();
    await expectNoRawFailureText(page);

    await context.setOffline(false);
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page.getByText('13 scenarios', { exact: true })).toBeVisible();
  });

  test('a page whose code cannot be fetched offline says so in its own words, and loads once back online', async ({
    page,
    context,
    problems,
  }) => {
    problems.allowOffline();
    await page.goto('/');
    await context.setOffline(true);
    await page.getByRole('banner').getByRole('link', { name: 'About' }).click();
    await expect(
      page.getByRole('heading', { level: 1, name: 'This page did not load' }),
    ).toBeVisible();
    await expect(
      page.getByText(
        'You are offline, so part of this page could not be fetched. Reconnect, then try again.',
      ),
    ).toBeVisible();
    await expect(
      page.getByText(
        'Calls, transcripts and reports that Firefly has already saved are not affected.',
      ),
    ).toBeVisible();
    await expectNoRawFailureText(page);

    await context.setOffline(false);
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'About Firefly' })).toBeVisible();
  });
});

test.describe('a long call', () => {
  test('with more than sixty turns opens, scrolls and goes on without errors, and still gives a report', async ({
    page,
    api,
  }) => {
    test.setTimeout(150_000);
    const call = await api.createCall();
    const lines = Array.from(
      { length: 31 },
      (_, index) => GOOD_CALL[index % GOOD_CALL.length] as string,
    );
    await api.play(call.id, lines);
    const saved = await api.session(call.id);
    expect(saved.turns.length).toBeGreaterThan(60);

    await page.goto(`/calls/${call.id}?input=text`);
    await page.getByRole('button', { name: 'Resume as a text-only call' }).click();
    const screen = callScreen(page);
    await expect(screen.turns).toHaveCount(saved.turns.length);

    await test.step('the transcript follows the newest turn, and scrolling away offers "Jump to latest"', async () => {
      const scroller = page.locator('#cw-transcript');
      await expect
        .poll(() => scroller.evaluate((el) => el.scrollHeight - el.scrollTop - el.clientHeight))
        .toBeLessThan(60);
      await scroller.evaluate((el) => el.scrollTo({ top: 0 }));
      await expect(page.getByRole('button', { name: 'Jump to latest' })).toBeVisible();
      await page.getByRole('button', { name: 'Jump to latest' }).click();
      await expect(page.getByRole('button', { name: 'Jump to latest' })).toBeHidden();
      await expect
        .poll(() => scroller.evaluate((el) => el.scrollHeight - el.scrollTop - el.clientHeight))
        .toBeLessThan(60);
    });

    await test.step('the page is responsive: a new message is sent and answered', async () => {
      const started = Date.now();
      await sendTyped(screen, 'Thanks. Is there anything else you want to tell me?');
      await expect(screen.turns).toHaveCount(saved.turns.length + 2);
      expect(Date.now() - started).toBeLessThan(10_000);
      await expect(screen.reply).toHaveValue('');
    });

    await test.step('the report for the long call has every turn', async () => {
      await screen.endCall.click();
      await screen.endDialog.getByRole('button', { name: 'End and review' }).click();
      await expect(page.getByRole('region', { name: 'Overall coaching summary' })).toBeVisible({
        timeout: 30_000,
      });
      const total = saved.turns.length + 2;
      await expect(page.getByRole('radio', { name: `All turns (${total})` })).toBeChecked();
    });
  });
});
