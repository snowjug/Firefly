import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type UIEvent,
} from 'react';
import { Avatar, Button, cx, Icon, Skeleton, VisuallyHidden } from '../../design/index.ts';
import type { CallTurn } from '../call/contract.ts';
import { clockSince } from './call-model.ts';
import './transcript.css';

/** How near the end counts as "at the latest turn", in pixels. */
const FOLLOW_SLACK_PX = 40;
/** The newest turns are always laid out; older ones are skipped by the browser until scrolled to. */
const RECENT_TURNS = 10;

// ---- One turn -------------------------------------------------------------------------------

interface TurnItemProps {
  turn: CallTurn;
  who: string;
  time: string;
  old: boolean;
  onRetry?: () => void;
}

const TurnItem = memo(function TurnItem({ turn, who, time, old, onRetry }: TurnItemProps) {
  const trainee = turn.role === 'trainee';
  const spoken = trainee && turn.inputMode === 'voice';
  const transcribing = turn.status === 'transcribing';
  return (
    <li
      className={cx(
        'cw-turn',
        trainee ? 'cw-turn--trainee' : 'cw-turn--customer',
        turn.status !== 'sent' && `cw-turn--${turn.status}`,
        old && 'cw-turn--old',
      )}
    >
      {trainee ? (
        <span className="cw-turn__you" aria-hidden="true">
          <Icon name="person" size={18} />
        </span>
      ) : (
        <Avatar name={who} size="sm" className="cw-turn__avatar" />
      )}
      <div className="cw-turn__body">
        <div className="cw-turn__meta">
          <span className="cw-turn__who">{who}</span>
          {time ? (
            <time className="cw-turn__time" dateTime={turn.createdAt}>
              <VisuallyHidden>at </VisuallyHidden>
              {time}
            </time>
          ) : null}
          {spoken ? (
            <span className="cw-turn__tag">
              <Icon name="microphone" size={14} />
              Spoken
            </span>
          ) : null}
          {transcribing ? (
            <span className="cw-turn__tag cw-turn__tag--busy">Transcribing</span>
          ) : null}
          {turn.status === 'sending' ? (
            <span className="cw-turn__tag cw-turn__tag--busy">Sending</span>
          ) : null}
        </div>
        {transcribing && turn.text === '' ? (
          <Skeleton className="cw-turn__skeleton" />
        ) : (
          <p className="cw-turn__text" dir="auto">
            {turn.text}
          </p>
        )}
        {turn.status === 'failed' ? (
          <div className="cw-turn__failed">
            <span className="cw-turn__failed-text">
              <Icon name="warning" size={16} />
              Not sent. Your words are kept.
            </span>
            {onRetry ? (
              <Button size="small" icon="refresh" onClick={onRetry}>
                Try again
              </Button>
            ) : null}
          </div>
        ) : null}
        {turn.interrupted ? (
          <p className="cw-turn__note">
            <Icon name="info" size={16} />
            You interrupted. The full reply is above.
          </p>
        ) : null}
      </div>
    </li>
  );
});

// ---- The list of turns ----------------------------------------------------------------------

export interface TurnListProps {
  turns: readonly CallTurn[];
  customerName: string;
  /** The session's start, so each turn can say how far into the call it was. */
  startedAt: string;
  onRetry?: () => void;
}

/** The conversation as whole turns, each with who spoke, when, and how it arrived. */
export const TurnList = memo(function TurnList({
  turns,
  customerName,
  startedAt,
  onRetry,
}: TurnListProps) {
  const recentFrom = turns.length - RECENT_TURNS;
  return (
    <ol className="cw-turns" role="list">
      {turns.map((turn, index) => (
        <TurnItem
          key={turn.key}
          turn={turn}
          who={turn.role === 'customer' ? customerName : 'You'}
          time={clockSince(startedAt, turn.createdAt)}
          old={index < recentFrom}
          // Only a failed turn has a retry button, so every other row keeps the same props when the
          // screen re-renders (the clock ticks, the microphone level moves) and is not drawn again.
          onRetry={turn.status === 'failed' ? onRetry : undefined}
        />
      ))}
    </ol>
  );
});

// ---- The live transcript --------------------------------------------------------------------

export interface TranscriptProps extends TurnListProps {
  /** The trainee's words so far, shown under the log while they are still speaking. */
  interim: string;
  reducedMotion: boolean;
  /** The id of the heading that names this region. */
  titleId: string;
}

/**
 * The transcript: a log that grows by whole turns, and is the only place transcript text is
 * announced. It follows the newest turn unless the person has scrolled up, and then offers a
 * "Jump to latest" button. The live caption of what the trainee is saying sits under the log and is
 * hidden from assistive technology.
 */
export function Transcript({
  turns,
  customerName,
  startedAt,
  onRetry,
  interim,
  reducedMotion,
  titleId,
}: TranscriptProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const follow = useRef(true);
  const [away, setAway] = useState(false);

  const toEnd = useCallback((behavior: ScrollBehavior) => {
    const element = scroller.current;
    if (!element) return;
    if (typeof element.scrollTo === 'function') {
      element.scrollTo({ top: element.scrollHeight, behavior });
    } else {
      element.scrollTop = element.scrollHeight;
    }
  }, []);

  const onScroll = (event: UIEvent<HTMLDivElement>) => {
    const element = event.currentTarget;
    const near = element.scrollHeight - element.scrollTop - element.clientHeight <= FOLLOW_SLACK_PX;
    follow.current = near;
    setAway(!near);
  };

  // A new turn, a turn that changed, or live words: stay with the newest unless the person left it.
  useLayoutEffect(() => {
    if (follow.current) toEnd('auto');
  }, [turns, interim, toEnd]);

  // The box or its content changing size (the composer opening, older turns being laid out).
  useEffect(() => {
    const outer = scroller.current;
    const inner = content.current;
    if (!outer || !inner || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      if (follow.current) toEnd('auto');
    });
    observer.observe(outer);
    observer.observe(inner);
    return () => observer.disconnect();
  }, [toEnd]);

  const jump = () => {
    follow.current = true;
    setAway(false);
    toEnd(reducedMotion ? 'auto' : 'smooth');
    // The button is about to leave: keep the keyboard where the transcript is.
    scroller.current?.focus({ preventScroll: true });
  };

  return (
    <div className="cw-log-wrap">
      <div
        className="cw-log-scroll"
        id="cw-transcript"
        role="region"
        aria-labelledby={titleId}
        tabIndex={0}
        ref={scroller}
        onScroll={onScroll}
      >
        <div
          className="cw-log"
          role="log"
          aria-label="Call transcript"
          aria-live="polite"
          aria-relevant="additions"
          ref={content}
        >
          {turns.length === 0 ? (
            <p className="cw-log__empty">The conversation will appear here.</p>
          ) : (
            <TurnList
              turns={turns}
              customerName={customerName}
              startedAt={startedAt}
              onRetry={onRetry}
            />
          )}
        </div>
        {interim ? (
          <p className="cw-interim" aria-hidden="true">
            <span className="cw-interim__label">You are saying</span>
            <span className="cw-interim__text" dir="auto">
              {interim}
            </span>
          </p>
        ) : null}
      </div>
      {away ? (
        <Button icon="arrow-down" appearance="secondary" className="cw-log__jump" onClick={jump}>
          Jump to latest
        </Button>
      ) : null}
    </div>
  );
}
