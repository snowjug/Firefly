import { memo } from 'react';
import { GLYPH_BOX, GLYPH_HALF, buildGlyph, type EdgeShape } from './geometry.ts';
import type { GlyphTraits } from './types.ts';
import '../../styles/signal.css';

export interface SignalGlyphProps {
  traits: GlyphTraits;
  /** Width and height in px. Default 92; it stays legible down to about 28. */
  size?: number;
  /** When given, the glyph is an image with this name. Otherwise it is decorative. */
  label?: string;
  className?: string;
}

function Edge({ edge, width }: { edge: EdgeShape; width: number }) {
  if (edge.kind === 'smooth') {
    return <circle className="sig-edge" r={edge.radius} strokeWidth={width} />;
  }
  if (edge.kind === 'serrated') {
    return <path className="sig-edge" d={edge.d} strokeWidth={width} strokeLinejoin="miter" />;
  }
  return (
    <circle
      className="sig-edge"
      r={edge.radius}
      strokeWidth={edge.round ? width * 1.35 : width}
      strokeDasharray={edge.dasharray}
      strokeLinecap={edge.round ? 'round' : 'butt'}
    />
  );
}

const VIEW_BOX = `${-GLYPH_HALF} ${-GLYPH_HALF} ${GLYPH_BOX} ${GLYPH_BOX}`;

/**
 * A mission as one small instrument: rings are difficulty, size is impact, the edge is how the
 * customer starts, the heart is the call stage and its fill the status, a tick is a minute, and an
 * amber glint marks the suggested next mission. A pure render: no state, no effects, no ids.
 */
function GlyphView({ traits, size = GLYPH_BOX, label, className }: SignalGlyphProps) {
  const model = buildGlyph(traits, size);
  const { width } = model;
  return (
    <svg
      className={className ? `sig sig-glyph ${className}` : 'sig sig-glyph'}
      viewBox={VIEW_BOX}
      width={size}
      height={size}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
      data-sig="glyph"
      data-recommended={traits.recommended ? '' : undefined}
    >
      {model.rings.map((radius) => (
        <circle key={radius} className="sig-ring" r={radius} strokeWidth={width.hair} />
      ))}
      <Edge edge={model.edge} width={width.edge} />
      {model.ticks.off ? (
        <path className="sig-tick sig-tick--ghost" d={model.ticks.off} strokeWidth={width.tick} />
      ) : null}
      {model.ticks.on ? (
        <path className="sig-tick" d={model.ticks.on} strokeWidth={width.tick} />
      ) : null}
      {model.heart.half ? <path className="sig-heart-half" d={model.heart.half} /> : null}
      <path
        className={model.heart.solid ? 'sig-heart is-solid' : 'sig-heart'}
        d={model.heart.d}
        strokeWidth={width.heart}
        strokeLinejoin="round"
      />
      {model.glint ? (
        <>
          <path className="sig-glint" d={model.glint.cardinal} strokeWidth={width.glint} />
          <path
            className="sig-glint sig-glint--diagonal"
            d={model.glint.diagonal}
            strokeWidth={width.glint}
          />
        </>
      ) : null}
    </svg>
  );
}

const sameTraits = (a: GlyphTraits, b: GlyphTraits) =>
  a.difficulty === b.difficulty &&
  a.impact === b.impact &&
  a.start === b.start &&
  a.stage === b.stage &&
  a.status === b.status &&
  a.minutes === b.minutes &&
  Boolean(a.recommended) === Boolean(b.recommended);

export const SignalGlyph = memo(
  GlyphView,
  (prev, next) =>
    prev.size === next.size &&
    prev.label === next.label &&
    prev.className === next.className &&
    sameTraits(prev.traits, next.traits),
);
