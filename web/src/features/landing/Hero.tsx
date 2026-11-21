import { LinkButton } from '../../design/primitives/Button.tsx';
import { HERO } from './landing-copy.ts';
import { CallPreview } from './CallPreview.tsx';
import './hero.css';

/**
 * The top of the page: a short promise, the way in and a real moment from a call. The region is
 * named by the title and described by the supporting line.
 */
export function Hero() {
  return (
    <section className="lp-hero" aria-labelledby="lp-hero-title" aria-describedby="lp-hero-lead">
      <div className="l-page lp-hero__inner">
        <div className="lp-hero__copy">
          <h1 id="lp-hero-title" className="t-display">
            {HERO.title}
          </h1>
          <p id="lp-hero-lead" className="t-lead lp-hero__lead">
            {HERO.lead}
          </p>
          <div className="lp-hero__actions">
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
            <LinkButton to="/scenarios" appearance="outline" size="large">
              {HERO.secondary}
            </LinkButton>
          </div>
        </div>
        <CallPreview />
      </div>
    </section>
  );
}
