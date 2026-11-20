/**
 * The Firefly mark: a trail spiralling in to a point of light. Decorative; the name sits beside it.
 * `ignite` draws the trail and lights the point once (the wordmark does this once per session).
 */
export function BrandMark({ size = 32, ignite = false }: { size?: number; ignite?: boolean }) {
  return (
    <svg
      className="brand-mark mark"
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden="true"
      focusable="false"
      data-ignite={ignite ? 'true' : undefined}
    >
      <path
        className="mark__trail"
        pathLength={1}
        d="M2.66 11.14 L2.18 13.59 L2.15 16.06 L2.55 18.46 L3.35 20.73 L4.53 22.79 L6.04 24.58 L7.81 26.07 L9.79 27.20 L11.92 27.95 L14.11 28.31 L16.29 28.27 L18.41 27.86 L20.39 27.09 L22.18 25.99 L23.73 24.62 L24.98 23.02 L25.92 21.25 L26.52 19.37 L26.78 17.44 L26.69 15.53 L26.27 13.70 L25.54 12.00 L24.55 10.48 L23.31 9.18 L21.90 8.14 L20.34 7.38 L18.71 6.92 L17.05 6.76 L15.42 6.89 L13.87 7.31 L12.45 7.98 L11.19 8.87 L10.13 9.95 L9.30 11.18 L8.72 12.51 L8.39 13.89 L8.31 15.28 L8.48 16.63 L8.87 17.89 L9.47 19.04 L10.25 20.04 L11.18 20.86 L12.21 21.49 L13.30 21.91 L14.43 22.13 L15.54 22.13 L16.61 21.94 L17.60 21.58 L18.48 21.05 L19.22 20.40 L19.82 19.64 L20.25 18.81 L20.52 17.95 L20.62 17.09 L20.57 16.25 L20.37 15.46 L20.04 14.76 L19.60 14.15 L19.08 13.65 L18.50 13.27 L17.89 13.02 L17.27 12.90 L16.67 12.90 L16.10 13.00"
      />
      <circle className="mark__point" cx="16.1" cy="13" r="2.3" />
    </svg>
  );
}
