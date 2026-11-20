import type { MouseEvent } from 'react';
import type { CoachingReport } from '#shared/domain/report.ts';
import { scoreLabel, type DimensionId } from '#shared/domain/vocab.ts';
import { useReducedMotion } from '../../lib/theme.tsx';
import { Ledger } from './bridge.tsx';
import { OVERALL_CAPTION, dimensionLabel, reportSubline, scoreText } from './labels.ts';
import { ScoreScale } from './ScoreScale.tsx';
import { goToSkill } from './SkillConstellation.tsx';
import { moodRange } from './timeline-model.ts';

/** The overall score as a number on a ruler, named in words for screen readers. */
function OverallScore({ score }: { score: number | null }) {
  if (score === null) {
    return (
      <div className="rp-overall" role="img" aria-label="No overall score for this call">
        <p className="rp-overall__value">&ndash;</p>
        <ScoreScale
          className="rp-overall__scale"
          score={null}
          label="Overall score"
          numbered
          decorative
        />
      </div>
    );
  }
  return (
    <div className="rp-overall">
      <div
        className="rp-overall__figure"
        role="img"
        aria-label={`Overall score: ${scoreText(score)} out of 5`}
      >
        <p className="rp-overall__value tabular">
          <span className="rp-overall__num">{scoreText(score)}</span>
          <span className="rp-overall__of"> of 5</span>
        </p>
        <ScoreScale
          className="rp-overall__scale"
          score={score}
          label="Overall score"
          numbered
          decorative
        />
      </div>
      <p className="rp-overall__label">{scoreLabel(score)}</p>
    </div>
  );
}

/**
 * The opening of the report as a reading: the coach's own summary of the call in large type, and
 * beside it the few facts that frame it as a ledger (the overall score on its ruler, what the call
 * found, how the customer's mood moved, what you did, where to look first). Nothing here is a
 * tile: they are rows on hairlines. Every word comes from the report.
 */
export function ReportOverview({ report }: { report: CoachingReport }) {
  const reduced = useReducedMotion();
  const { discovery, completion, summary, journey } = report;
  const mood = moodRange(journey.points);
  const focus = (event: MouseEvent<HTMLAnchorElement>, id: DimensionId) => {
    if (goToSkill(id, reduced)) event.preventDefault();
  };

  const rows = [
    {
      label: 'Overall score',
      value: <OverallScore score={summary.overallScore} />,
      note: summary.overallScore !== null ? OVERALL_CAPTION : 'No overall score for this call.',
    },
    ...(discovery.total > 0
      ? [{ label: 'Hidden facts found', value: `${discovery.found} of ${discovery.total}` }]
      : []),
    ...(mood ? [{ label: 'Customer mood', value: mood }] : []),
    { label: 'Your turns', value: completion.traineeTurns },
    ...(summary.coachingFocus.length > 0
      ? [
          {
            label: 'Coaching focus',
            value: (
              <ul role="list" className="rp-focus">
                {summary.coachingFocus.map((id) => (
                  <li key={id}>
                    <a
                      href={`#dim-${id}`}
                      className="text-link"
                      onClick={(event) => focus(event, id)}
                    >
                      {dimensionLabel(id)}
                    </a>
                  </li>
                ))}
              </ul>
            ),
          },
        ]
      : []),
  ];

  return (
    <section className="rp-overview" aria-labelledby="rp-summary-title">
      <h2 id="rp-summary-title" className="sr-only">
        Summary
      </h2>
      <div className="rp-overview__story">
        <p className="rp-subline">{reportSubline(report)}</p>
        <p className="rp-summary">{summary.overall}</p>
      </div>
      <div className="rp-overview__ledger" role="group" aria-label="At a glance">
        <Ledger rows={rows} />
      </div>
    </section>
  );
}
