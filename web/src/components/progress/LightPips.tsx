import type { SkillLevel } from '../atlas/constellation-layout.ts';
import '../../styles/progress.css';

/**
 * Four small segments, filled up to the skill's light: the engraved way of saying "2 of 4". It is
 * decoration (`aria-hidden`); the words beside it always say the same thing, so nothing depends on
 * seeing which segments are filled.
 */
export function LightPips({ level }: { level: SkillLevel }) {
  return (
    <span className="pg-pips" data-level={level} aria-hidden="true">
      {[1, 2, 3, 4].map((step) => (
        <i key={step} className={step <= level ? 'is-on' : undefined} />
      ))}
    </span>
  );
}
