import { Icon, LinkButton } from '../design/index.ts';
import { useDocumentTitle } from '../lib/hooks.ts';

export default function NotFound() {
  useDocumentTitle('Page not found');
  return (
    <div className="l-page l-page--read l-section l-stack l-gap-6">
      <Icon name="search" size={32} />
      <div className="l-stack l-gap-2">
        <h1 className="t-title1">We cannot find that page</h1>
        <p className="t-reading t-muted">
          The address may be mistyped, or the page may have moved. You can start from the home page,
          or go straight to a scenario to practise.
        </p>
      </div>
      <div className="l-cluster l-gap-3">
        <LinkButton to="/scenarios" appearance="primary">
          Go to scenarios
        </LinkButton>
        <LinkButton to="/" appearance="outline">
          Home
        </LinkButton>
      </div>
    </div>
  );
}
