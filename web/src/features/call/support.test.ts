import { describe, expect, it } from 'vitest';
import type { VoiceFeatures } from '../voice/support.ts';
import { describeCallSupport, shortVoiceName, type SupportInput } from './support.ts';

const FEATURES: VoiceFeatures = {
  secureContext: true,
  microphone: true,
  audioContext: true,
  worklet: true,
  recognition: true,
  synthesis: true,
  audioElement: true,
};

const input = (over: Partial<SupportInput> = {}): SupportInput => ({
  speech: { label: 'Azure AI Speech', transcribe: true, synthesize: true },
  features: FEATURES,
  capture: 'server-speech',
  playback: 'server-speech',
  ...over,
});

describe('describeCallSupport', () => {
  it('names the speech service that will really process the speech, and nothing more', () => {
    expect(describeCallSupport(input())).toEqual({
      capture: 'server-speech',
      playback: 'server-speech',
      secureContext: true,
      reason: null,
      captureLabel: 'Azure AI Speech',
      playbackLabel: 'Azure AI Speech',
      speechDemo: false,
    });
    // A demonstration provider says so in its own label, and in `speechDemo`, so the screen can say
    // that it does not understand audio.
    const demo = describeCallSupport(
      input({
        speech: { label: 'Demo speech (scripted)', transcribe: true, synthesize: true, demo: true },
      }),
    );
    expect(demo.captureLabel).toBe('Demo speech (scripted)');
    expect(demo.speechDemo).toBe(true);
  });

  it('never calls browser speech a demonstration, even when the server provider is one', () => {
    const support = describeCallSupport(
      input({
        speech: {
          label: 'Demo speech (scripted)',
          transcribe: false,
          synthesize: false,
          demo: true,
        },
        capture: 'browser-recognition',
        playback: 'browser-synthesis',
      }),
    );
    expect(support.speechDemo).toBe(false);
  });

  it('says where the browser\u2019s own recognition runs: online in Chromium, on the device when it says so', () => {
    const browser = (over: Partial<SupportInput>) =>
      describeCallSupport(
        input({ capture: 'browser-recognition', playback: 'browser-synthesis', ...over }),
      );
    expect(browser({ chromium: true }).captureLabel).toBe('Browser speech recognition (online)');
    expect(browser({ recognitionMode: 'on-device' }).captureLabel).toBe(
      'Browser speech recognition (on this device)',
    );
    expect(browser({ recognitionMode: 'browser-service' }).captureLabel).toBe(
      'Browser speech recognition (online)',
    );
    expect(browser({}).captureLabel).toBe('Browser speech recognition');
  });

  it('says what a browser voice is, where it runs, and which one spoke, once one has', () => {
    const label = (voice: SupportInput['voice'], language: SupportInput['language'] = 'en-GB') =>
      describeCallSupport(input({ playback: 'browser-synthesis', language, voice })).playbackLabel;
    // Before a reply has been spoken nothing is known about the voice.
    expect(label(null)).toBe('Browser voice');
    expect(label(undefined)).toBe('Browser voice');
    expect(
      label({ name: 'Online Natural English (United Kingdom)', lang: 'en-GB', local: false }),
    ).toBe('Browser voice (online): Online Natural English (United Kingdom)');
    expect(label({ name: 'Samantha', lang: 'en-GB', local: null })).toBe('Browser voice: Samantha');
    // Android lists its languages with an underscore.
    expect(label({ name: 'English United Kingdom', lang: 'en_GB', local: true })).toBe(
      'Browser voice (on this device): English United Kingdom',
    );
  });

  it('says so when the browser has no voice for the language chosen and another one speaks', () => {
    const zira = {
      name: 'Microsoft Zira - English (United States)',
      lang: 'en-US',
      local: true,
    } as const;
    const label = (language: SupportInput['language']) =>
      describeCallSupport(input({ playback: 'browser-synthesis', language, voice: zira }))
        .playbackLabel;
    expect(label('en-GB')).toBe('Browser voice (on this device): Microsoft Zira, en-US');
    expect(label('en-US')).toBe('Browser voice (on this device): Microsoft Zira');
  });

  it('says the browser\u2019s own default voice spoke when no voice matched at all', () => {
    expect(
      describeCallSupport(
        input({
          playback: 'browser-synthesis',
          language: 'en-GB',
          voice: { name: null, lang: null, local: null },
        }),
      ).playbackLabel,
    ).toBe('Browser voice (default voice)');
  });

  it('keeps a voice name short, as the browser lists it with the language after a dash', () => {
    expect(shortVoiceName('Microsoft Zira - English (United States)')).toBe('Microsoft Zira');
    expect(shortVoiceName('Microsoft Sonia Online (Natural) - English (United Kingdom)')).toBe(
      'Microsoft Sonia Online (Natural)',
    );
    expect(shortVoiceName('Samantha')).toBe('Samantha');
  });

  it('gives one plain reason when a voice call is not possible, and says typing still works', () => {
    const none = (features: Partial<VoiceFeatures>, transcribe = true) =>
      describeCallSupport(
        input({
          capture: 'none',
          playback: 'none',
          features: { ...FEATURES, ...features },
          speech: { label: 'x', transcribe, synthesize: transcribe },
        }),
      );
    expect(none({ secureContext: false }).reason).toBe(
      'Spoken calls need a secure (https) connection. You can still type your replies.',
    );
    expect(none({ microphone: false, recognition: false }).reason).toMatch(
      /cannot use a microphone/,
    );
    expect(none({ worklet: false, recognition: false }).reason).toMatch(/Edge or Google Chrome/);
    expect(none({ recognition: false }, false).reason).toMatch(/no speech recognition/);
    for (const features of [{ secureContext: false }, { recognition: false }]) {
      const result = none(features, false);
      expect(result.captureLabel).toBe('Typed replies only');
      expect(result.playbackLabel).toBe('Captions only');
      expect(result.reason).toMatch(/type your replies/);
    }
  });

  it('is available, with captions only, when nothing can speak the replies', () => {
    const result = describeCallSupport(input({ playback: 'none' }));
    expect(result.reason).toBeNull();
    expect(result.playbackLabel).toBe('Captions only');
  });
});
