import type { ComponentPropsWithRef, ElementType } from 'react';
import { cx } from '../cx.ts';
import './surface.css';

export type SurfaceTag = 'div' | 'section' | 'article' | 'aside' | 'li' | 'header' | 'footer';

export interface SurfaceProps extends ComponentPropsWithRef<'div'> {
  /** The element to render. Use `section` or `article` only with a heading inside. */
  as?: SurfaceTag;
  /** `flat` is a quiet fill, `outlined` a hairline border, `elevated` a soft shadow. */
  appearance?: 'flat' | 'outlined' | 'elevated';
  /** 0, 12, 16, 24 and 32 px; the two larger steps reduce on narrow screens. */
  padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
}

/** A container with a fill or an edge and padding from the scale. Also exported as `Card`. */
export function Surface({
  as = 'div',
  appearance = 'outlined',
  padding = 'md',
  className,
  ...rest
}: SurfaceProps) {
  const Tag = as as ElementType;
  return (
    <Tag
      {...rest}
      className={cx(
        'ff-surface',
        `ff-surface--${appearance}`,
        `ff-surface--pad-${padding}`,
        className,
      )}
    />
  );
}

export const Card = Surface;
