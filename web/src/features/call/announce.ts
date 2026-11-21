import type { MachineState } from './machine.ts';
import { hintText } from './hints.ts';
import { describeProblem } from './problems.ts';

// The sentence a screen reader should hear when the call changes, or null when nothing needs saying.
// Whole sentences about what the screen shows, never transcript text (the transcript is its own live
// log) and never one character at a time. At most one sentence per change: a problem wins over a
// hint, a hint over a switch the trainee flipped (mute, pause), and that over a change of phase.

export function announcementFor(previous: MachineState, next: MachineState): string | null {
  if (next.problem && next.problem !== previous.problem) {
    const copy = describeProblem(next.problem.code, next.problem.context);
    return copy.severity === 'blocking'
      ? `Problem: ${copy.title} ${copy.advice}`
      : `Problem: ${copy.title}`;
  }
  if (next.hint && next.hint !== previous.hint) return hintText(next.hint);

  // Muting or pausing also changes the phase; what the trainee did is what they need to hear.
  if (next.muted !== previous.muted) return next.muted ? 'Muted.' : 'Microphone on.';
  if (next.paused !== previous.paused) return next.paused ? 'Call paused.' : 'Call resumed.';

  if (next.phase !== previous.phase) {
    switch (next.phase) {
      case 'requesting-microphone':
        return 'Asking for the microphone.';
      case 'listening':
        return 'Listening.';
      case 'processing':
        return 'Message sent. Waiting for the customer to reply.';
      case 'customer-speaking':
        return 'The customer is speaking.';
      case 'ready-for-next-turn':
        // Hands-free calls say "Listening." a moment later; a second sentence would only get in the way.
        return previous.phase === 'ending' || next.timer?.kind === 'settle' ? null : 'Your turn.';
      case 'ending':
        return 'Ending the call.';
      case 'completed':
        return 'The call has ended.';
      default:
        return null;
    }
  }
  return null;
}
