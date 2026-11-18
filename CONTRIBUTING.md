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

1. **Create a branch** from `main`, for example `feature/short-description` or `fix/short-description`.
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
- **Plain CSS with design tokens.** Use the variables in `web/src/styles/tokens.css` and the patterns in [docs/design-system.md](docs/design-system.md). Do not hard-code colours.
- **Accessibility is a release requirement.** Keyboard operation, visible focus, labels, text alternatives for charts, no colour-only meaning, reduced motion. New screens need a Playwright accessibility check.
- **Text from users or models is plain text.** Never use `innerHTML` or `dangerouslySetInnerHTML`.
- **Tests.** Add focused tests for behaviour you add or fix. Do not copy the same cases into several files.
- **Docs.** If you change behaviour, update the documentation that describes it in the same pull request.

## Scenarios

A new scenario is a TypeScript file plus an entry in the registry. Read [docs/scenario-authoring.md](docs/scenario-authoring.md) first. The library tests tell you when a hidden fact cannot be found or leaks.

## What must never be committed

- **Real customer data.** No real names, case descriptions, logs, screenshots, identifiers or contact details, in code, tests, docs or screenshots. Every scenario is fictional.
- **Secrets.** No API keys, tokens or connection strings. Use `.env` (git-ignored) and keep `.env.example` to placeholders. `npm run check:secrets` scans for common patterns, but it is a safety net, not a substitute for care.
- **Lockfile entries for private registries.** `npm run check:lockfile` guards this.

## Reporting a problem

Open an issue with what you did, what you expected and what happened. If a report scored something unfairly, include the scenario, the difficulty and the quote, using fictional text only.
