import { useId } from 'react';
import type { CoachingReport, DiscoveryResult } from '#shared/domain/report.ts';
import { FACT_IMPORTANCE } from '#shared/domain/vocab.ts';
import { Disclosure, Section } from './bridge.tsx';
import { EvidenceQuote } from './EvidenceQuote.tsx';
import { DISCOVERY_STATUS, IMPORTANCE_LABEL, type DiscoveryStatus } from './labels.ts';

/**
 * A fact as a point: lit and amber when it was found, half lit when it was found in part, an empty
 * ring when it was missed. The shape and the word beside it say it; the colour only adds to them.
 */
export function DiscoveryMark({ status, size = 20 }: { status: DiscoveryStatus; size?: number }) {
  return (
    <svg
      className="rp-mark"
      data-status={status}
      viewBox="-10 -10 20 20"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
    >
      <circle className="rp-mark__halo" r="9" />
      <circle className="rp-mark__ring" r="5.2" />
      {status === 'discovered' ? <circle className="rp-mark__fill" r="5.2" /> : null}
      {status === 'partial' ? (
        <path className="rp-mark__fill" d="M0 -5.2a5.2 5.2 0 0 0 0 10.4Z" />
      ) : null}
    </svg>
  );
}

function Fact({
  fact,
  turnHref,
  sessionId,
}: {
  fact: DiscoveryResult;
  turnHref: (turn: number) => string;
  sessionId: string;
}) {
  const found = fact.status === 'discovered';
  const titleId = useId();
  return (
    <li>
      <article
        id={`fact-${fact.factId}`}
        className="rp-fact"
        data-status={fact.status}
        data-importance={fact.importance}
        aria-labelledby={titleId}
      >
        <span className="rp-fact__node">
          <DiscoveryMark status={fact.status} size={22} />
        </span>
        <header className="rp-fact__head">
          <p className="rp-fact__status">{DISCOVERY_STATUS[fact.status]}</p>
          <h3 id={titleId} className="rp-fact__title">
            {fact.label}
          </h3>
          <p className="rp-fact__importance">
            <span className="sr-only">Importance: </span>
            {IMPORTANCE_LABEL[fact.importance]}
          </p>
        </header>

        <div className="rp-fact__body">
          {fact.revealingQuestion ? (
            <EvidenceQuote
              quote={fact.revealingQuestion}
              turn={fact.revealedAtTurn}
              href={fact.revealedAtTurn !== null ? turnHref(fact.revealedAtTurn) : undefined}
              label="Your question"
              tone="positive"
              sessionId={sessionId}
            />
          ) : null}
          {!found ? (
            <div className="rp-better">
              <p className="type-label">A question worth asking</p>
              <p className="rp-better__text">{fact.betterQuestion}</p>
            </div>
          ) : null}
          <Disclosure summary="What the customer had held back" defaultOpen={!found}>
            <div className="rp-held">
              <EvidenceQuote
                quote={fact.whatWasHidden}
                label={found ? 'The customer said' : 'The customer would have said'}
              />
              <div className="rp-why">
                <p className="type-label">Why it mattered</p>
                <p>{fact.consequence}</p>
              </div>
            </div>
          </Disclosure>
        </div>
      </article>
    </li>
  );
}

/**
 * The hidden facts as a map: a line of points, one for each fact the customer held back, in the
 * order of how much it mattered. Each says in words whether the call found it, and what the
 * question worth asking would have been.
 */
export function DiscoverySection({
  discovery,
  eyebrow,
  turnHref,
  sessionId,
}: {
  discovery: CoachingReport['discovery'];
  eyebrow?: string;
  turnHref: (turn: number) => string;
  sessionId: string;
}) {
  const { found, partial, missed, total, results } = discovery;
  const ordered = [...results].sort(
    (a, b) => FACT_IMPORTANCE.indexOf(a.importance) - FACT_IMPORTANCE.indexOf(b.importance),
  );
  const headline =
    total === 0
      ? 'This scenario had no hidden facts to find.'
      : `Found ${found} of ${total} hidden ${total === 1 ? 'fact' : 'facts'}${
          partial > 0 ? `, and ${partial} partly` : ''
        }`;
  return (
    <Section id="discovery" eyebrow={eyebrow} title="Discovery">
      <p className="rp-lead">
        Customers rarely volunteer everything. These are the facts this customer held back, and
        whether your questions brought them out.
      </p>
      <div className="rp-disc">
        <p className="rp-disc__headline">{headline}</p>
        {total > 0 ? (
          <ul role="list" className="rp-disc__counts">
            <li>
              <DiscoveryMark status="discovered" size={18} /> {found} found
            </li>
            <li>
              <DiscoveryMark status="partial" size={18} /> {partial} partly found
            </li>
            <li>
              <DiscoveryMark status="missed" size={18} /> {missed} missed
            </li>
          </ul>
        ) : null}
      </div>
      {ordered.length > 0 ? (
        <ol role="list" className="rp-facts">
          {ordered.map((fact) => (
            <Fact key={fact.factId} fact={fact} turnHref={turnHref} sessionId={sessionId} />
          ))}
        </ol>
      ) : null}
    </Section>
  );
}
