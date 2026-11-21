import { memo, useLayoutEffect, useMemo, useRef } from 'react';
import { DISCOVERY_COPY, SHIFT_COPY } from './atmosphere.ts';
import type { PathMark, PathNode } from './chamber-model.ts';
import { estimateHeight, spineSegment } from './spine-model.ts';
import type { ChatShift, TurnMood } from './useCall.ts';
import { Icon } from '../Icon.tsx';
import { ListenButton } from '../voice/ListenButton.tsx';
import { formatTime } from '../../lib/format.ts';
import { usePerfTier } from '../../lib/PerfTierProvider.tsx';
import { useAmbientPaused } from '../../lib/motion/ambient.tsx';

// One turn of the conversation, set as a line of a page: who and when in the margin, a point on the
// filament, and the words. Guided practice may add what happened in this turn (a signal, a shift);
// the margin only carries a mood word for a reply whose mood the screen actually saw.

const STAR_PATH =
  'M0 -7.5C.6 -2.4 2.4 -.6 7.5 0C2.4 .6 .6 2.4 0 7.5C-.6 2.4 -2.4 .6 -7.5 0C-2.4 -.6 -.6 -2.4 0 -7.5Z';

/** A four-point star: a signal found in this turn. It sits on the filament in place of the dot. */
function Star() {
  return (
    <svg className="ch-star" viewBox="-8 -8 16 16" width="16" height="16" aria-hidden="true">
      <path d={STAR_PATH} />
    </svg>
  );
}

/** How long the light takes to travel from one turn to the next. */
export const ARRIVAL_MS = 780;

/**
 * A reply arriving: a small light travels down the filament from the point of what was said to the
 * point of the reply, once. It answers "what just happened" and ends; nothing about it repeats, so
 * the page is still when nothing is happening. It is left out for reduced motion, when ambient
 * motion is paused and on the cheapest performance tier, and it is the same whatever the customer's
 * state (its colour is the room's, which is neutral when cues are off).
 */
function Arrival() {
  const light = useRef<HTMLSpanElement>(null);
  const paused = useAmbientPaused();
  const tier = usePerfTier();
  const skip = paused || tier === 'low';

  useLayoutEffect(() => {
    const el = light.current;
    const turn = el?.closest('li');
    const from = turn?.previousElementSibling?.querySelector('.ch-turn__mark');
    const to = turn?.querySelector('.ch-turn__mark');
    if (skip || !el || !from || !to || typeof el.animate !== 'function') return;
    const distance = to.getBoundingClientRect().top - from.getBoundingClientRect().top;
    if (!(distance > 0)) return;
    const flight = el.animate(
      [
        { transform: `translateY(${-distance}px)`, opacity: 0 },
        { opacity: 1, offset: 0.2 },
        { opacity: 1, offset: 0.8 },
        { transform: 'translateY(0)', opacity: 0 },
      ],
      { duration: ARRIVAL_MS, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'backwards' },
    );
    return () => flight.cancel();
  }, [skip]);

  return <span ref={light} className="ch-arrival" aria-hidden="true" />;
}

/** The turn's stretch of filament. Drawn once from the mood of this moment; never animated. */
function Spine({
  mood,
  kink,
  seed,
  height,
}: {
  mood: TurnMood | null;
  kink: boolean;
  seed: string;
  height: number;
}) {
  const stretch = useMemo(
    () =>
      spineSegment({
        mood: mood?.id ?? 'neutral',
        easing: mood?.trend === 'falling',
        kink,
        seed,
        height,
      }),
    [mood?.id, mood?.trend, kink, seed, height],
  );
  return (
    <svg
      className="ch-spine"
      viewBox="0 0 44 100"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d={stretch.d}
        strokeWidth={stretch.weight}
        strokeLinejoin={stretch.join}
        strokeDasharray={stretch.dash ?? undefined}
      />
    </svg>
  );
}

export function shiftText(shift: ChatShift, name: string): string {
  if (shift.kind === 'silent') return `${name} has gone quiet.`;
  if (shift.kind === 'curveball') return SHIFT_COPY.curveball;
  return `${name}'s mood shifted from ${shift.from?.label ?? 'one state'} to ${shift.to?.label ?? 'another'}.`;
}

const SHIFT_LABEL: Record<ChatShift['kind'], string> = {
  band: 'Mood shift',
  silent: 'Silence',
  curveball: 'Situation shift',
};

function Annotation({ mark, name }: { mark: PathMark; name: string }) {
  if (mark.kind === 'signal') {
    return (
      <p className="ch-note" data-kind="signal">
        <span className="ch-note__label">{DISCOVERY_COPY.label}</span>
        <span className="sr-only"> in this reply</span>
      </p>
    );
  }
  const { shift } = mark;
  return (
    <p className="ch-note" data-kind={shift.kind} data-direction={shift.direction}>
      <span className="ch-note__label">
        {shift.direction ? <span className="ch-trend" aria-hidden="true" /> : null}
        {SHIFT_LABEL[shift.kind]}
      </span>
      <span className="ch-note__text">{shiftText(shift, name)}</span>
    </p>
  );
}

