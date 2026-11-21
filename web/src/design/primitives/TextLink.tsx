import type { ComponentPropsWithRef, ReactNode } from 'react';
import { Link, type To } from 'react-router';
import { cx } from '../cx.ts';
import { Icon } from '../icons.tsx';
import { OPENS_IN_NEW_TAB } from './Button.tsx';
import { VisuallyHidden } from './VisuallyHidden.tsx';
import './text-link.css';

type TextLinkTarget =
  | { to: To; href?: never; external?: never; replace?: boolean; state?: unknown }
  | { href: string; external?: boolean; to?: never };

export type TextLinkProps = Omit<ComponentPropsWithRef<'a'>, 'href' | 'children'> & {
  children: ReactNode;
  /** `inherit` takes the colour of the text around it (footers); `brand` is the link blue. */
  tone?: 'brand' | 'inherit';
} & TextLinkTarget;

/**
 * An inline link: a router `Link` inside Firefly (`to`), or an anchor for somewhere else (`href`).
 * With `external` it opens a new tab, uses `rel="noopener noreferrer"` and says so in an icon and
 * in words for those who cannot see the icon.
 */
export function TextLink(props: TextLinkProps) {
  const {
    tone = 'brand',
    className,
    children,
    to,
    href,
    external,
    replace,
    state,
    ...rest
  } = props as TextLinkProps & { replace?: boolean; state?: unknown; external?: boolean };
  const classes = cx('ff-link', tone === 'inherit' && 'ff-link--inherit', className);
  if (to !== undefined) {
    return (
      <Link {...rest} to={to} replace={replace} state={state} className={classes}>
        {children}
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
      {children}
      {external ? (
        <>
          <Icon name="external-link" size={14} className="ff-link__icon" />
          <VisuallyHidden>, {OPENS_IN_NEW_TAB}</VisuallyHidden>
        </>
      ) : null}
    </a>
  );
}

export interface BackLinkProps {
  to: To;
  children: ReactNode;
  className?: string;
}

/** A link back to where the person came from: "Back to scenarios". A 44 px target. */
export function BackLink({ to, children, className }: BackLinkProps) {
  return (
    <Link to={to} className={cx('ff-backlink', className)}>
      <Icon name="chevron-left" size={18} />
      <span>{children}</span>
    </Link>
  );
}

export interface BreadcrumbItem {
  label: string;
  /** Leave out for the current page. */
  to?: To;
}

/** Where the page sits: links to the places above it, and the current page last. */
export function Breadcrumb({
  items,
  label = 'Breadcrumb',
  className,
}: {
  items: readonly BreadcrumbItem[];
  label?: string;
  className?: string;
}) {
  return (
    <nav aria-label={label} className={cx('ff-breadcrumb', className)}>
      <ol className="ff-breadcrumb__list" role="list">
        {items.map((item, index) => (
          <li className="ff-breadcrumb__item" key={`${item.label}-${index}`}>
            {item.to !== undefined ? (
              <Link to={item.to} className="ff-breadcrumb__link">
                {item.label}
              </Link>
            ) : (
              <span className="ff-breadcrumb__current" aria-current="page">
                {item.label}
              </span>
            )}
            {index < items.length - 1 ? (
              <Icon name="chevron-right" size={14} className="ff-breadcrumb__separator" />
            ) : null}
          </li>
        ))}
      </ol>
    </nav>
  );
}
