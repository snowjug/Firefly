import { useEffect, useId, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { Button, Icon, IconButton, Tag, useTilt } from '../../design/index.ts';
import type { TipCallStage } from './selection.ts';
import { TIPS, type Tip } from './tips.ts';
import { useDeckGestures } from './use-deck-gestures.ts';
import { useTipDeck, type TipDeck } from './use-tip-deck.ts';
import './tips.css';

export interface TipsStripProps {
  /** The stage the call was set to in the brief. */
  stage: TipCallStage;
  /** How many of the trainee's messages the server holds. */
  traineeTurns: number;
  /** How many turns the customer has had. */
  customerTurns: number;
  /** The customer's voice has not finished: nothing moves while it speaks. */
  customerBusy: boolean;
  /** Start with the strip put away (a fixture, a test). */
  defaultHidden?: boolean;
  /** The tips to show. Left out, the authored set. */
  tips?: readonly Tip[];
}

const ARROWS: Record<string, -1 | 1> = { ArrowLeft: -1, ArrowRight: 1 };

/**
 * "During the call": short tips for Guided practice, one prominent card and a peek of the next. A
 * card changes only when the person moves it (the buttons, the arrow keys, a swipe or a drag) and once
 * when a customer turn has finished; never on a timer and never while the customer speaks. The strip
 * has the same size whichever tip shows, and sits above the controls, never over them. "Hide tips"
 * puts it away for this call, and "Show tips" brings it back. It announces nothing: it is not a live
 * region, and the polite announcer is not used for it.
 */
export function TipsStrip({
  stage,
  traineeTurns,
  customerTurns,
  customerBusy,
  defaultHidden = false,
  tips = TIPS,
}: TipsStripProps) {
  const [hidden, setHidden] = useState(defaultHidden);
  // The tip whose "Learn why" is open. It belongs to that tip: another tip arriving closes it.
  const [whyFor, setWhyFor] = useState<number | null>(null);
  const [focused, setFocused] = useState(false);
  const [dragging, setDragging] = useState(false);
  const root = useRef<HTMLElement>(null);
  const hide = useRef<HTMLButtonElement>(null);
  const show = useRef<HTMLButtonElement>(null);
  const why = useRef<HTMLButtonElement>(null);
  const moved = useRef(false);
  const whyId = useId();

  const deck = useTipDeck({
    tips,
    stage,
    traineeTurns,
    customerTurns,
    customerBusy,
    hold: whyFor !== null || focused || dragging,
  });
  const { go, step } = deck;
  // "Learn why" belongs to the tip it was opened on: once another tip shows, it is closed for good.
  if (whyFor !== null && whyFor !== deck.index) setWhyFor(null);
  const whyOpen = whyFor === deck.index && Boolean(deck.tip?.why);
  const count = tips.length;

  // Arrow keys, Home and End move the tips while the keyboard is anywhere in the strip.
  useEffect(() => {
    const element = root.current;
    if (!element || hidden) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      const delta = ARROWS[event.key];
      if (delta) step(delta);
      else if (event.key === 'Home') go(0);
      else if (event.key === 'End') go(count - 1);
      else return;
      event.preventDefault();
    };
    element.addEventListener('keydown', onKey);
    return () => element.removeEventListener('keydown', onKey);
  }, [go, step, hidden, count]);

  // "Learn why" closes with Escape and with a press anywhere outside the strip.
  useEffect(() => {
    if (!whyOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setWhyFor(null);
      why.current?.focus();
    };
    const onPress = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setWhyFor(null);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPress, true);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPress, true);
    };
  }, [whyOpen]);

  // Hiding or showing by hand leaves the keyboard on the control that is now there.
  useEffect(() => {
    if (!moved.current) return;
    moved.current = false;
    (hidden ? show : hide).current?.focus();
  }, [hidden]);

  const put = (away: boolean) => {
    moved.current = true;
    setWhyFor(null);
    setHidden(away);
  };

  if (hidden) {
    return (
      <section className="tp-strip tp-strip--quiet" aria-label="Tips for this call" ref={root}>
        <Button
          ref={show}
          appearance="subtle"
          size="small"
          icon="lightbulb"
          onClick={() => put(false)}
        >
          Show tips
        </Button>
      </section>
    );
  }

  return (
    <section
      className="tp-strip"
      aria-label="Tips for this call"
      ref={root}
      onFocus={() => setFocused(true)}
      onBlur={(event) => {
        if (!root.current?.contains(event.relatedTarget as Node | null)) setFocused(false);
      }}
    >
      <h2 className="tp-strip__title">During the call</h2>
      <Deck
        tips={tips}
        deck={deck}
        whyOpen={whyOpen}
        whyId={whyId}
        whyRef={why}
        onWhy={() => setWhyFor(whyOpen ? null : deck.index)}
        onDragChange={setDragging}
      />
      <Nav deck={deck} />
      <Button
        ref={hide}
        appearance="subtle"
        size="small"
        className="tp-strip__hide"
        onClick={() => put(true)}
      >
        Hide tips
      </Button>
      {whyOpen ? (
        <div className="tp-why" id={whyId}>
          {deck.tip?.why}
        </div>
      ) : null}
    </section>
  );
}

