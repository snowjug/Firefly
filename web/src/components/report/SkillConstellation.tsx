import type { CSSProperties, MouseEvent } from 'react';
import type { DimensionResult } from '#shared/domain/report.ts';
import { DIMENSION_IDS, DIMENSIONS, type DimensionId } from '#shared/domain/vocab.ts';
import { scoreTone } from '../../lib/format.ts';
import { useReducedMotion } from '../../lib/theme.tsx';
import { starPath } from './marks.tsx';
import { SUFFICIENCY_BADGE } from './labels.ts';

// The six skills as a small constellation, in the order of a call: opening, discovery, empathy,
// clarity, ownership, closing. A star is lit by its score from 1 to 5 (the longer its arms and the
// brighter its light, the higher the score), and a skill that rests on thin evidence is drawn as an
// outline, never as a solid light it has not earned. The stars are the section's navigation and the
// list of the six scores at once: each is a link to that skill's details, named with the skill, its
// score in numbers and its label in words.

/** Where each star sits in the stage, as shares of its width and height, and where its words go. */
const SLOTS: Record<DimensionId, { x: number; y: number; side: 'above' | 'below' }> = {
  'opening-rapport': { x: 11, y: 62, side: 'below' },
  'scoping-discovery': { x: 28, y: 30, side: 'above' },
  'empathy-deescalation': { x: 45, y: 64, side: 'below' },
  clarity: { x: 62, y: 28, side: 'above' },
  'ownership-next-steps': { x: 78, y: 62, side: 'below' },
  closing: { x: 90, y: 30, side: 'above' },
};

const ordered = (dimensions: readonly DimensionResult[]) =>
  [...dimensions].sort((a, b) => DIMENSION_IDS.indexOf(a.id) - DIMENSION_IDS.indexOf(b.id));

/** The length of a star's arms for a score: 10 for a 1, 22 for a 5. */
export const armsFor = (score: number): number => 7 + Math.min(5, Math.max(1, score)) * 3;

/** Moves the reader to a skill's details and puts focus there, with a brief mark of where it landed. */
export function goToSkill(id: DimensionId, instant: boolean): boolean {
  const target = document.getElementById(`dim-${id}`);
  if (!target) return false;
  target.scrollIntoView?.({ behavior: instant ? 'auto' : 'smooth', block: 'start' });
  target.focus({ preventScroll: true });
  target.setAttribute('data-arrived', '');
  window.setTimeout(() => target.removeAttribute('data-arrived'), 1600);
  return true;
}

function Star({ score, solid }: { score: number; solid: boolean }) {
  const r = armsFor(score);
  return (
    <svg
      className="rp-const__star"
      viewBox="-26 -26 52 52"
      width="52"
      height="52"
      aria-hidden="true"
      focusable="false"
      data-solid={solid || undefined}
    >
      <path d={starPath(r)} />
      <circle r={solid ? 2.2 : 1.6} />
    </svg>
  );
}

export function SkillConstellation({ dimensions }: { dimensions: readonly DimensionResult[] }) {
  const reduced = useReducedMotion();
  const skills = ordered(dimensions);
  const go = (event: MouseEvent<HTMLAnchorElement>, id: DimensionId) => {
    if (goToSkill(id, reduced)) event.preventDefault();
  };
  const path = skills
    .map((skill) => SLOTS[skill.id])
    .map((slot) => `${slot.x},${slot.y}`)
    .join(' ');

  return (
    <nav className="rp-const" aria-label="The six skills">
      <div className="rp-const__stage">
        <svg
          className="rp-const__lines"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
          focusable="false"
        >
          <polyline points={path} />
        </svg>
        <ol role="list" className="rp-const__list">
          {skills.map((skill, index) => {
            const slot = SLOTS[skill.id];
            const badge = SUFFICIENCY_BADGE[skill.sufficiency];
            const name = DIMENSIONS[skill.id].label;
            return (
              <li
                key={skill.id}
                className="rp-const__item"
                data-side={slot.side}
                data-score={skill.score}
                data-tone={scoreTone(skill.score)}
                data-sufficiency={skill.sufficiency}
                style={{ '--x': `${slot.x}%`, '--y': `${slot.y}%` } as CSSProperties}
              >
                <a
                  href={`#dim-${skill.id}`}
                  className="rp-const__link"
                  onClick={(event) => go(event, skill.id)}
                >
                  <Star score={skill.score} solid={skill.sufficiency === 'sufficient'} />
                  <span className="rp-const__words">
                    <span className="rp-const__n" aria-hidden="true">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span className="rp-const__name">{name}</span>
                    <span className="rp-const__score tabular">
                      <span className="rp-const__num">{skill.score}</span>
                      <span> of 5</span>
                    </span>
                    <span className="rp-const__label">{skill.label}</span>
                    {badge ? <span className="rp-const__badge">{badge}</span> : null}
                  </span>
                </a>
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
}
