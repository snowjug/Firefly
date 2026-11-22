import { useEffect, useId, useMemo, useState, type KeyboardEvent } from 'react';
import {
  Icon,
  VisuallyHidden,
  cx,
  mergeRefs,
  useReveal,
  type IconName,
} from '../../design/index.ts';
import { useMediaQuery } from '../../lib/hooks.ts';
import { INSUFFICIENT_EVIDENCE } from './copy.ts';
import { EvidencePanel, type Moment } from './EvidencePanel.tsx';
import type { CallEvent, EventKind } from './events-model.ts';
import { Quote, Section } from './parts.tsx';
import { usePrinting } from './print.tsx';
import { stagger } from './reveal.ts';
import { useTimelineSync } from './selection.tsx';
import './timeline.css';

const EVENT_ICON: Record<EventKind, IconName> = {
  greeting: 'headset',
  issue: 'document',
  impact: 'building',
  discovery: 'search',
  tension: 'trend-flat',
  curveball: 'flag',
  summary: 'list',
  ownership: 'person',
  'next-steps': 'calendar',
  closing: 'phone-end',
  ended: 'clock',
};

function iconFor(event: CallEvent): IconName {
  if (event.kind !== 'tension') return EVENT_ICON[event.kind];
  return event.trend === 'up' ? 'trend-up' : event.trend === 'down' ? 'trend-down' : 'trend-flat';
}

/** What stands under a moment's name: its turn, where the call stopped, or the plain statement that it was not reached. */
export function captionFor(event: CallEvent): string {
  if (event.state === 'seen') {
    return event.kind === 'ended' ? `After turn ${event.turnIndex}` : `Turn ${event.turnIndex}`;
  }
  return event.state === 'unverified' ? INSUFFICIENT_EVIDENCE : 'Not reached';
}

export function momentOf(event: CallEvent): Moment {
  return {
    title: event.label,
    detail: event.detail,
    state: event.state,
    turnIndex: event.turnIndex,
    quote: event.quote,
  };
}

/** A marker, the moment's name and where in the call it was: the same face on the rail and in the list. */
function EventFace({ event }: { event: CallEvent }) {
  return (
    <>
      <span className="rp-tl__marker">
        <Icon name={iconFor(event)} size={18} />
      </span>
      <span className="rp-tl__text">
        <span className="rp-tl__label">{event.label}</span>
        {event.kind === 'discovery' && event.detail ? (
          <span className="rp-tl__fact">
            <VisuallyHidden>:</VisuallyHidden> {event.detail}
          </span>
        ) : null}
        <span className="rp-tl__turn">
          <VisuallyHidden>,</VisuallyHidden> {captionFor(event)}
        </span>
      </span>
    </>
  );
}

/** The index a movement key leads to, or null for any other key. */
function targetIndex(key: string, from: number, count: number, back: string, forward: string) {
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  if (key === forward) return (from + 1) % count;
  if (key === back) return (from - 1 + count) % count;
  return null;
}

/** The least width a node of the rail can have without a word of its name breaking. */
const MIN_NODE_PX = 80;

