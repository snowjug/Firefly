import type { CueLevel } from './atmosphere.ts';
import type { ChatShift, ChatTurn } from './useCall.ts';

// The pure side of the conversation chamber: the transcript as a path of turns, which turn the room
// is attending to, what the path is marked with, and when the view should follow a new turn.

export type PathMark = { kind: 'signal' } | { kind: 'shift'; shift: ChatShift };

export interface PathNode {
  key: string;
  index: number | null;
  role: 'customer' | 'trainee';
  text: string;
  createdAt: string;
  status: ChatTurn['status'];
  error?: string;
  saved?: boolean;
  /** Place along the path, from 0. It never changes as later turns arrive. */
  position: number;
  /** Customer turns sit at the start of the cross axis, the trainee's own at the end. */
  side: 'start' | 'end';
  /** How much of the room's attention the turn holds. */
  emphasis: 'active' | 'recent' | 'settled';
  /** Signals and shifts along the path. Always empty when cues are off. */
  marks: PathMark[];
}

export interface PathOptions {
  /** Customer turns whose reply brought a signal to light. */
  signalKeys: readonly string[];
  shifts: readonly ChatShift[];
  cue: CueLevel;
  /** A message is on its way and the customer has not replied yet. */
  pending: boolean;
}

/** How many turns before the active one still count as recent. */
const RECENT_TURNS = 2;

/**
 * The turn the room attends to: the customer's latest, or the trainee's own while it is being
 * sent. A path with no customer turn at all attends to its newest turn. -1 when there are no turns.
 */
function activeIndex(turns: readonly ChatTurn[], pending: boolean): number {
  const last = turns.length - 1;
  const tail = turns[last];
  if (tail?.role === 'trainee' && (tail.status === 'sending' || pending)) return last;
  for (let i = last; i >= 0; i--) {
    if (turns[i]?.role === 'customer') return i;
  }
  return last;
}

function emphasisAt(position: number, active: number): PathNode['emphasis'] {
  if (position === active) return 'active';
  // Turns after the active one (a message that did not get through) are newer than it.
  return position > active || position >= active - RECENT_TURNS ? 'recent' : 'settled';
}

/**
 * The conversation as a path. With `cue: 'none'` the path is only the text: nothing marks where a
 * signal was found or where the conversation changed, so no mark can be inferred from its absence.
 */
export function buildPath(turns: readonly ChatTurn[], options: PathOptions): PathNode[] {
  const active = activeIndex(turns, options.pending);
  const cues = options.cue === 'full';
  const signals = new Set(cues ? options.signalKeys : []);
  const shiftsAfter = new Map<string, ChatShift[]>();
  if (cues) {
    for (const shift of options.shifts) {
      const list = shiftsAfter.get(shift.afterKey);
      if (list) list.push(shift);
      else shiftsAfter.set(shift.afterKey, [shift]);
    }
  }

  return turns.map((turn, position) => {
    const marks: PathMark[] = [];
    if (signals.has(turn.key)) marks.push({ kind: 'signal' });
    for (const shift of shiftsAfter.get(turn.key) ?? []) marks.push({ kind: 'shift', shift });
    return {
      key: turn.key,
      index: turn.index,
      role: turn.role,
      text: turn.text,
      createdAt: turn.createdAt,
      status: turn.status,
      ...(turn.error === undefined ? {} : { error: turn.error }),
      ...(turn.saved === undefined ? {} : { saved: turn.saved }),
      position,
      side: turn.role === 'customer' ? 'start' : 'end',
      emphasis: emphasisAt(position, active),
      marks,
    };
  });
}

// ---------------------------------------------------------------------------------------
// Following the conversation

export interface ScrollMetrics {
  scrollTop: number;
  clientHeight: number;
  scrollHeight: number;
}

/**
 * Whether the reader is at the end of the conversation, give or take `slackPx`. A measurement that
 * is missing counts as near, so the view keeps following rather than leaving the reader behind.
 */
export function isNearBottom(metrics: ScrollMetrics, slackPx = 96): boolean {
  const remaining = metrics.scrollHeight - metrics.scrollTop - metrics.clientHeight;
  return !(remaining > Math.max(0, slackPx));
}

/**
 * What to do when a turn arrives, so a reader can look back at earlier turns without fighting the
 * view: the trainee's own message always brings them to the end, and the customer's reply does
 * only if they were already there. Otherwise the view holds, and the screen can offer a hint that
 * a reply is waiting below.
 */
export function scrollIntent(
  previousNearBottom: boolean,
  newTurnRole: 'customer' | 'trainee',
): 'stick' | 'hold' {
  return newTurnRole === 'trainee' || previousNearBottom ? 'stick' : 'hold';
}

// ---------------------------------------------------------------------------------------
// Accessible names

/** How many characters of a turn an accessible name carries, ellipsis included. */
export const LABEL_TEXT_LIMIT = 140;

const ELLIPSIS = '\u2026';

/** The start of a text on one line, cut between words and no longer than `limit`. */
function excerpt(text: string, limit: number): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (flat.length <= limit) return flat;

  // The last space inside the room leaves whole words; only a single word longer than the room
  // has to be cut through, and then never between the two halves of a surrogate pair.
  const room = limit - ELLIPSIS.length;
  const space = flat.lastIndexOf(' ', room);
  let cut = space > 0 ? flat.slice(0, space) : flat.slice(0, room);
  if (space <= 0 && /[\uD800-\uDBFF]$/.test(cut)) cut = cut.slice(0, -1);
  // "Hello there,…" and "Hello there.…" read better without the mark before the ellipsis.
  const trimmed = cut.replace(/[\s,;:.\u2013\u2014-]+$/, '');
  return `${trimmed || cut}${ELLIPSIS}`;
}

/**
 * A name for a turn, for assistive technology: "Turn 7, Maya: …" or "Turn 8, you: …". Long turns
 * are shortened (see `LABEL_TEXT_LIMIT`) at a word, and line breaks become spaces.
 */
export function describeNode(node: PathNode, customerName: string): string {
  const turn = node.index ?? node.position + 1;
  const who = node.role === 'trainee' ? 'you' : customerName.trim() || 'the customer';
  const text = excerpt(node.text, LABEL_TEXT_LIMIT);
  return text === '' ? `Turn ${turn}, ${who}` : `Turn ${turn}, ${who}: ${text}`;
}
