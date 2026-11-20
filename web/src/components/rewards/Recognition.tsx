import { useRef } from 'react';
import { Link } from 'react-router';
import type { RewardsDTO } from '#shared/domain/api.ts';
import { plural } from '../../lib/format.ts';
import type { AsyncState } from '../../lib/hooks.ts';
import { Icon } from '../Icon.tsx';
import { ErrorNotice, LoadingNotice, Section } from '../frame/index.ts';
import { Marks } from './Marks.tsx';
import { PointsHistory } from './PointsHistory.tsx';
import { RulesBlock } from './Rules.tsx';
import { Standing } from './Standing.tsx';
import { useEarnedMoment } from './useEarnedMoment.ts';
import '../../styles/rewards.css';

/** For someone who has not earned anything yet: say how it works and where to start. */
function FirstPoints({ rules }: Pick<RewardsDTO, 'rules'>) {
  const rule = rules.find((r) => r.id === 'complete-scenario');
  return (
    <div className="rw-first" role="note">
      <p>
        <strong>You have not earned any points yet.</strong> Take a practice call all the way to a
        close and the points for it appear here, each with the reason it was given.
        {rule ? ` Finishing a full scenario earns ${plural(rule.points, 'point')}.` : ''}
      </p>
      <div className="action-row">
        <Link to="/practice" className="action" viewTransition>
          Start practice
          <Icon name="arrow-right" size={18} />
        </Link>
        <a href="#rw-rules-title" className="text-link">
          See how points work
        </a>
      </div>
    </div>
  );
}

function RecognitionBody({ data }: { data: RewardsDTO }) {
  const plate = useRef<HTMLDivElement>(null);
  const moment = useEarnedMoment(data, plate);
  return (
    <>
      <p className="rw-lead">
        Points and badges for practising. They are encouragement, not a score or a ranking.
      </p>
      {data.points === 0 ? <FirstPoints rules={data.rules} /> : null}
      <div className="rw-grid">
        <Standing data={data} />
        <Marks data={data} lit={moment.lit} plateRef={plate} />
      </div>
      <p role="status" className="sr-only">
        {moment.announcement}
      </p>

      <RulesBlock rules={data.rules} levels={data.levels} currentId={data.level.id} />

      <section className="rw-block" aria-labelledby="rw-history-title">
        <div className="rw-block__aside">
          <h3 id="rw-history-title" className="rw-block__title">
            Points history
          </h3>
          <p className="rw-block__lead">Every award, newest first, with the reason for it.</p>
        </div>
        <div className="rw-block__main">
          <PointsHistory ledger={data.ledger} />
        </div>
      </section>

      <p className="rw-note">{data.note}</p>
    </>
  );
}

/**
 * Points, badges, challenges and the rules behind them, below the sky. Everything shown is worked
 * out by the server from saved practice, so nothing here is estimated, ranked or compared with
 * anyone. It loads on its own, so a failure here never takes the sky with it.
 */
export function Recognition({ rewards }: { rewards: AsyncState<RewardsDTO> }) {
  const { data } = rewards;
  return (
    <Section id="recognition" title="Recognition" eyebrow="Points, badges and challenges">
      <div className="rw">
        {data ? (
          <RecognitionBody data={data} />
        ) : rewards.error ? (
          <ErrorNotice
            error={rewards.error}
            onRetry={rewards.reload}
            title="We could not load your rewards"
          />
        ) : (
          <LoadingNotice label="Loading your rewards" lines={5} />
        )}
      </div>
    </Section>
  );
}
