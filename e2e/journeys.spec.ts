import type { Page } from '@playwright/test';
import type { CoachingReport } from '../shared/domain/report.ts';
import { lengthenCustomerVoice } from './support/a11y.ts';
import { DEFAULT_SCENARIO, GOOD_CALL } from './support/api.ts';
import {
  STATUS,
  callIdOf,
  callScreen,
  converse,
  endCallAndOpenReport,
  sendTyped,
  startSpokenCall,
} from './support/call-screen.ts';
import { expect, test } from './support/fixtures.ts';
import { isMockUtterance } from './support/mock-speech.ts';
import { readProbe } from './support/page-probes.ts';
import { libraryScenario } from './support/scenario-library.ts';

// The whole trip, the way a person takes it with a pointer: the landing page, the scenarios, one
// scenario's brief, a call (spoken, typed, or spoken and then typed and spoken again), End call, and
// the report. The keyboard-only trip is in keyboard.spec.ts. Each journey checks that what was said
// is what the report is about, and that the browser logged nothing it should not have (the `problems`
// fixture fails any journey that did).
//
// The microphone is Chromium's fake device playing a speech-like recording; the speech service is the
// server's mock, which answers every recording with one of eight scripted sentences. The customer's
// words come from the real rules engine (demo mode).

test.describe.configure({ timeout: 150_000 });

const scenario = libraryScenario(DEFAULT_SCENARIO);

const region = (page: Page, name: string) => page.getByRole('region', { name, exact: true });

/** The landing page's "Start call" to a chosen scenario's brief, with the pointer. */
async function chooseScenarioAndOpenBrief(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page).toHaveTitle('Firefly: practise Microsoft support calls');
  await region(page, 'Practise Microsoft support calls safely.')
    .getByRole('link', { name: 'Start call' })
    .click();
  await expect(page.getByRole('heading', { level: 1, name: 'Scenarios' })).toBeVisible();
  // The workspace tidies its address once the list has arrived; a choice made before that is lost.
  await expect(page).toHaveURL(/[?&]scenario=/);

  await page.getByRole('radio', { name: scenario.shortTitle, exact: true }).check();
  await expect(region(page, scenario.title)).toBeVisible();
  await region(page, scenario.title).getByRole('link', { name: 'Start configuration' }).click();
  await expect(page).toHaveTitle(`Case brief: ${scenario.title} \u00b7 Firefly`);
  await expect(page.getByRole('heading', { level: 1, name: 'Case brief' })).toBeVisible();
}

test('by pointer and voice: from the landing page to a spoken call and its report', async ({
  page,
  api,
}) => {
  const screen = callScreen(page);
  let greeting = '';
  let heard = '';

  await test.step('the landing page opens the scenarios, a scenario opens its brief', async () => {
    await chooseScenarioAndOpenBrief(page);
  });

  await test.step('"Start voice call" in the brief opens the pre-flight, and nothing has asked for the microphone', async () => {
    await page.getByRole('button', { name: 'Start voice call' }).click();
    await expect(page).toHaveURL(/\/calls\/[^/?]+\?input=voice&voice=voice-[a-d]$/);
    await expect(screen.preflight.heading).toBeVisible();
    expect((await readProbe(page)).mediaRequests).toBe(0);
  });

  await test.step('"Start voice call" on the call page asks for the microphone once, and the customer greets', async () => {
    await screen.preflight.startVoice.click();
    await expect(screen.status).toHaveText(STATUS.speaking);
    greeting = (await api.session(callIdOf(page))).turns[0]!.text;
    await expect(screen.turns).toHaveCount(1);
    await expect(screen.turns.first()).toContainText(greeting);
    expect((await readProbe(page)).mediaRequests).toBe(1);
  });

  await test.step('what the trainee says is heard, written down as words, and answered', async () => {
    await expect(screen.turns).toHaveCount(3, { timeout: 45_000 });
    heard = (await screen.turns.nth(1).locator('.cw-turn__text').innerText()).trim();
    expect(
      isMockUtterance(heard),
      `the transcript has what the speech service returned: ${heard}`,
    ).toBe(true);
    await expect(screen.turns.nth(2)).toBeVisible();
  });

  await test.step('End call, then End and review, opens the report of this call', async () => {
    await endCallAndOpenReport(page, screen);
    await expect(page).toHaveTitle('Coaching report \u00b7 Firefly');
    await expect(region(page, 'Scores').getByRole('listitem')).toHaveCount(6);
    const transcript = region(page, 'Transcript');
    await expect(transcript).toContainText(greeting);
    await expect(transcript).toContainText(heard);
    await expect(
      region(page, 'Actions').getByRole('link', { name: 'Try another call' }),
    ).toBeVisible();
  });

  await test.step('the microphone is let go of when the call ends', async () => {
    const probe = await readProbe(page);
    expect(probe.mediaRequests).toBe(1);
    expect(probe.micTracks).toEqual(['ended']);
  });
});

