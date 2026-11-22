import type { CSSProperties } from 'react';
import { useMediaQuery } from '../../lib/hooks.ts';
import { useInViewOnce } from '../../design/interaction/use-in-view.ts';
import { LandingSection } from './LandingSection.tsx';
import { STEPS } from './landing-copy.ts';
import './steps.css';

// The steps light once their top is a little way up the window, so the beat is seen, not scrolled past.
const IN_VIEW = '0px 0px -15% 0px';

/**
 * Three connected steps: a number, a short name and a few words each, as a plain ordered list that is
 * always readable (the list already says "1 of 3"; the numbers are for the eye). As the list scrolls
 * into view (once) the numbers and the lines between them light in order, a short beat apart. Under
 * reduced motion all three are lit from the start.
 */
export function Steps() {
  const [list, seen] = useInViewOnce<HTMLOListElement>({ rootMargin: IN_VIEW });
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)');
  return (
    <LandingSection id="steps" title="How it works" quiet tight>
      <ol
        ref={list}
        className="lp-steps"
        role="list"
        data-active={seen || reduced ? '' : undefined}
      >
        {STEPS.map((step, index) => (
          <li key={step.title} className="lp-step" style={{ '--i': index } as CSSProperties}>
            <span className="lp-step__number" aria-hidden="true">
              {index + 1}
            </span>
            <div className="lp-step__body">
              <p className="lp-step__title">{step.title}</p>
              <p className="lp-step__text">{step.text}</p>
            </div>
            {index < STEPS.length - 1 ? (
              <span className="lp-step__link" aria-hidden="true" />
            ) : null}
          </li>
        ))}
      </ol>
    </LandingSection>
  );
}
