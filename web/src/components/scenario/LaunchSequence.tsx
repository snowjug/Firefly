import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { TemperatureBandId } from '#shared/domain/vocab.ts';
import { play } from '../../lib/sound.ts';
import { CustomerAvatar } from '../illustration/index.ts';

/** How long "scenario locked" shows before the customer connects. */
export const CONNECT_AFTER_MS = 450;
/** How long "line open" shows before the call itself appears. */
export const HOLD_OPEN_MS = 600;

interface LaunchSequenceProps {
  title: string;
  persona: { name: string; role: string; organisation: string };
  /** How the customer starts: the portrait and the glow behind it take this mood. */
  mood: TemperatureBandId;
  /** The call really exists on the server. "Line open" is only ever shown once this is true. */
  ready: boolean;
  /** Called once, when it is time to show the call. */
  onDone(): void;
}

/**
 * A short, skippable moment between preparing and the call: the scenario locks, the customer
 * connects, the line opens. It is tied to the real request: the last step appears only when the
 * call has actually been created, and if that takes longer it simply waits. Click, Enter, Space or
 * Escape skips ahead. Under reduced motion the page never shows it.
 */
export function LaunchSequence({ title, persona, mood, ready, onDone }: LaunchSequenceProps) {
  const [connected, setConnected] = useState(false);
  const [skipped, setSkipped] = useState(false);
  const done = useRef(onDone);
  const skipButton = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  useEffect(() => {
    done.current = onDone;
  });

  useEffect(() => {
    const timer = window.setTimeout(() => setConnected(true), CONNECT_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, []);

  const open = ready && (connected || skipped);
  const stage = open ? 2 : connected ? 1 : 0;

  useEffect(() => {
    if (open) play('connect');
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => done.current(), skipped ? 0 : HOLD_OPEN_MS);
    return () => window.clearTimeout(timer);
  }, [open, skipped]);

  // The sequence owns the screen while it runs: nothing behind it can be reached or scrolled.
  useEffect(() => {
    const root = document.getElementById('root');
    root?.setAttribute('inert', '');
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    skipButton.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        setSkipped(true);
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      root?.removeAttribute('inert');
      document.body.style.overflow = overflow;
    };
  }, []);

  return createPortal(
    // Clicking anywhere skips; the button and the keys give the same choice without a pointer.
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/click-events-have-key-events
    <div
      className="launch"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      data-mood={mood}
      data-stage={stage}
      onClick={() => setSkipped(true)}
    >
      <div className="launch-avatar" aria-hidden="true">
        <CustomerAvatar seed={persona.name} mood={mood} />
      </div>
      <div className="launch-text">
        <h2 id={titleId} className="sr-only">
          Starting your call
        </h2>
        <ol className="launch-steps">
          <li>
            <span className="launch-label">Scenario locked</span>
            <strong>{title}</strong>
          </li>
          {stage >= 1 ? (
            <li>
              <span className="launch-label">Customer connected</span>
              <strong>{persona.name}</strong>
              <span className="launch-sub">
                {persona.role}, {persona.organisation}. A fictional customer.
              </span>
            </li>
          ) : null}
          {stage >= 2 ? (
            <li>
              <span className="launch-label">Line open</span>
              <strong>Say hello when you are ready.</strong>
            </li>
          ) : null}
        </ol>
        <p className="sr-only" role="status">
          {stage === 0
            ? 'Scenario locked.'
            : stage === 1
              ? `Customer connected: ${persona.name}.`
              : 'Line open.'}
        </p>
      </div>
      <button
        ref={skipButton}
        type="button"
        className="btn btn-secondary launch-skip"
        onClick={(event) => {
          event.stopPropagation();
          setSkipped(true);
        }}
      >
        Skip
      </button>
    </div>,
    document.body,
  );
}
