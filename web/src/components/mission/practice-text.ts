import type { ScenarioPractice } from '#shared/domain/recommend.ts';

/** What has happened with a mission, in words (colour and shape are never the only signal). */
export function practiceText(practice: ScenarioPractice | undefined): string {
  if (!practice || practice.state === 'new') return 'Not attempted';
  if (practice.state === 'in-progress') return 'In progress';
  const times = practice.completed > 1 ? `Practised ${practice.completed} times` : 'Practised';
  return practice.best === null ? times : `${times}, best ${practice.best.toFixed(1)}`;
}

/** The same, short enough for a label under a mission on the map. */
export function practiceBrief(practice: ScenarioPractice | undefined): string {
  if (!practice || practice.state === 'new') return 'Not attempted';
  return practice.state === 'in-progress' ? 'In progress' : 'Practised';
}
