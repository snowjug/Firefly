import { useEffect, useRef, useState } from 'react';
import { useSlidingIndicator } from '../../app/shell/use-sliding-indicator.ts';
import { SectionLink } from './evidence.tsx';
import type { SectionItem } from './report-model.ts';
import './report.css';

/**
 * The section the reader is in: the first one, in order, that overlaps the upper part of the
 * window. A section that has scrolled out of that band is no longer current; between two sections
 * the last one stays current.
 */
export function useActiveSection(ids: readonly string[]): string {
  // Before anything has scrolled into the band (the top of the page) the first part is current.
  const [active, setActive] = useState<string>(ids[0] ?? 'summary');
  const key = ids.join(' ');
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const list = key.split(' ');
    const inBand = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) inBand.add(entry.target.id);
          else inBand.delete(entry.target.id);
        }
        const first = list.find((id) => inBand.has(id));
        if (first) {
          setActive(first);
        } else if ((document.getElementById(list[0] ?? '')?.getBoundingClientRect().top ?? 0) > 0) {
          // Scrolled back above the first part: that part is the current one again.
          setActive(list[0] ?? 'summary');
        }
      },
      { rootMargin: '-80px 0px -60% 0px', threshold: 0 },
    );
    for (const id of list) {
      const element = document.getElementById(id);
      if (element) observer.observe(element);
    }
    return () => observer.disconnect();
  }, [key]);
  return active;
}

/**
 * "On this page" for wide screens: always in view beside the report, with the current part marked.
 * The mark is one line that slides to the part the reader has reached (transform only, from the
 * shell's `useSlidingIndicator`), and a click on an entry scrolls to it smoothly unless motion is
 * reduced.
 */
export function SectionNav({ items }: { items: readonly SectionItem[] }) {
  const active = useActiveSection(items.map((item) => item.id));
  const nav = useRef<HTMLElement>(null);
  useSlidingIndicator(nav, '[aria-current="location"]', active);
  return (
    <nav className="rp-nav no-print" aria-label="On this page" ref={nav}>
      <p className="rp-nav__title">On this page</p>
      <span className="rp-nav__indicator" aria-hidden="true" />
      <ul className="rp-nav__list" role="list">
        {items.map((item) => (
          <li key={item.id}>
            <SectionLink
              to={item.id}
              smooth
              className="rp-nav__link"
              aria-current={active === item.id ? 'location' : undefined}
            >
              {item.label}
            </SectionLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** "Jump to" for narrow screens: the same places in a disclosure at the top, closed again after a choice. */
export function JumpTo({ items }: { items: readonly SectionItem[] }) {
  const box = useRef<HTMLDetailsElement>(null);
  return (
    <details className="rp-jump no-print" ref={box}>
      <summary className="rp-jump__summary">Jump to</summary>
      <nav aria-label="Jump to">
        <ul className="rp-jump__list" role="list">
          {items.map((item) => (
            <li key={item.id}>
              <SectionLink
                to={item.id}
                smooth
                className="rp-jump__link"
                onClick={() => box.current?.removeAttribute('open')}
              >
                {item.label}
              </SectionLink>
            </li>
          ))}
        </ul>
      </nav>
    </details>
  );
}