interface DeckProps {
  tips: readonly Tip[];
  deck: TipDeck;
  whyOpen: boolean;
  whyId: string;
  whyRef: RefObject<HTMLButtonElement | null>;
  onWhy(): void;
  onDragChange(dragging: boolean): void;
}

/**
 * The cards on their track. It exists only while the strip is showing, so its gestures and its tilt
 * are attached to elements that are there. The track slides by `--tp-index` and `--tp-drag`, both
 * written from script; everything else about how it moves is in the stylesheet. The tilt is read from
 * the card, which keeps still, and drawn on the face inside it, which moves: a pointer at the very
 * edge of a face that tilts or rises would otherwise be left outside it, and the card would shiver.
 */
function Deck({ tips, deck, whyOpen, whyId, whyRef, onWhy, onDragChange }: DeckProps) {
  const viewport = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLUListElement>(null);
  const tilt = useTilt<HTMLLIElement>();
  const { index, go } = deck;

  useLayoutEffect(() => {
    track.current?.style.setProperty('--tp-index', String(index));
  }, [index]);

  useDeckGestures(viewport, track, {
    first: deck.first,
    last: deck.last,
    onDragChange,
    onRelease: (decision) => {
      const to = decision === 'next' ? index + 1 : decision === 'previous' ? index - 1 : index;
      go(to, 'spring');
    },
  });

  return (
    <div className="tp-deck" ref={viewport}>
      <ul className="tp-track" role="list" ref={track} data-motion={deck.motion}>
        {tips.map((tip, position) => (
          <TipCard
            key={tip.id}
            tip={tip}
            position={position}
            total={tips.length}
            current={position === index}
            tiltRef={position === index ? tilt : undefined}
            whyOpen={whyOpen}
            whyId={whyId}
            whyRef={whyRef}
            onWhy={onWhy}
          />
        ))}
      </ul>
    </div>
  );
}

function Nav({ deck }: { deck: TipDeck }) {
  return (
    <div className="tp-nav">
      <IconButton
        icon="chevron-left"
        label="Previous tip"
        appearance="secondary"
        disabledFocusable={deck.first}
        onClick={() => deck.step(-1)}
      />
      <IconButton
        icon="chevron-right"
        label="Next tip"
        appearance="secondary"
        disabledFocusable={deck.last}
        onClick={() => deck.step(1)}
      />
    </div>
  );
}

interface TipCardProps {
  tip: Tip;
  position: number;
  total: number;
  current: boolean;
  tiltRef: RefObject<HTMLLIElement | null> | undefined;
  whyOpen: boolean;
  whyId: string;
  whyRef: RefObject<HTMLButtonElement | null>;
  onWhy(): void;
}

function TipCard({
  tip,
  position,
  total,
  current,
  tiltRef,
  whyOpen,
  whyId,
  whyRef,
  onWhy,
}: TipCardProps) {
  return (
    <li
      className="tp-card"
      ref={tiltRef}
      data-current={current ? 'true' : undefined}
      aria-current={current ? 'true' : undefined}
      aria-label={`Tip ${position + 1} of ${total}`}
    >
      <div className="tp-card__face">
        <span className="tp-card__icon" aria-hidden="true">
          <Icon name={tip.icon} size={20} />
        </span>
        <div className="tp-card__body">
          <p className="tp-card__text">{tip.text}</p>
          <div className="tp-card__meta">
            {tip.care ? (
              <span className="tp-card__care">
                <Tag size="small">{tip.care}</Tag>
              </span>
            ) : null}
            {current && tip.why ? (
              <Button
                ref={whyRef}
                appearance="subtle"
                size="small"
                icon="chevron-down"
                iconPosition="end"
                className="tp-card__why"
                aria-expanded={whyOpen}
                aria-controls={whyId}
                onClick={onWhy}
              >
                Learn why
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </li>
  );
}
