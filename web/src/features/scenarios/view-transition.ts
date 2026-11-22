import type { CSSProperties } from 'react';
import { useViewTransitionState, type To } from 'react-router';

/** The name the product tile has on both pages, so the browser can carry it from one to the other. */
export const TILE_TRANSITION_NAME = 'scenario-tile';

/**
 * The product tile on the scenario details and the one on the case brief share a name for the length
 * of the move from one to the other, and have none the rest of the time (two elements with one name
 * would cancel the transition). Pass the address of the page on the other side of the move. Where the
 * browser has no view transitions, or the link did not ask for one, this is undefined.
 */
export function useTileTransition(to: To): CSSProperties | undefined {
  const moving = useViewTransitionState(to);
  return moving ? { viewTransitionName: TILE_TRANSITION_NAME } : undefined;
}
