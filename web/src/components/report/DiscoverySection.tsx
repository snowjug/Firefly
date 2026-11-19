import type { CoachingReport, DiscoveryResult } from '#shared/domain/report.ts';
import { FACT_IMPORTANCE } from '#shared/domain/vocab.ts';
import { Disclosure } from './Disclosure.tsx';
import { EvidenceQuote } from './EvidenceQuote.tsx';
import { DISCOVERY_STATUS, IMPORTANCE_LABEL, type DiscoveryStatus } from './labels.ts';

const IMPORTANCE_TONE = {
  critical: 'chip-caution',
  important: 'chip-info',
  helpful: '',
} as const;

/** Shape plus text: a ticked circle, a half circle and an empty circle, never colour alone. */
function StatusGlyph({ status }: { status: DiscoveryStatus }) {
  return (
    <svg
      viewBox="0 0 20 20"
      width={18}
      height={18}
      aria-hidden="true"
      focusable="false"
      className="rp-glyph"
      data-status={status}
    >
      {status === 'discovered' ? (
        <>
          <circle cx="10" cy="10" r="9" className="rp-glyph-fill" />
          <path d="M5.8 10.4l2.9 2.9 5.6-6" className="rp-glyph-mark" />
        </>
      ) : status === 'partial' ? (
        <>
          <circle cx="10" cy="10" r="8.2" className="rp-glyph-ring" />
          <path d="M10 1.8a8.2 8.2 0 010 16.4z" className="rp-glyph-half" />
        </>
      ) : (
        <>
          <circle cx="10" cy="10" r="8.2" className="rp-glyph-ring" />
          <path d="M6.6 10h6.8" className="rp-glyph-dash" />
        </>
      )}
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
  const missed = fact.status === 'missed';
  const prominent = missed && fact.importance === 'critical';
  const showBetter = fact.status !== 'discovered';
  return (
    <article
      className="surface rp-fact"
      data-status={fact.status}
      data-importance={fact.importance}
      data-prominent={prominent ? 'true' : undefined}
    >
      <header className="rp-fact-head">
        <span className="rp-fact-status">
          <StatusGlyph status={fact.status} />
          {DISCOVERY_STATUS[fact.status]}
        </span>
        <h3 className="rp-fact-title">{fact.label}</h3>
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
        {showBetter ? (
          <div className="rp-better">
            <p className="t-label">A question worth asking</p>
            <p className="rp-better-text">{fact.betterQuestion}</p>
          </div>
        ) : null}
      </div>

      <Disclosure
        className="rp-fact-more"
        summary="What the customer had held back"
        defaultOpen={missed && fact.importance !== 'helpful'}
      >
        <EvidenceQuote quote={fact.whatWasHidden} label="The customer would have said" />
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
      <div className="rp-section-head">
        <h2 id="discovery-title" className="t-section">
          Discovery
        </h2>
        <p className="rp-lead">
          Customers rarely volunteer everything. These are the facts this customer held back, and
          whether your questions brought them out.
        </p>
      </div>

      <div className="surface rp-disc-summary">
        <p className="rp-disc-headline">{headline}</p>
        {total > 0 ? (
          <>
            <div className="rp-disc-bar" aria-hidden="true">
              {found > 0 ? <span data-status="discovered" style={{ flexGrow: found }} /> : null}
              {partial > 0 ? <span data-status="partial" style={{ flexGrow: partial }} /> : null}
              {missed > 0 ? <span data-status="missed" style={{ flexGrow: missed }} /> : null}
            </div>
            <ul role="list" className="rp-disc-counts">
              <li>
                <StatusGlyph status="discovered" /> {found} found
              </li>
              <li>
                <StatusGlyph status="partial" /> {partial} partly found
              </li>
              <li>
                <StatusGlyph status="missed" /> {missed} missed
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
