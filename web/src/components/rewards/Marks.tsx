import { useState, type RefObject } from 'react';
import type { RewardsDTO } from '#shared/domain/api.ts';
import { TabRow, tabDomId, tabPanelDomId, type TabItem } from '../frame/index.ts';
import { BadgeItem } from './BadgeItem.tsx';
import { ChallengeItem } from './ChallengeItem.tsx';
import { isBadgeInProgress, type RewardTab } from './rewards-model.ts';
import '../../styles/rewards.css';

const PANEL_PREFIX = 'rw';

/**
 * Badges and challenges as a plate of small engraved marks and rows of text: all of the badges, the
 * ones started but not earned, and the personal challenges, in tabs. `lit` is the set of badges
 * whose marks are having their one lit moment.
 */
export function Marks({
  data,
  lit,
  plateRef,
}: {
  data: Pick<RewardsDTO, 'badges' | 'challenges'>;
  lit: ReadonlySet<string>;
  plateRef: RefObject<HTMLDivElement | null>;
}) {
  const [tab, setTab] = useState<RewardTab>('all');
  const inProgress = data.badges.filter(isBadgeInProgress);
  const tabs: TabItem[] = [
    { id: 'all', label: 'All badges', count: data.badges.length },
    { id: 'progress', label: 'In progress', count: inProgress.length },
    { id: 'challenges', label: 'Challenges', count: data.challenges.length },
  ];

  let panel;
  if (tab === 'challenges') {
    panel =
      data.challenges.length > 0 ? (
        <ul className="rw-challenges">
          {data.challenges.map((challenge) => (
            <ChallengeItem key={challenge.id} challenge={challenge} />
          ))}
        </ul>
      ) : (
        <p className="rw-empty">
          There are no challenges right now. New ones appear as you practise.
        </p>
      );
  } else {
    const badges = tab === 'progress' ? inProgress : data.badges;
    panel =
      badges.length > 0 ? (
        <ul className="rw-badges">
          {badges.map((badge) => (
            <BadgeItem key={badge.id} badge={badge} moment={lit.has(badge.id)} />
          ))}
        </ul>
      ) : (
        <p className="rw-empty">
          Nothing is in progress yet. A badge shows up here once you have made a start on it.
        </p>
      );
  }

  return (
    <div className="rw-marks" ref={plateRef}>
      <h3 className="sr-only">Badges and challenges</h3>
      <TabRow
        label="Badges and challenges"
        tabs={tabs}
        active={tab}
        onChange={(id) => setTab(id as RewardTab)}
        panelId={PANEL_PREFIX}
      />
      <div
        role="tabpanel"
        id={tabPanelDomId(PANEL_PREFIX, tab)}
        aria-labelledby={tabDomId(PANEL_PREFIX, tab)}
        tabIndex={0}
        className="rw-panel"
      >
        {panel}
      </div>
    </div>
  );
}
