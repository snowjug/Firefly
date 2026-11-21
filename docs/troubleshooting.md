# Troubleshooting

## Installing and starting

**`npm ci` or `npm install` fails to download packages.**
Firefly's lockfile points at the public npm registry (`registry.npmjs.org`). If your network requires a proxy or a mirror, configure npm for it (`npm config set proxy`, `npm config set registry ...`) and try again. `npm run check:lockfile` confirms the lockfile has no private feed URLs.

**`SyntaxError`, "unknown file extension .ts", or `node:sqlite` is missing.**
Firefly runs TypeScript directly and uses Node's built-in SQLite, so it needs **Node.js 24 or newer**. Check with `node --version`.

**"Port 8787 is already in use."**
Another process owns the port. Set `FIREFLY_PORT` (in `.env` or the environment) to a free port and start again.

**"Port 5173 is already in use." when running `npm run dev`.**
The web dev server uses port 5173 and does not pick another one. Set `FIREFLY_WEB_PORT` to a free port and start again. If you changed `FIREFLY_PORT`, the dev server follows it automatically.

**The server starts but the browser shows a "not built" message, or a blank page.**
The server serves the built web app from `dist/web`. Run `npm run build` first, or use `npm run dev` for development. If you built into another folder with `FIREFLY_OUT_DIR`, start the server with `FIREFLY_WEB_DIR` set to that folder.

**An `ExperimentalWarning` is printed.**
`node:sqlite` and native TypeScript support print warnings on some Node versions. The `npm start` and `npm run dev` scripts hide them. If you run `node server/index.ts` yourself, add `--disable-warning=ExperimentalWarning`.

**"The database was created by a newer version of Firefly."**
You are running an older build against a newer database file. Update Firefly, or point `FIREFLY_DB_PATH` at a different file.

**PowerShell says running `npm.ps1` is disabled on this system.**
Windows is blocking PowerShell scripts. Run npm through the command shell instead (`cmd /c "npm run dev"`), or change the execution policy for your user if your organisation allows it.

## AI provider (the customer and the coaching)

**The app says "Demo mode" but I configured a model.**
Look at the server's start-up output. If a required variable is missing or `FIREFLY_PROVIDER` is misspelt, Firefly prints a notice naming the problem (never the values) and runs in demo mode instead. The header, the pre-flight page, the call bar and the report show which mode is running, and the header carries the notice. Fix `.env`, then restart the server: settings are read only at start-up.

**"This call was started with a different AI setting than the server is using now."**
A call keeps the provider it was started with. If you change `FIREFLY_PROVIDER` while a call is open, start a new call.

