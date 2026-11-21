import { MAX_MESSAGE_CHARS, REDACTION_LABELS } from '#shared/domain/text.ts';
import type { Hint } from './machine.ts';

// The soft guidance shown beside the call controls: not an error, and nothing the trainee has to
// act on. British English, one whole sentence (or two), never blaming the trainee.

function listOf(labels: readonly string[]): string {
  if (labels.length <= 1) return labels.join('');
  return `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;
}

export function hintText(hint: Hint): string {
  switch (hint.code) {
    case 'nothing-heard':
      return 'Nothing was heard. Check that the right microphone is selected, then speak again, or type your reply.';
    case 'no-words':
      return 'Your voice was picked up, but no words could be made out. Speak again, or type your reply.';
    case 'muted':
      return 'You are muted. Turn off mute to speak.';
    case 'paused':
      return 'The call is paused. Resume it to speak or to hear the customer.';
    case 'captions-only':
      return "This browser cannot speak the customer's replies, so you will read them as captions.";
    case 'long-turn':
      return 'Your turn was sent after 30 seconds of speaking, so the customer will reply to that part.';
    case 'busy':
      return 'Wait for the customer to reply before sending another message.';
    case 'retry-first':
      return 'Your last message has not been answered yet. Choose Try again to send it before writing another.';
    case 'empty':
      return 'Type a message before sending.';
    case 'too-long':
      return `Messages can be up to ${MAX_MESSAGE_CHARS.toLocaleString('en-GB')} characters.`;
    case 'rejected':
      return 'That message could not be sent. Check it and try again.';
    case 'redacted': {
      const labels = (hint.kinds ?? []).map((kind) => REDACTION_LABELS[kind]);
      const what = labels.length > 0 ? listOf(labels) : 'personal details';
      return `Firefly removed ${what} from your message before saving it. Please never use real customer details.`;
    }
    case 'discarded-muted':
      return 'You muted the microphone, so the sentence you had just said was not sent.';
    case 'discarded-paused':
      return 'You paused the call, so the sentence you had just said was not sent.';
    case 'no-voice':
      return "This browser cannot speak the customer's replies.";
    case 'not-started':
      return 'Start the call before sending a message.';
  }
}
