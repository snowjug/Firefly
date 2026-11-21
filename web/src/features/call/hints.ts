import { MAX_MESSAGE_CHARS, REDACTION_LABELS } from '#shared/domain/text.ts';
import type { Hint } from './machine.ts';

// The soft guidance shown beside the call controls: not an error, and nothing the trainee has to
// act on. British English, one short sentence, never blaming the trainee. It is guidance, not
// instruction: what to do is on the buttons.

function listOf(labels: readonly string[]): string {
  if (labels.length <= 1) return labels.join('');
  return `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;
}

export function hintText(hint: Hint): string {
  switch (hint.code) {
    case 'nothing-heard':
      return 'Nothing was heard. Check your microphone.';
    case 'no-words':
      return 'No words could be made out. Speak again, or use text.';
    case 'muted':
      return 'You are muted.';
    case 'paused':
      return 'The call is paused.';
    case 'captions-only':
      return 'Replies appear as captions. This browser cannot speak them.';
    case 'long-turn':
      return 'Sent after 30 seconds of speaking.';
    case 'busy':
      return 'Wait for the customer to reply.';
    case 'retry-first':
      return 'Retry your last message first.';
    case 'empty':
      return 'Type a message first.';
    case 'too-long':
      return `Messages can be up to ${MAX_MESSAGE_CHARS.toLocaleString('en-GB')} characters.`;
    case 'rejected':
      return 'That message could not be sent. Check it and retry.';
    case 'redacted': {
      const labels = (hint.kinds ?? []).map((kind) => REDACTION_LABELS[kind]);
      const what = labels.length > 0 ? listOf(labels) : 'personal details';
      return `Removed ${what} before saving. Never use real customer details.`;
    }
    case 'discarded-muted':
      return 'You muted the microphone, so that sentence was not sent.';
    case 'discarded-paused':
      return 'You paused the call, so that sentence was not sent.';
    case 'no-voice':
      return 'Replies appear as captions.';
    case 'not-started':
      return 'Start the call first.';
    case 'wait-customer':
      return 'Wait for the customer, or stop their audio.';
  }
}
