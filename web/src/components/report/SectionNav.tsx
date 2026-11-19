import { useEffect, useRef } from 'react';
import { useMediaQuery } from '../../lib/hooks.ts';
import { Disclosure } from './Disclosure.tsx';
import { useScrollSpy } from './useScrollSpy.ts';

export interface NavItem {
  id: string;
  label: string;
}

/**
 * In-page section links. A sticky bar where there is room (it follows the section being read), a
 * collapsed "Jump to a section" disclosure on tablets and phones. The section currently near the top
 * of the page is marked with aria-current.
 */
export function SectionNav({ items }: { items: readonly NavItem[] }) {
  const wide = useMediaQuery('(min-width: 961px)');
  const active = useScrollSpy(items.map((item) => item.id));
  const listRef = useRef<HTMLOListElement>(null);

  // The bar can be wider than the space it has, so keep the current section's link in view.
  useEffect(() => {
    const list = listRef.current;
    const link = list?.querySelector<HTMLElement>('[aria-current="location"]');
    if (!list || !link) return;
    const bounds = list.getBoundingClientRect();
    const spot = link.getBoundingClientRect();
    if (spot.left < bounds.left || spot.right > bounds.right) {
      list.scrollLeft += spot.left - bounds.left - (bounds.width - spot.width) / 2;
    }
  }, [active]);

  const list = (
    <ol role="list" className="rp-nav-list" ref={listRef}>
      {items.map((item) => (
        <li key={item.id}>
          <a
            href={`#${item.id}`}
            className="rp-nav-link"
            aria-current={active === item.id ? 'location' : undefined}
          >
            {item.label}
          </a>
        </li>
      ))}
    </ol>
  );
  if (wide) {
    return (
      <nav className="rp-nav glass" aria-label="On this page">
        <p className="t-label rp-nav-title">On this page</p>
        {list}
      </nav>
    );
  }
  return (
    <nav className="rp-jump" aria-label="On this page">
      <Disclosure summary="Jump to a section">{list}</Disclosure>
    </nav>
  );
}
