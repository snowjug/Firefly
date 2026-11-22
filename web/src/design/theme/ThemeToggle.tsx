import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '../cx.ts';
import { useAnnouncer } from '../primitives/LiveRegion.tsx';
import { SegmentedControl } from '../primitives/SegmentedControl.tsx';
import { useOptionalTheme } from './ThemeProvider.tsx';
import type { ThemePreference } from './theme.ts';
import './theme.css';

// Eight rays, each a short line from the sun's edge outwards, worked out once.
const RAYS = Array.from({ length: 8 }, (_, index) => {
  const angle = (index * Math.PI) / 4;
  const at = (radius: number) => [
    +(12 + Math.cos(angle) * radius).toFixed(2),
    +(12 + Math.sin(angle) * radius).toFixed(2),
  ];
  const [x1, y1] = at(7.4) as [number, number];
  const [x2, y2] = at(9.6) as [number, number];
  return { x1, y1, x2, y2 };
});

/**
 * The theme switch: a sun that turns into a moon. One toggle button (`aria-pressed` says whether
 * the dark theme is on), 44 px square, with a keyboard focus ring like every other control. The
 * morph is a mask sliding over the disc while the rays turn and fade (transform and opacity only),
 * and under reduced motion it is a plain swap. Shown only inside a ThemeProvider.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const theme = useOptionalTheme();
  const maskId = `ff-theme-mask-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  if (!theme) return null;
  const dark = theme.resolved === 'dark';
  return (
    <button
      type="button"
      className={cx('ff-theme-toggle', className)}
      aria-pressed={dark}
      aria-label="Dark theme"
      data-state={dark ? 'dark' : 'light'}
      onClick={theme.toggle}
    >
      <svg
        className="ff-theme-toggle__icon"
        viewBox="0 0 24 24"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <mask id={maskId}>
            <rect width="24" height="24" fill="#fff" />
            <circle className="ff-theme-toggle__cut" cx="17.5" cy="7.5" r="5.6" fill="#000" />
          </mask>
        </defs>
        <g mask={`url(#${maskId})`}>
          <circle className="ff-theme-toggle__core" cx="12" cy="12" r="4.4" />
        </g>
        <g className="ff-theme-toggle__rays">
          {RAYS.map((ray, index) => (
            <line key={index} {...ray} />
          ))}
        </g>
      </svg>
    </button>
  );
}

const OPTIONS: readonly { value: ThemePreference; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
];

/** How long "Saved on this device" stays after a choice. */
const SAVED_MS = 2400;

const CHOICE_NAMES: Record<ThemePreference, string> = {
  light: 'Light theme',
  dark: 'Dark theme',
  system: 'System theme',
};

/**
 * The three-way choice for the footer: Light, Dark or System. A native radio group, so the arrow
 * keys move and select. Choosing confirms itself in words ("Saved on this device"), because the
 * choice is remembered here and nowhere else. Sighted people read the words beside the control; a
 * screen reader hears the same sentence once, through the page's single polite announcer, so there
 * is no second live region.
 */
export function ThemeSelect({ className }: { className?: string }) {
  const theme = useOptionalTheme();
  const announce = useAnnouncer();
  const [saved, setSaved] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    [],
  );
  if (!theme) return null;
  const choose = (next: ThemePreference) => {
    theme.setPreference(next);
    announce(`${CHOICE_NAMES[next]} saved on this device.`);
    setSaved(true);
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = setTimeout(() => setSaved(false), SAVED_MS);
  };
  return (
    <div className={cx('ff-theme-select', className)}>
      <span className="ff-theme-select__label" aria-hidden="true">
        Theme
      </span>
      <SegmentedControl
        legend="Theme"
        hideLegend
        size="small"
        layout="segments"
        options={OPTIONS}
        value={theme.preference}
        onChange={choose}
        className="ff-theme-select__group"
      />
      <span className="ff-theme-select__saved" data-on={saved || undefined} aria-hidden="true">
        Saved on this device
      </span>
    </div>
  );
}
