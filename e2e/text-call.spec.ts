import { expect, test } from './support/fixtures.ts';
import type { Page } from '@playwright/test';
import type { CoachingReport } from '../shared/domain/report.ts';
import {
  STATUS,
  callScreen,
  converse,
  endCallAndOpenReport,
  sendTyped,
  startSpokenCall,
  startTypedCall,
} from './support/call-screen.ts';
import { readProbe } from './support/page-probes.ts';
import { expectNoRawFailureText } from './support/raw-text.ts';
import {
  leakedSecrets,
  libraryScenario,
  libraryScenarios,
  saysSentence,
  secretsBesidesAreas,
} from './support/scenario-library.ts';

// Typing instead of speaking, what the customer's state shows and what is found, the unexpected
// turn, and ending the call. These run against the real rules engine (demo mode), so the customer's
// words are the engine's, and the moods and counts are the engine's own.

test.describe.configure({ timeout: 90_000 });

const MARCUS = 'outlook-shared-mailbox-missing';
const DEFENDER = 'defender-invoices-quarantined'; // frustrated, demanding, a payment run at stake

/** The customer's state as the call shows it: its label and its trend, in words. */
async function customerMood(page: Page) {
  return ((await callScreen(page).state.innerText()) ?? '').replace(/\s+/g, ' ');
}

