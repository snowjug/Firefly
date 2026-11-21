import { useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router';
import type { RewardsDTO, SessionSummaryDTO } from '#shared/domain/api.ts';
import { api } from '../../lib/api.ts';
import { useApi } from '../../lib/hooks.ts';
import { readStorage, writeStorage } from '../../lib/storage.ts';
import { usePreferences } from '../../lib/profile.ts';
import { Icon, type IconName } from '../Icon.tsx';
import { usePopover } from './usePopover.ts';

// Notices are derived from what is saved (a finished call whose coaching report is ready, a badge
// that was earned) and are shown here only. Nothing is sent anywhere. "Seen" is a timestamp kept on
// this device.

const SEEN_KEY = 'firefly.notifications.seen';

export interface Notice {
  id: string;
  kind: 'report' | 'badge';
  icon: IconName;
  title: string;
  detail: string;
  to: string;
  at: string;
}

export function noticesFrom(sessions: readonly SessionSummaryDTO[]): Notice[] {
  const notices: Notice[] = [];
  for (const session of sessions) {
    if (session.isSample || !session.endedAt) continue;
    if (session.status === 'completed') {
      notices.push({
        id: `report-${session.id}`,
        kind: 'report',
        icon: 'file-text',
        title: 'Your coaching report is ready',
        detail: session.scenarioTitle,
        to: `/sessions/${session.id}/report`,
        at: session.endedAt,
      });
    } else if (session.status === 'evaluation_failed') {
      notices.push({
        id: `retry-${session.id}`,
        kind: 'report',
        icon: 'alert',
        title: 'A report needs another try',
        detail: session.scenarioTitle,
        to: `/sessions/${session.id}/report`,
        at: session.endedAt,
      });
    }
  }
  return notices;
}

export function badgeNoticesFrom(rewards: RewardsDTO | null | undefined): Notice[] {
  return (rewards?.badges ?? [])
    .filter((badge) => badge.earned && badge.earnedAt)
    .map((badge) => ({
      id: `badge-${badge.id}`,
      kind: 'badge' as const,
      icon: 'award' as const,
      title: `You earned the ${badge.title} badge`,
      detail: badge.criteria,
      to: '/rewards',
      at: badge.earnedAt as string,
    }));
}

function when(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function NotificationsMenu() {
  const { pathname } = useLocation();
  const prefs = usePreferences();
  const { open, setOpen, toggle, wrapRef, triggerRef, onBlur } = usePopover();
  const [refresh, setRefresh] = useState(0);
  // Async loaders turn any failure (offline, an unexpected response) into a quiet "no notices".
  const sessions = useApi(
    async (signal) => api.listSessions({ limit: 10, includeSamples: false }, signal),
    [pathname, refresh],
  );
  const rewards = useApi(
    async (signal) => api.rewards(new Date().getTimezoneOffset(), signal),
    [pathname, refresh],
  );

  const notices = useMemo(
    () =>
      [
        ...(prefs.notifyReports ? noticesFrom(sessions.data?.sessions ?? []) : []),
        ...(prefs.notifyBadges ? badgeNoticesFrom(rewards.data) : []),
      ].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0)),
    [sessions.data, rewards.data, prefs.notifyReports, prefs.notifyBadges],
  );

  // The first time the app runs here there is no history to catch up on: start from now.
  const [seenAt, setSeenAt] = useState<string>(() => {
    const stored = readStorage<string | null>(SEEN_KEY, null);
    if (stored) return stored;
    const now = new Date().toISOString();
    writeStorage(SEEN_KEY, now);
    return now;
  });
  const unread = notices.filter((notice) => notice.at > seenAt);

  // What counted as new when the list was opened stays marked while it is open.
  const [newIds, setNewIds] = useState<ReadonlySet<string>>(() => new Set());
  const onToggle = () => {
    if (!open) {
      setRefresh((n) => n + 1);
      setNewIds(new Set(unread.map((notice) => notice.id)));
      const latest = notices[0]?.at;
      if (latest && latest > seenAt) {
        writeStorage(SEEN_KEY, latest);
        setSeenAt(latest);
      }
    }
    toggle();
  };

  return (
    <div className="flyout-wrap" ref={wrapRef} onBlur={onBlur}>
      <button
        ref={triggerRef}
        type="button"
        className="util"
        title="Notifications"
        aria-expanded={open}
        aria-controls="notifications-panel"
        aria-label={unread.length > 0 ? `Notifications, ${unread.length} new` : 'Notifications'}
        onClick={onToggle}
      >
        <Icon name="bell" size={18} />
        {unread.length > 0 ? <span className="util__dot" aria-hidden="true" /> : null}
      </button>
      {open ? (
        <div
          className="flyout glass glass--inspector"
          id="notifications-panel"
          role="region"
          aria-label="Notifications"
        >
          <div className="flyout__head">
            <h2 className="flyout__title">Notifications</h2>
            <Link to="/settings" className="text-link" onClick={() => setOpen(false)}>
              Settings
            </Link>
          </div>
          {notices.length === 0 ? (
            <p className="flyout__empty">
              Nothing new. When a coaching report is ready or you earn a badge, it shows up here.
            </p>
          ) : (
            <ul role="list" className="flyout__list">
              {notices.map((notice) => (
                <li key={notice.id}>
                  <Link to={notice.to} className="flyout__item" onClick={() => setOpen(false)}>
                    <Icon name={notice.icon} size={16} />
                    <span className="flyout__text">
                      <strong className="flyout__strong">
                        {notice.title}
                        {newIds.has(notice.id) ? <span className="flyout__new">New</span> : null}
                      </strong>
                      <span className="flyout__meta">
                        {notice.detail} · {when(notice.at)}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
