import { useState } from 'react';
import { useLocation } from 'react-router';
import { PageFrame, PageHead } from '../components/frame/PageFrame.tsx';
import { TabRow, tabDomId, tabPanelDomId, type TabItem } from '../components/frame/TabRow.tsx';
import { NotificationsPanel } from '../components/settings/NotificationsPanel.tsx';
import { PreferencesPanel } from '../components/settings/PreferencesPanel.tsx';
import { PrivacyPanel } from '../components/settings/PrivacyPanel.tsx';
import { ProfilePanel } from '../components/settings/ProfilePanel.tsx';
import '../styles/settings.css';

const TABS = [
  { id: 'profile', label: 'Profile' },
  { id: 'preferences', label: 'Preferences' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'data', label: 'Data & privacy' },
] as const satisfies readonly TabItem[];

type TabId = (typeof TABS)[number]['id'];

const PREFIX = 'st';

/** A link such as /settings#preferences opens that tab. */
function tabFromHash(hash: string): TabId | null {
  const id = decodeURIComponent(hash.replace(/^#/, ''));
  return TABS.find((tab) => tab.id === id)?.id ?? null;
}

export default function Settings() {
  const { hash } = useLocation();
  const [tab, setTab] = useState<TabId>(() => tabFromHash(hash) ?? 'profile');
  const [seenHash, setSeenHash] = useState(hash);
  if (seenHash !== hash) {
    setSeenHash(hash);
    const linked = tabFromHash(hash);
    if (linked) setTab(linked);
  }

  return (
    <PageFrame title="Settings" className="st-root">
      <PageHead
        eyebrow="06 / Settings"
        title="Settings"
        lead="Your profile and preferences are saved in this browser only. Nothing you change here is sent anywhere."
      />
      <div className="st-tabs">
        <TabRow
          label="Settings sections"
          tabs={TABS}
          active={tab}
          onChange={(id) => setTab(tabFromHash(id) ?? 'profile')}
          panelId={PREFIX}
        />
      </div>
      {TABS.map((item) => (
        <div
          key={item.id}
          role="tabpanel"
          id={tabPanelDomId(PREFIX, item.id)}
          aria-labelledby={tabDomId(PREFIX, item.id)}
          hidden={item.id !== tab}
          className="st-panel"
        >
          {item.id !== tab ? null : item.id === 'profile' ? (
            <ProfilePanel />
          ) : item.id === 'preferences' ? (
            <PreferencesPanel />
          ) : item.id === 'notifications' ? (
            <NotificationsPanel />
          ) : (
            <PrivacyPanel />
          )}
        </div>
      ))}
    </PageFrame>
  );
}
