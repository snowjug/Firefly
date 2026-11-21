import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useReducedMotion } from '../../lib/theme.tsx';
import { Icon } from '../Icon.tsx';
import type { CueLevel } from './atmosphere.ts';
import { buildPath, isNearBottom, scrollIntent } from './chamber-model.ts';
import { spineMoods } from './spine-model.ts';
import { Turn, TypingTurn } from './Turn.tsx';
import type { ChatShift, ChatTurn, TurnMood } from './useCall.ts';

/** How many of the newest turns are always fully drawn; older ones are drawn as they come into view. */
export const NEAR_TURNS = 14;

/** Where a newly arrived turn comes to rest, as a share of the visible height from the top. */
const REST_AT = 0.3;
/** How much of a turn has to be in view for the reader to count as being at the latest one. */
const HEAD_PX = 160;
/** How long a turn keeps being re-aimed at while it comes to rest: longer than the line before it takes to shrink. */
const FOLLOW_MS = 900;

const NO_KEYS: string[] = [];
const NO_SHIFTS: ChatShift[] = [];
const NO_MOODS: Record<string, TurnMood> = {};

function offsetIn(scroller: HTMLElement, element: HTMLElement): number {
  return (
    element.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop
  );
}

/**
 * The conversation as a page: each turn is a line set along the filament, the latest customer line
 * large and the rest receding. It follows new turns while the reader is at the latest one, leaves
 * them alone while they re-read, and says so ("Jump to latest") when something arrived below. It
 * does not redraw while the person types, so a long call stays quick to type in.
 */
