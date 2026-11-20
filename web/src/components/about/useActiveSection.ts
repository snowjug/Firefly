import { useEffect, useState } from 'react';

/**
 * The id of the section the reader is in: the last one whose top has passed the upper part of the
 * window. It only changes what the index marks (and never scrolls anything), so where there is no
 * IntersectionObserver (a test, an old browser) the index simply has nothing marked.
 */
export function useActiveSection(ids: readonly string[]): string | null {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const sections = ids
      .map((id) => document.getElementById(id))
      .filter((element): element is HTMLElement => element !== null);
    if (sections.length === 0) return;

    // Which sections currently cross the reading line, kept in page order.
    const crossing = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) crossing.add(entry.target.id);
          else crossing.delete(entry.target.id);
        }
        const first = ids.find((id) => crossing.has(id));
        if (first) setActive(first);
      },
      // A thin band a little below the top of the window, so a section is "current" once its
      // heading has come up into the reading position.
      { rootMargin: '-12% 0px -78% 0px' },
    );
    for (const section of sections) observer.observe(section);
    return () => observer.disconnect();
  }, [ids]);

  return active;
}
