# Privacy and audio

Firefly is a training aid with fictional scenarios. This page says what happens to the words and the voice that go into it: when the microphone is on, where speech goes for each set-up, what is stored, how a call is deleted, what is logged and what Firefly deliberately does not do. For how a spoken call works, see [voice-architecture.md](voice-architecture.md). For the server's speech settings, see [speech-providers.md](speech-providers.md).

**Never say or type real customer information.** Scenarios, customers and products are invented. Firefly removes obvious personal data from typed or recognised text before it is saved, but it cannot remove personal details from audio, and nothing here makes it safe to use real cases.

Everything below describes the code in this repository. No speech service has been run live against it, and a language model only in one limited Gemini smoke check, so nothing here is a statement about how a provider treats data in practice. Where a provider's own terms matter, this page says so and points to them.

## At a glance

| Question                                 | Answer                                                                                                                                                                                                                                                                                                                                                     |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Does Firefly keep audio?                 | No. The server holds an uploaded recording in memory for one request and overwrites its own copy when the request ends. It is never written to disk or a database and never logged. Your browser may hold a failed recording for a retry (see [Raw audio](#raw-audio)).                                                                                    |
| When does the microphone turn on?        | Only when you press **Start voice call** on the call's pre-flight page and your browser allows it. The optional **Check microphone** button on the brief also opens it, for a few seconds, and only when pressed. Never when a page loads, and never in a text call.                                                                                       |
| Can I stop it?                           | Yes: **Mute**, **Pause**, **Done speaking**, or **End call** followed by **End and review**. Pausing, or ending the call with **End and review**, lets go of the microphone. It stays live while the "End the call?" dialog is open (see [Microphone controls](#microphone-controls)). A spoken call also pauses by itself when the browser tab is hidden. |
| Who receives my speech?                  | It depends on the set-up: Azure AI Speech through the server, your browser's own speech service, or nobody. The brief and the pre-flight page say which before you start.                                                                                                                                                                                  |
| What is stored?                          | The transcript text of the call (both sides), whether each of your turns was spoken or typed, the scenario snapshot and settings, and the coaching report. Never audio.                                                                                                                                                                                    |
| How do I delete a call?                  | **Delete this call** on its report. See [Deleting a call](#deleting-a-call).                                                                                                                                                                                                                                                                               |
| Are the customer's voice and words real? | No. The customer is fictional and speaks in a synthetic voice. No real person is recorded, imitated or cloned.                                                                                                                                                                                                                                             |

## The first-use notice

Before the first spoken call, the brief shows this sentence with a **Got it** button (`MICROPHONE_NOTICE` in `web/src/features/voice/privacy.ts`):

> Firefly uses your microphone to transcribe this simulated call. Do not share real customer information.

Behind it is a row, **How your voice is handled**, with eight short statements. Each is written for the speech path really in use, so it says only what is true for it:

1. Synthetic scenarios only: every customer, problem and case is made up.
2. The microphone starts only after you start the call and allow it.
3. You can always see when it is recording: the screen says Listening, and your browser shows its own indicator.
4. You can mute, pause or choose Done speaking at any time.
5. Typing a reply always works, and nothing is recorded when you type.
6. Your recording is discarded after it has been turned into text.
7. The transcript is saved as text with the call, and no audio is saved.
8. Who handles your audio: Azure AI Speech through this server, your browser, or no service.

The notice is read once. The browser remembers that in one `localStorage` flag, `firefly.voice-notice-seen` (`web/src/features/scenarios/first-use.ts`). Where storage is blocked, the notice shows again. That flag is the only thing the app keeps in `localStorage`. The only other thing it keeps in the browser is React Router's scroll positions, in `sessionStorage` under `react-router-scroll-positions`: a number for each page visited in that tab, with no text, gone when the tab closes.

## Where speech goes

The brief and the pre-flight page show which of these applies, from what is really in use.

| How the server and browser are set up                        | Your speech                                                                                                                                                                                                   | The customer's voice                                                                                                                                                    |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Azure AI Speech** (`FIREFLY_SPEECH_PROVIDER=azure-speech`) | Your browser records one utterance and sends it to the Firefly server as a WAV. The server holds it in memory for one request, forwards it to Azure AI Speech over HTTPS and returns the text.                | The customer's stored line, with a voice and mood direction, is sent to Azure AI Speech. The audio that comes back goes to your browser with `Cache-Control: no-store`. |
| **Demo speech** (`mock`)                                     | The server receives the WAV and discards it. It does not understand audio: it returns the next of eight fixed sentences. Labelled "Demo speech (scripted)".                                                   | A short soft sound made on the server. It is not speech. Nothing leaves the machine.                                                                                    |
| **Not configured** (the default), in Edge or Chrome          | Your browser's own speech recognition listens. Firefly never receives the audio. In Edge and Chrome this is normally an online service run by the browser's maker, unless on-device recognition is available. | Your browser's own voices. Some are installed on the device. Some online voices send the customer's fictional words to the browser maker.                               |
| **Not configured**, in a browser with no recognition         | Typed only. No audio at all.                                                                                                                                                                                  | The browser's voices if it has them, otherwise captions only.                                                                                                           |
| A **text call**, in any set-up                               | The microphone is never requested.                                                                                                                                                                            | Replies are text, plus a voice if you left it on.                                                                                                                       |

The code says the same thing in the words the trainee reads (`whoHearsYou` and `whoSpeaksForTheCustomer` in `web/src/features/voice/privacy.ts`). The customer's line is always read from the stored call on the server. The browser cannot supply words to be spoken (`getSpeakableTurn` in `server/services/sessions.ts`).

### What is sent to Azure, and what is not

Sent for recognition: the recording (up to 30 seconds, 16 kHz mono) and its language, with `profanity=raw` so that the transcript says what was said, because the report quotes it as evidence.

Sent for the customer's voice: one SSML document with the voice name, the language, rate and pitch values, a style name only where the voice lists it, and **one customer line**.

Not sent: the profile cookie, the session id, the scenario id or title, the customer's name or background, the hidden facts, the engine's numbers, the scores, the rest of the transcript or your typed messages. The one scenario-derived text that is sent is the customer line being spoken, which you already see in the transcript. A test (`server/http/speech.test.ts`) checks the request path, query, headers and SSML for all of this, against a fake Azure server. Two things are disclosed by the request itself: the style name and the rate and pitch values reveal the customer's mood band in coarse terms, and the recording contains whatever you say aloud.

Microsoft documents how Azure AI Speech treats audio and text, and the operator's own agreement with Microsoft applies. Read the current pages before relying on them: [Data, privacy, and security for Speech to text](https://learn.microsoft.com/en-us/azure/foundry/responsible-ai/speech-service/speech-to-text/data-privacy-security) and [for text to speech](https://learn.microsoft.com/en-us/azure/foundry/responsible-ai/speech-service/text-to-speech/data-privacy-security). On 21 November 2026 they said that real-time speech to text processes audio only in the service's server memory and stores no data at rest, and that for prebuilt neural voices neither the input text nor the output audio is stored in Microsoft logs. That is Microsoft's statement, not something Firefly verified. Firefly does not inspect the operator's resource settings. The browser makers' terms apply to browser recognition and online browser voices.

### The language model

In live mode (Gemini, Azure OpenAI or an OpenAI-compatible endpoint), redacted transcript text and the facts the engine has decided the customer may share go to that provider. Hidden facts the trainee has not earned are never sent. See [ai-providers.md](ai-providers.md#what-is-sent-to-the-model-and-what-is-not). Free-tier services may use and human-review what is submitted: read the provider's terms and use fictional scenarios only. In demo mode nothing is sent to any model.

## Microphone controls

- **Start.** The microphone is requested only when you press **Start voice call** on the call's pre-flight page (the page headed "Ready to call?"). The press that opens the pre-flight, on the brief, does not request it. If you decline, nothing was recorded, and you can start a text call instead.
- **Check microphone** (optional, on the brief) opens the microphone only when you press it, shows a level for a few seconds, and lets go on every way out: sound heard, silence, failure, **Stop**, or leaving the page. Nothing is recorded or kept.
- **Permission state** is read without a prompt: the page asks the browser what it has remembered, which never opens the microphone.
- **While the call is live.** The browser shows its recording indicator while the microphone is held open. Firefly reads audio only while it is listening for you, never while the customer is speaking, and never when you are muted or paused.
- **Mute** disables the microphone track. **Pause** releases the microphone and stops the customer's voice. **End and review**, and leaving the call screen, release it too and stop any customer audio.
- **The microphone stays live while the "End the call?" dialog is open.** **End call** only opens the dialog. Until you choose **End and review**, a spoken call carries on listening, and speech heard then is still turned into text and sent as a message, so the dialog's message count can go up. This is a known limitation and has not been changed. Press **Pause** before **End call**, or choose **Continue call** or **End and review** quickly, to avoid it.
- **A hidden tab pauses a spoken call by itself.** When the browser reports the page as hidden (`document.hidden`), a spoken call is paused: the microphone is released and the customer's voice stops. Coming back to the tab does not open the microphone again. The call stays paused until you press **Resume**. A typed call has no microphone, so a hidden tab does not pause it (`onVisibility` in `web/src/features/call/controller.ts`). A unit test sets the hidden flag and checks that no microphone track or listening worklet is left (`web/src/features/call/useCall.flows.test.tsx`). It does not switch a real browser tab.
- If you unplug the microphone or the browser withdraws permission, the call says so and carries on by typing.
- There is no recording in the background, none before you start, and no way for Firefly to listen after the call has ended.

Releasing the microphone, the audio context, the worklet, object URLs, audio elements and timers on every way a call can end is tested with fakes (`web/src/features/voice/lifecycle.test.ts`). That shows the call's own logic, not a browser's behaviour.

## Raw audio

**Server.** A recording reaches the server as an upload. It is held in memory as a buffer, checked, sent to the provider and then zeroed, whatever the outcome (`scrub` in `server/http/app.ts`). Tests read the source of the speech layer, the speech routes and the code that reads an uploaded recording, and check that none of them writes to a file, a temporary folder or a database, and that no module keeps a recording or a line in a variable that outlives the request (`server/speech/boundary.test.ts`). Those tests read source text, so they say what the code can do, not what it did on a run.

**Browser.** For a server speech provider, your browser encodes each utterance as a WAV in memory and sends it. If turning it into text fails in a way that **Retry** can answer, the browser keeps that recording so Retry can send the same one again. It is let go as soon as the words come back, when you type instead, when the attempt is abandoned, and when the call ends or the page is left (`web/src/features/voice/transcriber.ts`). It is never written anywhere.

**Browser recognition.** Firefly never receives audio on this path. The browser handles it.

## What is stored

On the server, in a local SQLite file (`data/firefly.db` by default, not encrypted by Firefly):

| Table              | Holds                                                                                                                     |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `sessions`         | The scenario snapshot and settings, status, timings, the model provider that was used, the evaluator and rubric versions. |
| `turns`            | The transcript text of both sides, each trainee turn's classification, and `input_mode` (`voice` or `text`).              |
| `state_events`     | Every change of the customer's mood, with its reason.                                                                     |
| `discovery_events` | Which hidden facts were found, partly found or missed, and the question that revealed them.                               |
| `evaluations`      | One coaching report per call.                                                                                             |

**Never stored:** audio, in any form. Recognised text is stored only when it is sent as a message, as a normal trainee turn. The customer's spoken audio is generated per request and not kept.

**Redaction.** Obvious personal data in a trainee message (email addresses, phone numbers, card-like numbers and identifiers) is replaced with a marker before the message is saved or sent to a language model (`redactSensitive` in `shared/domain/text.ts`). It runs on recognised text after recognition, exactly as on typed text. It is pattern matching and will not catch everything. When something was removed, the call tells you.

**Browser.** An HttpOnly, SameSite=Lax cookie named `firefly_profile` holds a random anonymous id, so that a browser can see only the calls it started. It is not a login: Firefly has no accounts, and anyone with access to the server can read its database. Keep Firefly on a trusted network, or put sign-in and TLS in front of it.

## Deleting a call

- **On the report.** **Delete this call** at the end of a call's report asks first, then removes the transcript, the mood record, the discovery record and the coaching report from the database.
- **A call with nothing in it.** If you end a call in which no message was sent, there is nothing to report. The end dialog says so and offers **Leave without a report**, which deletes the empty call.
- **Through the API.** `DELETE /api/sessions/:id` does the same. A call that is being answered or evaluated at that moment answers "busy": try again in a moment.
- **Everything.** Deleting the database file removes every call for everyone.

Calls otherwise stay until they are deleted. Firefly has no automatic expiry.

## What is logged

One JSON line on the server's standard output per event. Fields named `text`, `body`, `transcript`, `apiKey`, `api_key`, `authorization`, `password`, `secret`, `token` or `prompt` are dropped, and strings over 200 characters are cut (`server/log.ts`, `server/log.test.ts`).

| Event                               | Fields                                                                                                                                                                      |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `request` (every API request)       | A short request id, the route pattern (`unmatched` when no route matched, so a raw path is never logged), status, milliseconds, and the first 8 characters of a session id. |
| `speech.transcribed`                | Request id, provider, upload size in bytes, audio length in milliseconds, status, milliseconds.                                                                             |
| `speech.spoken`, `speech.previewed` | Request id, provider, audio size in bytes, milliseconds (and the voice id for the preview).                                                                                 |
| `speech.failed`                     | Request id, `transcribe`, `speak` or `preview`, provider, error code, milliseconds.                                                                                         |

The speech routes may log only those keys: a test reads the source and fails if a log line there carries anything outside a short list of identifiers, sizes and timings, or mentions text, audio, an error's own words or a key (`server/speech/boundary.test.ts`). Never logged: audio, recognised or spoken words, keys, a provider's own wording, headers or addresses.

## What Firefly does not do

- It does not keep audio, and it does not record before you press start or after the call ends.
- It does not clone voices, imitate real people or use custom or personal voices. The customer's voice is a prebuilt synthetic voice.
- It does not detect emotion, stress or identity from your voice, and it does not score tone, accent or pace. Coaching reads the words only.
- It does not use analytics, tracking pixels or telemetry, and it contacts no service you have not been told about on the brief.
- It does not claim that the customer's voice shows real emotion. Pace, pitch and, for a few voices, a style are adjusted to suggest the mood. How that sounds has not been judged by a person.

## For people who run Firefly

- Keep keys in the server's environment (`.env` is git-ignored). Keys are never sent to the browser or logged. If a key is ever pasted somewhere public, delete it at the provider and create a new one.
- Decide with your organisation which speech provider fits your data rules before you turn one on, and tell trainees which one is active. The brief and the pre-flight page show it to them.
- Speech to text of a trainee who says something sensitive aloud is processed by the provider you chose. Tell trainees to use only the fictional details in the call brief.
- Azure resource-level settings (logging, retention, private endpoints, regions) are the operator's responsibility and are not inspected or changed by Firefly.
