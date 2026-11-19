import type { DimensionTrendDTO } from '#shared/domain/api.ts';
import { DIMENSIONS } from '#shared/domain/vocab.ts';
import { Icon } from '../Icon.tsx';
import { Sparkline } from './Sparkline.tsx';
import { trendAlt, trendSummary } from './progress-model.ts';

/**
 * One skill: what it is, a small line of its scores across calls and one plain sentence of numbers
 * ("Latest 4 · average 3.2 · rising"). Direction is always a word and an icon, never colour alone.
 */
export function SkillCard({
  trend,
  strongest,
  focus,
}: {
  trend: DimensionTrendDTO;
  strongest: boolean;
  focus: boolean;
}) {
  const meta = DIMENSIONS[trend.dimension];
  const summary = trendSummary(trend);
  const titleId = `pg-skill-${trend.dimension}`;
  return (
    <article className="glass pg-skill" aria-labelledby={titleId}>
      <header className="pg-skill-head">
        <h3 id={titleId} className="pg-skill-title">
          {meta.label}
        </h3>
        {trend.latest !== null ? (
          <p className="pg-skill-score tabular" aria-hidden="true">
            <strong>{trend.latest}</strong> / 5
          </p>
        ) : null}
      </header>
      {strongest || focus ? (
        <div className="cluster pg-skill-flags">
          {strongest ? (
            <span className="chip chip-positive">
              <Icon name="check" size={14} />
              Strongest so far
            </span>
          ) : null}
          {focus ? (
            <span className="chip chip-accent">
              <Icon name="target" size={14} />
              Suggested focus
            </span>
          ) : null}
        </div>
      ) : null}
      <p className="pg-skill-desc">{meta.description}</p>
      {trend.points.length > 0 ? (
        <Sparkline points={trend.points} label={trendAlt(trend)} />
      ) : (
        <div className="pg-spark-empty" aria-hidden="true" />
      )}
      <p className="pg-skill-line">
        {summary.direction ? <Icon name={summary.direction.icon} size={16} /> : null}
        <span>{summary.text}</span>
      </p>
    </article>
  );
}