/** The width of an element, kept up to date as it is resized; null until it has been measured. */
function useMeasuredWidth(): [(node: HTMLDivElement | null) => void, number | null] {
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  const [width, setWidth] = useState<number | null>(null);
  useEffect(() => {
    if (!node || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.floor(entry?.contentRect.width ?? 0)),
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [node]);
  return [setNode, width];
}

/**
 * The call as a line of moments in call order: a rail with a marker for each on a wide screen, a
 * list down the page when the rail would not fit them all in one row (or on a narrow screen).
 * Choosing a moment (click, Enter, Space, the arrow keys along the rail) shows the exact turn that
 * shows it, with the turns around it. A moment the call never reached is a quiet "Not reached", and
 * a call that was ended early says where it stopped. The choice is shared with the transcript,
 * which marks the turn.
 */
export function Timeline() {
  const sync = useTimelineSync();
  const wide = useMediaQuery('(min-width: 48em)');
  const printing = usePrinting();
  const base = useId();
  const [measure, width] = useMeasuredWidth();
  const [revealed, reveal] = useReveal<HTMLDivElement>();
  const box = useMemo(() => mergeRefs(measure, revealed), [measure, revealed]);
  // On the narrow list a moment can be closed again; the choice stays, only its panel goes.
  const [closed, setClosed] = useState<string | null>(null);
  if (!sync || sync.events.length === 0) return null;

  const { events, selectedId, chooseEvent } = sync;
  // One row or a list: never a rail that wraps, with its line running off one end and back in.
  const rail = wide && (width === null || events.length * MIN_NODE_PX <= width);
  const first = events.find((event) => event.state === 'seen') ?? events[0];
  const shownId = selectedId ?? first?.id ?? null;
  const shown = events.find((event) => event.id === shownId) ?? null;
  const tabId = (id: string) => `${base}-tab-${id}`;
  const panelId = `${base}-panel`;

  const choose = (id: string) => {
    setClosed(null);
    chooseEvent(id);
  };

  const onRailKeys = (event: KeyboardEvent<HTMLDivElement>) => {
    const tabs = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
    const from = tabs.findIndex((tab) => tab === document.activeElement);
    const to =
      from < 0 ? null : targetIndex(event.key, from, tabs.length, 'ArrowLeft', 'ArrowRight');
    const tab = to === null ? undefined : tabs[to];
    if (!tab) return;
    event.preventDefault();
    tab.focus();
    if (tab.dataset.event) choose(tab.dataset.event);
  };

  /** Arrow keys, Home and End between the moment buttons of the list; opening stays a deliberate act. */
  const onListKeys = (event: KeyboardEvent<HTMLButtonElement>) => {
    const list = event.currentTarget.closest('ol');
    const rows = [...(list?.querySelectorAll<HTMLButtonElement>('.rp-tl__event') ?? [])];
    const from = rows.indexOf(event.currentTarget);
    const to = from < 0 ? null : targetIndex(event.key, from, rows.length, 'ArrowUp', 'ArrowDown');
    if (to === null) return;
    event.preventDefault();
    rows[to]?.focus();
  };

  return (
    <Section
      id="journey"
      title="Call journey"
      lead={
        printing
          ? 'The moments of the call in order, each with the turn it was and the words that show it.'
          : 'Choose a moment to see the exact turn.'
      }
    >
      <div className="rp-tl__measure" ref={box} {...reveal} style={stagger(2)}>
        {printing ? (
          <ol className="rp-tl__print" role="list">
            {events.map((event) => (
              <li className="rp-tl__printitem" key={event.id}>
                <p className="rp-tl__printhead">
                  <span className="rp-tl__label">{event.label}</span>{' '}
                  <span>{captionFor(event)}</span>
                </p>
                {event.detail ? <p className="rp-tl__printdetail">{event.detail}</p> : null}
                {event.state === 'seen' && event.quote && event.turnIndex !== null ? (
                  <Quote quote={event.quote} turnIndex={event.turnIndex} />
                ) : null}
              </li>
            ))}
          </ol>
        ) : rail ? (
          <div className="rp-tl rp-tl--wide">
            {/* The keys serve the tabs inside; the list itself is not a control. */}
            {/* eslint-disable-next-line jsx-a11y/interactive-supports-focus */}
            <div
              role="tablist"
              aria-label="Moments in the call"
              aria-orientation="horizontal"
              className="rp-tl__rail"
              onKeyDown={onRailKeys}
            >
              {events.map((event) => {
                const on = event.id === shownId;
                return (
                  <button
                    type="button"
                    role="tab"
                    id={tabId(event.id)}
                    key={event.id}
                    aria-selected={on}
                    aria-controls={panelId}
                    tabIndex={on ? 0 : -1}
                    data-event={event.id}
                    data-state={event.state}
                    data-kind={event.kind}
                    className={cx('rp-tl__event', on && 'rp-tl__event--on')}
                    onClick={() => choose(event.id)}
                  >
                    <EventFace event={event} />
                  </button>
                );
              })}
            </div>
            {shown ? (
              <div
                role="tabpanel"
                id={panelId}
                aria-labelledby={tabId(shown.id)}
                tabIndex={0}
                className="rp-tl__panel"
              >
                <EvidencePanel moment={momentOf(shown)} />
              </div>
            ) : null}
          </div>
        ) : (
          <ol className="rp-tl rp-tl--narrow" role="list">
            {events.map((event) => {
              const open = selectedId === event.id && closed !== event.id;
              const inline = `${base}-inline-${event.id}`;
              return (
                <li
                  className="rp-tl__item"
                  key={event.id}
                  data-state={event.state}
                  data-kind={event.kind}
                >
                  <button
                    type="button"
                    className={cx('rp-tl__event', open && 'rp-tl__event--on')}
                    aria-expanded={open}
                    aria-controls={inline}
                    onClick={() => (open ? setClosed(event.id) : choose(event.id))}
                    onKeyDown={onListKeys}
                  >
                    <EventFace event={event} />
                    <Icon name="chevron-down" size={16} className="rp-tl__chevron" />
                  </button>
                  <div id={inline} className="rp-tl__inline" hidden={!open}>
                    {open ? <EvidencePanel moment={momentOf(event)} /> : null}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </Section>
  );
}
