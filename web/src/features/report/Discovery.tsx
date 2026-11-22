import { useState } from 'react';
import type { CoachingReport } from '#shared/domain/report.ts';
import type { FactImportance } from '#shared/domain/vocab.ts';
import { Badge, Disclosure, Icon, Tag, VisuallyHidden, cx } from '../../design/index.ts';
import { IMPORTANCE_WORDS, plainUnexpectedTurn } from './copy.ts';
import { useEvidence } from './evidence.tsx';
import { Field, InsufficientEvidence, Quote, Section, TurnQuote } from './parts.tsx';
import { usePrinting } from './print.tsx';
import {
  discoveryGroups,
  factView,
  whyFound,
  type DiscoveryGroup,
  type FactView,
} from './report-model.ts';
import './coaching.css';

/** How much a fact mattered, in a shape each: Critical is the strongest, Helpful the quietest. */
function Importance({ value }: { value: FactImportance }) {
  if (value === 'critical') {
    return (
      <Badge tone="warning" icon="flag" size="small">
        {IMPORTANCE_WORDS.critical}
      </Badge>
    );
  }
  if (value === 'important') {
    return (
      <Badge tone="info" appearance="outline" icon={null} size="small">
        {IMPORTANCE_WORDS.important}
      </Badge>
    );
  }
  return <Tag size="small">{IMPORTANCE_WORDS.helpful}</Tag>;
}

/** The one question worth asking for a fact that was not found in full, set apart as a callout. */
function Ask({ question }: { question: string }) {
  return (
    <div className="rp-ask">
      <p className="rp-ask__label">
        <Icon name="lightbulb" size={16} />
        <span>A question worth asking</span>
      </p>
      <p className="rp-ask__text t-reading">{`\u201c${question}\u201d`}</p>
    </div>
  );
}

/** What the customer was holding back, behind a toggle of its own. */
function Hidden({ view }: { view: FactView }) {
  const { result } = view;
  const [open, setOpen] = useState(false);
  const printing = usePrinting();
  const expanded = open || printing;
  return (
    <Disclosure
      appearance="inline"
      className="rp-fact__toggle"
      open={expanded}
      onOpenChange={() => setOpen(!open)}
      summary={
        <>
          {expanded
            ? 'Hide what the customer would have said'
            : 'Show what the customer would have said'}{' '}
          <VisuallyHidden>for {result.label}</VisuallyHidden>
        </>
      }
    >
      <p className="rp-fact__hidden t-reading">{plainUnexpectedTurn(result.whatWasHidden)}</p>
    </Disclosure>
  );
}

/** A fact that was missed: why it mattered, the question worth asking and what the customer would have said. */
function MissedFact({ view }: { view: FactView }) {
  const { result } = view;
  return (
    <li className="rp-fact rp-fact--missed" data-rp-origin={result.label}>
      <div className="rp-fact__head">
        <h4 className="rp-fact__title">{result.label}</h4>
        <Importance value={result.importance} />
      </div>
      <div className="rp-fact__body">
        <Field label="Why it mattered">
          <p className="t-reading">{plainUnexpectedTurn(result.consequence)}</p>
        </Field>
        <Ask question={result.betterQuestion} />
        <Hidden view={view} />
      </div>
    </li>
  );
}

/**
 * A fact that was found, or found in part: one line (the fact, how much it mattered, the turn) that
 * opens in place to the question that found it, what the customer answered and why it mattered. A
 * fact found only in part goes on to the question worth asking and what was still held back. On
 * paper every row is open.
 */
