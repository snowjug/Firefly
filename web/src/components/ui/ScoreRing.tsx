import { useEffect, useId, useState } from 'react';
import { useReducedMotion } from '../../lib/theme.tsx';

/** A circular score. It reads as "<value> out of <max>"; the ring is a visual echo of the number. */
export function ScoreRing({
  value,
  max = 5,
  size = 168,
  label = 'Overall score',
}: {
  value: number;
  max?: number;
  size?: number;
  label?: string;
}) {
  const reduced = useReducedMotion();
  const gradientId = `ring-${useId().replace(/:/g, '')}`;
  const stroke = Math.max(8, Math.round(size / 15));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;

  // The ring fills in once it appears (skipped under reduced motion).
  const [animated, setAnimated] = useState(0);
  useEffect(() => {
    if (reduced) return;
    const frame = requestAnimationFrame(() => setAnimated(ratio));
    return () => cancelAnimationFrame(frame);
  }, [ratio, reduced]);
  const shown = reduced ? ratio : animated;

  const text = Number.isInteger(value) ? String(value) : value.toFixed(1);
  return (
    <div
      className="ring"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${label}: ${text} out of ${max}`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#2f7bff" />
            <stop offset="1" stopColor="#7a49e0" />
          </linearGradient>
        </defs>
        <circle
          className="ring-track"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
        />
        <circle
          className="ring-fill"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - shown)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="ring-text" aria-hidden="true">
        <span className="ring-value" style={{ fontSize: `${size / 70}rem` }}>
          {text}
        </span>
        <span className="ring-max">of {max}</span>
      </div>
    </div>
  );
}