test('by pointer and typing only: "Start a text-only call", the reply box, End call and the report', async ({
  page,
  api,
}) => {
  const screen = callScreen(page);

  await test.step('the landing page opens the scenarios, a scenario opens its brief', async () => {
    await chooseScenarioAndOpenBrief(page);
  });

  await test.step('"Start a text-only call" opens a pre-flight, and starting it asks for no microphone', async () => {
    await page.getByRole('button', { name: 'Start a text-only call' }).click();
    await expect(page).toHaveURL(/\/calls\/[^/?]+\?input=text/);
    await expect(screen.preflight.heading).toBeVisible();
    await screen.preflight.startText.click();
    await expect(screen.reply).toBeVisible();
    expect((await readProbe(page)).mediaRequests).toBe(0);
  });

  await test.step('the customer opens, and a whole call is typed into the reply box', async () => {
    await expect(screen.turns).toHaveCount(1);
    await converse(screen, GOOD_CALL);
    await expect(screen.status).toHaveText(STATUS.typing);
  });

  await test.step('the microphone was never asked for, and nothing was spoken', async () => {
    const probe = await readProbe(page);
    expect(probe.mediaRequests).toBe(0);
    expect(probe.playCalls).toEqual([]);
    expect(probe.synthesisCalls).toBe(0);
  });

  await test.step('End call, then End and review, opens a report that agrees with the conversation', async () => {
    const id = await endCallAndOpenReport(page, screen);
    const report = (await api.session(id)).report as CoachingReport;
    await expect(region(page, 'Scores').getByRole('listitem')).toHaveCount(6);
    // The call asked about every hidden fact, so the report says every one was found.
    expect(report.discovery.found).toBe(report.discovery.total);
    expect(report.discovery.total).toBeGreaterThan(0);
    await expect(region(page, 'Discovery review')).toContainText(
      `${report.discovery.found} of ${report.discovery.total} hidden facts found`,
    );
    const transcript = region(page, 'Transcript');
    for (const line of GOOD_CALL) await expect(transcript).toContainText(line.slice(0, 40));
    await expect(region(page, 'Summary')).not.toContainText(/limited evidence/i);
  });
});

test('a spoken call can switch to typing and back to voice, and stays one call', async ({
  page,
  api,
}) => {
  await lengthenCustomerVoice(page, 30);
  const { call, screen } = await startSpokenCall(page, api);
  await expect(screen.status).toHaveText(STATUS.speaking);

  await test.step('"Text" stops the customer\'s voice, lets go of the microphone and puts the keyboard in the reply box', async () => {
    await screen.text.click();
    await expect(screen.status).toHaveText(STATUS.typing);
    await expect(screen.reply).toBeFocused();
    // The customer's words stay; only the sound was stopped.
    await expect(screen.turns.first()).toContainText('Audio stopped');
    await expect.poll(async () => (await readProbe(page)).micTracks).toEqual(['ended']);
    // Voice controls leave a typed call: nothing is left that cannot be used.
    await expect(screen.controls.getByRole('button')).toHaveText(['Return to voice', 'Settings']);
  });

  await test.step('a typed reply is answered in words, and is not spoken', async () => {
    await sendTyped(screen, GOOD_CALL[0]!);
    await expect(screen.turns).toHaveCount(3);
    const probe = await readProbe(page);
    // The only sound was made before the typed reply (a silent clip that lets sound play, then the
    // opening line): nothing was played once the typed exchange was in the transcript.
    expect(
      probe.playCalls.filter((play) => play.turns >= 2),
      'the reply was spoken',
    ).toEqual([]);
    expect(probe.synthesisCalls).toBe(0);
  });

  await test.step('"Return to voice" asks for the microphone again, and the call listens', async () => {
    await expect(screen.returnToVoice).toBeEnabled();
    await screen.returnToVoice.click();
    await expect(screen.reply).toHaveCount(0);
    await expect(screen.status).toHaveText(
      new RegExp(`^(${STATUS.micReady}|${STATUS.listening}|${STATUS.hearing})$`),
      { timeout: 20_000 },
    );
    const probe = await readProbe(page);
    expect(probe.mediaRequests).toBe(2);
    expect(probe.micTracks).toEqual(['ended', 'live']);
  });

  await test.step('what is spoken next is heard and answered in the same call', async () => {
    await expect(screen.turns).toHaveCount(5, { timeout: 45_000 });
    const heard = (await screen.turns.nth(3).locator('.cw-turn__text').innerText()).trim();
    expect(
      isMockUtterance(heard),
      `the transcript has what the speech service returned: ${heard}`,
    ).toBe(true);
  });

  await test.step('the call has one typed and one spoken trainee turn, in that order, and ends in a report', async () => {
    const id = callIdOf(page);
    expect(id).toBe(call.id);
    const turns = (await api.session(id)).turns.filter((turn) => turn.role === 'trainee');
    expect(turns.map((turn) => turn.inputMode)).toEqual(['text', 'voice']);
    await endCallAndOpenReport(page, screen);
    await expect(region(page, 'Scores').getByRole('listitem')).toHaveCount(6);
    expect((await readProbe(page)).micTracks).toEqual(['ended', 'ended']);
  });
});
