import { Link } from 'react-router';
import type { ProgressDTO, PublicScenarioDTO } from '#shared/domain/api.ts';
import { DIMENSIONS, type DimensionId } from '#shared/domain/vocab.ts';
import { plural } from '../../lib/format.ts';
import { Icon } from '../Icon.tsx';
import { setupPath } from '../scenario/paths.ts';

/** Skills that were an improvement area in more than one call, each with a scenario built to practise it. */
export function Opportunities({
  progress,
  scenarioFor,
}: {
  progress: Pick<ProgressDTO, 'repeatedOpportunities' | 'completedSessions'>;
  scenarioFor: (dimension: DimensionId) => PublicScenarioDTO | null;
}) {
  const items = progress.repeatedOpportunities;
  return (
    <section className="glass pg-opps" aria-labelledby="pg-opps-title">
      <div className="pg-opps-top">
        <span className="stat-icon" data-tone="violet" aria-hidden="true">
          <Icon name="repeat" size={22} />
        </span>
        <div>
          <h2 id="pg-opps-title" className="t-section">
            Opportunities that keep coming up
          </h2>
          <p className="t-small t-muted">
            Skills that appeared as an improvement area in more than one call.
          </p>
        </div>
      </div>
      {items.length > 0 ? (
        <ul role="list" className="pg-opps-list">
          {items.map((item) => {
            const practice = scenarioFor(item.dimension);
            return (
              <li key={item.dimension} className="pg-opp">
                <p className="pg-opp-name">{DIMENSIONS[item.dimension].label}</p>
                <p className="t-small t-muted">
                  Came up as an improvement area in {item.sessions} of{' '}
                  {plural(progress.completedSessions, 'completed call')}.
                </p>
                {practice ? (
                  <Link to={setupPath(practice.id)} className="link-more" viewTransition>
                    Practise it in &ldquo;{practice.title}&rdquo;{' '}
                    <Icon name="arrow-right" size={16} />
                  </Link>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="pg-opps-empty">
          No skill has come up as an improvement area in more than one call yet.
        </p>
      )}
    </section>
  );
}
