import { useState } from 'react';
import type { CoachingReport } from '#shared/domain/report.ts';
import {
  Badge,
  Disclosure,
  Icon,
  Tag,
  VisuallyHidden,
  type BadgeTone,
  type IconName,
} from '../../design/index.ts';
import { IMPORTANCE_WORDS, plainUnexpectedTurn } from './copy.ts';
import { useEvidence } from './evidence.tsx';
import { Field, InsufficientEvidence, Quote, Section, TurnQuote } from './parts.tsx';
import { usePrinting } from './print.tsx';
import {
  discoveryGroups,
  factView,
  suggestedQuestion,
  type DiscoveryGroup,
  type FactView,
} from './report-model.ts';
import './coaching.css';

const PARTLY: { tone: BadgeTone; icon: IconName } = { tone: 'info', icon: 'minus' };

/** A fact that was found: the fact, the question that found it and what the customer answered. */
function Found({ view }: { view: FactView }) {
  const { result, question, answer } = view;
  return (
    <>
      {question && result.revealedAtTurn !== null ? (
        <Field label="You asked">
          <Quote quote={question} turnIndex={result.revealedAtTurn} />
        </Field>
      ) : (
        <Field label="You asked">
          <InsufficientEvidence />
        </Field>
      )}
      {answer ? (
        <Field label="The customer answered">
          <TurnQuote turn={answer} />
        </Field>
      ) : null}
    </>
  );
}

/** A fact that was missed, or only partly found: why it mattered, a better question and what the customer would have said. */
function Missing({ view }: { view: FactView }) {
  const { result } = view;
  const [open, setOpen] = useState(false);
  const printing = usePrinting();
  const expanded = open || printing;
  return (
    <>
      <Field label="Why it mattered">
        <p className="t-reading">{plainUnexpectedTurn(result.consequence)}</p>
      </Field>
      <Field label="A better question">
        <p className="rp-suggestion t-reading">{result.betterQuestion}</p>
      </Field>
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
    </>
  );
}

function Fact({ view }: { view: FactView }) {
  const { result } = view;
  return (
    <li className="rp-fact" data-rp-origin={result.label}>
      <div className="rp-fact__head">
        <h4 className="rp-fact__title">{result.label}</h4>
        <div className="rp-fact__tags">
          <Tag size="small">{IMPORTANCE_WORDS[result.importance]}</Tag>
          {result.status === 'partial' ? (
            <Badge tone={PARTLY.tone} icon={PARTLY.icon} size="small">
              Partly found
            </Badge>
          ) : null}
        </div>
      </div>
      {result.status !== 'missed' ? <Found view={view} /> : null}
      {result.status !== 'discovered' ? <Missing view={view} /> : null}
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
        {group.results.map((result) => (
          <Fact key={result.factId} view={factView(result, turns)} />
        ))}
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
 * The facts this customer held back, found and missed. A found fact shows the question that found
 * it and the customer's answer, both from the transcript. A missed one says why it mattered and
 * offers a better question; what the customer would have said is behind an expand, inline. Nothing
 * here leaves the page or shows anything the scenario keeps private before the call has ended.
 */
export function DiscoveryReview({ report }: { report: CoachingReport }) {
  const { discovery } = report;
  const groups = discoveryGroups(discovery);
  const question = suggestedQuestion(discovery);
  const found = groups.filter((g) => g.status !== 'missed');
  const missed = groups.filter((g) => g.status === 'missed');
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
          <div className="rp-discovery__columns">
            <div className="rp-discovery__column">
              {found.map((group) => (
                <FactGroup key={group.status} group={group} />
              ))}
            </div>
            <div className="rp-discovery__column">
              {missed.map((group) => (
                <FactGroup key={group.status} group={group} />
              ))}
            </div>
          </div>
          {question ? (
            <div className="rp-suggest">
              <p className="rp-suggest__label">
                <Icon name="lightbulb" size={18} />
                <span>Suggested question</span>
              </p>
              <p className="rp-suggest__text">{`\u201c${question.betterQuestion}\u201d`}</p>
              <p className="rp-suggest__why">To find out: {question.label}</p>
            </div>
          ) : null}
        </>
      )}
    </Section>
  );
}
