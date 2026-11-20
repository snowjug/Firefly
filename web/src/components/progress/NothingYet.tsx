import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import type { DimensionId } from '#shared/domain/vocab.ts';
import { skillsFromProgress } from '../atlas/constellation-layout.ts';
import { Icon } from '../Icon.tsx';
import { EmptyNotice } from '../frame/index.ts';
import { SkillReading } from './SkillReading.tsx';
import { Sky } from './Sky.tsx';
import { SkyKey } from './SkyKey.tsx';
import { describeSkill } from './progress-model.ts';
import '../../styles/progress.css';

const READING_ID = 'pg-reading';
const NO_RECENT: ReadonlySet<string> = new Set();

/**
 * For someone with nothing completed yet: the same sky, every star an outline, with one sentence
 * about what lights it and the way to begin. Choosing a skill still says what it is. Nothing here
 * is a score, and nothing is invented to make the sky look busy.
 */
export function NothingYet({ includeSamples }: { includeSamples: boolean }) {
  const skills = useMemo(() => skillsFromProgress(null), []);
  const [selected, setSelected] = useState<DimensionId | null>(null);
  const descriptions = useMemo(() => {
    const out = {} as Record<DimensionId, string>;
    for (const skill of skills) out[skill.id] = describeSkill(skill, undefined);
    return out;
  }, [skills]);
  const chosen = skills.find((skill) => skill.id === selected);

  return (
    <>
      <section className="pg-hero__sky" data-view="sky" aria-labelledby="pg-skills-title">
        <div className="pg-sky__bar">
          <h2 id="pg-skills-title" className="pg-sky__title type-label">
            Skill by skill
          </h2>
        </div>
        <Sky
          skills={skills}
          recent={NO_RECENT}
          selected={selected}
          onSelect={setSelected}
          controls={READING_ID}
          descriptions={descriptions}
        />
        <SkyKey />
      </section>

      <div id={READING_ID} className="pg-hero__panel">
        <EmptyNotice
          title="No completed practice calls yet"
          action={
            <div className="action-row">
              <Link to="/practice" className="action" viewTransition>
                Start practice
                <Icon name="arrow-right" size={18} />
              </Link>
              <Link to="/trainer" className="text-link" viewTransition>
                Open the Trainer page
              </Link>
            </div>
          }
        >
          <p>
            {includeSamples
              ? 'There are no sample or practice calls to show yet. Once you finish a call and read its coaching report, a star lights for each skill it scored. To preview this page first, load sample sessions from the Trainer page.'
              : 'Once you finish a call and read its coaching report, a star lights for each skill it scored. Nothing is shown until there is real practice to show. To preview this page first, load sample sessions from the Trainer page and switch on \u201cInclude sample sessions\u201d on this page.'}
          </p>
        </EmptyNotice>
        {chosen ? (
          <section className="pg-reading" aria-labelledby="pg-reading-title">
            <SkillReading
              skill={chosen}
              trend={undefined}
              strongest={false}
              repeated={null}
              completedSessions={0}
              scenario={null}
              practiceLoading={false}
              canPractise={false}
              headingLevel={2}
              titleId="pg-reading-title"
            />
          </section>
        ) : null}
      </div>
    </>
  );
}
