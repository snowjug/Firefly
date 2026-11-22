import { useId, useState } from 'react';
import type { CoachingReport } from '#shared/domain/report.ts';
import type { DimensionId } from '#shared/domain/vocab.ts';
import { Button, Icon, ScoreBar, useAnnouncer, useInViewOnce } from '../../design/index.ts';
import {
  SUFFICIENCY_SENTENCES,
  clampWords,
  dimensionLabel,
  plainUnexpectedTurn,
  quoteCount,
} from './copy.ts';
import { prefersReducedMotion } from './dom.ts';
import { useEvidence } from './evidence.tsx';
import { EvidenceTag, Field, InsufficientEvidence, Quote, Section } from './parts.tsx';
import { usePrinting } from './print.tsx';
import { ROW_REASON_WORDS, skillRows, type SkillRow } from './report-model.ts';
import './scores.css';

function Row({
  row,
  open,
  revealed,
  onToggle,
}: {
  row: SkillRow;
  open: boolean;
  revealed: boolean;
  onToggle: () => void;
}) {
  const { dimension, quotes } = row;
  const name = dimensionLabel(dimension.id);
  const panel = `${useId()}-panel`;
  const firm = dimension.sufficiency === 'sufficient';
  const reason = plainUnexpectedTurn(dimension.rationale);
  // The row has the reason's first words; the details have all of it only when there is more to say.
  const longer = clampWords(reason, ROW_REASON_WORDS).clamped;
  const toggle = open ? 'Hide details' : 'Expand details';
  return (
    <li className="rp-skill" data-rp-origin={name} data-open={open ? '' : undefined}>
      <div className="rp-skill__line">
        <h3 className="rp-skill__name">{name}</h3>
        <div className="rp-skill__score">
          <ScoreBar score={dimension.score} size="small" animate={revealed} />
          {firm ? null : <EvidenceTag value={dimension.sufficiency} />}
        </div>
        <p className="rp-skill__count">{quoteCount(quotes.length)}</p>
        <p className="rp-skill__why">{row.preview}</p>
        <button
          type="button"
          className="rp-skill__toggle"
          aria-expanded={open}
          aria-controls={panel}
          aria-label={`${name} ${dimension.score} of 5 ${dimension.label} ${quoteCount(quotes.length)} ${toggle}`}
          onClick={onToggle}
        >
          <span>{toggle}</span>
          <Icon name="chevron-down" size={16} className="rp-skill__chevron" />
        </button>
      </div>
      <div id={panel} className="rp-skill__panel" hidden={!open}>
        <div className="rp-skill__body">
          {longer ? (
            <Field label="Why this score">
              <p className="t-reading">{reason}</p>
            </Field>
          ) : null}
          <Field label="Evidence from your call">
            {quotes.length > 0 ? (
              <div className="rp-quotes">
                {quotes.map((e) => (
                  <Quote
                    key={`${e.turnIndex}-${e.quote}`}
                    quote={e.quote}
                    turnIndex={e.turnIndex}
                  />
                ))}
              </div>
            ) : (
              <InsufficientEvidence note="No moment in the call backs this score." />
            )}
          </Field>
          <Field label="To improve">
            <p className="t-reading">{plainUnexpectedTurn(dimension.guidance)}</p>
          </Field>
          <Field label="Evidence confidence">
            <p className="rp-skill__confidence">
              <EvidenceTag value={dimension.sufficiency} />
              <span>{SUFFICIENCY_SENTENCES[dimension.sufficiency]}</span>
            </p>
          </Field>
        </div>
      </div>
    </li>
  );
}

/**
 * The six skills as a matrix of rows, not six cards: each row has the skill, its score as five
 * segments with the number and the word, how many quotes back it, the reason in a line and a button
 * that opens the quotes, what to improve and how firm the evidence is, in place. The rows come in
 * one after another the first time the section scrolls into view; with reduced motion they are
 * simply there.
 */
export function Scores({ report }: { report: CoachingReport }) {
  const { turns } = useEvidence();
  const rows = skillRows(report, turns);
  const printing = usePrinting();
  const announce = useAnnouncer();
  const [open, setOpen] = useState<ReadonlySet<DimensionId>>(new Set());
  const [ref, seen] = useInViewOnce<HTMLDivElement>();
  const revealed = seen || prefersReducedMotion();
  const all = rows.length > 0 && rows.every((r) => open.has(r.dimension.id));
  const toggle = (id: DimensionId) =>
    setOpen((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  const everyone = (on: boolean) => {
    setOpen(on ? new Set(rows.map((r) => r.dimension.id)) : new Set());
    announce(on ? 'All six skills opened.' : 'All six skills closed.');
  };
  return (
    <Section
      id="scores"
      title="Scores"
      lead="Six skills, each scored 1 to 5 from what was said in the call."
      aside={
        <Button size="small" appearance="subtle" onClick={() => everyone(!all)}>
          {all ? 'Collapse all' : 'Expand all'}
        </Button>
      }
    >
      <div className="rp-skills" ref={ref} data-revealed={revealed ? '' : undefined}>
        <p className="rp-skills__head" aria-hidden="true">
          <span>Skill</span>
          <span>Score</span>
          <span>Evidence</span>
          <span>Details</span>
        </p>
        <ul className="rp-skills__list" role="list">
          {rows.map((row) => (
            <Row
              key={row.dimension.id}
              row={row}
              open={printing || open.has(row.dimension.id)}
              revealed={revealed}
              onToggle={() => toggle(row.dimension.id)}
            />
          ))}
        </ul>
      </div>
    </Section>
  );
}
