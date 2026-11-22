import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { isPlainClick, jumpToSection, originOf, scrollToElement, type Focusable } from './dom.ts';
import { seeTurnText, turnName } from './copy.ts';
import {
  isVerifiedQuote,
  turnLookup,
  type EvidenceTurn,
  type TurnLookup,
} from './evidence-model.ts';
import { turnId } from './transcript-model.ts';

// Evidence navigation. Every quote in the report points at a turn in the transcript. A link to a
// turn scrolls there, moves focus to the turn, marks it (and the quoted words in it) for a few
// seconds and remembers where the person came from, so "Back to ..." can return them to the same
// place. The provider also holds the transcript itself, so that a quote is only ever shown as
// evidence when the turn it names really says it.

/** How long the turn a link led to stays marked. The "Back to" control stays until it is used. */
export const HIGHLIGHT_MS = 4000;

export interface EvidenceTarget {
  turnIndex: number;
  /** The quoted words to mark inside the turn, or null to mark only the turn. */
  quote: string | null;
  /** Changes on every jump, so following the same link twice runs again. */
  nonce: number;
}

export interface EvidenceOrigin {
  /** The part of the report the link was in: "Strengths". */
  label: string;
  element: Focusable | null;
}

interface EvidenceValue {
  /** The turn the last link led to, until the person goes back. */
  target: EvidenceTarget | null;
  /** The same turn, only while it is still marked. */
  highlight: EvidenceTarget | null;
  origin: EvidenceOrigin | null;
  /** The transcript, by turn number. */
  turns: TurnLookup;
  hasTurn(index: number): boolean;
  /** True when the trainee said `quote` in turn `turnIndex`: the only quote that may be shown as evidence. */
  verify(turnIndex: number | null, quote: string | null | undefined): boolean;
  goToTurn(index: number, quote: string | null, from: Focusable): void;
  backToOrigin(): void;
}

const EvidenceContext = createContext<EvidenceValue | null>(null);

export function EvidenceProvider({
  turns,
  children,
}: {
  /** The turns the transcript has: a link to any other turn is shown as plain text. */
  turns: readonly EvidenceTurn[];
  children: ReactNode;
}) {
  const [target, setTarget] = useState<EvidenceTarget | null>(null);
  const [origin, setOrigin] = useState<EvidenceOrigin | null>(null);
  const [expired, setExpired] = useState(0);
  const jumps = useRef(0);
  const lookup = useMemo(() => turnLookup(turns), [turns]);

  const hasTurn = useCallback((index: number) => lookup.has(index), [lookup]);
  const verify = useCallback(
    (turnIndex: number | null, quote: string | null | undefined) =>
      isVerifiedQuote(lookup, turnIndex, quote),
    [lookup],
  );

  const goToTurn = useCallback((index: number, quote: string | null, from: Focusable) => {
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

  // The mark is temporary: it was there to show where the quote is, and then it gets out of the way.
  useEffect(() => {
    if (!target) return;
    const { nonce } = target;
    const timer = window.setTimeout(() => setExpired(nonce), HIGHLIGHT_MS);
    return () => window.clearTimeout(timer);
  }, [target]);
  const highlight = target && expired !== target.nonce ? target : null;

  const value = useMemo(
    () => ({
      target,
      highlight,
      origin,
      turns: lookup,
      hasTurn,
      verify,
      goToTurn,
      backToOrigin,
    }),
    [target, highlight, origin, lookup, hasTurn, verify, goToTurn, backToOrigin],
  );
  return <EvidenceContext.Provider value={value}>{children}</EvidenceContext.Provider>;
}

export function useEvidence(): EvidenceValue {
  const value = useContext(EvidenceContext);
  if (!value) throw new Error('useEvidence must be used inside EvidenceProvider');
  return value;
}

/**
 * "See turn 6". A link to the turn that scrolls, focuses and marks it; its name is "See turn 6 in
 * the transcript". If the transcript has no such turn it is plain text, never a link that goes
 * nowhere.
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
  /** Words for the link. Without them it says "See turn N" and is named in full. */
  children?: ReactNode;
  className?: string;
}) {
  const { hasTurn, goToTurn } = useEvidence();
  if (!hasTurn(turnIndex)) {
    return <span className={className}>{children ?? turnName(turnIndex)}</span>;
  }
  const follow = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!isPlainClick(event)) return;
    event.preventDefault();
    goToTurn(turnIndex, quote, event.currentTarget);
  };
  return (
    <a
      href={`#${turnId(turnIndex)}`}
      className={className ?? 'rp-turnlink'}
      aria-label={children === undefined ? seeTurnText(turnIndex) : undefined}
      onClick={follow}
    >
      {children ?? `See turn ${turnIndex}`}
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
