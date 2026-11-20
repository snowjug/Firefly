import { useId, type ReactNode } from 'react';
import { useMediaQuery } from '../../lib/hooks.ts';
import { SignalGlyph } from '../signal/SignalGlyph.tsx';
import type { GlyphTraits } from '../signal/types.ts';
import '../../styles/dashboard.css';

/**
 * The size the hero's instrument is drawn at, and what it shrinks to where there is no room. Its
 * lines are a pixel wide at the size they are drawn for, so the wide one is drawn small and shown
 * larger (see `.home-hero__figure`): the same engraving, with a line as heavy as the serif's.
 */
const HERO_SIZE = { wide: 190, narrow: 104 } as const;

/**
 * The hero of the home page: one thing to do next. A mono kicker, the title in large serif, who is
 * calling, a line of public settings, the reason in words and the one action, with the mission's
 * instrument beside it (above the words on a narrow screen it sits next to the kicker). The
 * instrument is decorative here: every fact it draws is written out in the words next to it. The
 * only motion is the glint's slow breath, and only for a recommended mission.
 */
export function Hero({
  kind,
  kicker,
  title,
  persona,
  facts,
  why,
  actions,
  glyph,
}: {
  kind: 'next' | 'open';
  kicker: ReactNode;
  title: string;
  persona?: ReactNode;
  facts?: readonly string[];
  why?: { label: string; text: ReactNode };
  actions: ReactNode;
  glyph: GlyphTraits;
}) {
  const titleId = useId();
  const wide = useMediaQuery('(min-width: 46rem)');
  return (
    <section className="home-hero" data-kind={kind} aria-labelledby={titleId}>
      <p className="home-hero__kicker">{kicker}</p>
      <h2 id={titleId} className="home-hero__title">
        {title}
      </h2>
      {persona ? <p className="home-hero__persona">{persona}</p> : null}
      {facts && facts.length > 0 ? (
        <p className="home-hero__facts type-label">{facts.join(' \u00b7 ')}</p>
      ) : null}
      {why ? (
        <div className="home-hero__why">
          <p className="home-hero__why-label type-label">{why.label}</p>
          <p className="home-hero__reason">{why.text}</p>
        </div>
      ) : null}
      <div className="home-hero__actions action-row">{actions}</div>
      <div className="home-hero__figure" aria-hidden="true">
        <SignalGlyph traits={glyph} size={wide ? HERO_SIZE.wide : HERO_SIZE.narrow} />
      </div>
    </section>
  );
}
