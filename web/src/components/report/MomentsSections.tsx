import { useRef } from 'react';
import type { ImprovementItem, StrengthItem } from '#shared/domain/report.ts';
import { DIMENSIONS } from '#shared/domain/vocab.ts';
import { Icon } from '../Icon.tsx';
import { CopyButton } from './CopyButton.tsx';
import { EvidenceQuote } from './EvidenceQuote.tsx';

function StrengthCard({
  item,
  turnHref,
}: {
  item: StrengthItem;
  turnHref: (turn: number) => string;
}) {
  return (
    <article className="surface rp-moment rp-strength">
      <header className="rp-moment-head">
        <span className="rp-tone-icon rp-tone-positive" aria-hidden="true">
          <Icon name="check" size={18} />
        </span>
        <div>
          <p className="rp-dim-tag">{DIMENSIONS[item.dimension].label}</p>
          <h3 className="rp-moment-title">{item.title}</h3>
        </div>
      </header>
      <EvidenceQuote
        quote={item.quote}
        turn={item.turnIndex}
        href={turnHref(item.turnIndex)}
        label="You said"
        tone="positive"
      />
      <div className="rp-why">
        <p className="t-label">Why it helped</p>
        <p>{item.whyItHelped}</p>
      </div>
    </article>
  );
}

function ImprovementCard({
  item,
  turnHref,
}: {
  item: ImprovementItem;
  turnHref: (turn: number) => string;
}) {
  const phrasing = useRef<HTMLParagraphElement>(null);
  const happened = item.turnIndex !== null || Boolean(item.quote);
  return (
    <article className="surface rp-moment rp-improve">
      <header className="rp-moment-head">
        <span className="rp-tone-icon rp-tone-info" aria-hidden="true">
          <Icon name="target" size={18} />
        </span>
        <div>
          <p className="rp-dim-tag">{DIMENSIONS[item.dimension].label}</p>
          <h3 className="rp-moment-title">{item.title}</h3>
        </div>
      </header>
      <div className="rp-improve-grid">
        <div className="rp-improve-was">
          {happened ? (
            <EvidenceQuote
              quote={item.quote}
              turn={item.turnIndex}
              href={item.turnIndex !== null ? turnHref(item.turnIndex) : undefined}
              label="What you said"
            />
          ) : (
            <p className="rp-did-not-happen">
              <Icon name="info" size={18} />
              <span>This didn&rsquo;t come up in the call.</span>
            </p>
          )}
          <div>
            <p className="t-label">Why it matters</p>
            <p>{item.risk}</p>
          </div>
        </div>
        <div className="rp-improve-better">
          <div className="rp-phrasing">
            <p className="t-label rp-phrasing-label">A stronger way to say it</p>
            <p ref={phrasing} className="rp-phrasing-text">
              {item.betterPhrasing}
            </p>
            <CopyButton text={item.betterPhrasing} targetRef={phrasing} />
          </div>
          <div>
            <p className="t-label">Why it works</p>
            <p>{item.whyItWorks}</p>
          </div>
        </div>
      </div>
    </article>
  );
}

export function StrengthsSection({
  strengths,
  turnHref,
}: {
  strengths: readonly StrengthItem[];
  turnHref: (turn: number) => string;
}) {
  return (
    <section id="strengths" className="rp-section" aria-labelledby="strengths-title">
      <div className="rp-section-head">
        <h2 id="strengths-title" className="t-section">
          What went well
        </h2>
        <p className="rp-lead">Moments from your call that helped, in your own words.</p>
      </div>
      {strengths.length > 0 ? (
        <ul role="list" className="rp-stack">
          {strengths.map((item, index) => (
            <li key={`${item.dimension}-${item.turnIndex}-${index}`}>
              <StrengthCard item={item} turnHref={turnHref} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="rp-empty">
          No clear strength stood out in this call. The opportunities below are the best place to
          start.
        </p>
      )}
    </section>
  );
}

export function ImprovementsSection({
  improvements,
  turnHref,
}: {
  improvements: readonly ImprovementItem[];
  turnHref: (turn: number) => string;
}) {
  return (
    <section id="improvements" className="rp-section" aria-labelledby="improvements-title">
      <div className="rp-section-head">
        <h2 id="improvements-title" className="t-section">
          Opportunities to improve
        </h2>
        <p className="rp-lead">
          Where a different choice could have helped, with wording you can try next time.
        </p>
      </div>
      {improvements.length > 0 ? (
        <ul role="list" className="rp-stack">
          {improvements.map((item, index) => (
            <li key={`${item.dimension}-${item.turnIndex ?? 'none'}-${index}`}>
              <ImprovementCard item={item} turnHref={turnHref} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="rp-empty">No clear opportunities stood out in this call.</p>
      )}
    </section>
  );
}