export const Conversation = memo(function Conversation({
  turns,
  customer,
  typing,
  cue,
  signalKeys = NO_KEYS,
  shifts = NO_SHIFTS,
  moods = NO_MOODS,
  onRetry,
  onListen,
}: {
  turns: ChatTurn[];
  customer: string;
  /** The customer is composing a reply. */
  typing: boolean;
  cue: CueLevel;
  signalKeys?: string[];
  shifts?: ChatShift[];
  moods?: Record<string, TurnMood>;
  onRetry(key: string): void;
  /** Adds a "Listen" button to each customer turn. */
  onListen?: (text: string) => void;
}) {
  const reducedMotion = useReducedMotion();
  const scroller = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLOListElement>(null);
  const atLatestRef = useRef(true);
  const ownScrollUntil = useRef(0);
  const following = useRef(false);
  const frame = useRef(0);
  const opened = useRef(false);
  const previousKey = useRef<string | null>(null);
  const [atLatest, setAtLatest] = useState(true);
  const [seen, setSeen] = useState(turns.length);
  const [openingKeys] = useState(() => new Set(turns.map((turn) => turn.key)));

  const nodes = useMemo(
    () => buildPath(turns, { signalKeys, shifts, cue, pending: typing }),
    [turns, signalKeys, shifts, cue, typing],
  );
  const turnMoods = useMemo(
    () => spineMoods(nodes, cue === 'full' ? moods : NO_MOODS),
    [nodes, cue, moods],
  );

  const last = turns[turns.length - 1];
  const lastKey = last?.key ?? null;
  const lastRole = last?.role;
  // A message that did not get through grows a retry line under it: keep that in view too.
  const lastStatus = last?.status;

  const latestTurn = useCallback((): HTMLElement | null => {
    const items = list.current?.querySelectorAll<HTMLElement>(':scope > li[data-turn]');
    return items && items.length > 0 ? (items[items.length - 1] ?? null) : null;
  }, []);

  /** Lets go of the page: the reader has taken over, or the view is going away. */
  const letGo = useCallback(() => {
    if (frame.current) cancelAnimationFrame(frame.current);
    frame.current = 0;
    following.current = false;
  }, []);
  useEffect(() => letGo, [letGo]);
  // Any input from the reader ends the view's own scrolling at once.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const events = ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const;
    for (const name of events) el.addEventListener(name, letGo, { passive: true });
    return () => {
      for (const name of events) el.removeEventListener(name, letGo);
    };
  }, [letGo]);

  /**
   * Brings a turn to rest a little way down the page, so the line before it still shows above.
   * While it eases there it keeps re-aiming at the turn's real place, because the line that was the
   * latest is shrinking at the same time and moves everything below it; any input from the reader
   * ends it at once.
   */
  const rest = useCallback(
    (element: HTMLElement | null, smooth: boolean) => {
      const el = scroller.current;
      if (!el || !element) return;
      letGo();
      const target = () =>
        Math.min(
          Math.max(0, offsetIn(el, element) - el.clientHeight * REST_AT),
          Math.max(0, el.scrollHeight - el.clientHeight),
        );
      if (!smooth || reducedMotion) {
        ownScrollUntil.current = performance.now() + 80;
        el.scrollTop = target();
        return;
      }
      following.current = true;
      const started = performance.now();
      let before = started;
      const step = (now: number) => {
        const dt = Math.min(48, now - before);
        before = now;
        const delta = target() - el.scrollTop;
        el.scrollTop += delta * (1 - Math.exp(-dt / 140));
        if (now - started < FOLLOW_MS || Math.abs(delta) > 0.6) {
          frame.current = requestAnimationFrame(step);
        } else {
          frame.current = 0;
          following.current = false;
        }
      };
      frame.current = requestAnimationFrame(step);
    },
    [reducedMotion, letGo],
  );

  useEffect(() => {
    // Opening a call (or coming back to it) lands on the newest customer turn at once instead of
    // animating through the whole conversation; later turns come to rest smoothly.
    if (!opened.current) {
      opened.current = true;
      previousKey.current = lastKey;
      const customers = list.current?.querySelectorAll<HTMLElement>(
        ':scope > li[data-role="customer"]',
      );
      const newest = customers && customers.length > 0 ? customers[customers.length - 1] : null;
      rest(newest ?? latestTurn(), false);
      return;
    }
    const arrived = lastKey !== previousKey.current;
    previousKey.current = lastKey;
    if (arrived) {
      // The reader's own message always brings them to the end; a reply only does if they were there.
      if (scrollIntent(atLatestRef.current, lastRole ?? 'customer') === 'stick') {
        rest(latestTurn(), true);
        atLatestRef.current = true;
      }
    } else if (atLatestRef.current && !following.current) {
      // Nothing new, but the line under the newest turn changed (sending, failed, typing).
      latestTurn()?.scrollIntoView({
        block: 'nearest',
        behavior: reducedMotion ? 'auto' : 'smooth',
      });
    }
  }, [lastKey, lastRole, lastStatus, typing, latestTurn, rest, reducedMotion]);

  const onScroll = () => {
    if (following.current || performance.now() < ownScrollUntil.current) return;
    const el = scroller.current;
    const newest = latestTurn();
    if (!el || !newest) return;
    // At the latest turn once its first lines are in view.
    const near = isNearBottom(
      {
        scrollTop: el.scrollTop,
        clientHeight: el.clientHeight,
        scrollHeight: offsetIn(el, newest) + Math.min(newest.offsetHeight, HEAD_PX),
      },
      0,
    );
    atLatestRef.current = near;
    setAtLatest(near);
    if (near) setSeen(turns.length);
  };

  const jump = () => {
    rest(latestTurn(), true);
    atLatestRef.current = true;
    setAtLatest(true);
    setSeen(turns.length);
  };

  const unread = atLatest ? 0 : Math.max(0, turns.length - seen);
  const near = nodes.length - NEAR_TURNS;

  return (
    <div className="ch-conv">
      <div
        ref={scroller}
        className="ch-conv__scroll"
        onScroll={onScroll}
        tabIndex={0}
        role="region"
        aria-label="Conversation"
      >
        <div className="ch-conv__page">
          <p className="ch-conv__note">
            You are speaking with a simulated customer. Everything in this call is fictional.
          </p>
          <ol ref={list} role="list" className="ch-turns">
            {nodes.map((node, index) => (
              <Turn
                key={node.key}
                node={node}
                customer={customer}
                mood={cue === 'full' ? (turnMoods[index] ?? null) : null}
                fresh={!openingKeys.has(node.key)}
                near={index >= near}
                onRetry={onRetry}
                onListen={onListen}
              />
            ))}
            {typing ? <TypingTurn customer={customer} /> : null}
          </ol>
        </div>
      </div>
      {atLatest ? null : (
        <button type="button" className="ch-jump glass glass--control" onClick={jump}>
          <Icon name="chevron-down" size={16} />
          {unread > 0 ? `${unread} new ${unread === 1 ? 'message' : 'messages'}` : 'Jump to latest'}
        </button>
      )}
    </div>
  );
});
