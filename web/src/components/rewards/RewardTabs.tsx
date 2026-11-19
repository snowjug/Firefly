import { useState } from 'react';
import type { RewardsDTO } from '#shared/domain/api.ts';
import { Tabs, panelId, tabId, type TabDef } from '../ui/Tabs.tsx';
import { BadgeCard } from './BadgeCard.tsx';
import { ChallengeCard } from './ChallengeCard.tsx';
import { isBadgeInProgress, type RewardTab } from './rewards-model.ts';

const PREFIX = 'rw';

/** All badges, the ones started but not earned, and the personal challenges. */
export function RewardTabs({ data }: { data: Pick<RewardsDTO, 'badges' | 'challenges'> }) {
  const [tab, setTab] = useState<RewardTab>('all');
  const inProgress = data.badges.filter(isBadgeInProgress);
  const tabs: TabDef[] = [
    { id: 'all', label: 'All badges', count: data.badges.length },
    { id: 'progress', label: 'In progress', count: inProgress.length },
    { id: 'challenges', label: 'Challenges', count: data.challenges.length },
  ];

  let panel;
  if (tab === 'challenges') {
    panel =
      data.challenges.length > 0 ? (
        <ul role="list" className="rw-challenges">
          {data.challenges.map((challenge) => (
            <ChallengeCard key={challenge.id} challenge={challenge} />
          ))}
        </ul>
      ) : (
        <p className="glass rw-empty">
          There are no challenges right now. New ones appear as you practise.
        </p>
      );
  } else {
    const badges = tab === 'progress' ? inProgress : data.badges;
    panel =
      badges.length > 0 ? (
        <ul role="list" className="rw-badges">
          {badges.map((badge) => (
            <BadgeCard key={badge.id} badge={badge} />
          ))}
        </ul>
      ) : (
        <p className="glass rw-empty">
          Nothing is in progress yet. A badge shows up here once you have made a start on it.
        </p>
      );
  }

  return (
    <div className="rw-tabs">
      <h2 className="sr-only">Badges and challenges</h2>
      <Tabs
        tabs={tabs}
        value={tab}
        onChange={(id) => setTab(id as RewardTab)}
        label="Badges and challenges"
        prefix={PREFIX}
      />
      <div
        role="tabpanel"
        id={panelId(PREFIX, tab)}
        aria-labelledby={tabId(PREFIX, tab)}
        tabIndex={0}
        className="rw-panel"
      >
        {panel}
      </div>
    </div>
  );
}
