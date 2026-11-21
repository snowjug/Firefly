# Privacy and audio

Firefly is a training aid with fictional scenarios. This page says exactly what happens to the words and the voice that go into it: when the microphone is on, where speech goes, what is stored, what is logged and what Firefly deliberately does not do. For how the spoken call works, see [voice-architecture.md](voice-architecture.md); for the server's speech settings, [speech-providers.md](speech-providers.md).

**Never say or type real customer information.** Scenarios, customers and products are invented. Firefly removes obvious personal data from typed or recognised text before it is saved, but it cannot remove personal details from audio, and nothing here makes it safe to use real cases.

## At a glance

| Question                                 | Answer                                                                                                                                                                                                                                                                   |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Does Firefly record audio?               | No. An utterance exists in memory for as long as one request takes. It is never written to disk, never logged, never put in the database and never sent anywhere except where [Where speech goes](#where-speech-goes) says.                                              |
| When does the microphone turn on?        | Only after you press **Allow microphone and start** on the call screen, and your browser then asks you. Not when a page loads, not on the brief, and never in a text-only call.                                                                                          |
| Can I stop it?                           | Yes, at any point: mute, pause, or end the call. Pause and End release the microphone. See [Microphone controls](#microphone-controls).                                                                                                                                  |
| Who receives my speech?                  | It depends on how Firefly is set up: Azure AI Speech through the server, your browser's own speech service, or nobody (a typed call, or the demo speech provider that discards the audio). The call screen says which before you start.                                  |
| What is stored?                          | The transcript text of the call (both sides), whether each of your turns was spoken or typed, the call's settings and timings, and the coaching report. An anonymous cookie links a browser to its calls. Nothing else about you. See [What is stored](#what-is-stored). |
| Are the customer's voice and words real? | No. The customer is fictional, played by Firefly's rules engine or a language model, and speaks in a synthetic voice. No real person is recorded, imitated or cloned.                                                                                                    |

## Where speech goes

The call screen and the pre-flight page show which of these applies, from what is really in use.

| How the server is set up                                     | Your speech (microphone)                                                                                                                                                                                                            | The customer's voice                                                                                                                                                    |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Azure AI Speech** (`FIREFLY_SPEECH_PROVIDER=azure-speech`) | Your browser records one utterance and sends it to the Firefly server as a WAV. The server holds it in memory for one request, forwards it to Azure AI Speech over HTTPS and returns the text. Firefly keeps nothing.               | The customer's stored line, with a voice and mood direction, is sent to Azure AI Speech. The audio that comes back goes to your browser with `Cache-Control: no-store`. |
| **Demo speech** (`mock`, for tests and demonstrations)       | The server receives the WAV and **discards** it. It does not understand audio: it returns the next of eight fixed sentences. Labelled "Demo speech (scripted)".                                                                     | A short soft sound that follows the length of the line. It is not speech. Nothing leaves the machine.                                                                   |
| **Not configured** (default) in Edge or Chrome               | Your browser's own speech recognition listens. **Firefly never sees the audio.** In Chromium this is normally the browser maker's online service (Microsoft for Edge, Google for Chrome) unless on-device recognition is available. | Your browser's own voices (`speechSynthesis`). Most are installed on the device; some online voices send the customer's fictional words to the browser maker.           |
| **Not configured** in a browser with no recognition          | Typed only. No audio at all.                                                                                                                                                                                                        | The browser's voices if present, otherwise captions only.                                                                                                               |
| A **text-only call**, in any set-up                          | The microphone is never requested.                                                                                                                                                                                                  | Replies are text, plus the browser's voice if you left it on.                                                                                                           |

What Microsoft says about Azure AI Speech (documentation pages "Data, privacy, and security for Speech to text" and "...for text to speech", read on the date of writing): real-time speech to text processes audio in server memory and stores no data at rest; real-time synthesis does not store input text or output audio in Microsoft logs. Firefly does not inspect the operator's resource settings, and the operator's own agreement with Microsoft applies. Check the current pages before relying on this. The browser makers' terms apply to browser recognition and online browser voices.

### What is sent to Azure, and what is not

Sent for recognition: the recording (up to 30 seconds, 16 kHz mono) and its language, with `profanity=raw` so that the transcript says what was said (the report quotes it as evidence).

Sent for the customer's voice: one SSML document with the voice name, the language, rate and pitch values (and a style name only where the voice supports it) and **one customer line**.

Not sent: the profile cookie, the session id, the scenario title, the customer's name or background, the hidden facts, the engine's numbers, the scores, the rest of the transcript or your typed messages. The one scenario-derived text that is sent is the customer line being spoken, which you already see in the transcript. A test (`server/http/speech.test.ts`) checks the request path, query, headers and SSML for all of this. Two things are disclosed by the request itself: the style name and the rate and pitch values reveal the customer's mood band in coarse terms, and the recording contains whatever you say aloud.

## Microphone controls

- **Start.** The microphone is requested only inside the click on **Allow microphone and start**. If you decline, nothing was recorded, and you can start a text-only call.
- **While the call is live.** The browser shows its recording indicator while the microphone is held open. Firefly reads audio only while it is listening for you (and to finish an utterance), never while the customer is speaking, and never when you are muted or paused.
- **Mute** disables the microphone track. **Pause** releases the microphone and stops the customer's voice. **End and review**, and leaving the call screen, release it too and stop any customer audio.
- If you unplug the microphone or the browser withdraws permission, the call says so and carries on by typing.
- There is no recording in the background, no recording before you start, and no way for Firefly to listen after the call has ended.

## What is stored

On the server (a local SQLite file, `data/firefly.db` by default, not encrypted by Firefly):

| Table              | Holds                                                                                                                      |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| `sessions`         | The scenario snapshot and settings, status, timings, the model provider that was used, the evaluator and rubric versions.  |
| `turns`            | The transcript text of both sides, each trainee turn's classification, and `input_mode` (`voice` or `text`) for each turn. |
| `state_events`     | Every change of the customer's mood with its reason.                                                                       |
| `discovery_events` | Which hidden facts were found, partly found or missed, and the question that revealed them.                                |
| `evaluations`      | One coaching report per call.                                                                                              |

**Never stored:** audio, in any form. Recognised text is stored only when it is sent as a message, as a normal trainee turn. The customer's spoken audio is generated per request and not kept.

**Redaction.** Obvious personal data in a trainee message (email addresses, phone numbers, card-like and identifier-like numbers) is replaced with a marker before the message is saved or sent to a language model. This runs on the recognised text, after recognition, exactly as it does for typed text.

**Browser.** An HttpOnly, SameSite=Lax cookie named `firefly_profile` holds a random anonymous id so that a browser can see only the calls it started. It is not a login: Firefly has no accounts, and anyone with access to the server can read its database. Keep Firefly on a trusted network, or put sign-in and TLS in front of it. The web app itself writes nothing to `localStorage`, IndexedDB or a cache, and registers no service worker. In `sessionStorage` it keeps only React Router's scroll offsets (`react-router-scroll-positions`: a number for each page visited in that tab, with no text), so that Back and a reload return to where you were; they are gone when the tab closes. `e2e/landing.spec.ts` checks all of this.

**Language model.** In live mode (Gemini, Azure OpenAI or an OpenAI-compatible endpoint), redacted transcript text and the facts the engine has decided the customer may share go to that provider. Hidden facts the trainee has not earned are never sent. See [ai-providers.md](ai-providers.md#what-is-sent-to-the-model-and-what-is-not). Free-tier services may use and human-review what is submitted: read the provider's terms and use fictional scenarios only.

**Retention and deletion.** Calls stay until they are deleted. There is no automatic expiry. You can delete a call from the bottom of its report (**Delete this call**), which removes its transcript, mood record, discovery record and coaching report from the database. The same action is available through the API (`DELETE /api/sessions/:id`), and deleting the database file removes everything for everyone.

## What is logged

One JSON line on the server's standard output per event. Fields named `text`, `body`, `transcript`, `apiKey`, `authorization`, `password`, `secret`, `token` or `prompt` are dropped, and strings over 200 characters are cut.

| Event                         | Fields                                                                                                                                                                                                                                         |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `request` (every API request) | A short request id, the route pattern (or `unmatched` when the request fails before a route matches, so a path is never logged), status (`499` for a request the browser cancelled), milliseconds, and the first 8 characters of a session id. |
| `speech.transcribed`          | Request id, provider, upload size in bytes, audio length in milliseconds, status, milliseconds.                                                                                                                                                |
| `speech.spoken`               | Request id, provider, audio size in bytes, milliseconds.                                                                                                                                                                                       |
| `speech.failed`               | Request id, `transcribe` or `speak`, provider, error code, milliseconds.                                                                                                                                                                       |

Never logged: audio, recognised or spoken words, keys, the provider's own wording, headers or addresses.

## What Firefly does not do

- It does not record, keep or upload audio, and it does not record before you press start or after the call ends.
- It does not clone voices, imitate real people or use custom or personal voices. The customer's voice is a prebuilt synthetic voice.
- It does not detect emotion, stress or identity from your voice, and it does not score tone, accent or pace. Coaching reads the words only.
- It does not use analytics, tracking pixels or telemetry, and it does not contact any service you have not been told about on the call screen.
- It does not claim that the customer's voice shows real emotion. Pace, pitch and (for a few voices) a style are adjusted to suggest the mood; nobody has measured how that sounds.

## For people who run Firefly

- Keep keys in the server's environment (`.env` is git-ignored). Keys are never sent to the browser or logged. If a key is ever pasted somewhere public, delete it at the provider and create a new one.
- Decide with your organisation which speech provider fits your data rules before you turn one on, and tell trainees which one is active. The pre-flight page shows it to them.
- Speech-to-text of a trainee who says something sensitive aloud is processed by the provider you chose. Tell trainees to use only the fictional details in the call brief.
- Azure resource-level settings (logging, retention, private endpoints, regions) are the operator's responsibility and are not inspected or changed by Firefly.
