import type { ReactNode, SVGProps } from 'react';
import './icons.css';

// A small hand-drawn icon set: 24 px grid, 1.5 stroke, round caps and joins, the current text colour.
// Nothing here is copied from an icon library. The customer-state icons are different SHAPES (a
// check, a wave, a slanted line, a zigzag, a solid triangle, a falling arrow), so a state is never
// told apart by colour alone.

const Dot = ({ x, y, r = 1 }: { x: number; y: number; r?: number }) => (
  <circle cx={x} cy={y} r={r} fill="currentColor" stroke="none" />
);

const Ring = () => <circle cx="12" cy="12" r="9.25" />;

const CheckCircle = (
  <>
    <Ring />
    <path d="M7.8 12.4l3 3 5.4-6" />
  </>
);

const SHAPES = {
  // ---- Voice and call -----------------------------------------------------------------------
  microphone: (
    <>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7" />
    </>
  ),
  'microphone-off': (
    <>
      <path d="M9 6.5V6a3 3 0 0 1 6 0v5a3 3 0 0 1-.27 1.25" />
      <path d="M5.5 11a6.5 6.5 0 0 0 9 6M18.5 11a6.5 6.5 0 0 1-1.23 3.8M12 17.5V21M8.5 21h7" />
      <path d="M4 4l16 16" />
    </>
  ),
  speaker: (
    <>
      <path d="M4 9.5h3l4.5-3.75v12.5L7 14.5H4z" />
      <path d="M15 9.25a4 4 0 0 1 0 5.5M17.75 6.5a8 8 0 0 1 0 11" />
    </>
  ),
  'speaker-off': (
    <>
      <path d="M4 9.5h3l4.5-3.75v12.5L7 14.5H4z" />
      <path d="M15.5 9.5l5 5M20.5 9.5l-5 5" />
    </>
  ),
  'phone-end': (
    <path d="M3.2 14.2c-.5-1.1-.4-2.1.5-2.9C5.6 9.6 8.6 8.5 12 8.5s6.4 1.1 8.3 2.8c.9.8 1 1.8.5 2.9l-.6 1.2c-.3.7-1.1 1-1.8.7l-2.2-.9c-.6-.2-.9-.8-.9-1.4v-1.5a8.8 8.8 0 0 0-6.6 0v1.5c0 .6-.3 1.2-.9 1.4l-2.2.9c-.7.3-1.5 0-1.8-.7z" />
  ),
  phone: (
    <path d="M5.5 3.5h3l1.6 4-2.1 1.6a11.2 11.2 0 0 0 6.9 6.9l1.6-2.1 4 1.6v3a2 2 0 0 1-2 2A15.5 15.5 0 0 1 3.5 5.5a2 2 0 0 1 2-2z" />
  ),
  pause: (
    <>
      <rect x="6.5" y="5" width="3.5" height="14" rx="1.2" />
      <rect x="14" y="5" width="3.5" height="14" rx="1.2" />
    </>
  ),
  play: (
    <path d="M8 5.2v13.6a.8.8 0 0 0 1.2.7l10.6-6.8a.8.8 0 0 0 0-1.4L9.2 4.5A.8.8 0 0 0 8 5.2z" />
  ),
  stop: <rect x="6" y="6" width="12" height="12" rx="2.5" />,
  send: <path d="M20.5 3.5l-17 7 6.5 2.5 2.5 6.5zM10 13l10.5-9.5" />,
  keyboard: (
    <>
      <rect x="2.5" y="6" width="19" height="12" rx="2" />
      <Dot x={6.5} y={10} />
      <Dot x={10} y={10} />
      <Dot x={14} y={10} />
      <Dot x={17.5} y={10} />
      <path d="M8 14.5h8" />
    </>
  ),
  waveform: <path d="M4 10v4M8 6.5v11M12 3.5v17M16 7v10M20 10v4" />,
  caption: (
    <>
      <rect x="2.75" y="5" width="18.5" height="14" rx="2.5" />
      <path d="M10.5 10.2a2.4 2.4 0 1 0 0 3.6M17.5 10.2a2.4 2.4 0 1 0 0 3.6" />
    </>
  ),
  headset: (
    <>
      <path d="M4 14v-2a8 8 0 0 1 16 0v2" />
      <path d="M4 14h2.5a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H6a2 2 0 0 1-2-2zM20 14h-2.5a1 1 0 0 0-1 1v3a1 1 0 0 0 1 1h.5a2 2 0 0 0 2-2z" />
      <path d="M18 19.5c0 1.2-1.4 1.8-3.5 1.8H13" />
    </>
  ),
  chat: (
    <path d="M5 4.5h14a2 2 0 0 1 2 2V15a2 2 0 0 1-2 2h-6.5L8 20.5V17H5a2 2 0 0 1-2-2V6.5a2 2 0 0 1 2-2z" />
  ),

  // ---- Direction ----------------------------------------------------------------------------
  'chevron-left': <path d="M14.5 6l-6 6 6 6" />,
  'chevron-right': <path d="M9.5 6l6 6-6 6" />,
  'chevron-up': <path d="M6 14.5l6-6 6 6" />,
  'chevron-down': <path d="M6 9.5l6 6 6-6" />,
  'arrow-left': <path d="M19.5 12h-15M10.5 6l-6 6 6 6" />,
  'arrow-right': <path d="M4.5 12h15M13.5 6l6 6-6 6" />,
  'arrow-up': <path d="M12 19.5v-15M6 10.5l6-6 6 6" />,
  'arrow-down': <path d="M12 4.5v15M6 13.5l6 6 6-6" />,
  'trend-up': <path d="M3 17.5l6-6.5 4 4 8-8.5M15.5 6.5H21V12" />,
  'trend-down': <path d="M3 6.5l6 6.5 4-4 8 8.5M15.5 17.5H21V12" />,
  'trend-flat': <path d="M3.5 12H20M16 7.5l4.5 4.5-4.5 4.5" />,

  // ---- Status -------------------------------------------------------------------------------
  check: <path d="M4.5 12.5l5 5 10-11" />,
  'check-circle': CheckCircle,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  info: (
    <>
      <Ring />
      <path d="M12 11v5.5" />
      <Dot x={12} y={7.75} />
    </>
  ),
  warning: (
    <>
      <path d="M12 3.75L2.75 19.75h18.5z" />
      <path d="M12 9.5V14" />
      <Dot x={12} y={16.8} />
    </>
  ),
  error: (
    <>
      <Ring />
      <path d="M9 9l6 6M15 9l-6 6" />
    </>
  ),
  help: (
    <>
      <Ring />
      <path d="M9.5 9.4a2.6 2.6 0 0 1 5.1.7c0 1.7-2.6 2.2-2.6 3.9" />
      <Dot x={12} y={17.2} />
    </>
  ),
  shield: (
    <>
      <path d="M12 3L4.5 5.9v5.6c0 4.5 3 8 7.5 9.5 4.5-1.5 7.5-5 7.5-9.5V5.9z" />
      <path d="M8.75 12l2.5 2.5 4-4.5" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10.5" width="14" height="10" rx="2" />
      <path d="M8 10.5v-3a4 4 0 0 1 8 0v3M12 14.5V17" />
    </>
  ),
  clock: (
    <>
      <Ring />
      <path d="M12 7v5l3.25 2" />
    </>
  ),
  sparkle: (
    <>
      <path d="M10.5 3.5c.8 4.9 2.6 6.7 7.5 7.5-4.9.8-6.7 2.6-7.5 7.5-.8-4.9-2.6-6.7-7.5-7.5 4.9-.8 6.7-2.6 7.5-7.5z" />
      <path d="M19 2.75v3.5M17.25 4.5h3.5" />
    </>
  ),

  // ---- Customer state: six different shapes -------------------------------------------------
  'state-calm': CheckCircle,
  'state-concerned': (
    <>
      <Ring />
      <path d="M7.5 12c1.5-2.5 3-2.5 4.5 0s3 2.5 4.5 0" />
    </>
  ),
  'state-frustrated': (
    <>
      <Ring />
      <path d="M8.25 13.75l7.5-2.5" />
    </>
  ),
  'state-angry': (
    <>
      <Ring />
      <path d="M7.5 14l2.25-3 2.25 3 2.25-3 2.25 3" />
    </>
  ),
  'state-escalating': (
    <g fill="currentColor" fillRule="evenodd" stroke="none">
      <path d="M10.7 3.9a1.5 1.5 0 0 1 2.6 0l8.1 14.1a1.5 1.5 0 0 1-1.3 2.25H3.9A1.5 1.5 0 0 1 2.6 18zM11.1 9h1.8v5.6h-1.8zM12 16.1a1 1 0 1 0 0 2 1 1 0 0 0 0-2z" />
    </g>
  ),
  'state-recovering': (
    <>
      <Ring />
      <path d="M7.5 9.5l3 3 2-2 3.5 3.5M13 14h3v-3" />
    </>
  ),

  // ---- Actions and objects ------------------------------------------------------------------
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M15.25 15.25L21 21" />
    </>
  ),
  filter: <path d="M3.5 5.5h17L14 13v5.5l-4 2V13z" />,
  person: (
    <>
      <circle cx="12" cy="8" r="3.75" />
      <path d="M4.75 20c.6-3.7 3.5-5.75 7.25-5.75S18.65 16.3 19.25 20" />
    </>
  ),
  building: (
    <path d="M5 20.5V5a1.5 1.5 0 0 1 1.5-1.5h7A1.5 1.5 0 0 1 15 5v15.5M15 9.5h3a1.5 1.5 0 0 1 1.5 1.5v9.5M3 20.5h18M8.5 7.5h3M8.5 11.5h3M8.5 15.5h3" />
  ),
  document: (
    <>
      <path d="M6.5 3h7.25L19 8.25V19.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19.5v-15A1.5 1.5 0 0 1 6.5 3z" />
      <path d="M13.5 3v4a1.25 1.25 0 0 0 1.25 1.25H19M8.5 12.5h7M8.5 16h7" />
    </>
  ),
  print: (
    <>
      <path d="M7 8.5v-5h10v5M7 17H5a2 2 0 0 1-2-2v-4.5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2V15a2 2 0 0 1-2 2h-2" />
      <rect x="7" y="13" width="10" height="7.5" rx="1" />
    </>
  ),
  download: <path d="M12 3.5v11.5M7 10.75l5 5 5-5M4.5 20.5h15" />,
  refresh: <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3M13 6.7h4.3V2.4" />,
  edit: (
    <path d="M4 20l1.2-4.6L16.6 4a2.1 2.1 0 0 1 3 0l.4.4a2.1 2.1 0 0 1 0 3L8.6 18.8zM14.5 6.2l3.3 3.3" />
  ),
  trash: (
    <path d="M4 6.5h16M9.5 6.5V4h5v2.5M6 6.5l.9 12.9a1.6 1.6 0 0 0 1.6 1.4h7a1.6 1.6 0 0 0 1.6-1.4L18 6.5M10 10.5v6M14 10.5v6" />
  ),
  copy: (
    <>
      <rect x="8.5" y="8.5" width="12" height="12" rx="2" />
      <path d="M15.5 8.5V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7.5a2 2 0 0 0 2 2h2.5" />
    </>
  ),
  'external-link': (
    <path d="M13.5 3.75h6.75v6.75M20.25 3.75L11 13M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10" />
  ),
  link: (
    <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
  ),
  more: (
    <g fill="currentColor" stroke="none">
      <circle cx="5" cy="12" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="19" cy="12" r="1.5" />
    </g>
  ),
  menu: <path d="M4 6.5h16M4 12h16M4 17.5h16" />,
  home: <path d="M3.5 11.25L12 4l8.5 7.25M5.75 9.75V20h12.5V9.75M10 20v-5.5h4V20" />,
  flag: <path d="M5.5 21V3.75M5.5 4.5h12.25l-2.9 4.25 2.9 4.25H5.5" />,
  quote: (
    <g fill="currentColor" stroke="none">
      <path d="M10.4 6.2C6.8 6.9 4.5 9.6 4.5 13.2V18h6.2v-6.2H7.7c.2-2 1.3-3.3 3.1-3.9z" />
      <path d="M19.4 6.2c-3.6.7-5.9 3.4-5.9 7V18h6.2v-6.2h-3c.2-2 1.3-3.3 3.1-3.9z" />
    </g>
  ),
  list: (
    <>
      <path d="M9 6.5h11.5M9 12h11.5M9 17.5h11.5" />
      <Dot x={4.5} y={6.5} />
      <Dot x={4.5} y={12} />
      <Dot x={4.5} y={17.5} />
    </>
  ),
  table: (
    <>
      <rect x="3" y="4.5" width="18" height="15" rx="2" />
      <path d="M3 9.5h18M3 14.5h18M9.5 9.5v10" />
    </>
  ),
  eye: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  lightbulb: (
    <path d="M9 17.5h6M10 20.5h4M12 3.5a5.75 5.75 0 0 0-3.5 10.3c.6.5 1 1.2 1 2v1.7h5v-1.7c0-.8.4-1.5 1-2A5.75 5.75 0 0 0 12 3.5z" />
  ),
  globe: (
    <>
      <Ring />
      <path d="M2.75 12h18.5M12 2.75c2.5 2.6 3.75 5.7 3.75 9.25S14.5 18.65 12 21.25c-2.5-2.6-3.75-5.7-3.75-9.25S9.5 5.35 12 2.75z" />
    </>
  ),
  sliders: (
    <>
      <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
      <circle cx="15" cy="7" r="2" />
      <circle cx="9" cy="17" r="2" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof SHAPES;

export const ICON_NAMES = Object.keys(SHAPES) as IconName[];

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name' | 'children' | 'ref'> {
  name: IconName;
  /** Width and height in CSS pixels. */
  size?: number;
  /** An accessible name. Leave it out when the icon sits beside text that says the same thing. */
  label?: string;
}

/** An inline icon. Decorative (hidden from assistive technology) unless it has a `label`. */
export function Icon({ name, size = 20, label, className, ...rest }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
      className={className ? `ff-icon ${className}` : 'ff-icon'}
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
      {...rest}
    >
      {SHAPES[name]}
    </svg>
  );
}
