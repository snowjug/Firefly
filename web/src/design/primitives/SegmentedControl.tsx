import { useId, type ReactNode } from 'react';
import { cx } from '../cx.ts';
import { Icon, type IconName } from '../icons.tsx';
import './segmented-control.css';

export interface SegmentedOption<V extends string = string> {
  value: V;
  label: ReactNode;
  /** A line under the label. When any option has one, the options are drawn as cards. */
  description?: ReactNode;
  icon?: IconName;
  disabled?: boolean;
}

export interface SegmentedControlProps<V extends string = string> {
  /** Names the group for everyone, for example "Customer mood". */
  legend: ReactNode;
  /** Keep the legend for assistive technology only. */
  hideLegend?: boolean;
  /** Explains the whole group; read after the legend. */
  hint?: ReactNode;
  options: readonly SegmentedOption<V>[];
  value: V | null;
  /** NoInfer, so a state setter for a narrower type (`useState<'a' | 'b'>`) can be passed as it is. */
  onChange(value: NoInfer<V>): void;
  name?: string;
  size?: 'small' | 'medium';
  /** `auto` draws cards when any option has a description and joined segments otherwise. */
  layout?: 'auto' | 'segments' | 'cards';
  /** Segments share the width equally. */
  fullWidth?: boolean;
  disabled?: boolean;
  className?: string;
}

/**
 * Choose exactly one of a few options. It is a native radio group (fieldset, legend, radio inputs),
 * so arrow keys move and select, Tab enters and leaves the group, and screen readers say
 * "1 of 3". For independent on/off choices use ToggleButton or Switch instead.
 */
export function SegmentedControl<V extends string = string>({
  legend,
  hideLegend,
  hint,
  options,
  value,
  onChange,
  name,
  size = 'medium',
  layout = 'auto',
  fullWidth,
  disabled,
  className,
}: SegmentedControlProps<V>) {
  const base = useId();
  const group = name ?? `${base}-group`;
  const hintId = `${base}-hint`;
  const cards = layout === 'cards' || (layout === 'auto' && options.some((o) => o.description));
  return (
    <fieldset
      className={cx(
        'ff-segmented',
        cards ? 'ff-segmented--cards' : 'ff-segmented--segments',
        `ff-segmented--${size}`,
        fullWidth && 'ff-segmented--fill',
        className,
      )}
      disabled={disabled}
      aria-describedby={hint ? hintId : undefined}
    >
      <legend className={cx('ff-segmented__legend', hideLegend && 'visually-hidden')}>
        {legend}
      </legend>
      {hint ? (
        <p id={hintId} className="ff-segmented__hint">
          {hint}
        </p>
      ) : null}
      <div className="ff-segmented__track">
        {options.map((option, index) => {
          const id = `${base}-${index}`;
          const descriptionId = option.description ? `${id}-description` : undefined;
          return (
            <div className="ff-segmented__item" key={option.value}>
              <input
                id={id}
                className="ff-segmented__input"
                type="radio"
                name={group}
                value={option.value}
                checked={value === option.value}
                disabled={option.disabled}
                aria-describedby={descriptionId}
                onChange={() => onChange(option.value)}
              />
              <span className="ff-segmented__face">
                <span className="ff-segmented__line">
                  {option.icon ? <Icon name={option.icon} size={18} /> : null}
                  <label className="ff-segmented__label" htmlFor={id}>
                    {option.label}
                  </label>
                </span>
                {option.description ? (
                  <span className="ff-segmented__description" id={descriptionId}>
                    {option.description}
                  </span>
                ) : null}
              </span>
              {cards ? (
                <Icon name="check-circle" size={20} className="ff-segmented__check" />
              ) : null}
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
