import type { ReactNode } from 'react';

export type Stop = readonly [offset: number, color: string, opacity?: number];

/** The stops of a gradient, written as `[offset, colour, opacity?]` tuples. */
export function Stops({ stops }: { stops: readonly Stop[] }): ReactNode {
  return stops.map(([offset, color, opacity], index) => (
    <stop key={index} offset={offset} stopColor={color} stopOpacity={opacity ?? 1} />
  ));
}

/**
 * Mirrors an absolute path (M, L, C, Q, S, T and Z only) around a vertical axis. Hairstyles are
 * drawn facing one way; this gives each of them a twin without redrawing anything.
 */
export function mirrorPath(d: string, axis = 200): string {
  let index = 0;
  return d.replace(/([A-Za-z])|(-?\d*\.?\d+)/g, (_match, letter: string | undefined, num) => {
    if (letter) {
      index = 0;
      return letter;
    }
    const value = Number(num);
    const out = index % 2 === 0 ? 2 * axis - value : value;
    index += 1;
    return String(Number(out.toFixed(2)));
  });
}

export interface Refs {
  /** An element id that is unique to this avatar instance. */
  id(name: string): string;
  /** The matching `url(#id)` reference for fill, stroke, clip-path and filter. */
  url(name: string): string;
}

/** Several avatars can share a page, so every gradient and clip path id carries the instance prefix. */
export function makeRefs(uid: string): Refs {
  return { id: (name) => `${uid}-${name}`, url: (name) => `url(#${uid}-${name})` };
}
