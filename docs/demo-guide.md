# Demo guide

A runbook for showing Firefly to a team, a mentor or a panel in about 20 minutes, with what to say and, as importantly, what not to claim. Everything here describes what the repository does today. If you change the set-up, change the script.

## Before you start (10 minutes, the day before)

1. **Install and check.** Node.js 24 or newer, then `npm ci` and `npm run check`. Fix anything red first.
2. **Pick a set-up.** The same demo works in all of these. Choose one, and say which one you are using.

   | Set-up                         | How to start it                                                         | What the audience sees                                                                                                                                      |
   | ------------------------------ | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
   | **Demo mode, typed**           | `npm run dev` (or `npm run build` then `npm start`)                     | The whole product with Firefly's rules engine as the customer. No credentials, no network. Safest.                                                          |
   | **Demo mode, scripted speech** | `FIREFLY_SPEECH_PROVIDER=mock`, then start as above                     | A full spoken-call flow with a real microphone. The recognised text is **scripted sentences, not your words**, and the customer's "voice" is a soft sound.  |
   | **Browser speech**             | Leave `FIREFLY_SPEECH_PROVIDER` unset; use Edge or Chrome               | The browser's own recognition and voices. Test it on the demo machine first: in automated Edge and Chrome it returned no words, so it may not work for you. |
   | **Live model**                 | Put a key in `.env`: `FIREFLY_PROVIDER=gemini` and `GEMINI_API_KEY=...` | A language model plays the customer and drafts the coaching, labelled with the provider. Replies take a few seconds. Use fictional content only.            |
   | **Live speech**                | `FIREFLY_SPEECH_PROVIDER=azure-speech` with a key and region            | Not verified against the real service. Do not make this the demo unless you have tried it on the day and have a fallback.                                   |

3. **Rehearse the scenario.** The script below uses _Team cannot open the shared project workspace_ (Standard, customer starts frustrated) and, optionally, _Locked out after a password reset_ (Starter). Play each once so you know what the customer says.
4. **Check the room.** A quiet room and a headset make voice work better. Open the app at `http://localhost:5173` (dev) or `http://127.0.0.1:8787` (production-style). Allow the microphone for that address in advance if the browser has remembered a "block". Have the call brief open so you can switch to a typed call at once if you need to.
5. **Close what is not needed.** Other tabs, notifications, anything that uses the microphone.

## The 20-minute script

| Minutes  | Show                                                                                                                                                                                                                                                                | Say                                                                                                                                                                                                                                                                                 |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0 to 2   | The landing page: the hero, "How it works", the report illustration.                                                                                                                                                                                                | "Technical knowledge is not enough. New engineers also have to scope an unclear problem and calm a frustrated customer, and learning that on real cases costs real customers. Firefly is a safe place to repeat it. Every customer here is fictional."                              |
| 2 to 4   | **Start a simulation.** Scenarios: search, filters, choose the scenario. Open the configuration.                                                                                                                                                                    | "Thirteen scenarios across seven kinds of issue. I can change difficulty, business impact, the customer's mood and style, the call stage, curveballs and hints. Starter shows how many facts you have found; Standard and Challenge show nothing."                                  |
| 4 to 6   | **Continue to call brief.** Point at the privacy panel.                                                                                                                                                                                                             | "This is everything the trainee is allowed to know. The customer holds back facts until I ask the right question, and they are never shown here. This panel says what the speech set-up will really do before anything is recorded."                                                |
| 6 to 8   | **Start voice call**, then the pre-flight page. Read the rows aloud. **Allow microphone and start.**                                                                                                                                                                | "Nothing has been requested yet. Firefly asks for the microphone only now. This row says where my speech goes. _(In demo speech:)_ this is a scripted demo, so what it 'hears' is not what I say, and I can always type."                                                           |
| 8 to 14  | The call. Ask an open question. Show the status line (listening, hearing you, thinking, speaking). Then type a deliberately dismissive reply ("Calm down, it is probably something you did"). Then recover: apologise, ask about the cause, own it and give a time. | "The customer's mood is one of five bands with a direction. It moves because of what I say: that dismissive line made it rise. Guided practice shows a count of facts found, never the facts. Note I can interrupt the customer, mute, pause or type at any time."                  |
| 14 to 15 | **End call.** Read the dialog, **End and review**.                                                                                                                                                                                                                  | "Ending stops the microphone and any audio, saves the transcript and builds the report."                                                                                                                                                                                            |
| 15 to 19 | The report: summary and honest labels; the six scores; the temperature chart; open one skill's details and follow a quote to the transcript; the discovery review; the next practice target.                                                                        | "Each score has a quote from my own call, why it was given and how firm it is. The customer's mood journey links to the turns that moved it. The discovery review shows which facts I found and a better question for each I missed. This is practice coaching, not an assessment." |
| 19 to 20 | Responsible AI page; questions.                                                                                                                                                                                                                                     | "It is labelled demo mode when it is the rules engine, it says what is and is not verified, and audio is never stored."                                                                                                                                                             |

### Good lines to ask and say

These are plain phrases the demo-mode engine recognises. They are not magic: a live model understands far more.

- **Open and empathise:** "Hello, this is Sam from support. I'm sorry you're stuck, I can hear how much this matters."
- **Scope:** "Can you tell me exactly what you see when someone tries to open the workspace?" "When did it start, and has anything changed recently?" "Who else is affected, and does anything still work?"
- **Dismissive (to show mood rising):** "That's not my problem, you should have told us earlier. Calm down."
- **Recover and own it:** "I'm sorry, that came out wrongly. I'll take ownership of this and call you back by three o'clock with an update. Is there anything else I can help with?"

## If something goes wrong

| What happens                                        | What to do                                                                                                                                                            |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The browser blocks the microphone                   | The call page explains how to allow it for your browser. Choose **Try again**, or **Start a text-only call**: it works the same and is a fair way to show the report. |
| "Nothing was heard" or "no words could be made out" | Say it again, or type. In browser-speech mode this may repeat: say honestly that real recognition is the least reliable path and switch to typing.                    |
| The customer is slow to reply (live model)          | Wait: replies take a few seconds. After 45 seconds the call offers **Try again**; your message is kept and will not be sent twice.                                    |
| The report says "Building your coaching report"     | Wait a few seconds. If it fails, **Retry evaluation** keeps the transcript.                                                                                           |
| The customer repeats themselves (demo mode)         | Expected in long calls with the rules engine. Say so, and move on to the report.                                                                                      |
| You hit an error page                               | Every error says what happened, what was kept and what to do. Use **Back to scenarios** and start again.                                                              |

## What not to claim

- Do not say speech recognition is accurate, enterprise-grade or tested with Azure. Azure AI Speech has never been run against the real service in this project; browser recognition returned no words in automated Edge and Chrome; the scripted demo speech understands nothing.
- Do not say the customer's voice shows real emotion. Pace and pitch are adjusted, and a style for a few voices; nobody has measured the result.
- Do not say the scores are accurate, fair or comparable between people. Nobody has measured how closely they agree with mentors, and they are practice signals, not an assessment.
- Do not call the rules engine "AI". In demo mode there is no language model, and the app says so.
- Do not say it is deployed, secure for real data or ready for production. There is no hosting configuration and no sign-in; it is a prototype for a trusted machine.
- Do not enter real customer information, ever.

## After the demo

Stop the servers (Ctrl+C in the terminal). Calls from the demo are in `data/firefly.db` (git-ignored): delete the file to remove them, or delete a single call from the bottom of its report. If you used a live model, rotate the key if it was ever shown on screen or pasted anywhere.
