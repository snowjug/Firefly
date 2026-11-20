import type { ReactNode } from 'react';
import { useDocumentTitle } from '../../lib/hooks.ts';

/**
 * A call that cannot be shown: it is gone, or it could not be opened. One heading, what happened in
 * a sentence, and what to do next, set in the same type as the rest of the room.
 */
export function CallNotice({
  title,
  documentTitle,
  children,
  actions,
  tone,
}: {
  title: string;
  documentTitle: string;
  children: ReactNode;
  actions: ReactNode;
  tone?: 'negative';
}) {
  useDocumentTitle(documentTitle);
  return (
    <section
      className="ch-notice"
      data-tone={tone}
      role={tone === 'negative' ? 'alert' : undefined}
    >
      <p className="ch-eyebrow">Call</p>
      <h1 className="ch-notice__title">{title}</h1>
      <p className="ch-notice__text">{children}</p>
      <div className="ch-notice__actions">{actions}</div>
    </section>
  );
}
