# Writing Firefly scenarios

A scenario is a TypeScript file in `server/scenarios/library/` that default-exports an object satisfying `ScenarioInput`. The source of truth for every field and limit is `shared/domain/scenario.ts`. The checks that run on authored text are in `server/scenarios/index.ts`, and `npm run validate:scenarios` runs all of them (`scripts/validate-scenarios.ts`). The server loads the whole library when it starts (`getScenarioLibrary`, used by `server/bootstrap.ts`) and does not start if any scenario fails to validate, so a scenario that fails is never shown to a trainee.

The library holds sixteen scenarios today. Read one before you write one, for example `server/scenarios/library/outlook-shared-mailbox-missing.ts`: each file opens with a comment that states the root cause and what a strong call does.

## Ground rules

- **Everything is fictional.** People, organisations, case references and numbers are invented. Never use real customer data, real support cases, real logs or real tenant details.
- **The products are real, the claims are not.** Firefly simulates calls to Microsoft support, so a scenario names a real Microsoft product from a fixed list (`PRODUCT_IDS` in `shared/domain/vocab.ts`). It never states how the product behaves. A customer reports what they see and what they were told, in everyday words. Product details in a scenario are customer-reported, not validated.
- **Invented organisations.** Use made-up company names in the style of Microsoft's sample companies (the library uses names such as Adventure Works, Woodgrove Bank and Litware). Check that a name you add is not a real organisation.
- **A synthetic case number.** `caseReference` has the form `SIM-000000`, so it cannot be mistaken for a real service request. Every scenario needs one, because the call stage can be changed to a follow-up, escalated or closure call.
- **The CBCF list stays empty.** `cbcfBehaviours` must be `[]`. No CBCF source material is available, so nothing is guessed (see [care-cbcf-rubric.md](care-cbcf-rubric.md#cbcf)).
- **One fixed ground-rule line.** The first entry of every scenario's `brief.groundRules` is "The customer and organisation are fictional; the product is real." `server/scenarios/library.test.ts` checks it, and that no ground rule calls a product fictional. No screen draws `brief` today (see [What each screen draws](#what-each-screen-draws)): a trainee sees that the customer is invented from the "Synthetic customer" label on the scenario details and the case brief, and from the "Synthetic scenario" tag on the case brief.
- **Say how far it was checked.** Every scenario carries an internal provenance record, `grounding`: when it was written, which public sources it rests on, whether its product wording was checked and whether anyone reviewed it. It is never shown to a trainee. See [Provenance](#provenance-grounding) and [Researching a scenario](#researching-a-scenario).

## How a scenario drives a call

Firefly separates what is true from how it is said. The settings that the trainee can change decide the how. The facts decide the what.

| Part of the scenario                                                                            | What it controls                                                                                                                                                                                                      |
| ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `issueType`, `impact`, `startingTemperature`, `proficiency`, `style`, `callStage`, `difficulty` | The defaults. Each can be changed when a call is set up, so the rest of the content must still make sense after a change.                                                                                             |
| `openingCore`                                                                                   | The customer's reason for calling, in the first person. On a first contact it is said once the engineer has answered the greeting, not in the greeting itself.                                                        |
| `impactVariants`, `affectedUsers`                                                               | What the customer says about the stakes, and how many people are affected, at each of low, medium and high.                                                                                                           |
| `stageFrames`, `priorHistory`                                                                   | How a follow-up, an escalated and a closure call open, and what the case already holds.                                                                                                                               |
| `knownFacts`, `vagueFacts`, `checkableFacts`, `unknownFacts`, `irrelevantFacts`, `hiddenFacts`  | What the customer knows, and how well. See [Fact classes](#fact-classes).                                                                                                                                             |
| `incorrectAssumptions`                                                                          | What the customer believes that is not true.                                                                                                                                                                          |
| `curveballs`, `allowedCurveballs`                                                               | The complications a call may have.                                                                                                                                                                                    |
| `publicBrief`, `brief`                                                                          | What the trainee may read before the call. `publicBrief` is what the case brief and the call's case panel draw; `brief` is in the public scenario data, but no screen draws it today. Neither may hold a hidden fact. |
| `expectedDiscoveryAreas`                                                                        | The "Areas to explore" list that **Guided practice** adds to the case panel during the call. Short labels, never a hidden fact.                                                                                       |
| `careExpectations`, `successCriteria`, `evaluatorNotes`, `poorApproaches`, `goodBehaviours`     | Grounding for coaching. Never shown during the call.                                                                                                                                                                  |

How the customer turns this into a conversation is described in [customer-realism.md](customer-realism.md).

## Fields by purpose

Limits are from the schema. A word budget counts words, not characters.

| Purpose                | Fields and limits                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Identity and listing   | `id` (lower-case kebab-case, at most 64; it is public, see below), `version`, `enabled`, `title` (at most 80 characters), `shortTitle` (2 to 6 words, see [The short title](#the-short-title)), `listSummary` (at most 18 words), `summary` (at most 60 words), `tags` (up to 8), `estimatedMinutes` (a whole number from 5 to 30, shown to trainees as a range, see [Estimated minutes](#estimated-minutes)). `listSummary`, `summary` and `tags` are public data that no screen draws today. `spotlight` exists in the schema, and nothing reads it: leave it `false`.                                                                                   |
| Product and case       | `product` (`id` from the list and an `area` such as "Meetings"), `caseReference`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Provenance (internal)  | `grounding`: `authoredOn`, `productFamily`, `sourceCategories`, `behaviourCheck`, `syntheticConfirmed`, `review`, and `revisedOn`, `checkedOn` and `notes` (optional, but `checkedOn` is needed once anything was checked, and `notes` for `checked-current` or `mentor-reviewed`). Required. See [Provenance](#provenance-grounding).                                                                                                                                                                                                                                                                                                                     |
| Defaults               | `issueType`, `impact`, `startingTemperature`, `proficiency`, `style`, `callStage`, `difficulty`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| The customer           | `persona` (`name`, `role`, `organisation`, `background`, `voice`, optional `speaker`), `environment.details` (1 to 8), `customerObjective`, `customerExpectation`, `desiredOutcome`, `previousTroubleshooting` (up to 6), `recentChanges` (up to 5).                                                                                                                                                                                                                                                                                                                                                                                                       |
| Who is affected        | `affectedUsers` for low, medium and high: `count` (or `null`) and a `summary`. Internal: usually a hidden fact, so never in the brief.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| What the trainee reads | `publicBrief`: `issue` (at most 18 words), `impact` for low, medium and high (at most 16 words each), `objective` (at most 18). Optional `knownContext`, `previousContact` and `environment` (at most 30 words each); a scenario whose `callStage` is `first-contact` must leave out `previousContact` (see [The public brief](#the-public-brief-and-word-budgets)). `brief`: `situation`, `goal` and up to five `groundRules` (public data that no screen draws today). `expectedDiscoveryAreas` (2 to 8 short labels, at most 60 characters each): the list **Guided practice** adds to the case panel during the call. The case brief does not show it. |
| Opening                | `openingCore`, `impactVariants` (`summary`, `detail`, optional `deadline` for each level), `stageFrames`, `priorHistory` (up to 6 dated entries).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Coaching               | `successCriteria` (3 to 6), `coachingFocus` (1 to 3 skills), `careExpectations` (1 to 4 for each of the four CARE principles), `poorApproaches` (2 to 6), `goodBehaviours` (3 to 6), `expectedOutcome`, `evaluatorNotes` (the root cause and what a strong call does).                                                                                                                                                                                                                                                                                                                                                                                     |

`persona.speaker` is an optional pairing hint for a synthetic voice, used only by calls that name no voice. The trainee chooses between four neutral voices (see [voice-architecture.md](voice-architecture.md)). The hint is never shown, and nothing about the customer's behaviour or the support they deserve depends on it.

**The id is public.** It is in the address (`/scenarios?scenario=<id>`, `/scenarios/<id>/brief`) and in the API, and the validator does not compare it with the hidden facts (`semanticIssues` leaves `id` out of the text it reads). Keep it to the product and what the trainee already reads. One existing id says more than the brief does: `teams-cannot-join-external-meetings` names the pattern that the hidden fact `hf-external-guests` holds. Ids are stable (saved calls and links carry them), so it has not been renamed. Do not copy the habit.

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
- `revealWhen` is a plain description of the kind of question that should reveal it. A model classifier reads it. It describes the question and must never contain the fact itself. Start it with "Asks": the built-in coaching reuses it (see below).
- `cues` (demo mode only) narrow a broad topic. If a fact has cues, the question must also contain one of them.
- `partialStatement` with `partialIntents` lets a broad question reveal part of a fact.
- `knowledge: 'after-checking'` with a `checking` line makes the customer look it up first, then say it.
- `minDifficulty` controls which difficulty a fact exists at. `hint` is a clearer clue that the customer may drop at Starter. It is not **Guided practice**, which adds the `expectedDiscoveryAreas` list and a count of what has been found to the case panel (see [Hints, areas to explore and tips](#hints-areas-to-explore-and-tips)).
- `availableAfterTurn`, `minTrust` and `requiresImpactAck` model a customer who holds something back until there is trust, an acknowledgement, or time. Use them sparingly, mostly for harder scenarios.
- `statementTerse` (very short) and `statementSimple` (plain words) give a terse and a non-native customer their own wording.
- `missedConsequence` and `betterQuestion` feed the coaching report. `betterQuestion` must end with a question mark and be one a good engineer would actually ask.
- `stages` limits a fact to some call stages. A fact that only makes sense in a call-back ("I was promised a call yesterday") belongs to those stages.

**`revealWhen` is read again by the coaching.** In demo mode, when a missed hidden fact is one of the report's improvements, its "why it works" line says "It works because it asks ..." and, when it is the biggest opportunity, the summary says "The biggest opportunity is to ask ...". Both use the trigger's own words after its first "Asks" (`firstAsk` and `askAdvice` in `server/evaluator/phrasing.ts`). So write the trigger to read as advice with "ask" in front of it: "Asks whether anything changed while he was away, or who looks after access to the shared mailboxes." (the Outlook scenario). Only the first alternative is used when a second one starts "or asks". A trigger that does not start with "Asks" is not used this way: the coaching offers "ask a question like" the fact's `betterQuestion` instead. A live model that writes the coaching is not given `revealWhen`; it gets the fact's label, what was hidden and `betterQuestion` (`server/prompts/evaluator.ts`). `server/scenarios/library.test.ts` fails a trigger in which "looks after", "look after", "manages" or "owns" is followed straight by "who", "what" or "which": that second question word reads badly once the trigger is advice.

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

- **Numbers and codes.** A distinctive token of a hidden fact (a number, a code, a hexadecimal value) must not appear in anything said or shown earlier. This covers the title and the short title, the summaries, `openingCore`, the brief and the public brief, every impact `summary`, `detail` and `deadline`, the known, vague, checkable, unknown and irrelevant facts, the stage frames, `priorHistory`, `incorrectAssumptions` and `expectedDiscoveryAreas`.
- **Copied wording.** Wording copied from a hidden fact into that earlier text is rejected, even with no number in it: a run of four words with at least three content words, or a run of six with at least two. Every wording of the fact counts, including `byImpact` and the terse and simple versions. (Short topic labels in `expectedDiscoveryAreas` are checked for numbers and codes only.)
- **Hints.** A hint must not give away a different hidden fact.
- **Partial facts.** `partialIntents` needs a `partialStatement`.

`previousTroubleshooting` and `recentChanges` are the case record and may hold the truth. The engine withholds any note that restates an unearned hidden fact until that fact is earned.

### Hints, areas to explore and tips

Four things can help a trainee find their way, and they are easy to confuse. The first belongs to the difficulty. The other three belong to **Guided practice**, the practice mode that Starter starts in and Standard and Challenge do not (`defaultMode` in `shared/domain/state.ts`; the trainee can change it). An author writes only the first two.

- **A fact's `hint`** is the customer's own gentle clue. The plan may let the customer drop it at Starter difficulty, in either practice mode (`hintsEnabled` in the difficulty profile, `shared/domain/state.ts`). It is spoken by the customer and never drawn on screen.
- **`expectedDiscoveryAreas`** are the short topic labels under "Areas to explore" in the call's case panel (`web/src/features/call-ui/CaseContext.tsx`), shown only in Guided practice. They name topics, never what was found.
- **The tips strip** ("During the call") shows general tips about running a support call. The tips are fixed text in `web/src/features/tips/tips.ts`, 19 at the time of writing, each at most ten words with an optional "Learn why" line of at most 30, so a scenario cannot change them. "Learn why" opens in place, as one more row of the strip. The strip is drawn only in Guided practice (`web/src/features/call-ui/CallWorkspace.tsx`). It is left out of a window that is under 64 em wide and no more than 44 em high (704 px at the default text size), such as a small phone, and while the on-screen keyboard is open. "Hide tips" puts it away for the call and "Show tips" brings it back. Which tip comes up is decided from the call stage the trainee chose in the brief, how many messages they have sent and which tips they have already seen (`web/src/features/tips/selection.ts`), and from nothing else: not a hidden fact, the customer's mood, what has been found, the product or an unexpected turn. `web/src/features/tips/tips-source.test.ts` fails if the tips folder imports a scenario or the state of a call, or names one in its code.
- **"Context found"**, in the same case panel, is a count of how many things the trainee has found out so far (`discoveredCount` in the customer's public state: the hidden facts the customer has said, in full or in part). It is a count only: never a total and never what was found, and no field of a scenario turns it on or off. Assessment practice leaves it out, because a count that ticks up while the trainee asks is a cue about what is hidden (`CaseContext.tsx`, and a test in `web/src/features/call-ui/CallWorkspace.test.tsx`).

Because the tips are read against the whole library, adding a scenario can make `web/src/features/tips/tips.test.ts` fail. It fails when a tip uses a word that is also a word in the label of any hidden fact in the library, when a tip shares a run of three content words with a hidden fact's `statement`, `partialStatement` or `revealWhen`, and when a tip names a product or a complication. The failure names the word and the scenarios whose facts use it. Reword the tip first: the test's own comment says to add a word to its short list of plain call-handling words only when it really is one.

## Stage frames

Every stage the call can be configured for needs its own opening and brief, so that a follow-up, an escalation and a closure call each sound different. `stageFrames` holds one for `follow-up`, `escalated` and `closure` (required) and optionally `first-contact`.

- **`opening`** is a stand-alone line that says what the call is about. A call-back opens with it, before anything else: "I'm following up on the case I opened earlier today about the Teams meetings, and nobody has called me back." (`server/scenarios/library/teams-cannot-join-external-meetings.ts`). It is not a continuation of the first-contact story. It must read as a purpose, and the validator needs a known fact that answers `problem_description` at every stage.
- **`openingCore` is the first-contact reason.** It is said once the engineer has answered the greeting on a first contact. A first turn that is only "Yes." or "Okay." does not bring it out: it waits for the greeting that follows. A call-back opens with the stage frame and does not restate `openingCore`. Keep time out of `openingCore` ("this morning" would contradict a follow-up).
- **`brief`** is what the trainee is told about the case so far at that stage.

Without an authored frame for a stage, a generic one is used (`GENERIC_STAGE_FRAMES` in `shared/domain/config.ts`).

## The public brief and word budgets

What the trainee reads before a call has a word budget, so that the screens stay short. The limits above are checked on load, and the character limit behind each is only a generous safety net (about twelve characters a word).

**A first-contact scenario has no `previousContact`.** The public brief is the same at every call stage, and the trainee can set the call to a different stage. The interface shows **Previous contact** only on a follow-up, escalated or closure call (`web/src/features/scenarios/CaseRows.tsx` on the brief, `describeCase` in `web/src/features/call-ui/call-model.ts` on the call page). A scenario written for a first contact has no earlier contact to state. If it carried a `previousContact`, the text would be shown, and be wrong, once the call was set to a call-back. The validator rejects it with "publicBrief.previousContact: a first-contact scenario has no earlier contact to state (the brief is shown at every call stage)" (`semanticIssues` in `server/scenarios/index.ts`, run by `npm run validate:scenarios`). `server/scenarios/library.test.ts` covers it. A scenario written for a follow-up, escalated or closure call may have one.

Never put a hidden fact in `publicBrief`, `brief` or the list text. The public scenario data (`toPublicScenario` in `server/services/dto.ts`) carries the identity and listing fields, the product, the case reference, the defaults, the persona's name, role and organisation, `publicBrief`, `brief`, the stage briefs, the discovery areas, `coachingFocus` and the curveball types the scenario allows. It never carries the persona's background or voice, a fact of any class, the opening or the case history, the wording of a curveball, the author's coaching notes (`careExpectations`, `successCriteria`, `evaluatorNotes`, the good and poor approaches and `expectedOutcome`) or the provenance record.

### What each screen draws

These are the scenario fields the screens read today. This comes from reading `web/src`; no test enforces it.

| Screen                                                                       | What it draws from the scenario                                                                                                                                                                                                                                                                                                                                             |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scenario card (the scenarios page, and the featured row on the landing page) | The product (its tile and short name), `shortTitle`, one line made of the impact, the starting temperature and the call stage ("High impact · Anxious · Follow-up"), `estimatedMinutes` as a range, and the difficulty. It leaves the summary out on purpose, so that a row of cards can be scanned.                                                                        |
| Scenario details                                                             | The product and area, `title`, `publicBrief.issue`, the impact line for the chosen level, the customer's name, role and organisation, a preview of the customer's starting state (a mood word and a three-step level each for patience and trust, from the chosen settings and not from any fact), the call stage, the difficulty, the estimated range and `coachingFocus`. |
| Case brief                                                                   | `title`, the product, the customer, `publicBrief.issue` with the issue type, the impact line, the call stage (with the case reference on a follow-up, escalated or closure call), `publicBrief.objective`, and, behind disclosures, `knownContext`, `previousContact` (not on a first contact) and `environment`.                                                           |
| Case panel during a call                                                     | The product, the case reference (tagged "Synthetic"), the issue, the impact line, the call stage, the objective, "Context found" (a count of what has been found, in Guided practice only), "Areas to explore" (Guided practice only), and "More context" (the same three optional details).                                                                                |

The sources are `ScenarioCard.tsx`, `ScenarioDetail.tsx` and `CaseRows.tsx` in `web/src/features/scenarios/`, and `CaseContext.tsx` in `web/src/features/call-ui/`. No screen draws `summary`, `listSummary`, `tags`, `brief` or the stage briefs, except that `brief.goal` stands in for the objective of a call saved before public briefs existed. They are still sent to the browser, so the rules about hidden facts and word budgets apply to them like the rest.

Where a card appears does not depend on the registry order. The scenarios page orders cards by product family, then product, then easiest first, then title (`sortScenarios` in `web/src/features/scenarios/catalogue.ts`). The landing page features one scenario for each product in a list of twelve (`FEATURED_PRODUCTS`, which leaves out Power Platform): the gentlest one, then the first by id (`pickFeatured` in `web/src/features/landing/featured.ts`).

### The short title

`shortTitle` is the title on a scenario card: two to six plain words in sentence case, with no full stop ("Shared mailbox missing"). The card falls back to the full title when the server sends none (`cardTitle` in `web/src/features/scenarios/labels.ts`); the scenario details and the case brief show the full title. A short title is a shorter way of saying what the title and `publicBrief.issue` already say. It must not add information, so it cannot hint at a hidden fact: the Teams scenario's hidden facts are about guests from outside the company and nothing public says so, so its short title is "Cannot join meetings", never "External users cannot join".

The schema requires two to six words, a capital first letter and no closing full stop, exclamation mark, question mark, colon, semicolon or comma. It does not check the case of the other words. The validator (`semanticIssues` and `loadScenarios` in `server/scenarios/index.ts`) rejects a short title when:

- it is longer than the title, counted in characters;
- it shares no content word with the title;
- it uses a content word that neither the title nor `publicBrief.issue` holds. It compares word roots, so "approvals" matches "approval" and "running" matches "run";
- it repeats a hidden fact, by the same checks as the title;
- another scenario already uses it, ignoring case, because two cards could not be told apart.

For example, the validator prints lines like these:

```
outlook-shared-mailbox-missing: shortTitle shares no content word with the title
outlook-shared-mailbox-missing: shortTitle adds "gone", "migration", which neither the title nor publicBrief.issue says
```

`shortTitle` is part of the public scenario data. It is not stored with a call, which keeps the full title. `server/scenarios/library.test.ts` tests the shape of the field, the first three rules and the duplicate check, and checks every real short title against the hidden facts through the public scenario data. `web/src/features/scenarios/card-library.test.tsx` draws every real card and checks that its title is two to six words, that a card holds at most eighteen words in all, that a link card leaves the summary out, and that no two cards share a title.

### Estimated minutes

`estimatedMinutes` is a whole number from 5 to 30: the author's estimate of how long a typical call takes. Nothing in this repository measures it against real calls. No screen shows the number. The scenario card and the scenario details ("Estimated duration") show a range from `formatEstimate` in `shared/domain/duration.ts`: 20% below to 20% above, with the low end at least three minutes and the range always at least a minute wide (`min = max(3, round(0.8 × minutes))`, `max = max(min + 1, round(1.2 × minutes))`), written with an en dash and a space before "min". So 5 shows as "4–6 min", 8 as "6–10 min", 10 as "8–12 min", 12 as "10–14 min", 15 as "12–18 min" and 30 as "24–36 min" (`shared/domain/duration.test.ts`). The library's estimates run from 8 to 15, so its cards read from "6–10 min" to "12–18 min".

## Curveballs

A curveball is a turn the customer takes mid-call. The interface calls it a complication in the call's settings and an unexpected turn in the report. Curveball types come from `CURVEBALL_TYPES` (asks for a manager, threatens to cancel, imposes a deadline, changes the issue, goes quiet, mentions a bad experience, demands a guarantee, challenges credibility).

- `allowedCurveballs` lists the types a call of this scenario can be configured with (1 to 8). **Every authored curveball must be listed.** A listed type with no authored definition uses a generic one.
- Author at most one curveball per type, in `curveballs` (up to six): a call looks a curveball up by its type. When a call chooses none, the default set for its difficulty is the first authored ones, in file order, that the difficulty allows, so put the most representative one first.
- A `trigger` says when it may fire: an earliest turn, optionally a latest turn, a minimum temperature, an unacknowledged impact, unclear ownership, or a discovered fact (`afterFact`, which must be a hidden fact id). Whatever the trigger, a curveball does not come on a turn that ends the call, and one that has not come up by then is dropped for that call, even past its latest turn ([customer-realism.md](customer-realism.md#curveballs)).
- `statement` is in the customer's voice. `expectedResponse` says what a strong response looks like, for coaching.

## Coaching grounding

This section is about the author's notes for coaching. It has nothing to do with the `grounding` provenance record described below, which no evaluator and no prompt reads.

- `careExpectations` lists, for each CARE principle, one to four things a good call looks like for this case, as observable behaviour. The evaluator reads them to say what the case needed. See [care-cbcf-rubric.md](care-cbcf-rubric.md#what-the-scenario-expected).
- `evaluatorNotes` states the root cause (plausible, not confirmed on the call) and what a strong call does.
- `poorApproaches` are at least two things that would make this customer more upset. Be specific to the scenario.
- `successCriteria` and `goodBehaviours` are observable behaviours, not generic advice.
- `coachingFocus` names the one to three skills the scenario is meant to practise. The scenario details show it as "Coaching focus", and the report uses it to suggest the next scenario to practise for a skill: one whose focus includes that skill, closest to the suggested difficulty and not the one just played while another fits (`pickScenario` in `server/evaluator/parts.ts`).

**Text that reaches the trainee after the call.** A fact's `missedConsequence` is shown in the report as "Why it mattered" for a fact that was missed or only partly found, and in an improvement's risk (`discoveryResult` in `server/evaluator/parts.ts`, `improvements.ts`). A curveball's `expectedResponse` follows "A stronger response:" (or "A strong response:") in the unexpected turn's assessment (`buildCurveball` in `parts.ts`). The report speaks to the trainee as "you". So it turns "the engineer" and the verbs after it into "you" where it knows the verb: "The engineer never learns ..." reads "You never learn ..." (`inYourVoice` in `web/src/features/report/copy.ts`, tested in `copy.test.ts`). A sentence with a verb it does not know is left as written, in the third person. Write these lines about "the engineer", as the library does, with an ordinary verb of a support call, and read how a new sentence comes out in the report.

## Personas

Use varied, realistic, respectful personas. Avoid stereotypes. A persona's `voice` describes how they talk (pace, formality, habits), never their ethnicity, accent or background. Persona names must be unique across the library: validation fails if two scenarios share one.

For a non-native English speaker, write the customer's lines in clear, simple, natural English. Never imitate an accent, never write broken or comic English, and never make the language itself part of the problem. Coaching must never mark a trainee or a customer down for language style.

## Product-claim lint

Customers describe symptoms. The validator searches every piece of text in a scenario, including `grounding.notes` (ids, intent lists and the case number are skipped), and rejects:

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

## Provenance (`grounding`)

Every scenario carries `grounding`, an internal record of where it came from and how far it was checked. It is for authors and reviewers, and it is required: a scenario without a valid one does not load.

**It is never shown.** `toPublicScenario` (`server/services/dto.ts`) has no field for it, so it is not in the public scenario (`PublicScenarioDTO`). The effective scenario that a call snapshots does not carry it either, so it is not in the scenario view of a saved call. Apart from the schema (`shared/domain/scenario.ts`), the library files and the test fixtures, the only code that refers to it is the product-family check, the table the validator prints and the logger's list of names to drop (`server/scenarios/index.ts`, `server/scenarios/provenance.ts`, `server/log.ts`): no prompt builder, evaluator or engine file refers to it, so no model is sent it. The logger drops its field names from every log line, even when a caller passes them. Tests check this:

- `server/scenarios/library.test.ts` walks the public scenario and the effective scenario of every scenario in the library and fails if a provenance field turns up (`provenanceLeaks` in `server/scenarios/provenance.ts`).
- `server/http/api.test.ts` ("scenario provenance stays internal") calls the API for every scenario (the list, the scenario, a new call, the saved call, its transcript and its closing check) and, for one finished call, its session and its report. It fails if any of those bodies or any log line holds a provenance field name or one of the allowed values, such as `microsoft-learn` or `assistant-reviewed`.
- `server/scenarios/provenance.test.ts` checks that the logger drops the field names, that loading the library prints nothing (an error names the wrong field and never repeats what was written in it), and that none of those values occurs as an ordinary word in what a trainee reads.

| Field                | What it says                                                                                                                                                                                                                                                                                                                                                                                      |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `authoredOn`         | When it was written: `YYYY-MM-DD`, a real calendar date.                                                                                                                                                                                                                                                                                                                                          |
| `revisedOn`          | Optional. When it was last revised. Not before `authoredOn`.                                                                                                                                                                                                                                                                                                                                      |
| `productFamily`      | `microsoft-365`, `windows`, `azure` or `dynamics-365`. It must be the family of the scenario's `product`, which the validator checks.                                                                                                                                                                                                                                                             |
| `sourceCategories`   | One to five of `microsoft-learn`, `microsoft-support`, `product-blog`, `tech-community` and `author-experience`, each once. List only categories that were actually used. `author-experience` is the author's own knowledge of how support calls go: it is not a source about the product.                                                                                                        |
| `behaviourCheck`     | `not-checked`, `checked-partly` or `checked-current`: whether the product wording and the symptom the customer reports were checked against current public pages. `checked-current` means at least one current, dated, official page directly supports the behaviour and the product terms used. `checked-partly` means some of it is supported and some could not be confirmed. Be conservative. |
| `checkedOn`          | When that check was made. Required unless `behaviourCheck` is `not-checked`.                                                                                                                                                                                                                                                                                                                      |
| `syntheticConfirmed` | Always `true`: the people, organisations, numbers and case reference are all invented.                                                                                                                                                                                                                                                                                                            |
| `review`             | `unreviewed`, `assistant-reviewed` (an AI assistant read it) or `mentor-reviewed` (a mentor read it). No record says `mentor-reviewed` today.                                                                                                                                                                                                                                                     |
| `notes`              | Optional, at most 300 characters. What the check or the review rested on, in your own words. No web addresses, no internal links and no real names: the product-claim lint rejects the first two.                                                                                                                                                                                                 |

Nothing here has a default, so a record cannot claim more than someone wrote. A new scenario starts as `behaviourCheck: 'not-checked'`, `review: 'unreviewed'` and `sourceCategories: ['author-experience']`, with `authoredOn` set to the day it was written. Raise a value only when the work was done.

**What the validator enforces on a record** (`GroundingSchema` in `shared/domain/scenario.ts`, and `semanticIssues`). A record that breaks any of these does not load:

- every field except `revisedOn`, `checkedOn` and `notes` is required, and none has a default;
- `authoredOn`, `revisedOn` and `checkedOn` are real calendar dates in `YYYY-MM-DD` form (`2026-02-30` fails), and `revisedOn` is not before `authoredOn`;
- `sourceCategories` holds one to five of the five allowed values, none twice;
- `syntheticConfirmed` is exactly `true`;
- once `behaviourCheck` is `checked-partly` or `checked-current`, `checkedOn` is needed and `sourceCategories` must include at least one public category: a check against `author-experience` alone fails;
- `checked-current` and `mentor-reviewed` need `notes`, so neither can be left in by default;
- `notes` is at most 300 characters, and the product-claim lint reads it like any other text, so a web address in it fails;
- `productFamily` is the family of the scenario's `product`.

For example, the validator prints lines like these, one for each defective record:

```
outlook-shared-mailbox-missing: grounding.notes: notes are needed to say which public pages showed the behaviour is current
outlook-shared-mailbox-missing: grounding.productFamily "azure" is not the family of outlook ("microsoft-365")
outlook-shared-mailbox-missing: grounding.sourceCategories: a behaviour check needs at least one public source category
```

### Where the grounding came from

**The internal wiki was not used.** The Microsoft internal supportability wiki was not available to this project's tooling, so no scenario is grounded in it. Nothing from it is copied or paraphrased into a scenario, and no internal link or internal resource name belongs in one.

**The sources are public documentation categories.** A record names categories, not pages (a web address in a note is rejected). At the time of writing all 16 records list `microsoft-learn`, six of them with `microsoft-support`, and none lists `product-blog`, `tech-community` or `author-experience`. A note describes the topics of the pages that were read (for example "current public pages on creating a shared mailbox, removing automapping and shared mailbox settings in new Outlook") and what the review changed.

**The review of 22 November 2026 was an assistant's, not a mentor's.** An AI assistant read every scenario against current public Microsoft pages and revised the wording it could not stand behind (the comment in `server/scenarios/library.test.ts` says so). That is why every record says `review: 'assistant-reviewed'` and ends its note with "AI-assisted review, not a mentor's." The commit message `fix: ground the scenario wording in current public Microsoft guidance` lists what it looked at: terminology, whether the customer's report and the case's story are plausible, what a person in that role would know, impact and stage realism, curveball fit, public text that gives away a hidden fact, and data safety. It recorded 11 scenarios as `checked-current` and 5 as `checked-partly`: `windows-11-slow-after-update`, `teams-cannot-join-external-meetings`, `m365-apps-excel-crashes-after-update`, `intune-devices-not-compliant-closure` and `dynamics-records-not-visible-after-role-change`. The notes say what it changed ("customer claims hedged, impact wording made neutral"; "low-impact text made neutral so it no longer gives away the workaround") and what it could not confirm ("The exact policy mechanism is not verified."; "The offline-laptop explanation stays a hypothesis"; "not tried in a live system"). `library.test.ts` also looks for three phrases the review found in the brief, the title or the opening impact lines: "sending requests by hand", "emailing the commissioning editor" and "genuine supplier invoices".

**The verdicts are pinned.** `library.test.ts` holds a table of the check level, the dates, the sources and the closing words of the note for each of the 16 scenarios, and fails if a record differs. Changing a record, including raising one to `mentor-reviewed`, means changing that test on purpose.

**What a record does not say.** `checked-current` says that a current, dated public page supported the wording on the date in `checkedOn`, and nothing about later dates. No record says that a scenario's story was reproduced on a live service, and the root cause in `evaluatorNotes` is the scenario's own story, not a confirmed product behaviour.

`npm run validate:scenarios` prints one line for each scenario (`id`, family, `authoredOn`, `behaviourCheck`, `review`) and fails when a record is missing or invalid (see [Validate and test](#validate-and-test)).

## Researching a scenario

Work through these steps before you add or revise a scenario. The application is a conversation simulator: a scenario must never become a troubleshooting-answer repository.

1. Identify the product family.
2. Retrieve current public support guidance (see below).
3. Identify the broad support-conversation situation.
4. Identify what a customer would realistically know.
5. Identify what the customer may misunderstand.
6. Define the synthetic business impact.
7. Define reasonable hidden facts.
8. Define what the customer does not know.
9. Define one appropriate curveball.
10. Define the expected CARE behaviours (`careExpectations`).
11. Map CBCF only when authoritative CBCF material is available. None is, so `cbcfBehaviours` stays `[]`.
12. Have the scenario reviewed for realism and data safety, and record who reviewed it in `review`: `assistant-reviewed` for an assistant's review, `mentor-reviewed` only for a person's, with `notes` saying what was read.
13. Add automated behaviour checks. The library tests cover every scenario; add a case when a scenario needs one of its own.
14. Add the scenario to the application only after it validates (`npm run validate:scenarios` and the tests below).

For step 2, use current public Microsoft material only: Microsoft Learn, Microsoft Support, product blogs and the Microsoft Tech Community. Prefer a page with a visible last-updated date, and treat a retired or archived page as history, not as current behaviour. Use a source to understand the situation, the terms, the impact and the stage of a case, never to copy its text and never to put a product claim in the scenario (see [Product-claim lint](#product-claim-lint)). The internal supportability wiki is not available to this project, so it is not a source (see [Where the grounding came from](#where-the-grounding-came-from)). Where no current public page supports a statement, leave it out, or write it as the customer's belief or a possible cause, and record `checked-partly` rather than `checked-current`. Record the categories you used in `sourceCategories` and the outcome in `behaviourCheck`. Never use a real case, customer, tenant, log or screenshot. Use no internal link in the product, and no secret anywhere.

An assistant can read the pages and compare the wording, but it is not a mentor: record `assistant-reviewed`, say so in the note, and keep `mentor-reviewed` for a mentor's review. When a mentor has reviewed a scenario, set `review: 'mentor-reviewed'`, say in `notes` what was reviewed (it is required, at most 300 characters, with no real names or links), set `revisedOn` if the wording changed, and update the verdict pinned in `server/scenarios/library.test.ts`, which today expects `assistant-reviewed` and a note that ends "AI-assisted review, not a mentor's."

### What a reviewer should still check

The validator and the tests find what a machine can find: a leaked fact, a banned pattern, a record that claims too much. They cannot tell whether a story is true or sounds like a real case. After an assistant's review, a mentor, or another person who handles these cases, should still check:

- **The product terms and the reported symptom, against the page as it is now.** `checked-current` was true on the date in `checkedOn` and no later, and public pages change.
- **The parts a note says were not confirmed.** The five `checked-partly` scenarios say what could not be confirmed, and the root cause in each scenario's `evaluatorNotes` is the scenario's own story, not a confirmed product behaviour.
- **What the customer would know.** That a person in this role knows what the customer says, does not know what they say they do not, and could misunderstand what the scenario says they misunderstand.
- **That nothing real slipped in.** The validator cannot tell a real organisation or person from an invented one. The review of 22 November 2026 removed a real company name from the background of one persona (`azure-vm-unreachable-production`).
- **Hidden facts and feel.** That each hidden fact is reachable through a sensible question and that every line sounds human, tone-neutral and respectful. The tests check shape (numbers, wording copied from a hidden fact, banned patterns), not whether a line sounds like a customer.
- **Impact, stage and curveballs.** That the impact, the deadline and the curveball fit the call stage and the difficulty, at each of the three impact levels a trainee can choose.
- **The id and the short title.** Both are public, and nothing checks the id against the hidden facts.

## Validate and test

```
npm run validate:scenarios                                          # the whole library
npm run validate:scenarios -- server/scenarios/library/<id>.ts      # one or more files
```

The command loads the scenarios through the same loader the server uses (`loadScenarios`) and prints, in this order:

1. `Scenarios loaded: N`.
2. A coverage summary: how many scenarios use each difficulty, impact, starting temperature, proficiency, communication style, call stage and issue type.
3. The provenance table under the heading "Provenance (internal, never shown to trainees)": one line for each scenario with its id, product family, `authoredOn`, `behaviourCheck` and `review`.
4. `All scenarios are valid.` and exit status 0, or `N problem(s):` followed by one line for each problem, on standard error, and exit status 1.

This is the real output for the library at the time of writing, with all but the first three provenance lines left out:

```
Scenarios loaded: 16
  difficulty : starter=4  standard=8  challenge=4
  impact     : low=3  medium=8  high=5
  temperature: calm=7  anxious=3  frustrated=4  angry=2
  proficiency: novice=4  intermediate=8  expert=4
  style      : talkative=3  terse=4  demanding=5  vague=3  non-native=1
  stage      : first-contact=9  follow-up=3  escalated=2  closure=2
  issue type : sign-in-access=1  permissions=3  service-outage=2  slow-performance=1  data-missing=1  billing-licence=1  how-to=0  feature-not-working=3  setup-deployment=2  policy-security=2

Provenance (internal, never shown to trainees)
  id                                              family         authoredOn  behaviourCheck   review
  outlook-shared-mailbox-missing                  microsoft-365  2026-11-21  checked-current  assistant-reviewed
  onedrive-sync-closure                           microsoft-365  2026-11-21  checked-current  assistant-reviewed
  power-automate-approvals-stopped                microsoft-365  2026-11-21  checked-current  assistant-reviewed
  ...

All scenarios are valid.
```

A scenario with no provenance record fails like this (the fixture `server/scenarios/testing/without-provenance.ts`):

```
1 problem(s):
  outlook-shared-mailbox-missing: grounding: Invalid input: expected object, received undefined
```

**What it checks.**

- The schema in `shared/domain/scenario.ts`: types and limits, the fact counts, ids that are unique across the fact classes and the curveballs, what each difficulty must offer, the allowed curveballs, the shape of `shortTitle` and the whole provenance record.
- Across the scenarios it loads: no scenario id, persona name or short title used twice.
- `semanticIssues`: the short-title rules, that `grounding.productFamily` is the family of the product, no `previousContact` on a first-contact scenario, no hidden fact repeated in anything shown or said earlier (by number or code, by copied wording, or in a hint), `partialIntents` with a `partialStatement`, the [product-claim lint](#product-claim-lint) over every text including `grounding.notes`, an authored curveball for each allowed type that has no generic one, a `caseReference`, a critical or important hidden fact at every difficulty, a known fact that answers `problem_description` at every call stage, and a non-empty `coachingFocus`.

**What it does not check.** Whether anything a scenario says about a product is true. Whether `sourceCategories`, `behaviourCheck` and `review` describe work that was really done. Whether the id leaks a hidden fact. Whether the story is realistic. See [What a reviewer should still check](#what-a-reviewer-should-still-check).

When you name files, the checks across scenarios see only those files, so run the whole library before you finish.

Then run the tests that read the library:

```
npx vitest run server/scenarios scripts server/engine/library.test.ts server/evaluator/realLibrary.test.ts
npx vitest run web/src/features/scenarios/behaviour.test.ts web/src/features/scenarios/card-library.test.tsx web/src/features/tips/tips.test.ts shared/domain/duration.test.ts
```

- `server/scenarios/library.test.ts` is the library as a whole:
  - it loads with no errors, and covers the four product families, every product in `PRODUCT_IDS` and the range of settings (every difficulty, starting temperature, style, call stage, impact and proficiency, more than two scenarios at each difficulty and at least eight issue types);
  - persona names, case references and short titles are distinct, case references have the `SIM-000000` form, and no scenario holds an email address, a link or a phone number;
  - the first ground rule is the fixed line and no ground rule calls a product fictional, every scenario has its fact classes, its CARE expectations and an empty CBCF list, the word CBCF is in none of its text, and each follow-up, escalated and closure opening is at most 60 words and three sentences;
  - **the grounding review**: each of the 16 records matches the verdict of 22 November 2026 (the dates, `assistant-reviewed`, the check level, the sources, `syntheticConfirmed` and a note that ends "AI-assisted review, not a mentor's.");
  - what a trainee can read stays inside the word budgets, carries no word or number of a hidden fact at any impact level, holds none of the three flagged phrases, keeps the executive-presentation wording out of fields that do not depend on the impact level, and shows the case details that the Azure deployment follow-up tells the trainee to read;
  - every hidden fact's `revealWhen` avoids "looks after", "look after", "manages" or "owns" followed straight by "who", "what" or "which", so that it still reads once the coaching turns "Asks ..." into advice (see [Hidden facts](#hidden-facts));
  - every scenario has a short title of two to six words that no other scenario uses, and no provenance field is in the public scenario or in the effective scenario that a call snapshots;
  - configuring a call follows the chosen impact and call stage and offers only the curveballs a scenario allows;
  - the checks themselves accept every scenario and reject a hidden fact repeated by wording or by number, a hint that gives away another fact, a product claim (a KB number, an error code, a web address, a cmdlet, a version, a menu path or a phone number), a bad short title, a repeated persona name or short title, a curveball outside the allow-list, a missing case reference, a previous contact on a first-contact scenario and a missing product, stage opening, allow-list, short title or record.
- `server/scenarios/provenance.test.ts` is the record: an honest first record is accepted and nothing defaults; dates are real and in order; source categories are one or more, each once; `syntheticConfirmed` is exactly `true`; a check needs a date and a public source; `checked-current` and `mentor-reviewed` need notes; a record is required of every scenario and the error names the wrong field; the family must match the product; a web address in the notes is rejected; the table the validator prints has one aligned line for each scenario; the logger drops the field names; loading prints nothing; and no allowed value occurs as an ordinary word in what a trainee reads.
- `scripts/validate-scenarios.test.ts` runs the real command: it passes the library and prints one provenance line for each scenario, and it fails the fixture `server/scenarios/testing/without-provenance.ts`, a real scenario with its record taken away, naming the field.
- `server/http/api.test.ts` ("scenario provenance stays internal") calls the API for every scenario and checks that no response and no log line holds a provenance field or value (see [Provenance](#provenance-grounding)).
- `server/engine/library.test.ts` plays the customer against every scenario in every stage: the opening, the case notes, whole scripted calls, a plain style for a non-native customer, and a sweep in which every curveball is due on the closing turn.
- `server/evaluator/realLibrary.test.ts` runs the evaluator against every scenario, with a good call and a poor one for each.
- `web/src/features/scenarios/behaviour.test.ts` runs the real library through the page's settings. It names no scenario and reads no text, so it follows the library when it changes.
- `web/src/features/scenarios/card-library.test.tsx` draws every real card: a short title of two to six words, at most eighteen words on a card, no summary on a link card and no two cards with the same title.
- `web/src/features/tips/tips.test.ts` reads every tip against the whole library (see [Hints, areas to explore and tips](#hints-areas-to-explore-and-tips)).
- `shared/domain/duration.test.ts` checks the estimated range for every length a scenario may state.

The tests cover what a machine can check. After the file validates, read it once more as a customer would: is every hidden fact reachable only through a sensible question, and does each line sound human? Then go through [What a reviewer should still check](#what-a-reviewer-should-still-check).

## Adding a scenario

1. Research it (see [Researching a scenario](#researching-a-scenario)), then create `server/scenarios/library/<id>.ts`, default-exporting an object that satisfies `ScenarioInput`, with a `shortTitle`, an `estimatedMinutes` and a `grounding` record. A new record starts as not checked and unreviewed (see [Provenance](#provenance-grounding)): raise it only for work that was done. Make `npm run validate:scenarios -- server/scenarios/library/<id>.ts` pass.
2. Import it in `server/scenarios/index.ts` and add it to `LIBRARY_INPUT`, easiest first (Starter, then Standard, then Challenge). `GET /api/scenarios` returns the list in that order. The scenarios page orders the cards itself (see [What each screen draws](#what-each-screen-draws)).
3. Run `npm run validate:scenarios` for the whole library, then the tests above. They tell you if a hidden fact cannot be found, leaks, or collides with another scenario's persona name or short title, and if a tip now uses a word that one of your hidden facts uses.
4. Play it once in the app in demo mode, as a trainee would: find its card in Scenarios and check the short title and the estimated range, choose "Start configuration", read the case brief, start a typed call ("Start a text-only call", or "Start text call" where the browser cannot hold a voice call), and end it to read the report.
5. Update the scenario table in the [README](../README.md#scenarios) if you want it listed there.

To retire a scenario, set `enabled: false` or remove it from the registry. Calls already started on it keep working (see [customer-realism.md](customer-realism.md#old-calls-and-retired-scenarios)).
