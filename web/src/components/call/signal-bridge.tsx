// The one place the chamber meets the Signal instrument and the persistent field. Everything the
// chamber needs from them comes through here, so a change to either is a change to one file.

export { SignalPresence } from '../signal/SignalPresence.tsx';
export type { PresenceProps } from '../signal/types.ts';
export { pulseWorld, useWorldPose, type WorldPose } from '../world/useWorldPose.ts';

/** How many dormant points the presence carries: always the same, so it never hints at a total. */
export const PRESENCE_POOL = 7;
