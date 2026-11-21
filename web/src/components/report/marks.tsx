import type { SVGProps } from 'react';

// The small shapes the debrief draws with, so a meaning never rests on colour: the four-point star
// of a signal found (the chamber's own star), a triangle for a curveball, arrows for the customer's
// mood moving, a dot when it did not. They take their colour from the CSS around them.

/** A four-point star with arms `r` long, the shape the chamber lights for a signal found. */
export function starPath(r: number): string {
  const a = r * 0.08;
  const b = r * 0.32;
  const f = (value: number) => Number(value.toFixed(2));
  return (
    `M0 ${-f(r)}C${f(a)} ${-f(b)} ${f(b)} ${-f(a)} ${f(r)} 0` +
    `C${f(b)} ${f(a)} ${f(a)} ${f(b)} 0 ${f(r)}` +
    `C${-f(a)} ${f(b)} ${-f(b)} ${f(a)} ${-f(r)} 0` +
    `C${-f(b)} ${-f(a)} ${-f(a)} ${-f(b)} 0 ${-f(r)}Z`
  );
}

type SvgProps = Omit<SVGProps<SVGSVGElement>, 'children' | 'viewBox'>;

/** The star of a signal found. Decorative: the words beside it say what it is. */
export function StarMark({ size = 16, ...rest }: SvgProps & { size?: number }) {
  return (
    <svg
      viewBox="-8 -8 16 16"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      <path d={starPath(7.5)} />
    </svg>
  );
}

export type MarkShape = 'star' | 'triangle' | 'down' | 'up' | 'dot';

const MARK_PATHS: Record<Exclude<MarkShape, 'star'>, string> = {
  triangle: 'M0 -6.5L6.5 5.5H-6.5Z',
  down: 'M-5 -3L0 3L5 -3',
  up: 'M-5 3L0 -3L5 3',
  dot: 'M0 -3.2a3.2 3.2 0 1 0 0 6.4a3.2 3.2 0 1 0 0 -6.4Z',
};

/** The mark beside a marker's words in the transcript. Decorative, like the star. */
export function MarkGlyph({
  shape,
  size = 14,
  ...rest
}: SvgProps & { shape: MarkShape; size?: number }) {
  if (shape === 'star') return <StarMark size={size} {...rest} />;
  const stroked = shape === 'down' || shape === 'up';
  return (
    <svg
      viewBox="-8 -8 16 16"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      data-shape={shape}
      {...rest}
    >
      <path
        d={MARK_PATHS[shape]}
        {...(stroked
          ? {
              fill: 'none',
              stroke: 'currentColor',
              strokeWidth: 1.6,
              strokeLinecap: 'round' as const,
            }
          : {})}
      />
    </svg>
  );
}
