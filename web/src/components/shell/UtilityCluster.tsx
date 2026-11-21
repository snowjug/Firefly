import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useAmbient } from '../../lib/motion/ambient.tsx';
import { useReducedMotion, useTheme } from '../../lib/theme.tsx';
import { Icon } from '../Icon.tsx';
import { AmbientGlyph } from './AmbientGlyph.tsx';
import { NotificationsMenu } from './NotificationsMenu.tsx';
import { ProfileMenu } from './ProfileMenu.tsx';

const FORCED_NOTE =
  'Ambient motion is already off because reduced motion is on. You can change that in Settings.';

function shortcutLabel(): string {
  const platform =
    (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ??
    navigator.platform ??
    '';
  return /mac|iphone|ipad/i.test(platform) ? '\u2318K' : 'Ctrl K';
}

/** Half the disc is filled: the lit half turns over when the theme does. */
function ThemeGlyph({ dark }: { dark: boolean }) {
  return (
    <svg
      className="util__glyph"
      data-dark={dark ? 'true' : 'false'}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor" />
    </svg>
  );
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const next = resolvedTheme === 'dark' ? 'light' : 'dark';
  return (
    <button
      type="button"
      className="util"
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
      onClick={() => setTheme(next)}
    >
      <ThemeGlyph dark={resolvedTheme === 'dark'} />
    </button>
  );
}

/**
 * The always-reachable pause for anything that moves on its own (WCAG 2.2.2). The name stays the
 * same and the pressed state carries the rest, so a screen reader hears "Pause ambient motion,
 * pressed" when it is paused. Reduced motion forces the pause, and the button then says why.
 */
function AmbientToggle({ announce }: { announce: (message: string) => void }) {
  const { paused, forced, toggle } = useAmbient();
  return (
    <>
      <button
        type="button"
        className="util"
        aria-pressed={paused}
        aria-disabled={forced || undefined}
        aria-describedby={forced ? 'ambient-forced-note' : undefined}
        aria-label="Pause ambient motion"
        title={forced ? FORCED_NOTE : paused ? 'Resume ambient motion' : 'Pause ambient motion'}
        onClick={() => {
          if (forced) {
            announce(FORCED_NOTE);
            return;
          }
          announce(paused ? 'Ambient motion resumed.' : 'Ambient motion paused.');
          toggle();
        }}
      >
        <AmbientGlyph paused={paused} />
      </button>
      {forced ? (
        <span id="ambient-forced-note" className="sr-only">
          {FORCED_NOTE}
        </span>
      ) : null}
    </>
  );
}

/**
 * Small, no boxes: search and commands, the display toggles, notices, the account and help. The
 * public pages get only the display toggles. A live region says what a toggle just did.
 */
export function UtilityCluster({
  variant = 'full',
  onOpenPalette,
}: {
  variant?: 'full' | 'display';
  onOpenPalette?: () => void;
}) {
  const reduced = useReducedMotion();
  const [status, setStatus] = useState('');
  useEffect(() => {
    if (!status) return;
    const timer = window.setTimeout(() => setStatus(''), 4500);
    return () => window.clearTimeout(timer);
  }, [status]);

  return (
    <div className="utilities" role="group" aria-label="Tools">
      {variant === 'full' ? (
        <button
          type="button"
          className="util util--search"
          aria-keyshortcuts="Control+K Meta+K"
          onClick={onOpenPalette}
        >
          <Icon name="search" size={16} />
          <span className="sr-only">Search and commands</span>
          <span className="util__label" aria-hidden="true">
            Search
          </span>
          <kbd className="util__keys" aria-hidden="true">
            {shortcutLabel()}
          </kbd>
        </button>
      ) : null}
      <ThemeToggle />
      <AmbientToggle announce={setStatus} />
      {variant === 'full' ? (
        <>
          <NotificationsMenu />
          <ProfileMenu />
          <Link
            to="/help"
            className="util util--help"
            aria-label="Help and Responsible AI"
            title="Help and Responsible AI"
            viewTransition={!reduced}
          >
            <Icon name="help" size={18} />
          </Link>
        </>
      ) : null}
      <p className="utilities__status" role="status">
        {status}
      </p>
    </div>
  );
}
