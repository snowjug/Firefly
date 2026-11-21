import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { Button, cx, Field, IconButton, TextArea } from '../../design/index.ts';
import type { CallActions } from '../call/contract.ts';
import type { ComposerGate } from './call-model.ts';
import { findControlsZone, useRescueFocus } from './use-rescue-focus.ts';
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
  /** Typed calls always show the box; spoken calls show a "Type instead" row until it is wanted. */
  open: boolean;
  /** Spoken calls can hide the box again; typed calls cannot, because it is their only input. */
  canClose: boolean;
  /** Show the collapsed row on voice calls. Narrow screens use the dock's own button instead. */
  showRow: boolean;
  /** Bumped each time something asks for the box to be opened and given focus. */
  focusRequest: number;
  onOpen(): void;
  onClose(): void;
  maxChars: number;
  gate: ComposerGate;
  turnsRemaining: number | null;
  sendText: CallActions['sendText'];
  initialDraft?: string;
}

/**
 * The typed reply. Enter sends, Shift+Enter adds a line, and a message that is too long says so
 * and is not sent. Sending waits (with its reason in words) while the customer replies. The text
 * is only cleared once the call has accepted it, so nothing typed is ever lost.
 */
export function Composer({
  open,
  canClose,
  showRow,
  focusRequest,
  onOpen,
  onClose,
  maxChars,
  gate,
  turnsRemaining,
  sendText,
  initialDraft = '',
}: ComposerProps) {
  const [draft, setDraft] = useState(initialDraft);
  const form = useRef<HTMLFormElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const reopen = useRef<HTMLButtonElement>(null);
  const sending = useRef(false);
  const handled = useRef(0);
  const ids = useId();
  const helperId = `${ids}-helper`;
  const reasonId = `${ids}-reason`;
  // The "Jump to the reply box" link points at this id.
  const formId = 'cw-reply';

  // Something (a button, a skip link, a problem) asked for the box: move the keyboard into it, once.
  useEffect(() => {
    if (!open || focusRequest === handled.current) return;
    handled.current = focusRequest;
    input.current?.focus();
  }, [focusRequest, open]);

  // "Hide the reply box" removes the button that was pressed: the keyboard goes to the row that
  // brings the box back (or, on a narrow screen, which has no such row, to the call's controls).
  const findLanding = useCallback(() => reopen.current ?? findControlsZone(), []);
  useRescueFocus(open, findLanding);

  // Browsers without `field-sizing` grow the box by hand, up to six lines.
  useEffect(() => {
    const element = input.current;
    if (!element || supportsFieldSizing() || element.scrollHeight === 0) return;
    element.style.height = 'auto';
    element.style.height = `${Math.min(element.scrollHeight, MAX_HEIGHT_PX)}px`;
  }, [draft, open]);

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

  if (!open) {
    // The box's id stays in the page while it is closed, so the "Jump to the reply box" link and the
    // button's aria-controls always point at something real.
    return showRow ? (
      <div className="cw-composer cw-composer--closed" id={formId}>
        <Button
          ref={reopen}
          icon="keyboard"
          appearance="outline"
          aria-expanded={false}
          aria-controls={formId}
          onClick={onOpen}
        >
          Type a reply instead
        </Button>
      </div>
    ) : (
      <span id={formId} />
    );
  }

  const over = length - maxChars;
  const remaining =
    turnsRemaining !== null && turnsRemaining <= REMAINING_FROM
      ? `${turnsRemaining === 0 ? 'No' : turnsRemaining} ${turnsRemaining === 1 ? 'message' : 'messages'} left in this call.`
      : null;

  return (
    <form
      className="cw-composer"
      id={formId}
      aria-label="Reply"
      ref={form}
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <Field
        label="Type a reply"
        error={
          tooLong
            ? `This message is ${number(over)} ${over === 1 ? 'character' : 'characters'} over the limit of ${number(maxChars)}. Shorten it to send it.`
            : undefined
        }
      >
        <div className="cw-composer__row">
          <TextArea
            ref={input}
            rows={2}
            value={draft}
            className="cw-composer__input"
            aria-describedby={cx(helperId, gate.reason && reasonId)}
            onChange={(event) => setDraft(event.currentTarget.value)}
            onKeyDown={onKeyDown}
          />
          <Button
            type="submit"
            appearance="primary"
            icon="send"
            disabledFocusable={waits}
            aria-describedby={gate.reason ? reasonId : undefined}
            className="cw-composer__send"
          >
            Send
          </Button>
        </div>
      </Field>
      <div className="cw-composer__meta">
        <p className="cw-composer__helper" id={helperId}>
          Enter to send, Shift+Enter for a new line
        </p>
        {showCounter ? (
          <p className={cx('cw-composer__count', tooLong && 'cw-composer__count--over')}>
            {number(length)} / {number(maxChars)}
          </p>
        ) : null}
      </div>
      {gate.reason ? (
        <p className="cw-composer__reason" id={reasonId}>
          {gate.reason}
        </p>
      ) : null}
      {remaining ? <p className="cw-composer__remaining">{remaining}</p> : null}
      {canClose ? (
        <IconButton
          icon="chevron-down"
          label="Hide the reply box"
          size="small"
          className="cw-composer__close"
          onClick={onClose}
        />
      ) : null}
    </form>
  );
}
