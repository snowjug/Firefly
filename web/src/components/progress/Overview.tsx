import { Link } from 'react-router';
import type { ProgressDTO, PublicScenarioDTO } from '#shared/domain/api.ts';
import { DIMENSIONS } from '#shared/domain/vocab.ts';
import { plural } from '../../lib/format.ts';
import { Icon } from '../Icon.tsx';
import { Ledger } from '../frame/index.ts';
import { libraryPath, setupPath } from '../scenario/paths.ts';
import { RECENT_CHANGE, overallAverage } from './progress-model.ts';
import '../../styles/progress.css';

/**
 * The page in four lines: how many calls count, the average of every score, which way recent calls
 * are heading and the strongest skill. A ledger, not tiles: each fact is a row with its own words.
 */
export function SummaryLedger({ progress }: { progress: ProgressDTO }) {
  const change = RECENT_CHANGE[progress.recentChange];
  const strongest = progress.strongest ? DIMENSIONS[progress.strongest] : null;
  const started = progress.totalSessions - progress.completedSessions;
  const average = overallAverage(progress.dimensionTrends);
  return (
    <section className="pg-summary" aria-labelledby="pg-summary-title">
      <h2 id="pg-summary-title" className="sr-only">
        Summary
      </h2>
      <Ledger
        rows={[
          {
            label: 'Calls counted',
            value: String(progress.completedSessions),
            note:
              started > 0
                ? `${plural(progress.totalSessions, 'session')} started in all. Only completed calls are scored.`
                : 'Each one has a coaching report.',
          },
          {
            label: 'Average score',
            value: average === null ? 'None yet' : `${average.toFixed(1)} of 5`,
            note: 'Across every skill scored so far. For practice, not a rating.',
          },
          { label: 'Recent change', value: change.label, note: change.text },
          {
            label: 'Strongest so far',
            value: strongest ? strongest.label : 'Not clear yet',
            note: strongest
              ? strongest.description
              : 'This appears once you have two completed calls to compare.',
          },
        ]}
      />
    </section>
  );
}

/** The one skill to work on next, why, and a way to start. */
export function FocusBlock({
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
    <section className="pg-focus" aria-labelledby="pg-focus-title">
      <h2 id="pg-focus-title" className="pg-focus__title type-label">
        Where to focus next
      </h2>
      {skill ? (
        <>
          <p className="pg-focus__skill">{skill.label}</p>
          {progress.focusReason ? <p className="pg-focus__reason">{progress.focusReason}</p> : null}
          <p className="pg-focus__desc">{skill.description}</p>
          {loading ? (
            <div className="pg-focus__wait" aria-hidden="true" />
          ) : (
            <div className="action-row">
              {scenario ? (
                <>
                  <Link to={setupPath(scenario.id)} className="action" viewTransition>
                    Practise it in &ldquo;{scenario.title}&rdquo;
                    <Icon name="arrow-right" size={18} />
                  </Link>
                  <Link to={libraryPath} className="text-link" viewTransition>
                    Browse scenarios
                  </Link>
                </>
              ) : (
                <Link to={libraryPath} className="action" viewTransition>
                  Find a scenario to practise
                  <Icon name="arrow-right" size={18} />
                </Link>
              )}
            </div>
          )}
        </>
      ) : (
        <p className="pg-focus__desc">A focus is suggested after your first completed call.</p>
      )}
    </section>
  );
}
