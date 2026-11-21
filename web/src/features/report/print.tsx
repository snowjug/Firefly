import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';

// Printing. A closed disclosure does not print its contents, so just before the browser makes the
// print layout every skill detail is opened, and put back afterwards.

interface PrintState {
  printing: boolean;
  /** When the report was last printed (or when this page opened, before any printing). */
  printedAt: Date;
}

const PrintContext = createContext<PrintState>({ printing: false, printedAt: new Date(0) });

export function PrintProvider({ children }: { children: ReactNode }) {
  const [printing, setPrinting] = useState(false);
  const [printedAt, setPrintedAt] = useState(() => new Date());

  useEffect(() => {
    // Synchronous, so the opened disclosures are in the page before the browser lays it out for paper.
    const before = () =>
      flushSync(() => {
        setPrintedAt(new Date());
        setPrinting(true);
      });
    const after = () => setPrinting(false);
    window.addEventListener('beforeprint', before);
    window.addEventListener('afterprint', after);
    return () => {
      window.removeEventListener('beforeprint', before);
      window.removeEventListener('afterprint', after);
    };
  }, []);

  const value = useMemo(() => ({ printing, printedAt }), [printing, printedAt]);
  return <PrintContext.Provider value={value}>{children}</PrintContext.Provider>;
}

/** True while the browser is preparing or making the printed page. */
export const usePrinting = (): boolean => useContext(PrintContext).printing;

export const usePrintedAt = (): Date => useContext(PrintContext).printedAt;
