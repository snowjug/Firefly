import { Icon } from '../../design/icons.tsx';
import { LandingSection } from './LandingSection.tsx';
import { STEPS } from './landing-copy.ts';

/** Three connected steps: a mark, a short name and a few words each. */
export function Steps() {
  return (
    <LandingSection id="steps" title="How it works">
      <ol className="lp-steps" role="list">
        {STEPS.map((step) => (
          <li key={step.title} className="lp-step">
            <span className="lp-step__icon" aria-hidden="true">
              <Icon name={step.icon} size={20} />
            </span>
            <div className="lp-step__body">
              <p className="lp-step__title">{step.title}</p>
              <p className="lp-step__text">{step.text}</p>
            </div>
          </li>
        ))}
      </ol>
    </LandingSection>
  );
}
