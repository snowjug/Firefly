import { updatePreferences, usePreferences, useProfile } from '../../lib/profile.ts';
import { useToast } from '../../lib/toast.tsx';
import { Section } from '../frame/PageFrame.tsx';
import { Toggle } from '../frame/Toggle.tsx';

const NEEDS_PROFILE = 'Create your profile first.';

/** What the bell menu may tell you. Notices are worked out from your saved practice, in this app only. */
export function NotificationsPanel() {
  const locked = useProfile() === null;
  const preferences = usePreferences();
  const { toast } = useToast();
  const saved = (title: string) => toast({ tone: 'positive', title, durationMs: 3000 });
  const lockedNote = locked ? (
    <>
      {' '}
      <strong className="st-locked">{NEEDS_PROFILE}</strong>
    </>
  ) : null;

  return (
    <div className="st-panel-body">
      <Section title="Notices in the bell menu">
        <div className="st-stack">
          <p className="st-lede">
            Notices appear in the bell menu in this app only. Nothing is emailed or pushed.
          </p>
          <div className="ff-rows">
            <Toggle
              id="st-notify-reports"
              label="Tell me when a coaching report is ready"
              hint={
                <>
                  A notice appears after a call, once its coaching report has been built.
                  {lockedNote}
                </>
              }
              checked={preferences.notifyReports}
              disabled={locked}
              onChange={(on) => {
                updatePreferences({ notifyReports: on });
                saved(
                  on ? 'You will see a notice when a report is ready.' : 'Report notices are off.',
                );
              }}
            />
            <Toggle
              id="st-notify-badges"
              label="Tell me when I earn a badge"
              hint={
                <>
                  A notice appears when a call earns you a badge.
                  {lockedNote}
                </>
              }
              checked={preferences.notifyBadges}
              disabled={locked}
              onChange={(on) => {
                updatePreferences({ notifyBadges: on });
                saved(
                  on ? 'You will see a notice when you earn a badge.' : 'Badge notices are off.',
                );
              }}
            />
          </div>
        </div>
      </Section>
    </div>
  );
}
