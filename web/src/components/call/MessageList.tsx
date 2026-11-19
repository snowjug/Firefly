import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '../Icon.tsx';
import { ListenButton } from '../voice/ListenButton.tsx';
import { formatTime } from '../../lib/format.ts';
import type { ChatShift, ChatTurn } from './useCall.ts';

interface Persona {
  name: string;
  role: string;
  organisation: string;
}

function initials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '?';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return `${first}${last}`.toUpperCase();
}

function prefersReducedMotion(): boolean {
  return (
    document.documentElement.dataset.motion === 'reduce' ||
    (typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  );
}

function Message({
  turn,
  persona,
  onRetry,
  onListen,
  fresh,
  signal,
  shifts,
}: {
  turn: ChatTurn;
  persona: Persona;
  onRetry(key: string): void;
  /** Reads a customer message aloud. Left out when the browser cannot speak. */
  onListen?: (text: string) => void;
  /** Arrived after the call was opened, so it gets the short entrance. */
  fresh: boolean;
  /** A signal came to light in this reply (guided practice only). */
  signal: boolean;
  /** Changes in the customer's mood that appeared after this reply (guided practice only). */
  shifts: ChatShift[];
}) {
  const mine = turn.role === 'trainee';
  return (
    <li className="msg-item">
      <div
        className={`msg ${mine ? 'msg-trainee' : 'msg-customer'}`}
        data-status={turn.status}
        data-fresh={fresh || undefined}
        data-signal={signal || undefined}
      >
        {mine ? null : (
          <span className="msg-avatar" aria-hidden="true">
            {initials(persona.name)}
          </span>
        )}
        <div className="msg-body">
          <p className="msg-meta">
            <span className="msg-who">{mine ? 'You' : persona.name}</span>
            <time dateTime={turn.createdAt}>{formatTime(turn.createdAt)}</time>
            {signal ? (
              <span className="msg-signal">
                <Icon name="spark" size={12} />
                Signal found in this reply
              </span>
            ) : null}
          </p>
          <p className="bubble">{turn.text}</p>
          {!mine && onListen ? (
            <ListenButton
              text={turn.text}
              who={persona.name}
              time={formatTime(turn.createdAt)}
              onListen={onListen}
            />
          ) : null}
          {turn.status === 'sending' ? <p className="msg-status">Sending…</p> : null}
          {turn.status === 'failed' ? (
            <div className="msg-status msg-failed" role="alert">
              <span>
                <strong>{turn.saved ? 'Saved.' : 'Not sent.'}</strong> {turn.error}
              </span>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => onRetry(turn.key)}
              >
                <Icon name="refresh" size={16} /> Retry
              </button>
            </div>
          ) : null}
        </div>
      </div>
      {shifts.map((shift) => (
        <Shift key={`${shift.afterKey}-${shift.kind}`} shift={shift} name={persona.name} />
      ))}
    </li>
  );
}

function shiftText(shift: ChatShift, name: string): string {
  if (shift.kind === 'silent') return `${name} has gone quiet.`;
  return `${name}'s mood shifted from ${shift.from?.label ?? 'one state'} to ${shift.to?.label ?? 'another'}.`;
}

/**
 * A quiet marker after a reply: the conversation changed. It sits inside the reply's own list item
 * (so the list still has one item per message) and never suggests what to say.
 */
function Shift({ shift, name }: { shift: ChatShift; name: string }) {
  return (
    <div className="shift" data-kind={shift.kind} data-direction={shift.direction}>
      <span className="shift-rule" aria-hidden="true" />
      <p className="shift-text">{shiftText(shift, name)}</p>
      <span className="shift-rule" aria-hidden="true" />
    </div>
  );
}

const NO_KEYS: string[] = [];
const NO_SHIFTS: ChatShift[] = [];

/**
 * The conversation. It follows new messages while the reader is at the bottom, and offers a
 * "Jump to latest" control when they have scrolled up to re-read something. It does not redraw
 * while the person types, so a long call stays quick to type in.
 */
export const MessageList = memo(function MessageList({
  turns,
  persona,
  typing,
  onRetry,
  onListen,
  guided = false,
  signalKeys = NO_KEYS,
  shifts = NO_SHIFTS,
}: {
  turns: ChatTurn[];
  persona: Persona;
  typing: boolean;
  onRetry(key: string): void;
  /** Adds a "Listen" button to each customer message. */
  onListen?: (text: string) => void;
  /** Guided practice shows mood shifts and signal markers; immersive practice shows neither. */
  guided?: boolean;
  signalKeys?: string[];
  shifts?: ChatShift[];
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);
  const hasOpened = useRef(false);
  const [atBottom, setAtBottom] = useState(true);
  const [seen, setSeen] = useState(turns.length);
  const [openingKeys] = useState(() => new Set(turns.map((turn) => turn.key)));
  const count = turns.length + (typing ? 1 : 0) + (guided ? shifts.length : 0);
  const last = turns[turns.length - 1];
  const lastRole = last?.role;
  // A message that did not get through grows a retry banner under it: keep that in view too.
  const lastStatus = last?.status;

  const scrollToEnd = useCallback((smooth: boolean) => {
    const el = scroller.current;
    if (!el) return;
    el.scrollTo({
      top: el.scrollHeight,
      behavior: smooth && !prefersReducedMotion() ? 'smooth' : 'auto',
    });
  }, []);

  useEffect(() => {
    // Opening a call (or coming back to it) lands on the latest message at once instead of
    // animating through the whole conversation; later messages scroll into view smoothly.
    const opening = !hasOpened.current;
    hasOpened.current = true;
    if (atBottomRef.current || lastRole === 'trainee') scrollToEnd(!opening);
  }, [count, lastRole, lastStatus, scrollToEnd]);

  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 96;
    atBottomRef.current = near;
    setAtBottom(near);
    if (near) setSeen(turns.length);
  };

  const unread = atBottom ? 0 : Math.max(0, turns.length - seen);

  return (
    <div className="messages-wrap">
      <div
        ref={scroller}
        className="messages"
        onScroll={onScroll}
        tabIndex={0}
        role="region"
        aria-label="Conversation"
      >
        <div className="messages-inner">
          <p className="call-note">
            You are speaking with a simulated customer. Everything in this call is fictional.
          </p>
          <ol role="list" className="msg-list">
            {turns.map((turn) => (
              <Message
                key={turn.key}
                turn={turn}
                persona={persona}
                onRetry={onRetry}
                onListen={onListen}
                fresh={!openingKeys.has(turn.key)}
                signal={guided && signalKeys.includes(turn.key)}
                shifts={guided ? shifts.filter((shift) => shift.afterKey === turn.key) : []}
              />
            ))}
            {typing ? (
              <li className="msg msg-customer msg-typing" aria-hidden="true">
                <span className="msg-avatar">{initials(persona.name)}</span>
                <div className="msg-body">
                  <p className="bubble typing-dots">
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                    <span className="typing-text">{persona.name} is typing…</span>
                  </p>
                </div>
              </li>
            ) : null}
          </ol>
        </div>
      </div>
      {atBottom ? null : (
        <button
          type="button"
          className="btn btn-secondary btn-sm jump"
          onClick={() => scrollToEnd(true)}
        >
          <Icon name="chevron-down" size={16} />
          {unread > 0 ? `${unread} new ${unread === 1 ? 'message' : 'messages'}` : 'Jump to latest'}
        </button>
      )}
    </div>
  );
});
