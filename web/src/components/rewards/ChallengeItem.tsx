import { Link } from 'react-router';
import type { ChallengeDTO } from '#shared/domain/api.ts';
import { saveDraft } from '../../lib/draft.ts';
import { Icon } from '../Icon.tsx';
import { setupPath } from '../scenario/paths.ts';
import { Meter } from './Meter.tsx';
import { challengeProgressText } from './rewards-model.ts';
import '../../styles/rewards.css';

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

/**
 * A challenge as a row of text: what it is, what it is worth, how far along it is and whether it
 * is still open, with a way to start when there is a scenario to start. No box, no badge.
 */
export function ChallengeItem({ challenge }: { challenge: ChallengeDTO }) {
  const done = challenge.status === 'completed';
  return (
    <li className="rw-challenge" data-status={challenge.status}>
      <div className="rw-challenge__main">
        <h4 className="rw-challenge__title">{challenge.title}</h4>
        <p className="rw-challenge__detail">{challenge.detail}</p>
        <Meter
          className="rw-challenge__meter"
          value={challenge.progress.current}
          max={challenge.progress.target}
          label={`${challenge.title}: progress`}
        />
        <p className="rw-challenge__progress">{challengeProgressText(challenge)}</p>
      </div>
      <dl className="rw-facts">
        <div>
          <dt>Reward</dt>
          <dd>{challenge.reward}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{done ? 'Completed' : 'Active'}</dd>
        </div>
      </dl>
      {challenge.scenarioId ? (
        <Link
          to={setupPath(challenge.scenarioId)}
          className="action action--quiet action--compact rw-challenge__start"
          aria-label={`Start: ${challenge.title}`}
          onClick={() => startChallenge(challenge)}
          viewTransition
        >
          Start
          <Icon name="arrow-right" size={16} />
        </Link>
      ) : null}
    </li>
  );
}
