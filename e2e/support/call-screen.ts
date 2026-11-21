import type { Locator, Page } from '@playwright/test';
import type { SessionDTO } from '../../shared/domain/api.ts';
import type { CreateCallOptions, FireflyApi } from './api.ts';

// Locators and small flows for the call page, so that each journey reads as what the person does.
// Every locator is a role or a label with the name the person hears; the two exceptions are the
// status line (it is deliberately not a live region, so it has no role: it is found by its
// `data-stage`) and nothing else.
//
//   const screen = callScreen(page);
//   await screen.preflight.allow.click();
//   await expect(screen.status).toHaveText('The customer is speaking');

export function callScreen(page: Page) {
  const transcript = page.getByRole('log', { name: 'Call transcript' });
  return {
    /** The status line: "Listening", "Hearing you", "The customer is speaking", "Your turn" ... */
    status: page.locator('[data-stage] .cw-voice__label'),
    transcript,
    /** Every turn so far, the customer's opening line first. */
    turns: transcript.getByRole('listitem'),
    talk: page.getByRole('button', { name: 'Talk', exact: true }),
    stopTalking: page.getByRole('button', { name: 'Stop talking', exact: true }),
    interrupt: page.getByRole('button', { name: 'Interrupt', exact: true }),
    mute: page.getByRole('button', { name: 'Mute', exact: true }),
    pause: page.getByRole('button', { name: 'Pause', exact: true }),
    resume: page.getByRole('button', { name: 'Resume', exact: true }),
    replay: page.getByRole('button', { name: 'Replay', exact: true }),
    typeInstead: page.getByRole('button', { name: 'Type instead', exact: true }),
    voiceSettings: page.getByRole('button', { name: 'Voice settings', exact: true }),
    endCall: page.getByRole('button', { name: 'End call', exact: true }),
    reply: page.getByRole('textbox', { name: 'Type a reply' }),
    send: page.getByRole('button', { name: 'Send', exact: true }),
    /** The customer's mood, and in guided practice how much context has been found. */
    state: page.getByRole('group', { name: 'Customer state' }),
    endDialog: page.getByRole('dialog', { name: 'End the call?' }),
    endingDialog: page.getByRole('dialog', { name: 'Ending the call' }),
    preflight: {
      heading: page.getByRole('heading', { level: 1, name: 'Ready to start the call?' }),
      checks: page.getByRole('list', { name: 'What is ready' }),
      allow: page.getByRole('button', { name: 'Allow microphone and start' }),
      textOnly: page.getByRole('button', { name: 'Start text-only call' }),
      tryAgain: page.getByRole('button', { name: 'Try again' }),
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

/** Makes a spoken call and presses "Allow microphone and start". The opening line begins to play. */
export async function startSpokenCall(
  page: Page,
  api: FireflyApi,
  options: CreateCallOptions = {},
): Promise<{ call: SessionDTO; screen: CallScreen }> {
  const call = await openPreflight(page, api, { ...options, input: 'voice' });
  const screen = callScreen(page);
  await screen.preflight.allow.click();
  return { call, screen };
}

/** Makes a typed call and presses "Start text-only call". */
export async function startTypedCall(
  page: Page,
  api: FireflyApi,
  options: CreateCallOptions = {},
): Promise<{ call: SessionDTO; screen: CallScreen }> {
  const call = await openPreflight(page, api, { ...options, input: 'text' });
  const screen = callScreen(page);
  await screen.preflight.textOnly.click();
  await screen.reply.waitFor();
  return { call, screen };
}

/** Types a reply and sends it with the button. */
export async function sendTyped(screen: CallScreen, text: string): Promise<void> {
  await screen.reply.fill(text);
  await screen.send.click();
}

/** What a locator's text says, with runs of white space made single spaces. */
export async function textOf(locator: Locator): Promise<string> {
  return ((await locator.innerText()) ?? '').replace(/\s+/g, ' ').trim();
}
