import { ErrorMessage } from '../app/shell/RouteError.tsx';
import { useDocumentTitle } from '../lib/hooks.ts';

/** Any address Firefly has no page for. The same calm message as a page that fails to load. */
export default function NotFound() {
  useDocumentTitle('Page not found');
  return <ErrorMessage kind="not-found" />;
}
