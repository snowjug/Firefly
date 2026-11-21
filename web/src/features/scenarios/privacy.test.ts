// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { AppConfigDTO } from '#shared/domain/api.ts';
import { PRIVACY_DETAIL_IDS } from '../voice/privacy.ts';
import type { VoiceFeatures } from '../voice/support.ts';
import { MICROPHONE_NOTICE, PRIVACY_DETAILS_LABEL, privacyDetails } from './privacy.ts';
import { describeCustomer, describeSpeechSetup } from './speech-setup.ts';
import { AZURE_SPEECH, NO_SPEECH } from './testing/fixtures.ts';

const BROWSER: VoiceFeatures = {
  secureContext: true,
  microphone: true,
  audioContext: true,
  worklet: true,
  recognition: true,
  synthesis: true,
  audioElement: true,
};
const DEMO_MODEL: AppConfigDTO['provider'] = {
  kind: 'mock',
  label: 'Demo mode',
  demo: true,
  notice: null,
};

describe('what a trainee is told about their voice', () => {
  it('is one sentence before the first use, and the details sit behind a labelled control', () => {
    expect(MICROPHONE_NOTICE).toBe(
      'Firefly uses your microphone to transcribe this simulated call. Do not share real customer information.',
    );
    expect(PRIVACY_DETAILS_LABEL).toBe('How your voice is handled');
  });

  it('gives the voice feature\u2019s eight details in order, then who plays the customer', () => {
    const details = privacyDetails(
      describeSpeechSetup(AZURE_SPEECH, BROWSER),
      'azure-speech',
      DEMO_MODEL,
    );
    expect(details.map((detail) => detail.id)).toEqual([...PRIVACY_DETAIL_IDS, 'customer-model']);
    expect(details.at(-1)).toEqual({
      id: 'customer-model',
      label: 'Who plays the customer',
      text: describeCustomer(DEMO_MODEL),
    });
  });

  it('names the speech service when it handles the audio', () => {
    const details = privacyDetails(
      describeSpeechSetup(AZURE_SPEECH, BROWSER),
      'azure-speech',
      null,
    );
    const provider = details.find((detail) => detail.id === 'provider');
    expect(provider?.label).toBe('Who handles your audio: Azure AI Speech');
    expect(provider?.text).toContain('sent through this Firefly server to Azure AI Speech');
  });

  it('says Firefly never receives the audio when the browser listens, and names no service', () => {
    const details = privacyDetails(describeSpeechSetup(NO_SPEECH, BROWSER), 'none', null);
    expect(details.find((detail) => detail.id === 'provider')?.label).toBe(
      'Who handles your audio: Your browser',
    );
    expect(details.find((detail) => detail.id === 'raw-audio')?.text).toContain(
      'never receives or keeps your audio',
    );
  });

  it('describes a typed call while the speech settings are not known, with no line about the model', () => {
    const details = privacyDetails(null, null, null);
    expect(details.map((detail) => detail.id)).toEqual([...PRIVACY_DETAIL_IDS]);
    expect(details.find((detail) => detail.id === 'provider')?.label).toBe(
      'Who handles your audio: No speech service',
    );
  });
});
