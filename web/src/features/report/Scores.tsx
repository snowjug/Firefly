import { useState } from 'react';
import type { CoachingReport, DimensionResult } from '#shared/domain/report.ts';
import type { DimensionId } from '#shared/domain/vocab.ts';
import { Button, Disclosure, ScoreBar } from '../../design/index.ts';
import { SUFFICIENCY_SENTENCES, dimensionLabel, plainUnexpectedTurn, quoteCount } from './copy.ts';
import { EvidenceTag, Field, Quote, Section } from './parts.tsx';
import { usePrinting } from './print.tsx';
import { orderedDimensions } from './report-model.ts';
import './report.css';

function ScoreRow({
  dimension,
  open,
  onToggle,
}: {
  dimension: DimensionResult;
  open: boolean;
  onToggle: () => void;
}) {
  const name = dimensionLabel(dimension.id);
  const firm = dimension.sufficiency === 'sufficient';
  return (
    <li className="rp-row" data-rp-origin={name}>
      <Disclosure
        headingLevel={3}
        open={open}
        onOpenChange={onToggle}
        summary={
          <span className="rp-row__main">
            <span className="rp-row__name">{name}</span>{' '}
            <ScoreBar score={dimension.score} size="small" animate />
            {firm ? null : (
              <>
                {' '}
                <EvidenceTag value={dimension.sufficiency} />
              </>
            )}
          </span>
        }
        meta={
          <span className="rp-row__meta">
            <span className="rp-row__evidence">{quoteCount(dimension.evidence.length)}</span>{' '}
            <span className="rp-row__toggle">{open ? 'Hide details' : 'Expand details'}</span>
          </span>
        }
      >
        <div className="rp-row__body">
          <Field label="Why this score">
            <p className="t-reading">{plainUnexpectedTurn(dimension.rationale)}</p>
          </Field>
          <Field label="Evidence from your call">
            {dimension.evidence.length > 0 ? (
              <div className="rp-quotes">
                {dimension.evidence.map((e) => (
                  <Quote
                    key={`${e.turnIndex}-${e.quote}`}
                    quote={e.quote}
                    turnIndex={e.turnIndex}
                  />
                ))}
              </div>
            ) : (
              <p className="t-reading">No quotable moment stood out for this skill.</p>
            )}
          </Field>
          <Field label="To improve">
            <p className="t-reading">{plainUnexpectedTurn(dimension.guidance)}</p>
          </Field>
          <Field label="Evidence confidence">
            <p className="rp-row__confidence">
              <EvidenceTag value={dimension.sufficiency} />
              <span>{SUFFICIENCY_SENTENCES[dimension.sufficiency]}</span>
            </p>
          </Field>
        </div>
      </Disclosure>
    </li>
  );
}

/**
 * The six skills as compact rows: the score and its word, how many quotes back it and a button that
 * opens the reason, the quotes, what to improve and how firm the evidence is, in place.
 */
export function Scores({ report }: { report: CoachingReport }) {
  const rows = orderedDimensions(report);
  const printing = usePrinting();
  const [open, setOpen] = useState<ReadonlySet<DimensionId>>(new Set());
  const all = rows.length > 0 && rows.every((d) => open.has(d.id));
  const toggle = (id: DimensionId) =>
    setOpen((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  return (
    <Section
      id="scores"
      title="Scores"
      aside={
        <Button
          size="small"
          appearance="subtle"
          onClick={() => setOpen(all ? new Set() : new Set(rows.map((d) => d.id)))}
        >
          {all ? 'Collapse all' : 'Expand all'}
        </Button>
      }
    >
      <ul className="rp-rows" role="list">
        {rows.map((dimension) => (
          <ScoreRow
            key={dimension.id}
            dimension={dimension}
            open={printing || open.has(dimension.id)}
            onToggle={() => toggle(dimension.id)}
          />
        ))}
      </ul>
    </Section>
  );
}
