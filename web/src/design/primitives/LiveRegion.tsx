import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { createAnnouncerQueue } from './announcer.ts';

/** Announces one whole sentence politely. Without a provider it does nothing. */
export type Announce = (message: string) => void;

const AnnouncerContext = createContext<Announce>(() => undefined);

/**
 * Returns `announce(sentence)`. Sentences are queued, de-duplicated and read one at a time through
 * the single polite region the provider renders. Use it for changes a screen reader user would
 * otherwise miss ("Message sent", "Call paused"), never for text that changes as it is typed or
 * spoken.
 */
export function useAnnouncer(): Announce {
  return useContext(AnnouncerContext);
}

/** The visually hidden polite region. The provider renders exactly one of these. */
export function LiveRegion({ message }: { message: string }) {
  return (
    <div role="status" aria-live="polite" aria-atomic="true" className="visually-hidden">
      {message}
    </div>
  );
}

/**
 * Provides `useAnnouncer` to everything inside and renders one `role="status"` region. Mount it
 * once near the root. A Dialog mounts its own, because a modal dialog makes the rest of the page
 * inert and an inert region is not read.
 */
export function AnnouncerProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState('');
  const [queue] = useState(() => createAnnouncerQueue(setMessage));
  useEffect(() => () => queue.dispose(), [queue]);
  return (
    <AnnouncerContext.Provider value={queue.announce}>
      {children}
      <LiveRegion message={message} />
    </AnnouncerContext.Provider>
  );
}