export interface TurnProps {
  node: PathNode;
  /** The customer's name, who speaks the customer's turns. */
  customer: string;
  /** What the screen saw of the customer's mood at this turn. Always null when cues are off. */
  mood: TurnMood | null;
  /** Arrived after the call was opened, so it gets the short entrance. */
  fresh: boolean;
  /** Among the newest turns: always fully drawn. Older turns are drawn when they come into view. */
  near: boolean;
  onRetry(key: string): void;
  /** Reads a customer turn aloud. Left out when the browser cannot speak. */
  onListen?: (text: string) => void;
}

function sameMarks(a: readonly PathMark[], b: readonly PathMark[]): boolean {
  return (
    a.length === b.length &&
    a.every((mark, i) => {
      const other = b[i];
      if (other === undefined || mark.kind !== other.kind) return false;
      return mark.kind === 'signal' || (other.kind === 'shift' && mark.shift === other.shift);
    })
  );
}

function sameTurn(a: TurnProps, b: TurnProps): boolean {
  return (
    a.node.key === b.node.key &&
    a.node.text === b.node.text &&
    a.node.status === b.node.status &&
    a.node.error === b.node.error &&
    a.node.saved === b.node.saved &&
    a.node.index === b.node.index &&
    a.node.emphasis === b.node.emphasis &&
    sameMarks(a.node.marks, b.node.marks) &&
    a.customer === b.customer &&
    a.mood === b.mood &&
    a.fresh === b.fresh &&
    a.near === b.near &&
    a.onRetry === b.onRetry &&
    a.onListen === b.onListen
  );
}

export const Turn = memo(function Turn({
  node,
  customer,
  mood,
  fresh,
  near,
  onRetry,
  onListen,
}: TurnProps) {
  const mine = node.role === 'trainee';
  const who = mine ? 'You' : customer;
  const number = String(node.index ?? node.position + 1).padStart(2, '0');
  const signal = node.marks.some((mark) => mark.kind === 'signal');
  const kink = node.marks.some((mark) => mark.kind === 'shift' && mark.shift.kind === 'curveball');
  return (
    <li
      className="ch-turn"
      data-turn={node.key}
      data-role={node.role}
      data-emphasis={node.emphasis}
      data-status={node.status}
      data-mood={mood?.id}
      data-signal={signal || undefined}
      data-shift={kink || undefined}
      data-fresh={fresh || undefined}
      data-near={near || undefined}
    >
      <p className="ch-turn__label">
        <span className="ch-turn__who">{who}</span>{' '}
        <span className="ch-turn__n">
          <span className="sr-only">Turn </span>
          {number}
        </span>
        {mood && !mine ? (
          <>
            {' '}
            <span className="ch-turn__mood">{mood.label}</span>
          </>
        ) : null}
      </p>
      <div className="ch-turn__spine" aria-hidden="true">
        <Spine
          mood={mood}
          kink={kink}
          seed={node.key}
          height={estimateHeight(node.text, node.role)}
        />
        <span className="ch-turn__mark">{signal ? <Star /> : null}</span>
        {fresh && !mine ? <Arrival /> : null}
      </div>
      <div className="ch-turn__body">
        <p className="ch-turn__text" dir="auto">
          {node.text}
        </p>
        {!mine && onListen ? (
          <ListenButton
            text={node.text}
            who={customer}
            time={formatTime(node.createdAt)}
            onListen={onListen}
          />
        ) : null}
        {node.status === 'sending' ? <p className="ch-turn__status">Sending…</p> : null}
        {node.status === 'failed' ? (
          <div className="ch-turn__status ch-turn__status--failed" role="alert">
            <span>
              <strong>{node.saved ? 'Saved.' : 'Not sent.'}</strong> {node.error}
            </span>
            <button type="button" className="ch-link" onClick={() => onRetry(node.key)}>
              <Icon name="refresh" size={14} /> Retry
            </button>
          </div>
        ) : null}
      </div>
      {node.marks.length > 0 ? (
        <div className="ch-turn__notes">
          {node.marks.map((mark, index) => (
            <Annotation
              key={mark.kind === 'signal' ? 'signal' : `${mark.shift.kind}-${index}`}
              mark={mark}
              name={customer}
            />
          ))}
        </div>
      ) : null}
    </li>
  );
}, sameTurn);

/** The customer is composing a reply. Sighted people see it; the reply itself is what is announced. */
export function TypingTurn({ customer }: { customer: string }) {
  return (
    <li
      className="ch-turn ch-turn--typing"
      data-role="customer"
      data-near="true"
      aria-hidden="true"
    >
      <p className="ch-turn__label">
        <span className="ch-turn__who">{customer}</span>
      </p>
      <div className="ch-turn__spine">
        <span className="ch-turn__mark" data-ambient="typing" />
      </div>
      <div className="ch-turn__body">
        <p className="ch-typing">
          <span className="ch-typing__dots">
            <i data-ambient="typing" />
            <i data-ambient="typing" />
            <i data-ambient="typing" />
          </span>
          <span>{customer} is typing…</span>
        </p>
      </div>
    </li>
  );
}
