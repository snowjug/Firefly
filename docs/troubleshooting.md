# Troubleshooting

## Installing and starting

**`npm ci` or `npm install` fails to download packages.**
Firefly's lockfile points at the public npm registry (`registry.npmjs.org`). If your network requires a proxy or a mirror, configure npm for it (`npm config set proxy`, `npm config set registry ...`) and try again. `npm run check:lockfile` confirms the lockfile has no private feed URLs.

**`SyntaxError`, "unknown file extension .ts", or `node:sqlite` is missing.**
Firefly runs TypeScript directly and uses Node's built-in SQLite, so it needs **Node.js 24 or newer**. Check with `node --version`.

**"Port 8787 is already in use."**
Another process owns the port. Set `FIREFLY_PORT` (in `.env` or the environment) to a free port and start again.

**"Port 5173 is already in use." when running `npm run dev`.**
The web dev server uses port 5173 and does not pick another one. Set `FIREFLY_WEB_PORT` to a free port and start again.

**The server starts but the browser shows a "not built" message, or a blank page.**
The server serves the built web app from `dist/web`. Run `npm run build` first, or use `npm run dev` for development. If you built into another folder with `FIREFLY_OUT_DIR`, start the server with `FIREFLY_WEB_DIR` set to that folder.

**An `ExperimentalWarning` is printed.**
`node:sqlite` and native TypeScript support print warnings on some Node versions. The `npm start` and `npm run dev` scripts hide them. If you run `node server/index.ts` yourself, add `--disable-warning=ExperimentalWarning`.

**"The database was created by a newer version of Firefly."**
You are running an older build against a newer database file. Update Firefly, or point `FIREFLY_DB_PATH` at a different file.

## AI provider

**The app says "Demo mode" but I configured a model.**
Look at the server's startup output. If a required variable is missing or `FIREFLY_PROVIDER` is misspelt, Firefly prints a notice naming the problem (never the values) and runs in demo mode instead. Settings (Data & privacy) and the Trainer page (Provider status) show the same notice. Fix `.env`, then restart the server. Settings are read only at startup.

**"This call was started with a different AI setting than the server is using now."**
A call keeps the provider it was started with. If you change `FIREFLY_PROVIDER` while a call is open, start a new call.

**"The AI provider rejected the credentials", "could not find the model", or timeouts.**
These come from your provider settings. [ai-providers.md](ai-providers.md#failure-behaviour) lists each message and what it means. Only Gemini has been run against a real service; Azure OpenAI and other OpenAI-compatible services have been tested only against a local fake server, so use the manual smoke test in that document before relying on them.

**With Gemini: "The AI provider's rate limit was reached. Please try again in about N seconds."**
A free-tier Gemini project allows a limited number of requests per minute for each model (15 for `gemini-3.5-flash-lite` when this was tested), and each message you send uses two. Wait the number of seconds shown, then choose Retry or "Try again". Linking a billing account to the Google project raises the limits (see [ai-providers.md](ai-providers.md#gemini-google-ai-studio)), or set `GEMINI_MODEL` to another model.

**With Gemini: "The AI provider is not available right now."**
Google answered with a server error. Larger models sometimes answer HTTP 503 ("high demand"). Try again in a moment, or set `GEMINI_MODEL` to another model (`gemini-3.5-flash-lite` is the default).

**My network needs a proxy to reach the provider.**
Node's built-in `fetch` ignores proxy variables unless you start the server with `NODE_OPTIONS=--use-env-proxy`.

## During a call

**"Saved." with a Retry button under my message.**
Your message was saved, but the customer could not reply (for example the provider was unavailable). Choose Retry. The same message is resent without being duplicated. After a page reload the Retry button comes back.

**The Send button is disabled.**
The message is empty, over the length limit, or the customer is still replying. You can keep typing. At the message limit, end the call to get your report.

**I left the call page.**
The call stays open. Resume it with **Return to your call** on Home, or **Resume call** in History.

**The coaching report did not finish.**
Your transcript is saved. Choose **Try again** on the wrap-up screen, **Retry evaluation** on the report page, or **Retry report** on the call's row in History. If it keeps failing with a live model, check the provider configuration; the same call can be evaluated again at any time.

## Display and motion

**The animated background is still, or plainer than expected.**
The field stops moving when reduced motion is on (in your system, or under **Reduce motion** in Settings > Preferences), when ambient motion is paused (the **Pause ambient motion** button at the top right, or the **Ambient motion** switch in Settings) and while the tab is in the background. It is not loaded at all on the low performance tier. Firefly starts from what the browser reports about the device (data saver, few cores, little memory, a touch screen) and steps down if frames run slowly; it never steps back up during a visit. Add `?perf=high` to the address to pin the full effects, or `?perf=low` to see the plainest.

**Pages change without an animation.**
Route changes use the View Transitions API. Browsers without it show the same pages without the animation, and reduced motion removes it. The first click or key press also skips a transition that is still running.

## Data

**I want to clear everything.**
The Trainer tab in the Studio can remove sample sessions, delete your practice sessions, or reset everything for your browser profile. To remove all data for everyone, stop the server and delete the database file (`data/firefly.db` by default).

**My history disappeared.**
History is tied to an anonymous cookie in your browser. A different browser, a private window, cleared cookies or a different server address starts a new, empty profile. Nothing is shared between profiles. Your name and display choices (theme, motion, sound) are kept in the browser's local storage, so clearing site data resets those too.

## Development and tests

**Browser tests cannot launch a browser.**
Install Playwright's Chromium with `npx playwright install chromium`, or reuse a browser you already have: set `PW_CHANNEL=msedge` (or `chrome`) before `npm run test:e2e`.

**Browser tests fail at the first request.**
`npm run test:e2e` builds the web app and starts its own server on port 4321 with test hooks enabled. Free the port, or set `E2E_PORT`. To run against a server you started yourself, set `E2E_BASE_URL` (the server must have been started with `FIREFLY_TEST_HOOKS=1`).

**`npm run check:budgets` says `dist/web/index.html` was not found, or reports OVER.**
The check reads the production build, so run `npm run build` first. A row marked OVER means a bundle is larger than its limit in `scripts/budgets.json`; find what grew before raising a limit. A failure about source maps means a map reached the build.

**Windows PowerShell shows red text for `npm` commands.**
npm writes its "notice" lines to the error stream, and PowerShell shows them in red. Check the exit code (`$LASTEXITCODE`), not the colour.
