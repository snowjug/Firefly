import type { WorldPose } from './world-store.ts';

// How present the field is on each route, and how fast it moves. Pure: an address in, a pose out.
// The call chamber is the one route that gets its mood from the page; every other route is a calm
// room that is as quiet as the page needs. Text-heavy pages are almost still, and below
// `STILL_BELOW` the field is a single frame with no loop at all.

/** At or below this the field is drawn once and left alone (quiet pages have no ambient motion). */
export const STILL_BELOW = 0.2;

const room = (intensity: number, energy: number): WorldPose => ({
  tension: 0.08,
  open: 1,
  warmth: 0.42,
  energy,
  intensity,
  focus: null,
  recovering: false,
});

const FRONT_DOOR = room(0.8, 0.26);
const HOME = room(0.65, 0.22);
const MISSIONS = room(0.55, 0.2);
const CALIBRATION = room(0.5, 0.2);
const CHAMBER = room(1, 0.22);
const DEBRIEF = room(0.5, 0.18);
const TRAIL = room(0.3, 0.14);
const QUIET = room(0.15, 0.1);
const OTHER = room(0.2, 0.1);

const ROUTES: readonly [RegExp, WorldPose][] = [
  [/^\/$/, FRONT_DOOR],
  [/^\/home$/, HOME],
  [/^\/scenarios$/, MISSIONS],
  [/^\/(?:scenarios\/[^/]+\/(?:setup|brief)|practice)$/, CALIBRATION],
  [/^\/calls\/[^/]+$/, CHAMBER],
  [/^\/sessions\/[^/]+\/report$/, DEBRIEF],
  [/^\/(?:history|progress|rewards)$/, TRAIL],
  [/^\/(?:trainer|calibration|settings|help|about|sign-in)$/, QUIET],
];

/** The default pose for an address (the path only: no query or hash). Anything unknown is quiet. */
export function routePose(pathname: string): WorldPose {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  const lower = path.toLowerCase() || '/';
  for (const [pattern, pose] of ROUTES) if (pattern.test(lower)) return { ...pose };
  return { ...OTHER };
}
