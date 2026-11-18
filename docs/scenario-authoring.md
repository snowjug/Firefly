# Writing Firefly scenarios

A scenario is a TypeScript file in `server/scenarios/library/` that default-exports an object
satisfying `ScenarioInput` (see `shared/domain/scenario.ts`, which is the source of truth for every
field and limit). The built-in library is validated by `npm run validate:scenarios`.

Every person, organisation, product, identifier and number in a scenario is **fictional**. Never use
real customer data, real support cases, real logs or real tenant IDs. Use invented organisations
(for example Fabrikam, Contoso, Northwind, Litware, Woodgrove, Tailspin) and generic product names
such as "the Northwind staff portal". Firefly is product-agnostic: do not require knowledge of any
real product, and do not name real vendors' products.

## How a scenario drives a call

Firefly separates _what is true_ from _how it is said_:

| Part of the scenario                                                                            | What it controls                                                                                                                                                |
| ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `issueType`, `impact`, `startingTemperature`, `proficiency`, `style`, `callStage`, `difficulty` | The defaults. Every one can be changed when a call is configured, so the content below must still make sense after a change.                                    |
| `openingCore`                                                                                   | A neutral first-person statement of the problem. The opening line is composed from it plus the temperature, style, call stage and impact settings.              |
| `impactVariants`                                                                                | What the customer says about the business impact at each of low, medium and high. `summary` is volunteered; `detail` is given when asked about scope or impact. |
| `stageFrames`, `priorHistory`                                                                   | Extra context when the call stage is a follow-up, escalation or closure. Provide frames for the stages that make sense for the story.                           |
| `knownFacts`                                                                                    | Things the customer shares freely when asked a relevant question.                                                                                               |
| `hiddenFacts`                                                                                   | Things the customer reveals **only** in response to an appropriate question. This is what rewards discovery.                                                    |
| `incorrectAssumptions`                                                                          | What the customer believes that is not true. The customer states it; a good engineer finds out gently.                                                          |
| `curveballs`                                                                                    | Optional, scenario-specific curveballs. Generic ones (manager, cancel, deadline, silence ...) already exist; author your own for a better fit.                  |
| `evaluatorNotes`, `successCriteria`, `poorApproaches`, `goodBehaviours`, `expectedOutcome`      | Grounding for coaching. They are never shown to the trainee during the call.                                                                                    |

### Hidden facts: the important part

A hidden fact is revealed when the trainee asks a question that matches it. Two mechanisms, used
together so they behave the same in demo mode (rules) and live mode (model):

- `intents` are the _topics_ of questions that reveal it, taken from a fixed vocabulary
  (`DISCOVERY_INTENTS`: `problem_description`, `error_message`, `timing_onset`, `recent_changes`,
  `affected_scope`, `business_impact`, `workaround`, `already_tried`, `environment`,
  `reproducibility`, `previous_contact`, `urgency_deadline`, `expected_outcome`, `account_details`).
- `revealWhen` is a plain-language description of the kind of question that should reveal it. A model
  classifier reads it. It describes the _question_ and must never contain the fact itself.
- `cues` (rules mode) narrow a broad topic. If a fact has cues, the question must also contain one of
  them (lower-case substrings). Use cues when the topic is broad but the fact is specific. For
  example, "environment" covers "what browser?" as well as "is it signed in on your phone?", so the
  phone fact carries cues like `phone` and `other device`. Without cues a broad topic would reveal it
  too early.
- `partialStatement` and `partialIntents` let a broad question reveal only part of a fact.
- `minDifficulty` controls which facts exist at each difficulty. A scenario must work at all three:
  at least **two** facts at `starter`, **three** at or below `standard`, and a critical or important
  fact at every difficulty. Facts that only exist at `challenge` should still be fair to find.
- `hint` is a clearer clue offered at Starter difficulty. At least one Starter-tier fact needs one.
- `availableAfterTurn`, `minTrust` and `requiresImpactAck` model customers who withhold information
  until trust or acknowledgement exists. Use them sparingly and mostly for harder scenarios.
- `missedConsequence` and `betterQuestion` feed the coaching report. `betterQuestion` must be a
  natural question a good engineer would actually ask.

Rules for hidden-fact text:

- Write `statement` in the customer's first-person voice and keep it **tone-neutral**. The same
  sentence has to sound plausible from a calm customer and from an angry one, because the temperature
  is configurable and changes during the call. No exclamation marks, sarcasm or emotional framing.
