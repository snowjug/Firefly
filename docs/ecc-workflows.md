# ECC workflows

Firefly's rebuild into a voice-first Microsoft support call simulator followed a set of reusable agent skills from [ECC](https://github.com/affaan-m/ECC). This page records which skills were chosen, how they were brought in, what was not installed, and where each one changed the work. It is a provenance record, not a product feature: nothing here runs in the app.

## Source

| Item    | Value                                                                        |
| ------- | ---------------------------------------------------------------------------- |
| Repo    | https://github.com/affaan-m/ECC                                              |
| Commit  | `4adeee6732a12d1540f49a4d50a38ce8c97f9a53` (ECC `VERSION` 2.2.3)             |
| Licence | MIT. The licence text is kept at `.github/ecc/LICENSE`.                      |
| Catalog | 328 skills listed in the ECC checkout at that commit.                        |
| Lock    | `.github/ecc/skills.lock.json` holds the commit and a SHA-256 for each file. |

## How the skills were chosen

1. ECC's README, `AGENTS.md` and install scripts were read to learn how skills are installed and where GitHub Copilot CLI looks for them (`.github/skills/` is one of its project locations).
2. All 328 skill names were listed and 57 plausible candidates had their `SKILL.md` downloaded and examined.
3. 29 were selected because the work in this repository materially needs them. The other 28 were considered and left out (below). The whole catalogue was not installed.

### Selected (29)

| Area                          | Skills                                                                            |
| ----------------------------- | --------------------------------------------------------------------------------- |
| Onboarding and planning       | `codebase-onboarding`, `blueprint`, `change-impact`, `configure-ecc`, `ecc-guide` |
| Architecture                  | `hexagonal-architecture`                                                          |
| Frontend direction and system | `frontend-design-direction`, `design-system`, `make-interfaces-feel-better`       |
| Frontend code                 | `frontend-patterns`, `react-patterns`, `react-performance`, `motion-foundations`  |
| Accessibility                 | `accessibility`, `frontend-a11y`                                                  |
| Testing and QA                | `browser-qa`, `click-path-audit`, `e2e-testing`, `react-testing`, `benchmark`     |
| Quality gates                 | `verification-loop`, `delivery-gate`, `error-handling`, `security-review`         |
| Git and GitHub                | `git-workflow`, `conventional-commit-review`, `github-ops`                        |
| Documentation                 | `documentation-lookup`, `docs-governance`                                         |

Each selected `SKILL.md` was read in full before it was applied: 7,538 lines across the 29 files. The vendored copy has 37 files in all, because five skills ship helper scripts or references.

### Considered and not selected (28)

| Skill                                                                                   | Why not                                                                                                                 |
| --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `tdd-workflow`, `ai-regression-testing`, `test-collaboration`, `module-regression`      | The repository already has its own test layout and fakes; `react-testing` and `e2e-testing` cover what this work needs. |
| `typescript-patterns`, `vite-patterns`, `coding-standards`                              | Strict TypeScript, Vite, ESLint and Prettier are already configured and enforced by `npm run check`.                    |
| `motion-patterns`                                                                       | Built on the `motion/react` library, which Firefly does not use.                                                        |
| `api-design`, `contract-first`                                                          | The JSON API changes only additively; the zod schemas in `shared/domain` already act as the contract.                   |
| `architecture-decision-records`, `living-docs-governance`, `context-and-decisions`      | Would add new documentation structures that were not asked for; `docs-governance` covers the audit.                     |
| `codehealth-mcp`, `plankton-code-quality`, `gateguard`, `safety-guard`, `security-scan` | Need a CodeScene MCP server, Claude Code hooks or a `.claude/` configuration that this environment does not have.       |
| `agentic-engineering`, `search-first`, `latency-critical-systems`, `repo-scan`          | Overlap with `blueprint`, `verification-loop` and `benchmark`, or target other kinds of systems.                        |
| `code-tour`, `plan-canvas`, `ui-canvas`, `ui-demo`, `windows-desktop-e2e`, `taste`      | Produce tours, canvases, demo videos or native-desktop tests; none were requested.                                      |

## How they were installed

ECC's managed installer (`install-apply.js --target copilot`) was run first as a dry run with the 29 skills named. It planned 474 operations (rules for every language, agents, commands and platform configuration), so it was **not** applied: that would install far more than was selected. (`npx ecc-universal` was also tried; it failed with `EALLOWREMOTE` because this npm setup refuses remote tarballs.)

Instead the 29 selected skill directories were copied unmodified from the pinned commit into `.github/skills/`, the documented manual route for Copilot CLI. Nothing else from ECC was installed: no hooks, rules, agents, commands or MCP configuration.

Check: `copilot skill list --json` reports all 29 with `"source": "project"`. A session that was already running when the files appeared did not hot-load them, so in that session each procedure was applied by reading its `SKILL.md` and following it. Later sessions discover the skills directly.

The vendored files are third-party text kept as published, so Prettier and ESLint skip `.github/skills` and `.github/ecc` (see `.prettierignore` and `eslint.config.js`).

## Limits that were met

- `delivery-gate` is a Claude Code stop hook (Python and `~/.claude`). It cannot run under Copilot CLI, so its checks were applied by hand as the final checklist in the plan.
- `documentation-lookup` fetches documentation through a Context7 MCP server. None is configured here, so documentation was read from the vendors' own pages instead.
- No ECC skill covers visual regression, so screenshots were inspected by eye during `browser-qa` rather than compared automatically.
- `motion-foundations` is written for `motion/react`. Firefly uses CSS transitions, so only its rules were applied: motion must communicate state, animate only `transform` and `opacity`, take values from shared tokens, and fall back to short opacity changes under reduced motion.
- `react-testing` examples use MSW and TanStack Query. Firefly uses neither, so its query priority, `userEvent` and axe guidance were applied with the existing fakes.

## Updating

Review the ECC diff, copy the reviewed skill directories again from a pinned commit, regenerate `.github/ecc/skills.lock.json`, and note the new commit above.
