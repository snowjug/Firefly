import { StudioSection } from '../trainer/StudioFrame.tsx';

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
  return (
    <StudioSection title="Why calibrate" about="Two ways of scoring the same call, side by side.">
      <div className="cal-intro">
        <p className="cal-intro__lead">
          AI coaching scores are only useful if they roughly agree with an experienced mentor.
          Calibration puts the two side by side, using real stored reviews, so you can see where
          they differ and where the rubric needs another look.
        </p>
        <ol className="cal-steps">
          {STEPS.map((step, index) => (
            <li key={step.title} className="cal-step">
              <span className="cal-step__num" aria-hidden="true">
                {String(index + 1).padStart(2, '0')}
              </span>
              <p className="cal-step__title">{step.title}</p>
              <p className="cal-step__text">{step.text}</p>
            </li>
          ))}
        </ol>
        <p className="cal-note">
          <strong>Small samples are indicative only.</strong> A handful of reviews can show where to
          look, but not how reliable the scoring is. Calibration is not certification: the scores
          are practice feedback, and human mentors should review and calibrate them.
        </p>
      </div>
    </StudioSection>
  );
}
