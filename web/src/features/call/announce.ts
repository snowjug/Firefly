import { VOICE_STATE_TEXT, type VoiceState } from '../voice/states.ts';
import type { MachineState } from './machine.ts';
import { hintText } from './hints.ts';
import { describeProblem } from './problems.ts';

// The sentence a screen reader should hear when the call changes, or null when nothing needs saying.
// Whole sentences about what the screen shows, never transcript text (the transcript is its own live
// log) and never one character at a time. At most one sentence per change: a problem wins over a
// hint, a hint over a switch the trainee flipped (mute, pause, text, audio), and that over a change
// of phase.
//
// The sentences for the states of a spoken call are the voice layer's (`VOICE_STATE_TEXT`), so the
// words and how urgently they are said are decided in one place: nothing is announced while the
// trainee speaks, and only a blocked microphone is assertive. "Listening" is not announced here: it
// is said when the capture reports that the microphone is really open (see `listeningAnnouncement`).

export interface Announcement {
  text: string;
  politeness: 'polite' | 'assertive';
}

const polite = (text: string): Announcement => ({ text, politeness: 'polite' });

/** What the voice layer says for one of its states, or null when that state is never announced. */
function said(state: VoiceState): Announcement | null {
  const { announcement, politeness } = VOICE_STATE_TEXT[state];
  return announcement !== null && politeness !== 'off' ? { text: announcement, politeness } : null;
}

/** "Listening", said once the microphone is open for the pass. */
export const listeningAnnouncement = (): Announcement | null => said('listening');

export function announcementFor(previous: MachineState, next: MachineState): Announcement | null {
  if (next.problem && next.problem !== previous.problem) {
    const copy = describeProblem(next.problem.code, next.problem.context);
    // A blocked microphone has its own sentence; any other problem says what happened and what was kept.
    if (copy.code === 'microphone-denied') return said('permission-denied');
    return {
      text:
        copy.severity === 'blocking'
          ? `Problem: ${copy.title} ${copy.preserved}`
          : `Problem: ${copy.title}`,
      politeness: copy.announce,
    };
  }
  // A hands-free call that is muted shows "You are muted." as its guidance. The mute has its own
  // sentence, below, so the guidance that arrives with it is not said as well.
  const guidanceOfTheMute = next.hint?.code === 'muted' && next.muted && !previous.muted;
  if (next.hint && next.hint !== previous.hint && !guidanceOfTheMute) {
    return polite(hintText(next.hint));
  }

  // Muting or pausing also changes the phase; what the trainee did is what they need to hear.
  if (next.muted !== previous.muted) return next.muted ? said('muted') : polite('Microphone on.');
  if (next.paused !== previous.paused) {
    return next.paused ? said('paused') : polite('Call resumed.');
  }
  if (previous.begun && next.begun) {
    // Typing instead of speaking, and back. A microphone that was lost says its problem instead.
    if (next.voice !== previous.voice) {
      return next.voice ? polite('Voice mode.') : said('text-fallback');
    }
    if (next.voice && next.canSpeak !== previous.canSpeak) {
      return polite(next.canSpeak ? 'Customer audio on.' : 'Customer audio off.');
    }
  }

  if (next.phase !== previous.phase) {
    switch (next.phase) {
      case 'requesting-microphone':
        return said('requesting-permission');
      case 'transcribing':
        return said('processing-speech');
      case 'processing':
        return next.exchange && next.exchange.attempt > 1
          ? polite('Retrying.')
          : said('generating-customer-reply');
      case 'customer-speaking':
        return said('customer-speaking');
      case 'ready-for-next-turn':
        // Hands-free calls say "Listening." a moment later, and a typed call is not told "you are
        // typing" after every reply: a second sentence would only get in the way.
        return previous.phase === 'ending' || next.timer?.kind === 'settle' || !next.voice
          ? null
          : said('microphone-ready');
      case 'ending':
        return next.ending === 'closing' ? said('evaluating') : said('ending-call');
      case 'completed':
        return said('completed');
      default:
        return null;
    }
  }
  // A message in flight was finished before the call closed: the review is next.
  if (next.phase === 'ending' && previous.ending === 'draining' && next.ending === 'closing') {
    return said('evaluating');
  }
  return null;
}
