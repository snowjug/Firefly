import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '../Icon.tsx';
import { formatTime } from '../../lib/format.ts';
import type { ChatTurn } from './useCall.ts';

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
}: {
  turn: ChatTurn;
  persona: Persona;
  onRetry(key: string): void;
}) {
  const mine = turn.role === 'trainee';
  return (
    <li className={`msg ${mine ? 'msg-trainee' : 'msg-customer'}`} data-status={turn.status}>
      {mine ? null : (
        <span className="avatar" aria-hidden="true">
          {initials(persona.name)}
        </span>
      )}
      <div className="msg-body">
        <p className="msg-meta">
          <span className="msg-who">{mine ? 'You' : persona.name}</span>
          <time dateTime={turn.createdAt}>{formatTime(turn.createdAt)}</time>
        </p>
        <p className="bubble">{turn.text}</p>
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
    </li>
  );
}

/**
 * The conversation. It follows new messages while the reader is at the bottom, and offers a
 * "Jump to latest" control when they have scrolled up to re-read something.
 */
export function MessageList({
  turns,
  persona,
  typing,
  onRetry,
}: {
  turns: ChatTurn[];
  persona: Persona;
  typing: boolean;
  onRetry(key: string): void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);
  const [atBottom, setAtBottom] = useState(true);
  const [seen, setSeen] = useState(turns.length);
  const count = turns.length + (typing ? 1 : 0);
  const lastRole = turns[turns.length - 1]?.role;

  const scrollToEnd = useCallback((smooth: boolean) => {
    const el = scroller.current;
    if (!el) return;
    el.scrollTo({
      top: el.scrollHeight,
      behavior: smooth && !prefersReducedMotion() ? 'smooth' : 'auto',
    });
  }, []);

  useEffect(() => {
    if (atBottomRef.current || lastRole === 'trainee') scrollToEnd(true);
  }, [count, lastRole, scrollToEnd]);

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
              <Message key={turn.key} turn={turn} persona={persona} onRetry={onRetry} />
            ))}
            {typing ? (
              <li className="msg msg-customer msg-typing" aria-hidden="true">
                <span className="avatar">{initials(persona.name)}</span>
                <div className="msg-body">
                  <p className="bubble typing-dots">
                    <span />
                    <span />
                    <span />
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
}
