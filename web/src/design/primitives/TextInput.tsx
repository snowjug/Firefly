import type { ComponentPropsWithRef, KeyboardEvent, MouseEvent } from 'react';
import { cx } from '../cx.ts';
import { Icon, type IconName } from '../icons.tsx';
import { useControlWiring } from './Field.tsx';
import { IconButton } from './Button.tsx';
import './input.css';

type ControlSize = 'small' | 'medium';

interface ControlProps {
  size?: ControlSize;
  /** Mark the control invalid. Inside a Field, the Field's `error` does this for you. */
  invalid?: boolean;
}

// ---- TextInput ---------------------------------------------------------------------------

export interface TextInputProps
  extends Omit<ComponentPropsWithRef<'input'>, 'size' | 'type'>, ControlProps {
  type?: 'text' | 'email' | 'url' | 'tel' | 'password' | 'number';
  leadingIcon?: IconName;
}

/** A single-line text input. Inside a Field it is labelled, described and marked invalid for you. */
export function TextInput({
  size = 'medium',
  invalid,
  leadingIcon,
  className,
  id,
  required,
  disabled,
  type = 'text',
  'aria-describedby': describedBy,
  ...rest
}: TextInputProps) {
  const wiring = useControlWiring({
    id,
    'aria-describedby': describedBy,
    invalid,
    required,
    disabled,
  });
  const input = (
    <input
      {...rest}
      {...wiring}
      type={type}
      required={required}
      className={cx(
        'ff-input',
        `ff-input--${size}`,
        leadingIcon && 'ff-input--lead',
        !leadingIcon && className,
      )}
    />
  );
  if (!leadingIcon) return input;
  return (
    <span className={cx('ff-input-wrap', className)}>
      <Icon name={leadingIcon} size={18} className="ff-input-wrap__icon" />
      {input}
    </span>
  );
}

// ---- TextArea ----------------------------------------------------------------------------

export interface TextAreaProps extends ComponentPropsWithRef<'textarea'>, ControlProps {}

/** A multi-line text input, resizable vertically. */
export function TextArea({
  size = 'medium',
  invalid,
  className,
  id,
  required,
  disabled,
  rows = 4,
  'aria-describedby': describedBy,
  ...rest
}: TextAreaProps) {
  const wiring = useControlWiring({
    id,
    'aria-describedby': describedBy,
    invalid,
    required,
    disabled,
  });
  return (
    <textarea
      {...rest}
      {...wiring}
      rows={rows}
      required={required}
      className={cx('ff-input', 'ff-input--multiline', `ff-input--${size}`, className)}
    />
  );
}

// ---- SearchBox ---------------------------------------------------------------------------

export interface SearchBoxProps extends Omit<
  TextInputProps,
  'type' | 'value' | 'defaultValue' | 'onChange' | 'leadingIcon'
> {
  value: string;
  onChange(value: string): void;
  /** Names the box when it is not inside a Field, for example "Search scenarios". */
  label?: string;
  clearLabel?: string;
}

/** A search input with a clear button. Escape clears it, and only then lets Escape do anything else. */
export function SearchBox({
  value,
  onChange,
  label,
  clearLabel = 'Clear search',
  size = 'medium',
  invalid,
  className,
  id,
  required,
  disabled,
  placeholder,
  onKeyDown,
  'aria-describedby': describedBy,
  ...rest
}: SearchBoxProps) {
  const wiring = useControlWiring({
    id,
    'aria-describedby': describedBy,
    invalid,
    required,
    disabled,
  });
  const clear = (event: MouseEvent<HTMLButtonElement>) => {
    onChange('');
    event.currentTarget.parentElement?.querySelector('input')?.focus();
  };
  const keyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    onKeyDown?.(event);
    if (event.key === 'Escape' && value !== '') {
      event.preventDefault();
      event.stopPropagation();
      onChange('');
    }
  };
  return (
    <span className={cx('ff-search', className)}>
      <Icon name="search" size={18} className="ff-search__icon" />
      <input
        {...rest}
        {...wiring}
        type="search"
        aria-label={label}
        placeholder={placeholder}
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={keyDown}
        className={cx('ff-input', `ff-input--${size}`, 'ff-search__input')}
      />
      {value !== '' && !wiring.disabled ? (
        <IconButton
          icon="x"
          label={clearLabel}
          size="small"
          className="ff-search__clear"
          onClick={clear}
        />
      ) : null}
    </span>
  );
}

// ---- Select ------------------------------------------------------------------------------

export interface SelectProps extends Omit<ComponentPropsWithRef<'select'>, 'size'>, ControlProps {}

/** A native select, styled. Use it for one choice from four or more; for fewer use SegmentedControl. */
export function Select({
  size = 'medium',
  invalid,
  className,
  id,
  required,
  disabled,
  children,
  'aria-describedby': describedBy,
  ...rest
}: SelectProps) {
  const wiring = useControlWiring({
    id,
    'aria-describedby': describedBy,
    invalid,
    required,
    disabled,
  });
  return (
    <span className={cx('ff-select', className)}>
      <select
        {...rest}
        {...wiring}
        required={required}
        className={cx('ff-input', `ff-input--${size}`, 'ff-select__native')}
      >
        {children}
      </select>
      <Icon name="chevron-down" size={18} className="ff-select__chevron" />
    </span>
  );
}
