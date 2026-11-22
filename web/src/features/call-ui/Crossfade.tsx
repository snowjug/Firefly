import { useEffect, useState, type ReactNode } from 'react';

/** Never longer than the fade in the stylesheet: it only matters where no animation runs at all. */
const LEAVING_LIMIT_MS = 400;

interface Layer {
  id: string;
  node: ReactNode;
}

export interface CrossfadeProps {
  /** What is showing. When it changes, the old content fades out as the new content fades in. */
  id: string;
  children: ReactNode;
}

/**
 * A crossfade for a state that changes by name ("Calm" to "Concerned"): the outgoing content stays
 * for one short fade, hidden from assistive technology, under the incoming content, so the colour and
 * the word blend and nothing jumps. The first content is drawn as it is, without a fade. Each layer
 * keeps its own key, so the outgoing one is the same element it was and does not replay its own
 * entrance. Only opacity moves, and under reduced motion the change is plain.
 */
export function Crossfade({ id, children }: CrossfadeProps) {
  const [current, setCurrent] = useState<Layer>({ id, node: children });
  const [leaving, setLeaving] = useState<Layer[]>([]);
  const [changed, setChanged] = useState(false);

  if (current.id !== id) {
    setLeaving([...leaving.filter((layer) => layer.id !== id && layer.id !== current.id), current]);
    setCurrent({ id, node: children });
    setChanged(true);
  } else if (current.node !== children) {
    // What fades out is what was last drawn, not what was there when the content began: words that
    // grew under one name (a caption being spoken) leave as the whole line, not as its first word.
    setCurrent({ id, node: children });
  }

  useEffect(() => {
    if (leaving.length === 0) return;
    const timer = window.setTimeout(() => setLeaving([]), LEAVING_LIMIT_MS);
    return () => window.clearTimeout(timer);
  }, [leaving]);

  const layers = [...leaving.filter((layer) => layer.id !== id), { id, node: children }];
  return (
    <span className="cw-fade">
      {layers.map((layer) =>
        layer.id === id ? (
          <span
            key={layer.id}
            className={changed ? 'cw-fade__in cw-fade__in--enter' : 'cw-fade__in'}
          >
            {children}
          </span>
        ) : (
          <span
            key={layer.id}
            className="cw-fade__out"
            aria-hidden="true"
            onAnimationEnd={() => setLeaving((now) => now.filter((other) => other.id !== layer.id))}
          >
            {layer.node}
          </span>
        ),
      )}
    </span>
  );
}
