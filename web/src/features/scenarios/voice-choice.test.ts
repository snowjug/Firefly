// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { VOICE_CHOICES, defaultVoiceFor as sharedDefaultVoiceFor } from '#shared/domain/voices.ts';
import {
  AZURE_SHARED_SPEECH,
  AZURE_SPEECH,
  NO_SPEECH,
  OLD_SERVER_SPEECH,
  publicScenarios,
} from './testing/fixtures.ts';
import {
  VOICE_IDS,
  defaultVoiceFor,
  isVoiceId,
  offeredVoice,
  sharedVoiceNote,
  speechLanguage,
  voiceChoices,
  voiceLabel,
} from './voice-choice.ts';

describe('the voices on offer', () => {
  it('are the four neutral choices of the shared contract when the browser\u2019s own voices speak', () => {
    const offered = voiceChoices(NO_SPEECH, 'browser-synthesis');
    expect(offered.map((voice) => [voice.id, voice.label])).toEqual(
      VOICE_CHOICES.map((voice) => [voice.id, voice.label]),
    );
    expect(offered.map((voice) => voice.label)).toEqual([
      'Voice A - Warm',
      'Voice B - Direct',
      'Voice C - Measured',
      'Voice D - Concise',
    ]);
    expect(offered.map((voice) => `${voice.label} ${voice.description}`).join(' ')).not.toMatch(
      /\b(male|female|man|woman|girl|boy|lady|accent|young|old)\b/i,
    );
  });

  it('are the ones the speech service lists when it speaks', () => {
    const voices = (AZURE_SPEECH.voices ?? []).slice(0, 2);
    expect(voiceChoices({ voices }, 'server-speech').map((voice) => voice.id)).toEqual([
      'voice-a',
      'voice-b',
    ]);
    expect(voiceChoices(AZURE_SPEECH, 'server-speech')).toHaveLength(4);
  });

  it('are none where the server speaks but lists no voices: it cannot honour a choice', () => {
    expect(voiceChoices(OLD_SERVER_SPEECH, 'server-speech')).toEqual([]);
    expect(voiceChoices({ voices: [] }, 'server-speech')).toEqual([]);
  });

  it('are none where nothing can speak the customer', () => {
    expect(voiceChoices(AZURE_SPEECH, 'none')).toEqual([]);
    expect(voiceChoices(null, 'none')).toEqual([]);
  });

  it('are the four while the setup is not known yet, so the control does not appear and then change', () => {
    expect(voiceChoices(null, null)).toHaveLength(4);
  });

  it('leave out any voice the contract does not know', () => {
    const [first] = AZURE_SPEECH.voices ?? [];
    expect(
      voiceChoices(
        { voices: first ? [{ ...first, id: 'voice-z' as never }] : [] },
        'server-speech',
      ),
    ).toEqual([]);
  });

  it('keep the label the contract gives each id', () => {
    expect(voiceLabel('voice-c')).toBe('Voice C - Measured');
  });
});

describe('which voice is used', () => {
  const offered = voiceChoices(AZURE_SPEECH, 'server-speech');

  it('is the one wanted when it is on offer, else the first on offer, else none', () => {
    expect(offeredVoice(offered, 'voice-c')).toBe('voice-c');
    expect(offeredVoice(offered.slice(0, 2), 'voice-d')).toBe('voice-a');
    expect(offeredVoice([], 'voice-a')).toBeUndefined();
  });

  it('is recognised by id, and nothing else is', () => {
    for (const id of VOICE_IDS) expect(isVoiceId(id)).toBe(true);
    for (const bad of ['voice-e', 'Voice A', '', null, undefined]) {
      expect(isVoiceId(bad)).toBe(false);
    }
  });

  it('starts from the scenario\u2019s id by the rule the server uses, spread across the four', () => {
    expect(defaultVoiceFor).toBe(sharedDefaultVoiceFor);
    const chosen = publicScenarios().map((scenario) => defaultVoiceFor(scenario.id));
    expect(chosen.every(isVoiceId)).toBe(true);
    expect(new Set(chosen).size).toBeGreaterThanOrEqual(3);
  });
});

describe('what is said about the voices', () => {
  it('says nothing when every choice has a voice of its own in the language', () => {
    expect(sharedVoiceNote(AZURE_SPEECH.voices, 'en-GB')).toBeNull();
  });

  it('says some share one synthetic voice and differ only in pace when the service has fewer voices', () => {
    expect(sharedVoiceNote(AZURE_SHARED_SPEECH.voices, 'en-GB')).toBe(
      'Some of these voices share one synthetic voice and differ only in pace.',
    );
  });

  it('is about the language the call will use, and nothing when no voices are listed', () => {
    const [first] = AZURE_SPEECH.voices ?? [];
    const sharedInIrish = first
      ? [
          {
            languages: { ...first.languages, 'en-IE': { voice: 'shared' as const, styles: false } },
          },
        ]
      : [];
    expect(sharedVoiceNote(sharedInIrish, 'en-IE')).not.toBeNull();
    expect(sharedVoiceNote(sharedInIrish, 'en-GB')).toBeNull();
    expect(sharedVoiceNote(undefined, 'en-GB')).toBeNull();
  });
});

describe('the language of a call', () => {
  it('is the first of the browser\u2019s languages that speech offers, whatever the case', () => {
    expect(speechLanguage(['fr-FR', 'en-us', 'en-GB'])).toBe('en-US');
  });

  it('is British English when the browser offers none that speech does', () => {
    expect(speechLanguage(['de', 'fr'])).toBe('en-GB');
    expect(speechLanguage([])).toBe('en-GB');
  });
});
