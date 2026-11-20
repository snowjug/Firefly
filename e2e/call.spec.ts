import { expect, test, type Page } from '@playwright/test';
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
    await expect(page).toHaveURL(/\/home$/);
    const gone = await page.request.get(`/api/sessions/${call.id}`);
    expect(gone.status()).toBe(404);
  });

  test('keeps the draft private notes in the tab and passes automated accessibility checks', async ({
    page,
  }) => {
    const call = await createCall(page, 'team-cannot-open-shared-workspace');
    await page.goto(`/calls/${call.id}`);
    // The notes live with the briefing, which opens from the header.
    await page.getByRole('button', { name: 'Call details' }).click();
    await page.getByLabel('Private notes').fill('Ask about recent access changes');
    await page.keyboard.press('Escape');
    await page.reload();
    await page.getByRole('button', { name: 'Call details' }).click();
    await expect(page.getByLabel('Private notes')).toHaveValue('Ask about recent access changes');
    await page.keyboard.press('Escape');
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

test.describe('guided and immersive practice', () => {
  test('guided practice shows light cues, and a hint only fills the box', async ({ page }) => {
    const call = await createCall(page, 'locked-out-after-password-reset', 'starter', {});
    await page.goto(`/calls/${call.id}`);
    // Starter calls start guided: the mood in words, a count of what was found, a few ideas.
    await expect(page.getByText('Customer mood', { exact: true })).toBeVisible();
    await expect(page.getByText(/signals? found/)).toBeVisible();
    const hints = page.getByRole('group', { name: 'Ideas for what to say' });
    await expect(hints).toBeVisible();
    await hints.getByRole('button').first().click();
    await expect(composer(page)).not.toHaveValue('');
    // Nothing was sent: the conversation still holds only the customer's opening.
    await expect(
      page.getByRole('region', { name: 'Conversation' }).getByRole('listitem'),
    ).toHaveCount(1);
  });

  test('guided practice marks a signal where it was found, and says only that it was found', async ({
    page,
  }) => {
    const call = await createCall(page, 'locked-out-after-password-reset', 'starter', {});
    await page.goto(`/calls/${call.id}`);
    const conversation = page.getByRole('region', { name: 'Conversation' });
    await say(page, 'Thanks, I am sorry about this. When did it start, and has anything changed?');
    await expect(conversation.getByRole('listitem')).toHaveCount(3);
    const found = conversation.getByRole('listitem').last();
    await expect(found.getByText('Signal found')).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: /^Signal found$/ })).toHaveCount(1);
    await expect(page.getByText(/^1 signal found$/)).toBeVisible();
  });

  test('immersive practice shows none of it, because a real call does not', async ({ page }) => {
    const call = await createCall(page, 'team-cannot-open-shared-workspace', 'standard');
    await page.goto(`/calls/${call.id}`);
    await expect(composer(page)).toBeVisible();
    await expect(page.getByText(/signals? found/)).toHaveCount(0);
    await expect(page.getByRole('group', { name: 'Ideas for what to say' })).toHaveCount(0);
    await expect(page.getByText('Customer mood', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Customer mood cues are off in immersive practice.')).toBeVisible();
  });

  test('immersive practice marks nothing when a signal is found', async ({ page }) => {
    const call = await createCall(page, 'locked-out-after-password-reset', 'standard');
    await page.goto(`/calls/${call.id}`);
    const conversation = page.getByRole('region', { name: 'Conversation' });
    await say(page, 'Thanks, I am sorry about this. When did it start, and has anything changed?');
    await expect(conversation.getByRole('listitem')).toHaveCount(3);
    await expect(page.getByText(/Signal found|Situation shift|Mood shift/)).toHaveCount(0);
  });
});

/** Stands in for the browser's speech recognition: it hears one sentence a moment after it starts. */
async function installFakeSpeech(page: Page, sentence: string) {
  await page.addInitScript((words) => {
    class FakeRecognition {
      onstart: (() => void) | null = null;
      onaudiostart: (() => void) | null = null;
      onspeechstart: (() => void) | null = null;
      onspeechend: (() => void) | null = null;
      onaudioend: (() => void) | null = null;
      onresult: ((event: unknown) => void) | null = null;
      onend: (() => void) | null = null;
      onerror: ((event: unknown) => void) | null = null;
      lang = '';
      continuous = false;
      interimResults = false;
      maxAlternatives = 1;
      start() {
        setTimeout(() => {
          this.onstart?.();
          this.onaudiostart?.();
        }, 20);
        setTimeout(() => {
          this.onspeechstart?.();
          const alternative = { transcript: words, confidence: 0.92 };
          const result = Object.assign([alternative], { isFinal: true });
          this.onresult?.({ resultIndex: 0, results: Object.assign([result], { length: 1 }) });
          this.onspeechend?.();
          this.onaudioend?.();
          setTimeout(() => this.onend?.(), 20);
        }, 250);
      }
      stop() {}
      abort() {}
    }
    Object.assign(window, {
      SpeechRecognition: FakeRecognition,
      webkitSpeechRecognition: FakeRecognition,
    });
  }, sentence);
}

async function withProfile(page: Page, voice: boolean) {
  await page.addInitScript((enabled) => {
    if (localStorage.getItem('e2e.seeded') !== null) return;
    localStorage.setItem('e2e.seeded', '1');
    localStorage.setItem(
      'firefly.profile',
      JSON.stringify({
        name: 'Sam Rivera',
        role: '',
        location: '',
        createdAt: '2026-01-05T09:00:00.000Z',
        preferences: {
          defaultDifficulty: 'starter',
          hints: 'auto',
          voice: enabled,
          notifyReports: true,
          notifyBadges: true,
        },
      }),
    );
  }, voice);
}

test.describe('voice (beta)', () => {
  test('is off until it is turned on, after a plain explanation, and typing always works', async ({
    page,
  }) => {
    await withProfile(page, false);
    await installFakeSpeech(page, 'unused');
    const call = await createCall(page);
    await page.goto(`/calls/${call.id}`);
    await expect(page.getByRole('button', { name: 'Voice call' })).toHaveCount(0);

    await page.getByRole('button', { name: 'Voice (Beta)' }).click();
    const dialog = page.getByRole('dialog', { name: 'Turn on voice (Beta)?' });
    await expect(dialog).toContainText(/never records, keeps or uploads audio/);
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('button', { name: 'Voice call' })).toHaveCount(0);

    await page.getByRole('button', { name: 'Voice (Beta)' }).click();
    await page
      .getByRole('dialog', { name: 'Turn on voice (Beta)?' })
      .getByRole('button', { name: 'Turn on voice' })
      .click();
    await expect(page.getByRole('button', { name: 'Voice call' })).toBeVisible();
    await expect(page.getByRole('switch', { name: 'Hands-free' })).toBeVisible();

    // Typing still works alongside it.
    await say(page, 'Hello, what can I help you with today?');
    await expect(
      page.getByRole('region', { name: 'Conversation' }).getByRole('listitem'),
    ).toHaveCount(3);
  });

  test('a spoken sentence lands in the message box to check, and the report says voice was used', async ({
    page,
  }) => {
    await withProfile(page, true);
    await installFakeSpeech(page, 'What does the sign-in screen say exactly');
    const call = await createCall(page, 'locked-out-after-password-reset');
    await page.goto(`/calls/${call.id}`);

    await page.getByRole('button', { name: 'Voice call' }).click();
    // The customer's opening message is read out. In push to talk the microphone only listens while
    // Talk is pressed, and pressing it cuts in on the customer.
    await page.getByRole('button', { name: 'Talk', exact: true }).click();
    // What was heard is put in the box for the learner to read, and is not sent.
    await expect(composer(page)).toHaveValue(/What does the sign-in screen say exactly/);
    await expect(
      page.getByRole('region', { name: 'Conversation' }).getByRole('listitem'),
    ).toHaveCount(1);
    await expect(page.getByText('Check the words, then press Send.').first()).toBeVisible();

    await composer(page).press('Enter');
    await expect(
      page.getByRole('region', { name: 'Conversation' }).getByRole('listitem'),
    ).toHaveCount(3);
    expect(
      await page.evaluate(() => JSON.parse(localStorage.getItem('firefly.voiceSessions') ?? '[]')),
    ).toContain(call.id);

    // Recognition can mishear, so the report adds a reminder to check the quotes.
    await sayViaApi(
      page,
      call.id,
      "I'll look into it now and call you back at 3pm with an update.",
    );
    await page.getByRole('button', { name: 'End call', exact: true }).click();
    await page.getByRole('button', { name: 'End call and get feedback' }).click();
    await expect(page).toHaveURL(/\/sessions\/[\w-]+\/report$/, { timeout: 20_000 });
    await expect(page.getByText(/You used voice in this call/)).toBeVisible();
  });

  test('says so, in one sentence, when the browser cannot listen', async ({ page }) => {
    await withProfile(page, true);
    await page.addInitScript(() => {
      Object.assign(window, { SpeechRecognition: undefined, webkitSpeechRecognition: undefined });
    });
    const call = await createCall(page);
    await page.goto(`/calls/${call.id}`);
    await expect(page.getByText(/Voice input needs Chrome or Edge/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Voice call' })).toHaveCount(0);
    // And the conversation carries on by typing.
    await say(page, 'Hello, what can I help you with today?');
    await expect(
      page.getByRole('region', { name: 'Conversation' }).getByRole('listitem'),
    ).toHaveCount(3);
  });
});
