// The few addresses the public pages link to outside Firefly. Kept in one place so every page and
// every test agrees on them.

export const REPOSITORY_URL = 'https://github.com/snowjug/Firefly';
export const ISSUES_URL = `${REPOSITORY_URL}/issues`;
export const CONTRIBUTORS_URL = `${REPOSITORY_URL}/graphs/contributors`;

/** Microsoft's description of how Azure AI Speech handles audio for real-time speech to text. */
export const AZURE_SPEECH_PRIVACY_URL =
  'https://learn.microsoft.com/en-us/azure/foundry/responsible-ai/speech-service/speech-to-text/data-privacy-security';

/** Microsoft's page on the optional logging of audio and transcriptions for speech recognition. */
export const AZURE_SPEECH_LOGGING_URL =
  'https://learn.microsoft.com/en-us/azure/ai-services/speech-service/logging-audio-transcription';

/** Google's terms for the Gemini API, which differ between unpaid and paid use. */
export const GEMINI_TERMS_URL = 'https://ai.google.dev/gemini-api/terms';
