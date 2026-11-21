import type { Page, Request, Response } from '@playwright/test';
import { lengthenCustomerVoice } from './support/a11y.ts';
import { DEFAULT_SCENARIO } from './support/api.ts';
import {
  STATUS,
  callIdOf,
  callScreen,
  endCallAndOpenReport,
  startSpokenCall,
} from './support/call-screen.ts';
import { expect, test } from './support/fixtures.ts';
import { readProbe } from './support/page-probes.ts';

// What happens to the microphone and to the audio, in a real browser: the notice comes before the
// first spoken call, the microphone is asked for only by "Start voice call" on the call page (or by
// the optional "Check microphone"), it is let go of whenever the call stops using it, audio goes to
// Firefly's own server and nowhere else, and no audio is kept in the browser or in the saved call.
//
// The microphone is Chromium's fake device (a speech-like recording) and the speech service is the
// server's mock, so this proves where audio goes and what is kept; it says nothing about how a real
// speech provider treats it.

test.describe.configure({ timeout: 150_000 });

const BRIEF = `/scenarios/${DEFAULT_SCENARIO}/brief`;
const NOTICE =
  'Firefly uses your microphone to transcribe this simulated call. Do not share real customer information.';

/** Everything the page asks for and is answered with, until it is looked at. */
function watchTraffic(page: Page) {
  const requests: Request[] = [];
  const responses: Response[] = [];
  page.on('request', (request) => requests.push(request));
  page.on('response', (response) => responses.push(response));
  return { requests, responses };
}

/** What the browser keeps for this site, in every place a page can keep anything. */
async function stored(page: Page) {
  return page.evaluate(async () => {
    const directory = await navigator.storage.getDirectory();
    let files = 0;
    for await (const _entry of (
      directory as unknown as { values(): AsyncIterable<unknown> }
    ).values()) {
      files += 1;
    }
    return {
      local: Object.fromEntries(Object.entries(localStorage)),
      session: Object.fromEntries(Object.entries(sessionStorage)),
      databases: (await indexedDB.databases()).length,
      caches: (await caches.keys()).length,
      workers: (await navigator.serviceWorker.getRegistrations()).length,
      files,
    };
  });
}

test.describe('before the first spoken call', () => {
  test('the notice says what the microphone is for before anything asks for it, and reading it is remembered as a flag and nothing else', async ({
    page,
  }) => {
    const screen = callScreen(page);
    await page.goto(BRIEF);

    await test.step('the notice is on the brief, in one sentence, with the details a press away', async () => {
      const notice = page.getByRole('region', { name: 'Privacy notice' });
      await expect(notice).toBeVisible();
      await expect(notice).toContainText(NOTICE);
      await notice.getByRole('button', { name: 'How your voice is handled' }).click();
      for (const heading of [
        'Synthetic scenarios only',
        'Starts only after you allow it',
        'You can always see when it is recording',
        'Stop at any time',
        'You can type instead',
        'Your recording is discarded',
        'The transcript is saved with the call',
      ]) {
        await expect(notice.getByText(heading, { exact: true })).toBeVisible();
      }
      // Reading about the microphone has not used it.
      expect((await readProbe(page)).mediaRequests).toBe(0);
      expect((await stored(page)).local).toEqual({});
    });

    await test.step('pressing "Start voice call" counts as having read it, and still asks for nothing', async () => {
      await page.getByRole('button', { name: 'Start voice call' }).click();
      await expect(screen.preflight.heading).toBeVisible();
      await expect(page.getByText(NOTICE)).toBeVisible();
      expect((await readProbe(page)).mediaRequests).toBe(0);
      expect((await stored(page)).local).toEqual({ 'firefly.voice-notice-seen': '1' });
    });

    await test.step('only the button on the call page asks for the microphone', async () => {
      await screen.preflight.startVoice.click();
      await expect(screen.status).toHaveText(STATUS.speaking);
      const probe = await readProbe(page);
      expect(probe.mediaRequests).toBe(1);
      expect(probe.micTracks).toEqual(['live']);
    });

    await test.step('next time the notice is a closed row, and the flag is still all that is kept', async () => {
      await page.goto(BRIEF);
      await expect(page.getByRole('region', { name: 'Privacy notice' })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'How your voice is handled' })).toBeVisible();
      expect((await stored(page)).local).toEqual({ 'firefly.voice-notice-seen': '1' });
    });
  });

  test('"Check microphone" is the one optional request: made only when pressed, and the microphone is let go of when it is done', async ({
    page,
  }) => {
    await page.goto(BRIEF);
    const side = page.getByRole('complementary', { name: 'Voice call' });
    expect((await readProbe(page)).mediaRequests).toBe(0);

    await side.getByRole('button', { name: 'Check microphone' }).click();
    await expect(side.getByText('Microphone works.')).toBeVisible({ timeout: 20_000 });
    const probe = await readProbe(page);
    expect(probe.mediaRequests).toBe(1);
    expect(probe.micTracks, 'the check lets go of the microphone').not.toContain('live');
  });
});

