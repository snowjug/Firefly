import { useId, useRef } from 'react';
import type { ImprovementItem, StrengthItem } from '#shared/domain/report.ts';
import { DIMENSIONS } from '#shared/domain/vocab.ts';
import { Icon } from '../Icon.tsx';
import { Section } from './bridge.tsx';
import { CopyButton } from './CopyButton.tsx';
import { EvidenceQuote } from './EvidenceQuote.tsx';
import { NO_STRENGTH_NOTE } from './labels.ts';
import { WordingDiff } from './WordingDiff.tsx';

interface Links {
  turnHref: (turn: number) => string;
  sessionId: string;
}

function Strength({ item, turnHref, sessionId }: { item: StrengthItem } & Links) {
  const titleId = useId();
  return (
    <li>
      <article className="rp-moment" data-kind="good" aria-labelledby={titleId}>
        <header className="rp-moment__side">
          <p className="rp-moment__skill type-label">{DIMENSIONS[item.dimension].label}</p>
          <h3 id={titleId} className="rp-moment__title">
            {item.title}
          </h3>
        </header>
        <div className="rp-moment__body">
          <EvidenceQuote
            quote={item.quote}
            turn={item.turnIndex}
            href={turnHref(item.turnIndex)}
            label="You said"
            tone="positive"
            sessionId={sessionId}
          />
          <div className="rp-why">
            <p className="type-label">Why it helped</p>
            <p>{item.whyItHelped}</p>
          </div>
        </div>
      </article>
    </li>
  );
}

/** What went well: the moments of the call that helped, in the learner's own words. */
export function StrengthsSection({
  strengths,
  eyebrow,
  ...links
}: { strengths: readonly StrengthItem[]; eyebrow?: string } & Links) {
  return (
    <Section id="strengths" eyebrow={eyebrow} title="What went well">
      <p className="rp-lead">Moments from your call that helped, in your own words.</p>
      {strengths.length > 0 ? (
        <ol role="list" className="rp-moments">
          {strengths.map((item, index) => (
            <Strength key={`${item.dimension}-${item.turnIndex}-${index}`} item={item} {...links} />
          ))}
        </ol>
      ) : (
        <p className="rp-empty">{NO_STRENGTH_NOTE}</p>
      )}
    </Section>
  );
}

function Opportunity({
  item,
  index,
  turnHref,
  sessionId,
}: { item: ImprovementItem; index: number } & Links) {
  const phrasing = useRef<HTMLParagraphElement>(null);
  const titleId = `imp-${index}-title`;
  const happened = item.turnIndex !== null || Boolean(item.quote);
  return (
    <li>
      <article
        id={`imp-${index}`}
        className="rp-moment"
        data-kind="improve"
        aria-labelledby={titleId}
      >
        <header className="rp-moment__side">
          <p className="rp-moment__skill type-label">{DIMENSIONS[item.dimension].label}</p>
          <h3 id={titleId} className="rp-moment__title">
            {item.title}
          </h3>
        </header>
        <div className="rp-moment__body">
          {happened ? (
            <EvidenceQuote
              quote={item.quote}
              turn={item.turnIndex}
              href={item.turnIndex !== null ? turnHref(item.turnIndex) : undefined}
              label="What you said"
              sessionId={sessionId}
            />
          ) : (
            <p className="rp-did-not-happen">
              <Icon name="info" size={16} />
              <span>This didn&rsquo;t come up in the call.</span>
            </p>
          )}
          <div className="rp-why">
            <p className="type-label">Why it matters</p>
            <p>{item.risk}</p>
          </div>
          <div className="rp-phrasing">
            <p className="type-label">A stronger way to say it</p>
            <WordingDiff before={item.quote} after={item.betterPhrasing} textRef={phrasing} />
            <CopyButton text={item.betterPhrasing} targetRef={phrasing} />
          </div>
          <div className="rp-why">
            <p className="type-label">Why it works</p>
            <p>{item.whyItWorks}</p>
          </div>
        </div>
      </article>
    </li>
  );
}

/** Where a different choice could have helped, with wording to try and what it keeps of the call. */
export function ImprovementsSection({
  improvements,
  eyebrow,
  ...links
}: { improvements: readonly ImprovementItem[]; eyebrow?: string } & Links) {
  return (
    <Section id="improvements" eyebrow={eyebrow} title="Opportunities to improve">
      <p className="rp-lead">
        Where a different choice could have helped, with wording you can try next time.
      </p>
      {improvements.length > 0 ? (
        <ol role="list" className="rp-moments">
          {improvements.map((item, index) => (
            <Opportunity
              key={`${item.dimension}-${item.turnIndex ?? 'none'}-${index}`}
              item={item}
              index={index}
              {...links}
            />
          ))}
        </ol>
      ) : (
        <p className="rp-empty">No clear opportunities stood out in this call.</p>
      )}
    </Section>
  );
}
