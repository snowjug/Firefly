import type {
  SpeechCapabilitiesDTO,
  SpeechLanguage,
  SpeechProviderKind,
} from '#shared/domain/speech.ts';
import { normaliseLang } from '../voice/playback/voices.ts';
import type { RecognitionMode } from '../voice/capture/recognition.ts';
import type { CaptureKind, PlaybackKind, VoiceFeatures } from '../voice/support.ts';
import type { CallSupport } from './contract.ts';

// What a spoken call can do in this browser with this server, in the words the screen shows beside
// the controls. It never claims more than will really happen: a label names the service that will
// really process the speech, and a voice call that is not possible says why in one sentence.

/** The browser voice that spoke the latest reply. */
export interface SpokenVoice {
  /** The voice's name, or null when the browser's own default voice spoke. */
  name: string | null;
  /** The voice's language tag, when the browser says. */
  lang: string | null;
  /** True when it runs on this device, false when it is online, null when unknown. */
  local: boolean | null;
}

export interface SupportInput {
  speech: Pick<SpeechCapabilitiesDTO, 'label' | 'transcribe' | 'synthesize'> & {
    /** Which speech provider the server runs (`/api/config`), for what the privacy details say. */
    provider?: SpeechProviderKind;
    /** The scripted demonstration provider (see `CallSupport.speechDemo`). */
    demo?: boolean;
  };
  features: VoiceFeatures;
  capture: CaptureKind;
  playback: PlaybackKind;
  /** Where the browser's own recognition runs, once known. */
  recognitionMode?: RecognitionMode;
  /** Whether this browser is Chromium-based, where recognition is normally an online service. */
  chromium?: boolean;
  /** The language the trainee chose, to say when a browser voice speaks another variety of it. */
  language?: SpeechLanguage;
  /** The browser voice that spoke the latest reply, or null while none has spoken yet. */
  voice?: SpokenVoice | null;
}

function whyNoVoice(input: SupportInput): string {
  const { features, speech } = input;
  if (!features.secureContext) {
    return 'Spoken calls need a secure (https) connection. You can still type your replies.';
  }
  if (!features.microphone && !features.recognition) {
    return 'This browser cannot use a microphone. You can still type your replies.';
  }
  if (speech.transcribe && !features.worklet && !features.recognition) {
    return 'This browser cannot record speech for the speech service. Use Microsoft Edge or Google Chrome, or type your replies.';
  }
  return 'This browser has no speech recognition, and the speech service is not available. Use Microsoft Edge or Google Chrome, or type your replies.';
}

function captureLabel(input: SupportInput): string {
  switch (input.capture) {
    case 'server-speech':
      return input.speech.label;
    case 'browser-recognition': {
      const mode =
        input.recognitionMode && input.recognitionMode !== 'unknown'
          ? input.recognitionMode
          : input.chromium
            ? 'browser-service'
            : 'unknown';
      return mode === 'on-device'
        ? 'Browser speech recognition (on this device)'
        : mode === 'browser-service'
          ? 'Browser speech recognition (online)'
          : 'Browser speech recognition';
    }
    case 'none':
      return 'Typed replies only';
  }
}

/** "Microsoft Zira - English (United States)" is shown as "Microsoft Zira". */
export function shortVoiceName(name: string): string {
  const short = name.split(' - ')[0]?.trim();
  return short ? short : name.trim();
}

// The browser's own voices are whatever the device has, so the label says so, names the voice once
// one has spoken, and says when it is for another variety of English than the one that was chosen
// (a Windows browser often has no British English voice at all).
function browserVoiceLabel(input: SupportInput): string {
  const voice = input.voice;
  if (!voice) return 'Browser voice';
  if (!voice.name) return 'Browser voice (default voice)';
  const where =
    voice.local === false ? ' (online)' : voice.local === true ? ' (on this device)' : '';
  const other =
    voice.lang && input.language && normaliseLang(voice.lang) !== normaliseLang(input.language)
      ? `, ${voice.lang.replace('_', '-')}`
      : '';
  return `Browser voice${where}: ${shortVoiceName(voice.name)}${other}`;
}

function playbackLabel(input: SupportInput): string {
  switch (input.playback) {
    case 'server-speech':
      return input.speech.label;
    case 'browser-synthesis':
      return browserVoiceLabel(input);
    case 'none':
      return 'Captions only';
  }
}

export function describeCallSupport(input: SupportInput): CallSupport {
  const usesServerSpeech = input.capture === 'server-speech' || input.playback === 'server-speech';
  return {
    capture: input.capture,
    playback: input.playback,
    provider: input.speech.provider ?? 'none',
    chromium: input.chromium === true,
    secureContext: input.features.secureContext,
    reason: input.capture === 'none' ? whyNoVoice(input) : null,
    captureLabel: captureLabel(input),
    playbackLabel: playbackLabel(input),
    speechDemo: usesServerSpeech && input.speech.demo === true,
  };
}
