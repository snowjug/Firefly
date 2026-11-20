import { useId, type ReactNode } from 'react';

/**
 * One topic of the page: a hairline with a tick, the title and the text. It is an anchor target
 * that can take focus, so a link such as /help#voice lands on it and a keyboard or screen-reader
 * user starts reading there.
 */
export function AboutSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  const titleId = useId();
  return (
    <section id={id} tabIndex={-1} className="ab-section" aria-labelledby={titleId}>
      <h2 id={titleId} className="ab-title">
        {title}
      </h2>
      <div className="ab-prose">{children}</div>
    </section>
  );
}
