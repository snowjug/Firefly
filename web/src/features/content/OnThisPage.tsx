import { useRef } from 'react';
import { Icon, TextLink } from '../../design/index.ts';
import { useMediaQuery } from '../../lib/hooks.ts';

export interface TocItem {
  id: string;
  label: string;
}

/**
 * "On this page": links to the sections of a long page. Always visible on a wide screen (where the
 * page keeps it in view while you read); folded into a disclosure on a narrow one, so it does not
 * push the text down the screen. Choosing a link there folds it again, so the section it names is
 * what you see.
 */
export function OnThisPage({ items }: { items: readonly TocItem[] }) {
  const wide = useMediaQuery('(min-width: 64em)');
  const details = useRef<HTMLDetailsElement>(null);
  const list = (
    <ul role="list" className="ct-toc__list">
      {items.map((item) => (
        <li key={item.id}>
          <TextLink
            to={`#${item.id}`}
            tone="inherit"
            onClick={() => {
              if (details.current) details.current.open = false;
            }}
          >
            {item.label}
          </TextLink>
        </li>
      ))}
    </ul>
  );
  return (
    <nav aria-label="On this page" className="ct-toc no-print">
      {wide ? (
        <>
          <p className="t-label ct-toc__label" aria-hidden="true">
            On this page
          </p>
          {list}
        </>
      ) : (
        <details ref={details} className="ct-toc__details">
          <summary className="ct-toc__summary">
            <span>On this page</span>
            <Icon name="chevron-down" size={18} className="ct-toc__chevron" />
          </summary>
          {list}
        </details>
      )}
    </nav>
  );
}
