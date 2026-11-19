import { Link } from 'react-router';
import type { ProgressDTO, PublicScenarioDTO } from '#shared/domain/api.ts';
import { DIMENSIONS } from '#shared/domain/vocab.ts';
import { Icon } from '../Icon.tsx';
import { SkeletonBlock } from '../Page.tsx';
import { libraryPath, setupPath } from '../scenario/paths.ts';

/** The one skill to work on next, why, and a way to start. */
export function FocusCard({
  progress,
  scenario,
  loading,
}: {
  progress: Pick<ProgressDTO, 'focus' | 'focusReason'>;
  /** A scenario built to practise the skill, when one is known. */
  scenario: PublicScenarioDTO | null;
  /** True while the scenarios are still arriving, so the buttons do not change under the pointer. */
  loading: boolean;
}) {
  const skill = progress.focus ? DIMENSIONS[progress.focus] : null;
  return (
    <section className="glass pg-focus" aria-labelledby="pg-focus-title">
      <div className="pg-focus-top">
        <span className="stat-icon" data-tone="blue" aria-hidden="true">
          <Icon name="target" size={22} />
        </span>
        <h2 id="pg-focus-title" className="t-section">
          Where to focus next
        </h2>
      </div>
      {skill ? (
        <>
          <p className="pg-focus-skill">{skill.label}</p>
          {progress.focusReason ? <p className="pg-focus-reason">{progress.focusReason}</p> : null}
          <p className="t-small t-muted">{skill.description}</p>
          <div className="cluster pg-focus-actions">
            {loading ? (
              <SkeletonBlock height={44} width={240} />
            ) : scenario ? (
              <>
                <Link to={setupPath(scenario.id)} className="btn btn-primary" viewTransition>
                  Practise it in &ldquo;{scenario.title}&rdquo;{' '}
                  <Icon name="arrow-right" size={16} />
                </Link>
                <Link to={libraryPath} className="btn btn-secondary" viewTransition>
                  Browse scenarios
                </Link>
              </>
            ) : (
              <Link to={libraryPath} className="btn btn-primary" viewTransition>
                Find a scenario to practise <Icon name="arrow-right" size={16} />
              </Link>
            )}
          </div>
        </>
      ) : (
        <p className="t-small t-muted">A focus is suggested after your first completed call.</p>
      )}
    </section>
  );
}
