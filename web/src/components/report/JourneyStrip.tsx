import { useId, useMemo, type CSSProperties } from 'react';
import type { JourneyPoint } from '#shared/domain/report.ts';
import {
  filamentPieces,
  layoutStrip,
  placeDiscoveries,
  type JourneyDiscovery,
} from './journey-model.ts';
import { starPath } from './marks.tsx';
import { Marker } from './TemperatureTimeline.tsx';
import { buildMoments } from './timeline-model.ts';
import { RECONSTRUCTION_MS, type ReconstructionPhase } from './useReconstruction.ts';
import { useElementWidth } from './useElementWidth.ts';

const HEIGHT = 76;
/** The playhead takes this long to cross the page; the rest of the replay's time is the settling. */
const SWEEP_MS = Math.round(RECONSTRUCTION_MS * 0.72);

/**
 * The call, replayed once as a line across the head of the page: the customer's filament, a point
 * for every recorded moment, the turning points flaring as the playhead passes them and a star
 * where a hidden fact came out. It is a drawing and nothing else: the same journey is set out in
 * words, and can be walked point by point, further down, so this is hidden from assistive
 * technology. When the replay is done (or was never played) the line is simply there.
 */
export function JourneyStrip({
  points,
  discoveries,
  phase,
  onSkip,
}: {
  points: readonly JourneyPoint[];
  discoveries: readonly JourneyDiscovery[];
  phase: ReconstructionPhase;
  onSkip(): void;
}) {
  const uid = useId().replace(/:/g, '');
  const moments = useMemo(() => buildMoments(points), [points]);
  const [ref, width] = useElementWidth<HTMLDivElement>(960);
  const layout = useMemo(() => layoutStrip(moments, width, HEIGHT), [moments, width]);
  const pieces = useMemo(
    () => filamentPieces(moments, layout.xs, layout.ys),
    [moments, layout.xs, layout.ys],
  );
  const placed = useMemo(
    () => placeDiscoveries(discoveries, moments, layout.xs, layout.ys),
    [discoveries, moments, layout.xs, layout.ys],
  );
  if (moments.length < 2) return null;

  const first = layout.xs[0] as number;
  const last = layout.xs[layout.xs.length - 1] as number;
  const span = Math.max(1, last - first);
  /** How far along the line a place is, as a share of the replay's sweep. */
  const at = (x: number) => Math.min(1, Math.max(0, (x - first) / span));
  const clipId = `rp-strip-${uid}`;

  return (
    <div
      ref={ref}
      className="rp-strip"
      data-phase={phase}
      // The replay's own clock and the distance its playhead travels, read by debrief.css.
      style={{ '--sweep': `${SWEEP_MS}ms`, '--span': `${span}px` } as CSSProperties}
    >
      <svg
        className="rp-strip__svg"
        width={width}
        height={HEIGHT}
        viewBox={`0 0 ${width} ${HEIGHT}`}
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <clipPath id={clipId}>
            <rect className="rp-strip__reveal" x={0} y={0} width={width} height={HEIGHT} />
          </clipPath>
        </defs>
        <line className="rp-strip__base" x1={first} x2={last} y1={layout.baseY} y2={layout.baseY} />
        {layout.xs.map((x, index) => (
          <line
            key={index}
            className="rp-strip__tick"
            x1={x}
            x2={x}
            y1={layout.baseY}
            y2={layout.baseY + 4}
          />
        ))}
        <g clipPath={`url(#${clipId})`}>
          {pieces.map((piece) => (
            <g key={piece.to} data-band={piece.band.id}>
              <path
                className="tl-glow"
                d={piece.d}
                strokeWidth={piece.weight * 6}
                strokeDasharray={piece.dash ?? undefined}
              />
              <path
                className="tl-piece"
                d={piece.d}
                strokeWidth={piece.weight * 1.2}
                strokeDasharray={piece.dash ?? undefined}
                strokeLinejoin={piece.join}
              />
            </g>
          ))}
          {placed.map((signal) => (
            <g
              key={`${signal.turn}-${signal.label}`}
              className="rp-strip__signal"
              style={{ '--p': at(signal.x).toFixed(3) } as CSSProperties}
            >
              <line
                className="tl-stem"
                x1={signal.x}
                x2={signal.x}
                y1={signal.y - layout.markerSize}
                y2={Math.max(10, signal.y - 18) + 4}
              />
              <path
                className="tl-star"
                d={starPath(5.5)}
                transform={`translate(${signal.x} ${Math.max(10, signal.y - 18)})`}
              />
            </g>
          ))}
          {moments.map((moment, index) => {
            const flares =
              moment.point.kind === 'turning-point' || moment.point.kind === 'curveball';
            const x = layout.xs[index] as number;
            const y = layout.ys[index] as number;
            return (
              <g
                key={`${moment.turn}-${index}`}
                className="rp-strip__node tl-marker"
                data-band={moment.band.id}
                style={{ '--p': at(x).toFixed(3) } as CSSProperties}
              >
                {flares ? (
                  <circle className="rp-strip__flare" cx={x} cy={y} r={layout.markerSize + 2} />
                ) : null}
                <Marker kind={moment.point.kind} x={x} y={y} size={layout.markerSize} />
              </g>
            );
          })}
        </g>
        <line className="rp-strip__scan" x1={first} x2={first} y1={4} y2={layout.baseY + 6} />
        <text className="rp-strip__end" x={first} y={HEIGHT - 2} textAnchor="start">
          Start
        </text>
        <text className="rp-strip__end" x={last} y={HEIGHT - 2} textAnchor="end">
          End
        </text>
      </svg>
      {phase === 'playing' ? (
        <button
          type="button"
          className="rp-strip__skip rp-link"
          aria-label="Skip the replay of the call"
          onClick={onSkip}
        >
          Skip
        </button>
      ) : null}
    </div>
  );
}
