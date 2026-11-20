import {
  createContext,
  useContext,
  useEffect,
  useId,
  useMemo,
  useState,
  type ComponentPropsWithRef,
  type ReactNode,
} from 'react';
import { Icon } from '../Icon.tsx';
import '../../styles/frame.css';

interface Counter {
  length: number;
  max: number;
}

interface FieldContextValue {
  id: string;
  describedBy: string | undefined;
  invalid: boolean;
  setCounter(counter: Counter | null): void;
}

const FieldContext = createContext<FieldContextValue | null>(null);

/**
 * A form field: a mono label above one control on a hairline underline, then a hint, a character
 * count and an error. It wires the control inside it (TextInput, TextArea, SelectInput, or your
 * own through `useFieldControl`): `for`/`id`, `aria-describedby` (hint, error, limit) and
 * `aria-invalid`. The error sits in a live region that exists before it is filled, so it is read out
 * when it appears. Do not give the control its own `id`.
 */
export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const countId = `${id}-count`;
  const [counter, setCounter] = useState<Counter | null>(null);
  const describedBy =
    [hint ? hintId : null, counter ? countId : null, error ? errorId : null]
      .filter(Boolean)
      .join(' ') || undefined;
  const context = useMemo<FieldContextValue>(
    () => ({
      id,
      describedBy,
      invalid: Boolean(error),
      setCounter: (next) =>
        setCounter((current) =>
          current?.length === next?.length && current?.max === next?.max ? current : next,
        ),
    }),
    [id, describedBy, error],
  );
  const state = !counter
    ? undefined
    : counter.length >= counter.max
      ? 'full'
      : counter.length >= counter.max * 0.9
        ? 'near'
        : 'ok';

  return (
    <div className="ff-field" data-invalid={error ? '' : undefined}>
      <label className="ff-field__label type-label" htmlFor={id}>
        {label}
      </label>
      <FieldContext.Provider value={context}>{children}</FieldContext.Provider>
      {hint || counter ? (
        <div className="ff-field__foot">
          <div className="ff-field__notes">
            {hint ? (
              <p id={hintId} className="ff-field__hint">
                {hint}
              </p>
            ) : null}
          </div>
          {counter ? (
            <>
              <p className="ff-field__count" data-state={state} aria-hidden="true">
                {counter.length} / {counter.max}
              </p>
              <span id={countId} className="sr-only">
                Up to {counter.max} characters
              </span>
            </>
          ) : null}
        </div>
      ) : null}
      <div className="ff-field__live" aria-live="polite">
        {error ? (
          <p id={errorId} className="ff-field__error">
            <Icon name="alert" size={16} />
            <span>{error}</span>
          </p>
        ) : null}
      </div>
    </div>
  );
}

/** The props that tie a custom control to its Field (empty outside one). */
export function useFieldControl(): {
  id?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: true;
} {
  const field = useContext(FieldContext);
  if (!field) return {};
  return {
    id: field.id,
    'aria-describedby': field.describedBy,
    'aria-invalid': field.invalid ? true : undefined,
  };
}

function useControlProps(own: { id?: string; 'aria-describedby'?: string }) {
  const field = useContext(FieldContext);
  const describedBy =
    [own['aria-describedby'], field?.describedBy].filter(Boolean).join(' ') || undefined;
  return {
    field,
    props: {
      id: own.id ?? field?.id,
      'aria-describedby': describedBy,
      'aria-invalid': field?.invalid ? (true as const) : undefined,
    },
  };
}

/** Counts what has been typed and reports it to the Field when the control has a limit. */
function useCounter(
  field: FieldContextValue | null,
  value: unknown,
  defaultValue: unknown,
  max: number | undefined,
  enabled: boolean,
) {
  const [typed, setTyped] = useState(() => String(value ?? defaultValue ?? '').length);
  const length = value !== undefined ? String(value).length : typed;
  const setCounter = field?.setCounter;
  const limit = enabled && max !== undefined && max > 0 ? max : 0;
  useEffect(() => {
    setCounter?.(limit ? { length, max: limit } : null);
  }, [setCounter, limit, length]);
  useEffect(() => () => setCounter?.(null), [setCounter]);
  return setTyped;
}

const controlClass = (serif: boolean, className: string) =>
  `ff-field__control${serif ? ' ff-field__control--serif' : ''} ${className}`.trim();

type TextInputProps = ComponentPropsWithRef<'input'> & {
  /** Set the text in the reading serif (a person's own words). */
  serif?: boolean;
  /** Show the character count when `maxLength` is set. */
  counter?: boolean;
};

/** A one-line text field on a hairline underline. Native props pass through. */
export function TextInput({
  serif = false,
  counter = true,
  className = '',
  onChange,
  ...rest
}: TextInputProps) {
  const { field, props } = useControlProps(rest);
  const setTyped = useCounter(field, rest.value, rest.defaultValue, rest.maxLength, counter);
  return (
    <input
      type="text"
      {...rest}
      {...props}
      className={controlClass(serif, className)}
      onChange={(event) => {
        setTyped(event.currentTarget.value.length);
        onChange?.(event);
      }}
    />
  );
}

type TextAreaProps = ComponentPropsWithRef<'textarea'> & {
  serif?: boolean;
  counter?: boolean;
};

/** A multi-line text field on a hairline underline. Native props pass through. */
export function TextArea({
  serif = false,
  counter = true,
  className = '',
  onChange,
  ...rest
}: TextAreaProps) {
  const { field, props } = useControlProps(rest);
  const setTyped = useCounter(field, rest.value, rest.defaultValue, rest.maxLength, counter);
  return (
    <textarea
      rows={3}
      {...rest}
      {...props}
      className={controlClass(serif, className)}
      onChange={(event) => {
        setTyped(event.currentTarget.value.length);
        onChange?.(event);
      }}
    />
  );
}

type SelectInputProps = ComponentPropsWithRef<'select'> & {
  /** A shortcut for plain options; give `<option>` children for anything more. */
  options?: readonly { value: string; label: string; disabled?: boolean }[];
};

/** A native select, flat, with a hairline underline and a drawn chevron. */
export function SelectInput({ options, children, className = '', ...rest }: SelectInputProps) {
  const { props } = useControlProps(rest);
  return (
    <span className="ff-select">
      <select {...rest} {...props} className={controlClass(false, className)}>
        {options
          ? options.map((option) => (
              <option key={option.value} value={option.value} disabled={option.disabled}>
                {option.label}
              </option>
            ))
          : children}
      </select>
    </span>
  );
}
