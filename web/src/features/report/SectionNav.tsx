import { useEffect, useRef, useState } from 'react';
import { SectionLink } from './evidence.tsx';
import './report.css';

/** The parts of the report, in order, as the navigation lists them. */
export const NAV_ITEMS = [
  { id: 'summary', label: 'Summary' },
  { id: 'scores', label: 'Scores' },
  { id: 'journey', label: 'Customer temperature' },
  { id: 'strengths', label: 'What went well' },
  { id: 'improvements', label: 'What to improve' },
  { id: 'skills', label: 'Skill details' },
  { id: 'discovery', label: 'Discovery review' },
  { id: 'next-practice', label: 'Next practice' },
  { id: 'actions', label: 'Actions' },
  { id: 'transcript', label: 'Transcript' },
  { id: 'about', label: 'About this report' },
] as const;

const NAV_IDS: readonly string[] = NAV_ITEMS.map((item) => item.id);

/**
 * The section the reader is in: the first one, in order, that overlaps the upper part of the
 * window. A section that has scrolled out of that band is no longer current; between two sections
 * the last one stays current.
 */
export function useActiveSection(): string {
  // Before anything has scrolled into the band (the top of the page) the first part is current.
  const [active, setActive] = useState<string>(NAV_IDS[0] ?? 'summary');
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const inBand = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) inBand.add(entry.target.id);
          else inBand.delete(entry.target.id);
        }
        const first = NAV_IDS.find((id) => inBand.has(id));
        if (first) {
          setActive(first);
        } else if (
          (document.getElementById(NAV_IDS[0] ?? '')?.getBoundingClientRect().top ?? 0) > 0
        ) {
          // Scrolled back above the first part: that part is the current one again.
          setActive(NAV_IDS[0] ?? 'summary');
        }
      },
      { rootMargin: '-80px 0px -60% 0px', threshold: 0 },
    );
    for (const id of NAV_IDS) {
      const element = document.getElementById(id);
      if (element) observer.observe(element);
    }
    return () => observer.disconnect();
  }, []);
  return active;
}

/** "On this page" for wide screens: always in view beside the report, with the current part marked. */
export function SectionNav() {
  const active = useActiveSection();
  return (
    <nav className="rp-nav no-print" aria-label="On this page">
      <p className="rp-nav__title">On this page</p>
      <ul className="rp-nav__list" role="list">
        {NAV_ITEMS.map((item) => (
          <li key={item.id}>
            <SectionLink
              to={item.id}
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
export function JumpTo() {
  const box = useRef<HTMLDetailsElement>(null);
  return (
    <details className="rp-jump no-print" ref={box}>
      <summary className="rp-jump__summary">Jump to</summary>
      <nav aria-label="Jump to">
        <ul className="rp-jump__list" role="list">
          {NAV_ITEMS.map((item) => (
            <li key={item.id}>
              <SectionLink
                to={item.id}
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
