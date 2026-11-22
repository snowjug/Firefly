import type { Page } from '@playwright/test';
import { expect, test } from './support/fixtures.ts';
import {
  callScreen,
  converse,
  endCallAndOpenReport,
  startTypedCall,
} from './support/call-screen.ts';

// The main journeys on a phone (the "mobile" project, a Pixel 7: touch, 412 px wide). The layout is
// different at this width: the header keeps Scenarios and Responsible AI in a Menu, the scenarios are a
// row of cards that peek and swipe above the details of the chosen one, and the call has a dock of
// controls and its case in a sheet. Layout and accessibility sweeps at every width are in the
// responsive and accessibility specs, and the carousel's own touch behaviour is in carousel.spec.ts;
// these only prove that a person can get from the start to a report with a thumb, and that nothing
// makes the page wider than the screen on the way.

test.describe.configure({ timeout: 90_000 });

async function expectNoSideways(page: Page, where: string) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, `${where} is wider than the screen`).toBeLessThanOrEqual(0);
}

const gallery = (page: Page) => page.getByRole('region', { name: 'Scenarios', exact: true });
const count = (page: Page) =>
  page
    .getByRole('main')
    .getByRole('status')
    .filter({ hasText: /\bscenarios?$/ });

test('@mobile choose a scenario, read the brief, hold a typed call and open the report on a phone', async ({
  page,
  api,
}) => {
  const chosen = (await api.scenarios()).find(
    (scenario) => scenario.id === 'outlook-shared-mailbox-missing',
  )!;
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Practise Microsoft support calls safely.',
  );
  await expectNoSideways(page, 'The landing page');

  await test.step('Scenarios and Responsible AI are behind the Menu, and Start call stays in the bar', async () => {
    const header = page.getByRole('banner');
    const menu = header.getByRole('button', { name: 'Menu' });
    await expect(menu).toHaveAttribute('aria-expanded', 'false');
    await expect(header.getByRole('navigation', { name: 'Primary' })).toBeHidden();
    await menu.tap();
    await expect(menu).toHaveAttribute('aria-expanded', 'true');
    const primary = header.getByRole('navigation', { name: 'Primary' });
    await expect(primary.getByRole('link')).toHaveText(['Scenarios', 'Responsible AI']);
    await menu.tap();
    await expect(menu).toHaveAttribute('aria-expanded', 'false');
    await expect(header.getByRole('link', { name: 'Start call' })).toBeVisible();
  });

  await test.step('a touch on Start call opens the scenarios, as a row of cards', async () => {
    await page.getByRole('banner').getByRole('link', { name: 'Start call' }).tap();
    await expect(page.getByRole('heading', { level: 1, name: 'Scenarios' })).toBeVisible();
    await expect(count(page)).toHaveText('16 scenarios');
    await expect(gallery(page).getByRole('radio')).toHaveCount(16);
    await expectNoSideways(page, 'The scenarios');
  });

  await test.step('touching a card chooses it, and its details, the setup and the way on are on the same page', async () => {
    // The workspace tidies its address once the list has arrived; a choice made before that is lost.
    await expect(page).toHaveURL(/[?&]scenario=/);
    const card = gallery(page).getByRole('radio', { name: chosen.shortTitle, exact: true });
    await card.scrollIntoViewIfNeeded();
    await card.tap();
    await expect(card).toBeChecked();
    const details = page.getByRole('region', { name: chosen.title, exact: true });
    await expect(details.getByRole('heading', { level: 2, name: chosen.title })).toBeVisible();
    await expect(details.getByRole('group', { name: 'Preset' })).toBeVisible();
    await expect(details.getByRole('button', { name: /^Customise/ })).toBeVisible();
    await expectNoSideways(page, 'The scenario details');
    await details.getByRole('link', { name: 'Start configuration' }).tap();
  });

  await test.step('the brief says what the microphone and speech will do, then a typed call starts', async () => {
    await expect(page.getByRole('heading', { level: 1, name: 'Case brief' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Support case' }).getByRole('term')).toHaveCount(
      6,
    );
    await expect(page.getByRole('region', { name: 'Privacy notice' })).toContainText(
      'Do not share real customer information.',
    );
    await expectNoSideways(page, 'The brief');
    await page.getByRole('button', { name: 'Start a text-only call' }).tap();
  });

  const screen = callScreen(page);
  await test.step('the pre-flight, then the call, with the customer, the transcript and the reply box', async () => {
    await expect(screen.preflight.heading).toBeVisible();
    await expectNoSideways(page, 'The pre-flight');
    await screen.preflight.startText.tap();
    await expect(screen.reply).toBeVisible();
    await expect(screen.turns).toHaveCount(1);
    await expectNoSideways(page, 'The call');
  });

  await test.step('a typed exchange works with the on-screen keyboard layout', async () => {
    await screen.reply.fill('Hello, my name is Sam. Can you tell me what is happening?');
    await screen.send.tap();
    await expect(screen.turns).toHaveCount(3);
    await converse(
      screen,
      ['When did it last work, and did anything change before it stopped?'],
      3,
    );
    await expectNoSideways(page, 'The call after two exchanges');
  });

  await test.step('End call is always reachable, and ending opens the report', async () => {
    await screen.endCall.tap();
    await expect(screen.endDialog).toBeVisible();
    await screen.endDialog.getByRole('button', { name: 'End and review' }).tap();
    await expect(page.getByRole('region', { name: 'Summary', exact: true })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole('heading', { level: 1, name: 'Coaching report' })).toBeVisible();
    await expectNoSideways(page, 'The report');
  });
});

test('@mobile the call keeps its controls in a dock at the bottom, and the case opens in a sheet', async ({
  page,
  api,
}) => {
  const { screen } = await startTypedCall(page, api);
  await expectNoSideways(page, 'A typed call on a phone');

  await test.step('the controls are in the dock, inside the screen', async () => {
    const dock = page.locator('.cw-dock');
    await expect(dock.getByRole('group', { name: 'Call controls' })).toBeVisible();
    const box = (await dock.boundingBox())!;
    const view = page.viewportSize()!;
    expect(box.y + box.height).toBeLessThanOrEqual(view.height + 1);
  });

  await test.step('the case opens in a sheet that closes with its button, and focus goes back', async () => {
    const open = page.getByRole('button', { name: 'Case', exact: true });
    // There is room beside the icon on a phone this wide, so the button says what it is.
    await expect(page.locator('.cw-bar__case-label')).toBeVisible();
    // And the bar still says who plays the customer, beside the time and Live.
    await expect(page.locator('.cw-bar').getByText('Demo mode', { exact: true })).toBeVisible();
    await open.tap();
    const sheet = page.getByRole('dialog', { name: 'Case' });
    await expect(sheet).toBeVisible();
    await expect(sheet).toContainText('Objective');
    // A standard call shows no live count of what has been found: that would be a cue.
    await expect(sheet).not.toContainText('Context found');
    await sheet.getByRole('button', { name: 'Close', exact: true }).tap();
    await expect(sheet).toBeHidden();
    await expect(open).toBeFocused();
  });

  await test.step('a reply is sent from the thumb, and End call is within reach', async () => {
    await screen.reply.fill('Hello, my name is Sam. What is happening?');
    await screen.send.tap();
    await expect(screen.turns).toHaveCount(3);
    await expect(screen.endCall).toBeVisible();
    expect(await endCallAndOpenReport(page, screen)).toBeTruthy();
  });
});
