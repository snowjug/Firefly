import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { normaliseSearch } from './workspace-url.ts';

/** Choices that the address has not caught up with yet. */
interface Pending {
  /** The latest choice: what to show. */
  search: string;
  /** The address before the first of these choices. */
  from: string;
  /** Earlier choices, which may commit before the latest one does. */
  earlier: string[];
}

/** Still waiting if the address is where it was, or at one of our own earlier choices. */
function isWaiting(pending: Pending, address: string): boolean {
  return address === pending.from || pending.earlier.includes(address);
}

/** A choice that never reaches the address (it was refused) must not hold the screen for ever. */
const GIVE_UP_MS = 2000;

/**
 * The workspace's query string, as the person last chose it.
 *
 * The router takes a few frames to commit a navigation. A control that waits for the address would
 * show its old value for those frames (the highlighted option goes dark, then lights up again), so a
 * choice is shown at once and the address follows it. The address is replaced, never added to. Once
 * the address has caught up with the latest choice, or has been moved by something else (such as
 * Back), the address is the truth again.
 */
export function useWorkspaceSearch() {
  const { search: address } = useLocation();
  const navigate = useNavigate();
  const [pending, setPending] = useState<Pending | null>(null);

  // Choices made so far: counted the moment each is made (`made`), and as the last render knew
  // them (`drawn`). They differ while a choice has been made but not yet drawn.
  const made = useRef(0);
  const [drawn, setDrawn] = useState(0);

  const here = normaliseSearch(address);
  const waiting =
    pending !== null && here !== normaliseSearch(pending.search) && isWaiting(pending, here);
  if (pending !== null && !waiting) setPending(null);

  useEffect(() => {
    if (pending === null) return;
    const timer = setTimeout(() => setPending(null), GIVE_UP_MS);
    return () => clearTimeout(timer);
  }, [pending]);

  const replace = useCallback(
    (search: string) => {
      made.current += 1;
      setDrawn(made.current);
      setPending((current) => ({
        search,
        from: current?.from ?? normaliseSearch(address),
        earlier: current ? [...current.earlier, normaliseSearch(current.search)] : [],
      }));
      void navigate({ search }, { replace: true, preventScrollReset: true });
    },
    [navigate, address],
  );

  /**
   * Moves the address to a tidied form, unless a choice has been made since the render that worked
   * that form out. An effect runs a little after its render, and a choice can land in between (the
   * effect's own view of `settled` and `address` cannot know); applying the tidied form then would
   * undo the choice.
   */
  const tidy = useCallback(
    (search: string) => {
      if (made.current === drawn) replace(search);
    },
    [drawn, replace],
  );

  return {
    /** What to show: the latest choice while the address catches up, else the address. */
    search: waiting ? pending.search : address,
    /** What the address says right now. */
    address,
    /** The address has caught up with every choice. */
    settled: !waiting,
    replace,
    tidy,
  };
}
