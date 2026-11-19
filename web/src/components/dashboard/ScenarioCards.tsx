import { Link } from 'react-router';
import { setupPath } from '../scenario/paths.ts';
import { IssueIcon } from '../ui/IssueIcon.tsx';
import { demandText, type ScenarioPick } from './dashboard-model.ts';

/**
 * Scenario cards. The title is the link, stretched over the whole card, so a screen reader hears
 * the scenario's name and the card is still easy to click or tap.
 */
export function ScenarioCards({ picks }: { picks: readonly ScenarioPick[] }) {
  return (
    <ul role="list" className="dash-reco">
      {picks.map((pick) => (
        <li key={pick.scenario.id}>
          <article className="glass card-interactive dash-scn">
            <div className="dash-scn-top">
              <IssueIcon issue={pick.scenario.issueType} />
              <div className="dash-scn-head">
                {pick.recommended ? <span className="chip chip-accent">Recommended</span> : null}
                <h3 className="dash-scn-title">
                  <Link to={setupPath(pick.scenario.id)} className="dash-scn-link" viewTransition>
                    {pick.scenario.title}
                  </Link>
                </h3>
                <p className="dash-scn-meta">{demandText(pick.scenario)}</p>
              </div>
            </div>
            <p className="dash-scn-reason">{pick.reason}</p>
          </article>
        </li>
      ))}
    </ul>
  );
}

export function ScenarioCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div
      className="dash-reco"
      role="status"
      aria-label="Loading recommended scenarios"
      aria-live="polite"
    >
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="glass dash-scn dash-scn-skeleton" aria-hidden="true">
          <div className="dash-scn-top">
            <span className="skeleton dash-stat-skeleton-icon" />
            <div className="dash-scn-head">
              <span className="skeleton" style={{ height: 16, width: '70%' }} />
              <span className="skeleton" style={{ height: 12, width: '45%' }} />
            </div>
          </div>
          <span className="skeleton" style={{ height: 12 }} />
          <span className="skeleton" style={{ height: 12, width: '60%' }} />
        </div>
      ))}
    </div>
  );
}
