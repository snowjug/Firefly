import { useEffect, type ComponentPropsWithRef, type MouseEvent, type ReactNode } from 'react';
import { Link, type To } from 'react-router';
import { cx } from '../cx.ts';
import { Icon, type IconName } from '../icons.tsx';
import { useAnnouncer } from './LiveRegion.tsx';
import { Spinner } from './Spinner.tsx';
import { VisuallyHidden } from './VisuallyHidden.tsx';
import './button.css';

export type ButtonAppearance = 'primary' | 'secondary' | 'outline' | 'subtle' | 'danger';
export type ButtonSize = 'small' | 'medium' | 'large';

/** What a button looks like. Shared by Button, LinkButton, IconButton and ToggleButton. */
export interface ButtonLook {
  appearance?: ButtonAppearance;
  /** `small` is 32 px, `medium` 44 px (the default) and `large` 48 px tall. */
  size?: ButtonSize;
  icon?: IconName;
  iconPosition?: 'start' | 'end';
  /** Stretch to the width of the container. */
  fullWidth?: boolean;
}

const ICON_PX: Record<ButtonSize, number> = { small: 16, medium: 20, large: 20 };

function lookClass(
  { appearance = 'secondary', size = 'medium', fullWidth }: ButtonLook,
  extra: { iconOnly?: boolean; loading?: boolean; centred?: boolean },
  className?: string,
) {
  return cx(
    'ff-button',
    `ff-button--${appearance}`,
    `ff-button--${size}`,
    fullWidth && 'ff-button--block',
    extra.iconOnly && 'ff-button--icon',
    extra.loading && 'ff-button--loading',
    extra.centred && 'ff-button--loading-centre',
    className,
  );
}

interface ContentProps {
  size: ButtonSize;
  icon?: IconName;
  iconPosition: 'start' | 'end';
  loading?: boolean;
  trailing?: ReactNode;
  children?: ReactNode;
}

function Content({ size, icon, iconPosition, loading, trailing, children }: ContentProps) {
  const px = ICON_PX[size];
  const glyph = loading ? (
    <Spinner size={px === 16 ? 'tiny' : 'small'} tone="current" decorative />
  ) : (
    <Icon name={icon as IconName} size={px} />
  );
  const hasIcon = icon !== undefined;
  return (
    <>
      {hasIcon && iconPosition === 'start' ? glyph : null}
      {children === undefined ? null : <span className="ff-button__label">{children}</span>}
      {hasIcon && iconPosition === 'end' ? glyph : null}
      {trailing}
      {loading && !hasIcon ? (
        <span className="ff-button__busy">
          <Spinner size={px === 16 ? 'tiny' : 'small'} tone="current" decorative />
        </span>
      ) : null}
    </>
  );
}

export interface ButtonProps extends Omit<ComponentPropsWithRef<'button'>, 'children'>, ButtonLook {
  children: ReactNode;
  /**
   * Shows that work is under way. The button keeps its size, keeps focus (it becomes aria-disabled,
   * not disabled), ignores presses and tells assistive technology through the shared announcer.
   */
  loading?: boolean;
  /** What is being done, announced when `loading` starts: "Starting the call". */
  loadingLabel?: string;
  /**
   * Looks disabled and ignores presses but stays in the tab order (aria-disabled), for a control
   * that must keep focus. Use plain `disabled` for everything else.
   */
  disabledFocusable?: boolean;
}

function useLoadingAnnouncement(loading: boolean | undefined, label: string) {
  const announce = useAnnouncer();
  useEffect(() => {
    if (loading) announce(label);
  }, [loading, label, announce]);
}

function blockPress(event: MouseEvent<HTMLButtonElement>) {
  event.preventDefault();
  event.stopPropagation();
}

interface CoreProps extends Omit<ButtonProps, 'children'> {
  children?: ReactNode;
  iconOnly?: boolean;
}

function ButtonCore({
  appearance,
  size = 'medium',
  icon,
  iconPosition = 'start',
  fullWidth,
  loading,
  loadingLabel = 'Working',
  disabledFocusable,
  iconOnly,
  className,
  type = 'button',
  onClick,
  disabled,
  children,
  ...rest
}: CoreProps) {
  useLoadingAnnouncement(loading, loadingLabel);
  const blocked = Boolean(loading || disabledFocusable);
  return (
    <button
      {...rest}
      type={type}
      disabled={disabled}
      aria-disabled={blocked ? true : undefined}
      aria-busy={loading ? true : undefined}
      onClick={blocked ? blockPress : onClick}
      className={lookClass(
        { appearance, size, fullWidth },
        { iconOnly, loading, centred: Boolean(loading && !icon) },
        className,
      )}
    >
      <Content size={size} icon={icon} iconPosition={iconPosition} loading={loading}>
        {children}
      </Content>
    </button>
  );
}

