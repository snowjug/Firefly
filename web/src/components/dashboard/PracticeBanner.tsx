import { Link } from 'react-router';
import type { SessionSummaryDTO } from '#shared/domain/api.ts';
import { formatRelative } from '../../lib/format.ts';
import { useMediaQuery } from '../../lib/hooks.ts';
import { useOnDemand } from '../../lib/onDemand.ts';
import { Icon } from '../Icon.tsx';

const LOOP = ['Practise', 'Reflect', 'Improve'];

// The figure is decoration, so the page paints without it and it appears a moment later.
const loadAvatar = () => import('../illustration/AgentAvatar.tsx');

/**
 * The invitation at the top of the home page. It offers a new practice call, or, when a call is
 * still open, picks that one up first. The illustration is not drawn at all on a phone, where the
 * banner is only its words and buttons.
 */
export function PracticeBanner({ active }: { active: SessionSummaryDTO | null }) {
  const withArt = useMediaQuery('(min-width: 721px)');
  const avatarCode = useOnDemand(loadAvatar, withArt);
  const AgentAvatar = avatarCode.module?.AgentAvatar;
  return (
    <section className="banner dash-banner" aria-labelledby="dash-banner-title">
      <div className="dash-banner-copy">
        {active ? (
          <>
            <h2 id="dash-banner-title" className="dash-banner-title">
              You have a call in progress
            </h2>
            <p className="dash-banner-text">
              {active.scenarioTitle}, started{' '}
              <span className="nowrap">{formatRelative(active.startedAt)}</span>.
            </p>
            <div className="cluster dash-banner-actions">
              <Link
                to={`/calls/${encodeURIComponent(active.id)}`}
                className="btn btn-light btn-lg"
                viewTransition
              >
                Resume call <Icon name="arrow-right" size={18} />
              </Link>
              <Link to="/practice" className="btn btn-outline-light btn-lg" viewTransition>
                Start a new practice
              </Link>
            </div>
          </>
        ) : (
          <>
            <h2 id="dash-banner-title" className="dash-banner-title">
              Start a new practice session
            </h2>
            <p className="dash-banner-text">
              Choose a scenario, configure the customer, and begin your simulation.
            </p>
            <div className="cluster dash-banner-actions">
              <Link to="/practice" className="btn btn-light btn-lg" viewTransition>
                Start practice <Icon name="arrow-right" size={18} />
              </Link>
            </div>
          </>
        )}
      </div>
      {withArt ? (
        <div className="dash-banner-side">
          <div className="dash-banner-art">{AgentAvatar ? <AgentAvatar /> : null}</div>
          <ol role="list" className="dash-banner-loop" aria-label="How practice works">
            {LOOP.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>
      ) : null}
    </section>
  );
}
