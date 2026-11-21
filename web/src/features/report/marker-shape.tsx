import type { PointKind } from './journey-model.ts';
import './journey.css';

// The shapes that mark the kinds of point on the temperature chart. The list under the chart uses
// the same shapes, so a marker and its entry can be matched by shape, not by colour.

const R = 6;

/** The shape for a kind of point, centred on 0,0. For use inside an SVG. */
export function MarkerShape({ kind }: { kind: PointKind }) {
  switch (kind) {
    case 'start':
      return <circle className="rp-shape rp-shape--hollow" r={R - 1} />;
    case 'turn':
      return <circle className="rp-shape" r={R - 2.5} />;
    case 'turning-point':
      return (
        <rect
          className="rp-shape"
          x={-R + 1}
          y={-R + 1}
          width={2 * R - 2}
          height={2 * R - 2}
          transform="rotate(45)"
        />
      );
    case 'curveball':
      return (
        <path className="rp-shape" d={`M0,${-R - 1} L${R + 1},${R - 1} L${-R - 1},${R - 1} Z`} />
      );
    case 'end':
      return (
        <rect className="rp-shape" x={-R + 1} y={-R + 1} width={2 * R - 2} height={2 * R - 2} />
      );
  }
}

/** A marker shape on its own, at text size, for the list and the legend. Decorative. */
export function MarkerGlyph({ kind, size = 14 }: { kind: PointKind; size?: number }) {
  return (
    <svg
      className="rp-glyph"
      width={size}
      height={size}
      viewBox={`${-R - 2} ${-R - 2} ${2 * R + 4} ${2 * R + 4}`}
      aria-hidden="true"
      focusable="false"
    >
      <MarkerShape kind={kind} />
    </svg>
  );
}
