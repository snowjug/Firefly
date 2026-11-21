import type { SpeechProviderKind } from '#shared/domain/speech.ts';
import type { CaptureKind, PlaybackKind } from './support.ts';

// What a trainee is told about their voice, before the first use and in the expandable details. It is
// plain data for the screen to render, and every statement is a statement about this code:
// where audio goes depends on which speech path is really in use, so the details take that path as
// input and say only what is true for it.

/** Shown before the first use, exactly. */
export const MICROPHONE_NOTICE =
  'Firefly uses your microphone to transcribe this simulated call. Do not share real customer information.';

/** The label of the control that opens the details. */
export const PRIVACY_DETAILS_LABEL = 'How your voice is handled';

export const PRIVACY_DETAIL_IDS = [
  'synthetic-only',
  'permission-first',
  'recording-status',
  'stop-any-time',
  'typed-fallback',
  'raw-audio',
  'transcript',
  'provider',
] as const;
export type PrivacyDetailId = (typeof PRIVACY_DETAIL_IDS)[number];

export interface PrivacyDetail {
  id: PrivacyDetailId;
  /** A short heading for the item. */
  label: string;
  /** One or two plain sentences. */
  text: string;
}

export interface PrivacyContext {
  /** What the server's speech provider is (`/api/config`, `speech.provider`). */
  provider: SpeechProviderKind;
  /** Who turns the trainee's speech into text in this call. */
  capture: CaptureKind;
  /** Who speaks the customer's replies. */
  playback: PlaybackKind;
  /** The browser is Chrome or Edge, where recognition is normally an online service. */
  chromium?: boolean;
}

const PROVIDER_NAMES: Record<SpeechProviderKind, string> = {
  none: 'No speech service',
  mock: 'Demo speech (scripted)',
  'azure-speech': 'Azure AI Speech',
};

/** Which service handles the trainee's audio, in a sentence. */
export function whoHearsYou(context: PrivacyContext): string {
  switch (context.capture) {
    case 'server-speech':
      return context.provider === 'azure-speech'
        ? 'Your speech is sent through this Firefly server to Azure AI Speech, which turns it into text.'
        : 'This Firefly server receives your recording and throws it away without understanding it, because the speech service in use is a scripted demonstration. Nothing is sent to any other service.';
    case 'browser-recognition':
      return context.chromium
        ? "Your browser's own speech recognition turns your speech into text, and Firefly never receives the audio. In Edge and Chrome this is normally an online service run by the browser's maker, unless your device can do it by itself."
        : "Your browser's own speech recognition turns your speech into text, and Firefly never receives the audio. Where the browser does this is up to the browser.";
    case 'none':
      return 'No speech service is in use, so you type your replies and no audio is recorded.';
  }
}

/** Which voice speaks for the customer, in a sentence. */
export function whoSpeaksForTheCustomer(context: PrivacyContext): string {
  switch (context.playback) {
    case 'server-speech':
      return context.provider === 'azure-speech'
        ? "The customer's lines are sent to Azure AI Speech, which speaks them in a synthetic voice."
        : "The customer's voice is a short placeholder sound made on this server. It is not speech, and nothing leaves the server.";
    case 'browser-synthesis':
      return "The customer is spoken by one of your browser's own synthetic voices. No real person is recorded or copied.";
    case 'none':
      return "The customer's replies are shown as text only.";
  }
}

/**
 * The details that go under "How your voice is handled", in order, for the speech path in use. The
 * last one says which service handles the audio: Azure AI Speech through this server, the browser's
 * own speech service, or none.
 */
export function privacyDetails(context: PrivacyContext): PrivacyDetail[] {
  const rawAudio: Record<CaptureKind, string> = {
    'server-speech':
      'Your recording is held in memory only until it has been turned into text, then discarded. The server does not write it to disk or to a database and does not log it, and it overwrites its own copy as soon as the request is over. If turning it into text fails, the recording may be kept in your browser for a retry until you try again, type instead, or end the call.',
    'browser-recognition':
      'Firefly never receives or keeps your audio on this path. Your browser handles it, as the last item says.',
    none: 'Nothing is recorded, so there is no audio to keep.',
  };
  return [
    {
      id: 'synthetic-only',
      label: 'Synthetic scenarios only',
      text: 'Every customer, product problem and case is made up. Do not say or type real customer names, contact details or account information.',
    },
    {
      id: 'permission-first',
      label: 'Starts only after you allow it',
      text: 'The microphone is not used until you start the call and allow it in your browser. A call with no microphone never asks for one.',
    },
    {
      id: 'recording-status',
      label: 'You can always see when it is recording',
      text: 'While Firefly is listening, the screen says Listening and your browser shows its own recording indicator.',
    },
    {
      id: 'stop-any-time',
      label: 'Stop at any time',
      text: 'You can mute, pause, or choose Done speaking to end what you are saying. Pausing or ending the call lets go of the microphone.',
    },
    {
      id: 'typed-fallback',
      label: 'You can type instead',
      text: 'Typing a reply always works, and nothing is recorded when you type.',
    },
    {
      id: 'raw-audio',
      label: 'Your recording is discarded',
      text: rawAudio[context.capture],
    },
    {
      id: 'transcript',
      label: 'The transcript is saved with the call',
      text: "The words of the call, yours and the customer's, are saved as text with the call on the Firefly server, so your report can quote them. No audio is saved. The call and its transcript stay on the server until the call is deleted.",
    },
    {
      id: 'provider',
      label: `Who handles your audio: ${context.capture === 'none' ? PROVIDER_NAMES.none : context.capture === 'browser-recognition' ? 'Your browser' : PROVIDER_NAMES[context.provider]}`,
      text: `${whoHearsYou(context)} ${whoSpeaksForTheCustomer(context)}`,
    },
  ];
}
