import { Link } from 'react-router';

const REPOSITORY_URL = 'https://github.com/snowjug/Firefly';

/**
 * The training-aid statement as the last line of a public page. The signed-in frame draws its own
 * (`Colophon`); the front door has no frame around it, so it brings the same quiet line and the
 * same classes (`colophon*`, from the shell's sheet). It is the page's `footer` landmark, so it
 * sits after `main`, not inside it.
 */
export function PublicColophon({
  className = '',
  source = false,
}: {
  className?: string;
  /** Also link to the source code. */
  source?: boolean;
}) {
  return (
    <footer className={`colophon ${className}`.trim()}>
      <div className="colophon__rule rule rule--point" aria-hidden="true" />
      <p className="colophon__line">
        Firefly is a training aid. Scenarios are fictional; never enter real customer information.
        Scores are for practice, not performance reviews.
      </p>
      <p className="colophon__links">
        <Link to="/help#responsible-ai" className="text-link">
          Responsible AI
        </Link>
        <Link to="/settings" className="text-link">
          Settings
        </Link>
        {source ? (
          <a href={REPOSITORY_URL} className="text-link" target="_blank" rel="noopener noreferrer">
            Source on GitHub
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        ) : null}
      </p>
    </footer>
  );
}
