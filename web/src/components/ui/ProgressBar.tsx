import type { Tone } from './StatCard.tsx';

/** A horizontal progress bar. The numbers are exposed to assistive technology; the fill is visual. */
export function ProgressBar({
  value,
  max = 1,
  label,
  tone,
  className = '',
}: {
  value: number;
  max?: number;
  /** What is being measured, for example "Scoping and discovery". */
  label: string;
  tone?: Exclude<Tone, 'blue' | 'red'>;
  className?: string;
}) {
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  return (
    <div
      className={`bar ${className}`.trim()}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      data-tone={tone}
      style={{ ['--value' as string]: ratio }}
    >
      <span />
    </div>
  );
}
