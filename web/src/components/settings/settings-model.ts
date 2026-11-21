import { DIFFICULTY_PROFILES } from '#shared/domain/state.ts';
import { DIFFICULTIES, type Difficulty } from '#shared/domain/vocab.ts';
import type { HintsPreference } from '../../lib/profile.ts';
import type { MotionPreference, ThemePreference } from '../../lib/theme.tsx';
import { OPTION_EXPLANATIONS } from '../atlas/core-params.ts';
import type { ChoiceOption } from '../frame/ChoiceRow.tsx';

// The choices on the settings page, in the words people see. Each has a sentence that is read with
// it while it is chosen, so the page says what a choice means without a second click.

export const DIFFICULTY_CHOICES: readonly (ChoiceOption & { value: Difficulty })[] =
  DIFFICULTIES.map((value) => ({
    value,
    label: DIFFICULTY_PROFILES[value].label,
    hint: OPTION_EXPLANATIONS.difficulty[value],
  }));

export const HINT_CHOICES: readonly (ChoiceOption & { value: HintsPreference })[] = [
  {
    value: 'auto',
    label: 'Follow the difficulty',
    hint: 'Recommended. Each call starts guided or immersive as its difficulty suggests.',
  },
  {
    value: 'on',
    label: 'Always',
    hint: 'Calls start guided: light cues about the customer, and a hint when you ask for one.',
  },
  {
    value: 'off',
    label: 'Never',
    hint: 'Calls start immersive: no cues, because a real call gives none.',
  },
];

export function themeChoices(
  resolved: 'light' | 'dark',
): readonly (ChoiceOption & { value: ThemePreference })[] {
  return [
    {
      value: 'system',
      label: 'System',
      hint: `Following your device: using the ${resolved} theme.`,
    },
    { value: 'light', label: 'Light', hint: 'Using the light theme.' },
    { value: 'dark', label: 'Dark', hint: 'Using the dark theme.' },
  ];
}

export function motionChoices(
  deviceReduces: boolean,
): readonly (ChoiceOption & { value: MotionPreference })[] {
  return [
    {
      value: 'system',
      label: 'Follow my device',
      hint: deviceReduces
        ? 'Your device asks for reduced motion, so animation is reduced.'
        : 'Your device does not ask for reduced motion, so Firefly uses its standard animation.',
    },
    { value: 'reduce', label: 'On', hint: 'Animation and transitions are reduced.' },
    {
      value: 'full',
      label: 'Off',
      hint: 'Firefly uses its standard animation unless your device asks for less.',
    },
  ];
}

/** The label of the choice with this value, or the value itself when there is none. */
export function choiceLabel(choices: readonly ChoiceOption[], value: string): string {
  return choices.find((choice) => choice.value === value)?.label ?? value;
}

/** The value of the choice a radio reported, if it is one of `choices` (never anything else). */
export function pick<T extends string>(
  choices: readonly (ChoiceOption & { value: T })[],
  value: string,
): T | null {
  return choices.find((choice) => choice.value === value)?.value ?? null;
}
