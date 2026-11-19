import { useEffect } from 'react';
import { Link } from 'react-router';
import type { BadgeDTO, LedgerEntryDTO, RewardsDTO, SessionDTO } from '#shared/domain/api.ts';
import type { CoachingReport } from '#shared/domain/report.ts';
import { api } from '../../lib/api.ts';
import { useApi } from '../../lib/hooks.ts';
import { play } from '../../lib/sound.ts';
import { Icon } from '../Icon.tsx';
import { SkeletonBlock } from '../Page.tsx';
import { EvidenceQuote } from './EvidenceQuote.tsx';
import { SectionHead } from './SectionHead.tsx';
import { noPointsReason, transcriptHref } from './labels.ts';

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
      <div className="rp-rewards-total">
        <span className="rp-points-mark" aria-hidden="true">
          <Icon name="trophy" size={22} />
        </span>
        <div>
          <p className="rp-rewards-headline">
            You earned {points} {points === 1 ? 'point' : 'points'} from this call
          </p>
          <p className="t-small t-muted">Every award below says why it was given.</p>
        </div>
      </div>

      {entries.length > 0 ? (
        <ul role="list" className="rp-ledger">
          {entries.map((entry) => (
            <li key={entry.id} className="rp-ledger-item">
              <span className="chip chip-amber rp-ledger-points">
                <span className="sr-only">Points: </span>+{entry.points}
              </span>
              <div className="rp-ledger-body">
                <p className="rp-ledger-title">{entry.title}</p>
                <p className="t-small t-muted">{entry.reason}</p>
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
              <span className="rp-points-mark" aria-hidden="true">
                <Icon name="award" size={22} />
              </span>
              <div>
                <p className="rp-ledger-title">Badge earned: {badge.title}</p>
                <p className="t-small t-muted">{badge.criteria}</p>
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
}: {
  session: Pick<SessionDTO, 'id' | 'isSample'>;
  completion: CoachingReport['completion'];
  rewards: SessionRewards;
  /** Arriving straight from the call: a short sound, if the person turned sound on. */
  celebrate: boolean;
}) {
  const earned = rewards.points > 0 || rewards.badges.length > 0;
  useEffect(() => {
    if (celebrate && rewards.phase === 'ready' && earned) play('earned');
  }, [celebrate, rewards.phase, earned]);

  if (rewards.phase === 'hidden') return null;
  const loading = rewards.phase === 'loading';
  return (
    <section
      id="rewards"
      className="rp-section"
      aria-labelledby="rewards-title"
      aria-busy={loading ? 'true' : undefined}
    >
      <SectionHead id="rewards-title" title="Rewards from this call">
        Points encourage practice, and each one comes with the reason it was given.
      </SectionHead>
      {loading ? (
        <div
          className="glass card stack"
          role="status"
          aria-label="Checking what this call earned"
          style={{ ['--stack-gap' as string]: 'var(--sp-3)' }}
        >
          <SkeletonBlock height={22} width="45%" />
          <SkeletonBlock height={14} />
          <SkeletonBlock height={14} width="70%" />
        </div>
      ) : (
        <div className="glass card rp-rewards" data-earned={earned ? 'true' : 'false'}>
          {earned ? (
            <Earned sessionId={session.id} rewards={rewards} />
          ) : (
            <div className="rp-rewards-none">
              <span className="tone-icon" data-tone="blue" aria-hidden="true">
                <Icon name="info" size={20} />
              </span>
              <p>{noPointsReason(session, completion)}</p>
            </div>
          )}
          <div className="rp-rewards-foot">
            <Link to="/rewards" className="link-more" viewTransition>
              {earned ? 'See all your rewards' : 'See how points are earned'}
              <Icon name="arrow-right" size={16} />
            </Link>
            {rewards.note ? <p className="t-meta">{rewards.note}</p> : null}
          </div>
        </div>
      )}
    </section>
  );
}
