import { DIFFICULTIES, type Difficulty } from '#shared/domain/vocab.ts';
import { DIFFICULTY_PROFILES } from '#shared/domain/state.ts';
import type { HintsPreference } from '../../lib/profile.ts';
import type { MotionPreference, ThemePreference } from '../../lib/theme.tsx';

// The choices on the settings page, in the words people see.

export const DIFFICULTY_OPTIONS: readonly { value: Difficulty; label: string }[] = DIFFICULTIES.map(
  (value) => ({ value, label: DIFFICULTY_PROFILES[value].label }),
);

export const HINT_OPTIONS: readonly { value: HintsPreference; label: string }[] = [
  { value: 'auto', label: 'Follow the difficulty (recommended)' },
  { value: 'on', label: 'Always show hints (Guided practice)' },
  { value: 'off', label: 'Never (Immersive)' },
];

export const THEME_OPTIONS: readonly { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

export const MOTION_OPTIONS: readonly { value: MotionPreference; label: string }[] = [
  { value: 'system', label: 'Follow my device' },
  { value: 'reduce', label: 'On' },
  { value: 'full', label: 'Off' },
];

export function themeStatus(theme: ThemePreference, resolved: 'light' | 'dark'): string {
  return theme === 'system'
    ? `Following your device: using the ${resolved} theme.`
    : `Using the ${resolved} theme.`;
}

export function motionStatus(motion: MotionPreference, reduced: boolean): string {
  if (motion === 'reduce') return 'Animation and transitions are reduced.';
  if (motion === 'full') {
    return 'Firefly uses its standard animation unless your device asks for less.';
  }
  return reduced
    ? 'Your device asks for reduced motion, so animation is reduced.'
    : 'Your device does not ask for reduced motion, so Firefly uses its standard animation.';
}

export const optionLabel = <T extends string>(
  options: readonly { value: T; label: string }[],
  value: T,
): string => options.find((option) => option.value === value)?.label ?? value;
