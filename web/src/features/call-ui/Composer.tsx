import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { Button, cx, TextArea, VisuallyHidden } from '../../design/index.ts';
import type { CallActions } from '../call/contract.ts';
import type { ComposerGate } from './call-model.ts';
import './composer.css';

/** The counter appears once the message is this close to the limit. */
const COUNTER_FROM = 0.8;
/** Tell the person how many messages are left when it is this few. */
const REMAINING_FROM = 3;
/** Six lines of the textarea, plus its padding and border, for browsers without `field-sizing`. */
const MAX_HEIGHT_PX = 6 * 20 + 18;

function supportsFieldSizing(): boolean {
  return typeof CSS !== 'undefined' && typeof CSS.supports === 'function'
    ? CSS.supports('field-sizing', 'content')
    : false;
}

export interface ComposerProps {
  maxChars: number;
  gate: ComposerGate;
  turnsRemaining: number | null;
  sendText: CallActions['sendText'];
  initialDraft?: string;
}

/**
 * The typed reply: the text fallback, which is as much a way to hold the call as speaking is. Enter
 * sends, Shift+Enter adds a line, and a message that is too long says so and is not sent. Sending
 * waits (with its reason in a few words) while the customer replies. The text is only cleared once
 * the call has accepted it, so nothing typed is ever lost. The box takes the keyboard when it appears,
 * because the trainee just chose to type.
 */
export function Composer({
  maxChars,
  gate,
  turnsRemaining,
  sendText,
  initialDraft = '',
}: ComposerProps) {
  const [draft, setDraft] = useState(initialDraft);
  const form = useRef<HTMLFormElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const sending = useRef(false);
  const ids = useId();
  const reasonId = `${ids}-reason`;
  const keysId = `${ids}-keys`;

  useEffect(() => {
    input.current?.focus({ preventScroll: true });
  }, []);

  // Browsers without `field-sizing` grow the box by hand, up to six lines.
  useEffect(() => {
    const element = input.current;
    if (!element || supportsFieldSizing() || element.scrollHeight === 0) return;
    element.style.height = 'auto';
    element.style.height = `${Math.min(element.scrollHeight, MAX_HEIGHT_PX)}px`;
  }, [draft]);

  const length = draft.length;
  const tooLong = length > maxChars;
  const showCounter = length >= Math.floor(maxChars * COUNTER_FROM);
  const waits = !gate.canSend || tooLong;
  const number = (value: number) => value.toLocaleString('en-GB');

  const submit = async () => {
    if (waits || sending.current) {
      input.current?.focus();
      return;
    }
    sending.current = true;
    const text = draft;
    try {
      const accepted = await sendText(text);
      // Only clear what was sent: anything typed while it was on its way stays.
      if (accepted) setDraft((current) => (current === text ? '' : current));
    } finally {
      sending.current = false;
    }
    // Back to the box if the keyboard was still in the form (the Send button was pressed).
    if (form.current?.contains(document.activeElement)) input.current?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    void submit();
  };

  const over = length - maxChars;
  const reason = tooLong
    ? `${number(over)} over the ${number(maxChars)} character limit.`
    : gate.reason;
  const remaining =
    turnsRemaining !== null && turnsRemaining <= REMAINING_FROM
      ? `${turnsRemaining === 0 ? 'No' : turnsRemaining} ${turnsRemaining === 1 ? 'message' : 'messages'} left.`
      : null;

  return (
    <form
      className="cw-composer"
      id="cw-reply"
      aria-label="Reply"
      ref={form}
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <div className="cw-composer__row">
        <TextArea
          ref={input}
          rows={2}
          value={draft}
          className="cw-composer__input"
          aria-label="Your reply"
          aria-describedby={cx(keysId, reason && reasonId)}
          invalid={tooLong}
          placeholder="Type your reply"
          onChange={(event) => setDraft(event.currentTarget.value)}
          onKeyDown={onKeyDown}
        />
        <Button
          type="submit"
          appearance="primary"
          icon="send"
          disabledFocusable={waits}
          aria-describedby={reason ? reasonId : undefined}
          className="cw-composer__send"
        >
          Send
        </Button>
      </div>
      <VisuallyHidden id={keysId}>Enter sends. Shift and Enter add a line.</VisuallyHidden>
      <p className="cw-composer__meta">
        <span
          className={cx('cw-composer__reason', tooLong && 'cw-composer__reason--over')}
          id={reasonId}
        >
          {reason}
        </span>
        {remaining ? <span className="cw-composer__remaining">{remaining}</span> : null}
        {showCounter ? (
          <span className={cx('cw-composer__count', tooLong && 'cw-composer__count--over')}>
            {number(length)} / {number(maxChars)}
          </span>
        ) : null}
      </p>
    </form>
  );
}
