import { describe, expect, it } from 'vitest';
import {
  defaultVoiceFor,
  isVoiceId,
  VOICE_CHOICES,
  VOICE_IDS,
  VOICE_PREVIEW_TEXT,
  voiceChoice,
} from './voices.ts';

describe('the four voice choices', () => {
  it('have stable ids and neutral labels, in order', () => {
    expect(VOICE_CHOICES.map((choice) => [choice.id, choice.label, choice.trait])).toEqual([
      ['voice-a', 'Voice A - Warm', 'Warm'],
      ['voice-b', 'Voice B - Direct', 'Direct'],
      ['voice-c', 'Voice C - Measured', 'Measured'],
      ['voice-d', 'Voice D - Concise', 'Concise'],
    ]);
    expect(VOICE_CHOICES.map((choice) => choice.id)).toEqual([...VOICE_IDS]);
    expect(voiceChoice('voice-c').label).toBe('Voice C - Measured');
  });

  it('are the only ids a request may name', () => {
    for (const id of VOICE_IDS) expect(isVoiceId(id)).toBe(true);
    for (const other of [
      'voice-e',
      'Voice-A',
      'voice-a ',
      '',
      'female',
      'male',
      undefined,
      null,
      1,
    ]) {
      expect(isVoiceId(other), String(other)).toBe(false);
    }
  });

  it('say one short, neutral sentence for "Test voice"', () => {
    expect(VOICE_PREVIEW_TEXT).toBe('Hello, this is a test of the voice you chose.');
  });
});

describe('defaultVoiceFor: the voice a scenario starts with', () => {
  it('depends on the scenario id alone, so the same scenario always starts with the same voice', () => {
    for (const id of ['teams-meeting-audio', 'licence-seat', 'a', '']) {
      const first = defaultVoiceFor(id);
      expect(isVoiceId(first)).toBe(true);
      for (let i = 0; i < 5; i++) expect(defaultVoiceFor(id)).toBe(first);
    }
    expect(defaultVoiceFor('  Teams-Meeting-Audio ')).toBe(defaultVoiceFor('teams-meeting-audio'));
  });

  it('does not change from one release to the next: these ids always start with these voices', () => {
    expect(
      [
        'locked-out',
        'licence-seat',
        'sharepoint-permissions',
        'exchange-mail-flow',
        'intune-enrol',
      ].map(defaultVoiceFor),
    ).toEqual(['voice-b', 'voice-b', 'voice-d', 'voice-a', 'voice-c']);
  });

  it('is spread over all four voices, none of them favoured', () => {
    const counts = new Map<string, number>();
    for (let i = 0; i < 400; i++) {
      const id = defaultVoiceFor(`scenario-${i}`);
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    expect([...counts.keys()].sort()).toEqual([...VOICE_IDS]);
    for (const count of counts.values()) {
      expect(count).toBeGreaterThan(60);
      expect(count).toBeLessThan(140);
    }
  });

  it('takes no gender, accent or age into account, because it is given nothing but an id', () => {
    expect(defaultVoiceFor.length).toBe(1);
  });
});
