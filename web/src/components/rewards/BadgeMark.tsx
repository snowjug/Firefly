import type { BadgeFigure, BadgeState } from './rewards-model.ts';
import '../../styles/rewards.css';

// Each badge is a small engraved mark: a ring with one figure inside it, in hairlines. Earned, the
// ring is whole and the point at its heart is lit; started, the ring is drawn as far as the badge
// has got; not started, it is a dashed outline. The words beside the mark always say which, so the
// mark is decoration and carries no meaning of its own.

const CENTRE = 36;

function Figure({ kind }: { kind: BadgeFigure }) {
  switch (kind) {
    case 'lens':
      return (
        <>
          <circle cx={CENTRE} cy={CENTRE} r={9} />
          <path d="M36 17v8M36 47v8M17 36h8M47 36h8" />
        </>
      );
    case 'filament':
      return <path d="M15 36l5-11 5 17 5-15 4 11 3-7h14" strokeLinejoin="round" />;
    case 'owner':
      return (
        <>
          <circle cx={21} cy={CENTRE} r={3.2} />
          <path d="M27 36h19M41 31l5 5-5 5M54 29v14" strokeLinecap="round" />
        </>
      );
    case 'compass':
      return (
        <>
          {Array.from({ length: 7 }, (_, step) => {
            const angle = -Math.PI / 2 + (step * 2 * Math.PI) / 7;
            return (
              <circle
                key={step}
                cx={(CENTRE + Math.cos(angle) * 15).toFixed(2)}
                cy={(CENTRE + Math.sin(angle) * 15).toFixed(2)}
                r={2.1}
              />
            );
          })}
          <circle cx={CENTRE} cy={CENTRE} r={4.5} />
        </>
      );
    case 'days':
      return <path d="M24 46V33M36 46V27M48 46V33M19 50h34" strokeLinecap="round" />;
    default:
      return <circle cx={CENTRE} cy={CENTRE} r={11} />;
  }
}

/** Whether the figure has its own point at the heart, which then becomes the lit one. */
const HAS_HEART: ReadonlySet<BadgeFigure> = new Set(['first', 'lens', 'compass']);

export function BadgeMark({
  figure,
  state,
  ratio,
}: {
  figure: BadgeFigure;
  state: BadgeState;
  /** 0 to 1: how much of the ring is drawn while the badge is started. */
  ratio: number;
}) {
  const drawn = state === 'earned' ? 100 : state === 'progress' ? Math.round(ratio * 100) : 0;
  return (
    <svg
      className="rw-mark"
      viewBox="0 0 72 72"
      width="72"
      height="72"
      aria-hidden="true"
      focusable="false"
      data-state={state}
    >
      <circle className="rw-mark__track" cx={CENTRE} cy={CENTRE} r={30} />
      <circle
        className="rw-mark__ring"
        cx={CENTRE}
        cy={CENTRE}
        r={30}
        pathLength={100}
        strokeDasharray={`${drawn} ${100 - drawn}`}
        transform="rotate(-90 36 36)"
      />
      <g className="rw-mark__figure">
        <Figure kind={figure} />
      </g>
      {state === 'earned' ? (
        <>
          <circle className="rw-mark__glow" cx={CENTRE} cy={CENTRE} r={22} />
          <circle
            className="rw-mark__heart"
            cx={CENTRE}
            cy={CENTRE}
            r={HAS_HEART.has(figure) ? 3 : 2.4}
          />
        </>
      ) : null}
    </svg>
  );
}
