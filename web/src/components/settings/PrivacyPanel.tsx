import { Link } from 'react-router';
import { ApiError, api } from '../../lib/api.ts';
import { useAppConfig } from '../../lib/config.tsx';
import { useApi } from '../../lib/hooks.ts';
import { ErrorNotice, LoadingNotice } from '../frame/Notices.tsx';
import { Ledger, Stat, StatRow } from '../frame/Ledger.tsx';
import { Section } from '../frame/PageFrame.tsx';

const number = new Intl.NumberFormat();

const SERVER_UNREADABLE = new ApiError(
  0,
  'config_unavailable',
  'Firefly could not read the server’s settings. Check that the server is running, then try again.',
  true,
);

/** Where information lives, what is stored, how to delete it, and how this server is set up. */
export function PrivacyPanel() {
  const { config, loading, error, reload } = useAppConfig();
  const demo = useApi((signal) => api.demo(signal), []);
  const countText = (value: number | undefined) =>
    value !== undefined ? number.format(value) : demo.error ? 'Unavailable' : 'Loading\u2026';

  return (
    <div className="st-panel-body">
      <Section title="Where your information is kept">
        <Ledger
          rows={[
            {
              label: 'In this browser',
              value:
                'Your profile and preferences, your theme, motion and sound choices, the call you are setting up, and an anonymous cookie that links this browser to its practice calls. Signing out of this device removes your profile.',
            },
            {
              label: 'On the Firefly server',
              value:
                'Your practice calls, with their transcripts, coaching reports and mentor scores, are saved on the Firefly server this app talks to, in a database file on the machine that runs it. They are not stored in this browser.',
            },
            {
              label: 'Voice',
              value: (
                <>
                  Firefly never records, keeps or uploads audio. Your browser turns your speech into
                  text.{' '}
                  <Link to="/help#voice" className="text-link">
                    How voice works and your privacy
                  </Link>
                </>
              ),
            },
            {
              label: 'Notices',
              value:
                'Notices stay in this browser, in the bell menu. Nothing is emailed or pushed.',
            },
          ]}
        />
      </Section>

      <Section title="Your practice calls">
        <div className="st-stack">
          <StatRow>
            <Stat label="Practice calls" value={countText(demo.data?.practiceSessions)} />
            <Stat label="Sample calls" value={countText(demo.data?.sampleSessions)} />
          </StatRow>
          <p className="st-lede">
            Deleting a call also deletes its transcript, coaching report and mentor scores. Delete
            one call from History, or reset everything from the Trainer page.
          </p>
          <div className="action-row">
            <Link to="/history" className="action action--quiet" viewTransition>
              Open history
            </Link>
            <Link to="/trainer" className="text-link" viewTransition>
              Delete or reset data on the Trainer page
            </Link>
          </div>
        </div>
      </Section>

      <Section title="Responsible AI">
        <div className="st-stack">
          <p className="st-lede">
            Firefly is a training aid. Feedback can be incomplete or wrong, and scores are for
            practice, not performance assessment. Never enter real customer information.
          </p>
          <div>
            <Link to="/help#responsible-ai" className="text-link">
              Read about responsible AI and data safety
            </Link>
          </div>
        </div>
      </Section>

      <Section title="This Firefly server">
        <div className="st-stack">
          <p className="st-lede">
            Set by whoever runs the server. These values are read-only here.
          </p>
          {loading ? (
            <LoadingNotice label="Loading system details" lines={3} />
          ) : error || !config ? (
            <ErrorNotice
              error={SERVER_UNREADABLE}
              onRetry={reload}
              title="Server settings unavailable"
            />
          ) : (
            <>
              <Ledger
                rows={[
                  { label: 'Version', value: config.app.version },
                  { label: 'Mode', value: config.provider.demo ? 'Demo mode' : 'Live model' },
                  { label: 'Provider', value: config.provider.label },
                  {
                    label: 'Provider type',
                    value: <span className="st-mono">{config.provider.kind}</span>,
                  },
                  ...(config.provider.notice
                    ? [{ label: 'Notice', value: config.provider.notice }]
                    : []),
                  {
                    label: 'Longest message',
                    value: `${number.format(config.limits.maxMessageChars)} characters`,
                  },
                  {
                    label: 'Messages per call',
                    value: `Up to ${number.format(config.limits.maxTraineeTurns)}`,
                  },
                ]}
              />
              {config.features.devDiagnostics || config.features.testHooks ? (
                <p className="st-caution" role="note">
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
              ) : null}
            </>
          )}
        </div>
      </Section>
    </div>
  );
}
