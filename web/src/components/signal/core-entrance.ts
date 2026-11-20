// The core is engraved as it appears: lines draw themselves in along their length, the rest
// fades up behind them, in about 600 ms. Web animations on elements the component marked, so it
// is a few dozen short animations and no frame loop. Skipped for reduced motion, for the cheapest
// tier, and when the page marks the core `data-no-enter` because it is taking over the entrance
// (a view transition from the mission on the atlas).

const EASING = 'cubic-bezier(0.16, 1, 0.3, 1)';

/** The longest the whole entrance takes, delays included. */
export const ENGRAVE_MS = 700;

/** Starts the entrance. Returns the animations so they can be cancelled. */
export function engrave(root: HTMLElement): Animation[] {
  if (typeof root.animate !== 'function') return [];
  const started: Animation[] = [];

  // Lines carry `pathLength="1"`, so one unit of dash is the whole line.
  root.querySelectorAll<SVGElement>('[data-write="line"]').forEach((element, i) => {
    started.push(
      element.animate(
        [
          { strokeDasharray: '1', strokeDashoffset: '1' },
          { strokeDasharray: '1', strokeDashoffset: '0' },
        ],
        { duration: 460, delay: Math.min(i, 8) * 30, easing: EASING, fill: 'backwards' },
      ),
    );
  });

  // Everything else comes up to whatever opacity it rests at.
  root.querySelectorAll<Element>('[data-write="fade"]').forEach((element, i) => {
    started.push(
      element.animate([{ opacity: 0 }], {
        duration: 340,
        delay: 160 + (i % 14) * 14,
        easing: 'ease-out',
        fill: 'backwards',
      }),
    );
  });
  return started;
}
