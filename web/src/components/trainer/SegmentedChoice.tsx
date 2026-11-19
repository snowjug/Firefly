import { useId, type ReactNode } from 'react';

interface Choice<T extends string> {
  value: T;
  label: string;
}

/** A labelled radio group drawn as the design system's segmented control. Selecting applies at once. */
export function SegmentedChoice<T extends string>({
  legend,
  value,
  options,
  onChange,
  hint,
}: {
  legend: string;
  value: T;
  options: readonly Choice<T>[];
  onChange(value: T): void;
  hint?: ReactNode;
}) {
  const name = useId();
  const hintId = useId();
  return (
    <fieldset
      style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}
      aria-describedby={hint ? hintId : undefined}
    >
      <legend className="label" style={{ padding: 0, marginBottom: 'var(--sp-2)' }}>
        {legend}
      </legend>
      <div className="segmented" style={{ maxWidth: '100%', flexWrap: 'wrap' }}>
        {options.map((option) => (
          <label key={option.value}>
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={option.value === value}
              onChange={() => onChange(option.value)}
            />
            {option.label}
          </label>
        ))}
      </div>
      {hint ? (
        <p id={hintId} className="hint" style={{ marginTop: 'var(--sp-2)' }}>
          {hint}
        </p>
      ) : null}
    </fieldset>
  );
}
