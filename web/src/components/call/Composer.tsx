import { useLayoutEffect, useRef, type KeyboardEvent, type ReactNode, type RefObject } from 'react';
import { REDACTION_LABELS, looksSensitive } from '#shared/domain/text.ts';
import { useMediaQuery } from '../../lib/hooks.ts';
import { Icon } from '../Icon.tsx';

// Whether the browser sizes a text box to what is typed in it by itself (field-sizing). Where it
// does not, the box is measured after each change, which costs a layout per keystroke.
const SIZES_ITSELF =
  typeof CSS !== 'undefined' &&
  typeof CSS.supports === 'function' &&
  CSS.supports('field-sizing', 'content');

const MAX_HEIGHT = 168;

/**
 * Where the trainee speaks: an underlined line of serif at the end of the filament. Enter sends on
 * a desktop keyboard (Shift+Enter adds a line); on a touch device Enter adds a line and Send
 * sends, which is what a phone keyboard leads people to expect. The text is owned by the call
 * screen, so a starter phrase or recognised speech can be put into the box.
 */
export function Composer({
  value,
  onChange,
  inputRef,
  maxChars,
  busy,
  blockedMessage,
  turnsRemaining,
  onSend,
  ideas,
  voiceBar,
  footerExtra,
}: {
  value: string;
  onChange(next: string): void;
  inputRef?: RefObject<HTMLTextAreaElement | null>;
  maxChars: number;
  busy: boolean;
  blockedMessage: string | null;
  turnsRemaining: number | null;
  onSend(text: string): Promise<unknown>;
  /** Guided practice: a few starter phrases above the line. */
  ideas?: ReactNode;
  /** The voice controls, under the line. */
  voiceBar?: ReactNode;
  /** Small extras at the end of the line of help, such as the way to turn on voice. */
  footerExtra?: ReactNode;
}) {
  const ownRef = useRef<HTMLTextAreaElement>(null);
  const ref = inputRef ?? ownRef;
  const coarse = useMediaQuery('(pointer: coarse)');
  const trimmed = value.trim();
  const over = value.length > maxChars;
  const blocked = blockedMessage !== null;
  const canSend = trimmed.length > 0 && !over && !busy && !blocked;
  const sensitive = trimmed.length > 5 ? looksSensitive(trimmed) : [];

  useLayoutEffect(() => {
    if (SIZES_ITSELF) return;
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`;
  }, [value, ref]);

  const submit = async () => {
    if (!canSend) return;
    onChange('');
    await onSend(trimmed);
    ref.current?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.nativeEvent.isComposing || event.shiftKey) return;
    if (coarse && !event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    void submit();
  };

  const hintId = 'composer-hint';
  const countId = 'composer-count';
  const showCount = value.length > maxChars * 0.85;
  const lowOnTurns = turnsRemaining !== null && turnsRemaining > 0 && turnsRemaining <= 5;

  return (
    <form
      className="ch-composer"
      data-busy={busy || undefined}
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <label htmlFor="reply" className="ch-composer__label">
        <span>Your reply</span>
        <span className="sr-only"> to the customer</span>
      </label>
      <span className="ch-composer__mark" aria-hidden="true" />
      <div className="ch-composer__main">
        {blocked ? (
          <p className="ch-composer__blocked" role="status">
            <Icon name="info" size={16} />
            <span>{blockedMessage}</span>
          </p>
        ) : null}
        {ideas}
        <textarea
          id="reply"
          ref={ref}
          className="ch-composer__input"
          rows={1}
          value={value}
          placeholder="Say what you would say."
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={onKeyDown}
          disabled={blocked}
          aria-describedby={showCount ? `${hintId} ${countId}` : hintId}
          aria-invalid={over || undefined}
          autoComplete="off"
          spellCheck
        />
        <div className="ch-composer__row">
          <div className="ch-composer__help">
            <span id={hintId} className="ch-composer__keys">
              {coarse ? (
                'Tap Send to reply.'
              ) : (
                <>
                  <kbd>Enter</kbd> to send, <kbd>Shift</kbd> + <kbd>Enter</kbd> for a new line.
                </>
              )}
            </span>
            {showCount ? (
              <span id={countId} className={over ? 'ch-composer__over' : undefined}>
                {over
                  ? `${value.length - maxChars} characters over the ${maxChars} limit`
                  : `${value.length} of ${maxChars}`}
              </span>
            ) : null}
            {lowOnTurns ? (
              <span>
                {turnsRemaining} {turnsRemaining === 1 ? 'message' : 'messages'} left in this call
              </span>
            ) : null}
            {footerExtra}
          </div>
          <button type="submit" className="ch-send" disabled={!canSend} aria-label="Send message">
            <span aria-hidden="true">Send</span>
            <Icon name="arrow-right" size={18} />
          </button>
        </div>
        {sensitive.length > 0 ? (
          <p className="ch-composer__warning">
            This looks like it contains{' '}
            {sensitive.map((kind) => REDACTION_LABELS[kind]).join(' and ')}. Firefly removes it
            before saving, but please never use real customer details.
          </p>
        ) : null}
        {voiceBar}
      </div>
    </form>
  );
}
