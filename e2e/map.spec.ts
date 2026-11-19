import { expect, test, type Page } from '@playwright/test';
import { createCall, endViaApi, sayViaApi } from './helpers.ts';

const node = (page: Page, title: RegExp | string) =>
  page.getByRole('toolbar', { name: 'Missions' }).getByRole('button', { name: title });

test.describe('the mission map', () => {
  test('opens on the map, is explored with the keyboard and sets up the selected mission', async ({
    page,
  }) => {
    await page.goto('/scenarios');
    await expect(page.getByRole('radio', { name: 'Map' })).toBeChecked();
    await expect(page.getByRole('toolbar', { name: 'Missions' })).toBeVisible();

    // A first-time trainee is pointed at a short, gentle call, and told why.
    const first = node(page, /A user needs help finding a feature/);
    await expect(first).toHaveAttribute('aria-pressed', 'true');
    const panel = page.getByRole('article');
    await expect(panel.getByText('Recommended next mission')).toBeVisible();
    await expect(panel).toContainText('A gentle place to start');
    await expect(first.getByText('Recommended')).toBeVisible();

    // Exactly one stop for Tab; arrows move between missions, Enter selects.
    const stops = await page
      .getByRole('toolbar', { name: 'Missions' })
      .getByRole('button')
      .evaluateAll((buttons) => buttons.filter((b) => b.getAttribute('tabindex') === '0').length);
    expect(stops).toBe(1);
    await first.focus();
    await page.keyboard.press('ArrowRight');
    await expect(first).not.toBeFocused();
    const moved = page.locator('.mm-node:focus');
    await expect(moved).toHaveCount(1);
    await expect(moved).toHaveAttribute('aria-pressed', 'false');
    await page.keyboard.press('Enter');
    await expect(moved).toHaveAttribute('aria-pressed', 'true');
    await expect(first).toHaveAttribute('aria-pressed', 'false');

    // Home and End reach the ends of the path (the gentlest call and the hardest).
    await page.keyboard.press('End');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('article').getByText('Challenge', { exact: true })).toBeVisible();

    // The panel offers the same actions as a card, and Set up call goes to setup.
    const title = await page.getByRole('article').getByRole('heading', { level: 2 }).innerText();
    await page.getByRole('link', { name: `Set up call: ${title}` }).click();
    await expect(page).toHaveURL(/\/scenarios\/[\w-]+\/setup$/);
    await expect(
      page.getByRole('heading', { level: 2, name: 'Is this the issue you want to practise?' }),
    ).toBeVisible();
  });

  test('search narrows the map without moving anything, and Preview opens the usual dialog', async ({
    page,
  }) => {
    await page.goto('/scenarios');
    await expect(page.locator('.mm-slot')).toHaveCount(13);
    const positions = async () =>
      page
        .locator('.mm-slot')
        .evaluateAll((slots) => slots.map((s) => (s as HTMLElement).style.cssText));
    const before = await positions();
    expect(before).toHaveLength(13);

    await page.getByRole('searchbox', { name: 'Search scenarios' }).fill('checkout');
    await expect(
      page.getByRole('status').filter({ hasText: 'Showing 1 of 13 scenarios' }),
    ).toBeVisible();
    await expect(page.getByRole('article').getByRole('heading', { level: 2 })).toHaveText(
      /Checkout is down/,
    );
    expect(await positions()).toEqual(before); // spatial memory: nothing moved
    await expect(page.locator('.mm-node[data-match="false"]')).toHaveCount(12);
    await expect(page.locator('.mm-node[data-match="false"]').first()).toHaveAttribute('inert', '');

    await page.getByRole('button', { name: /^Preview / }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('the list is one switch away, remembered, and kept through filters', async ({ page }) => {
    await page.goto('/scenarios');
    await page.getByRole('radio', { name: 'List' }).check({ force: true });
    await expect(page).toHaveURL(/view=list/);
    await expect(page.getByRole('article')).toHaveCount(13);
    await expect(page.getByLabel('Sort by')).toBeVisible();

    await page.getByLabel('Difficulty').selectOption('starter');
    await expect(page).toHaveURL(/view=list/);
    await expect(page.getByRole('article')).toHaveCount(4);

    // Next visit (no address choice) uses what was chosen last.
    await page.goto('/scenarios');
    await expect(page.getByRole('radio', { name: 'List' })).toBeChecked();
    await expect(page.getByRole('toolbar', { name: 'Missions' })).toHaveCount(0);
  });

  test('a finished call lights its mission and the path to it', async ({ page }) => {
    const call = await createCall(page);
    await sayViaApi(page, call.id, "Hello, I'm Sam. What error do you see on the screen?");
    await sayViaApi(page, call.id, 'When did it start, and has anything changed recently?');
    await sayViaApi(
      page,
      call.id,
      "I'll update you by 3pm. Is there anything else I can help with?",
    );
    await endViaApi(page, call.id);

    await page.goto('/scenarios');
    const practised = node(page, /Locked out after a password reset/);
    await expect(practised).toHaveAttribute('data-state', 'practised');
    await expect(practised).toContainText('Practised');
    await expect(page.locator('.mm-link[data-lit="true"]')).not.toHaveCount(0);
    await practised.click();
    await expect(page.getByRole('article')).toContainText(/Practised, best \d\.\d/);
  });
});

test.describe('the library on a phone @mobile', () => {
  test('shows the list only, with no map and no switch', async ({ page }) => {
    await page.goto('/scenarios');
    await expect(page.getByRole('article').first()).toBeVisible();
    await expect(page.getByRole('toolbar', { name: 'Missions' })).toHaveCount(0);
    await expect(page.getByRole('radio', { name: 'Map' })).toHaveCount(0);
  });
});
