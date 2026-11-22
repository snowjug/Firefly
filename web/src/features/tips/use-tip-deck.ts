import { useCallback, useEffect, useRef, useState } from 'react';
import { nextTip, startingTip, type TipCallStage } from './selection.ts';
import type { Tip } from './tips.ts';

/** How the track gets to a tip: a gentle glide, or the spring a dragged card settles on. */
export type DeckMotion = 'glide' | 'spring';

export interface TipDeckOptions {
  tips: readonly Tip[];
  stage: TipCallStage;
  /** How many of the trainee's messages the server holds. */
  traineeTurns: number;
  /** How many turns the customer has had. A new one makes a tip due. */
  customerTurns: number;
  /** The customer's voice has not finished: no tip moves while it speaks. */
  customerBusy: boolean;
  /** The person is in the middle of something with the strip: a tip that is due is let go, not forced on them. */
  hold: boolean;
}

export interface TipDeck {
  index: number;
  tip: Tip | undefined;
  /** How the track moves to the current tip, for the stylesheet (`data-motion`). */
  motion: DeckMotion;
  first: boolean;
  last: boolean;
  /** Moves to a tip. `glide` is a gentle slide; `spring` is how a card settles after it was dragged. */
  go(index: number, motion?: DeckMotion): void;
  step(delta: -1 | 1): void;
}

/**
 * Which tip is showing. It changes only when the person moves it, and once when a customer turn has
 * finished: a new customer turn makes a tip due, and it comes up when the customer has stopped
 * speaking, unless the person is busy with the strip, in which case it is dropped. Nothing on a
 * timer, nothing while the customer speaks, and a tip that is not wanted never queues up behind
 * another.
 */
export function useTipDeck({
  tips,
  stage,
  traineeTurns,
  customerTurns,
  customerBusy,
  hold,
}: TipDeckOptions): TipDeck {
  const [place, setPlace] = useState<{ index: number; motion: DeckMotion }>(() => ({
    index: startingTip(tips, { stage, traineeTurns }),
    motion: 'glide',
  }));
  const { index, motion } = place;
  const seen = useRef<Set<number>>(new Set([index]));
  const due = useRef(false);
  const known = useRef(customerTurns);

  const go = useCallback(
    (to: number, how: DeckMotion = 'glide') => {
      setPlace({ index: Math.min(Math.max(to, 0), Math.max(tips.length - 1, 0)), motion: how });
    },
    [tips.length],
  );

  const step = useCallback((delta: -1 | 1) => go(index + delta), [go, index]);

  useEffect(() => {
    seen.current.add(index);
  }, [index]);

  // A turn the customer has just had makes a tip due.
  useEffect(() => {
    if (customerTurns > known.current) due.current = true;
    known.current = customerTurns;
  }, [customerTurns]);

  // It comes up once the customer has stopped speaking.
  useEffect(() => {
    if (!due.current || customerBusy) return;
    due.current = false;
    if (hold || tips.length === 0) return;
    setPlace((current) => ({
      index: nextTip(tips, {
        stage,
        traineeTurns,
        current: current.index,
        seen: seen.current,
      }),
      motion: 'glide',
    }));
  }, [customerTurns, customerBusy, hold, tips, stage, traineeTurns]);

  return {
    index,
    tip: tips[index],
    motion,
    first: index <= 0,
    last: index >= tips.length - 1,
    go,
    step,
  };
}
