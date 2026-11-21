# Voice calls

Voice mode lets you practise a customer call the way it happens for real: you **speak**, and the simulated customer **answers out loud**. It is optional, it is off until you turn it on, and typing always keeps working.

## What it does

- **You speak, Firefly reads text.** Your browser turns your speech into text. Firefly receives only that text and sends it exactly as if you had typed it, so it goes through the same check for personal details.
- **The customer answers aloud.** Replies are spoken with a voice from your browser. A customer keeps the same voice for the whole call, and sounds a little quicker and tenser as their mood rises.
- **Two ways to talk.** _Hands-free_ listens again by itself after the customer has finished. _Push to talk_ listens only when you press the talk button. You can mute the microphone without ending the call.
- **The customer never talks over you.** The microphone is closed while the customer speaks, so it cannot hear their voice and mistake it for yours. There is also a short pause before it opens again.
- **Call sounds.** When **Sound effects** is on, short, quiet tones mark the line connecting, your turn to speak and the call ending. Sound effects is off until you switch it on, under Settings > Preferences or with the button on the call.
- **The transcript is still the record.** Everything said, spoken or typed, appears in the transcript. Coaching is based on those words, not on how your voice sounded.

## Browser support

| What                                    | Works in                                                                       |
| --------------------------------------- | ------------------------------------------------------------------------------ |
| Speaking to the customer (speech input) | Chrome and Edge, on a secure (https) connection or on localhost                |
| Hearing the customer (speech output)    | Most current browsers, using the voices installed in the browser or the system |
| A single "Listen" on one message        | Anywhere speech output works, with or without a voice call, once voice is on   |

Where speech input is missing, Firefly says so in one sentence and you carry on by typing. No audio files are shipped with Firefly: the call sounds are generated in the browser.

## What leaves your device

- **Your voice (audio).** Firefly never records, keeps or uploads audio. Your browser listens to the microphone, and **where it turns speech into text is the browser's decision**. In Chrome and Edge this is normally done by an online speech service run by the browser's maker: your audio is sent to that service and handled under its privacy terms. If your browser can recognise speech on your device and has the speech pack for your language, Firefly asks it to do so, and then the audio stays on your device. Recent versions of Chrome offer this; whether a given browser or language does varies. The first time, the browser may ask to download the speech pack. Firefly does not wait long for it, so until it is ready that first sentence may still go to the online service. Firefly reports which kind of recognition is in use: on your device, your browser's online service, or not known.
- **The customer's voice (text).** The customer's replies are fictional text. A voice that the browser marks as an online voice (many "Natural" or "Online" voices in Edge, for example) sends the text being spoken to the browser maker's speech service. Firefly prefers voices that sound better, which can include online ones. Your audio is not part of that.
- **What Firefly receives.** Only the recognised text. Like typed text, it has obvious personal details replaced before it is saved or sent to any model, and it is stored in the call transcript the way typed messages are. The voice code adds no analytics or tracking.

## Turning it on

Voice is off by default. Turn it on with **Enable voice (Beta)** under **Settings > Preferences**, or with the **Voice (Beta)** link under the message box on a call. Either one first explains what voice means (**Turn on voice (Beta)?**), and nothing changes until you choose **Turn on voice**. The choice is saved on your local profile, so create one first. It also adds a **Listen** button to each customer message. The microphone is never opened until voice is on and you press **Voice call** under the message box, and your browser asks for microphone permission the first time. Hang up (press **Voice call** again, end the call, or leave the page) and the microphone and the customer's voice stop at once.

## Check the transcript

Speech recognition makes mistakes, and mistakes are not yours. A name, a product word or a number can be heard wrongly, and accent, pace, background noise and a poor microphone all affect how well it works. For that reason the text stays visible while you talk. In push-to-talk mode you can read and correct the text before it is sent. In hands-free mode it is sent as soon as you pause, so glance at the transcript as you go. Firefly drops nothing because the browser was unsure of it (only a lone filler such as "um", or a single letter, is ignored), and it never marks you down for how you sound. If recognition keeps misunderstanding you, switch to typing and tell your mentor.

## If something goes wrong

**"Microphone access is blocked."**
Allow the microphone for this site in your browser's address bar or site settings, then choose to try again. On a work computer a policy may block it. If you serve Firefly behind your own proxy or add a `Permissions-Policy` header, keep `microphone=(self)`: `microphone=()` makes Chromium refuse speech recognition outright, with this same message, even when the browser has the permission.

**"No microphone was found."**
Connect or enable a microphone, and close any other app that is using it.

**"The speech service could not be reached."**
Recognition in Chrome and Edge normally needs a network connection. Check it, then try again. On-device recognition, where available, works offline.

**"Nothing was heard."**
After a few silent tries the call waits for you. Check the microphone is the right one and not muted, then press the talk button.

**I cannot hear the customer.**
Check the volume and that the tab is not muted. Some browsers only allow sound after you have clicked something on the page. Use "Listen" on a message to try again.

**The voice sounds odd, or there are very few voices.**
Voices come from your browser and system. Some systems load their voices late, so the first reply of a session can take a moment. Installing more voices in your system settings, or using Edge for its online voices, improves this.

**Another language.**
Voice mode is set up for English. Other languages have not been checked.

## Limits

- **No barge-in.** You cannot interrupt the customer by speaking. Use the stop button, or press the talk button to take the turn.
- **One voice per customer,** chosen from the voices your browser has. It is not a recording of anyone and never claims to be.
- **No recording.** There is no playback of your own voice and no audio is saved anywhere.
- **Words only.** Coaching still looks at what was said, not tone, accent or pace.

## For developers

The code is in `web/src/lib/voice/` and uses only browser APIs: no audio is sent anywhere by the app and no packages were added. `useVoiceCall` is the hook that hears and speaks, `web/src/components/call/useCallVoice.ts` joins it to the conversation, and the controls, the opt-in dialog and the Listen button are in `web/src/components/voice/`. Every piece checks that its browser API exists, so nothing throws where one is missing, and the tests (`voice.test.ts`) run against fake browser APIs.

**The microphone policy.** The server sends `Permissions-Policy: camera=(), microphone=(self), geolocation=(), payment=()`, and `server/http/api.test.ts` checks it. An earlier build sent `microphone=()`. That made Chromium refuse speech recognition at once (`not-allowed`, shown as "Microphone access is blocked") however the browser permission was set, and the unit tests could not see it because they use fake speech APIs. What has been checked since, in Microsoft Edge with a synthetic audio device and the browser's real recognition: with `microphone=()` recognition fails at once, and with `microphone=(self)` it starts and finishes (in the app, a call reaches "Nothing was heard", because the device plays a tone and not speech). It has not been checked with a person speaking, or in other browsers.
