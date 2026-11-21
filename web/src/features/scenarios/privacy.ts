import type { AppConfigDTO } from '#shared/domain/api.ts';
import type { SpeechProviderKind } from '#shared/domain/speech.ts';
import {
  MICROPHONE_NOTICE,
  PRIVACY_DETAILS_LABEL,
  privacyDetails as voicePrivacyDetails,
} from '../voice/privacy.ts';
import { isChromiumBrowser } from '../voice/support.ts';
import { describeCustomer, type SpeechSetup } from './speech-setup.ts';

// What the trainee is told about their voice before a first spoken call: one sentence, and the
// details behind it. The words are the voice feature's, so they say only what is true for the path
// speech really takes in this setup (who turns the trainee's speech into text, who speaks the
// customer, where audio goes); this file only gives them to the screen, with one more line about
// who plays the customer.

export { MICROPHONE_NOTICE, PRIVACY_DETAILS_LABEL };

export interface NoticeDetail {
  id: string;
  /** A short heading for the item. */
  label: string;
  /** One or two plain sentences. */
  text: string;
}

/**
 * The expandable details. `setup` is null while the server's settings are not known, and then the
 * details describe a call that is typed, which is what is offered when they cannot be loaded.
 */
export function privacyDetails(
  setup: SpeechSetup | null,
  speechProvider: SpeechProviderKind | null,
  provider: AppConfigDTO['provider'] | null,
): NoticeDetail[] {
  const details: NoticeDetail[] = voicePrivacyDetails({
    provider: speechProvider ?? 'none',
    capture: setup?.capture ?? 'none',
    playback: setup?.playback ?? 'none',
    chromium: isChromiumBrowser(),
  });
  if (provider) {
    details.push({
      id: 'customer-model',
      label: 'Who plays the customer',
      text: describeCustomer(provider),
    });
  }
  return details;
}
