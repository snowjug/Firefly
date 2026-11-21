import { expect, test } from './support/fixtures.ts';
import { GOOD_CALL } from './support/api.ts';
import {
  STATUS,
  callScreen,
  converse,
  sendTyped,
  startSpokenCall,
  startTypedCall,
} from './support/call-screen.ts';
import { lengthenCustomerVoice } from './support/a11y.ts';
import { isMockUtterance } from './support/mock-speech.ts';
import { expectNoRawFailureText } from './support/raw-text.ts';

// Resilience: a page that is reloaded, an address that is stale, a connection that drops and a call
// that has grown long. Each of these must leave the person with what they had and a way on: the
// message that was kept stays visible, Retry works, no turn appears twice, and the call can be ended
// safely.

test.describe.configure({ timeout: 90_000 });

test.describe('a call that is reloaded', () => {
  test('resumes with the transcript intact, and carries on', async ({ page, api }) => {
    const { call, screen } = await startTypedCall(page, api);
    await converse(screen, [
      'Hello, my name is Sam. Can you tell me what is happening?',
      'When did it last work, and did anything change before it stopped?',
    ]);
    const before = (await api.session(call.id)).turns.map((turn) => turn.text);

    await page.reload();

    await test.step('the pre-flight says the call is still open and shows the transcript so far', async () => {
      await expect(screen.preflight.resumeHeading).toBeVisible();
      await expect(page.getByText('Time so far')).toBeVisible();
      const soFar = page
        .locator('section')
        .filter({ has: page.getByRole('heading', { level: 2, name: 'Transcript so far' }) });
      await expect(soFar).toContainText('Hello, my name is Sam.');
      await expect(soFar).toContainText('When did it last work');
    });

    await test.step('resuming brings the whole transcript back, and the call goes on', async () => {
      await screen.preflight.resumeText.click();
      await expect(screen.turns).toHaveCount(5);
      for (const [index, text] of before.entries()) {
        await expect(screen.turns.nth(index)).toContainText(text.slice(0, 40));
      }
      await sendTyped(screen, 'What have you already tried so far?');
      await expect(screen.turns).toHaveCount(7);
      expect((await api.session(call.id)).traineeTurns).toBe(3);
    });
  });

  test('a message the customer never answered is kept and offers Retry, and is not sent twice', async ({
    page,
    api,
    problems,
  }) => {
    problems.allow({ status: 502, url: '/messages' });
    const { call, screen } = await startTypedCall(page, api);
    await api.failNext('customer', 1);
    await sendTyped(screen, 'Hello, my name is Sam. Can you tell me what is happening?');

    await test.step('the customer could not reply: what happened, what was kept, what to do', async () => {
      await expect(screen.problem.title).toHaveText('The customer could not reply.');
      await expect(screen.problem.card).toContainText('Your message was saved.');
      await expect(screen.problem.card).toContainText('Retry sends it once, never twice.');
      await expect(screen.turns).toHaveCount(2);
      await expect(screen.turns.last()).toContainText('Not sent');
      await expect(screen.turns.last()).toContainText('Hello, my name is Sam.');
      await expect(screen.problem.retry).toHaveCount(1);
      await expect(screen.problem.endSafely).toBeVisible();
      await expectNoRawFailureText(page);
    });

    await test.step('a reload keeps the unanswered message, and it can still be retried', async () => {
      await page.reload();
      await expect(screen.preflight.resumeHeading).toBeVisible();
      await screen.preflight.resumeText.click();
      await expect(screen.turns).toHaveCount(2);
      await expect(screen.turns.last()).toContainText('Hello, my name is Sam.');
      await expect(screen.turns.last()).toContainText('Not sent');
      await screen.problem.retry.click();
      await expect(screen.turns).toHaveCount(3);
      await expect(page.getByText('Not sent')).toHaveCount(0);
      await expect(screen.problem.card).toHaveCount(0);
    });

    await test.step('the call holds one message, not two', async () => {
      const saved = await api.session(call.id);
      expect(saved.turns.filter((turn) => turn.role === 'trainee')).toHaveLength(1);
      expect(saved.awaitingReply).toBeNull();
    });
  });

  test('"End safely" after a failed reply ends the call, keeps the message, and opens the report', async ({
    page,
    api,
    problems,
  }) => {
    problems.allow({ status: 502, url: '/messages' });
    const { call, screen } = await startTypedCall(page, api);
    await api.failNext('customer', 1);
    await sendTyped(screen, 'Hello, my name is Sam. Can you tell me what is happening?');
    await expect(screen.problem.endSafely).toBeVisible();

    await screen.problem.endSafely.click();
    await expect(screen.endDialog).toBeVisible();
    await screen.endDialog.getByRole('button', { name: 'End and review' }).click();
    await expect(page).toHaveURL(new RegExp(`/sessions/${call.id}/report$`));
    await expect(page.getByRole('heading', { level: 1, name: 'Coaching report' })).toBeVisible({
      timeout: 30_000,
    });
    // The message that could not be answered is in the transcript of the report, once.
    await expect(
      page
        .getByRole('region', { name: 'Transcript', exact: true })
        .getByText('Hello, my name is Sam.'),
    ).toHaveCount(1);
    const saved = await api.session(call.id);
    expect(saved.turns.filter((turn) => turn.role === 'trainee')).toHaveLength(1);
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
    await expect(page.getByRole('heading', { level: 1, name: 'Scenarios' })).toBeVisible();
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
    await api.remove(done.id);
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
  test('says so, keeps the message and the transcript, and sends it once when the connection is back', async ({
    page,
    api,
    context,
    problems,
  }) => {
    problems.allowOffline();
    const { call, screen } = await startTypedCall(page, api);
    await converse(screen, ['Hello, my name is Sam. Can you tell me what is happening?']);

    await context.setOffline(true);
    await expect(screen.status).toHaveText(STATUS.offline);
    await expect(page.getByRole('banner').or(page.locator('.cw-bar'))).toContainText('Offline');

    await test.step('a message sent offline is kept, with what to do', async () => {
      await sendTyped(screen, 'When did it last work, and did anything change before it stopped?');
      await expect(screen.problem.title).toHaveText('You appear to be offline.');
      await expect(screen.problem.card).toContainText('Your message is kept.');
      await expect(screen.turns).toHaveCount(4);
      await expect(screen.turns.nth(1)).toContainText('Hello, my name is Sam.');
      await expect(screen.turns.last()).toContainText('Not sent');
      await expect(screen.turns.last()).toContainText('When did it last work');
    });

    await test.step('Retry while still offline changes nothing: the message stays, once', async () => {
      await screen.problem.retry.click();
      await expect(screen.problem.title).toHaveText('You appear to be offline.');
      await expect(screen.turns).toHaveCount(4);
      await expect(screen.turns.last()).toContainText('Not sent');
    });

    await test.step('back online, the kept message is sent once by itself and the customer replies', async () => {
      await context.setOffline(false);
      await expect(screen.turns).toHaveCount(5);
      await expect(screen.problem.card).toHaveCount(0);
      await expect(screen.turns.nth(3)).not.toContainText('Not sent');
      const saved = await api.session(call.id);
      expect(saved.turns.filter((turn) => turn.role === 'trainee')).toHaveLength(2);
      expect(
        saved.turns.filter((turn) => turn.text.includes('When did it last work')),
      ).toHaveLength(1);
    });
  });

  test('a spoken turn lost to the connection keeps the call, and Retry sends what was said', async ({
    page,
    api,
    context,
    problems,
  }) => {
    problems.allowOffline();
    problems.allow({ status: 502, url: '/api/speech/transcribe' });
    await lengthenCustomerVoice(page, 30);
    const { call, screen } = await startSpokenCall(page, api);
    await expect(screen.status).toHaveText(STATUS.speaking);
    await screen.stopAudio.click();
    await expect(screen.status).toHaveText(STATUS.hearing, { timeout: 20_000 });

    await test.step('the connection goes while the trainee is speaking', async () => {
      await context.setOffline(true);
      await expect(screen.problem.title).toHaveText(
        /Firefly could not reach the speech service\.|Your speech could not be turned into text\./,
        { timeout: 30_000 },
      );
      await expect(screen.problem.card).toContainText('Your call and its transcript are safe.');
      await expect(screen.turns).toHaveCount(1);
      await expectNoRawFailureText(page);
    });

    await test.step('back online, Retry sends it, and it is one turn', async () => {
      await context.setOffline(false);
      await screen.problem.retry.click();
      await expect(screen.turns).toHaveCount(3, { timeout: 30_000 });
      const text = (await screen.turns.nth(1).locator('.cw-turn__text').innerText()).trim();
      expect(isMockUtterance(text)).toBe(true);
      const saved = await api.session(call.id);
      expect(saved.turns.filter((turn) => turn.role === 'trainee')).toHaveLength(1);
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
    await page.getByRole('banner').getByRole('link', { name: 'Start call' }).click();
    await expect(
      page
        .getByRole('main')
        .getByRole('status')
        .filter({ hasText: /scenarios$/ }),
    ).toHaveText('16 scenarios');
    await page.getByRole('link', { name: 'Firefly home' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      'Practise Microsoft support calls',
    );

    await context.setOffline(true);
    await page.getByRole('banner').getByRole('link', { name: 'Start call' }).click();
    await expect(page.getByText('Scenarios could not be loaded', { exact: true })).toBeVisible();
    await expect(
      page.getByText(/You are offline, so the scenarios could not be loaded/),
    ).toBeVisible();
    await expectNoRawFailureText(page);

    await context.setOffline(false);
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(
      page
        .getByRole('main')
        .getByRole('status')
        .filter({ hasText: /scenarios$/ }),
    ).toHaveText('16 scenarios');
  });

  test('a scenario list that the server cannot give says so in words, and Try again loads it', async ({
    page,
    problems,
  }) => {
    problems.allow({ status: 500, url: '/api/scenarios' });
    let failing = true;
    await page.route('**/api/scenarios', async (route) => {
      if (failing) {
        await route.fulfill({
          status: 500,
          json: {
            error: {
              code: 'internal',
              message: 'Something went wrong on our side.',
              retryable: true,
            },
          },
        });
        return;
      }
      await route.fallback();
    });
    await page.goto('/scenarios');
    await expect(page.getByText('Scenarios could not be loaded', { exact: true })).toBeVisible();
    await expectNoRawFailureText(page);
    failing = false;
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(
      page
        .getByRole('main')
        .getByRole('status')
        .filter({ hasText: /scenarios$/ }),
    ).toHaveText('16 scenarios');
  });

  test('a page whose code cannot be fetched offline says so in its own words, and loads once back online', async ({
    page,
    context,
    problems,
  }) => {
    problems.allowOffline();
    await page.goto('/');
    await context.setOffline(true);
    await page.getByRole('contentinfo').getByRole('link', { name: 'About' }).click();
    await expect(
      page.getByRole('heading', { level: 1, name: 'This page did not load' }),
    ).toBeVisible();
    await expect(page.getByText('You are offline. Reconnect, then try again.')).toBeVisible();
    await expect(page.getByText('Saved calls and reports are not affected.')).toBeVisible();
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
    const screen = callScreen(page);
    await screen.preflight.resumeText.click();
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
      await expect(page.getByRole('region', { name: 'Summary', exact: true })).toBeVisible({
        timeout: 30_000,
      });
      const total = saved.turns.length + 2;
      await expect(page.getByRole('radio', { name: `All turns (${total})` })).toBeChecked();
    });
  });
});
