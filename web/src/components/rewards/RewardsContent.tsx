import { Link } from 'react-router';
import type { RewardsDTO } from '#shared/domain/api.ts';
import { plural } from '../../lib/format.ts';
import { Icon } from '../Icon.tsx';
import { PointsHistory } from './PointsHistory.tsx';
import { RewardTabs } from './RewardTabs.tsx';
import { RewardsSummary } from './RewardsSummary.tsx';
import { LevelsList, RulesList } from './RulesList.tsx';

/** For someone who has not earned anything yet: say how it works and where to start. */
function FirstPoints({ rules }: Pick<RewardsDTO, 'rules'>) {
  const rule = rules.find((r) => r.id === 'complete-scenario');
  return (
    <div className="callout rw-first" role="note">
      <Icon name="spark" size={20} />
      <div className="rw-first-body">
        <p>
          <strong>You have not earned any points yet.</strong> Take a practice call all the way to a
          close and the points for it appear here, each with the reason it was given.
          {rule ? ` Finishing a full scenario earns ${plural(rule.points, 'point')}.` : ''}
        </p>
        <div className="cluster">
          <Link to="/practice" className="btn btn-primary btn-sm" viewTransition>
            Start practice <Icon name="arrow-right" size={16} />
          </Link>
          <a href="#rw-rules-title" className="btn btn-ghost btn-sm">
            See how points work
          </a>
        </div>
      </div>
    </div>
  );
}

/** Everything on the rewards page once the numbers have arrived. */
export function RewardsContent({ data }: { data: RewardsDTO }) {
  return (
    <div className="rw-content">
      {data.points === 0 ? <FirstPoints rules={data.rules} /> : null}

      <section aria-labelledby="rw-summary-title">
        <h2 id="rw-summary-title" className="sr-only">
          Your rewards so far
        </h2>
        <RewardsSummary data={data} />
      </section>

      <RewardTabs data={data} />

      <section className="rw-section" aria-labelledby="rw-rules-title">
        <div className="rw-section-head">
          <h2 id="rw-rules-title" className="t-section">
            How points work
          </h2>
          <p className="t-small t-muted">
            Points come from specific things you do on a call. Each rule says what it pays and the
            safeguard that keeps it fair. Speed and call length earn nothing, and a low score or a
            missed day never takes points away.
          </p>
        </div>
        <RulesList rules={data.rules} />
        <h3 className="rw-subhead">Levels</h3>
        <p className="t-small t-muted rw-levels-intro">
          A level needs both points and different kinds of call, so a pile of points from one kind
          of call is not enough.
        </p>
        <LevelsList levels={data.levels} currentId={data.level.id} />
      </section>

      <section className="rw-section" aria-labelledby="rw-history-title">
        <div className="rw-section-head">
          <h2 id="rw-history-title" className="t-section">
            Points history
          </h2>
          <p className="t-small t-muted">Every award, newest first, with the reason for it.</p>
        </div>
        <PointsHistory ledger={data.ledger} />
      </section>

      <p className="rw-note">
        <Icon name="shield-check" size={18} />
        <span>{data.note}</span>
      </p>
    </div>
  );
}
