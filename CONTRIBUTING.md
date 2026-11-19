# Contributing to Firefly

Firefly is built by a team of apprentices and mentors. Small, focused changes that are easy to review are the best kind.

## Set up

```
git clone https://github.com/snowjug/Firefly.git
cd Firefly
npm ci
npm run dev
```

You need Node.js 24 or newer. The README explains the commands in full. Demo mode needs no credentials.

## Make a change

1. **Create a branch** from `main`. Name it for the change, for example `feature/short-description` or `fix/short-description`.
2. **Keep the change focused.** One idea per pull request. Do not mix a refactor with a behaviour change.
3. **Test it locally.** Run the checks below, and try the change in the browser, in both themes and at phone width, with the keyboard only.
4. **Open a pull request.** Say what changed and why, how you tested it, and include a screenshot for visible changes. CI runs the same checks as `npm run check`.

Write commit messages in the style already used here: `feat: ...`, `fix: ...`, `docs: ...`, `chore: ...`, `test: ...`.

## Checks

```
npm run check        # format, lint, types, scenarios, tests, build, secret scan, lockfile
npm run test:e2e     # browser tests (builds first; see docs/troubleshooting.md for browser setup)
```

Run a part on its own when you are iterating: `npm run lint`, `npm run typecheck`, `npm test`, `npm run validate:scenarios`. `npm run format` fixes formatting.

## Conventions

- **TypeScript, strictly.** No `any`. The server runs TypeScript directly, so use only erasable syntax: no `enum`, no constructor parameter properties, `import type` for types, and `.ts` or `.tsx` in import paths.
- **Server and web share only `shared/`.** The web app imports shared code through `#shared/...` and never from `server/`.
- **Plain CSS with design tokens.** Use the variables in `web/src/styles/tokens.css` and the patterns in [docs/design-system.md](docs/design-system.md). Do not hard-code colours. Both themes must work, and amber is kept for rewards.
- **Rewards stay honest.** Anything that celebrates, scores or rewards must be backed by evidence the person can also read in words, and nothing may rank, compare or reward speed, volume or time spent. Rewards are points with a stated reason, worked out from saved calls by tested pure functions, and a missed day or a retry never costs anything. See [docs/rewards.md](docs/rewards.md) and [docs/experience-design.md](docs/experience-design.md).
- **Voice stays opt-in and honest.** Never record or send audio from Firefly's own code, never turn voice on by default, and say what the browser may do with speech before it is switched on. See [docs/voice.md](docs/voice.md).
- **Load optional pieces on demand, without `Suspense`.** A decorative or below-the-fold piece of a page (a canvas, a card that waits for data) loads through `useOnDemand` in `web/src/lib/onDemand.ts`, not `React.lazy` inside the page's first render, which delays that page's first paint. A failed load is reported, never thrown.
- **Accessibility is a release requirement.** Keyboard operation, visible focus, labels, text alternatives for charts, no colour-only meaning, reduced motion. New screens need a Playwright accessibility check.
- **Text from users or models is plain text.** Never use `innerHTML` or `dangerouslySetInnerHTML`.
- **Tests.** Add focused tests for behaviour you add or fix. Do not copy the same cases into several files.
- **Docs.** If you change behaviour, update the documentation that describes it in the same pull request. After a visible design change, refresh the README pictures with `scripts/readme-screenshots.mjs` (the README explains how) and look at what changed.

## Scenarios

A new scenario is a TypeScript file plus an entry in the registry. Read [docs/scenario-authoring.md](docs/scenario-authoring.md) first. The library tests tell you when a hidden fact cannot be found or leaks.

## What must never be committed

- **Real customer data.** No real names, case descriptions, logs, screenshots, identifiers or contact details, in code, tests, docs or screenshots. Every scenario is fictional.
- **Secrets.** No API keys, tokens or connection strings (including a Gemini or Azure OpenAI key). Use `.env` (git-ignored) and keep `.env.example` to placeholders. `npm run check:secrets` scans for common patterns, but it is a safety net, not a substitute for care. If a key is ever pasted somewhere public, delete it at the provider and create a new one.
- **Lockfile entries for private registries.** `npm run check:lockfile` guards this.

## Reporting a problem

Open an issue with what you did, what you expected and what happened. If a report scored something unfairly, include the scenario, the difficulty and the quote, using fictional text only.
