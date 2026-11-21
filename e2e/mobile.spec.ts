import type { Page } from '@playwright/test';
import { expect, test } from './support/fixtures.ts';
import {
  callScreen,
  converse,
  endCallAndOpenReport,
  startTypedCall,
} from './support/call-screen.ts';

// The main journeys on a phone (the "mobile" project, a Pixel 7: touch, 412 px wide). The layout is
// different at this width: the header keeps Scenarios and Responsible AI in a Menu, the scenario list
// is a list of links that opens each scenario on a page of its own (with a Back), and the call has a
// dock of controls and its case in a sheet. Layout and accessibility sweeps at every width are in the
// responsive and accessibility specs; these only prove that a person can get from the start to a
// report with a thumb, and that nothing makes the page wider than the screen on the way.

test.describe.configure({ timeout: 90_000 });

async function expectNoSideways(page: Page, where: string) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, `${where} is wider than the screen`).toBeLessThanOrEqual(0);
}

const list = (page: Page) => page.getByRole('list', { name: 'Scenarios', exact: true });
const count = (page: Page) =>
  page
    .getByRole('main')
    .getByRole('status')
    .filter({ hasText: /\bscenarios?$/ });

test('@mobile choose a scenario, read the brief, hold a typed call and open the report on a phone', async ({
  page,
}) => {
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

  await test.step('a touch on Start call opens the scenarios, as a list of links', async () => {
    await page.getByRole('banner').getByRole('link', { name: 'Start call' }).tap();
    await expect(page.getByRole('heading', { level: 1, name: 'Scenarios' })).toBeVisible();
    await expect(count(page)).toHaveText('16 scenarios');
    await expect(list(page).getByRole('link')).toHaveCount(16);
    await expectNoSideways(page, 'The scenario list');
  });

  await test.step('touching a scenario opens its details on a page of its own, with the setup and the way on', async () => {
    await list(page)
      .getByRole('link', { name: 'Shared team mailbox missing from Outlook', exact: true })
      .tap();
    await expect(
      page.getByRole('heading', { level: 1, name: 'Shared team mailbox missing from Outlook' }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Scenarios', exact: true })).toBeVisible();
    await expect(page.getByRole('group', { name: 'Preset' })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Customise/ })).toBeVisible();
    await expectNoSideways(page, 'The scenario details');
    await page.getByRole('link', { name: 'Review brief' }).tap();
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

test('@mobile the scenario list has filters behind a button, opens a scenario with a Back, and gives focus back to its row', async ({
  page,
  api,
}) => {
  const scenarios = await api.scenarios();
  await page.goto('/scenarios');
  await expect(count(page)).toHaveText('16 scenarios');
  const filters = page.getByRole('button', { name: 'Filters', exact: true });
  await expect(filters).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByRole('combobox', { name: 'Product' })).toBeHidden();

  await test.step('Filters opens the three filters, and says how many are in use', async () => {
    await filters.tap();
    await expect(filters).toHaveAttribute('aria-expanded', 'true');
    await page.getByRole('combobox', { name: 'Product' }).selectOption('windows-11');
    await expect(page.getByRole('button', { name: 'Filters (1)' })).toBeVisible();
    const windows = scenarios.filter((scenario) => scenario.product.id === 'windows-11');
    await expect(list(page).getByRole('link')).toHaveCount(windows.length);
    await expect(count(page)).toHaveText(`${windows.length} of 16 scenarios`);
    await expectNoSideways(page, 'The filtered list');
  });

  const chosen = scenarios.find((scenario) => scenario.product.id === 'windows-11')!;
  await test.step('opening a row pushes the details, and focus moves to the title', async () => {
    await list(page).getByRole('link', { name: chosen.title, exact: true }).tap();
    const title = page.getByRole('heading', { level: 1, name: chosen.title });
    await expect(title).toBeVisible();
    await expect(title).toBeFocused();
    await expect.poll(() => new URL(page.url()).searchParams.get('scenario')).toBe(chosen.id);
  });

  await test.step('Back returns to the list, with the filter still on, and focus on the row that was open', async () => {
    await page.getByRole('button', { name: 'Scenarios', exact: true }).tap();
    await expect(list(page)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Filters (1)' })).toBeVisible();
    await expect(list(page).getByRole('link', { name: chosen.title, exact: true })).toBeFocused();
    await expect.poll(() => new URL(page.url()).searchParams.get('scenario')).toBeNull();
  });

  await test.step('the browser back button does the same from a scenario', async () => {
    await list(page).getByRole('link', { name: chosen.title, exact: true }).tap();
    await expect(page.getByRole('heading', { level: 1, name: chosen.title })).toBeVisible();
    await page.goBack();
    await expect(list(page)).toBeVisible();
  });

  await test.step('a shared link to a scenario opens its details straight away', async () => {
    await page.goto(`/scenarios?scenario=${chosen.id}`);
    await expect(page.getByRole('heading', { level: 1, name: chosen.title })).toBeVisible();
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
    await open.tap();
    const sheet = page.getByRole('dialog', { name: 'Case' });
    await expect(sheet).toBeVisible();
    await expect(sheet).toContainText('Context found');
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
