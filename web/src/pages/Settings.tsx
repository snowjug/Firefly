import { Link } from 'react-router';
import { Icon } from '../components/Icon.tsx';
import { Page, PageHeader, SkeletonBlock } from '../components/Page.tsx';
import { SegmentedChoice } from '../components/trainer/SegmentedChoice.tsx';
import { api } from '../lib/api.ts';
import { useAppConfig } from '../lib/config.tsx';
import { useApi } from '../lib/hooks.ts';
import { useTheme, type MotionPreference, type ThemePreference } from '../lib/theme.tsx';
import '../styles/settings.css';

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

const MOTION_OPTIONS: { value: MotionPreference; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'reduce', label: 'On' },
  { value: 'full', label: 'Off' },
];

const number = new Intl.NumberFormat();

function themeStatus(theme: ThemePreference, resolved: 'light' | 'dark'): string {
  return theme === 'system'
    ? `Following your device: using the ${resolved} theme.`
    : `Using the ${resolved} theme.`;
}

function motionStatus(motion: MotionPreference, reduced: boolean): string {
  if (motion === 'reduce') return 'Animation and transitions are reduced.';
  if (motion === 'full')
    return 'Firefly uses its standard animation unless your device asks for less.';
  return reduced
    ? 'Your device asks for reduced motion, so animation is reduced.'
    : 'Your device does not ask for reduced motion, so Firefly uses its standard animation.';
}

export default function Settings() {
  const { theme, setTheme, motion, setMotion, reducedMotion, resolvedTheme } = useTheme();
  const { config, loading, error, reload } = useAppConfig();
  const demo = useApi((signal) => api.demo(signal), []);
  const countText = (value: number | undefined) =>
    value !== undefined ? number.format(value) : demo.error ? 'Unavailable' : 'Loading\u2026';

  return (
    <Page title="Settings" width="narrow">
      <PageHeader
        eyebrow="Preferences"
        title="Settings"
        lead="Display preferences for this browser, and a read-only view of how this Firefly server is set up."
      />

      <div className="st-layout">
        <section className="glass card st-card" aria-labelledby="st-appearance">
          <div>
            <h2 id="st-appearance" className="t-section">
              Appearance
            </h2>
            <p className="t-small t-muted">
              Saved in this browser and applied straight away. No reload needed.
            </p>
          </div>
          <div className="st-group">
            <SegmentedChoice<ThemePreference>
              legend="Theme"
              value={theme}
              options={THEME_OPTIONS}
              onChange={(next) => setTheme(next)}
              hint="System follows your device. Light and Dark stay as you set them."
            />
            <p role="status" className="st-status">
              {themeStatus(theme, resolvedTheme)}
            </p>
          </div>
          <div className="st-group">
            <SegmentedChoice<MotionPreference>
              legend="Reduce motion"
              value={motion}
              options={MOTION_OPTIONS}
              onChange={(next) => setMotion(next)}
              hint="System follows your device. On turns off most animation and transitions. Off keeps Firefly's standard motion unless your device asks apps to reduce it."
            />
            <p role="status" className="st-status">
              {motionStatus(motion, reducedMotion)}
            </p>
          </div>
        </section>

        <section className="glass card st-card" aria-labelledby="st-data">
          <div>
            <h2 id="st-data" className="t-section">
              Your data
            </h2>
            <p className="t-small t-muted">
              Practice data is stored in a database file on the machine that runs Firefly&rsquo;s
              server, not in this browser. This browser keeps only your display preferences, the
              call you are setting up, and an anonymous cookie that links it to its sessions.
            </p>
          </div>
          <dl className="st-list">
            <div>
              <dt>Practice sessions</dt>
              <dd className="tabular">{countText(demo.data?.practiceSessions)}</dd>
            </div>
            <div>
              <dt>Sample sessions</dt>
              <dd className="tabular">{countText(demo.data?.sampleSessions)}</dd>
            </div>
          </dl>
          <div>
            <Link to="/trainer" className="btn btn-secondary" viewTransition>
              Delete or reset data on the Trainer page
            </Link>
          </div>
        </section>

        <section className="glass card st-card" aria-labelledby="st-system">
          <div>
            <h2 id="st-system" className="t-section">
              System
            </h2>
            <p className="t-small t-muted">
              Set by whoever runs the server. These values are read-only here.
            </p>
          </div>
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
        </section>
      </div>
    </Page>
  );
}
