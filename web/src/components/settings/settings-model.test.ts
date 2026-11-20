import { describe, expect, it } from 'vitest';
import {
  DIFFICULTY_CHOICES,
  HINT_CHOICES,
  choiceLabel,
  motionChoices,
  pick,
  themeChoices,
} from './settings-model.ts';

describe('settings choices', () => {
  it('offers the three difficulties by name, each with a sentence that says nothing about what is hidden', () => {
    expect(DIFFICULTY_CHOICES.map((choice) => [choice.value, choice.label])).toEqual([
      ['starter', 'Starter'],
      ['standard', 'Standard'],
      ['challenge', 'Challenge'],
    ]);
    for (const choice of DIFFICULTY_CHOICES) {
      expect(choice.hint).toMatch(/\.$/);
      expect(choice.hint).not.toMatch(/hidden|fact/i);
    }
  });

  it('offers hints as follow, always or never, and says which is recommended', () => {
    expect(HINT_CHOICES.map((choice) => choice.value)).toEqual(['auto', 'on', 'off']);
    expect(HINT_CHOICES.filter((choice) => /Recommended/.test(choice.hint ?? ''))).toHaveLength(1);
    expect(HINT_CHOICES[0]?.hint).toMatch(/^Recommended\./);
  });

  it('says what following the device means, for the theme that applies and for motion', () => {
    expect(themeChoices('dark')[0]?.hint).toBe('Following your device: using the dark theme.');
    expect(themeChoices('light')[0]?.hint).toBe('Following your device: using the light theme.');
    expect(motionChoices(true)[0]?.hint).toMatch(/asks for reduced motion/);
    expect(motionChoices(false)[0]?.hint).toMatch(/does not ask for reduced motion/);
    // The other two do not depend on the device.
    expect(motionChoices(true).slice(1)).toEqual(motionChoices(false).slice(1));
  });

  it('keeps the words the page has always used for motion: follow, on and off', () => {
    expect(motionChoices(false).map((choice) => [choice.value, choice.label])).toEqual([
      ['system', 'Follow my device'],
      ['reduce', 'On'],
      ['full', 'Off'],
    ]);
  });

  it('finds a label, and accepts only a value that is one of the choices', () => {
    expect(choiceLabel(DIFFICULTY_CHOICES, 'challenge')).toBe('Challenge');
    expect(choiceLabel(DIFFICULTY_CHOICES, 'nonsense')).toBe('nonsense');
    expect(pick(DIFFICULTY_CHOICES, 'standard')).toBe('standard');
    expect(pick(DIFFICULTY_CHOICES, 'impossible')).toBeNull();
    expect(pick(HINT_CHOICES, '')).toBeNull();
  });
});