- One or two sentences. Specific, concrete and checkable (a time, a number, a message, a change).
- Never put a hidden fact's distinctive tokens (numbers, error codes, names of changes) in
  `openingCore`, known facts, `impactVariants.*.summary` or stage-frame openings. The validator
  checks for leaks.
- Provide `statementTerse` (very short) and `statementSimple` (plain words, short sentences) where
  useful.

### Impact variants

`impactVariants` must read naturally for all three levels, because the impact setting can change
independently of the story. Keep the underlying problem identical; change who is affected, how
urgent it is and what is at stake. Do not contradict hidden facts (for example, do not make the
low-impact version "one user" if a hidden fact says "the whole team").

### Non-native English speakers

Write the customer's lines in clear, simple, natural English. Never imitate an accent, never write
broken or comic English, and never make the language itself part of the problem. Simple vocabulary
and shorter sentences are enough. Coaching must never penalise a trainee or customer for language
style.

### Personas

Use varied, realistic, respectful personas. Avoid stereotypes. A persona's `voice` should describe how
they talk (pace, formality, habits), not their ethnicity or background.

## Quality bar

- A believable, specific situation with synthetic details. No generic "the system is down".
- At least one meaningful discovery path with a root cause that is not obvious from the opening.
- Hidden facts that a good engineer would plausibly find by asking natural questions, with a clear
  difference between a strong and a weak call.
- At least two poor approaches that would make this customer more upset, and several behaviours that
  would improve the call. Be specific to this scenario, not generic.
- An expected outcome and evaluator notes that state the root cause and what a strong call does.
- Scenarios must be clearly different from each other: different issue, setting, stakes and people.
- Plain, human language. No marketing words. No jargon the persona would not use.

## Validate

```
npm run validate:scenarios -- server/scenarios/library/<your-file>.ts
```

The validator checks the schema, id uniqueness, leaks of hidden-fact tokens into early text,
intent names, partial-fact consistency and per-difficulty viability. After the file validates, read
it once more as a customer would: is every hidden fact only reachable through a sensible question,
and does each line sound human?

## Practical notes from authoring the library

- **Curveballs are keyed by type.** Author at most one curveball per `type`. When a call does not choose
  curveballs, the default set for its difficulty is the first authored ones (in file order) that are
  allowed at that difficulty, so put the most representative curveball first.
- **Cues are substrings.** A cue matches anywhere in the question, case-insensitively, after the text is
  trimmed. Short stems cause false matches (`load` matches "upload", `test` matches "latest", `who`
  matches "whole", `history` matches "order-history"). Prefer whole words and short phrases, and do not
  rely on leading or trailing spaces.
- **Keep time out of `openingCore`.** The call stage is configurable, so a first-contact story that says "this
  morning" will contradict a follow-up opening. Put time-specific details in hidden or known facts, and keep the
  opening statement of the problem timeless.
- **Do not repeat the problem statement in the impact summaries.** The opening is `openingCore` followed by the
  impact `summary`. The summary should add stakes ("customers are starting to notice"), not restate the
  problem. Firefly drops a sentence that mostly repeats an earlier one, but good authoring avoids it.
- **`priorHistory` can be seen by trainees.** Write it as a case record would read, never as hidden-fact content.
- **Persona names must be unique across the library.** Validation fails if two scenarios share a name.
- **Scenarios are tested as a set.** `server/scenarios/library.test.ts` checks that the library covers every
  difficulty, temperature, style, stage, impact and proficiency; that no scenario contains real-looking
  contact details or links; that no hidden fact leaks into an opening under any combination of settings; that
  every hidden fact can be discovered by a considerate conversation (by cue, or by topic when it has no
  cues) at every difficulty; and that irrelevant messages reveal nothing.

## Adding a scenario to the library

1. Create `server/scenarios/library/<id>.ts` and make `npm run validate:scenarios -- server/scenarios/library/<id>.ts` pass.
2. Import it in `server/scenarios/index.ts` and add it to `LIBRARY_INPUT`. The list is ordered easiest first,
   which is the order the library page shows by default.
3. Run `npm test`. The library tests above will tell you if a hidden fact cannot be found, leaks, or collides
   with another scenario's persona name.
4. Play it once in the app in demo mode, as a trainee would.
