import { expect, type Locator, type Page } from '@playwright/test';
import type { SessionDTO } from '../../shared/domain/api.ts';
import type { CreateCallOptions, FireflyApi } from './api.ts';

// Locators and small flows for the call page, so that each journey reads as what the person does.
// Every locator is a role or a label with the name the person hears. The exceptions are the status
// line (it is deliberately not a live region, so it has no role: it is found by its `data-status`,
// inside the "Customer" region), the problem card, which is found by its class so that "Retry"
// and "Replay" on the card are never mixed up with the "Replay" control of the call, and the tips
// strip's card in hand and window (the cards are all in the page; the one in hand is `aria-current`).
//
//   const screen = callScreen(page);
//   await screen.preflight.startVoice.click();
//   await expect(screen.status).toHaveText(STATUS.speaking);

/**
 * The words of the status line: the voice vocabulary the call and its announcements share, apart from
 * the trainee's own turn, where the screen says "Your turn" (typed) and "Listening to you" (spoken).
 */
export const STATUS = {
  micOff: 'Microphone off',
  waiting: 'Waiting for permission',
  blocked: 'Microphone blocked',
  micReady: 'Microphone ready',
  listening: 'Listening to you',
  hearing: 'Hearing you',
  processing: 'Processing speech',
  replying: 'Customer is replying',
  speaking: 'Customer speaking',
  paused: 'Paused',
  muted: 'Muted',
  tryAgain: 'Try again',
  retrying: 'Retrying',
  offline: 'Offline',
  ending: 'Ending call',
  preparing: 'Preparing your review',
  complete: 'Call complete',
  typing: 'Your turn',
} as const;

/** The status line's `data-status`, for the states that a spoken call moves through. */
export const STATUS_ID = {
  micReady: 'mic-ready',
  listening: 'listening',
  hearing: 'speech-detected',
  processing: 'processing-speech',
  replying: 'generating-reply',
  speaking: 'customer-speaking',
  paused: 'paused',
  muted: 'muted',
  retry: 'retry-required',
  retrying: 'retrying',
  offline: 'offline',
  typing: 'text-fallback',
} as const;

export function callScreen(page: Page) {
  const customer = page.getByRole('region', { name: 'Customer', exact: true });
  const transcript = page.getByRole('log', { name: 'Call transcript' });
  const controls = page.getByRole('group', { name: 'Call controls' });
  const card = page.locator('.cw-recovery');
  return {
    customer,
    /** The status line: "Listening to you", "Hearing you", "Customer speaking" ... */
    status: customer.locator('[data-status] .cw-status__label'),
    /** The status line itself: its `data-status` says which state the call is in. */
    statusLine: customer.locator('[data-status]'),
    transcript,
    /** Every turn so far, the customer's greeting first. */
    turns: transcript.getByRole('listitem'),
    controls,
    talk: controls.getByRole('button', { name: 'Talk', exact: true }),
    done: controls.getByRole('button', { name: 'Done speaking', exact: true }),
    stopAudio: controls.getByRole('button', { name: 'Stop customer audio', exact: true }),
    mute: controls.getByRole('button', { name: 'Mute', exact: true }),
    text: controls.getByRole('button', { name: 'Text', exact: true }),
    returnToVoice: controls.getByRole('button', { name: 'Return to voice', exact: true }),
    pause: controls.getByRole('button', { name: 'Pause', exact: true }),
    resume: controls.getByRole('button', { name: 'Resume', exact: true }),
    replay: controls.getByRole('button', { name: 'Replay', exact: true }),
    settings: controls.getByRole('button', { name: 'Settings', exact: true }),
    endCall: page.getByRole('button', { name: 'End call', exact: true }),
    reply: page.getByRole('textbox', { name: 'Your reply' }),
    send: page.getByRole('button', { name: 'Send', exact: true }),
    /** The customer's mood, and in guided practice how much context has been found. */
    state: page.getByRole('group', { name: 'Customer state' }),
    endDialog: page.getByRole('dialog', { name: /^(?:End the call\?|Ready to close\?)$/ }),
    endingDialog: page.getByRole('dialog', { name: 'Ending and preparing your review' }),
    settingsDialog: page.getByRole('dialog', { name: 'Voice settings' }),
    /** The tips strip of Guided practice, and what is in it. It is not on any other call. */
    tips: {
      region: page.getByRole('region', { name: 'Tips for this call', exact: true }),
      heading: page.getByRole('heading', { level: 2, name: 'During the call' }),
      previous: page.getByRole('button', { name: 'Previous tip', exact: true }),
      next: page.getByRole('button', { name: 'Next tip', exact: true }),
      hide: page.getByRole('button', { name: 'Hide tips', exact: true }),
      show: page.getByRole('button', { name: 'Show tips', exact: true }),
      learnWhy: page.getByRole('button', { name: 'Learn why', exact: true }),
      /** The cards, each named "Tip 2 of 19". */
      cards: page
        .getByRole('region', { name: 'Tips for this call', exact: true })
        .getByRole('listitem'),
      /** The tip that is in hand (the card marked `aria-current`): its words. */
      current: page.locator('.tp-card[aria-current="true"] .tp-card__text'),
      /** The window the cards slide in. */
      deck: page.locator('.tp-deck'),
    },
    /** The four checks of "Ready to close?" in Guided practice. */
    closing: {
      list: page.getByRole('list', { name: 'Closing check' }),
      rows: page.getByRole('list', { name: 'Closing check' }).getByRole('listitem'),
    },
    /** The one card that says what went wrong, what was kept and what can be done. */
    problem: {
      card,
      title: card.locator('.ff-message__title'),
      retry: card.getByRole('button', { name: 'Retry', exact: true }),
      replay: card.getByRole('button', { name: 'Replay', exact: true }),
      useText: card.getByRole('button', { name: 'Use text', exact: true }),
      continueWithoutAudio: card.getByRole('button', {
        name: 'Continue without audio',
        exact: true,
      }),
      endSafely: card.getByRole('button', { name: 'End safely', exact: true }),
    },
    preflight: {
      heading: page.getByRole('heading', { level: 1, name: 'Ready to call?' }),
      resumeHeading: page.getByRole('heading', { level: 1, name: 'Resume call' }),
      checks: page.getByRole('list', { name: 'What is ready' }),
      startVoice: page.getByRole('button', { name: 'Start voice call' }),
      startText: page.getByRole('button', { name: 'Start text call' }),
      resumeVoice: page.getByRole('button', { name: 'Resume voice call' }),
      resumeText: page.getByRole('button', { name: 'Resume with text' }),
      voiceDetails: page.getByRole('button', { name: 'How your voice is handled' }),
      backToBrief: page.getByRole('link', { name: 'Back to brief' }),
    },
  };
}

