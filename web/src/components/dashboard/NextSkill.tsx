import { Link } from 'react-router';
import type { ProgressDTO } from '#shared/domain/api.ts';
import { DIMENSIONS } from '#shared/domain/vocab.ts';
import type { AsyncState } from '../../lib/hooks.ts';
import { Icon } from '../Icon.tsx';
import { SkeletonBlock } from '../Page.tsx';

/** One skill to work on next, taken from the learner's own scores. It links to My progress. */
export function NextSkill({ progress }: { progress: AsyncState<ProgressDTO> }) {
  const focus = progress.data?.focus ?? null;
  return (
    <section className="glass card dash-next" aria-labelledby="dash-next-title">
      <h2 id="dash-next-title" className="t-section">
        Your next skill to practise
      </h2>
      {progress.loading && !progress.data ? (
        <div className="stack" role="status" aria-label="Loading your next skill">
          <SkeletonBlock height={22} width="55%" />
          <SkeletonBlock height={14} />
          <SkeletonBlock height={14} width="70%" />
        </div>
      ) : progress.error ? (
        <div className="stack" style={{ ['--stack-gap' as string]: 'var(--sp-3)' }}>
          <p className="t-small t-muted">We could not load your progress just now.</p>
          <div>
            <button type="button" className="btn btn-secondary btn-sm" onClick={progress.reload}>
              <Icon name="refresh" size={16} /> Try again
            </button>
          </div>
        </div>
      ) : focus ? (
        <div className="dash-next-body">
          <p className="dash-next-skill">{DIMENSIONS[focus].label}</p>
          {progress.data?.focusReason ? (
            <p className="t-small">{progress.data.focusReason}</p>
          ) : null}
          <p className="t-small t-muted">{DIMENSIONS[focus].description}</p>
          <p className="dash-next-link">
            <Link to="/progress" className="link-more" viewTransition>
              See my progress <Icon name="arrow-right" size={16} />
            </Link>
          </p>
        </div>
      ) : (
        <p className="t-small t-muted">
          Finish a practice call and Firefly will suggest one skill to work on next, based on the
          evidence in your own conversations.
        </p>
      )}
    </section>
  );
}
