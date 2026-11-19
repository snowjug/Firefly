import { expect, test } from '@playwright/test';
import {
  composer,
  createCall,
  expectNoSeriousA11yViolations,
  failNext,
  say,
  sayViaApi,
} from './helpers.ts';

test.describe('the live call', () => {
  test('sends with Enter, shows the customer reply and keeps the composer ready', async ({
    page,
  }) => {
    const call = await createCall(page, 'team-cannot-open-shared-workspace');
    await page.goto(`/calls/${call.id}`);

    const conversation = page.getByRole('region', { name: 'Conversation' });
    await expect(conversation.getByRole('listitem')).toHaveCount(1);
    await expect(conversation.getByText(call.persona).first()).toBeVisible();

    await say(
      page,
      "Hello, I'm sorry about this. What exactly do you see when you try to open it?",
    );
    await expect(conversation.getByRole('listitem')).toHaveCount(3);
    await expect(conversation.getByText("I'm sorry about this.")).toBeVisible();
    await expect(composer(page)).toHaveValue('');
    await expect(composer(page)).toBeFocused();
    // The reply is announced once, as a whole, never character by character.
    await expect(
      page.getByRole('status').filter({ hasText: `${call.persona} replied:` }),
    ).toHaveCount(1);
  });

  test('keeps a saved message when the customer cannot reply, and retries without duplicating it', async ({
    page,
  }) => {
    const call = await createCall(page);
    await page.goto(`/calls/${call.id}`);
    const conversation = page.getByRole('region', { name: 'Conversation' });

    await failNext(page, 'customer');
    await say(page, 'When did you last sign in successfully?');
    await expect(conversation.getByRole('alert')).toContainText('Saved.');

    await conversation.getByRole('button', { name: 'Retry' }).click();
    await expect(conversation.getByRole('alert')).toHaveCount(0);
    await expect(conversation.getByText('When did you last sign in successfully?')).toHaveCount(1);
    await expect(conversation.getByRole('listitem')).toHaveCount(3);
  });

  test('offers to resume an unanswered message after a reload', async ({ page }) => {
    const call = await createCall(page);
    await page.goto(`/calls/${call.id}`);
    const conversation = page.getByRole('region', { name: 'Conversation' });

    await failNext(page, 'customer');
    await say(page, 'Can you tell me what the sign-in screen says?');
    await expect(conversation.getByRole('alert')).toContainText('Saved.');

    await page.reload();
    await expect(conversation.getByRole('alert')).toContainText('has not replied yet');
    await conversation.getByRole('button', { name: 'Retry' }).click();
    await expect(conversation.getByRole('listitem')).toHaveCount(3);
    await expect(
      conversation.getByText('Can you tell me what the sign-in screen says?'),
    ).toHaveCount(1);
  });

  test('asks before ending, then shows the real wrap-up and opens the report', async ({ page }) => {
    const call = await createCall(page);
    await sayViaApi(
      page,
      call.id,
      "I'm sorry you're locked out. What happens when you try to sign in?",
    );
    await page.goto(`/calls/${call.id}`);

    const endButton = page.getByRole('button', { name: 'End call', exact: true });
    await endButton.click();
    const dialog = page.getByRole('dialog', { name: 'End this call?' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('limited evidence')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(endButton).toBeFocused();

    await endButton.click();
    await page.getByRole('button', { name: 'End call and get feedback' }).click();
    await expect(page).toHaveURL(new RegExp(`/sessions/${call.id}/report$`), { timeout: 20_000 });
  });

  test('a call with no messages can only be discarded', async ({ page }) => {
    const call = await createCall(page);
    await page.goto(`/calls/${call.id}`);
    await page.getByRole('button', { name: 'End call', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Nothing to review yet' });
    await expect(dialog.getByRole('button', { name: 'End call and get feedback' })).toHaveCount(0);
    await dialog.getByRole('button', { name: 'Discard call' }).click();
    await expect(page).toHaveURL(/\/$/);
    const gone = await page.request.get(`/api/sessions/${call.id}`);
    expect(gone.status()).toBe(404);
  });

  test('keeps the draft private notes in the tab and passes automated accessibility checks', async ({
    page,
  }) => {
    const call = await createCall(page, 'team-cannot-open-shared-workspace');
    await page.goto(`/calls/${call.id}`);
    await page.getByLabel('Private notes').fill('Ask about recent access changes');
    await page.reload();
    await expect(page.getByLabel('Private notes')).toHaveValue('Ask about recent access changes');
    await expectNoSeriousA11yViolations(page, 'live call page');
  });

  test('warns before sending something that looks like personal data @mobile', async ({ page }) => {
    const call = await createCall(page);
    await page.goto(`/calls/${call.id}`);
    await composer(page).fill('You can reach me on jane.doe@example.com');
    await expect(page.getByText('This looks like it contains an email address')).toBeVisible();

    // On a phone, Enter adds a new line and the Send button sends.
    await composer(page).fill('First line');
    await composer(page).press('Enter');
    await expect(composer(page)).toHaveValue('First line\n');
    await composer(page).fill('What do you see on screen?');
    await page.getByRole('button', { name: 'Send message' }).click();
    const conversation = page.getByRole('region', { name: 'Conversation' });
    await expect(conversation.getByRole('listitem')).toHaveCount(3);
  });

  test('details sheet shows the briefing on a phone @mobile', async ({ page }) => {
    const call = await createCall(page, 'team-cannot-open-shared-workspace');
    await page.goto(`/calls/${call.id}`);
    await page.getByRole('button', { name: 'Call details' }).click();
    const sheet = page.getByRole('dialog', { name: 'Call details' });
    await expect(sheet.getByText('The situation')).toBeVisible();
    await expect(sheet.getByText('Private notes')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
