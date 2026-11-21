import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { isPlainClick, jumpToSection, originOf, scrollToElement } from './dom.ts';
import { seeTurnText, turnName } from './copy.ts';
import { turnId } from './transcript-model.ts';

// Evidence navigation. Every quote in the report points at a turn in the transcript. A link to a
// turn scrolls there, moves focus to the turn, marks it (and the quoted words in it) and remembers
// where the person came from, so "Back to ..." can return them to the same place.

export interface EvidenceTarget {
  turnIndex: number;
  /** The quoted words to mark inside the turn, or null to mark only the turn. */
  quote: string | null;
  /** Changes on every jump, so following the same link twice runs again. */
  nonce: number;
}

export interface EvidenceOrigin {
  /** The part of the report the link was in: "What went well". */
  label: string;
  element: HTMLElement | null;
}

interface EvidenceValue {
  target: EvidenceTarget | null;
  origin: EvidenceOrigin | null;
  hasTurn(index: number): boolean;
  goToTurn(index: number, quote: string | null, from: HTMLElement): void;
  backToOrigin(): void;
}

const EvidenceContext = createContext<EvidenceValue | null>(null);

export function EvidenceProvider({
  turnIndexes,
  children,
}: {
  /** The turns the transcript has: a link to any other turn is shown as plain text. */
  turnIndexes: readonly number[];
  children: ReactNode;
}) {
  const [target, setTarget] = useState<EvidenceTarget | null>(null);
  const [origin, setOrigin] = useState<EvidenceOrigin | null>(null);
  const jumps = useRef(0);
  const known = useMemo(() => new Set(turnIndexes), [turnIndexes]);

  const hasTurn = useCallback((index: number) => known.has(index), [known]);

  const goToTurn = useCallback((index: number, quote: string | null, from: HTMLElement) => {
    jumps.current += 1;
    setOrigin({ label: originOf(from) ?? 'the report', element: from });
    setTarget({ turnIndex: index, quote, nonce: jumps.current });
  }, []);

  const backToOrigin = useCallback(() => {
    const element = origin?.element;
    setTarget(null);
    setOrigin(null);
    if (!element?.isConnected) return;
    scrollToElement(element);
    element.focus({ preventScroll: true });
  }, [origin]);

  const value = useMemo(
    () => ({ target, origin, hasTurn, goToTurn, backToOrigin }),
    [target, origin, hasTurn, goToTurn, backToOrigin],
  );
  return <EvidenceContext.Provider value={value}>{children}</EvidenceContext.Provider>;
}

export function useEvidence(): EvidenceValue {
  const value = useContext(EvidenceContext);
  if (!value) throw new Error('useEvidence must be used inside EvidenceProvider');
  return value;
}

/**
 * "See turn 6 in the transcript". A link to the turn that scrolls, focuses and marks it. If the
 * transcript has no such turn it is plain text, never a link that goes nowhere.
 */
export function TurnLink({
  turnIndex,
  quote = null,
  children,
  className,
}: {
  turnIndex: number;
  /** The quoted words to mark inside the turn. */
  quote?: string | null;
  children?: ReactNode;
  className?: string;
}) {
  const { hasTurn, goToTurn } = useEvidence();
  if (!hasTurn(turnIndex))
    return <span className={className}>{children ?? turnName(turnIndex)}</span>;
  const follow = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!isPlainClick(event)) return;
    event.preventDefault();
    goToTurn(turnIndex, quote, event.currentTarget);
  };
  return (
    <a href={`#${turnId(turnIndex)}`} className={className ?? 'rp-turnlink'} onClick={follow}>
      {children ?? seeTurnText(turnIndex)}
    </a>
  );
}

/** A link to a section of the report: scrolls there and puts focus on its heading. */
export function SectionLink({
  to,
  children,
  ...rest
}: { to: string; children: ReactNode } & Omit<ComponentPropsWithoutRef<'a'>, 'href'>) {
  const follow = (event: MouseEvent<HTMLAnchorElement>) => {
    rest.onClick?.(event);
    if (!isPlainClick(event)) return;
    event.preventDefault();
    jumpToSection(to);
  };
  return (
    <a {...rest} href={`#${to}`} onClick={follow}>
      {children}
    </a>
  );
}