test.describe('typing instead of speaking', () => {
  test('Enter sends, Shift+Enter makes a new line, and the customer replies', async ({
    page,
    api,
  }) => {
    const { screen } = await startTypedCall(page, api);
    // The box takes the keyboard when it appears, and says how it works.
    await expect(screen.reply).toBeFocused();
    await expect(screen.reply).toHaveAccessibleDescription(
      /Enter sends\. Shift and Enter add a line\./,
    );

    await test.step('Shift+Enter adds a line and sends nothing', async () => {
      await screen.reply.fill('Hello, my name is Sam.');
      await screen.reply.press('Shift+Enter');
      await screen.reply.pressSequentially('Can you tell me what is happening?');
      await expect(screen.reply).toHaveValue(
        'Hello, my name is Sam.\nCan you tell me what is happening?',
      );
      await expect(screen.turns).toHaveCount(1);
    });

    await test.step('Enter sends it, the box is emptied, and the customer replies', async () => {
      await screen.reply.press('Enter');
      await expect(screen.reply).toHaveValue('');
      await expect(screen.turns).toHaveCount(3);
      await expect(screen.turns.nth(1)).toContainText('Hello, my name is Sam.');
      await expect(screen.turns.nth(1)).toContainText('Can you tell me what is happening?');
      await expect(screen.turns.nth(1)).not.toContainText('Spoken');
      // The box is ready for the next message.
      await expect(screen.reply).toBeFocused();
    });
  });

  test('works with the microphone muted: nothing listens, and a typed reply is answered', async ({
    page,
    api,
  }) => {
    const { screen } = await startSpokenCall(page, api);
    await expect(screen.status).toHaveText(STATUS.speaking);
    await screen.stopAudio.click();

    await screen.mute.click();
    await expect(screen.mute).toHaveAttribute('aria-pressed', 'true');
    await expect(screen.status).toHaveText(STATUS.muted);

    await screen.text.click();
    await expect(screen.reply).toBeFocused();
    await sendTyped(screen, 'Hello, my name is Sam. What is happening?');
    await expect(screen.turns).toHaveCount(3);
    // The microphone was asked for once, at the start, and no spoken turn was made.
    const probe = await readProbe(page);
    expect(probe.mediaRequests).toBe(1);
    await expect(screen.turns.nth(1)).not.toContainText('Spoken');
  });

  test('a text-only call never asks for the microphone, says it is your turn, and has only the controls that apply', async ({
    page,
    api,
  }) => {
    const { screen } = await startTypedCall(page, api);
    await expect(screen.status).toHaveText(STATUS.typing);
    // Voice controls leave a typed call entirely: no Mute, Pause, Stop customer audio or Talk.
    for (const control of [screen.mute, screen.pause, screen.stopAudio, screen.talk, screen.done]) {
      await expect(control).toHaveCount(0);
    }
    await expect(screen.returnToVoice).toBeVisible();
    await expect(screen.settings).toBeVisible();
    // A typed call has no signal to draw: the strip is its label, and no line that looks like a meter.
    await expect(page.locator('svg.cw-wave')).toHaveCount(0);

    await converse(screen, [
      'Hello, my name is Sam. Can you tell me what is happening?',
      'When did it last work, and did anything change before it stopped?',
    ]);

    const probe = await readProbe(page);
    expect(probe.mediaRequests).toBe(0);
    expect(probe.playCalls).toEqual([]);
    expect(probe.synthesisCalls).toBe(0);
  });

  test('while the customer replies the box holds what was sent, read-only and dim, and nothing around it moves', async ({
    page,
    api,
  }) => {
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route('**/api/sessions/*/messages', async (route) => {
      await held;
      await route.continue().catch(() => undefined);
    });
    const { screen } = await startTypedCall(page, api);
    const composer = page.locator('.cw-composer');
    const scroller = page.locator('#cw-transcript');
    const sentence =
      'Hello, my name is Sam. Can you tell me, in as much detail as you can, what is happening on your side, what you have already tried, and who else is affected today?';
    const colour = () => screen.reply.evaluate((element) => getComputedStyle(element).color);
    const fill = () => screen.send.evaluate((element) => getComputedStyle(element).backgroundColor);

    // As it is at rest, with an empty box: this is what the waiting state must not change.
    const rest = { composer: await composer.boundingBox(), scroller: await scroller.boundingBox() };
    const sendFill = await fill();
    await screen.reply.fill(sentence);
    const typingColour = await colour();
    await screen.send.click();
    await expect(screen.status).toHaveText(STATUS.replying);

    await test.step('it holds the message, and says why it cannot be changed', async () => {
      await expect(screen.reply).toHaveAttribute('readonly', '');
      await expect(screen.reply).toHaveValue(sentence);
      await expect(screen.reply).toHaveAccessibleDescription(/Waiting for the customer\./);
      await screen.reply.press('x');
      await expect(screen.reply).toHaveValue(sentence);
    });

    await test.step('it is quiet: dimmer text, and no more room than an empty box', async () => {
      expect(await colour()).not.toBe(typingColour);
      const waiting = {
        composer: await composer.boundingBox(),
        scroller: await scroller.boundingBox(),
      };
      expect(Math.abs(waiting.composer!.height - rest.composer!.height)).toBeLessThanOrEqual(1);
      expect(Math.abs(waiting.scroller!.height - rest.scroller!.height)).toBeLessThanOrEqual(1);
      expect((await screen.reply.boundingBox())!.height).toBeLessThanOrEqual(46);
    });

    await test.step('Send keeps its fill: a button washed out in grey would be louder than the wait', async () => {
      expect(await fill()).toBe(sendFill);
      await expect(screen.send).toHaveAttribute('aria-disabled', 'true');
    });

    await test.step('the reply arrives: the box is the person’s again, empty, with the keyboard still in it', async () => {
      release();
      await expect(screen.turns).toHaveCount(3);
      await expect(screen.reply).toHaveValue('');
      await expect(screen.reply).not.toHaveAttribute('readonly');
      await expect(screen.reply).toBeFocused();
    });
  });

  test('on the smallest phone the transcript keeps its room: 250 px at 320 by 640 with the reply box, and a bar of two rows', async ({
    page,
    api,
  }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    const { screen } = await startTypedCall(page, api);
    const room = async () => (await page.locator('#cw-transcript').boundingBox())!.height;
    expect(await room()).toBeGreaterThanOrEqual(250);
    expect((await page.locator('.cw-bar').boundingBox())!.height).toBeLessThanOrEqual(112);
    // After an exchange, and with the keyboard in the box, it has not been squeezed.
    await converse(screen, ['Hello, my name is Sam. Can you tell me what is happening?']);
    expect(await room()).toBeGreaterThanOrEqual(250);
    // The left edges are one gutter: the bar, the customer and the reply box start where the transcript does.
    const lefts = await page.evaluate(() =>
      ['.cw-bar__brand', '.cw-person__card', '.cw-turn', '.cw-composer__input'].map((selector) =>
        Math.round(document.querySelector(selector)!.getBoundingClientRect().left),
      ),
    );
    expect(new Set(lefts).size, `the left edges ${lefts.join(', ')}`).toBe(1);
  });

  test('a phone keeps the "Demo mode" label on the bar from 360 px wide, in two rows, and says it in Voice settings below that', async ({
    page,
    api,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    const { screen } = await startTypedCall(page, api);
    const bar = page.locator('.cw-bar');
    const chip = bar.getByText('Demo mode', { exact: true });
    const sideways = () =>
      page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);

    await test.step('at 375 it is on the bar, whole in the window, beside the time and Live, and the transcript keeps its room', async () => {
      await expect(chip).toBeVisible();
      await expect(bar.getByText('Live', { exact: true })).toBeVisible();
      const box = (await chip.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(376);
      // Two rows: the buttons, then the scenario with the time, the connection and the label.
      expect((await bar.boundingBox())!.height).toBeLessThanOrEqual(150);
      expect((await page.locator('#cw-transcript').boundingBox())!.height).toBeGreaterThanOrEqual(
        250,
      );
      expect(await sideways()).toBe(false);
    });

    await test.step('at 360, the narrowest width that has it, it is still there', async () => {
      await page.setViewportSize({ width: 360, height: 800 });
      await expect(chip).toBeVisible();
      expect(await sideways()).toBe(false);
    });

    await test.step('below 360 it leaves the bar, and Voice settings says it in words', async () => {
      await page.setViewportSize({ width: 359, height: 740 });
      await expect(chip).toBeHidden();
      await screen.settings.click();
      await expect(screen.settingsDialog).toContainText(
        "Demo mode: Firefly's built-in rules engine",
      );
    });
  });

  test('every message carries its time, the same quiet way', async ({ page, api }) => {
    const { screen } = await startTypedCall(page, api);
    await converse(screen, ['Hello, my name is Sam. Can you tell me what is happening?']);
    await expect(screen.turns).toHaveCount(3);
    const stamps = screen.transcript.locator('time');
    await expect(stamps).toHaveCount(3);
    for (const stamp of await stamps.all()) await expect(stamp).toHaveText(/^at \d+:\d{2}$/);
  });

  test('Return to voice is a quiet button, not a second main one beside Send, and no slab on a tablet', async ({
    page,
    api,
  }) => {
    const { screen } = await startTypedCall(page, api);
    await expect(screen.returnToVoice).toBeVisible();
    // An outline button: an edge and no fill. Send is the one button that is filled.
    await expect(screen.returnToVoice).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    expect(
      await screen.returnToVoice.evaluate((element) =>
        parseFloat(getComputedStyle(element).borderTopWidth),
      ),
    ).toBeGreaterThanOrEqual(1);
    await expect(screen.send).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(screen.returnToVoice).toBeVisible();
    expect((await screen.returnToVoice.boundingBox())!.width).toBeLessThanOrEqual(560);
  });
});

test.describe('what is found, and how the customer feels', () => {
  test('in guided practice the count of context found goes up without showing any of it, and the areas worth exploring are listed', async ({
    page,
    api,
  }) => {
    const library = libraryScenario(MARCUS);
    const { screen } = await startTypedCall(page, api, { scenarioId: MARCUS, mode: 'guided' });
    const found = page.getByRole('region', { name: 'Case', exact: true });
    const count = found
      .getByRole('term')
      .filter({ hasText: /^Context found$/ })
      .locator('xpath=following-sibling::dd[1]');
    await expect(count).toHaveText('0');
    await expect(found.getByRole('term').filter({ hasText: /^Areas to explore$/ })).toBeVisible();

    await test.step('a greeting finds nothing', async () => {
      await sendTyped(screen, 'Hello, thanks for calling Microsoft support. My name is Sam.');
      await expect(screen.turns).toHaveCount(3);
      await expect(count).toHaveText('0');
    });

    await test.step('a question that gets to the heart of it finds one thing', async () => {
      await sendTyped(
        screen,
        'Did anything change while you were away, for example who has access to the shared mailbox?',
      );
      await expect(screen.turns).toHaveCount(5);
      await expect(count).toHaveText('1');
    });

    await test.step('the count is the only thing shown: none of what was found is in the case column or beside the customer', async () => {
      const outsideTranscript = [await found.innerText(), await screen.customer.innerText()].join(
        '\n',
      );
      expect(leakedSecrets(outsideTranscript, secretsBesidesAreas(library))).toEqual([]);
      // The customer said it, so it is in the transcript, which is the only place it is.
      const fact = library.facts.find((item) => item.id === 'hf-access-tidy')!;
      const said = await screen.transcript.innerText();
      expect(
        fact.statements.some((statement) => saysSentence(said, statement)),
        `the customer says what changed: ${said}`,
      ).toBe(true);
    });
  });

  test('in a standard call no area to explore and no count of what was found is shown, so the case column holds no cue', async ({
    page,
    api,
  }) => {
    const { screen } = await startTypedCall(page, api, { scenarioId: MARCUS, mode: 'immersive' });
    const column = page.getByRole('region', { name: 'Case', exact: true });
    await expect(screen.state).toBeVisible();
    await converse(screen, [
      'Hello, thanks for calling Microsoft support. My name is Sam.',
      'Is there anyone else on the team who can still see the mailbox?',
    ]);
    await expect(column.getByRole('term').filter({ hasText: /^Areas to explore$/ })).toHaveCount(0);
    await expect(column.getByRole('term').filter({ hasText: /^Context found$/ })).toHaveCount(0);
    await expect(column.getByRole('term').filter({ hasText: /^Objective$/ })).toBeVisible();
    await expect(column).not.toContainText(/\bof \d+\b|\/ ?\d+/);
    // The customer's mood is always shown; it is not a hint.
    await expect(screen.state).toContainText('Calm');
  });

  test("a dismissive reply raises the customer's state, and a calming one eases it", async ({
    page,
    api,
  }) => {
    const { screen } = await startTypedCall(page, api, {
      scenarioId: DEFENDER,
      overrides: { curveballs: [] },
    });
    expect(await customerMood(page)).toContain('Frustrated');

    await test.step('being blamed raises the state and its trend, in words', async () => {
      await sendTyped(
        screen,
        "That's not my problem, it's your fault for not reading the manual. Just try again.",
      );
      await expect(screen.turns).toHaveCount(3);
      await expect(screen.state).toContainText('Angry');
      await expect(screen.state).toContainText('rising');
    });

    await test.step('taking ownership and showing empathy eases it, and it is called recovering', async () => {
      await sendTyped(
        screen,
        "I'm really sorry about this, I can hear how frustrating the morning has been with the payment run so close. I'll take ownership of this and I'll call you back by three o'clock with an update.",
      );
      await expect(screen.turns).toHaveCount(5);
      await expect(screen.state).toContainText('Recovering');
      await expect(screen.state).toContainText('easing');
    });

    await test.step('the call never says why it moved', async () => {
      const text = await screen.customer.innerText();
      expect(text).not.toMatch(/blame|dismissive|empathy|ownership/i);
    });
  });

  test("an unexpected turn arrives in the customer's own words, with no dialog or alert", async ({
    page,
    api,
  }) => {
    const dialogs: string[] = [];
    page.on('dialog', (dialog) => {
      dialogs.push(dialog.message());
      void dialog.dismiss();
    });
    const { screen } = await startTypedCall(page, api, {
      scenarioId: DEFENDER,
      overrides: { curveballs: ['ask-manager'] },
    });

    await test.step('nothing about a manager before the fourth reply', async () => {
      await converse(screen, [
        'Hello, my name is Sam. Can you tell me what is happening?',
        'When did it last work?',
        'What does the message say exactly?',
      ]);
      await expect(screen.transcript).not.toContainText(/manager/i);
    });

    await test.step('the fourth reply carries it, as a line of the transcript', async () => {
      await sendTyped(screen, 'Who else is affected?');
      await expect(screen.turns).toHaveCount(9);
      await expect(screen.turns.last()).toContainText(/manager/i);
    });

    await test.step('and nothing else on the page announces it', async () => {
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await expect(page.getByRole('alertdialog')).toHaveCount(0);
      await expect(page.getByRole('alert')).toHaveCount(0);
      expect(dialogs).toEqual([]);
      const outside = [
        await screen.customer.innerText(),
        await page.getByRole('region', { name: 'Case', exact: true }).innerText(),
      ].join('\n');
      expect(outside).not.toMatch(/manager|curveball|complication/i);
    });
  });
});

test.describe('ending the call', () => {
  test('the end dialog shows the facts, Continue call returns to the call, End and review stops the microphone and opens the report', async ({
    page,
    api,
  }) => {
    const { call, screen } = await startSpokenCall(page, api);
    await expect(screen.status).toHaveText(STATUS.speaking);
    // One spoken turn, so that there is something to review.
    await expect(screen.turns).toHaveCount(3, { timeout: 40_000 });

    await test.step('the question shows how long, how much, and how the customer is', async () => {
      await screen.endCall.click();
      await expect(screen.endDialog).toBeVisible();
      await expect(
        screen.endDialog.getByRole('term').filter({ hasText: 'Call length' }),
      ).toBeVisible();
      await expect(screen.endDialog.locator('.cw-end__clock')).toHaveText(/^\d+:\d{2}$/);
      await expect(
        screen.endDialog
          .getByRole('term')
          .filter({ hasText: 'Your messages' })
          .locator('xpath=following-sibling::dd[1]'),
      ).toHaveText('1');
      await expect(screen.endDialog).toContainText('Customer state');
      await expect(screen.endDialog).toContainText(
        'A short call: the review will say it rests on limited evidence.',
      );
      // A stray Enter ends nothing: the keyboard starts on Continue call.
      await expect(screen.endDialog.getByRole('button', { name: 'Continue call' })).toBeFocused();
    });

    await test.step('Continue call closes it, the call is as it was, and focus goes back to End call', async () => {
      await screen.endDialog.getByRole('button', { name: 'Continue call' }).click();
      await expect(screen.endDialog).toBeHidden();
      await expect(screen.endCall).toBeFocused();
      expect((await readProbe(page)).micTracks).toEqual(['live']);
      expect((await api.session(call.id)).status).toBe('active');
    });

    await test.step('End and review shows the ending state, stops the microphone and opens the report', async () => {
      // A little delay on the server, so that the "Ending and preparing your review" state can be seen at all.
      await page.route('**/api/sessions/*/end', async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 700));
        await route.continue();
      });
      await screen.endCall.click();
      await screen.endDialog.getByRole('button', { name: 'End and review' }).click();
      await expect(screen.endingDialog).toBeVisible();
      await expect(screen.endingDialog).toContainText(/Ending call|Preparing your review/);
      await expect(page).toHaveURL(new RegExp(`/sessions/${call.id}/report$`));
      await expect(
        page.getByRole('heading', {
          level: 1,
          name: /Coaching report|Building your coaching report/,
        }),
      ).toBeVisible();
      expect((await readProbe(page)).micTracks).toEqual(['ended']);
    });

    await test.step('the call is closed on the server', async () => {
      await expect(page.getByRole('heading', { level: 1, name: 'Coaching report' })).toBeVisible();
      const saved = await api.session(call.id);
      expect(['completing', 'completed']).toContain(saved.status);
      expect(saved.turns.filter((turn) => turn.role === 'trainee')).toHaveLength(1);
    });
  });

  test('a call with nothing said cannot be reported: the dialog says so and can leave without a report', async ({
    page,
    api,
    problems,
  }) => {
    problems.allow({ url: '/end' });
    const { call, screen } = await startTypedCall(page, api);

    await screen.endCall.click();
    // With nothing said, the dialog warns about it before it is asked.
    await screen.endDialog.getByRole('button', { name: 'End and review' }).click();

    await expect(screen.endDialog).toContainText('There is nothing to review yet.');
    await expect(screen.endDialog).toContainText('No message has been sent.');
    await expectNoRawFailureText(page);
    await expect(screen.endDialog.getByRole('button', { name: 'End and review' })).toHaveCount(0);
    await expect(screen.endDialog.getByRole('button', { name: 'Retry' })).toHaveCount(0);

    await screen.endDialog.getByRole('button', { name: 'Leave without a report' }).click();
    await expect(page).toHaveURL(/\/scenarios/);
    await expect(page.getByRole('heading', { level: 1, name: 'Scenarios' })).toBeVisible();
    // The empty call is gone.
    await expect
      .poll(async () => (await page.request.get(`/api/sessions/${call.id}`)).status())
      .toBe(404);
  });

  test('a short typed call ends in a report that says it rests on limited evidence', async ({
    page,
    api,
  }) => {
    const { screen } = await startTypedCall(page, api);
    await converse(screen, ['Hello, my name is Sam. Can you tell me what is happening?']);
    const id = await endCallAndOpenReport(page, screen);
    const report = (await api.session(id)).report as CoachingReport;
    expect(report.completion.evidence).not.toBe('sufficient');
    // The summary says so, in its own words, before the scores that rest on it, and withholds the
    // overall score. The report's own note is added under it only when the summary does not say it.
    const summary = page.getByRole('region', { name: 'Summary', exact: true });
    await expect(summary).toContainText(
      /\blimited evidence\b|\btoo few\b|\bto score with confidence\b/i,
    );
    // No overall score is given for a call this short; the summary says so in its own words, and the
    // signal line is not repeated under it.
    await expect(summary).toContainText(/no overall (?:score|practice signal)/i);
    await expect(summary).not.toContainText(/Practice signal \d/);
  });
});

