import { Link } from 'react-router';
import { Icon } from '../Icon.tsx';
import { EmptyState } from '../Page.tsx';

/** For someone with nothing completed yet: say what will appear here and how to get it. */
export function NothingYet({ includeSamples }: { includeSamples: boolean }) {
  return (
    <EmptyState
      icon="chart"
      title="No completed practice calls yet"
      action={
        <div className="cluster" style={{ justifyContent: 'center' }}>
          <Link to="/practice" className="btn btn-primary" viewTransition>
            Start practice <Icon name="arrow-right" size={16} />
          </Link>
          <Link to="/trainer" className="btn btn-secondary" viewTransition>
            Open the Trainer page
          </Link>
        </div>
      }
    >
      {includeSamples
        ? 'There are no sample or practice calls to show yet. Once you finish a call and read its coaching report, your skill scores and practice focus appear here. To preview this page first, load sample sessions from the Trainer page.'
        : 'Once you finish a call and read its coaching report, your skill scores and practice focus appear here. Nothing is shown until there is real practice to show. To preview this page first, load sample sessions from the Trainer page and switch on \u201cInclude sample sessions\u201d above.'}
    </EmptyState>
  );
}
