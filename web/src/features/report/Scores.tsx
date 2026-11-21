import { useState } from 'react';
import type { CoachingReport, DimensionResult } from '#shared/domain/report.ts';
import { CARE_LABELS, DIMENSIONS, SCORE_DESCRIPTIONS } from '#shared/domain/vocab.ts';
import { Icon, ScoreBar, Tag, VisuallyHidden, cx, type IconName } from '../../design/index.ts';
import { useMediaQuery } from '../../lib/hooks.ts';
import {
  SUFFICIENCY_SENTENCES,
  SUFFICIENCY_WORDS,
  dimensionLabel,
  plainUnexpectedTurn,
} from './copy.ts';
import { SectionLink } from './evidence.tsx';
import { Field, Quote, Section } from './parts.tsx';
import { usePrinting } from './print.tsx';
import { lowestSkill, orderedDimensions } from './report-model.ts';

const LEVEL: Record<DimensionResult['sufficiency'], { icon: IconName; tone: string }> = {
  sufficient: { icon: 'check-circle', tone: 'ok' },
  limited: { icon: 'warning', tone: 'limited' },
  insufficient: { icon: 'info', tone: 'none' },
};

/** How firm a score is, as an icon and words: quiet when it is fine, plainer when it is not. */
function EvidenceLevel({ value }: { value: DimensionResult['sufficiency'] }) {
  const { icon, tone } = LEVEL[value];
  return (
    <span className={cx('rp-level', `rp-level--${tone}`)}>
      <Icon name={icon} size={16} className="rp-level__icon" />
      <span>{SUFFICIENCY_WORDS[value]}</span>
    </span>
  );
}

/** The six skills in one table: a number, a word, how firm it is and a link to the detail. */
export function ScoreSummary({ report }: { report: CoachingReport }) {
  const rows = orderedDimensions(report);
  return (
    <Section
      id="scores"
      title="Scores"
      lead="Each skill is scored from 1 to 5 against the practice rubric, using quotes from your own call. The evidence behind each score is in Skill details."
    >
      <table className="rp-scores">
        <caption className="rp-scores__caption">
          Six coaching skills, each scored from 1 to 5
        </caption>
        <thead>
          <tr>
            <th scope="col">Skill</th>
            <th scope="col">Score</th>
            <th scope="col">Evidence</th>
            <th scope="col">
              <VisuallyHidden>Link to the details</VisuallyHidden>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((d) => (
            <tr key={d.id}>
              <th scope="row" className="rp-scores__skill">
                {dimensionLabel(d.id)}
              </th>
              <td className="rp-scores__score" data-label="Score">
                <ScoreBar score={d.score} label={d.label} size="small" />
              </td>
              <td className="rp-scores__evidence" data-label="Evidence">
                <EvidenceLevel value={d.sufficiency} />
              </td>
              <td className="rp-scores__link">
                <SectionLink to={`skill-${d.id}`}>
                  Details <VisuallyHidden>for {dimensionLabel(d.id)}</VisuallyHidden>
                </SectionLink>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Section>
  );
}

function SkillItem({
  dimension,
  defaultOpen,
}: {
  dimension: DimensionResult;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const printing = usePrinting();
  const info = DIMENSIONS[dimension.id];
  return (
    <details
      id={`skill-${dimension.id}`}
      className="rp-skill"
      open={open || printing}
      data-rp-origin={info.label}
      onToggle={(event) => {
        // While printing every skill is opened for the paper; that is not the person's choice.
        if (!printing) setOpen(event.currentTarget.open);
      }}
    >
      <summary className="rp-skill__summary">
        <span className="rp-skill__name">{info.label}</span>
        <span className="rp-skill__score">
          <ScoreBar score={dimension.score} label={dimension.label} size="small" />
        </span>
        <Icon name="chevron-down" size={18} className="rp-skill__chevron" />
      </summary>
      <div className="rp-skill__body">
        <p className="rp-skill__rubric">
          <strong>
            {dimension.score} of 5, {dimension.label}.
          </strong>{' '}
          {SCORE_DESCRIPTIONS[dimension.score]}
        </p>
        <Field label="Why this score">
          <p className="t-reading">{plainUnexpectedTurn(dimension.rationale)}</p>
        </Field>
        <Field label="Evidence from your call">
          {dimension.evidence.length > 0 ? (
            <div className="rp-quotes">
              {dimension.evidence.map((e) => (
                <Quote key={`${e.turnIndex}-${e.quote}`} quote={e.quote} turnIndex={e.turnIndex} />
              ))}
            </div>
          ) : (
            <p className="t-reading">No quotable moment stood out for this skill.</p>
          )}
        </Field>
        <Field label="How firm this is">
          <p className="t-reading">{SUFFICIENCY_SENTENCES[dimension.sufficiency]}</p>
        </Field>
        <Field label="To strengthen this">
          <p className="t-reading">{plainUnexpectedTurn(dimension.guidance)}</p>
        </Field>
        <Field label="CARE behaviours this skill draws on">
          <ul className="rp-tags" role="list">
            {info.care.map((care) => (
              <li key={care}>
                <Tag>{CARE_LABELS[care]}</Tag>
              </li>
            ))}
          </ul>
        </Field>
      </div>
    </details>
  );
}

/** One disclosure per skill, open for the lowest-scored skill and on wide screens. */
export function SkillDetails({ report }: { report: CoachingReport }) {
  const wide = useMediaQuery('(min-width: 64em)');
  const lowest = lowestSkill(report);
  return (
    <Section
      id="skills"
      title="Skill details"
      lead="Why each skill was scored as it was, the words from your call that count as evidence, and one way to strengthen it."
    >
      <div className="rp-skills">
        {orderedDimensions(report).map((dimension) => (
          <SkillItem
            key={dimension.id}
            dimension={dimension}
            defaultOpen={wide || dimension.id === lowest}
          />
        ))}
      </div>
    </Section>
  );
}
