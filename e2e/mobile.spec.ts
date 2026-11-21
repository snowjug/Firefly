import type { Page } from '@playwright/test';
import { expect, test } from './support/fixtures.ts';
import { callScreen, sendTyped } from './support/call-screen.ts';

// The main journey on a phone (the "mobile" project, a Pixel 7): the layout is different at this
// width (the scenario details open in a sheet, the call has a dock instead of a side panel), so the
// same steps are walked with a touch screen. Layout and accessibility sweeps at every width are in
// the responsive and accessibility specs; this one only proves that a person can get from the
// start to a report, and that nothing makes the page wider than the screen on the way.

test.describe.configure({ timeout: 90_000 });

async function expectNoSideways(page: Page, where: string) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, `${where} is wider than the screen`).toBeLessThanOrEqual(0);
}

test('@mobile choose a scenario, read the brief, hold a typed call and open the report on a phone', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Practise the conversation');
  await expectNoSideways(page, 'The landing page');

  await test.step('the header offers a way to start, and a touch on it opens the scenarios', async () => {
    await page.getByRole('banner').getByRole('link', { name: 'Start simulation' }).tap();
    await expect(page.getByRole('heading', { level: 1, name: 'Choose a scenario' })).toBeVisible();
    await expectNoSideways(page, 'The scenario list');
  });

  await test.step('touching a scenario opens its details and setup in a sheet', async () => {
    await page.getByRole('radio', { name: 'Locked out after a password reset', exact: true }).tap();
    const sheet = page.getByRole('dialog', { name: 'Locked out after a password reset' });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole('heading', { level: 3, name: 'Call setup' })).toBeVisible();
    await sheet.getByRole('link', { name: 'Continue to call brief' }).tap();
  });

  await test.step('the brief says what the microphone and speech will do, then a typed call starts', async () => {
    await expect(page.getByRole('heading', { level: 1, name: 'Call brief' })).toBeVisible();
    await expect(page.getByRole('complementary', { name: 'Before you start' })).toContainText(
      'Firefly does not store the audio',
    );
    await expectNoSideways(page, 'The brief');
    await page.getByRole('button', { name: 'Start a text-only call' }).tap();
  });

  const screen = callScreen(page);
  await test.step('the pre-flight, then the call, with the customer, the transcript and the reply box', async () => {
    await expect(screen.preflight.heading).toBeVisible();
    await expectNoSideways(page, 'The pre-flight');
    await screen.preflight.textOnly.tap();
    await expect(screen.reply).toBeVisible();
    await expect(screen.turns).toHaveCount(1);
    await expectNoSideways(page, 'The call');
  });

  await test.step('a typed exchange works with the on-screen keyboard layout', async () => {
    await screen.reply.fill('Hello, my name is Sam. Can you tell me what is happening?');
    await screen.send.tap();
    await expect(screen.turns).toHaveCount(3);
    await sendTyped(screen, 'When did it last work, and did anything change before it stopped?');
    await expect(screen.turns).toHaveCount(5);
    await expectNoSideways(page, 'The call after two exchanges');
  });

  await test.step('End call is always reachable, and ending opens the report', async () => {
    await screen.endCall.tap();
    await expect(screen.endDialog).toBeVisible();
    await screen.endDialog.getByRole('button', { name: 'End and review' }).tap();
    await expect(page.getByRole('region', { name: 'Overall coaching summary' })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole('heading', { level: 1, name: 'Coaching report' })).toBeVisible();
    await expectNoSideways(page, 'The report');
  });
});