function FoundFact({ view }: { view: FactView }) {
  const { result, question, answer } = view;
  const [open, setOpen] = useState(false);
  const printing = usePrinting();
  const partly = result.status === 'partial';
  return (
    <li className="rp-fact" data-rp-origin={result.label}>
      <Disclosure
        appearance="row"
        headingLevel={4}
        open={open || printing}
        onOpenChange={() => setOpen(!open)}
        summary={
          <span className="rp-fact__line">
            <span className="rp-fact__title">{result.label}</span>
            <Importance value={result.importance} />
            {partly ? (
              <Badge tone="info" icon="minus" size="small">
                Partly found
              </Badge>
            ) : null}
          </span>
        }
        meta={result.revealedAtTurn !== null ? `Turn ${result.revealedAtTurn}` : undefined}
      >
        <div className="rp-fact__body">
          <Field label="You asked">
            {question && result.revealedAtTurn !== null ? (
              <Quote quote={question} turnIndex={result.revealedAtTurn} />
            ) : (
              <InsufficientEvidence />
            )}
          </Field>
          {answer ? (
            <Field label="The customer answered">
              <TurnQuote turn={answer} />
            </Field>
          ) : null}
          <Field label="Why it mattered">
            <p className="t-reading">{plainUnexpectedTurn(whyFound(result))}</p>
          </Field>
          {partly ? (
            <>
              <Ask question={result.betterQuestion} />
              <Hidden view={view} />
            </>
          ) : null}
        </div>
      </Disclosure>
    </li>
  );
}

function FactGroup({ group }: { group: DiscoveryGroup }) {
  const { turns } = useEvidence();
  return (
    <div className="rp-group">
      <h3 className="rp-subtitle">
        {group.title} ({group.results.length})
      </h3>
      <ul className="rp-facts-list" role="list">
        {group.results.map((result) => {
          const view = factView(result, turns);
          return result.status === 'missed' ? (
            <MissedFact key={result.factId} view={view} />
          ) : (
            <FoundFact key={result.factId} view={view} />
          );
        })}
      </ul>
    </div>
  );
}

/** How many of the hidden facts were found, as segments with the count beside them in words. */
function Ratio({ discovery }: { discovery: CoachingReport['discovery'] }) {
  const order = (['discovered', 'partial', 'missed'] as const).flatMap((status) =>
    discovery.results.filter((r) => r.status === status).map((r) => ({ id: r.factId, status })),
  );
  return (
    <span className="rp-ratio" aria-hidden="true">
      {order.map(({ id, status }) => (
        <span className={`rp-ratio__seg rp-ratio__seg--${status}`} key={id} />
      ))}
    </span>
  );
}

/**
 * The facts this customer held back, found and missed. A found fact is one line that opens to the
 * question that found it and the customer's answer, both from the transcript. A missed one says why
 * it mattered and offers a question worth asking; what the customer would have said is behind an
 * expand, inline. The found and the missed sit side by side when there is room and both exist; when
 * one of them is empty the other has the whole width. Nothing here leaves the page or shows
 * anything the scenario keeps private before the call has ended.
 */
export function DiscoveryReview({ report }: { report: CoachingReport }) {
  const { discovery } = report;
  const groups = discoveryGroups(discovery);
  const found = groups.filter((g) => g.status !== 'missed');
  const missed = groups.filter((g) => g.status === 'missed');
  const columns = [found, missed].filter((column) => column.length > 0);
  return (
    <Section id="discovery" title="Discovery review">
      {discovery.total === 0 ? (
        <p className="rp-empty">This scenario had no hidden facts to find.</p>
      ) : (
        <>
          <p className="rp-discovery__total">
            <span className="rp-discovery__number">{discovery.found}</span> of {discovery.total}{' '}
            hidden facts found
            <Ratio discovery={discovery} />
            <span className="rp-discovery__split">
              {discovery.found} found, {discovery.partial} partly found, {discovery.missed} missed
            </span>
          </p>
          <div
            className={cx(
              'rp-discovery__columns',
              columns.length > 1 && 'rp-discovery__columns--two',
            )}
          >
            {columns.map((column) => (
              <div className="rp-discovery__column" key={column[0]?.status}>
                {column.map((group) => (
                  <FactGroup key={group.status} group={group} />
                ))}
              </div>
            ))}
          </div>
        </>
      )}
    </Section>
  );
}
