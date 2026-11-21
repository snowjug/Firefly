# Plan: Firefly as a voice-first Microsoft support call simulator

Status: implemented on the branch `feature/firefly-microsoft-voice-simulator`; the verification and the merge are recorded in the pull request. Rollback point: `main` at `cc7ed0eb72d48683bd91e051fcc762267122c606`.

This plan follows ECC's `blueprint` skill (research, design, draft, adversarial review, register). Each step is one commit sized for review, names the files it owns, and says how to verify it. The impact analysis from `change-impact` and the port map from `hexagonal-architecture` are folded in below.

## Objective

A trainee enters a realistic Microsoft support call, speaks with a believable customer, ends the call and receives coaching grounded in the transcript. Conversation skill is the subject; Firefly is not a troubleshooting-answer engine.

## What exists (from `codebase-onboarding`)

- Node + TypeScript API (`server/`), SQLite via `node:sqlite`, React 19 + React Router 7 + Vite web app (`web/`), shared zod schemas (`shared/domain/`). Four runtime dependencies: `react`, `react-dom`, `react-router`, `zod`.
- The working core to keep: the customer state engine and discovery logic (`server/engine`), the rules-based evaluator (`server/evaluator`), the model providers (`server/providers`), the speech layer (`server/speech`, `web/src/features/voice`) and the call machine (`web/src/features/call`).
- Gates: `npm run check` (format, lint, typecheck, scenario validation, unit tests, build, bundle budgets, secret scan, lockfile) and Playwright e2e on Chromium in CI.
- Before this work: 13 generic scenarios with made-up products, a per-dimension CARE tag but no per-behaviour CARE reading, long explanatory copy on every screen.

## Impact analysis (from `change-impact`)

| Question   | Finding                                                                                                                                                                                                                                                                                       |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Code       | `shared/domain` (vocab, scenario, config, api, report) is imported by server and web. Replacing the scenario library touches 44 files that name old scenario ids (mostly tests and fixtures). After the schema change, typecheck fails only in the 13 old library files and two web fixtures. |
| Data       | Stored sessions hold a scenario snapshot and a report. New snapshot fields and the report's `care` and `cbcf` fields are optional on read; `normaliseStoredScenario` fills gaps without inventing content. Sessions for retired scenario ids stay readable. No table changes.                 |
| Interfaces | `PublicScenarioDTO` and `SessionScenarioView` gain fields (additive). `CoachingReport` gains optional `care` and `cbcf`. No endpoint is removed.                                                                                                                                              |
| Tests      | Engine, evaluator, API and e2e tests that name old scenarios move to the new library or to inline fixtures. Copy-dependent UI tests are rewritten with the screens.                                                                                                                           |
| Docs       | README and the six named docs change; `docs/ecc-workflows.md` is new.                                                                                                                                                                                                                         |
| Release    | Rollback is a revert of the merge commit (or a reset of `main` to the rollback point by its owner). No irreversible data change.                                                                                                                                                              |

## Ports and adapters (from `hexagonal-architecture`)

- Domain and application code (`shared/domain`, `server/engine`, `server/evaluator`, `server/scenarios`, `server/prompts`) must not import HTTP, database, provider or speech adapters. A boundary test enforces the direction.
- Ports: language model (`server/providers/types.ts`), speech-to-text and text-to-speech (`server/speech/types.ts`), and the engine's seeded random source (`server/engine/rng.ts`).
- Adapters: `mock`, `gemini`, `azure-openai`, `openai-compatible` for the model; `none`, `mock`, `azure-speech` for speech. The composition root is `server/bootstrap.ts`.
- Tests use the in-memory fakes (`fake-llm-server`, `fake-azure-speech-server`, web `testing/fakes`) and never a live provider.

## Contract (written before any step, in `shared/domain`)