test.describe('while a call is going', () => {
  test('the microphone is let go of when the call ends', async ({ page, api }) => {
    const { screen } = await startSpokenCall(page, api);
    await expect(screen.status).toHaveText(STATUS.speaking);
    expect((await readProbe(page)).micTracks).toEqual(['live']);
    // A call with nothing said has no report, so one exchange is heard first.
    await expect(screen.turns).toHaveCount(3, { timeout: 45_000 });
    await endCallAndOpenReport(page, screen);
    expect((await readProbe(page)).micTracks).toEqual(['ended']);
  });

  test('the microphone is let go of when the trainee types instead', async ({ page, api }) => {
    await lengthenCustomerVoice(page, 30);
    const { screen } = await startSpokenCall(page, api);
    await expect(screen.status).toHaveText(STATUS.speaking);
    await screen.text.click();
    await expect(screen.status).toHaveText(STATUS.typing);
    await expect.poll(async () => (await readProbe(page)).micTracks).toEqual(['ended']);
  });

  test('Pause lets go of the microphone, and Resume asks for it again', async ({ page, api }) => {
    await lengthenCustomerVoice(page, 30);
    const { screen } = await startSpokenCall(page, api);
    await expect(screen.status).toHaveText(STATUS.speaking);
    await screen.pause.click();
    await expect(screen.status).toHaveText(STATUS.paused);
    await expect.poll(async () => (await readProbe(page)).micTracks).toEqual(['ended']);
    await screen.resume.click();
    await expect.poll(async () => (await readProbe(page)).micTracks).toEqual(['ended', 'live']);
  });

  test('the microphone is let go of when the trainee leaves the call with the Back button', async ({
    page,
  }) => {
    await lengthenCustomerVoice(page, 30);
    await page.goto(BRIEF);
    await page.getByRole('button', { name: 'Start voice call' }).click();
    const screen = callScreen(page);
    await screen.preflight.startVoice.click();
    await expect(screen.status).toHaveText(STATUS.speaking);
    expect((await readProbe(page)).micTracks).toEqual(['live']);

    await page.goBack();
    await expect(page.getByRole('heading', { level: 1, name: 'Case brief' })).toBeVisible();
    await expect.poll(async () => (await readProbe(page)).micTracks).toEqual(['ended']);
    expect((await readProbe(page)).mediaRequests).toBe(1);
  });
});

test.describe('what a spoken call sends and keeps', () => {
  test("audio goes to Firefly's own server and nowhere else, is never cached, and nothing of it is kept", async ({
    page,
    api,
  }) => {
    const traffic = watchTraffic(page);
    const { call, screen } = await startSpokenCall(page, api);
    await expect(screen.turns).toHaveCount(3, { timeout: 45_000 });
    const id = callIdOf(page);
    await endCallAndOpenReport(page, screen);
    const origin = new URL(page.url()).origin;

    await test.step('every request went to this server (or was a local blob for playback)', async () => {
      const elsewhere = traffic.requests
        .map((request) => request.url())
        .filter((url) => !url.startsWith(origin) && !/^(blob|data):/.test(url));
      expect(elsewhere, "a request left Firefly's own server").toEqual([]);
    });

    await test.step('recordings are sent only to the transcription address, and only as audio', async () => {
      const withAudio = traffic.requests.filter((request) =>
        (request.headers()['content-type'] ?? '').startsWith('audio/'),
      );
      expect(withAudio.length, 'the spoken turn was sent for transcription').toBeGreaterThan(0);
      for (const request of withAudio) {
        expect(request.method()).toBe('POST');
        expect(new URL(request.url()).pathname).toBe('/api/speech/transcribe');
      }
      // Nothing else carries a body that could be audio.
      const others = traffic.requests.filter(
        (request) =>
          request.method() !== 'GET' &&
          new URL(request.url()).pathname !== '/api/speech/transcribe' &&
          (request.postDataBuffer()?.length ?? 0) > 20_000,
      );
      expect(others.map((request) => request.url())).toEqual([]);
    });

    await test.step('what the speech addresses answer is never cached', async () => {
      const speech = traffic.responses.filter((response) =>
        new URL(response.url()).pathname.startsWith('/api/speech/'),
      );
      expect(speech.length).toBeGreaterThan(0);
      for (const response of speech) {
        expect(response.headers()['cache-control'], response.url()).toBe('no-store');
      }
    });

    await test.step('the browser keeps no audio: nothing in storage, caches, databases, workers or files', async () => {
      const kept = await stored(page);
      expect(Object.keys(kept.local).filter((key) => key !== 'firefly.voice-notice-seen')).toEqual(
        [],
      );
      expect(kept.databases).toBe(0);
      expect(kept.caches).toBe(0);
      expect(kept.workers).toBe(0);
      expect(kept.files).toBe(0);
      // Only page positions, as numbers, which never hold text.
      for (const key of Object.keys(kept.session))
        expect(key).toBe('react-router-scroll-positions');
    });

    await test.step('the saved call holds the words and no audio', async () => {
      const saved = await page.request.get(`/api/sessions/${id}`);
      expect(saved.ok()).toBe(true);
      const text = await saved.text();
      expect(text).not.toMatch(/data:audio|\bRIFF\b|"audio[A-Za-z]*"\s*:\s*"[^"]{100,}"/);
      // A recording would be a long run of base64 characters.
      expect(text).not.toMatch(/[A-Za-z0-9+/=]{400,}/);
      const spoken = (await api.session(id)).turns.filter(
        (turn) => turn.role === 'trainee' && turn.inputMode === 'voice',
      );
      expect(spoken.length, 'the transcript is saved with the call').toBeGreaterThan(0);
      expect(spoken[0]!.text.length).toBeGreaterThan(0);
      expect(call.id).toBe(id);
    });
  });
});
