import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { createPath, type To } from 'react-router';

/** What the app header shows about where the person is. */
export interface AppSection {
  title: string;
  backTo?: string;
  backLabel?: string;
}

type SetSection = (section: AppSection | null) => void;

// Two contexts: a page only ever sets the section, so it must not re-render when the section changes.
const SectionContext = createContext<AppSection | null>(null);
const SetSectionContext = createContext<SetSection | null>(null);

/** Holds the current section for the app header. Mounted by AppLayout. */
export function SectionProvider({ children }: { children: ReactNode }) {
  const [section, setSection] = useState<AppSection | null>(null);
  return (
    <SetSectionContext.Provider value={setSection}>
      <SectionContext.Provider value={section}>{children}</SectionContext.Provider>
    </SetSectionContext.Provider>
  );
}

/** The section a page has announced, or null. Read by the app header. */
export function useCurrentSection(): AppSection | null {
  return useContext(SectionContext);
}

export interface AppSectionOptions {
  /** Where a Back control goes. On narrow screens the header shows it in place of the wordmark. */
  backTo?: To;
  /** What the place behind it is called, for example "Scenarios". Defaults to "Back". */
  backLabel?: string;
}

/**
 * Tells the app header which section this page is: `useAppSection('Scenarios')`. Pass `backTo` (and
 * a `backLabel`) on a page that sits below another, so the header offers a way back. Outside the
 * app layout it does nothing.
 */
export function useAppSection(title: string, options: AppSectionOptions = {}): void {
  const setSection = useContext(SetSectionContext);
  const { backTo, backLabel } = options;
  const back =
    backTo === undefined ? undefined : typeof backTo === 'string' ? backTo : createPath(backTo);
  useEffect(() => {
    if (!setSection) return;
    setSection({ title, backTo: back, backLabel });
    return () => setSection(null);
  }, [setSection, title, back, backLabel]);
}
