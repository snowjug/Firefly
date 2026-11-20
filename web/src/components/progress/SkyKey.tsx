import { Disclosure } from '../frame/index.ts';
import { LIGHT_STEPS, STARS_PER_SKILL } from './progress-model.ts';
import '../../styles/progress.css';

type MarkKind = 'dormant' | 'lit' | 'recent' | 'rays';

/** A tiny drawing of the mark the item describes, in the sky's own drawing style. */
function KeyMark({ kind }: { kind: MarkKind }) {
  return (
    <svg className="pg-key__mark" viewBox="-12 -12 24 24" aria-hidden="true" focusable="false">
      {kind === 'dormant' ? <circle className="pg-star--dormant" r={3.2} /> : null}
      {kind === 'lit' ? (
        <>
          <circle className="pg-key__glow" r={9} />
          <circle className="pg-star__dot" r={3.4} />
        </>
      ) : null}
      {kind === 'recent' ? (
        <g className="pg-star--recent">
          <circle className="pg-key__glow pg-key__glow--warm" r={9} />
          <path className="pg-star__glint" d="M-8 0H8M0-8V8" />
          <circle className="pg-star__dot" r={3.4} />
        </g>
      ) : null}
      {kind === 'rays' ? (
        <g>
          <circle className="pg-halo" r={4.5} />
          <path className="pg-ray" d="M0-7.5V-11M0 7.5V11M-7.5 0H-11M7.5 0H11" />
          <path
            className="pg-ray pg-ray--diagonal"
            d="M5.3-5.3l2.4-2.4M5.3 5.3l2.4 2.4M-5.3-5.3l-2.4-2.4M-5.3 5.3l-2.4 2.4"
          />
        </g>
      ) : null}
    </svg>
  );
}

const lightSentence = LIGHT_STEPS.filter((step) => step.average !== null)
  .map(
    (step) =>
      `light ${step.light} asks for ${step.calls} calls averaging ${step.average?.toFixed(1)} or more`,
  )
  .join(', ');

const ITEMS: readonly { kind: MarkKind; name: string; text: string }[] = [
  { kind: 'dormant', name: 'Outline', text: 'no evidence yet, which is not a low score' },
  {
    kind: 'lit',
    name: 'Star',
    text: `one completed call scored on the skill, up to ${STARS_PER_SKILL}`,
  },
  { kind: 'recent', name: 'Amber', text: 'the star your latest call lit' },
  { kind: 'rays', name: 'Rays', text: 'the skill suggested for your next call' },
];

/**
 * How to read the sky: what an outline, a star, the amber star and the rays each mean, and, on
 * request, what it takes to burn at each light. Written out in full, so the sky never has a rule it
 * does not state.
 */
export function SkyKey() {
  return (
    <section className="pg-key" aria-labelledby="pg-key-title">
      <h3 id="pg-key-title" className="pg-key__title type-label">
        Key to the sky
      </h3>
      <ul className="pg-key__list">
        {ITEMS.map((item) => (
          <li key={item.kind} className="pg-key__item">
            <KeyMark kind={item.kind} />
            <span>
              <strong>{item.name}</strong>: {item.text}.
            </span>
          </li>
        ))}
      </ul>
      <Disclosure summary="How a cluster earns its light">
        <p className="pg-key__light">
          A cluster burns brighter, from light 1 to light 4, as its average score and the number of
          calls behind it rise: {lightSentence}. One excellent call is a good start, not mastery.
        </p>
      </Disclosure>
    </section>
  );
}
