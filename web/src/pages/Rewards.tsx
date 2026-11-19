import { ErrorState, Page, PageHeader } from '../components/Page.tsx';
import { RewardsContent } from '../components/rewards/RewardsContent.tsx';
import { RewardsSkeleton } from '../components/rewards/RewardsSkeleton.tsx';
import { api } from '../lib/api.ts';
import { useApi } from '../lib/hooks.ts';
import '../styles/rewards.css';

/**
 * Points, badges and challenges for practising. Everything shown is worked out by the server from
 * saved practice, so nothing here is estimated, ranked or compared with anyone.
 */
export default function Rewards() {
  // "Today" for a streak is the learner's own day, so the browser's offset goes with the request.
  const rewards = useApi((signal) => api.rewards(new Date().getTimezoneOffset(), signal), []);
  const { data } = rewards;

  return (
    <Page title="Rewards" className="rw">
      <PageHeader
        title="Rewards"
        lead="Points and badges for practising. They are encouragement, not a score or a ranking."
      />
      {data ? (
        <RewardsContent data={data} />
      ) : rewards.error ? (
        <ErrorState
          error={rewards.error}
          onRetry={rewards.reload}
          title="We could not load your rewards"
        />
      ) : (
        <RewardsSkeleton />
      )}
    </Page>
  );
}
