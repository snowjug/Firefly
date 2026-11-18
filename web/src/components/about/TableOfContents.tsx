export interface TocItem {
  id: string;
  label: string;
}

/** In-page navigation: sticky beside the text on wide screens, a compact block above it elsewhere. */
export function TableOfContents({ items }: { items: TocItem[] }) {
  return (
    <nav className="ab-toc" aria-label="On this page">
      <p className="t-label">On this page</p>
      <ol role="list">
        {items.map((item) => (
          <li key={item.id}>
            <a href={`#${item.id}`}>{item.label}</a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
