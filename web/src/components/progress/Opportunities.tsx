import { Link } from 'react-router';
import type { ProgressDTO, PublicScenarioDTO } from '#shared/domain/api.ts';
import { DIMENSIONS, type DimensionId } from '#shared/domain/vocab.ts';
import { plural } from '../../lib/format.ts';
import { Section } from '../frame/index.ts';
import { setupPath } from '../scenario/paths.ts';
import '../../styles/progress.css';

/**
 * Skills that were an improvement area in more than one call, each with a scenario built to
 * practise it. Rows on hairlines: the skill, how often it came up, and the way to practise.
 */
export function Opportunities({
  progress,
  scenarioFor,
}: {
  progress: Pick<ProgressDTO, 'repeatedOpportunities' | 'completedSessions'>;
  scenarioFor: (dimension: DimensionId) => PublicScenarioDTO | null;
}) {
  const items = progress.repeatedOpportunities;
  return (
    <Section id="opportunities" title="Opportunities that keep coming up">
      <div className="pg-opps">
        <p className="pg-opps__lead">
          Skills that appeared as an improvement area in more than one call.
        </p>
        {items.length > 0 ? (
          <ul className="pg-opps__list">
            {items.map((item) => {
              const practice = scenarioFor(item.dimension);
              return (
                <li key={item.dimension} className="pg-opp">
                  <p className="pg-opp__name">{DIMENSIONS[item.dimension].label}</p>
                  <p className="pg-opp__text">
                    Came up as an improvement area in {item.sessions} of{' '}
                    {plural(progress.completedSessions, 'completed call')}.
                  </p>
                  {practice ? (
                    <Link
                      to={setupPath(practice.id)}
                      className="text-link pg-opp__link"
                      viewTransition
                    >
                      Practise it in &ldquo;{practice.title}&rdquo;
                    </Link>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="pg-opps__none">
            No skill has come up as an improvement area in more than one call yet.
          </p>
        )}
      </div>
    </Section>
  );
}
