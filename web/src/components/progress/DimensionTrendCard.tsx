import type { DimensionTrendDTO } from '#shared/domain/api.ts';
import { DIMENSIONS } from '#shared/domain/vocab.ts';
import { Icon, type IconName } from '../Icon.tsx';
import { TrendSparkline } from './TrendSparkline.tsx';
import '../../styles/progress.css';

/** Calm wording for the direction of a skill. Always shown as text next to its icon. */
export const CHANGE_WORDS: Record<DimensionTrendDTO['change'], { label: string; icon: IconName }> =
  {
    up: { label: 'Trending up', icon: 'chevron-up' },
    steady: { label: 'Holding steady', icon: 'arrow-right' },
    down: { label: 'A little lower lately', icon: 'chevron-down' },
    'not-enough-data': { label: 'Not enough calls to see a trend', icon: 'info' },
  };

export function trendLabel(trend: DimensionTrendDTO): string {
  const scores = trend.points.map((p) => p.score);
  const calls = scores.length === 1 ? '1 call' : `${scores.length} calls`;
  return `${DIMENSIONS[trend.dimension].label} scores across ${calls}, oldest to newest: ${scores.join(', ')}.`;
}

export function DimensionTrendCard({
  trend,
  strongest,
  focus,
}: {
  trend: DimensionTrendDTO;
  strongest: boolean;
  focus: boolean;
}) {
  const meta = DIMENSIONS[trend.dimension];
  const change = CHANGE_WORDS[trend.change];
  const titleId = `pg-trend-${trend.dimension}`;
  return (
    <article className="surface pg-trend" aria-labelledby={titleId}>
      <header className="pg-trend-head">
        <h3 id={titleId} className="pg-trend-title">
          {meta.label}
        </h3>
        {strongest || focus ? (
          <div className="cluster">
            {strongest ? <span className="chip chip-positive">Strongest so far</span> : null}
            {focus ? <span className="chip chip-accent">Suggested focus</span> : null}
          </div>
        ) : null}
      </header>
      {trend.points.length > 0 ? (
        <>
          <TrendSparkline points={trend.points} label={trendLabel(trend)} />
          <dl className="pg-facts">
            <div>
              <dt>Latest</dt>
              <dd>{trend.latest === null ? '\u2013' : `${trend.latest} of 5`}</dd>
            </div>
            <div>
              <dt>Average</dt>
              <dd>{trend.average === null ? '\u2013' : trend.average.toFixed(1)}</dd>
            </div>
            <div>
              <dt>Recent change</dt>
              <dd className="pg-change">
                <Icon name={change.icon} size={15} />
                {change.label}
              </dd>
            </div>
          </dl>
        </>
      ) : (
        <p className="t-small t-muted">No scores for this skill yet.</p>
      )}
    </article>
  );
}
