import { LinkButton } from '../../design/primitives/Button.tsx';
import { FINAL_TITLE, HERO } from './landing-copy.ts';
import './landing.css';

/** The last action on the page: the same way in as the first. */
export function FinalAction() {
  return (
    <section className="lp-section lp-section--final" aria-labelledby="lp-final-title">
      <div className="l-page lp-final">
        <h2 id="lp-final-title" className="lp-title lp-title--large">
          {FINAL_TITLE}
        </h2>
        <LinkButton
          to="/scenarios"
          appearance="primary"
          size="large"
          icon="arrow-right"
          iconPosition="end"
          nudge
        >
          {HERO.primary}
        </LinkButton>
      </div>
    </section>
  );
}
