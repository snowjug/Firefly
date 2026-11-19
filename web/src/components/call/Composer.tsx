import { useLayoutEffect, useRef, type KeyboardEvent, type ReactNode, type RefObject } from 'react';
import { REDACTION_LABELS, looksSensitive } from '#shared/domain/text.ts';
import { useMediaQuery } from '../../lib/hooks.ts';
import { Icon } from '../Icon.tsx';

const MAX_HEIGHT = 160;

/**
 * The message box. Enter sends on desktop (Shift+Enter adds a line); on touch devices Enter adds a
 * line and the Send button sends, which is what people expect from a phone keyboard. The text is
 * owned by the call screen, so a starter phrase or recognised speech can be put into the box.
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
  /** The voice controls, shown inside the box above the text. */
  voiceBar?: ReactNode;
  /** Small extras at the end of the line under the text, such as the way to turn on voice. */
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
      className="composer"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      {blocked ? (
        <p className="callout callout-caution" role="status">
          <Icon name="info" />
          <span>{blockedMessage}</span>
        </p>
      ) : null}
      {voiceBar}
      <div className="composer-row">
        <div className="composer-field">
          <label htmlFor="reply" className="sr-only">
            Your reply to the customer
          </label>
          <textarea
            id="reply"
            ref={ref}
            className="textarea composer-input"
            rows={1}
            value={value}
            placeholder="Type your response…"
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={onKeyDown}
            disabled={blocked}
            aria-describedby={showCount ? `${hintId} ${countId}` : hintId}
            aria-invalid={over || undefined}
            autoComplete="off"
            spellCheck
          />
        </div>
        <button
          type="submit"
          className="btn btn-primary composer-send"
          disabled={!canSend}
          aria-label="Send message"
        >
          <Icon name="send" size={20} />
        </button>
      </div>
      <div className="composer-foot t-meta">
        <span id={hintId} className="composer-keys">
          {coarse ? (
            'Tap Send to reply.'
          ) : (
            <>
              <kbd className="kbd">Enter</kbd> to send, <kbd className="kbd">Shift</kbd> +{' '}
              <kbd className="kbd">Enter</kbd> for a new line.
            </>
          )}
        </span>
        {showCount ? (
          <span id={countId} className={over ? 'composer-over' : undefined}>
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
      {sensitive.length > 0 ? (
        <p className="t-meta composer-warning">
          This looks like it contains{' '}
          {sensitive.map((kind) => REDACTION_LABELS[kind]).join(' and ')}. Firefly removes it before
          saving, but please never use real customer details.
        </p>
      ) : null}
    </form>
  );
}
