interface MeterProps {
  value: number;
  max: number;
  /** Names the bar for assistive technology. */
  label: string;
  className?: string;
}

/**
 * A progress line: a hairline with a lit stretch from the left and an amber point where it ends.
 * It is a real `progressbar`, so the figures are announced; the words around it always say them too.
 */
export function Meter({ value, max, label, className }: MeterProps) {
  const safeMax = max > 0 ? max : 1;
  const share = Math.min(1, Math.max(0, value / safeMax));
  return (
    <div
      className={className ? `rw-meter ${className}` : 'rw-meter'}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      data-empty={share === 0 ? '' : undefined}
    >
      <span className="rw-meter__fill" style={{ width: `${share * 100}%` }} />
    </div>
  );
}
