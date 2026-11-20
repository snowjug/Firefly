import type { ProgressDTO } from '#shared/domain/api.ts';
import type { SkillInput } from '../atlas/constellation-layout.ts';
import { SkillReading } from './SkillReading.tsx';
import '../../styles/progress.css';

/**
 * The same six skills as the sky, as a list: one row each, in report order, with every figure and
 * its line drawn out in full. It is the semantic alternative to the stars (nothing here depends on
 * seeing them) and the way in on a small screen.
 */
export function SkillList({
  skills,
  progress,
}: {
  skills: readonly SkillInput[];
  progress: Pick<
    ProgressDTO,
    'dimensionTrends' | 'strongest' | 'repeatedOpportunities' | 'completedSessions'
  >;
}) {
  return (
    <ol className="pg-list" aria-label="The six skills, in report order">
      {skills.map((skill) => {
        const titleId = `pg-row-${skill.id}`;
        return (
          <li key={skill.id} className="pg-row">
            <article aria-labelledby={titleId} className="pg-reading pg-reading--row">
              <SkillReading
                skill={skill}
                trend={progress.dimensionTrends.find((trend) => trend.dimension === skill.id)}
                strongest={progress.strongest === skill.id}
                repeated={
                  progress.repeatedOpportunities.find((item) => item.dimension === skill.id)
                    ?.sessions ?? null
                }
                completedSessions={progress.completedSessions}
                scenario={null}
                practiceLoading={false}
                canPractise={false}
                headingLevel={3}
                titleId={titleId}
              />
            </article>
          </li>
        );
      })}
    </ol>
  );
}
