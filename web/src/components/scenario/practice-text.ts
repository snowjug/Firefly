import type { ScenarioPractice } from '#shared/domain/recommend.ts';

/** What has happened with a scenario, in words (colour and shape are never the only signal). */
export function practiceText(practice: ScenarioPractice | undefined): string {
  if (!practice || practice.state === 'new') return 'Not tried yet';
  if (practice.state === 'in-progress') return 'Call in progress';
  const times =
    practice.completed === 1 ? 'Practised once' : `Practised ${practice.completed} times`;
  return practice.best === null ? times : `${times} \u00b7 best ${practice.best.toFixed(1)} of 5`;
}
