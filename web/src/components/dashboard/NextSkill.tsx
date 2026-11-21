import { Link } from 'react-router';
import type { ProgressDTO } from '#shared/domain/api.ts';
import { DIMENSIONS } from '#shared/domain/vocab.ts';
import type { AsyncState } from '../../lib/hooks.ts';
import { LoadingNotice } from '../frame/Notices.tsx';
import { Icon } from '../Icon.tsx';

/**
 * One skill to work on next, taken from the learner's own scores. It links to Progress. Until there
 * is a score it says what it is waiting for, and never names a skill it has no evidence for.
 */
export function NextSkill({ progress }: { progress: AsyncState<ProgressDTO> }) {
  const focus = progress.data?.focus ?? null;
  if (progress.loading && !progress.data) {
    return <LoadingNotice label="Loading your next skill" lines={2} />;
  }
  if (progress.error) {
    return (
      <div className="home-note">
        <p>We could not load your progress just now.</p>
        <p>
          <button type="button" className="text-link" onClick={progress.reload}>
            <Icon name="refresh" size={16} /> Try again
          </button>
        </p>
      </div>
    );
  }
  if (!focus) {
    return (
      <p className="home-note">
        Finish a practice call and Firefly will suggest one skill to work on next, based on the
        evidence in your own conversations.
      </p>
    );
  }
  return (
    <div className="home-skill">
      <p className="home-skill__name">{DIMENSIONS[focus].label}</p>
      {progress.data?.focusReason ? (
        <p className="home-skill__reason">{progress.data.focusReason}</p>
      ) : null}
      <p className="home-skill__about">{DIMENSIONS[focus].description}</p>
      <p>
        <Link to="/progress" className="text-link" viewTransition>
          See my progress <Icon name="arrow-right" size={16} />
        </Link>
      </p>
    </div>
  );
}
