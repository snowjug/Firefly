import { useEffect } from 'react';
import { Link } from 'react-router';
import type { BadgeDTO, LedgerEntryDTO, RewardsDTO, SessionDTO } from '#shared/domain/api.ts';
import type { CoachingReport } from '#shared/domain/report.ts';
import { api } from '../../lib/api.ts';
import { useApi } from '../../lib/hooks.ts';
import { play } from '../../lib/sound.ts';
import { Icon } from '../Icon.tsx';
import { LoadingNotice, Section } from './bridge.tsx';
import { EvidenceQuote } from './EvidenceQuote.tsx';
import { noPointsReason, transcriptHref } from './labels.ts';
import { StarMark } from './marks.tsx';

export interface SessionRewards {
  /** `hidden` when the rewards could not be loaded: the report simply leaves the section out. */
  phase: 'loading' | 'ready' | 'hidden';
  entries: LedgerEntryDTO[];
  badges: BadgeDTO[];
  points: number;
  note: string;
}

/**
 * What this one call earned, out of the whole ledger: its own entries, the points for being the
 * first full call of its day (that entry belongs to the day, so it is matched by the moment the
 * call ended) and any badge this call completed.
 */
export function pickCallRewards(
  rewards: RewardsDTO,
  session: Pick<SessionDTO, 'id' | 'startedAt' | 'endedAt'>,
): Pick<SessionRewards, 'entries' | 'badges' | 'points'> {
  const finished = session.endedAt ?? session.startedAt;
  const entries = rewards.ledger.filter(
    (entry) =>
      entry.sessionId === session.id ||
      (entry.ruleId === 'practice-day' && entry.sessionId === null && entry.at === finished),
  );
  const badges = rewards.badges.filter(
    (badge) => badge.earned && badge.earnedInSessionId === session.id,
  );
  return { entries, badges, points: entries.reduce((sum, entry) => sum + entry.points, 0) };
}

/** Loads the rewards once for this call. A failed request quietly hides the section. */
export function useSessionRewards(
  session: Pick<SessionDTO, 'id' | 'startedAt' | 'endedAt'>,
): SessionRewards {
  const { data, error, loading } = useApi<RewardsDTO>(
    // Starting inside a promise turns a synchronous failure into the same "hidden" outcome.
    (signal) => Promise.resolve().then(() => api.rewards(new Date().getTimezoneOffset(), signal)),
    [session.id],
  );
  if (error) return { phase: 'hidden', entries: [], badges: [], points: 0, note: '' };
  if (loading || !data) return { phase: 'loading', entries: [], badges: [], points: 0, note: '' };
  return { phase: 'ready', ...pickCallRewards(data, session), note: data.note };
}

function Earned({ sessionId, rewards }: { sessionId: string; rewards: SessionRewards }) {
  const { entries, badges, points } = rewards;
  return (
    <>
      <p className="rp-rewards__headline">
        You earned {points} {points === 1 ? 'point' : 'points'} from this call
      </p>
      <p className="rp-quiet">Every award below says why it was given.</p>

      {entries.length > 0 ? (
        <ul role="list" className="rp-ledger">
          {entries.map((entry) => (
            <li key={entry.id} className="rp-ledger-item">
              <p className="rp-ledger-points">
                <span className="sr-only">Points: </span>+{entry.points}
              </p>
              <div className="rp-ledger-body">
                <p className="rp-ledger-title">{entry.title}</p>
                <p className="rp-quiet">{entry.reason}</p>
                {entry.evidence && (entry.evidence.quote || entry.evidence.turnIndex !== null) ? (
                  <EvidenceQuote
                    quote={entry.evidence.quote}
                    turn={entry.evidence.turnIndex}
                    href={
                      entry.evidence.turnIndex !== null
                        ? transcriptHref(sessionId, entry.evidence.turnIndex)
                        : undefined
                    }
                  />
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {badges.length > 0 ? (
        <ul role="list" className="rp-badges" aria-label="Badges earned in this call">
          {badges.map((badge) => (
            <li key={badge.id} className="rp-badge-item">
              <StarMark size={20} className="rp-badge-item__mark" />
              <div>
                <p className="rp-ledger-title">Badge earned: {badge.title}</p>
                <p className="rp-quiet">{badge.criteria}</p>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );
}

/** "Rewards from this call": what it earned and why, or a plain reason it earned nothing. */
export function RewardsSection({
  session,
  completion,
  rewards,
  celebrate,
  eyebrow,
}: {
  session: Pick<SessionDTO, 'id' | 'isSample'>;
  completion: CoachingReport['completion'];
  rewards: SessionRewards;
  /** Arriving straight from the call: a short sound, if the person turned sound on. */
  celebrate: boolean;
  eyebrow?: string;
}) {
  const earned = rewards.points > 0 || rewards.badges.length > 0;
  useEffect(() => {
    if (celebrate && rewards.phase === 'ready' && earned) play('earned');
  }, [celebrate, rewards.phase, earned]);

  if (rewards.phase === 'hidden') return null;
  const loading = rewards.phase === 'loading';
  return (
    <Section id="rewards" eyebrow={eyebrow} title="Rewards from this call">
      <p className="rp-lead">
        Points encourage practice, and each one comes with the reason it was given.
      </p>
      {loading ? (
        <LoadingNotice label="Checking what this call earned" lines={2} />
      ) : (
        <div className="rp-rewards" data-earned={earned ? 'true' : 'false'}>
          {earned ? (
            <Earned sessionId={session.id} rewards={rewards} />
          ) : (
            <p className="rp-rewards__none">{noPointsReason(session, completion)}</p>
          )}
          <div className="rp-rewards__foot">
            <Link to="/rewards" className="text-link" viewTransition>
              {earned ? 'See all your rewards' : 'See how points are earned'}
              <Icon name="arrow-right" size={14} />
            </Link>
            {rewards.note ? <p className="rp-quiet">{rewards.note}</p> : null}
          </div>
        </div>
      )}
    </Section>
  );
}
