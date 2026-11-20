import type { ReactNode } from 'react';
import '../../styles/frame.css';

export type TagTone = 'neutral' | 'amber' | 'aqua' | 'sage' | 'coral';

/**
 * A short mono label with a point in front of it. The words carry the meaning; the point's colour
 * and fill (hollow for neutral) only add to it, so it is never colour alone. Not a chip: no box.
 */
export function Tag({ children, tone = 'neutral' }: { children: ReactNode; tone?: TagTone }) {
  return (
    <span className="ff-tag" data-tone={tone}>
      {children}
    </span>
  );
}
