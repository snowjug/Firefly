import { LinkButton } from '../../design/primitives/Button.tsx';
import { useReveal } from '../../design/interaction/use-reveal.ts';
import { FINAL_TITLE, HERO } from './landing-copy.ts';
import './landing.css';

/**
 * The last action on the page: the same way in as the first. It rises into place as it scrolls into
 * view; the button answers a pointer, a press and the keyboard as every main action does.
 */
export function FinalAction() {
  const [block, reveal] = useReveal<HTMLDivElement>();
  return (
    <section className="lp-section lp-section--final" aria-labelledby="lp-final-title">
      <div ref={block} {...reveal} className="l-page lp-final">
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