test.describe('Ready to close? in Guided practice', () => {
  const GUIDED_CLOSE = [
    'Hello, thanks for calling Microsoft support. My name is Sam.',
    'Did anything change while you were away, for example who has access to the shared mailbox?',
    "I'll own this and update you by 3 PM.",
  ];

  test('shows four neutral rows from what was said, in words, and the usual actions are all there at once', async ({
    page,
    api,
  }) => {
    const { screen } = await startTypedCall(page, api, { scenarioId: MARCUS, mode: 'guided' });
    await converse(screen, GUIDED_CLOSE);
    await screen.endCall.click();
    await expect(page.getByRole('dialog', { name: 'Ready to close?' })).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'End the call?' })).toHaveCount(0);

    await test.step('the four rows, each an icon and the words Done or Not yet', async () => {
      await expect(screen.closing.rows).toHaveCount(4);
      await expect(screen.closing.rows.nth(0)).toHaveText(/^Plan stated\s*(?:Done|Not yet)$/);
      await expect(screen.closing.rows.nth(1)).toHaveText(/^Owner stated\s*(?:Done|Not yet)$/);
      await expect(screen.closing.rows.nth(2)).toHaveText(
        /^Update time stated\s*(?:Done|Not yet)$/,
      );
      await expect(screen.closing.rows.nth(3)).toHaveText(
        /^Customer agreement confirmed\s*(?:Done|Not yet)$/,
      );
      for (const row of await screen.closing.rows.all()) {
        await expect(row.locator('svg')).toHaveCount(1);
      }
    });

    await test.step('what was said is what is read: an owner and a time were stated', async () => {
      await expect(screen.closing.rows.nth(1)).toContainText('Done');
      await expect(screen.closing.rows.nth(2)).toContainText('Done');
    });

    await test.step('it is neutral: nothing red, no score, nothing about what to say', async () => {
      // The one line that says what the rows are says it is not a score; nothing else may speak of one.
      await expect(screen.endDialog).toContainText(
        'What the call has covered so far. This is not a score.',
      );
      const text = (await screen.endDialog.innerText()).replace(
        'What the call has covered so far. This is not a score.',
        '',
      );
      expect(text).not.toMatch(/\bscore\b|\d\s?%|should|try saying|you could say|\bmust\b/i);
      const notYet = screen.closing.rows.locator('.cw-close__state', { hasText: 'Not yet' });
      for (const state of await notYet.all()) {
        const [red, green, blue] = (
          await state.evaluate((element) => getComputedStyle(element).color.match(/\d+/g) ?? [])
        ).map(Number) as [number, number, number];
        expect(red > 150 && green < 110 && blue < 110, 'a Not yet that is red').toBe(false);
        // Quiet, not bold: four of them in a row must not read as a failed list.
        expect(
          Number(await state.evaluate((element) => getComputedStyle(element).fontWeight)),
          'a Not yet in bold',
        ).toBeLessThan(600);
      }
    });

    await test.step('Continue call and End and review are there, at once, and not dimmed', async () => {
      await expect(screen.endDialog.getByRole('button', { name: 'Continue call' })).toBeFocused();
      const end = screen.endDialog.getByRole('button', { name: 'End and review' });
      await expect(end).toBeEnabled();
      await expect(end).not.toHaveAttribute('aria-disabled', 'true');
    });
  });

  test('the end dialog keeps its three facts on one row at every width, and says what the rows are before them', async ({
    page,
    api,
  }) => {
    const { screen } = await startTypedCall(page, api, { scenarioId: MARCUS, mode: 'guided' });
    await converse(screen, GUIDED_CLOSE.slice(0, 1));
    await screen.endCall.click();
    await expect(page.getByRole('dialog', { name: 'Ready to close?' })).toBeVisible();
    await expect(screen.closing.rows).toHaveCount(4);
    const lead = screen.endDialog.getByText(
      'What the call has covered so far. This is not a score.',
    );
    await expect(lead).toBeVisible();
    // The line comes before the rows.
    expect((await lead.boundingBox())!.y).toBeLessThan(
      (await screen.closing.list.boundingBox())!.y,
    );
    for (const width of [320, 375, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      const facts = screen.endDialog.locator('.cw-end__fact');
      await expect(facts).toHaveCount(3);
      const tops = await facts.evaluateAll((items) =>
        items.map((item) => Math.round(item.getBoundingClientRect().top)),
      );
      expect(new Set(tops).size, `the three facts share a row at ${width}`).toBe(1);
      await expect(screen.endDialog.locator('.cw-end__fact dt').nth(1)).toHaveText('Your messages');
      // Nothing is cut off at either edge of the dialog.
      const dialog = (await screen.endDialog.boundingBox())!;
      for (const box of await facts.evaluateAll((items) =>
        items.map((item) => {
          const { left, right } = item.getBoundingClientRect();
          return { left, right };
        }),
      )) {
        expect(box.left).toBeGreaterThanOrEqual(dialog.x - 1);
        expect(box.right).toBeLessThanOrEqual(dialog.x + dialog.width + 1);
      }
    }
  });

  test('a check that is slow is left out after a second, without a word, and one press on End and review still ends the call', async ({
    page,
    api,
  }) => {
    await page.route('**/api/sessions/*/closing-check', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 6_000));
      await route.continue().catch(() => undefined);
    });
    const { call, screen } = await startTypedCall(page, api, {
      scenarioId: MARCUS,
      mode: 'guided',
    });
    await converse(screen, GUIDED_CLOSE.slice(0, 1));
    await screen.endCall.click();
    const dialog = page.getByRole('dialog', { name: 'Ready to close?' });
    await expect(dialog).toBeVisible();

    await test.step('while it waits there is a short skeleton, nothing to read, and ending is not held up', async () => {
      await expect(dialog.locator('.cw-close--loading')).toBeVisible();
      await expect(dialog.locator('.cw-close--loading')).toHaveAttribute('aria-hidden', 'true');
      const end = dialog.getByRole('button', { name: 'End and review' });
      await expect(end).toBeEnabled();
      await expect(end).not.toHaveAttribute('aria-disabled', 'true');
    });

    await test.step('after a second it is gone, with nothing in its place and no message about it', async () => {
      await expect(dialog.locator('.cw-close--loading')).toHaveCount(0, { timeout: 3_000 });
      await expect(screen.closing.list).toHaveCount(0);
      await expect(dialog).not.toContainText(/could not|failed|error|try again|slow/i);
    });

    await test.step('one press ends the call and opens the report', async () => {
      await dialog.getByRole('button', { name: 'End and review' }).click();
      await expect(page).toHaveURL(new RegExp(`/sessions/${call.id}/report$`), { timeout: 30_000 });
    });
  });

  test('a check that fails shows nothing and says nothing, and the call can still be ended', async ({
    page,
    api,
    problems,
  }) => {
    problems.allow({ url: '/closing-check' });
    await page.route('**/api/sessions/*/closing-check', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: { code: 'internal_error', message: 'The check failed.' } }),
      }),
    );
    const { call, screen } = await startTypedCall(page, api, {
      scenarioId: MARCUS,
      mode: 'guided',
    });
    await converse(screen, GUIDED_CLOSE.slice(0, 1));
    await screen.endCall.click();
    const dialog = page.getByRole('dialog', { name: 'Ready to close?' });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('.cw-close--loading')).toHaveCount(0);
    await expect(screen.closing.list).toHaveCount(0);
    await expect(dialog.getByRole('alert')).toHaveCount(0);
    await expect(dialog).not.toContainText(/could not|failed|error|try again/i);
    await expectNoRawFailureText(page);
    await dialog.getByRole('button', { name: 'End and review' }).click();
    await expect(page).toHaveURL(new RegExp(`/sessions/${call.id}/report$`), { timeout: 30_000 });
  });

  test('Assessment practice keeps "End the call?" and never asks for the check', async ({
    page,
    api,
  }) => {
    const asked: string[] = [];
    page.on('request', (request) => {
      if (/closing-check/.test(request.url())) asked.push(request.url());
    });
    const { screen } = await startTypedCall(page, api, { scenarioId: MARCUS, mode: 'immersive' });
    await converse(screen, GUIDED_CLOSE.slice(0, 1));
    await screen.endCall.click();
    await expect(page.getByRole('dialog', { name: 'End the call?' })).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'Ready to close?' })).toHaveCount(0);
    await page.waitForTimeout(1_500);
    await expect(screen.closing.list).toHaveCount(0);
    await expect(page.locator('.cw-close')).toHaveCount(0);
    expect(asked).toEqual([]);
  });
});

