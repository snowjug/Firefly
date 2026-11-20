import { Link } from 'react-router';
import { Icon } from '../Icon.tsx';
import { PageFrame, PageHead } from '../frame/index.ts';
import { libraryPath } from './paths.ts';

/** Shown when a scenario link is out of date. It has its own h1, so the page still starts at a heading. */
export function ScenarioNotFound() {
  return (
    <PageFrame title="Mission not found" width="narrow">
      <PageHead
        eyebrow="Missions"
        title="We couldn't find that scenario"
        lead="The link may be out of date, or the scenario may have been removed."
      />
      <div className="action-row">
        <Link className="action" to={libraryPath}>
          Browse scenarios
          <Icon name="arrow-right" size={18} />
        </Link>
      </div>
    </PageFrame>
  );
}
