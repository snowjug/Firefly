# Contributing to Firefly

Firefly is built by a team of apprentices and mentors. Small, focused changes that are easy to review are the best kind.

## Set up

```
git clone https://github.com/snowjug/Firefly.git
cd Firefly
npm ci
npm run dev
```

You need Node.js 24 or newer. The README explains the commands in full. Demo mode needs no credentials, and `FIREFLY_SPEECH_PROVIDER=mock` gives you the whole spoken-call flow without any speech service (the recognised text is scripted: see [docs/demo-guide.md](docs/demo-guide.md)).

## Make a change

1. **Create a branch** from `main`. Name it for the change, for example `feature/short-description` or `fix/short-description`.
2. **Keep the change focused.** One idea per pull request. Do not mix a refactor with a behaviour change.
3. **Test it locally.** Run the checks below, and try the change in the browser at phone width and desktop width, with the keyboard only, with reduced motion, and (if it touches the call) with the microphone muted and denied.
4. **Open a pull request.** Say what changed and why, how you tested it, and include a screenshot for visible changes. CI runs the same checks as `npm run check`, plus the browser tests.

Write commit messages in the style already used here: `feat: ...`, `fix: ...`, `docs: ...`, `chore: ...`, `test: ...`, `design: ...`, `a11y: ...`, `perf: ...`.

## Checks

```
npm run check        # format, lint, types, scenarios, tests, build, bundle budgets, secret scan, lockfile
npm run test:e2e     # browser tests (builds first; see docs/troubleshooting.md for browser setup)
```

Run a part on its own when you are iterating: `npm run lint`, `npm run typecheck`, `npm test`, `npm run validate:scenarios`, and `npm run check:budgets` after a build. `npm run format` fixes formatting.

## Conventions

- **TypeScript, strictly.** No `any`. The server runs TypeScript directly, so use only erasable syntax: no `enum`, no constructor parameter properties, `import type` for types, and `.ts` or `.tsx` in import paths.
- **Server and web share only `shared/`.** The web app imports shared code through `#shared/...` and never from `server/`. Modules in `shared/domain` that hold zod schemas (`scenario`, `report`, `classification`, `api`) may be imported by the web app with `import type` only, so that no schema library reaches the browser bundle.
- **Use the design system.** Pages and features import primitives from `web/src/design`; they do not write their own button, field or dialog. Use the tokens in `web/src/design/tokens.css` and do not hard-code colours. Every class has one owner (`ff-*` is the design system, a feature has its own short prefix), and a test enforces it. See [docs/design-system.md](docs/design-system.md).
- **Colour never carries meaning alone.** Customer mood, scores, status and found or missed facts always have a word, and mood has its own icon shape.
- **Accessibility is a release requirement.** Keyboard operation, visible focus, accessible names, live regions that announce whole sentences once, targets of at least 24 px, text alternatives for charts, reduced motion, forced colours, reflow at 320 px. New screens need a stop in the accessibility specs. See [docs/accessibility.md](docs/accessibility.md).
- **Voice stays honest and optional.** Never turn the microphone on from page load or from anything but an explicit click, never record or send audio from Firefly's own code beyond the one utterance the call engine sends, never write audio to disk or logs, and never present browser or demo speech as more than it is. The call screen talks to the engine only through `useCall` (`web/src/features/call/contract.ts`); only `web/src/features/voice` touches the microphone, audio elements and speech APIs. See [docs/voice-architecture.md](docs/voice-architecture.md) and [docs/privacy-and-audio.md](docs/privacy-and-audio.md).
- **Say what is verified.** A claim in the interface or the docs ("Azure AI Speech", "works in Edge", "accessible") needs evidence in this repository. If something was only tested against a fake, say so.
- **Evidence over opinion in feedback.** A score or a piece of coaching must be backed by a quote the person can read, and nothing may rank people or reward speed, volume or time spent.
- **Bundle budgets are a decision.** `npm run check:budgets` fails when the first load or a chunk grows past `scripts/budgets.json`. Raising a limit needs a reason in the commit message. Do not add a runtime dependency without one either.
- **Load pieces on demand.** Pages are lazy route chunks. Keep the call engine, the report and other large features out of the entry chunk.
- **Text from users or models is plain text.** Never use `innerHTML` or `dangerouslySetInnerHTML`.
- **Tests.** Add focused tests for behaviour you add or fix. Do not copy the same cases into several files. A test must fail without your change.
- **Docs.** If you change behaviour, update the documentation that describes it in the same pull request. After a visible design change, refresh the README pictures with `scripts/readme-screenshots.mjs` (the top of the file explains how) and look at every picture.

## Scenarios

A new scenario is a TypeScript file plus an entry in the registry. Read [docs/scenario-authoring.md](docs/scenario-authoring.md) first. The library tests tell you when a hidden fact cannot be found or leaks.

## Speech providers

Provider code lives in `server/speech/` behind one interface (`types.ts`). A new provider must read its secrets from the environment only, never log audio, text or keys, map every failure to a fixed message, and come with tests against a fake server rather than the real service. See [docs/speech-providers.md](docs/speech-providers.md).

## What must never be committed

- **Real customer data.** No real names, case descriptions, logs, screenshots, identifiers or contact details, in code, tests, docs or screenshots. Every scenario is fictional.
- **Audio.** No recordings of anyone's voice, and no generated speech files. Tests that need audio generate it at run time.
- **Secrets.** No API keys, tokens or connection strings (including a Gemini, Azure OpenAI or Azure Speech key). Use `.env` (git-ignored) and keep `.env.example` to placeholders. `npm run check:secrets` scans for common patterns, but it is a safety net, not a substitute for care. If a key is ever pasted somewhere public, delete it at the provider and create a new one.
- **Confidential material.** Internal Microsoft documents, roadmaps and screenshots do not belong in this public repository.
- **Lockfile entries for private registries.** `npm run check:lockfile` guards this.

## Reporting a problem

Open an issue with what you did, what you expected and what happened. If a report scored something unfairly, include the scenario, the difficulty and the quote, using fictional text only.
