import { useMediaQuery } from '../../lib/hooks.ts';
import { Disclosure } from './bridge.tsx';
import { useScrollSpy } from './useScrollSpy.ts';

export interface NavItem {
  id: string;
  label: string;
}

/**
 * In-page section links, set like the ruler of the dock: a hairline down the side with a numbered
 * stop for each section and an amber point at the one being read. It follows the page on a wide
 * screen; on tablets and phones it folds into a "Jump to a section" disclosure. The section near
 * the top of the page is marked with aria-current. The numbers are drawn by the stylesheet, so the
 * links stay exactly the section names.
 */
export function SectionRail({ items }: { items: readonly NavItem[] }) {
  const wide = useMediaQuery('(min-width: 1100px)');
  const active = useScrollSpy(items.map((item) => item.id));

  const list = (
    <ol role="list" className="rp-rail__list">
      {items.map((item) => (
        <li key={item.id}>
          <a
            href={`#${item.id}`}
            className="rp-rail__link"
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
        <p className="rp-rail__title type-label">On this page</p>
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
