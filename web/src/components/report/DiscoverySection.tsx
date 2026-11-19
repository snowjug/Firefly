import type { CoachingReport, DiscoveryResult } from '#shared/domain/report.ts';
import { FACT_IMPORTANCE } from '#shared/domain/vocab.ts';
import { Icon } from '../Icon.tsx';
import { Disclosure } from './Disclosure.tsx';
import { EvidenceQuote } from './EvidenceQuote.tsx';
import { SectionHead } from './SectionHead.tsx';
import { DISCOVERY_STATUS, IMPORTANCE_LABEL, type DiscoveryStatus } from './labels.ts';

const IMPORTANCE_TONE = {
  critical: 'chip-caution',
  important: 'chip-info',
  helpful: '',
} as const;

/** A tick, a half circle or a cross: shape plus the words beside it, never colour alone. */
function StatusMark({ status }: { status: DiscoveryStatus }) {
  if (status === 'discovered') {
    return <Icon name="check-circle" size={20} className="rp-mark" data-status={status} />;
  }
  if (status === 'missed') {
    return <Icon name="x-circle" size={20} className="rp-mark" data-status={status} />;
  }
  return (
    <svg
      viewBox="0 0 20 20"
      width={20}
      height={20}
      aria-hidden="true"
      focusable="false"
      className="rp-mark"
      data-status={status}
    >
      <circle cx="10" cy="10" r="8.2" className="rp-glyph-ring" />
      <path d="M10 1.8a8.2 8.2 0 010 16.4z" className="rp-glyph-half" />
    </svg>
  );
}

function FactCard({
  fact,
  turnHref,
}: {
  fact: DiscoveryResult;
  turnHref: (turn: number) => string;
}) {
  const found = fact.status === 'discovered';
  const titleId = `fact-${fact.factId}-title`;
  return (
    <article
      id={`fact-${fact.factId}`}
      className="glass card rp-fact"
      data-status={fact.status}
      data-importance={fact.importance}
      aria-labelledby={titleId}
    >
      <header className="rp-fact-head">
        <span className="rp-fact-status">
          <StatusMark status={fact.status} />
          {DISCOVERY_STATUS[fact.status]}
        </span>
        <h3 id={titleId} className="rp-fact-title">
          {fact.label}
        </h3>
        <span className={`chip ${IMPORTANCE_TONE[fact.importance]}`.trim()}>
          <span className="sr-only">Importance: </span>
          {IMPORTANCE_LABEL[fact.importance]}
        </span>
      </header>

      <div className="rp-fact-body">
        {fact.revealingQuestion ? (
          <EvidenceQuote
            quote={fact.revealingQuestion}
            turn={fact.revealedAtTurn}
            href={fact.revealedAtTurn !== null ? turnHref(fact.revealedAtTurn) : undefined}
            label="Your question"
            tone="positive"
          />
        ) : null}
        {!found ? (
          <div className="rp-better">
            <p className="t-label">A question worth asking</p>
            <p className="rp-better-text">{fact.betterQuestion}</p>
          </div>
        ) : null}
      </div>

      <Disclosure
        className="rp-fact-more"
        summary="What the customer had held back"
        defaultOpen={!found}
      >
        <EvidenceQuote
          quote={fact.whatWasHidden}
          label={found ? 'The customer said' : 'The customer would have said'}
        />
        <div>
          <p className="t-label">Why it mattered</p>
          <p>{fact.consequence}</p>
        </div>
      </Disclosure>
    </article>
  );
}

export function DiscoverySection({
  discovery,
  turnHref,
}: {
  discovery: CoachingReport['discovery'];
  turnHref: (turn: number) => string;
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
    <section id="discovery" className="rp-section" aria-labelledby="discovery-title">
      <SectionHead id="discovery-title" title="Discovery">
        Customers rarely volunteer everything. These are the facts this customer held back, and
        whether your questions brought them out.
      </SectionHead>

      <div className="glass card rp-disc-summary">
        <p className="rp-disc-headline">{headline}</p>
        {total > 0 ? (
          <>
            <ol className="rp-disc-bar" aria-hidden="true">
              {ordered.map((fact) => (
                <li key={fact.factId} data-status={fact.status} />
              ))}
            </ol>
            <ul role="list" className="rp-disc-counts">
              <li>
                <StatusMark status="discovered" /> {found} found
              </li>
              <li>
                <StatusMark status="partial" /> {partial} partly found
              </li>
              <li>
                <StatusMark status="missed" /> {missed} missed
              </li>
            </ul>
          </>
        ) : null}
      </div>

      {ordered.length > 0 ? (
        <ul role="list" className="rp-stack">
          {ordered.map((fact) => (
            <li key={fact.factId}>
              <FactCard fact={fact} turnHref={turnHref} />
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
