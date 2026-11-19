import { useRef } from 'react';
import type { ImprovementItem, StrengthItem } from '#shared/domain/report.ts';
import { DIMENSIONS } from '#shared/domain/vocab.ts';
import { Icon } from '../Icon.tsx';
import { CopyButton } from './CopyButton.tsx';
import { EvidenceQuote } from './EvidenceQuote.tsx';
import { SectionHead } from './SectionHead.tsx';
import { NO_STRENGTH_NOTE } from './labels.ts';

function StrengthRow({
  item,
  turnHref,
}: {
  item: StrengthItem;
  turnHref: (turn: number) => string;
}) {
  return (
    <li className="rp-hl-item">
      <span className="rp-hl-icon" data-kind="good" aria-hidden="true">
        <Icon name="check-circle" size={22} />
      </span>
      <div className="rp-hl-body">
        <p className="rp-dim-tag">{DIMENSIONS[item.dimension].label}</p>
        <p className="rp-hl-title">{item.title}</p>
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
      </div>
    </li>
  );
}

function AreaRow({ item, index }: { item: ImprovementItem; index: number }) {
  return (
    <li className="rp-hl-item">
      <span className="rp-hl-icon" data-kind="improve" aria-hidden="true">
        <Icon name="alert" size={22} />
      </span>
      <div className="rp-hl-body">
        <p className="rp-dim-tag">{DIMENSIONS[item.dimension].label}</p>
        <p className="rp-hl-title">{item.title}</p>
        <a href={`#imp-${index}`} className="rp-hl-link">
          See a stronger way to say it <Icon name="arrow-right" size={14} />
        </a>
      </div>
    </li>
  );
}

/** The two quick lists beside each other: what helped and where to look first. */
export function HighlightsSection({
  strengths,
  improvements,
  turnHref,
}: {
  strengths: readonly StrengthItem[];
  improvements: readonly ImprovementItem[];
  turnHref: (turn: number) => string;
}) {
  return (
    <div className="rp-highlights">
      <section id="strengths" className="glass card rp-hl" aria-labelledby="strengths-title">
        <h2 id="strengths-title" className="t-section">
          What went well
        </h2>
        <p className="rp-lead t-small">Moments from your call that helped, in your own words.</p>
        {strengths.length > 0 ? (
          <ul role="list" className="rp-hl-list">
            {strengths.map((item, index) => (
              <StrengthRow
                key={`${item.dimension}-${item.turnIndex}-${index}`}
                item={item}
                turnHref={turnHref}
              />
            ))}
          </ul>
        ) : (
          <p className="rp-empty">{NO_STRENGTH_NOTE}</p>
        )}
      </section>

      <section id="areas" className="glass card rp-hl" aria-labelledby="areas-title">
        <h2 id="areas-title" className="t-section">
          Areas to improve
        </h2>
        <p className="rp-lead t-small">
          The clearest places to start next time. Each one has wording to try below.
        </p>
        {improvements.length > 0 ? (
          <ul role="list" className="rp-hl-list">
            {improvements.map((item, index) => (
              <AreaRow
                key={`${item.dimension}-${item.turnIndex ?? 'none'}-${index}`}
                item={item}
                index={index}
              />
            ))}
          </ul>
        ) : (
          <p className="rp-empty">Nothing stood out to work on in this call.</p>
        )}
      </section>
    </div>
  );
}

function ImprovementCard({
  item,
  index,
  turnHref,
}: {
  item: ImprovementItem;
  index: number;
  turnHref: (turn: number) => string;
}) {
  const phrasing = useRef<HTMLParagraphElement>(null);
  const happened = item.turnIndex !== null || Boolean(item.quote);
  const titleId = `imp-${index}-title`;
  return (
    <article id={`imp-${index}`} className="glass card rp-imp" aria-labelledby={titleId}>
      <header className="rp-imp-head">
        <span className="tone-icon" data-tone="blue" aria-hidden="true">
          <Icon name="target" size={20} />
        </span>
        <div>
          <p className="rp-dim-tag">{DIMENSIONS[item.dimension].label}</p>
          <h3 id={titleId} className="rp-moment-title">
            {item.title}
          </h3>
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

export function ImprovementsSection({
  improvements,
  turnHref,
}: {
  improvements: readonly ImprovementItem[];
  turnHref: (turn: number) => string;
}) {
  return (
    <section id="improvements" className="rp-section" aria-labelledby="improvements-title">
      <SectionHead id="improvements-title" title="Opportunities to improve">
        Where a different choice could have helped, with wording you can try next time.
      </SectionHead>
      {improvements.length > 0 ? (
        <ul role="list" className="rp-stack">
          {improvements.map((item, index) => (
            <li key={`${item.dimension}-${item.turnIndex ?? 'none'}-${index}`}>
              <ImprovementCard item={item} index={index} turnHref={turnHref} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="rp-empty">No clear opportunities stood out in this call.</p>
      )}
    </section>
  );
}
