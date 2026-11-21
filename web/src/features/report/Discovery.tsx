import { useState } from 'react';
import type { CoachingReport, DiscoveryResult } from '#shared/domain/report.ts';
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
import { TurnLink } from './evidence.tsx';
import { Field, Quote, Section } from './parts.tsx';
import { usePrinting } from './print.tsx';
import { discoveryGroups, suggestedQuestion, type DiscoveryGroup } from './report-model.ts';
import './report.css';

const STATUS: Record<DiscoveryResult['status'], { tone: BadgeTone; icon: IconName; word: string }> =
  {
    discovered: { tone: 'success', icon: 'check-circle', word: 'Found' },
    partial: { tone: 'info', icon: 'minus', word: 'Partly found' },
    missed: { tone: 'warning', icon: 'flag', word: 'Missed' },
  };

function Fact({ result }: { result: DiscoveryResult }) {
  const [open, setOpen] = useState(false);
  const printing = usePrinting();
  const expanded = open || printing;
  const found = result.status !== 'missed';
  const status = STATUS[result.status];
  return (
    <li className="rp-fact" data-rp-origin={result.label}>
      <div className="rp-fact__head">
        <h4 className="rp-fact__title">{result.label}</h4>
        <div className="rp-fact__tags">
          <Tag size="small">{IMPORTANCE_WORDS[result.importance]}</Tag>
          {result.status === 'partial' ? (
            <Badge tone={status.tone} icon={status.icon} size="small">
              {status.word}
            </Badge>
          ) : null}
        </div>
      </div>
      {found && result.revealedAtTurn !== null ? (
        <p className="rp-fact__turn">
          <span>You asked</span>
          <TurnLink turnIndex={result.revealedAtTurn} />
        </p>
      ) : null}
      <Disclosure
        appearance="inline"
        className="rp-fact__toggle"
        open={expanded}
        onOpenChange={() => setOpen(!open)}
        summary={
          <>
            {expanded ? 'Hide details' : 'Show details'}{' '}
            <VisuallyHidden>for {result.label}</VisuallyHidden>
          </>
        }
      >
        <div className="rp-fact__body">
          {found && result.revealingQuestion && result.revealedAtTurn !== null ? (
            <Field label="Your question">
              <Quote quote={result.revealingQuestion} turnIndex={result.revealedAtTurn} />
            </Field>
          ) : null}
          {found ? (
            <Field label="What the customer held back">
              <p className="t-reading">{plainUnexpectedTurn(result.whatWasHidden)}</p>
            </Field>
          ) : null}
          {result.status !== 'discovered' ? (
            <>
              <Field label="A question worth asking">
                <p className="rp-suggestion t-reading">{result.betterQuestion}</p>
              </Field>
              <Field label="Why it mattered">
                <p className="t-reading">{plainUnexpectedTurn(result.consequence)}</p>
              </Field>
            </>
          ) : null}
        </div>
      </Disclosure>
    </li>
  );
}

function FactGroup({ group }: { group: DiscoveryGroup }) {
  return (
    <div className="rp-group">
      <h3 className="rp-subtitle">
        {group.title} ({group.results.length})
      </h3>
      <ul className="rp-facts-list" role="list">
        {group.results.map((result) => (
          <Fact key={result.factId} result={result} />
        ))}
      </ul>
    </div>
  );
}

/**
 * The facts this customer held back, split into those found and those not, with the one question
 * most worth taking into the next call. Everything about a fact is a click away; what is shown first
 * is its name, how much it mattered and where you asked.
 */
export function DiscoveryReview({ report }: { report: CoachingReport }) {
  const { discovery } = report;
  const groups = discoveryGroups(discovery);
  const question = suggestedQuestion(discovery);
  const found = groups.filter((g) => g.status === 'discovered');
  const rest = groups.filter((g) => g.status !== 'discovered');
  return (
    <Section id="discovery" title="Discovery">
      {discovery.total === 0 ? (
        <p className="rp-empty">This scenario had no hidden facts to find.</p>
      ) : (
        <>
          <p className="rp-discovery__total">
            <span className="rp-discovery__number">{discovery.found}</span> of {discovery.total}{' '}
            hidden facts found
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
              {rest.map((group) => (
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
