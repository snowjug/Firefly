import { useId, type ReactNode, type Ref } from 'react';

// The small form controls of the setup page. Each one is a real, labelled native control, so the
// keyboard and screen readers behave as they do anywhere else.

export interface FieldOption<T extends string> {
  value: T;
  label: string;
  description?: string;
}

/** What the chosen option means, and the scenario's own choice when it has been changed. */
function fieldHint<T extends string>(
  options: readonly FieldOption<T>[],
  value: T,
  defaultValue: T | undefined,
): ReactNode {
  const selected = options.find((option) => option.value === value);
  const original =
    defaultValue === undefined ? undefined : options.find((o) => o.value === defaultValue);
  const changed = original !== undefined && value !== defaultValue;
  if (!selected?.description && !changed) return null;
  return (
    <>
      {selected?.description}
      {changed ? <span className="stp-was"> Scenario default: {original.label}.</span> : null}
    </>
  );
}

interface ChoiceRowProps<T extends string> {
  legend: string;
  value: T;
  /** The scenario's own value. It is named under the options once the choice differs from it. */
  defaultValue?: T;
  options: readonly FieldOption<T>[];
  onChange(value: T): void;
  disabled?: boolean;
}

/** A short list of options as a row of radio buttons, with the meaning of the chosen one under it. */
export function ChoiceRow<T extends string>({
  legend,
  value,
  defaultValue,
  options,
  onChange,
  disabled = false,
}: ChoiceRowProps<T>) {
  const id = useId();
  const hint = fieldHint(options, value, defaultValue);
  return (
    <fieldset
      className="stp-field"
      disabled={disabled}
      aria-describedby={hint ? `${id}-hint` : undefined}
    >
      <legend className="label">{legend}</legend>
      <div className="choice-row">
        {options.map((option) => (
          <label key={option.value} className="choice">
            <input
              type="radio"
              name={id}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
            <span className="choice-mark" aria-hidden="true" />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
      {hint ? (
        <p id={`${id}-hint`} className="hint">
          {hint}
        </p>
      ) : null}
    </fieldset>
  );
}

interface SelectFieldProps<T extends string> {
  label: string;
  value: T;
  defaultValue?: T;
  options: readonly FieldOption<T>[];
  onChange(value: T): void;
  /** Shown instead of the chosen option's meaning, for example why a scenario was suggested. */
  hint?: ReactNode;
  disabled?: boolean;
  /** Describes what the list is for when the label alone is not enough. */
  describedBy?: string;
}

export function SelectField<T extends string>({
  label,
  value,
  defaultValue,
  options,
  onChange,
  hint,
  disabled = false,
  describedBy,
}: SelectFieldProps<T>) {
  const id = useId();
  const shown = hint ?? fieldHint(options, value, defaultValue);
  const describing = [shown ? `${id}-hint` : null, describedBy].filter(Boolean).join(' ');
  return (
    <div className="field stp-field">
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        className="select"
        value={value}
        disabled={disabled}
        aria-describedby={describing || undefined}
        onChange={(event) => {
          const next = options.find((option) => option.value === event.target.value);
          if (next) onChange(next.value);
        }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {shown ? (
        <p id={`${id}-hint`} className="hint">
          {shown}
        </p>
      ) : null}
    </div>
  );
}

interface ToggleRowProps {
  title: string;
  checked: boolean;
  /** Leave out, together with `locked`, for a setting that cannot be changed. */
  onChange?(checked: boolean): void;
  /** A setting that is always on: shown as a switch that is on and cannot be changed. */
  locked?: boolean;
  disabled?: boolean;
  description: ReactNode;
  /** More controls that belong to the switch, shown under it. */
  children?: ReactNode;
  switchRef?: Ref<HTMLInputElement>;
}

/** A setting with a switch: its name and what it does on the left, the switch and its state on the right. */
export function ToggleRow({
  title,
  checked,
  onChange,
  locked = false,
  disabled = false,
  description,
  children,
  switchRef,
}: ToggleRowProps) {
  const id = useId();
  return (
    <div
      className="stp-toggle"
      data-on={checked ? 'true' : 'false'}
      data-locked={locked || undefined}
    >
      <div className="stp-toggle-head">
        <div className="stp-toggle-text">
          <span id={`${id}-title`} className="label">
            {title}
          </span>
          <p id={`${id}-desc`} className="hint">
            {description}
          </p>
        </div>
        <label className="sw stp-sw">
          <input
            ref={switchRef}
            type="checkbox"
            role="switch"
            checked={checked}
            disabled={locked || disabled}
            readOnly={locked}
            aria-labelledby={`${id}-title`}
            aria-describedby={`${id}-desc`}
            onChange={(event) => onChange?.(event.target.checked)}
          />
          <span className="sw-track" aria-hidden="true">
            <span className="sw-thumb" />
          </span>
          <span className="stp-sw-state" aria-hidden="true">
            {checked ? 'On' : 'Off'}
          </span>
        </label>
      </div>
      {children}
    </div>
  );
}
