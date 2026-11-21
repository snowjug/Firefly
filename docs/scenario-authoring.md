# Writing Firefly scenarios

A scenario is a TypeScript file in `server/scenarios/library/` that default-exports an object satisfying `ScenarioInput`. The source of truth for every field and limit is `shared/domain/scenario.ts`. The checks that run on authored text are in `server/scenarios/index.ts`, and `npm run validate:scenarios` runs all of them (`scripts/validate-scenarios.ts`).

The library holds sixteen scenarios today. Read one before you write one, for example `server/scenarios/library/outlook-shared-mailbox-missing.ts`: each file opens with a comment that states the root cause and what a strong call does.

## Ground rules

- **Everything is fictional.** People, organisations, case references and numbers are invented. Never use real customer data, real support cases, real logs or real tenant details.
- **The products are real, the claims are not.** Firefly simulates calls to Microsoft support, so a scenario names a real Microsoft product from a fixed list (`PRODUCT_IDS` in `shared/domain/vocab.ts`). It never states how the product behaves. A customer reports what they see and what they were told, in everyday words. Product details in a scenario are customer-reported, not validated.
- **Invented organisations.** Use made-up company names in the style of Microsoft's sample companies (the library uses names such as Adventure Works, Woodgrove Bank and Litware). Check that a name you add is not a real organisation.
- **A synthetic case number.** `caseReference` has the form `SIM-000000`, so it cannot be mistaken for a real service request. Every scenario needs one, because the call stage can be changed to a follow-up, escalated or closure call.
- **The CBCF list stays empty.** `cbcfBehaviours` must be `[]`. No CBCF source material is available, so nothing is guessed (see [care-cbcf-rubric.md](care-cbcf-rubric.md#cbcf)).

## How a scenario drives a call

Firefly separates what is true from how it is said. The settings that the trainee can change decide the how. The facts decide the what.

| Part of the scenario                                                                            | What it controls                                                                                                                                               |
| ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `issueType`, `impact`, `startingTemperature`, `proficiency`, `style`, `callStage`, `difficulty` | The defaults. Each can be changed when a call is set up, so the rest of the content must still make sense after a change.                                      |
| `openingCore`                                                                                   | The customer's reason for calling, in the first person. On a first contact it is said once the engineer has answered the greeting, not in the greeting itself. |
| `impactVariants`, `affectedUsers`                                                               | What the customer says about the stakes, and how many people are affected, at each of low, medium and high.                                                    |
| `stageFrames`, `priorHistory`                                                                   | How a follow-up, an escalated and a closure call open, and what the case already holds.                                                                        |
| `knownFacts`, `vagueFacts`, `checkableFacts`, `unknownFacts`, `irrelevantFacts`, `hiddenFacts`  | What the customer knows, and how well. See [Fact classes](#fact-classes).                                                                                      |
| `incorrectAssumptions`                                                                          | What the customer believes that is not true.                                                                                                                   |
| `curveballs`, `allowedCurveballs`                                                               | The complications a call may have.                                                                                                                             |
| `publicBrief`, `brief`                                                                          | What the trainee may read before the call. Never a hidden fact.                                                                                                |
| `expectedDiscoveryAreas`                                                                        | The "Areas to explore" list that the **Live hints** switch adds to the case panel during the call. Short labels, never a hidden fact.                          |
| `careExpectations`, `successCriteria`, `evaluatorNotes`, `poorApproaches`, `goodBehaviours`     | Grounding for coaching. Never shown during the call.                                                                                                           |

How the customer turns this into a conversation is described in [customer-realism.md](customer-realism.md).

## Fields by purpose

Limits are from the schema. A word budget counts words, not characters.

| Purpose                | Fields and limits                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Identity and listing   | `id` (lower-case kebab-case, at most 64), `version`, `enabled`, `title` (at most 80 characters), `listSummary` (at most 18 words), `summary` (at most 60 words), `tags` (up to 8), `estimatedMinutes` (5 to 30). `spotlight` exists in the schema, and nothing reads it: leave it `false`.                                                                                                                                                                                                                                                                                                                         |
| Product and case       | `product` (`id` from the list and an `area` such as "Meetings"), `caseReference`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Defaults               | `issueType`, `impact`, `startingTemperature`, `proficiency`, `style`, `callStage`, `difficulty`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| The customer           | `persona` (`name`, `role`, `organisation`, `background`, `voice`, optional `speaker`), `environment.details` (1 to 8), `customerObjective`, `customerExpectation`, `desiredOutcome`, `previousTroubleshooting` (up to 6), `recentChanges` (up to 5).                                                                                                                                                                                                                                                                                                                                                               |
| Who is affected        | `affectedUsers` for low, medium and high: `count` (or `null`) and a `summary`. Internal: usually a hidden fact, so never in the brief.                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| What the trainee reads | `publicBrief`: `issue` (at most 18 words), `impact` for low, medium and high (at most 16 words each), `objective` (at most 18). Optional `knownContext`, `previousContact` and `environment` (at most 30 words each); a scenario whose `callStage` is `first-contact` must leave out `previousContact` (see [The public brief](#the-public-brief-and-word-budgets)). `brief`: `situation`, `goal` and up to five `groundRules`. `expectedDiscoveryAreas` (2 to 8 short labels, at most 60 characters each): the list the **Live hints** switch adds to the case panel during the call. The brief does not show it. |
| Opening                | `openingCore`, `impactVariants` (`summary`, `detail`, optional `deadline` for each level), `stageFrames`, `priorHistory` (up to 6 dated entries).                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Coaching               | `successCriteria` (3 to 6), `coachingFocus` (1 to 3 skills), `careExpectations` (1 to 4 for each of the four CARE principles), `poorApproaches` (2 to 6), `goodBehaviours` (3 to 6), `expectedOutcome`, `evaluatorNotes` (the root cause and what a strong call does).                                                                                                                                                                                                                                                                                                                                             |

`persona.speaker` is an optional pairing hint for a synthetic voice, used only by calls that name no voice. The trainee chooses between four neutral voices (see [voice-architecture.md](voice-architecture.md)). The hint is never shown, and nothing about the customer's behaviour or the support they deserve depends on it.

## Fact classes

The scenario sorts what the customer knows into classes. The class decides how a question is answered.

| Field                  | How many | What it is                                                                                                                                                                        |
| ---------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `knownFacts`           | 2 to 10  | Things the customer shares confidently when asked a relevant question. `elaboration` adds colour for a talkative customer. `simple` is plainer wording for a non-native customer. |
| `vagueFacts`           | up to 4  | Things the customer half remembers. They answer with a hedge (`text`) and firm it up (`confirmedText`) when the engineer narrows it down.                                         |
| `checkableFacts`       | up to 4  | Things the customer can only give after looking. `checking` is what they say while they look.                                                                                     |
| `unknownFacts`         | 1 to 5   | Things the customer does not know. They say so and never guess. `whoKnows` names who would.                                                                                       |
| `irrelevantFacts`      | up to 4  | Background that does not help solve the case, which a talkative customer may mention.                                                                                             |
| `hiddenFacts`          | 3 to 8   | Things the customer reveals only to an appropriate question. This is what rewards discovery.                                                                                      |
| `incorrectAssumptions` | up to 3  | A belief and the `truth` behind it. The customer states the belief. A correction is accepted, and doubt alone is not.                                                             |

At least one fact must be vague or checkable. Every fact has an `id` that is unique within the scenario, across all the classes and the curveballs. Write each line in the customer's first-person voice, and keep it tone-neutral: the same sentence has to sound plausible from a calm customer and from an angry one, because the temperature is configurable and changes during the call. No exclamation marks, sarcasm or emotional framing.

Every `intents` list uses the fixed vocabulary in `DISCOVERY_INTENTS` (`problem_description`, `error_message`, `timing_onset`, `recent_changes`, `affected_scope`, `business_impact`, `workaround`, `already_tried`, `environment`, `reproducibility`, `previous_contact`, `urgency_deadline`, `expected_outcome`, `account_details`).

## Hidden facts

A hidden fact is revealed when the trainee asks a question that addresses it. Two mechanisms work together, so that demo mode (rules) and live mode (model) behave alike:

- `intents` are the topics of questions that reveal it. In demo mode the rules classifier finds them.
- `revealWhen` is a plain description of the kind of question that should reveal it. A model classifier reads it. It describes the question and must never contain the fact itself.
- `cues` (demo mode only) narrow a broad topic. If a fact has cues, the question must also contain one of them.
- `partialStatement` with `partialIntents` lets a broad question reveal part of a fact.
- `knowledge: 'after-checking'` with a `checking` line makes the customer look it up first, then say it.
- `minDifficulty` controls which difficulty a fact exists at. `hint` is a clearer clue shown at Starter. It is not the **Live hints** switch, which adds the `expectedDiscoveryAreas` list to the case panel.
- `availableAfterTurn`, `minTrust` and `requiresImpactAck` model a customer who holds something back until there is trust, an acknowledgement, or time. Use them sparingly, mostly for harder scenarios.
- `statementTerse` (very short) and `statementSimple` (plain words) give a terse and a non-native customer their own wording.
- `missedConsequence` and `betterQuestion` feed the coaching report. `betterQuestion` must end with a question mark and be one a good engineer would actually ask.
- `stages` limits a fact to some call stages. A fact that only makes sense in a call-back ("I was promised a call yesterday") belongs to those stages.

**Impact levels.** A fact about how many people or how bad belongs to one impact level. Give the other levels their own wording in `byImpact` (each with `statement` and optional `partialStatement`, `statementTerse` and `statementSimple`). It replaces the default wording for that call. Without `byImpact` the default is used at every level.

**Cues.** A cue is a lower-case word or phrase matched in a question the trainee asks (not in a statement). It matches where it starts at a word start and may continue: `reinstall` matches "reinstalled", and `change` does not match "exchange". A cue of two or more content words also matches with up to two other words between them (`roll back` is found in "roll that change back"). A cue that contains a word such as `your`, `who` or `the` only matches as written. Prefer specific whole words and short phrases. Short or common stems (`load`, `test`, `late`, `again`) cause false matches. Housekeeping questions (asking for something to be repeated, putting the customer on hold, taking a phone number) never reveal a fact whatever cues they contain.

### What a scenario must offer at each difficulty

The validator counts facts at the scenario's own call stage:

- at least one critical hidden fact at the scenario's default difficulty;
- at least two hidden facts available at Starter, and at least three available at Standard or below;
- at least one Starter fact with a `hint`;
- at every difficulty, at least one critical or important hidden fact.

Facts that only exist at Challenge should still be fair to find.

### Keeping a hidden fact hidden

The validator rejects a scenario in which a hidden fact can be read before it is earned (`semanticIssues` in `server/scenarios/index.ts`).

- **Numbers and codes.** A distinctive token of a hidden fact (a number, a code, a hexadecimal value) must not appear in anything said or shown earlier. This covers the title, the summaries, `openingCore`, the brief and the public brief, every impact `summary`, `detail` and `deadline`, the known, vague, checkable, unknown and irrelevant facts, the stage frames, `priorHistory`, `incorrectAssumptions` and `expectedDiscoveryAreas`.
- **Copied wording.** Wording copied from a hidden fact into that earlier text is rejected, even with no number in it: a run of four words with at least three content words, or a run of six with at least two. Every wording of the fact counts, including `byImpact` and the terse and simple versions. (Short topic labels in `expectedDiscoveryAreas` are checked for numbers and codes only.)
- **Hints.** A hint must not give away a different hidden fact.
- **Partial facts.** `partialIntents` needs a `partialStatement`.

`previousTroubleshooting` and `recentChanges` are the case record and may hold the truth. The engine withholds any note that restates an unearned hidden fact until that fact is earned.

## Stage frames

Every stage the call can be configured for needs its own opening and brief, so that a follow-up, an escalation and a closure call each sound different. `stageFrames` holds one for `follow-up`, `escalated` and `closure` (required) and optionally `first-contact`.

- **`opening`** is a stand-alone line that says what the call is about. A call-back opens with it, before anything else: "I'm following up on the case I opened earlier." It is not a continuation of the first-contact story. It must read as a purpose, and the validator needs a known fact that answers `problem_description` at every stage.
- **`openingCore` is the first-contact reason.** It is said once the engineer has answered the greeting on a first contact. A first turn that is only "Yes." or "Okay." does not bring it out: it waits for the greeting that follows. A call-back opens with the stage frame and does not restate `openingCore`. Keep time out of `openingCore` ("this morning" would contradict a follow-up).
- **`brief`** is what the trainee is told about the case so far at that stage.

Without an authored frame for a stage, a generic one is used (`GENERIC_STAGE_FRAMES` in `shared/domain/config.ts`).

## The public brief and word budgets

What the trainee reads before a call has a word budget, so that the screens stay short. The limits above are checked on load, and the character limit behind each is only a generous safety net (about twelve characters a word).

**A first-contact scenario has no `previousContact`.** The public brief is the same at every call stage, and the trainee can set the call to a different stage. The interface shows **Previous contact** only on a follow-up, escalated or closure call (`web/src/features/scenarios/CaseRows.tsx` on the brief, `describeCase` in `web/src/features/call-ui/call-model.ts` on the call page). A scenario written for a first contact has no earlier contact to state. If it carried a `previousContact`, the text would be shown, and be wrong, once the call was set to a call-back. The validator rejects it with "publicBrief.previousContact: a first-contact scenario has no earlier contact to state (the brief is shown at every call stage)" (`semanticIssues` in `server/scenarios/index.ts`, run by `npm run validate:scenarios`). `server/scenarios/library.test.ts` covers it. A scenario written for a follow-up, escalated or closure call may have one.

Never put a hidden fact in `publicBrief`, `brief` or the list text. The public scenario data (`toPublicScenario` in `server/services/dto.ts`) carries the persona's name, role and organisation, the brief, the stage briefs and the discovery areas. It never carries the persona's background or voice, a fact, a note or a coaching field.

## Curveballs

A curveball is a complication the customer introduces mid-call. Curveball types come from `CURVEBALL_TYPES` (asks for a manager, threatens to cancel, imposes a deadline, changes the issue, goes quiet, mentions a bad experience, demands a guarantee, challenges credibility).

- `allowedCurveballs` lists the types a call of this scenario can be configured with (1 to 8). **Every authored curveball must be listed.** A listed type with no authored definition uses a generic one.
- Author at most one curveball per type, in `curveballs` (up to six): a call looks a curveball up by its type. When a call chooses none, the default set for its difficulty is the first authored ones, in file order, that the difficulty allows, so put the most representative one first.
- A `trigger` says when it may fire: an earliest turn, optionally a latest turn, a minimum temperature, an unacknowledged impact, unclear ownership, or a discovered fact (`afterFact`, which must be a hidden fact id).
- `statement` is in the customer's voice. `expectedResponse` says what a strong response looks like, for coaching.

## Coaching grounding

- `careExpectations` lists, for each CARE principle, one to four things a good call looks like for this case, as observable behaviour. The evaluator reads them to say what the case needed. See [care-cbcf-rubric.md](care-cbcf-rubric.md#what-the-scenario-expected).
- `evaluatorNotes` states the root cause (plausible, not confirmed on the call) and what a strong call does.
- `poorApproaches` are at least two things that would make this customer more upset. Be specific to the scenario.
- `successCriteria` and `goodBehaviours` are observable behaviours, not generic advice.

## Personas

Use varied, realistic, respectful personas. Avoid stereotypes. A persona's `voice` describes how they talk (pace, formality, habits), never their ethnicity, accent or background. Persona names must be unique across the library: validation fails if two scenarios share one.

For a non-native English speaker, write the customer's lines in clear, simple, natural English. Never imitate an accent, never write broken or comic English, and never make the language itself part of the problem. Coaching must never mark a trainee or a customer down for language style.

## Product-claim lint

Customers describe symptoms. The validator searches every piece of text in a scenario (ids and the case number are skipped) and rejects:

- a KB article number;
- a hexadecimal or other error code;
- a web address, an email address, a phone number, an IP address or a GUID;
- a command or a PowerShell-style cmdlet, or a well-known command name;
- a version or build number;
- a menu path (steps joined by an arrow or a greater-than sign).

If the story needs something like that, say what the customer sees in their own words instead ("an error about permissions").

## Quality bar

- A believable, specific situation with synthetic details.
- At least one discovery path with a root cause that is not obvious from the opening.
- Hidden facts that a good engineer would plausibly find by asking natural questions, with a clear difference between a strong and a weak call.
- Scenarios clearly different from each other: a different product, issue, stakes and people.
- Plain, human language. No marketing words. No jargon the persona would not use.

## Validate and test

```
npm run validate:scenarios                                          # the whole library, with a coverage summary
npm run validate:scenarios -- server/scenarios/library/<id>.ts      # one file
```

Then run the tests that read the library:

```
npx vitest run server/scenarios server/engine/library.test.ts server/evaluator/realLibrary.test.ts
```

- `server/scenarios/library.test.ts`: the library loads with no errors, covers every product family and the range of settings, keeps names and case numbers fictional and distinct, stays inside the word budgets, never carries a hidden fact into early text at any impact level, offers only the curveballs it allows, and rejects the cases above.
- `server/engine/library.test.ts`: the customer against every scenario in every stage: the opening, the case notes, whole scripted calls, and a plain style for a non-native customer.
- `server/evaluator/realLibrary.test.ts`: the evaluator against every scenario, with a good call and a poor one for each.
- `web/src/features/scenarios/behaviour.test.ts` runs the real library through the page's settings. It names no scenario and reads no text, so it follows the library when it changes.

The tests cover what a machine can check. After the file validates, read it once more as a customer would: is every hidden fact reachable only through a sensible question, and does each line sound human?

## Adding a scenario

1. Create `server/scenarios/library/<id>.ts`, default-exporting an object that satisfies `ScenarioInput`, and make `npm run validate:scenarios -- server/scenarios/library/<id>.ts` pass.
2. Import it in `server/scenarios/index.ts` and add it to `LIBRARY_INPUT`, easiest first (Starter, then Standard, then Challenge). `GET /api/scenarios` returns the list in that order.
3. Run `npm run validate:scenarios` for the whole library, then the tests above. They tell you if a hidden fact cannot be found, leaks, or collides with another scenario's persona name.
4. Play it once in the app in demo mode, as a trainee would: choose it in Scenarios, read the brief, start a call (typed is fine), and end it to read the report.
5. Update the scenario table in the [README](../README.md#scenarios) if you want it listed there.

To retire a scenario, set `enabled: false` or remove it from the registry. Calls already started on it keep working (see [customer-realism.md](customer-realism.md#old-calls-and-retired-scenarios)).
