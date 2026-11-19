import { Link } from 'react-router';
import type { ChallengeDTO } from '#shared/domain/api.ts';
import { saveDraft } from '../../lib/draft.ts';
import { Icon } from '../Icon.tsx';
import { setupPath } from '../scenario/paths.ts';
import { ProgressBar } from '../ui/ProgressBar.tsx';
import { challengeProgressText } from './rewards-model.ts';

/**
 * Opens the suggested scenario. A challenge that is only met at one difficulty also pre-selects it
 * (the same draft the setup page reads), and any other challenge starts the scenario as written, so
 * the next call is the one the challenge is about.
 */
function startChallenge(challenge: ChallengeDTO) {
  if (!challenge.scenarioId) return;
  saveDraft({
    scenarioId: challenge.scenarioId,
    overrides: challenge.difficulty ? { difficulty: challenge.difficulty } : {},
  });
}

export function ChallengeCard({ challenge }: { challenge: ChallengeDTO }) {
  const done = challenge.status === 'completed';
  return (
    <li className="glass rw-challenge" data-status={challenge.status}>
      <div className="rw-challenge-head">
        <span className="tone-icon" data-tone={done ? 'green' : 'violet'} aria-hidden="true">
          <Icon name={done ? 'check-circle' : 'target'} size={22} />
        </span>
        <div className="rw-challenge-heading">
          <h3 className="rw-challenge-title">{challenge.title}</h3>
          <p className="rw-challenge-reward">
            <span className="chip chip-amber">
              <Icon name="award" size={14} />
              <span className="sr-only">Reward: </span>
              {challenge.reward}
            </span>
          </p>
        </div>
        <span className={done ? 'chip chip-positive' : 'chip chip-accent'}>
          <span className="sr-only">Status: </span>
          {done ? 'Completed' : 'Active'}
        </span>
      </div>
      <p className="rw-challenge-detail">{challenge.detail}</p>
      <div className="rw-badge-progress">
        <ProgressBar
          value={challenge.progress.current}
          max={challenge.progress.target}
          label={`${challenge.title}: progress`}
          tone={done ? 'green' : 'violet'}
        />
        <p className="rw-meta tabular">{challengeProgressText(challenge)}</p>
      </div>
      {challenge.scenarioId ? (
        <div>
          <Link
            to={setupPath(challenge.scenarioId)}
            className="btn btn-secondary btn-sm"
            aria-label={`Start: ${challenge.title}`}
            onClick={() => startChallenge(challenge)}
            viewTransition
          >
            Start <Icon name="arrow-right" size={16} />
          </Link>
        </div>
      ) : null}
    </li>
  );
}