- `vocab.ts`: `PRODUCT_IDS` (13 Microsoft products), `PRODUCT_FAMILIES`, `PRODUCT_INFO`, three more issue types.
- `scenario.ts`: `product` (the product's name is derived from it, so no free-text product can disagree), optional `caseReference` (`SIM-000000`; the validator requires one because the call stage can be changed to follow-up, escalated or closure), `affectedUsers` per impact level, `listSummary` (at most 18 words), `summary` (at most 60), `publicBrief`, `customerExpectation`, `desiredOutcome`, `previousTroubleshooting`, `recentChanges`, `careExpectations`, `cbcfBehaviours` (must stay empty), the fact classes `knownFacts`, `vagueFacts`, `checkableFacts`, `unknownFacts`, `irrelevantFacts`, `hiddenFacts` (a hidden fact may also be one the customer has to look up), `incorrectAssumptions`, a frame for every call stage, and `allowedCurveballs` (a per-scenario allowlist).
- `config.ts`: `EffectiveScenario` carries the new fields, `EffectiveConfig.timeOfDay` picks the greeting; `normaliseStoredScenario` reads old snapshots (applied in the repository on read).
- `report.ts`: version 2 reports carry `care` (four principles, each exactly once, observable behaviours with verified quotes; "shown" needs a quote), `cbcf` (status `awaiting-authoritative-source`) and `journey.milestones` (greeting, impact, discovery, escalation, ownership, closure). Version 1 reports still parse.
- `api.ts`: `PublicScenarioDTO` and `SessionScenarioView` carry `product`, `caseReference` and `publicBrief`; `CreateSessionRequest.timeOfDay`.

## Adversarial review

ECC's `blueprint` calls for a review by a separate reviewer before the plan is registered. A reviewer read this plan and the contract change against the brief and the code. Its findings and what was done:

| Finding                                                                                       | Outcome                                                                                                                                                                                 |
| --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The new schema rejects the 13 old scenarios, and the server validates the library at startup. | Expected until the library is replaced. The library and the contract must land together; intermediate commits are not claimed to run. Only the final commit and the merge are verified. |
| Free-text briefs could repeat a hidden fact; the leak check only looked at numbers and codes. | The validator now also rejects four-word runs copied from a hidden fact into any earlier text, and checks stage briefs and discovery areas.                                             |
| Old session snapshots were only normalised in the DTO layer.                                  | `normaliseStoredScenario` is applied when a session is read from the database; the engine reads new runtime fields with defaults.                                                       |
| Retried creation for a retired scenario id returned 404 before the idempotency check.         | Assigned to the engine step: check the idempotency key first.                                                                                                                           |
| A fact could not be both hidden and something the customer must look up.                      | Hidden facts gained `knowledge: 'after-checking'` with a `checking` line; known, vague, checkable and unknown facts gained `cues`.                                                      |
| `environment.product` could contradict `product`; one affected count served every impact.     | The product name is derived from `product`; `affectedUsers` is per impact level.                                                                                                        |
| The report schema accepted duplicate CARE principles and "shown" without a quote.             | Version 2 requires unique principles and a quote for anything shown; the report is versioned.                                                                                           |
| The journey held temperature points, not the milestones the brief asks for.                   | `journey.milestones` added.                                                                                                                                                             |
| Generic curveballs were offered even when none were authored.                                 | `allowedCurveballs` is an allowlist; a listed type needs an authored or generic definition.                                                                                             |
| Only male and female voices existed.                                                          | Assigned to the voice step: four neutral voices selected by a stable id; older choices keep working.                                                                                    |
| Removing the recent-calls panel collided with the scenario screens being rebuilt.             | Step 3 was done first, before the parallel steps.                                                                                                                                       |
| Mock speech ignores spoken words, so tests cannot show that voice works.                      | Agreed. CI uses mocks; real-browser evidence is collected separately and anything not verified is listed as a limitation.                                                               |
| Plan claimed the CBCF mapping and report status already existed.                              | Fixed below: only the optional report fields exist; the pending-only mapping is built in step 10.                                                                                       |
| Over-tight character limits and a mandatory case reference.                                   | Limits are now generous; the case reference is optional in the schema.                                                                                                                  |
| Stale e2e specs, screenshots script and README images; no `calibrate` script.                 | Scheduled in steps 12 and 15. `npm run calibrate` does not exist in this repository and is reported as unavailable.                                                                     |

## CBCF status

No CBCF material was found in the repository or in the files provided for this project. Nothing about CBCF is guessed. What exists now is only the optional `cbcf` status field in the report schema. Step 10 adds a versioned `cbcfMapping` configuration marked as awaiting an authoritative source and makes every new report carry that status. No screen or document claims CBCF alignment. CARE comes from the behaviours documented in the project brief.

## Steps

Step 1 comes first, then step 2 (the contract) and step 3 (removal). Steps 4 to 11 then run in parallel where their files do not overlap: design and landing (4, 5), scenarios (6), the customer engine (7), voice (8), the call workspace with scenario selection and the brief (9), evaluation (10) and the report (11). The call workspace also depends on the voice interfaces (8) and the primitives (4). Steps 12 to 15 close the work.

```
1 ─ 2 ─ 3 ─┬─ 4 design ─ 5 landing ───────────────────────────┐
           ├─ 6 scenarios ─┬─ 7 customer engine ──────────────┤
           │               └─ 10 evaluation ─ 11 report ───────┤
           ├─ 8 voice abstraction ─ 9 call workspace ──────────┴─ 12 realism tests ─ 13 a11y ─ 14 perf ─ 15 docs
           └─ (4 also feeds 9 and 11)
```

### 1. chore: configure relevant ECC workflows

Vendor the 29 selected skills, record provenance, keep them out of the formatters and linters, write this plan. Verify: `copilot skill list --json` shows 29 project skills; `npx prettier --check .`; `npx eslint .`; `npm run check:secrets`.

### 2. refactor: isolate Firefly simulation core

Add the contract above and a boundary test that fails if domain or application code imports an adapter. Files: `shared/domain/**`, `server/services/dto.ts`, a new `server/architecture.test.ts`. Exit: typecheck clean except files named in step 6.

### 3. refactor: remove non-core product surfaces

Remove visible features the new scope does not use. The earlier rebuild already removed history, progress, trainer and calibration screens. What was left, and is removed here: the recent-calls panel and in-progress banner, and the session list endpoint, repository query and client call behind them. Deleting a call by its id stays, because it serves privacy. Exit: the route table is landing, scenarios, brief, call, report, responsible AI and about, and nothing unused remains.

### 4. design: add Microsoft-inspired Firefly system

Tune tokens, type, spacing and primitives for a calmer, low-text interface. No glass, neon, 3D or decorative gradients. Files: `web/src/design/**`. Exit: contrast checks pass in light and forced-colours; every transition has a reduced-motion variant; tokens drive every motion value.

### 5. feat: rebuild focused landing page

Copy budget: hero title at most 9 words, supporting line at most 18, primary button at most 3 words, steps at most 8 words each, Responsible AI note at most 24. Files: `web/src/features/landing/**`, `web/src/app/shell/**`, `web/src/features/content/**`, the public pages.

### 6. feat: add Microsoft product scenarios

Sixteen fictional scenarios across Microsoft 365, Windows, Azure and Dynamics 365, each with every field in the contract. Customers describe symptoms in everyday words; no scenario states product behaviour as fact, or contains a version or build number, a KB number, an error code, a menu path, a command, a link or contact details (product names such as Windows 11 are fine). Files: `server/scenarios/**` only. Verify: `npm run validate:scenarios`; library tests (no hidden-fact leaks, every difficulty workable, word budgets, no generic scenario left).

### 7. feat: add natural customer conversation engine

The customer greets, waits to be asked, gives the reason in one to three sentences, answers by fact class (known, vague, after checking, unknown, hidden, irrelevant), never invents what the scenario says they do not know, remembers what was said and promised, tells a repeated question from a clarification or a summary, differs by call stage and personality, and never coaches. Replies are short. Files: `server/engine/**`, `server/prompts/**`, `server/services/sessions.ts`.

### 8. feat: implement voice provider abstraction

Neutral voices A to D, prosody that follows the customer's state only where the provider supports it, a demo path that needs no keys, the documented state names, privacy text. Barge-in is implemented only if it can be made reliable; otherwise turn-taking stays controlled and that is documented. Files: `server/speech/**`, `web/src/features/voice/**`, `shared/domain/speech.ts`.

### 9. feat: build voice call workspace

Live call with state labels only (no instruction paragraph), microphone check, test voice, text fallback, and recovery actions (retry, use text, replay, continue without audio, retry evaluation, end safely) with no duplicate turns. Also the scenario selection and case brief. Files: `web/src/features/call/**`, `web/src/features/call-ui/**`, `web/src/features/scenarios/**`, the call, scenarios and brief pages.

### 10. feat: add CARE-aligned evaluation

Read CARE behaviour by behaviour from the transcript with verified quotes; no keyword-only scoring; repeated "I understand" earns nothing; short calls say the evidence is limited; word budgets for the report text. Files: `server/evaluator/**`.

### 11. feat: rebuild post-call coaching report

Header, summary of at most 45 words, six score rows, CARE summary, customer-journey timeline, strengths and opportunities with quotes and better wording, discovery found and missed, one next-practice suggestion, actions. Files: `web/src/features/report/**`, the report page.

### 12. test: add voice and customer realism coverage

Replay scripted calls through the engine and assert behaviour, not wording. Voice failure and recovery. Files: tests, e2e, `scripts/`.

### 13. a11y: harden accessible call experience

WCAG 2.2 AA: keyboard path through the whole call, focus management, live regions that do not flood, target size, forced colours, reduced motion, 200 per cent text. Automated checks plus manual inspection in Edge. Manual screen-reader testing is not done and is listed as a limitation.

### 14. perf: clean audio and transcript lifecycle

Release microphone and audio context on every exit path, leave no timers or object URLs behind, keep long transcripts responsive, hold the bundle budgets, no 3D or WebGL.

### 15. docs: document voice simulator and rubric

README plus `docs/voice-architecture.md`, `docs/customer-realism.md`, `docs/care-cbcf-rubric.md`, `docs/scenario-authoring.md`, `docs/privacy-audio.md`, `docs/demo-guide.md`; finish `docs/ecc-workflows.md` with the evidence for each skill.

## Invariants (checked after every step that touches code)

- No secret, audio file, real customer detail or confidential project material in the repository.
- Hidden facts never appear in a DTO, a brief or a prompt before they are discovered.
- Every report quote is a real quote from the cited turn.
- Demo mode is always labelled as demo; nothing claims a live provider that was not tested.
- Scores are described as practice signals, not assessments.

## Finish gate (from `delivery-gate`, applied by hand)

Before merging: the full check passes; a real-browser journey passes in Edge; the voice and text paths both work; screenshots at 320, 375, 430, 768, 1024, 1440 and 1920 px were looked at; the report renders; accessibility checks pass; a production build serves and passes a smoke test; CI is green on the exact commit; the secret scan is clean; the documentation matches what was built.

## Outcome and deviations

What differs from the plan, so that nobody has to find it:

- **Intermediate commits do not build on their own.** The schema, the scenario library and the engine depend on each other, so commits 2 to 10 are not each runnable (for example `c88e535` imports an engine file that arrives in commit 7). The checks above were run on the final commit, and on nothing earlier.
- **Independent review after the build.** Three read-only reviews of the committed engine, evaluator and call code found real defects (a failed message could lose its Retry notice, the microphone stayed open in a hidden tab, a pre-flight button did nothing, polite sentences were scored as blame, and more). Each was fixed with a test that fails without the fix, in commits 12 to 14.
- **No `npm run calibrate`.** The script does not exist in this repository and nothing was added in its place; scores have not been compared with a mentor's.
- **CBCF is not applied.** No authoritative material was found, so the report says so and no screen or document claims alignment.
- **The scenario pane's main button says "Review brief"**, where the brief called it "Start configuration": it opens the case brief, and the customise options sit in the same pane.
- **Not verified:** real speech-to-text and the customer's voice (only fakes, Edge's own speech synthesis and a scripted provider), Azure OpenAI, the OpenAI-compatible endpoint and Azure AI Speech (not run), screen readers, and any browser except Chromium. Gemini had one limited smoke check.
- **Known limitation left as it is:** while the End call dialog is open on a spoken call the microphone stays live.
