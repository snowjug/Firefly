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
Look at the server's start-up output. If a required variable is missing or `FIREFLY_PROVIDER` is misspelt, Firefly prints a notice naming the problem (never the values) and runs in demo mode instead. The scenario brief, the pre-flight page and the report all show which mode is running. Fix `.env`, then restart the server: settings are read only at start-up.

**"This call was started with a different AI setting than the server is using now."**
A call keeps the provider it was started with. If you change `FIREFLY_PROVIDER` while a call is open, start a new call.

**"The AI provider rejected the credentials", "could not find the model", or timeouts.**
These come from your provider settings. [ai-providers.md](ai-providers.md#failure-behaviour) lists each message and what it means. Only Gemini has been run against a real service; Azure OpenAI and other OpenAI-compatible services have been tested only against a local fake server, so use the manual smoke test in that document before relying on them.

**With Gemini: "The AI provider's rate limit was reached. Please try again in about N seconds."**
A free-tier Gemini project allows a limited number of requests per minute for each model (15 for `gemini-3.5-flash-lite` when this was tested), and each message you send uses two. Wait the number of seconds shown, then choose **Try again**. Linking a billing account to the Google project raises the limits (see [ai-providers.md](ai-providers.md#gemini-google-ai-studio)), or set `GEMINI_MODEL` to another model.

**With Gemini: "The AI provider is not available right now."**
Google answered with a server error. Larger models sometimes answer HTTP 503 ("high demand"). Try again in a moment, or set `GEMINI_MODEL` to another model (`gemini-3.5-flash-lite` is the default).

**My network needs a proxy to reach the provider.**
Node's built-in `fetch` ignores proxy variables unless you start the server with `NODE_OPTIONS=--use-env-proxy`.

## Speech and the microphone

The pre-flight page of every call says which speech set-up is in use before anything is requested, and a typed call always works. Start with **Start text-only call** if you need to carry on.

**"The microphone is blocked for this site."**
The browser remembered a "block", or you dismissed the prompt. In Edge, select the lock icon at the left of the address bar, open **Permissions for this site**, set **Microphone** to **Allow**, then choose **Try again**. In Chrome, select the icon at the left of the address bar and turn on **Microphone**. Nothing was recorded.

**"No microphone was found" or "The microphone did not start".**
Check that a microphone is connected and switched on, and close any other app that is using it (a meeting, a recorder). Then choose **Try again**.

**"This browser cannot record your voice here."**
A spoken call needs Microsoft Edge or Google Chrome, a microphone, and a secure page (`https://`, or `http://localhost`). Other browsers can still hold a typed call.

**"Nothing was heard" or "no words could be made out".**
The microphone opened but no speech was recognised. Say it again a little closer to the microphone, or type. If you are using the **browser's own speech recognition** (the pre-flight page says "Browser speech recognition"), be aware that in automated Edge and Chrome it returned no words for a clean test voice, so it may not work in your browser either: switch to typing, or ask whoever runs Firefly to configure a speech provider.

**The recognised text is not what I said.**
Speech recognition can mishear words, and the report says so for spoken calls. If a quote in the report is wrong, the transcript is the text that was scored: say it again or type it. With the **scripted demo speech** provider the "recognised" text is a fixed sentence, not your words: that is how the demo works.

**"The speech service is not available right now."**
The server has no working speech provider (none is configured, or its settings are wrong, or the service is down). Nothing was sent. Type your reply, or choose **Try again**. If you run Firefly, look at the start-up output: a notice names any wrong `AZURE_SPEECH_*` variable (never its value). [speech-providers.md](speech-providers.md) lists every setting.

**I can't hear the customer.**
Check the pre-flight page and **Voice settings**: it names the voice that is in use. With the **scripted demo speech** provider the customer's "voice" is a short placeholder sound, not speech, so read the transcript. With browser voices, the voices on the device decide what you hear; a Windows laptop may have no British English voice and will use another English voice. If your browser blocks sound until you interact with the page, press **Play** on the notice.

**Hands-free stopped listening.**
After three empty listening passes in a row, hands-free waits for you. Press **Talk**, or type.

**The microphone indicator is still on.**
While a spoken call is live and not paused, the browser shows that the microphone is in use, even though Firefly only listens while it is your turn. **Pause** or **End call** releases it. If the indicator stays on after the call has ended, close the tab and tell the maintainers.

## During a call

**A message has a Try again notice under it.**
Your message was saved, but the customer could not reply (for example the provider was unavailable or slow). Choose **Try again**. The same message is resent without being duplicated. After a page reload the notice comes back.

**The Send button is disabled.**
The message is empty, over the length limit, or the customer is still replying. At the message limit, end the call to get your report.

**I left the call page.**
The call stays open. Go to **Scenarios**: a banner offers **Resume** for the call in progress, and **Recent calls** lists the others.

**Scenarios says "You have a call in progress" for a call I never started.**
Starting a call creates it, and **Back to brief** on the step before the call leaves that empty call open. Choose **Resume** to carry on with it, or open it, start it and choose **End call**: a call with no message has nothing to report, so Firefly says so and offers **Leave without a report**. An empty call does no harm if you ignore it. Going back to the brief also brings back the settings you chose, except which complications you picked: it shows the scenario's default set (or none, if you had switched them off).

**"We could not find this call."**
The address points at a call that does not exist for this browser. It may have been deleted, or it belongs to a different browser profile (see below). Choose a scenario to start a new one.

**The coaching report did not finish.**
Your transcript is saved. Choose **Retry evaluation** on the report page. If it keeps failing with a live model, check the provider configuration; the same call can be evaluated again at any time.

## Data

**I want to delete a call.**
Use **Delete this call** at the bottom of its report. To remove all data for everyone, stop the server and delete the database file (`data/firefly.db` by default).

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
