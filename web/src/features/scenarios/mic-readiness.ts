import type { IconName } from '../../design/index.ts';
import type { MicrophoneFailure } from '../voice/capture/types.ts';

// What the brief says about the microphone beside the Start button: one short line and an icon,
// worked out from what is known. It is readiness, not a promise: the browser decides when the
// microphone really opens, and only after the person allows it.

/** The microphone check the trainee can run from the brief. */
export type MicCheck =
  | { status: 'idle' }
  | { status: 'requesting' }
  | { status: 'listening' }
  | { status: 'ok' }
  | { status: 'silent' }
  | { status: 'failed'; reason: MicrophoneFailure };

/** What the browser says about microphone permission, when it says anything. */
export type Permission = 'granted' | 'denied' | 'prompt' | 'unknown';

export interface Readiness {
  tone: 'neutral' | 'success' | 'warning' | 'danger';
  icon: IconName;
  text: string;
}

const FAILURES: Record<MicrophoneFailure, string> = {
  denied: 'Microphone blocked in the browser. You can type the call.',
  missing: 'No microphone found. You can type the call.',
  busy: 'The microphone is in use by another app.',
  unsupported: 'This browser cannot use a microphone here.',
};

export function describeReadiness(input: {
  /**
   * What is known about speech here: still being looked up, could not be looked up, not possible in
   * this browser (a typed call), or possible (a spoken call).
   */
  speech: 'loading' | 'failed' | 'typed' | 'voice';
  /** For a typed call: whether the page being insecure is the reason. */
  typedBecause?: 'insecure' | 'unsupported' | null;
  check: MicCheck;
  permission: Permission;
}): Readiness {
  const { speech, check, permission } = input;
  if (speech === 'loading') {
    return { tone: 'neutral', icon: 'microphone', text: 'Checking what this browser can do.' };
  }
  if (speech === 'failed') {
    return {
      tone: 'warning',
      icon: 'warning',
      text: 'Speech settings could not be loaded. You can type the call.',
    };
  }
  if (speech === 'typed') {
    return {
      tone: 'neutral',
      icon: 'keyboard',
      text:
        input.typedBecause === 'insecure'
          ? 'Voice needs a secure (https) connection. You can type the call.'
          : 'Voice is not available here. You can type the call.',
    };
  }
  switch (check.status) {
    case 'requesting':
      return { tone: 'neutral', icon: 'microphone', text: 'Waiting for permission' };
    case 'listening':
      return { tone: 'neutral', icon: 'microphone', text: 'Listening. Say a few words.' };
    case 'ok':
      return { tone: 'success', icon: 'check-circle', text: 'Microphone works.' };
    case 'silent':
      return { tone: 'warning', icon: 'warning', text: 'No sound heard. Check your microphone.' };
    case 'failed':
      return { tone: 'danger', icon: 'microphone-off', text: FAILURES[check.reason] };
    case 'idle':
      break;
  }
  if (permission === 'granted') {
    return { tone: 'success', icon: 'check-circle', text: 'Microphone allowed.' };
  }
  if (permission === 'denied') {
    return { tone: 'danger', icon: 'microphone-off', text: FAILURES.denied };
  }
  return {
    tone: 'neutral',
    icon: 'microphone',
    text: 'The browser will ask to use your microphone.',
  };
}
