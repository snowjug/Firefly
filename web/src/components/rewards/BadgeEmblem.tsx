import { useId } from 'react';
import { Icon, type IconName } from '../Icon.tsx';

const SHIELD =
  'M32 2.5 C40 7 49 9.5 59 10 V35 C59 52 48.5 63.5 32 69.5 C15.5 63.5 5 52 5 35 V10 C15 9.5 24 7 32 2.5 Z';

/**
 * A badge as a small shield. Earned ones are full colour; ones not earned yet are grey. The colour
 * is only a second signal: every badge says "Earned" or "Locked" in words, so this is decoration.
 */
export function BadgeEmblem({
  icon,
  tone,
  earned,
}: {
  icon: IconName;
  tone: 'amber' | 'violet';
  earned: boolean;
}) {
  const id = `emblem-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <span className="rw-emblem" data-tone={tone} data-earned={earned ? 'true' : 'false'}>
      <svg viewBox="0 0 64 72" width="64" height="72" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0.35" y2="1">
            <stop offset="0" className="rw-emblem-top" />
            <stop offset="1" className="rw-emblem-bottom" />
          </linearGradient>
        </defs>
        <path d={SHIELD} className="rw-emblem-body" fill={`url(#${id})`} />
        <path
          d={SHIELD}
          className="rw-emblem-inner"
          fill="none"
          transform="translate(32 36) scale(0.82) translate(-32 -36)"
        />
      </svg>
      <span className="rw-emblem-glyph">
        <Icon name={icon} size={26} />
      </span>
    </span>
  );
}
