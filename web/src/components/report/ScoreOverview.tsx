import type { CoachingReport, DimensionResult } from '#shared/domain/report.ts';
import { DIMENSION_IDS, DIMENSIONS, scoreLabel } from '#shared/domain/vocab.ts';
import { scoreTone } from '../../lib/format.ts';
import { Icon } from '../Icon.tsx';
import { ProgressBar } from '../ui/ProgressBar.tsx';
import { ScoreRing } from '../ui/ScoreRing.tsx';
import { StatCard } from '../ui/StatCard.tsx';
import { OVERALL_CAPTION, SUFFICIENCY_BADGE, dimensionLabel, scoreOfFive } from './labels.ts';
import { moodRange } from './timeline-model.ts';

const RING_SIZE = 168;

const byDimensionOrder = (a: DimensionResult, b: DimensionResult) =>
  DIMENSION_IDS.indexOf(a.id) - DIMENSION_IDS.indexOf(b.id);

/** An empty ring for a call with too little in it to score. The words say the same thing. */
function NoScoreRing() {
  const stroke = 11;
  const radius = (RING_SIZE - stroke) / 2;
  return (
    <div
      className="ring rp-ring-empty"
      style={{ width: RING_SIZE, height: RING_SIZE }}
      role="img"
      aria-label="No overall score for this call"
    >
      <svg width={RING_SIZE} height={RING_SIZE} viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}>
        <circle
          className="ring-track"
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeDasharray="3 9"
          strokeLinecap="round"
        />
      </svg>
      <div className="ring-text" aria-hidden="true">
        <span className="ring-value">&ndash;</span>
      </div>
    </div>
  );
}

function OverallCard({ score, label }: { score: number | null; label: string | null }) {
  return (
    <section className="glass card rp-overall" aria-labelledby="rp-overall-title">
      <h2 id="rp-overall-title" className="t-section">
        Overall score
      </h2>
      {score !== null ? <ScoreRing value={score} size={RING_SIZE} /> : <NoScoreRing />}
      {score !== null ? (
        <>
          {label ? <p className="rp-overall-label">{label}</p> : null}
          <p className="rp-overall-caption t-small t-muted">{OVERALL_CAPTION}</p>
        </>
      ) : (
        <p className="rp-overall-caption t-small t-muted">No overall score for this call.</p>
      )}
    </section>
  );
}

function Stats({ report }: { report: CoachingReport }) {
  const { discovery, completion, summary, journey } = report;
  const mood = moodRange(journey.points);
  return (
    <ul role="list" className="rp-stats" aria-label="At a glance">
      {discovery.total > 0 ? (
        <li>
          <StatCard
            icon="search"
            tone="blue"
            value={`${discovery.found} of ${discovery.total}`}
            label="Hidden facts found"
          />
        </li>
      ) : null}
      {mood ? (
        <li>
          <StatCard icon="gauge" tone="violet" value={mood} label="Customer mood" />
        </li>
      ) : null}
      <li>
        <StatCard icon="message" tone="blue" value={completion.traineeTurns} label="Your turns" />
      </li>
      {summary.coachingFocus.length > 0 ? (
        <li>
          <div className="stat glass rp-focus">
            <span className="stat-icon" data-tone="violet">
              <Icon name="target" size={22} />
            </span>
            <div>
              <ul role="list" className="rp-focus-list">
                {summary.coachingFocus.map((id) => (
                  <li key={id}>
                    <a href={`#dim-${id}`} className="chip chip-accent rp-focus-chip">
                      {dimensionLabel(id)}
                    </a>
                  </li>
                ))}
              </ul>
              <div className="stat-label">Coaching focus</div>
            </div>
          </div>
        </li>
      ) : null}
    </ul>
  );
}

function SkillRow({ dimension }: { dimension: DimensionResult }) {
  const badge = SUFFICIENCY_BADGE[dimension.sufficiency];
  const name = DIMENSIONS[dimension.id].label;
  return (
    <a
      href={`#dim-${dimension.id}`}
      className="rp-skill-row"
      data-tone={scoreTone(dimension.score)}
    >
      <span className="rp-skill-name">{name}</span>
      <span className="rp-skill-bar" aria-hidden="true">
        <ProgressBar
          value={dimension.score}
          max={5}
          label={`${name}: ${scoreOfFive(dimension.score)}`}
        />
      </span>
      <span className="rp-skill-score tabular">
        <span className="rp-skill-num">{dimension.score}</span>
        <span className="rp-skill-of"> of 5</span>
      </span>
      <span className="rp-skill-meta">
        <span className="rp-skill-label">{dimension.label}</span>
        {badge ? <span className="chip chip-caution">{badge}</span> : null}
      </span>
    </a>
  );
}

/** The six scores at a glance. Each row jumps to that skill's details further down. */
function SkillScores({ dimensions }: { dimensions: readonly DimensionResult[] }) {
  const ordered = [...dimensions].sort(byDimensionOrder);
  return (
    <section id="skills" className="glass card rp-skills" aria-labelledby="skills-title">
      <h2 id="skills-title" className="t-section">
        Six skill scores
      </h2>
      <p className="rp-lead t-small">
        Each skill is scored from 1 to 5 against the practice rubric, using quotes from your own
        call. Select a skill to jump to its details.
      </p>
      <ul role="list" className="rp-skill-rows">
        {ordered.map((dimension) => (
          <li key={dimension.id}>
            <SkillRow dimension={dimension} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The score row: the overall score and a few quick facts beside the six skill scores. */
export function ScoreOverview({ report }: { report: CoachingReport }) {
  const { overallScore } = report.summary;
  return (
    <div className="rp-scores">
      <div className="rp-scores-left">
        <OverallCard
          score={overallScore}
          label={overallScore !== null ? scoreLabel(overallScore) : null}
        />
        <Stats report={report} />
      </div>
      <SkillScores dimensions={report.dimensions} />
    </div>
  );
}
