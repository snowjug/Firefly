import { useId } from 'react';
import { Icon } from '../Icon.tsx';

const STEPS = [
  {
    title: 'Pick a completed session',
    text: 'Choose a finished practice call. Every scenario is synthetic.',
  },
  {
    title: 'Score it as a mentor',
    text: 'Read the transcript and score the six skills. The AI\u2019s scores stay hidden until you save.',
  },
  {
    title: 'Compare',
    text: 'Firefly shows both sets of scores and the difference for each skill.',
  },
  {
    title: 'Repeat',
    text: 'Review calls from varied scenarios, ideally by more than one mentor. A few reviews say very little.',
  },
];

/** What calibration is, why it matters, and how a review works. */
export function CalibrationIntro() {
  const titleId = useId();
  return (
    <section className="glass card stack cal-intro" aria-labelledby={titleId}>
      <div className="stack" style={{ ['--stack-gap' as string]: 'var(--sp-2)' }}>
        <h2 id={titleId} className="t-section">
          Why calibrate
        </h2>
        <p className="t-muted cal-measure">
          AI coaching scores are only useful if they roughly agree with an experienced mentor.
          Calibration puts the two side by side, using real stored reviews, so you can see where
          they differ and where the rubric needs another look.
        </p>
      </div>
      <ol role="list" className="cal-steps">
        {STEPS.map((step, index) => (
          <li key={step.title} className="cal-step">
            <span className="cal-step-number" aria-hidden="true">
              {index + 1}
            </span>
            <p className="cal-step-title">{step.title}</p>
            <p className="t-small t-muted">{step.text}</p>
          </li>
        ))}
      </ol>
      <div className="callout callout-caution">
        <Icon name="info" size={18} />
        <p>
          <strong>Small samples are indicative only.</strong> A handful of reviews can show where to
          look, but not how reliable the scoring is.
        </p>
      </div>
    </section>
  );
}
