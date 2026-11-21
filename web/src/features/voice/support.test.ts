import { afterEach, describe, expect, it } from 'vitest';
import {
  browserFamily,
  chooseCapture,
  choosePlayback,
  detectFeatures,
  isChromiumBrowser,
  type VoiceFeatures,
} from './support.ts';
import { installFakes, type FakeEnv } from './testing/fakes.ts';

let env: FakeEnv | null = null;
afterEach(() => {
  env?.uninstall();
  env = null;
});

const features = (overrides: Partial<VoiceFeatures> = {}): VoiceFeatures => ({
  secureContext: true,
  microphone: true,
  audioContext: true,
  worklet: true,
  recognition: true,
  synthesis: true,
  audioElement: true,
  ...overrides,
});

describe('detectFeatures', () => {
  it('finds nothing in a bare browser, and never throws', () => {
    env = installFakes({ microphone: false, audioContext: false, audioElement: false });
    expect(detectFeatures()).toEqual({
      secureContext: true,
      microphone: false,
      audioContext: false,
      worklet: false,
      recognition: false,
      synthesis: false,
      audioElement: false,
    });
  });

  it('finds what the browser offers, at the moment it is asked', () => {
    env = installFakes({ recognition: true, synthesis: true });
    expect(detectFeatures()).toEqual(features());
    env.uninstall();
    env = installFakes({ audioContext: false });
    expect(detectFeatures().audioContext).toBe(false);
    expect(detectFeatures().worklet).toBe(false);
  });

  it('reports an insecure page', () => {
    env = installFakes({ secureContext: false });
    expect(detectFeatures().secureContext).toBe(false);
  });
});

describe('choosing who captures speech', () => {
  it("prefers the server's speech service when it can transcribe and the browser can record for it", () => {
    expect(chooseCapture({ transcribe: true }, features())).toBe('server-speech');
  });

  it("uses the browser's recognition when the server cannot transcribe, or the worklet is missing", () => {
    expect(chooseCapture({ transcribe: false }, features())).toBe('browser-recognition');
    expect(chooseCapture({ transcribe: true }, features({ worklet: false }))).toBe(
      'browser-recognition',
    );
    expect(chooseCapture({ transcribe: true }, features({ microphone: false }))).toBe(
      'browser-recognition',
    );
    expect(chooseCapture({ transcribe: true }, features({ audioContext: false }))).toBe(
      'browser-recognition',
    );
  });

  it('is typed only when neither can work, and always on an insecure page', () => {
    expect(chooseCapture({ transcribe: false }, features({ recognition: false }))).toBe('none');
    expect(
      chooseCapture({ transcribe: true }, features({ worklet: false, recognition: false })),
    ).toBe('none');
    expect(chooseCapture({ transcribe: true }, features({ secureContext: false }))).toBe('none');
  });
});

describe('choosing who speaks the customer', () => {
  it("prefers the server's speech service, then the browser's voices, then captions only", () => {
    expect(choosePlayback({ synthesize: true }, features())).toBe('server-speech');
    expect(choosePlayback({ synthesize: true }, features({ audioElement: false }))).toBe(
      'browser-synthesis',
    );
    expect(choosePlayback({ synthesize: false }, features())).toBe('browser-synthesis');
    expect(
      choosePlayback({ synthesize: false }, features({ synthesis: false, audioElement: false })),
    ).toBe('none');
  });
});

describe('browserFamily', () => {
  const agent = (text: string) => {
    env?.uninstall();
    env = installFakes({ userAgent: text });
    return browserFamily();
  };

  it('tells Edge from Chrome, Firefox and Safari', () => {
    expect(
      agent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0',
      ),
    ).toBe('edge');
    expect(
      agent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
      ),
    ).toBe('chrome');
    expect(agent('Mozilla/5.0 (Windows NT 10.0; rv:130.0) Gecko/20100101 Firefox/130.0')).toBe(
      'firefox',
    );
    expect(
      agent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
      ),
    ).toBe('safari');
    expect(agent('SomethingElse/1.0')).toBe('other');
    expect(isChromiumBrowser()).toBe(false);
  });

  it('counts Chrome and Edge as Chromium, where recognition is the vendor\u2019s online service', () => {
    agent('Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36');
    expect(isChromiumBrowser()).toBe(true);
  });
});
