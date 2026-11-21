import { useEffect, useMemo, useRef, useState } from 'react';
import type { ProgressDTO, PublicScenarioDTO } from '#shared/domain/api.ts';
import { DIMENSIONS, type DimensionId } from '#shared/domain/vocab.ts';
import { useMediaQuery } from '../../lib/hooks.ts';
import { useStoredState } from '../../lib/storage.ts';
import { skillsFromProgress } from '../atlas/constellation-layout.ts';
import { FocusBlock, SummaryLedger } from './Overview.tsx';
import { SkillList } from './SkillList.tsx';
import { SkillReading } from './SkillReading.tsx';
import { Sky } from './Sky.tsx';
import { SkyKey } from './SkyKey.tsx';
import { ViewSwitch, type SkyView } from './ViewSwitch.tsx';
import { callsScored, describeSkill, lightText, recentStarIds } from './progress-model.ts';
import '../../styles/progress.css';

const READING_ID = 'pg-reading';

/** The widest screens put the panel beside the sky; anything narrower stacks them. */
const SIDE_BY_SIDE = '(min-width: 64rem)';

export interface ProgressStageProps {
  progress: ProgressDTO;
  /** Where the focus skill can be practised, and whether that is still being looked up. */
  scenarioFor(dimension: DimensionId): PublicScenarioDTO | null;
  practiceLoading: boolean;
  /** Arrived from a report: the newest stars pulse once. */
  arrivedFromReport: boolean;
}

/**
 * The sky and its panel: the constellation beside a summary and the next focus, or, once a cluster
 * is chosen, that skill's reading in the panel's place. The same data is always available as a list
 * (the way in on a small screen) and, below the page's hero, as a table (see `ScoresMore`).
 */
export function ProgressStage({
  progress,
  scenarioFor,
  practiceLoading,
  arrivedFromReport,
}: ProgressStageProps) {
  const compact = useMediaQuery('(max-width: 39.9375rem)');
  const [stored, setStored] = useStoredState<SkyView | null>('firefly.progress-view', null);
  const view: SkyView = stored ?? (compact ? 'list' : 'sky');
  const [selected, setSelected] = useState<DimensionId | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const panel = useRef<HTMLDivElement>(null);
  const sideBySide = useMediaQuery(SIDE_BY_SIDE);

  const skills = useMemo(() => skillsFromProgress(progress), [progress]);
  const recent = useMemo(() => recentStarIds(progress.dimensionTrends), [progress]);
  const descriptions = useMemo(() => {
    const out = {} as Record<DimensionId, string>;
    for (const skill of skills) {
      out[skill.id] = describeSkill(
        skill,
        progress.dimensionTrends.find((trend) => trend.dimension === skill.id),
      );
    }
    return out;
  }, [skills, progress]);

  const choose = (id: DimensionId | null) => {
    setSelected(id);
    const skill = skills.find((item) => item.id === id);
    setAnnouncement(
      skill
        ? `${DIMENSIONS[skill.id].label}: ${lightText(skill.level).toLowerCase()}${skill.evidence > 0 ? `, ${callsScored(skill.evidence)}` : ''}. Its reading is in the panel after the sky.`
        : 'Back to the summary.',
    );
  };

  // Stacked, the reading opens below the sky: bring it into view so choosing never looks like nothing.
  useEffect(() => {
    if (selected === null || sideBySide) return;
    const node = panel.current;
    if (node && typeof node.scrollIntoView === 'function') {
      node.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selected, sideBySide]);

  const selectedSkill = skills.find((skill) => skill.id === selected);
  const trendOf = (id: DimensionId) => progress.dimensionTrends.find((t) => t.dimension === id);

  const skySection = (
    <section className="pg-hero__sky" data-view={view} aria-labelledby="pg-skills-title">
      <div className="pg-sky__bar">
        <h2 id="pg-skills-title" className="pg-sky__title type-label">
          Skill by skill
        </h2>
        <ViewSwitch view={view} onChange={setStored} />
      </div>
      {view === 'sky' ? (
        <>
          <Sky
            skills={skills}
            recent={recent}
            selected={selected}
            onSelect={choose}
            controls={READING_ID}
            descriptions={descriptions}
            pulse={arrivedFromReport}
          />
          <SkyKey />
        </>
      ) : (
        <SkillList skills={skills} progress={progress} />
      )}
      <p className="pg-sky__caption">
        Each star is one completed call. These are practice signals from a handful of calls, not an
        assessment of you.
      </p>
      <p role="status" className="sr-only">
        {announcement}
      </p>
    </section>
  );

  const panelSection = (
    <div id={READING_ID} className="pg-hero__panel" ref={panel}>
      {view === 'sky' && selectedSkill ? (
        <section className="pg-reading" aria-labelledby="pg-reading-title">
          <button type="button" className="pg-reading__back text-link" onClick={() => choose(null)}>
            <span aria-hidden="true">&larr;</span> All six skills
          </button>
          <SkillReading
            skill={selectedSkill}
            trend={trendOf(selectedSkill.id)}
            strongest={progress.strongest === selectedSkill.id}
            repeated={
              progress.repeatedOpportunities.find((item) => item.dimension === selectedSkill.id)
                ?.sessions ?? null
            }
            completedSessions={progress.completedSessions}
            scenario={scenarioFor(selectedSkill.id)}
            practiceLoading={practiceLoading}
            canPractise
            headingLevel={2}
            titleId="pg-reading-title"
          />
        </section>
      ) : (
        <>
          <FocusBlock
            progress={progress}
            scenario={progress.focus ? scenarioFor(progress.focus) : null}
            loading={practiceLoading}
          />
          <SummaryLedger progress={progress} />
        </>
      )}
    </div>
  );

  // The long list reads better after the summary and the next focus, which are what most people
  // came for; the sky is one screen, so it comes first. The order here is the reading order.
  return (
    <>
      {view === 'list' ? panelSection : null}
      {skySection}
      {view === 'sky' ? panelSection : null}
    </>
  );
}
