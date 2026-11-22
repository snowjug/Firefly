import { LinkButton } from '../../design/primitives/Button.tsx';
import { CallPreview } from './CallPreview.tsx';
import { FEATURED_ID, HERO, HERO_LEAD_KEEP } from './landing-copy.ts';
import './hero.css';

/** The supporting line, with one phrase kept whole so a line never ends on "evidence-". */
function Lead({ text, keep }: { text: string; keep: string }) {
  const at = text.indexOf(keep);
  if (at < 0) return text;
  return (
    <>
      {text.slice(0, at)}
      <span className="lp-hero__keep">{keep}</span>
      {text.slice(at + keep.length)}
    </>
  );
}

/**
 * The top of the page: a short promise, the way in, and a call that plays beside it. "Start call"
 * goes to the scenarios; "Explore scenarios" stays on the page and scrolls to the featured ones, so
 * the two are different things to do. The region is named by the title and described by the line.
 */
export function Hero() {
  return (
    <section className="lp-hero" aria-labelledby="lp-hero-title" aria-describedby="lp-hero-lead">
      <div className="l-page lp-hero__inner">
        <div className="lp-hero__copy">
          <h1 id="lp-hero-title" className="t-display lp-hero__title">
            {HERO.title}
          </h1>
          <p id="lp-hero-lead" className="t-lead lp-hero__lead">
            <Lead text={HERO.lead} keep={HERO_LEAD_KEEP} />
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
            <LinkButton
              to={{ pathname: '/', hash: `#${FEATURED_ID}` }}
              appearance="outline"
              size="large"
            >
              {HERO.secondary}
            </LinkButton>
          </div>
        </div>
        <CallPreview />
      </div>
    </section>
  );
}