export type CallScreen = ReturnType<typeof callScreen>;

/** The id of the call the page is showing, from its address. */
export function callIdOf(page: Page): string {
  const match = /\/calls\/([^/?#]+)/.exec(new URL(page.url()).pathname);
  if (!match) throw new Error(`This is not a call page: ${page.url()}`);
  return decodeURIComponent(match[1] as string);
}

/** Makes a call through the API and opens its pre-flight page. */
export async function openPreflight(
  page: Page,
  api: FireflyApi,
  options: CreateCallOptions & { input?: 'voice' | 'text' } = {},
): Promise<SessionDTO> {
  const { input = 'voice', ...create } = options;
  const call = await api.createCall(create);
  await page.goto(`/calls/${call.id}?input=${input}`);
  await callScreen(page).preflight.heading.waitFor();
  return call;
}

/** Makes a spoken call and presses "Start voice call". The customer's greeting begins to play. */
export async function startSpokenCall(
  page: Page,
  api: FireflyApi,
  options: CreateCallOptions = {},
): Promise<{ call: SessionDTO; screen: CallScreen }> {
  const call = await openPreflight(page, api, { ...options, input: 'voice' });
  const screen = callScreen(page);
  await screen.preflight.startVoice.click();
  return { call, screen };
}

/** Makes a typed call and presses "Start text call". */
export async function startTypedCall(
  page: Page,
  api: FireflyApi,
  options: CreateCallOptions = {},
): Promise<{ call: SessionDTO; screen: CallScreen }> {
  const call = await openPreflight(page, api, { ...options, input: 'text' });
  const screen = callScreen(page);
  await screen.preflight.startText.click();
  await screen.reply.waitFor();
  return { call, screen };
}

/** Types a reply and sends it with the button. */
export async function sendTyped(screen: CallScreen, text: string): Promise<void> {
  await screen.reply.fill(text);
  await screen.send.click();
}

/**
 * Types each line and waits for the customer's answer to it, so the transcript grows two turns at
 * a time. `from` is how many turns there are already (the greeting is one).
 */
export async function converse(
  screen: CallScreen,
  lines: readonly string[],
  from = 1,
): Promise<number> {
  let turns = from;
  for (const line of lines) {
    await sendTyped(screen, line);
    turns += 2;
    await expect(screen.turns).toHaveCount(turns);
  }
  return turns;
}

/** Ends the call from the call page and waits for the report to open. */
export async function endCallAndOpenReport(page: Page, screen: CallScreen): Promise<string> {
  const id = callIdOf(page);
  await screen.endCall.click();
  await screen.endDialog.getByRole('button', { name: 'End and review' }).click();
  await expect(page).toHaveURL(new RegExp(`/sessions/${id}/report$`), { timeout: 30_000 });
  await expect(page.getByRole('heading', { level: 1, name: 'Coaching report' })).toBeVisible({
    timeout: 30_000,
  });
  return id;
}

/** What a locator's text says, with runs of white space made single spaces. */
export async function textOf(locator: Locator): Promise<string> {
  return ((await locator.innerText()) ?? '').replace(/\s+/g, ' ').trim();
}
