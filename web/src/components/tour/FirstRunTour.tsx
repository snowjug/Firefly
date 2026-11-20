import { useRef, useState } from 'react';
import { setTourState, useTourState } from '../../lib/tour.ts';
import { Dialog } from '../Dialog.tsx';
import { Icon } from '../Icon.tsx';
import { StepFeedback, StepHidden, StepPick, StepReaction, StepReady } from './tour-steps.tsx';
import '../../styles/tour.css';

const STEP_COUNT = 5;

const TITLES = [
  'Pick a practice call',
  'Some things stay hidden',
  'The customer reacts to you',
  'Feedback in your own words',
  'Ready when you are',
];

/** A hairline with a tick for each step, and the amber point on the one you are at. */
function Ticks({ step }: { step: number }) {
  return (
    <div
      className="tour-ticks"
      role="progressbar"
      aria-label="Tour progress"
      aria-valuemin={1}
      aria-valuemax={STEP_COUNT}
      aria-valuenow={step + 1}
      aria-valuetext={`Step ${step + 1} of ${STEP_COUNT}`}
    >
      {Array.from({ length: STEP_COUNT }, (_, index) => (
        <span
          key={index}
          className="tour-tick"
          data-state={index < step ? 'done' : index === step ? 'now' : 'next'}
        />
      ))}
    </div>
  );
}

/**
 * An optional, under-a-minute tour built from small working examples (fictional, clearly marked).
 * It never opens by itself on a page you did not choose, can be skipped at any step, and what you
 * chose is remembered on this device only.
 */
export function FirstRunTour({ open, onClose }: { open: boolean; onClose(): void }) {
  const state = useTourState();
  const [step, setStep] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);

  const finish = (outcome: 'done' | 'skipped') => {
    if (state === 'new' || outcome === 'done') setTourState(outcome);
    setStep(0);
    onClose();
  };

  const go = (next: number) => {
    setStep(next);
    requestAnimationFrame(() => heading.current?.focus());
  };

  return (
    <Dialog
      open={open}
      onClose={() => finish(step === STEP_COUNT - 1 ? 'done' : 'skipped')}
      eyebrow={`Step ${step + 1} of ${STEP_COUNT}`}
      title="A short tour of Firefly"
      description="Five small examples, under a minute. Skip any time."
    >
      <div className="tour">
        <Ticks step={step} />
        <h3 className="tour-title" tabIndex={-1} ref={heading}>
          {TITLES[step]}
        </h3>
        {step === 0 ? <StepPick /> : null}
        {step === 1 ? <StepHidden /> : null}
        {step === 2 ? <StepReaction /> : null}
        {step === 3 ? <StepFeedback /> : null}
        {step === 4 ? <StepReady onDone={() => finish('done')} /> : null}
        <div className="tour-foot">
          <button type="button" className="text-link" onClick={() => finish('skipped')}>
            Skip tour
          </button>
          <span className="tour-foot-nav">
            {step > 0 ? (
              <button
                type="button"
                className="action action--quiet action--compact"
                onClick={() => go(step - 1)}
              >
                Back
              </button>
            ) : null}
            {step < STEP_COUNT - 1 ? (
              <button
                type="button"
                className="action action--compact"
                data-autofocus
                onClick={() => go(step + 1)}
              >
                Next
                <Icon name="arrow-right" size={16} />
              </button>
            ) : (
              <button
                type="button"
                className="action action--quiet action--compact"
                onClick={() => finish('done')}
              >
                Done
              </button>
            )}
          </span>
        </div>
      </div>
    </Dialog>
  );
}