test.describe('before anything has been asked', () => {
  test('no scenario shows anything the customer keeps back on its call page, from the pre-flight to the first turn', async ({
    page,
    api,
  }) => {
    test.setTimeout(240_000);
    for (const scenario of libraryScenarios()) {
      await test.step(scenario.title, async () => {
        // Guided practice shows the most on screen (hints and areas to explore).
        const call = await api.createCall({ scenarioId: scenario.id, mode: 'guided' });
        await page.goto(`/calls/${call.id}?input=text`);
        const screen = callScreen(page);
        await expect(screen.preflight.heading).toBeVisible();
        const preflight = await page.locator('body').innerText();
        await screen.preflight.startText.click();
        await expect(screen.reply).toBeVisible();
        await expect(screen.turns).toHaveCount(1);
        // The case, and everything folded away in it, is read as well as what is shown.
        const more = page.getByRole('button', { name: 'More context' });
        if (await more.count()) await more.click();
        const started = await page.locator('body').innerText();
        expect(scenario.secrets.length, 'the library has nothing to look for').toBeGreaterThan(0);
        expect(
          leakedSecrets(`${preflight}\n${started}`, secretsBesidesAreas(scenario)),
          `The call page of "${scenario.title}" shows something the customer keeps back`,
        ).toEqual([]);
      });
    }
  });
});
