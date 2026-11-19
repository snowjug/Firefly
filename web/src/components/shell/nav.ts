import type { IconName } from '../Icon.tsx';

// The sidebar's destinations. The practice journey (setup, call, report) all belong to "Practice",
// so that item stays lit while someone is in the middle of it.

export interface NavItem {
  to: string;
  label: string;
  icon: IconName;
  match: (pathname: string) => boolean;
}

const exact = (path: string) => (pathname: string) => pathname === path;

export const MAIN_NAV: readonly NavItem[] = [
  { to: '/home', label: 'Home', icon: 'home', match: exact('/home') },
  {
    to: '/practice',
    label: 'Practice',
    icon: 'headset',
    match: (p) =>
      p === '/practice' ||
      p.startsWith('/calls/') ||
      /^\/scenarios\/[^/]+\/setup$/.test(p) ||
      /^\/sessions\/[^/]+\/report$/.test(p),
  },
  { to: '/scenarios', label: 'Scenarios', icon: 'grid', match: exact('/scenarios') },
  { to: '/progress', label: 'My Progress', icon: 'chart', match: exact('/progress') },
  { to: '/rewards', label: 'Rewards', icon: 'trophy', match: exact('/rewards') },
  {
    to: '/history',
    label: 'History',
    icon: 'history',
    match: (p) => p === '/history' || /^\/sessions\/[^/]+\/transcript$/.test(p),
  },
];

export const MENTOR_NAV: readonly NavItem[] = [
  { to: '/calibration', label: 'Calibration', icon: 'sliders', match: exact('/calibration') },
  { to: '/trainer', label: 'Trainer', icon: 'users', match: exact('/trainer') },
];

export const FOOT_NAV: readonly NavItem[] = [
  { to: '/settings', label: 'Settings', icon: 'gear', match: exact('/settings') },
  { to: '/help', label: 'Help', icon: 'help', match: exact('/help') },
];

export const ALL_NAV: readonly NavItem[] = [...MAIN_NAV, ...MENTOR_NAV, ...FOOT_NAV];

/** The destination that owns an address, if any. */
export function activeNavItem(pathname: string): NavItem | undefined {
  return ALL_NAV.find((item) => item.match(pathname));
}
