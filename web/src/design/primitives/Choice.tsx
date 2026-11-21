import { useId, type ComponentPropsWithRef, type ReactNode, type Ref } from 'react';
import { cx } from '../cx.ts';
import { Icon } from '../icons.tsx';
import './choice.css';

function assign<T>(ref: Ref<T> | undefined, value: T | null) {
  if (typeof ref === 'function') ref(value);
  else if (ref) ref.current = value;
}

interface ChoiceProps extends Omit<ComponentPropsWithRef<'input'>, 'type' | 'size' | 'children'> {
  label: ReactNode;
  /** A line under the label that says more; read after the label. */
  description?: ReactNode;
}

function ChoiceText({
  inputId,
  descriptionId,
  label,
  description,
}: {
  inputId: string;
  descriptionId: string | undefined;
  label: ReactNode;
  description: ReactNode;
}) {
  return (
    <span className="ff-choice__text">
      <label className="ff-choice__label" htmlFor={inputId}>
        {label}
      </label>
      {description ? (
        <span className="ff-choice__description" id={descriptionId}>
          {description}
        </span>
      ) : null}
    </span>
  );
}

export interface CheckboxProps extends ChoiceProps {
  /** Neither all nor none: a parent of a partly chosen group. Shown with a dash. */
  indeterminate?: boolean;
}

/** A checkbox with its label. The whole row is the target (44 px tall). */
export function Checkbox({
  label,
  description,
  indeterminate = false,
  className,
  id,
  disabled,
  ref,
  'aria-describedby': describedBy,
  ...rest
}: CheckboxProps) {
  const base = useId();
  const inputId = id ?? `${base}-input`;
  const descriptionId = description ? `${base}-description` : undefined;
  return (
    <span
      className={cx(
        'ff-choice',
        'ff-choice--checkbox',
        disabled && 'ff-choice--disabled',
        className,
      )}
    >
      <input
        {...rest}
        ref={(element) => {
          if (element) element.indeterminate = indeterminate;
          assign(ref, element);
        }}
        id={inputId}
        type="checkbox"
        disabled={disabled}
        aria-describedby={[describedBy, descriptionId].filter(Boolean).join(' ') || undefined}
        className="ff-choice__input"
      />
      <span className="ff-choice__box" aria-hidden="true">
        <Icon name={indeterminate ? 'minus' : 'check'} size={14} />
      </span>
      <ChoiceText
        inputId={inputId}
        descriptionId={descriptionId}
        label={label}
        description={description}
      />
    </span>
  );
}

export interface SwitchProps extends ChoiceProps {
  /** Which side the label sits on. */
  labelPosition?: 'after' | 'before';
}

/**
 * An on/off setting that takes effect at once (`role="switch"`). The thumb moves and shows a tick
 * when on, so state is never colour alone. For a choice that is submitted later, use Checkbox.
 */
export function Switch({
  label,
  description,
  labelPosition = 'after',
  className,
  id,
  disabled,
  'aria-describedby': describedBy,
  ...rest
}: SwitchProps) {
  const base = useId();
  const inputId = id ?? `${base}-input`;
  const descriptionId = description ? `${base}-description` : undefined;
  return (
    <span
      className={cx(
        'ff-choice',
        'ff-choice--switch',
        labelPosition === 'before' && 'ff-choice--reverse',
        disabled && 'ff-choice--disabled',
        className,
      )}
    >
      <input
        {...rest}
        id={inputId}
        type="checkbox"
        role="switch"
        disabled={disabled}
        aria-describedby={[describedBy, descriptionId].filter(Boolean).join(' ') || undefined}
        className="ff-choice__input"
      />
      <span className="ff-choice__track" aria-hidden="true">
        <span className="ff-choice__thumb">
          <Icon name="check" size={12} />
        </span>
      </span>
      <ChoiceText
        inputId={inputId}
        descriptionId={descriptionId}
        label={label}
        description={description}
      />
    </span>
  );
}
