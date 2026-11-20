import { useId } from 'react';
import { useMediaQuery } from '../../lib/hooks.ts';
import { Disclosure } from '../frame/Disclosure.tsx';
import { useActiveSection } from './useActiveSection.ts';

export interface IndexItem {
  id: string;
  label: string;
}

/**
 * The page's index. Beside the text on wide screens, where it stays in view and marks the section
 * being read; a collapsed list above the text on narrow ones. Every entry is a real link to a
 * section, so it works without any of that.
 */
export function PageIndex({ items }: { items: readonly IndexItem[] }) {
  const wide = useMediaQuery('(min-width: 62rem)');
  const active = useActiveSection(ids(items));
  const labelId = useId();

  const list = (
    <ol role="list" className="ab-index__list">
      {items.map((item) => (
        <li key={item.id}>
          <a href={`#${item.id}`} aria-current={active === item.id ? 'location' : undefined}>
            {item.label}
          </a>
        </li>
      ))}
    </ol>
  );

  if (!wide) {
    return (
      <Disclosure summary="On this page">
        <nav className="ab-index" aria-label="On this page">
          {list}
        </nav>
      </Disclosure>
    );
  }
  return (
    <nav className="ab-index" aria-labelledby={labelId}>
      <p id={labelId} className="ab-index__label type-label">
        On this page
      </p>
      {list}
    </nav>
  );
}

// The same array every time, so the scroll observer is set up once.
const cache = new WeakMap<readonly IndexItem[], string[]>();
function ids(items: readonly IndexItem[]): string[] {
  let found = cache.get(items);
  if (!found) {
    found = items.map((item) => item.id);
    cache.set(items, found);
  }
  return found;
}
