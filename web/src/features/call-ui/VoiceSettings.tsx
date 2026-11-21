import { Button, Dialog, Field, Select, Switch } from '../../design/index.ts';
import { SPEECH_LANGUAGES, type SpeechLanguage } from '#shared/domain/speech.ts';
import type { CallActions, CallSupport } from '../call/contract.ts';
import { LANGUAGE_NAMES } from './call-model.ts';
import './voice-settings.css';

export interface VoiceSettingsProps {
  open: boolean;
  onClose(): void;
  handsFree: boolean;
  language: SpeechLanguage;
  /** The voice that really spoke the latest reply, and the expressive style the provider applied. */
  voice: string | null;
  style: string | null;
  support: Pick<
    CallSupport,
    'capture' | 'playback' | 'captureLabel' | 'playbackLabel' | 'speechDemo'
  >;
  actions: Pick<CallActions, 'setHandsFree' | 'setLanguage'>;
}

const APPROXIMATED = 'approximated by pace and pitch';

/** What voice is speaking, said as plainly as the headers of the last reply allow. */
export function describeVoice(
  voice: string | null,
  style: string | null,
  support: Pick<CallSupport, 'playback' | 'playbackLabel'>,
): { voice: string; style: string } {
  if (support.playback === 'none') {
    return { voice: 'None. The customer is shown as captions.', style: 'not applicable' };
  }
  if (support.playback === 'browser-synthesis') {
    // The call names the browser's voice itself ("Browser voice (on this device): Microsoft David,
    // en-US"), so it is shown as it is: the word "Browser" is never dropped for a bare voice name.
    return { voice: support.playbackLabel, style: APPROXIMATED };
  }
  const waiting = 'Shown once the customer has spoken';
  return {
    voice: voice ?? waiting,
    style: style === null ? waiting : style === 'none' ? APPROXIMATED : style,
  };
}

/**
 * Hands-free, the language for speech, and a plain read-out of which voice and which recognition
 * service are really in use. Nothing here claims more than the provider reported.
 */
export function VoiceSettings({
  open,
  onClose,
  handsFree,
  language,
  voice,
  style,
  support,
  actions,
}: VoiceSettingsProps) {
  const spoken = describeVoice(voice, style, support);
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Voice settings"
      size="sm"
      actions={
        <Button appearance="primary" onClick={onClose} data-autofocus>
          Done
        </Button>
      }
    >
      <div className="cw-settings">
        <Switch
          label="Hands-free"
          description="The microphone opens by itself after each customer reply, and waits for you after three empty tries in a row. Turn it off to press Talk each time."
          checked={handsFree}
          onChange={(event) => actions.setHandsFree(event.currentTarget.checked)}
        />
        <Field label="Speech language" hint="Used to understand you and to speak for the customer.">
          <Select
            value={language}
            onChange={(event) => actions.setLanguage(event.currentTarget.value as SpeechLanguage)}
          >
            {SPEECH_LANGUAGES.map((code) => (
              <option key={code} value={code}>
                {LANGUAGE_NAMES[code]}
              </option>
            ))}
          </Select>
        </Field>
        <dl className="cw-settings__facts">
          <div className="cw-settings__fact">
            <dt>Customer voice</dt>
            <dd>{spoken.voice}</dd>
          </div>
          <div className="cw-settings__fact">
            <dt>Expressive style</dt>
            <dd>{spoken.style}</dd>
          </div>
          <div className="cw-settings__fact">
            <dt>Speech recognition</dt>
            <dd>
              {support.capture === 'none' ? 'Not available in this browser' : support.captureLabel}
              {support.capture === 'browser-recognition' ? (
                <span className="cw-settings__note">
                  It can miss words, so you can always type your reply.
                </span>
              ) : null}
              {support.capture === 'server-speech' && support.speechDemo ? (
                <span className="cw-settings__note">
                  It does not understand audio: it returns scripted text instead of what you say.
                </span>
              ) : null}
            </dd>
          </div>
        </dl>
      </div>
    </Dialog>
  );
}
