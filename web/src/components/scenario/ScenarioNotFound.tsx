import { Link } from 'react-router';
import { Page } from '../Page.tsx';
import { Icon } from '../Icon.tsx';
import { libraryPath } from './paths.ts';

/** Shown when a scenario link is out of date. It has its own h1, so the page still has one heading level to start from. */
export function ScenarioNotFound() {
  return (
    <Page title="Scenario not found" width="narrow">
      <div className="state glass card">
        <span className="state-icon">
          <Icon name="search" size={26} />
        </span>
        <h1 className="t-section">We couldn't find that scenario</h1>
        <p>The link may be out of date, or the scenario may have been removed.</p>
        <Link className="btn btn-primary" to={libraryPath}>
          Browse scenarios
        </Link>
      </div>
    </Page>
  );
}
