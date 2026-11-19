import { useState } from 'react';
import { Page, PageHeader } from '../components/Page.tsx';
import { NotificationsPanel } from '../components/settings/NotificationsPanel.tsx';
import { PreferencesPanel } from '../components/settings/PreferencesPanel.tsx';
import { PrivacyPanel } from '../components/settings/PrivacyPanel.tsx';
import { ProfileCard } from '../components/settings/ProfileCard.tsx';
import { Tabs, panelId, tabId, type TabDef } from '../components/ui/Tabs.tsx';
import '../styles/settings.css';

const TABS: readonly TabDef[] = [
  { id: 'preferences', label: 'Preferences' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'data', label: 'Data & privacy' },
];

const PREFIX = 'st';

export default function Settings() {
  const [tab, setTab] = useState(TABS[0]?.id ?? 'preferences');

  return (
    <Page title="Settings" className="st-root">
      <PageHeader title="Profile & settings" lead="Manage your profile and preferences." />

      <div className="st-grid">
        <ProfileCard />

        <section className="glass st-settings" aria-labelledby="st-settings-title">
          <h2 id="st-settings-title" className="sr-only">
            Settings
          </h2>
          <div className="st-tabs">
            <Tabs
              tabs={TABS}
              value={tab}
              onChange={setTab}
              label="Settings sections"
              prefix={PREFIX}
            />
          </div>
          {TABS.map((item) => (
            <div
              key={item.id}
              role="tabpanel"
              id={panelId(PREFIX, item.id)}
              aria-labelledby={tabId(PREFIX, item.id)}
              hidden={item.id !== tab}
              className="st-panel"
            >
              {item.id !== tab ? null : item.id === 'preferences' ? (
                <PreferencesPanel />
              ) : item.id === 'notifications' ? (
                <NotificationsPanel />
              ) : (
                <PrivacyPanel />
              )}
            </div>
          ))}
        </section>
      </div>
    </Page>
  );
}
