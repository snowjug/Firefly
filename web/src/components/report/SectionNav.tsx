import { useMediaQuery } from '../../lib/hooks.ts';
import { Disclosure } from './Disclosure.tsx';
import { useScrollSpy } from './useScrollSpy.ts';

export interface NavItem {
  id: string;
  label: string;
}

/**
 * In-page section links. A sticky rail on wide screens, a collapsed "Jump to a section" disclosure
 * on narrow ones. The section currently near the top of the page is marked with aria-current.
 */
export function SectionNav({ items }: { items: readonly NavItem[] }) {
  const wide = useMediaQuery('(min-width: 1060px)');
  const active = useScrollSpy(items.map((item) => item.id));
  const list = (
    <ol role="list" className="rp-nav-list">
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
      <nav className="rp-rail" aria-label="On this page">
        <p className="t-label rp-rail-title">On this page</p>
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