**"The AI provider rejected the credentials", "could not find the model", or timeouts.**
These come from your provider settings. [ai-providers.md](ai-providers.md#failure-behaviour) lists each message and what it means. Gemini had one limited smoke check; Azure OpenAI and the OpenAI-compatible endpoint have not been run live, and all three have otherwise been tested only against a local fake server. Use the manual smoke test in that document before relying on one ([status of each provider](ai-providers.md#status-of-each-provider)).

**With Gemini: "The AI provider's rate limit was reached. Please try again in about N seconds."**
A free-tier Gemini project allows a limited number of requests per minute for each model, and each message you send uses two. Wait the number of seconds shown, then choose **Retry**. Google's rate limits depend on the project's usage tier (see [ai-providers.md](ai-providers.md#gemini-google-ai-studio)), or set `GEMINI_MODEL` to another model.

**With Gemini: "The AI provider is not available right now."**
Google answered with a server error, for example HTTP 503. Try again in a moment, or set `GEMINI_MODEL` to another model (`gemini-3.5-flash-lite` is the default).

**My network needs a proxy to reach the provider.**
Node's built-in `fetch` ignores proxy variables unless you start the server with `NODE_OPTIONS=--use-env-proxy`.

## Speech and the microphone

The pre-flight page of every call says which speech set-up is in use before anything is requested, and a typed call always works. Choose **Start text call** if you need to carry on.

**"The microphone is blocked, so Firefly cannot hear you."**
The browser remembered a "block", or you dismissed the prompt. In Edge, select the lock icon at the left of the address bar, open **Permissions for this site**, set **Microphone** to **Allow**, then choose **Retry**. In Chrome, select the icon at the left of the address bar and turn on **Microphone**, then choose **Retry**. Nothing was recorded.

**"No microphone was found." or "The microphone is in use by something else or did not start."**
Check that a microphone is connected and switched on, and close any other app that is using it (a meeting, a recorder). Then choose **Retry**, or **Use text**.

**"This browser cannot record from a microphone here."**
A spoken call needs a browser that can record, a microphone, and a secure page (`https://`, or `http://localhost`). Firefly's tests run in Chromium, so use a current Edge or Chrome. Other browsers can still hold a typed call.

**"No speech was detected." or "Firefly could not make out any words."**
The microphone opened but nothing recognisable was heard, or the recogniser returned only filler sounds. Say it again a little closer to the microphone, or type. If you are using the **browser's own speech recognition** (the pre-flight page says "Browser speech recognition"), its quality and availability are the browser maker's, and Firefly has not verified it with real speech. If it keeps returning nothing, switch to typing, or ask whoever runs Firefly to configure a speech provider.

**The recognised text is not what I said.**
Speech recognition can mishear words, and the report says so for spoken calls. If a quote in the report is wrong, the transcript is the text that was scored: say it again or type it. With the **scripted demo speech** provider the "recognised" text is a fixed sentence, not your words: that is how the demo works.

**"Spoken calls are not available on this server right now." or "Firefly could not reach the speech service."**
The server has no working speech provider (none is configured, or its settings are wrong, or the service is down), or your connection dropped. Nothing was sent. Type your reply, or choose **Retry**. If you run Firefly, look at the start-up output: a notice names any wrong `AZURE_SPEECH_*` variable (never its value). [speech-providers.md](speech-providers.md) lists every setting.

**I can't hear the customer.**
Check the pre-flight page and **Voice settings** on the call: they name the voice that is in use. With the **scripted demo speech** provider the customer's "voice" is a short placeholder sound, not speech, so read the transcript. With browser voices, the voices on the device decide what you hear; a Windows laptop may have no British English voice and will use another English voice. If your browser blocks sound until you interact with the page, choose **Replay**. If the customer's voice cannot be made or played, choose **Continue without audio** and read the transcript: the customer's words are there before their voice plays.

**The four voices sound the same.**
A browser with one English voice cannot make four voices sound different, and some speech services have fewer than four voices in a language. The brief says so ("Some of these voices share one synthetic voice and differ only in pace.", or the browser's equivalent).

**Hands-free stopped listening.**
After an empty pass the microphone reopens by itself, up to three times in a row. After a fourth empty pass hands-free waits for you. Press **Talk**, or type.

**I pressed Talk and nothing happened while the customer was speaking.**
**Talk** stays disabled while the customer's voice is being prepared or played: Firefly does not support talking over the customer. Press **Stop customer audio**, then talk, or wait for the voice to end.

**The microphone indicator is still on.**
While a spoken call is live and not paused, the browser shows that the microphone is in use, even though Firefly only listens while it is your turn. **Pause**, or **End and review** in the "End the call?" dialog, releases it. **End call** alone only opens that dialog. If the indicator stays on after the call has ended, close the tab and tell the maintainers.

**The call paused when I switched to another tab or window.**
A spoken call pauses by itself when the browser reports the page as hidden, so that the microphone is never open out of sight. The microphone is released and the customer's voice stops. Coming back does not open the microphone again: press **Resume**. A text call is not paused.

## During a call

**A card says "The customer could not reply." or "The customer is taking too long."**
Your message was saved or is kept. Choose **Retry**: it sends the same message once, never twice. After a page reload the card comes back. If another notice covers it (for example, a failed attempt to end the call), the card returns when that notice is put away: a message that did not send always keeps its Retry.

**The Send button is disabled.**
The message is empty, over the length limit, or the customer is still replying. At the message limit ("This call reached its message limit."), end the call to get your report.

**I left the call page.**
The call stays open on the server and keeps its transcript. Open its address again (browser Back, or the address bar's history): the pre-flight page says **Resume call** and offers **Resume voice call** and **Resume with text**. Firefly has no screen that lists open calls.

**"We could not find this call."**
The address points at a call that does not exist for this browser. It may have been deleted, or it belongs to a different browser profile (see below). Choose a scenario to start a new one.

**"There is nothing to review yet."**
You ended a call in which no message was sent, so there is nothing to score. Choose **Leave without a report**, which deletes the empty call, or send a message first.

**The coaching report did not finish.**
Your transcript is saved. Choose **Retry evaluation** on the report page. If it keeps failing with a live model, check the provider configuration; the same call can be evaluated again at any time.

## Data

**I want to delete a call.**
Use **Delete this call** in the actions on its report page, then confirm with **Delete call**. To remove all data for everyone, stop the server and delete the database file (`data/firefly.db` by default).

**My calls disappeared.**
Calls are tied to an anonymous cookie in your browser. A different browser, a private window, cleared cookies or a different server address starts a new, empty profile. Nothing is shared between profiles.

## Development and tests

**Browser tests cannot launch a browser.**
Install Playwright's Chromium with `npx playwright install chromium`, or reuse a browser you already have: set `PW_CHANNEL=msedge` (or `chrome`) before `npm run test:e2e`.

**Browser tests fail at the first request.**
`npm run test:e2e` builds the web app and starts its own server on port 4321 with the demo customer, the scripted demo speech provider and the test hooks enabled. Free the port, or set `E2E_PORT` (when it is set, a server that is already listening is never reused). To serve another build set `E2E_WEB_DIR`; to keep results somewhere else set `E2E_OUTPUT_DIR`. To run against a server you started yourself, set `E2E_BASE_URL`; that server must have been started with `FIREFLY_PROVIDER=mock`, `FIREFLY_SPEECH_PROVIDER=mock` and `FIREFLY_TEST_HOOKS=1`, and the suite refuses to run against one that was not.

**A browser test says the microphone or the audio did nothing.**
The tests use a fake microphone: a speech-like WAV that the suite generates under `test-results/fake-microphone/` (never committed) and plays in a loop through Chromium's `--use-file-for-fake-audio-capture`. It needs Chromium or Edge; Firefox and WebKit have no such option. The mock speech provider ignores the audio, so a spoken turn always comes back as one of its eight scripted sentences. Real browser speech recognition is not tested.

**`npm run check:budgets` says `dist/web/index.html` was not found, or reports OVER.**
The check reads the production build, so run `npm run build` first. A row marked OVER means a bundle is larger than its limit in `scripts/budgets.json`; find what grew before raising a limit. A failure about source maps means a map reached the build.

**Windows PowerShell shows red text for `npm` commands.**
npm writes its "notice" lines to the error stream, and PowerShell shows them in red. Check the exit code (`$LASTEXITCODE`), not the colour.
