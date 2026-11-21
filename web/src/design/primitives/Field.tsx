import { createContext, useContext, useId, type ReactNode } from 'react';
import { cx } from '../cx.ts';
import { Icon } from '../icons.tsx';
import './field.css';

interface FieldContextValue {
  controlId: string;
  describedBy: string | undefined;
  invalid: boolean;
  required: boolean;
  disabled: boolean;
}

const FieldContext = createContext<FieldContextValue | null>(null);

export interface ControlWiring {
  id: string | undefined;
  'aria-describedby': string | undefined;
  'aria-invalid': true | undefined;
  'aria-required': true | undefined;
  disabled: boolean | undefined;
}

/**
 * What every text control reads from the Field around it: its id (the label points at it), the hint
 * and error that describe it, and whether it is invalid, required or disabled. A control used on
 * its own gets only what its own props say, so it must be given an accessible name.
 */
export function useControlWiring(own: {
  id?: string;
  'aria-describedby'?: string;
  invalid?: boolean;
  required?: boolean;
  disabled?: boolean;
}): ControlWiring {
  const field = useContext(FieldContext);
  const describedBy = [own['aria-describedby'], field?.describedBy].filter(Boolean).join(' ');
  return {
    id: field?.controlId ?? own.id,
    'aria-describedby': describedBy || undefined,
    'aria-invalid': (own.invalid ?? field?.invalid) ? true : undefined,
    'aria-required': (own.required ?? field?.required) ? true : undefined,
    disabled: own.disabled ?? (field?.disabled || undefined),
  };
}

export interface FieldProps {
  label: ReactNode;
  /** Help that is true before anyone makes a mistake: a format, a limit, why it is asked. */
  hint?: ReactNode;
  /** What is wrong and how to fix it. Setting it marks the control invalid. */
  error?: ReactNode;
  required?: boolean;
  disabled?: boolean;
  /** Keep the label for assistive technology only (for example beside a button). */
  hideLabel?: boolean;
  /** One control: TextInput, TextArea, SearchBox or Select. */
  children: ReactNode;
  className?: string;
}

/** A label, hint and error wired to the control inside it with `for`, `aria-describedby` and `aria-invalid`. */
export function Field({
  label,
  hint,
  error,
  required = false,
  disabled = false,
  hideLabel,
  children,
  className,
}: FieldProps) {
  const base = useId();
  const controlId = `${base}-control`;
  const hintId = hint ? `${base}-hint` : undefined;
  const errorId = error ? `${base}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;
  return (
    <div
      className={cx(
        'ff-field',
        Boolean(error) && 'ff-field--invalid',
        disabled && 'ff-field--disabled',
        className,
      )}
    >
      <label className={cx('ff-field__label', hideLabel && 'visually-hidden')} htmlFor={controlId}>
        {label}
        {required ? (
          <span className="ff-field__required" aria-hidden="true">
            {' '}
            *
          </span>
        ) : null}
      </label>
      {hint ? (
        <span className="ff-field__hint" id={hintId}>
          {hint}
        </span>
      ) : null}
      <FieldContext.Provider
        value={{ controlId, describedBy, invalid: Boolean(error), required, disabled }}
      >
        {children}
      </FieldContext.Provider>
      <div className="ff-field__feedback" aria-live="polite">
        {error ? (
          <p className="ff-field__error" id={errorId}>
            <Icon name="error" size={16} />
            <span>{error}</span>
          </p>
        ) : null}
      </div>
    </div>
  );
}
