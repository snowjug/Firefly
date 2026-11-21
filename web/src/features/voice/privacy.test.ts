import { describe, expect, it } from 'vitest';
import {
  MICROPHONE_NOTICE,
  PRIVACY_DETAIL_IDS,
  PRIVACY_DETAILS_LABEL,
  privacyDetails,
  whoHearsYou,
  whoSpeaksForTheCustomer,
  type PrivacyContext,
} from './privacy.ts';

// The words a trainee reads about their voice. They are plain data for the screen, and each one is a
// statement about what this code does, so the tests check the statements against the speech path in
// use: the details must not say Azure when the browser's own service is listening, and must not hide
// that a recording can be held in the browser for a retry.

const AZURE: PrivacyContext = {
  provider: 'azure-speech',
  capture: 'server-speech',
  playback: 'server-speech',
};
const DEMO: PrivacyContext = {
  provider: 'mock',
  capture: 'server-speech',
  playback: 'server-speech',
};
const BROWSER: PrivacyContext = {
  provider: 'none',
  capture: 'browser-recognition',
  playback: 'browser-synthesis',
  chromium: true,
};
const TYPED: PrivacyContext = { provider: 'none', capture: 'none', playback: 'none' };

const byId = (context: PrivacyContext) =>
  Object.fromEntries(privacyDetails(context).map((detail) => [detail.id, detail]));

describe('the first-use notice', () => {
  it('is exactly the agreed sentence', () => {
    expect(MICROPHONE_NOTICE).toBe(
      'Firefly uses your microphone to transcribe this simulated call. Do not share real customer information.',
    );
  });

  it('has a label for the control that opens the details', () => {
    expect(PRIVACY_DETAILS_LABEL).toBe('How your voice is handled');
  });
});

describe('the details', () => {
  it.each([AZURE, DEMO, BROWSER, TYPED])('lists every statement, in order, for %j', (context) => {
    const details = privacyDetails(context);
    expect(details.map((detail) => detail.id)).toEqual([...PRIVACY_DETAIL_IDS]);
    for (const detail of details) {
      expect(detail.label.length).toBeGreaterThan(3);
      expect(detail.text).toMatch(/^[A-Z].*[.]$/);
    }
  });

  it('is plain data: it survives being sent as JSON', () => {
    for (const context of [AZURE, DEMO, BROWSER, TYPED]) {
      const details = privacyDetails(context);
      expect(JSON.parse(JSON.stringify(details))).toEqual(details);
    }
  });

  it('says the scenarios are synthetic and warns against real information', () => {
    expect(byId(AZURE)['synthetic-only']?.text).toMatch(/made up/);
    expect(byId(AZURE)['synthetic-only']?.text).toMatch(/real customer/i);
  });

  it('says the microphone starts only after permission, shows its status, and can be stopped', () => {
    const details = byId(AZURE);
    expect(details['permission-first']?.text).toMatch(/until you start the call and allow it/);
    expect(details['recording-status']?.text).toMatch(/Listening/);
    expect(details['recording-status']?.text).toMatch(/indicator/);
    expect(details['stop-any-time']?.text).toMatch(/mute/i);
    expect(details['stop-any-time']?.text).toMatch(/Done speaking/);
    expect(details['stop-any-time']?.text).toMatch(/Pausing or ending/);
    expect(details['typed-fallback']?.text).toMatch(/Typing a reply always works/);
  });

  it('says where the transcript is stored and that no audio is', () => {
    const { transcript } = byId(AZURE);
    expect(transcript?.text).toMatch(/Firefly server/);
    expect(transcript?.text).toMatch(/No audio is saved/);
    expect(transcript?.text).toMatch(/until the call is deleted/);
  });

  describe('raw audio, told as this code does it', () => {
    it('on the server path: held in memory until it is text, not written or logged, kept in the browser only for a retry', () => {
      const text = byId(AZURE)['raw-audio']?.text ?? '';
      expect(text).toMatch(/held in memory only until/);
      expect(text).toMatch(/does not write it to disk or to a database and does not log it/);
      expect(text).toMatch(/overwrites its own copy/);
      expect(text).toMatch(/retry/);
      expect(text).toMatch(/end the call/);
      // Not the claim that nothing is ever held: a retry can keep it in the browser for a while.
      expect(text).not.toMatch(/never (held|kept|stored)/i);
    });

    it('on the browser path: Firefly never receives it', () => {
      const text = byId(BROWSER)['raw-audio']?.text ?? '';
      expect(text).toMatch(/never receives or keeps your audio/);
    });

    it('with no speech: nothing is recorded', () => {
      expect(byId(TYPED)['raw-audio']?.text).toMatch(/Nothing is recorded/);
    });
  });
});

describe('which service handles the audio', () => {
  const provider = (context: PrivacyContext) => byId(context).provider;

  it('Azure AI Speech through this server, for both directions', () => {
    expect(provider(AZURE)?.label).toBe('Who handles your audio: Azure AI Speech');
    expect(provider(AZURE)?.text).toMatch(/sent through this Firefly server to Azure AI Speech/);
    expect(provider(AZURE)?.text).toMatch(/customer's lines are sent to Azure AI Speech/);
  });

  it('the demonstration provider throws the audio away and sends nothing anywhere, and never says Azure', () => {
    const text = provider(DEMO)?.text ?? '';
    expect(provider(DEMO)?.label).toBe('Who handles your audio: Demo speech (scripted)');
    expect(text).toMatch(/throws it away without understanding it/);
    expect(text).toMatch(/Nothing is sent to any other service/);
    expect(text).toMatch(/not speech/);
    expect(`${provider(DEMO)?.label} ${text}`).not.toMatch(/azure/i);
  });

  it("the browser's own recognition is named as the browser, never Azure, and says Firefly never receives the audio", () => {
    const { label, text } = provider(BROWSER) ?? { label: '', text: '' };
    expect(label).toBe('Who handles your audio: Your browser');
    expect(text).toMatch(/Firefly never receives the audio/);
    expect(text).toMatch(/online service run by the browser's maker/);
    expect(`${label} ${text}`).not.toMatch(/azure/i);
    // The customer is spoken by the browser's own synthetic voice.
    expect(text).toMatch(/your browser's own synthetic voices/);
  });

  it('is more careful about a browser that is not Chrome or Edge', () => {
    const text = whoHearsYou({ ...BROWSER, chromium: false });
    expect(text).toMatch(/up to the browser/);
    expect(text).not.toMatch(/online service/);
  });

  it('no speech service: typed, and no audio recorded', () => {
    expect(provider(TYPED)?.label).toBe('Who handles your audio: No speech service');
    expect(provider(TYPED)?.text).toMatch(/no audio is recorded/);
    expect(whoSpeaksForTheCustomer(TYPED)).toMatch(/text only/);
  });

  it('never claims the audio goes somewhere it does not', () => {
    for (const context of [DEMO, BROWSER, TYPED]) {
      const all = privacyDetails(context)
        .map((detail) => `${detail.label} ${detail.text}`)
        .join(' ');
      expect(all, JSON.stringify(context)).not.toMatch(/azure/i);
    }
    // And it never promises more than the code does.
    for (const context of [AZURE, DEMO, BROWSER, TYPED]) {
      const all = privacyDetails(context)
        .map((detail) => detail.text)
        .join(' ');
      expect(all).not.toMatch(
        /encrypt|anonymi[sz]ed|never leaves|completely (private|safe)|guarantee/i,
      );
    }
  });
});
