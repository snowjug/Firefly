import { useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { REDACTION_LABELS, looksSensitive } from '#shared/domain/text.ts';
import { useMediaQuery } from '../../lib/hooks.ts';
import { Icon } from '../Icon.tsx';

const MAX_HEIGHT = 176;

/**
 * The message box. Enter sends on desktop (Shift+Enter adds a line); on touch devices Enter adds a
 * line and the Send button sends, which is what people expect from a phone keyboard.
 */
export function Composer({
  maxChars,
  busy,
  blockedMessage,
  turnsRemaining,
  onSend,
}: {
  maxChars: number;
  busy: boolean;
  blockedMessage: string | null;
  turnsRemaining: number | null;
  onSend(text: string): Promise<unknown>;
}) {
  const [value, setValue] = useState('');
  const ref = useRef<HTMLTextAreaElement>(null);
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
  }, [value]);

  const submit = async () => {
    if (!canSend) return;
    setValue('');
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
  const lowOnTurns = turnsRemaining !== null && turnsRemaining > 0 && turnsRemaining <= 5;

  return (
    <form
      className="composer glass glass-strong"
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
            placeholder="Type what you would say to the customer…"
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={onKeyDown}
            disabled={blocked}
            aria-describedby={hintId}
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
          <span className="hide-sm">Send</span>
          <Icon name="send" size={18} />
        </button>
      </div>
      <div className="composer-foot t-meta" id={hintId}>
        <span>
          {coarse ? (
            'Tap Send to reply.'
          ) : (
            <>
              <kbd className="kbd">Enter</kbd> to send, <kbd className="kbd">Shift</kbd> +{' '}
              <kbd className="kbd">Enter</kbd> for a new line.
            </>
          )}
        </span>
        {value.length > maxChars * 0.85 ? (
          <span className={over ? 'composer-over' : undefined}>
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
