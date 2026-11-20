// The dock's destinations, in the order they are numbered on the ruler. The practice journey
// (choosing a mission, calibrating it, the call, its debrief) all belongs to Missions, so that item
// stays lit while someone is in the middle of it.

export interface NavItem {
  to: string;
  label: string;
  /** Words that find this destination in the palette, besides its label. */
  keywords: string;
  match: (pathname: string) => boolean;
}

const exact = (path: string) => (pathname: string) => pathname === path;

export const DOCK_ITEMS: readonly NavItem[] = [
  { to: '/home', label: 'Home', keywords: 'start overview console', match: exact('/home') },
  {
    to: '/scenarios',
    label: 'Missions',
    keywords: 'scenarios practice atlas library calls',
    match: (p) =>
      p === '/scenarios' ||
      p === '/practice' ||
      p.startsWith('/calls/') ||
      /^\/scenarios\/[^/]+\/setup$/.test(p) ||
      /^\/sessions\/[^/]+\/report$/.test(p),
  },
  {
    to: '/history',
    label: 'History',
    keywords: 'past calls transcripts reports trail',
    match: (p) => p === '/history' || /^\/sessions\/[^/]+\/transcript$/.test(p),
  },
  {
    to: '/progress',
    label: 'Progress',
    keywords: 'skills points recognitions rewards badges constellation',
    match: (p) => p === '/progress' || p === '/rewards',
  },
  {
    to: '/trainer',
    label: 'Studio',
    keywords: 'mentor trainer calibration review',
    match: (p) => p === '/trainer' || p === '/calibration',
  },
  {
    to: '/settings',
    label: 'Settings',
    keywords: 'profile preferences voice privacy tour theme motion',
    match: exact('/settings'),
  },
];

/** Reachable from the colophon, the palette and the utility cluster; it owns no dock item. */
export const HELP_ITEM: NavItem = {
  to: '/help',
  label: 'Help and Responsible AI',
  keywords: 'about how it works rules limits scores',
  match: exact('/help'),
};

/** The destination that owns an address, if any. A trailing slash does not change the answer. */
export function activeNavItem(pathname: string): NavItem | undefined {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  return DOCK_ITEMS.find((item) => item.match(path));
}
