import { Icon } from '../../design/icons.tsx';
import { useReveal } from '../../design/interaction/use-reveal.ts';
import { TextLink } from '../../design/primitives/TextLink.tsx';
import { RESPONSIBLE_NOTE } from './landing-copy.ts';
import './landing.css';

/**
 * The responsible-use line: two short sentences and a way to the full page. The link says "Learn
 * more" and is named in full for assistive technology, whose name starts with the visible words.
 * It rises into place as it scrolls into view, like the other parts below the hero.
 */
export function ResponsibleNote() {
  const [block, reveal] = useReveal<HTMLDivElement>();
  return (
    <section className="lp-section lp-section--note" aria-label="Responsible use">
      <div ref={block} {...reveal} className="l-page lp-note">
        <Icon name="shield" size={20} className="lp-note__icon" />
        <p className="lp-note__text">{RESPONSIBLE_NOTE}</p>
        <TextLink
          to="/responsible-ai"
          className="lp-note__link"
          aria-label="Learn more about responsible AI"
        >
          Learn more
        </TextLink>
      </div>
    </section>
  );
}