/** A button. Defaults to `type="button"`, appearance `secondary` and size `medium` (44 px). */
export function Button(props: ButtonProps) {
  return <ButtonCore {...props} />;
}

export interface IconButtonProps extends Omit<
  ButtonProps,
  'children' | 'icon' | 'iconPosition' | 'fullWidth' | 'aria-label'
> {
  icon: IconName;
  /** The accessible name: what the button does ("Close", "Clear search"). Required. */
  label: string;
}

/** A button that shows only an icon. It must say what it does, so `label` is required. */
export function IconButton({ icon, label, appearance = 'subtle', ...rest }: IconButtonProps) {
  return (
    <ButtonCore
      {...rest}
      appearance={appearance}
      icon={icon}
      iconOnly
      aria-label={label}
      title={label}
    />
  );
}

type ToggleContent =
  { children: ReactNode; label?: never } | { label: string; icon: IconName; children?: never };

export type ToggleButtonProps = Omit<
  ButtonProps,
  'children' | 'appearance' | 'aria-pressed' | 'loading' | 'loadingLabel' | 'onClick'
> & {
  appearance?: 'secondary' | 'outline' | 'subtle';
  pressed: boolean;
  onPressedChange(pressed: boolean): void;
} & ToggleContent;

/**
 * A button that is on or off ("Hands-free", "Captions"), announced as pressed or not pressed. Give
 * it text as children, or an `icon` and a `label` for an icon-only toggle. For choosing one of
 * several, use SegmentedControl instead.
 */
export function ToggleButton({
  pressed,
  onPressedChange,
  appearance = 'secondary',
  label,
  children,
  className,
  ...rest
}: ToggleButtonProps) {
  const name = label === undefined ? {} : { 'aria-label': label, title: label };
  return (
    <ButtonCore
      {...rest}
      {...name}
      appearance={appearance}
      iconOnly={label !== undefined}
      aria-pressed={pressed}
      className={cx('ff-button--toggle', className)}
      onClick={() => onPressedChange(!pressed)}
    >
      {children}
    </ButtonCore>
  );
}

// ---- Links that look like buttons ----------------------------------------------------------

type LinkTarget =
  | { to: To; href?: never; external?: never; replace?: boolean; state?: unknown }
  | { href: string; external?: boolean; to?: never };

export type LinkButtonProps = ButtonLook &
  Omit<ComponentPropsWithRef<'a'>, 'href' | 'children'> & {
    children: ReactNode;
  } & LinkTarget;

/** The cue that a link leaves Firefly: an icon and words for people who cannot see the icon. */
export const OPENS_IN_NEW_TAB = 'opens in a new tab';

/**
 * A link styled as a button: a router `Link` for a place in Firefly (`to`), or a plain anchor for
 * an address elsewhere (`href`). `external` opens a new tab with `rel="noopener noreferrer"` and
 * says so with an icon and hidden text.
 */
export function LinkButton(props: LinkButtonProps) {
  const {
    appearance,
    size = 'medium',
    icon,
    iconPosition = 'start',
    fullWidth,
    className,
    children,
    to,
    href,
    external,
    replace,
    state,
    ...rest
  } = props as LinkButtonProps & { replace?: boolean; state?: unknown; external?: boolean };
  const classes = lookClass({ appearance, size, fullWidth }, {}, className);
  const cue = external ? (
    <>
      <Icon name="external-link" size={ICON_PX[size]} />
      <VisuallyHidden>, {OPENS_IN_NEW_TAB}</VisuallyHidden>
    </>
  ) : null;
  const content = (
    <Content size={size} icon={icon} iconPosition={iconPosition} trailing={cue}>
      {children}
    </Content>
  );
  if (to !== undefined) {
    return (
      <Link {...rest} to={to} replace={replace} state={state} className={classes}>
        {content}
      </Link>
    );
  }
  return (
    <a
      {...rest}
      href={href}
      className={classes}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
    >
      {content}
    </a>
  );
}
