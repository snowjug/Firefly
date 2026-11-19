import { useState } from 'react';
import type { ProgressDTO } from '#shared/domain/api.ts';
import { Icon } from '../Icon.tsx';
import { ScoresTable } from './ScoresTable.tsx';
import { SkillCard } from './SkillCard.tsx';
import { orderedTrends } from './progress-model.ts';

/** The six skills side by side, each with its own small line, and the same scores as a table on request. */
export function SkillsSection({ progress }: { progress: ProgressDTO }) {
  const [table, setTable] = useState(false);
  const trends = orderedTrends(progress.dimensionTrends);
  return (
    <section aria-labelledby="pg-skills-title" className="pg-section">
      <div className="pg-section-head">
        <div>
          <h2 id="pg-skills-title" className="t-section">
            Skill by skill
          </h2>
          <p className="t-small t-muted pg-lead">
            Each line follows one skill across your completed calls, oldest on the left. The scale
            runs from 1 to 5. These are practice signals from a handful of calls, not an assessment
            of you.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          aria-expanded={table}
          aria-controls="pg-scores-table"
          onClick={() => setTable((open) => !open)}
        >
          <Icon name="grid" size={16} />
          {table ? 'Hide scores table' : 'Show scores as a table'}
        </button>
      </div>
      <div className="pg-skills">
        {trends.map((trend) => (
          <SkillCard
            key={trend.dimension}
            trend={trend}
            strongest={progress.strongest === trend.dimension}
            focus={progress.focus === trend.dimension}
          />
        ))}
      </div>
      {table ? (
        <div id="pg-scores-table" className="pg-table-box">
          <ScoresTable trends={trends} />
        </div>
      ) : null}
    </section>
  );
}
