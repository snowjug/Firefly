import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { api } from '../../lib/api.ts';
import { useAppConfig } from '../../lib/config.tsx';
import { useApi } from '../../lib/hooks.ts';
import { Icon, type IconName } from '../Icon.tsx';
import { SkeletonBlock } from '../Page.tsx';
import { SettingGroup } from './SettingRows.tsx';

const number = new Intl.NumberFormat();

const WHERE: readonly { icon: IconName; title: string; text: ReactNode }[] = [
  {
    icon: 'user',
    title: 'In this browser',
    text: 'Your profile and preferences, your theme, motion and sound choices, the call you are setting up, and an anonymous cookie that links this browser to its practice calls. Signing out of this device removes your profile.',
  },
  {
    icon: 'database',
    title: 'On the Firefly server',
    text: 'Your practice calls, with their transcripts, coaching reports and mentor scores, are saved on the Firefly server this app talks to, in a database file on the machine that runs it. They are not stored in this browser.',
  },
  {
    icon: 'mic',
    title: 'Voice',
    text: (
      <>
        Firefly never records, keeps or uploads audio. Your browser turns your speech into text.{' '}
        <Link to="/help#voice">How voice works and your privacy</Link>
      </>
    ),
  },
  {
    icon: 'bell',
    title: 'Notices',
    text: 'Notices stay in this browser, in the bell menu. Nothing is emailed or pushed.',
  },
];

/** Where information lives, what is stored, how to delete it, and how this server is set up. */
export function PrivacyPanel() {
  const { config, loading, error, reload } = useAppConfig();
  const demo = useApi((signal) => api.demo(signal), []);
  const countText = (value: number | undefined) =>
    value !== undefined ? number.format(value) : demo.error ? 'Unavailable' : 'Loading\u2026';

  return (
    <div className="st-panel-body">
      <SettingGroup id="st-group-where" title="Where your information is kept">
        <ul role="list" className="st-where">
          {WHERE.map((item) => (
            <li key={item.title}>
              <span className="tone-icon" data-tone="blue" aria-hidden="true">
                <Icon name={item.icon} size={18} />
              </span>
              <div>
                <p className="st-where-title">{item.title}</p>
                <p className="t-small t-muted">{item.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </SettingGroup>

      <SettingGroup id="st-group-calls" title="Your practice calls">
        <dl className="st-list">
          <div>
            <dt>Practice calls</dt>
            <dd className="tabular">{countText(demo.data?.practiceSessions)}</dd>
          </div>
          <div>
            <dt>Sample calls</dt>
            <dd className="tabular">{countText(demo.data?.sampleSessions)}</dd>
          </div>
        </dl>
        <p className="t-small t-muted">
          Deleting a call also deletes its transcript, coaching report and mentor scores. Delete one
          call from History, or reset everything from the Trainer page.
        </p>
        <div className="cluster">
          <Link to="/history" className="btn btn-secondary" viewTransition>
            Open history
          </Link>
          <Link to="/trainer" className="btn btn-secondary" viewTransition>
            Delete or reset data on the Trainer page
          </Link>
        </div>
      </SettingGroup>

      <SettingGroup id="st-group-ai" title="Responsible AI">
        <p className="t-small t-muted">
          Firefly is a training aid. Feedback can be incomplete or wrong, and scores are for
          practice, not performance assessment. Never enter real customer information.
        </p>
        <div>
          <Link to="/help#responsible-ai" className="link-more">
            Read about responsible AI and data safety <Icon name="arrow-right" size={16} />
          </Link>
        </div>
      </SettingGroup>

      <SettingGroup id="st-group-server" title="This Firefly server">
        <p className="t-small t-muted">
          Set by whoever runs the server. These values are read-only here.
        </p>
        {loading ? (
          <div className="stack" role="status" aria-label="Loading system details">
            <SkeletonBlock height={20} />
            <SkeletonBlock height={20} width="70%" />
            <SkeletonBlock height={20} width="85%" />
          </div>
        ) : error || !config ? (
          <div className="callout callout-negative" role="alert">
            <Icon name="alert" size={18} />
            <div className="stack" style={{ ['--stack-gap' as string]: 'var(--sp-3)' }}>
              <p>
                Firefly could not read the server&rsquo;s settings. Check that the server is
                running, then try again.
              </p>
              <div>
                <button type="button" className="btn btn-secondary btn-sm" onClick={reload}>
                  <Icon name="refresh" size={16} /> Try again
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            <dl className="st-list">
              <div>
                <dt>Version</dt>
                <dd>{config.app.version}</dd>
              </div>
              <div>
                <dt>Mode</dt>
                <dd>{config.provider.demo ? 'Demo mode' : 'Live model'}</dd>
              </div>
              <div>
                <dt>Provider</dt>
                <dd>{config.provider.label}</dd>
              </div>
              <div>
                <dt>Provider type</dt>
                <dd className="mono">{config.provider.kind}</dd>
              </div>
              {config.provider.notice ? (
                <div>
                  <dt>Notice</dt>
                  <dd>{config.provider.notice}</dd>
                </div>
              ) : null}
              <div>
                <dt>Longest message</dt>
                <dd className="tabular">
                  {number.format(config.limits.maxMessageChars)} characters
                </dd>
              </div>
              <div>
                <dt>Messages per call</dt>
                <dd className="tabular">Up to {number.format(config.limits.maxTraineeTurns)}</dd>
              </div>
            </dl>
            {config.features.devDiagnostics || config.features.testHooks ? (
              <div className="callout callout-caution">
                <Icon name="alert" size={18} />
                <p>
                  Developer features are switched on for this server (
                  {[
                    config.features.devDiagnostics ? 'diagnostics' : null,
                    config.features.testHooks ? 'test hooks' : null,
                  ]
                    .filter(Boolean)
                    .join(' and ')}
                  ). They are for development and automated tests only, and diagnostics can reveal
                  what a scenario holds back, so keep them off for a real demo.
                </p>
              </div>
            ) : null}
          </>
        )}
      </SettingGroup>
    </div>
  );
}
