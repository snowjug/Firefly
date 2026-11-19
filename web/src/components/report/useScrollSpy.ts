import { useEffect, useState } from 'react';

/**
 * Returns the id of the first listed section that is crossing the upper part of the viewport, or
 * null near the top of the page. Does nothing where IntersectionObserver is unavailable.
 */
export function useScrollSpy(ids: readonly string[]): string | null {
  const [active, setActive] = useState<string | null>(null);
  const key = ids.join('|');
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const list = key.split('|');
    const visible = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target.id);
          else visible.delete(entry.target.id);
        }
        const first = list.find((id) => visible.has(id));
        setActive(first ?? null);
      },
      { rootMargin: '-96px 0px -60% 0px', threshold: 0 },
    );
    for (const id of list) {
      const element = document.getElementById(id);
      if (element) observer.observe(element);
    }
    return () => observer.disconnect();
  }, [key]);
  return active;
}
