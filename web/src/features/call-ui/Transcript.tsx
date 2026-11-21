import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type UIEvent,
} from 'react';
import { Avatar, Button, cx, Icon, Skeleton, VisuallyHidden } from '../../design/index.ts';
import type { CallTurn } from '../call/contract.ts';
import { timeMarks } from './call-model.ts';
import './transcript.css';

/** How near the end counts as "at the latest turn", in pixels. */
const FOLLOW_SLACK_PX = 40;
/** The newest turns are always laid out; older ones are skipped by the browser until scrolled to. */
const RECENT_TURNS = 10;

// ---- One turn -------------------------------------------------------------------------------

interface TurnItemProps {
  turn: CallTurn;
  who: string;
  /** m:ss, only on a turn worth a timestamp (see `timeMarks`). */
  time: string;
  /** Far enough back that the browser may skip laying it out until it is scrolled to. */
  old: boolean;
  /** Arrived after the transcript was first shown: it enters with a short fade. */
  enter: boolean;
  /** The customer's turn that is being spoken now. */
  current: boolean;
  /** Developer diagnostics: say how a trainee turn arrived. Never shown to a trainee. */
  showInputMode: boolean;
}

const TurnItem = memo(function TurnItem({
  turn,
  who,
  time,
  old,
  enter,
  current,
  showInputMode,
}: TurnItemProps) {
  const trainee = turn.role === 'trainee';
  const transcribing = turn.status === 'transcribing';
  return (
    <li
      className={cx(
        'cw-turn',
        trainee ? 'cw-turn--you' : 'cw-turn--customer',
        turn.status !== 'sent' && `cw-turn--${turn.status}`,
        current && 'cw-turn--current',
        old && 'cw-turn--old',
        enter && 'cw-turn--enter',
      )}
      aria-current={current ? 'true' : undefined}
    >
      {trainee ? (
        <span className="cw-turn__you" aria-hidden="true">
          <Icon name="person" size={16} />
        </span>
      ) : (
        <Avatar name={who} size="sm" className="cw-turn__avatar" />
      )}
      <div className="cw-turn__body">
        <p className="cw-turn__meta">
          <span className="cw-turn__who">{who}</span>
          {time ? (
            <time className="cw-turn__time" dateTime={turn.createdAt}>
              <VisuallyHidden>at </VisuallyHidden>
              {time}
            </time>
          ) : null}
          {transcribing ? <span className="cw-turn__tag">Transcribing</span> : null}
          {turn.status === 'sending' ? <span className="cw-turn__tag">Sending</span> : null}
          {turn.status === 'failed' ? (
            <span className="cw-turn__tag cw-turn__tag--alert">
              <Icon name="warning" size={14} />
              Not sent
            </span>
          ) : null}
          {turn.interrupted ? (
            <span className="cw-turn__tag">
              <Icon name="speaker-off" size={14} />
              Audio stopped
            </span>
          ) : null}
          {showInputMode && trainee ? (
            <span className="cw-turn__tag">{turn.inputMode === 'voice' ? 'Spoken' : 'Typed'}</span>
          ) : null}
        </p>
        {transcribing && turn.text === '' ? (
          <Skeleton className="cw-turn__skeleton" />
        ) : (
          <p className="cw-turn__text" dir="auto">
            {turn.text}
          </p>
        )}
      </div>
    </li>
  );
});

// ---- The list of turns ----------------------------------------------------------------------

export interface TurnListProps {
  turns: readonly CallTurn[];
  customerName: string;
  /** The session's start, so a turn can say how far into the call it was. */
  startedAt: string;
  /** The keys of the turns that were there from the start: any other turn enters with a fade. Null for none. */
  settled?: ReadonlySet<string> | null;
  /** The key of the customer's turn being spoken now. */
  currentKey?: string | null;
  showInputMode?: boolean;
}

/** The conversation as whole turns: who spoke, a timestamp now and then, and what became of each. */
export const TurnList = memo(function TurnList({
  turns,
  customerName,
  startedAt,
  settled = null,
  currentKey = null,
  showInputMode = false,
}: TurnListProps) {
  const marks = useMemo(() => timeMarks(turns, startedAt), [turns, startedAt]);
  const recentFrom = turns.length - RECENT_TURNS;
  return (
    <ol className="cw-turns" role="list">
      {turns.map((turn, index) => (
        <TurnItem
          key={turn.key}
          turn={turn}
          who={turn.role === 'customer' ? customerName : 'You'}
          time={marks.get(turn.key) ?? ''}
          old={index < recentFrom}
          enter={settled !== null && !settled.has(turn.key)}
          current={turn.key === currentKey}
          showInputMode={showInputMode}
        />
      ))}
    </ol>
  );
});

// ---- The live transcript --------------------------------------------------------------------

export interface TranscriptProps {
  turns: readonly CallTurn[];
  customerName: string;
  startedAt: string;
  /** The trainee's words so far, shown at the end of the log while they are still speaking. */
  interim: string;
  /** The customer's voice is playing, so their latest turn is the current one. */
  speaking: boolean;
  reducedMotion: boolean;
  /** The id of the heading that names this region. */
  titleId: string;
  showInputMode?: boolean;
}

/**
 * The transcript: a log that grows by whole turns, and is the only place transcript text is
 * announced. It follows the newest turn, gently, unless the person has scrolled up, and then offers
 * "Jump to latest". The live words of what the trainee is saying sit at the end of the log and are
 * hidden from assistive technology (the finished turn is announced instead).
 */
export function Transcript({
  turns,
  customerName,
  startedAt,
  interim,
  speaking,
  reducedMotion,
  titleId,
  showInputMode = false,
}: TranscriptProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const follow = useRef(true);
  const count = useRef(turns.length);
  const [away, setAway] = useState(false);
  const [settled] = useState<ReadonlySet<string>>(() => new Set(turns.map((turn) => turn.key)));
  const currentKey = useMemo(
    () => (speaking ? (turns.findLast((turn) => turn.role === 'customer')?.key ?? null) : null),
    [speaking, turns],
  );

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
  // A new turn scrolls gently; anything else stays put with it at once.
  useLayoutEffect(() => {
    const grew = turns.length > count.current;
    count.current = turns.length;
    if (follow.current) toEnd(grew && !reducedMotion ? 'smooth' : 'auto');
  }, [turns, interim, toEnd, reducedMotion]);

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
            <p className="cw-log__empty">No messages yet.</p>
          ) : (
            <TurnList
              turns={turns}
              customerName={customerName}
              startedAt={startedAt}
              settled={settled}
              currentKey={currentKey}
              showInputMode={showInputMode}
            />
          )}
        </div>
        {interim ? (
          <p className="cw-interim" aria-hidden="true">
            <span className="cw-interim__who">You</span>
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
