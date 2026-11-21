import { LinkButton } from '../../design/index.ts';
import { ProductPreview } from './ProductPreview.tsx';
import './hero.css';

/** The top of the landing page: what Firefly is, how to start, and one real moment from a call. */
export function Hero() {
  return (
    <div className="lp-hero">
      <div className="l-page lp-hero__inner">
        <div className="lp-hero__copy">
          <p className="t-label lp-hero__eyebrow">Customer call practice for support engineers</p>
          <h1 className="t-display">
            Practise the conversation before it becomes a real customer call.
          </h1>
          <p className="t-reading lp-hero__lead">
            Choose a realistic support scenario, speak with an AI customer and receive
            evidence-based coaching after the call.
          </p>
          <div className="lp-hero__actions">
            <LinkButton to="/scenarios" appearance="primary" size="large">
              Start a simulation
            </LinkButton>
            <LinkButton to="#how-it-works" appearance="outline" size="large">
              See how it works
            </LinkButton>
          </div>
          <p className="t-meta lp-hero__note">
            Every customer is fictional. Scores are for coaching practice, not{' '}
            <span className="u-nowrap">employee-performance</span> assessment.
          </p>
        </div>
        <ProductPreview />
      </div>
    </div>
  );
}
