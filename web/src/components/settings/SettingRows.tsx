import type { ReactNode, Ref } from 'react';

// Rows for the settings page: what the setting is (and a plain-language hint) on the left, the
// control on the right. Every control has a real label, and the hint is read with it.

function RowText({
  id,
  label,
  hint,
  forControl,
}: {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  forControl: boolean;
}) {
  return (
    <div className="st-row-text">
      {forControl ? (
        <label htmlFor={id} className="st-row-label">
          {label}
        </label>
      ) : (
        <span id={`${id}-label`} className="st-row-label">
          {label}
        </span>
      )}
      {hint ? (
        <div id={`${id}-hint`} className="hint">
          {hint}
        </div>
      ) : null}
    </div>
  );
}

export function SelectRow<T extends string>({
  id,
  label,
  hint,
  value,
  options,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  hint?: ReactNode;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange(value: T): void;
  disabled?: boolean;
}) {
  return (
    <div className="st-row">
      <RowText id={id} label={label} hint={hint} forControl />
      <div className="st-row-control">
        <select
          id={id}
          className="select"
          value={value}
          disabled={disabled}
          aria-describedby={hint ? `${id}-hint` : undefined}
          onChange={(event) => onChange(event.target.value as T)}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

export function SwitchRow({
  id,
  label,
  hint,
  checked,
  onChange,
  disabled,
  inputRef,
}: {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  checked: boolean;
  onChange(checked: boolean): void;
  disabled?: boolean;
  inputRef?: Ref<HTMLInputElement>;
}) {
  return (
    <div className="st-row" data-kind="switch">
      <RowText id={id} label={label} hint={hint} forControl />
      <div className="st-row-control">
        <span className="sw">
          <input
            ref={inputRef}
            id={id}
            type="checkbox"
            role="switch"
            checked={checked}
            disabled={disabled}
            aria-describedby={hint ? `${id}-hint` : undefined}
            onChange={(event) => onChange(event.target.checked)}
          />
          <span className="sw-track" aria-hidden="true">
            <span className="sw-thumb" />
          </span>
        </span>
      </div>
    </div>
  );
}

/** A row whose control is a button (for something that opens or starts, rather than a setting). */
export function ActionRow({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="st-row">
      <RowText id={id} label={label} hint={hint} forControl={false} />
      <div className="st-row-control">{children}</div>
    </div>
  );
}

export function SettingGroup({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="st-group" aria-labelledby={id}>
      <h3 id={id} className="t-label">
        {title}
      </h3>
      <div className="st-rows">{children}</div>
    </section>
  );
}
