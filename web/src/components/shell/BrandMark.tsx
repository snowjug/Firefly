import { useId } from 'react';

/** The Firefly mark: a spark of light on a blue-to-violet tile. Decorative; the name sits beside it. */
export function BrandMark({ size = 34 }: { size?: number }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg
      className="brand-mark"
      width={size}
      height={size}
      viewBox="0 0 40 40"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={`${id}-tile`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2f7bff" />
          <stop offset="1" stopColor="#7a49e0" />
        </linearGradient>
        <radialGradient id={`${id}-halo`} cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.85" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="40" height="40" rx="11" fill={`url(#${id}-tile)`} />
      <circle cx="20" cy="20" r="12" fill={`url(#${id}-halo)`} opacity="0.5" />
      <path
        d="M20 8.5l2.6 8.9L31.5 20l-8.9 2.6L20 31.5l-2.6-8.9L8.5 20l8.9-2.6L20 8.5z"
        fill="#ffffff"
      />
    </svg>
  );
}
