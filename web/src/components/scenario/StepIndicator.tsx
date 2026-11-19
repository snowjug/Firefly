import { Link } from 'react-router';
import { SETUP_STEPS, STEP_COUNT } from './setup-model.ts';

interface StepIndicatorProps {
  current: number;
  hrefFor(step: number): string;
}

/** Where you are in the setup flow, with a link to every step. Names stay available to screen readers on narrow screens. */
export function StepIndicator({ current, hrefFor }: StepIndicatorProps) {
  const step = SETUP_STEPS[current - 1];
  return (
    <nav aria-label="Setup steps" className="stp-steps">
      <p className="stp-step-count">{`Step ${current} of ${STEP_COUNT}: ${step?.title ?? ''}`}</p>
      <ol role="list" className="stp-stepper">
        {SETUP_STEPS.map((item, index) => {
          const n = index + 1;
          const state = n < current ? 'done' : n === current ? 'current' : 'todo';
          return (
            <li key={item.id}>
              <Link
                to={hrefFor(n)}
                className="stp-stepper-link"
                data-state={state}
                aria-current={n === current ? 'step' : undefined}
              >
                <span className="stp-stepper-bar" aria-hidden="true" />
                <span className="stp-stepper-name">
                  <span className="sr-only">Step {n}: </span>
                  {item.name}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
