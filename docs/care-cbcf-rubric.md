# CARE, CBCF and the scoring rubric

How Firefly turns a practice call into a coaching report: the six skills and their 1 to 5 scores, the CARE behaviours it reads from the call, how a level is worked out, and what it says about CBCF. It describes the code in `server/evaluator/`. Paths start at the repository root.

Firefly's scores are **practice signals from a simulated call with an invented customer**. They are not an assessment of a person's performance, and nobody should use them as one. A mentor reading the transcript will see things the report cannot.

- Evaluator: `Firefly rules evaluator`, version `rules-2.0.0` (`server/evaluator/rules.ts`). A report written with a live model is labelled `Firefly model evaluator`, and its version is the evaluator prompt version, `evaluator-3` (`server/prompts/evaluator.ts`, `server/services/sessions.ts`).
- Rubric version: `rubric-1` (`server/engine/types.ts`). The versions are stored with every report.
- Report versions: `1` and `2` (`shared/domain/report.ts`). A version 2 report always has `care`, `cbcf` and `journey.milestones`. Version 1 reports were saved before CARE was read from the call, and are still readable.
- When a live model writes the judgement instead, the server still checks it. See [When a model writes the evaluation](#when-a-model-writes-the-evaluation).

## What the evaluator is given

- The transcript, numbered turn by turn. Turn 1 is the customer's opening, and the trainee's turns are the even numbers.
- A **classification** of each trainee turn: what the trainee did (greeted, showed empathy, took ownership, blamed, used jargon, summarised and so on), with short quotes as proof.
- The hidden facts the trainee found, partly found or missed.
- Every recorded change in the customer's state, with the turn that caused it and a short reason.
- The scenario settings: impact, proficiency, call stage, difficulty and curveballs.

The scores come from the classifications and the recorded state changes. In a few places the evaluator reads the wording itself where a classification does not say enough, for example whether a next step names a time. Those checks look for plain phrases and ignore grammar, spelling and length.

### Spoken and typed calls

The evaluator reads the transcript and nothing else. A spoken turn reaches it as the words that speech to text produced, and a typed turn as typed. Both are scored by the same rules. Tone of voice, pace, volume and accent are never heard and never scored. Speech to text can mishear words, so the report's transcript is the text that was scored: if a line was misheard, treat a score that rests on it with care.

## Scores

| Score | Label            | Meaning                                                    |
| ----- | ---------------- | ---------------------------------------------------------- |
| 1     | Not demonstrated | Critical behaviours were absent or counterproductive.      |
| 2     | Emerging         | Some attempt was made, but major gaps affected the call.   |
| 3     | Developing       | Core behaviour was shown inconsistently.                   |
| 4     | Strong           | Behaviour was effective, specific and appropriate.         |
| 5     | Excellent        | Behaviour was consistent, adaptive and backed by evidence. |

Every score is a whole number from 1 to 5. The overall score is the mean of the six, rounded to one decimal place. There is no overall score when the call was too short to judge.

## The six skills

The skills carry the numbers. CARE (below) is read separately, from behaviour. Each skill maps loosely to CARE behaviours (`DIMENSIONS` in `shared/domain/vocab.ts`). That mapping is a working aid for coaching conversations, not an official standard.

### 1. Opening and Rapport

Looks at the first two trainee turns. Starts at 1, and each of these adds 1:

- the first turn greets, introduces or offers help;
- a name, role or team is given, or help is offered;
- an open question (one that cannot be answered yes or no), an invitation to explain, or a confirmation of why the customer called;
- empathy, an acknowledgement of the impact, or on a call-back an acknowledgement of the history or the wait (on a closure call, confirming the purpose of the call).

It loses 1 if the first turn goes straight into troubleshooting instructions without inviting the story, or blames or dismisses.

### 2. Scoping and Discovery

Starts from the share of hidden facts found, weighted by importance (critical 3, important 2, helpful 1). A partly found fact counts half.

| Weighted share | Score |
| -------------- | ----- |
| 85% or more    | 5     |
| 65% to 84%     | 4     |
| 40% to 64%     | 3     |
| 20% to 39%     | 2     |
| under 20%      | 1     |

Then 1 point is taken off for each of: fewer than three of the core topics asked about (what is happening, when it started, recent changes, who is affected, business impact, the exact error, what was already tried, environment); repeated questions in two or more turns; fixes offered before the problem was scoped. The score stays between 1 and 5.

The rationale also says how the critical and important facts went, in counts and never as a percentage, for example "and 2 of the 3 that mattered most". It leaves that out when it would only repeat the count of all facts: no fact found, every fact found, or no fact of lesser weight to tell it apart from (`keyFactsClause` in `server/evaluator/parts.ts`, tested in `rules.test.ts`).

### 3. Empathy and De-escalation

Starts at 2.

- +1 for at least one turn of **specific** empathy (tied to what the customer said), or two general ones.
- +1 if the impact was acknowledged at least once.
- +1 if the customer ended at least 8 points cooler than they started, or at 30 or below with nothing harmful said.
- -1 for each turn that blamed or dismissed the customer, at most -2.
- +1 for a curveball that was resolved, -1 for one that went unresolved.

A 5 also needs two or more turns of specific empathy, nothing harmful, and a final temperature no higher than the start. Otherwise it is held at 4.

### 4. Clarity

Starts at 3.

- +1 for two or more clear turns, or at least one summary.
- +1 for a summary with no unclear turns, and either no unexplained jargon or an expert customer.
- -1 for each turn with unexplained jargon for a **novice** customer, at most -2.
- -1 for unexplained jargon in two or more turns for an **intermediate** customer. One such turn costs nothing.
- -1 for two or more turns that were hard to follow.

Jargon is not penalised for an **expert** customer, and a one-word reply such as "ok" is never counted as unclear.

### 5. Ownership and Next Steps

Add up points, then convert.

| Points                | When                                                      |
| --------------------- | --------------------------------------------------------- |
| +2 (+1 if only vague) | Clear ownership at least once.                            |
| +2 (+1 if only vague) | Specific next steps at least once.                        |
| +1                    | The next contact was confirmed.                           |
| -1 each, at most -2   | A promise that could not be verified, such as a fix time. |

| Total points | Score |
| ------------ | ----- |
| 0 or less    | 1     |
| 1            | 2     |
| 2 to 3       | 3     |
| 4            | 4     |
| 5 or more    | 5     |

### 6. Closing

Starts at 1 and adds a point for each of these. The ending carries the weight.

- Summarised or wrapped up what was agreed, in the last two trainee turns.
- Confirmed the next contact, or gave a specific next step with a time, in the last two turns.
- Checked for anything else, or whether the customer was comfortable, in the last two turns.
- Closed politely (thanks, goodbye) in the final turn.

A summary or a confirmed next contact made earlier in the call counts half, and half points are rounded down when added up. A "thanks" in the middle of the call is not a polite close. If nothing like this happened, the score is 1 and the report says the call ended without a summary or a confirmed next step.

## Evidence rules

- **Every quote is checked.** A quote in the report must be a word-for-word part of the trainee turn it cites, ignoring capital letters, punctuation and spacing, and at least three characters long. A quote that is not really in the turn is dropped, and the point it supported becomes something that "never happened".
- **No high score without evidence.** A 4 needs at least one quoted example and a 5 needs at least two. Without them the score is held down and the rationale says so.
- **No invented reactions.** What the report says about the customer's reaction comes only from the changes recorded for that turn.

### How the report describes the customer

The simulation keeps the customer's temperature, trust and patience on a 0 to 100 scale. Those numbers are internal, so no such number appears in any report text (`server/evaluator/mood.ts`). The text uses the five band names and the size and direction of a change.

| Change in temperature (points) | Wording            |
| ------------------------------ | ------------------ |
| 4 or fewer, up or down         | Not mentioned      |
| Down by 5 to 9                 | "eased a little"   |
| Down by 10 to 19               | "eased noticeably" |
| Down by 20 or more             | "eased a lot"      |
| Up by 5 to 9                   | "rose a little"    |
| Up by 10 or more               | "rose sharply"     |

Trust and patience use "rose a little", "rose noticeably" (10 or more), "rose a lot" (20 or more), "fell a little" and "fell sharply" (10 or more).

These sentences are in the report's data. The report page does not show the closing "After this, ..." sentence of a strength or an improvement, because its chart shows bands and not trust or small movements. It shows what the customer said next, quoted from the transcript (the customer's name and "replied", with the turn), and leaves that out when the quote it follows is not backed by the transcript (`Reaction` in `web/src/features/report/Coaching.tsx`, `withoutTrend` in `web/src/features/report/report-model.ts`).

### How firm each score is

| Trainee turns | Evidence for each skill | Overall score |
| ------------- | ----------------------- | ------------- |
| 5 or more     | sufficient              | shown         |
| 3 or 4        | limited                 | shown         |
| 0 to 2        | insufficient            | not shown     |

If a call was ended before any closing behaviour appeared, Closing is at most `limited`, and `insufficient` with three trainee turns or fewer. A call that ends before a natural close is marked `ended-early`. The report then says it rests only on what was said. A call with no trainee turns scores 1 everywhere with `insufficient`.

On the report page a skill shows its rubric word (for example "Strong") only when at least one verified quote backs it. A skill with none is a "first look": its segments are dashed, "first look" stands where the rubric word would be, and the row carries one neutral label, "Limited evidence", for `limited` and `insufficient` alike (`web/src/features/report/Scores.tsx`, `SUFFICIENCY_WORDS` in `copy.ts`).

## CARE

CARE stands for four behaviours the report reads from the call: **Communicate effectively**, **Be accountable**, **Be resourceful** and **Be empathetic**. It is read separately from the six skills, behaviour by behaviour, by pattern matching on what the trainee said (`server/evaluator/care/`). A model never decides a CARE behaviour, a CARE level or a milestone, even when a model writes the rest of the report.

Each behaviour has a stable id, a plain label and one of three statuses: `shown`, `partly` or `not-shown`. A behaviour that is shown or partly shown always carries a quote of the moment, and the report schema rejects one without it. A principal lists at most ten behaviours.

### The behaviours

| Id                                   | What the report looks for                                                                                                                   |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `communicate.greeting`               | A greeting in the first two turns.                                                                                                          |
| `communicate.introduction`           | A name and a team or role in the first three turns. One of the two, or both only later, is partly.                                          |
| `communicate.context-confirmed`      | Confirmed who they were speaking with or which case. On a closure call, the case and why the customer called.                               |
| `communicate.clear-questions`        | Focused questions about the problem in two or more turns.                                                                                   |
| `communicate.active-listening`       | Played back something particular the customer had just said. "I hear you" with nothing of theirs in it does not count.                      |
| `communicate.summary`                | A recap that matches what the customer said. A recap the customer corrected, or with details they never gave, is only partly credited.      |
| `communicate.plain-language`         | Terms put into plain words. Unexplained terms count against the trainee for a novice customer, or in several turns for an intermediate one. |
| `communicate.pacing`                 | One question or step at a time, from three turns on. About the conversation, never about speaking speed.                                    |
| `communicate.confirms-understanding` | Checked the customer had followed after an explanation. On a closure call, that they were happy to close.                                   |
| `communicate.professional-close`     | A polite goodbye in the final turn and a wrap-up in the last two.                                                                           |
| `accountable.ownership`              | A first-person commitment to an outcome, without a hedge. "Someone will look at it" is not ownership.                                       |
| `accountable.expectations`           | Said what the customer should expect. Promising an outcome nobody could know is a harm.                                                     |
| `accountable.no-blame`               | Nothing that says what the customer should have done or whose fault it was.                                                                 |
| `accountable.no-unsupported-promise` | No outcome or time promised that nobody could verify. A promise only to check something is not one.                                         |
| `accountable.next-action`            | A named next action, or an instruction the customer is asked to follow.                                                                     |
| `accountable.named-owner`            | Said who owns the next step, by name or role. Taking it on without giving a name the customer could ask for is partly.                      |
| `accountable.update-time`            | A time for the next update. On an escalated case, a regular cadence.                                                                        |
| `accountable.tracks-commitments`     | A recap of who does what and by when.                                                                                                       |
| `accountable.progress-update`        | On a call-back, what had happened on the case since the last contact.                                                                       |
| `resourceful.logical-investigation`  | Asked about at least three areas of the problem before offering a fix. On a closure call, checked that the fix really works.                |
| `resourceful.scoping`                | Asked who or what is affected and what exactly happens.                                                                                     |
| `resourceful.impact`                 | Asked what the problem is costing the customer, or when it matters.                                                                         |
| `resourceful.environment`            | Asked about the device, app, account or network.                                                                                            |
| `resourceful.recent-changes`         | Asked what had changed before it started. Asking only when it started is partly.                                                            |
| `resourceful.prior-troubleshooting`  | Asked what the customer had already tried.                                                                                                  |
| `resourceful.known-evidence`         | On a call-back, showed awareness of what is already on the case. Otherwise built on something the customer had already said.                |
| `resourceful.escalation`             | Explained what escalating would do and who would pick it up. Needed when the case is escalated or the customer asked for a manager.         |
| `resourceful.no-repeat-questions`    | Did not ask again about something the customer had already answered. A repeat is a harm.                                                    |
| `empathetic.concern`                 | Acknowledged the concern in words tied to what the customer said or to what is at stake. On a call-back, the wait and the history.          |
| `empathetic.business-impact`         | Named what is at stake for the customer's business.                                                                                         |
| `empathetic.respectful-tone`         | No blame, dismissal or impatience. Courtesy is credited when it is there and never required in particular words.                            |
| `empathetic.de-escalation`           | While the customer was upset, a reply acknowledged it or committed to something, and the customer eased.                                    |
| `empathetic.no-dismissive`           | Did not play down the concern or tell the customer not to worry. A dismissal is a harm.                                                     |
| `empathetic.no-robotic-apology`      | Did not repeat the same stock apology or reassurance. Repeating it is a harm.                                                               |
| `empathetic.adapts`                  | Responded to the customer's mood in replies while they were upset.                                                                          |
| `empathetic.remaining-concerns`      | Asked near the end whether anything was still worrying the customer.                                                                        |

### What the checks are strict about

Some traps are deliberate. They are checked in `server/evaluator/care/` and by the CARE tests (`server/evaluator/care*.test.ts`).

- **"I understand" on its own earns nothing.** Empathy earns credit when it is tied to something the customer said or to what is at stake, or when an action follows it. The same sentence said twice, the same lead twice with nothing specific, or three bare phrases is a harm, and it lowers the principal.
- **Ownership must be first person.** "I'll take this on and call you back by 3pm" is ownership. "Someone will look at it soon." is not.
- **An introduction needs a name plus a team or role.** A name alone, or a team alone, is partly. A name is read from the introduction itself ("I'm Sam", "my name is Sam", "this is Sam from support", "Sam speaking"). "I'm Will" and "my name is May" give a name even though will and may are also ordinary words. "I will help you", "may I ask" and "it's May 5th" do not.
- **Reflecting needs the customer's own words.** At least three shared content words, or two with a reflecting phrase.
- **A recap is checked against what the customer said.** One with details the customer never gave is not credited in full.
- **Harms cap a principal.** Blame, a dismissal, impatience, a promise nobody could keep and a repeated question are harms. One keeps a principal from "strong". Two can hold it to "not yet".
- **The same words can be kind.** The classification can flag blame or a brush-off from words alone, so a sentence it flagged is ignored here when it only uses those words kindly or only recalls what was said (`readsAsKindness` and `readsAsRecall` in `server/evaluator/care/lexicon.ts`, used in `care/violations.ts`). "You shouldn't have to chase us" and "You must have been waiting a long time" take the customer's side, and "As I said" recalls what was said, so none of them is held against the engineer. "You should have restarted it", "That was your mistake", "Whatever.", "Just answer the question." and "As I already told you" still are. Blame in the same sentence is never excused, and neither is a modal form after "I'm sorry, but".

### Levels

Each principal gets a level: **strong**, **developing**, **not yet** or **limited evidence**. The level is worked out from its listed behaviours (`server/evaluator/care/levels.ts`):

1. A shown behaviour earns 1, a partly shown one 0.5 and a missing one 0. Behaviours the call stage calls for count double.
2. The level is **limited evidence** when the call was too short (two trainee turns or fewer), when there are no behaviours to judge, or when the call is short (three or four turns) and fewer than two behaviours could be quoted.
3. Otherwise, **strong** needs at least three quarters of the possible credit, at least two behaviours shown, and no stage-required behaviour missing. **Developing** needs at least two fifths. Below that is **not yet**.
4. A harm turns strong into developing. Two harms turn developing into not yet when less than 60 percent of the credit was earned.
5. When the scenario named things this case needed (see below) and none was fully met, a principal cannot be strong. It is developing, so the level and the sentence beside it agree.

Each principal also gets one sentence of about 25 words that says what was shown and what was missing, grounded in this call. Its budget is 32 words.

### Stage-aware coaching

A stage is never marked down for something it does not call for. A behaviour is listed when the stage calls for it, when it was shown, or when something harmful was said. The stage-required (core) behaviours are:

| Stage         | Core behaviours                                                                                                                                                                                                            |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| First contact | Greeting, introduction, clear questions, plain language, pacing, ownership, next action, update time, logical investigation, scoping, impact, environment, recent changes, prior troubleshooting, concern, business impact |
| Follow-up     | Greeting, introduction, context confirmed, pacing, ownership, update time, progress update, known evidence, concern                                                                                                        |
| Escalated     | Greeting, introduction, context confirmed, pacing, ownership, update time, known evidence, escalation, concern                                                                                                             |
| Closure       | Greeting, context confirmed, summary, confirms understanding, pacing, professional close, tracks commitments, logical investigation (the fix was checked), remaining concerns                                              |

On a call-back, the coaching also names what that stage missed: no acknowledgement of the history, no progress update, no explanation of the escalation, no cadence, no check that the fix works, or no check that the customer agreed to close (`server/evaluator/stage-gaps.ts`). A first contact has no stage gaps of its own.

### What the scenario expected

Each scenario lists, for each principle, one to four things a good call looks like, in observable terms (`careExpectations`). The evaluator links each to the behaviours it is about, and the call decides whether it was met. A missing behaviour that the scenario expected carries the note "This case needed: ...". A principal's summary says how many of those things the call met. The wording of an expectation can never earn or lose credit by itself (`server/evaluator/care/expectations.ts`).

## The customer journey

The report carries six milestones (`journey.milestones`), in call order, each "reached" at a trainee turn with a verified quote, or "not reached". They are read from the same detection as CARE, the discovery records and the curveball record, never from a model (`server/evaluator/milestones.ts`). The report page does not draw the six as rows, and it does not show the labels in the table below. Its **Call journey** timeline lists the moments of the call in call order, each with the turn that shows it: Greeting, Issue established, Impact established, Fact found (or Fact partly found), Summary, Ownership, Next steps, Closing, Tension eased or Tension rose, and Unexpected turn. A call that ended early also has a Call ended moment, "After turn N". The moments come from the milestones, the CARE behaviours, the discovery results, the turning points described below and the unexpected turn. A moment is drawn only when the call needed it: the report lists the behaviour behind it, or its milestone applies. One the call never reached says "Not reached". An early one (the greeting, the issue, the impact, discovery) stays where the call would usually have shown it, and a late one (the recap, ownership, next steps and the close) comes after everything that happened, and after the end of the call. On a screen 48 em wide or more the moments are a rail when they all fit in one row (at least 80 px each), and otherwise a list down the page (`web/src/features/report/events-model.ts`, `Timeline.tsx`).

| Milestone               | Reached when                                                                                                         |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Greeting                | A greeting, an introduction or an offer of help in the first two turns.                                              |
| Impact established      | The business impact was acknowledged, or asked about.                                                                |
| Discovery               | A hidden fact was uncovered, or two different topics were asked about.                                               |
| Escalation or curveball | A curveball came and was resolved. "Not applicable" when none came, and "not reached" when it was not resolved.      |
| Ownership               | Clear or partial ownership was shown.                                                                                |
| Closure                 | At least two of: a recap, a time for the next update, a check for anything else, a polite goodbye in the final turn. |

The **Customer experience** section of the report page draws the customer's temperature after each trainee turn as a chart, with every point also in a table ("Show as a table") as its text alternative. Under the chart it says "The customer is simulated, so heights show direction, not exact measurements." (`CHART_FOOTNOTE` in `web/src/features/report/copy.ts`). A point is a turning point when the temperature moved by 6 or more, or changed band. The last point is the end of the call, and any other turn that carried the unexpected turn is marked as that instead (`buildJourney` in `server/evaluator/parts.ts`). When an unexpected turn came, the section also names it, says after which turn it came and whether it was resolved, and links to the turn.

## What else the report contains

- **Strengths** (up to three): only behaviours with a quote. A turn that also blamed or dismissed the customer is never praised.
- **Improvement opportunities** (`improvements`, up to three): real findings first, ranked by harm, each with a quote (or none when something never happened), the risk for this customer, a suggested line and why it works. With five or more trainee turns and fewer than two real findings, the report offers a **stretch** instead and says plainly that nothing went wrong.
- **Better wording** (`betterPhrasing` on an improvement): a suggested rewrite of a quoted line, or of something that was never said. The rules evaluator builds it from templates with slots for the customer's first name, the impact wording, the customer's own words about a deadline (only when they are in the transcript) and the scenario's own better questions. Where the trainee has to supply a detail, a template leaves it in square brackets, and some carry an example update time ("in 20 minutes") (`server/evaluator/phrasing.ts`). In live mode the model drafts it, and the server drops an improvement whose quote is not in the transcript, removes markup and any sentence that gives a raw mood score or names CBCF, and cuts the wording to 45 words (`merge.ts`, `conform.ts`). The report page opens the block with "Wording to try for this call, written by the coaching. Use your own words.", then shows "You said" above "Try", with the words that went struck through and the words that came underlined, and a key for the marks that are drawn ("Struck through: removed", "Underlined: added"). Under "You said" it says "Not said in this call" when the improvement is about something that never happened, and "Insufficient evidence" in place of words the transcript does not back. It is wording to try, not a prescribed script.
- **Discovery review** (`discovery`): how many hidden facts were found, then each fact as found, partly found or missed, with the most important first (critical, then important, then helpful). A found or partly found fact is one line that opens to "You asked" (the question that found it, quoted from the transcript), "The customer answered" (from the transcript) and why it mattered. A missed fact says why it mattered, which is what missing it cost, and offers "A question worth asking" (the fact's better question). What the customer would have said stays behind "Show what the customer would have said", and the report only exists after the call.
- **Unexpected turn** (the engine's curveball), inside Customer experience: what it was, after which turn, what the trainee did and whether it was resolved, with a stronger response when it was not. It is shown only when one came.
- **Next practice**: the lowest-scoring skill, one concrete action, and a suggested difficulty: one step harder when the overall score is 4 or more, one step easier when it is 2.5 or less, otherwise the same. A scenario that practises the skill is suggested from the library.
- **Summary** and **About this report**: a short summary, and a closing note that this is automatic practice coaching and a mentor's review adds what it cannot.

### Word budgets

The text a trainee reads has word budgets, and the last step before a report is saved enforces them (`server/evaluator/words.ts`, `conform.ts`):

| Text                       | Budget                                                         |
| -------------------------- | -------------------------------------------------------------- |
| Summary                    | 45 words                                                       |
| A strength                 | 35 words for its title and why it helped, the title at most 15 |
| An improvement's risk      | 45 words                                                       |
| Better wording             | 45 words                                                       |
| A CARE principal's summary | 32 words                                                       |
| Strengths, improvements    | At most three of each                                          |

## What is never scored

Scores never go down because of:

- accent, fluency or voice: tone, pace and volume are never heard;
- spelling, capital letters, punctuation or harmless grammar;
- non-native phrasing;
- short messages, a terse style, or a style different from the reviewer's own;
- how long the call took, or which provider ran it;
- a customer who gave short answers: the customer's style does not change any score.

CARE tests check this directly (`server/evaluator/careFairness.test.ts`): the same call written in lower case with no apostrophes, with grammar slips, with a short opening, and against a customer who writes in simpler English is judged the same. If a classification is wrong about one of these, the score will be wrong too. Treat that as a bug.

## When a model writes the evaluation

With a live model provider, the model proposes scores, rationales, evidence, strengths, improvements and a practice focus for the six skills. The server then (`server/evaluator/merge.ts`):

1. Rejects the draft if a skill is repeated or missing.
2. Checks every quote against the trainee turn it cites, drops any that fail and records a warning.
3. Lowers any score that lacks evidence (a 4 needs one verified quote, a 5 needs two).
4. Marks a skill `limited` if all its evidence was dropped, and never lets a model claim more certainty than the number of turns allows.
5. Builds discovery, the journey, the curveball assessment, completion, the overall score, the difficulty suggestion, CARE and the milestones itself, from the same code as the rules evaluator.
6. Cleans model text of markup, drops any sentence that prints a raw customer-state number, and drops any sentence that names CBCF.
7. When the call was too short for a full evaluation and the model's summary does not already say so, adds a note to that effect. The model's summary is cut to the 45-word budget less the note, so the note is never cut off the end.

A model can write the words. It cannot change a number the engine recorded, or a CARE behaviour. These steps are tested against fakes (`server/evaluator/merge.test.ts`, `modelPath.test.ts`). A model-written version 2 report was produced for each of the two calls in the limited Gemini smoke check (see [ai-providers.md](ai-providers.md#status-of-each-provider)). That check is not a quality evaluation of the reports, and no other provider has been run.

## CBCF

**No CBCF material was found in this repository or in the files given for this project.** What CBCF stands for, what its categories are and how it is scored are therefore not known here, and nothing in Firefly guesses them. The product does not say it is aligned with, compliant with or scored against CBCF.

What exists instead is a placeholder (`server/evaluator/cbcf-mapping.ts`):

- **A versioned configuration.** `CBCF_MAPPING` has version `0.1.0-pending`, the status `awaiting-authoritative-source`, no source, no call stages and no behaviours.
- **A status in every version 2 report.** The report's `cbcf` object says `awaiting-authoritative-source`, with the mapping version and the note "CBCF mapping is not applied: awaiting authoritative source confirmation." The CARE review of the report page says "Firefly does not map this review to CBCF." and then that note, and the "About this report" section says so in one line ("CBCF mapping is not applied: it is awaiting an authoritative source.").
- **An empty list on every scenario.** The scenario schema allows no `cbcfBehaviours` at all until authorised material exists (`shared/domain/scenario.ts`).
- **No CBCF wording from a model.** A model-written sentence that names CBCF is dropped.

### How a confirmed mapping would be loaded

`loadCbcfMapping` accepts a mapping only if it says `status: "confirmed"` and names its authorised source. It needs:

- a source: its name, a reference to it, who confirmed it and when it was confirmed;
- at least one call stage, each with an id and a label;
- at least one behaviour, each with an id, a label, the stage it belongs to, the CARE behaviours that show it and a description of how it shows in a call.

Anything else is refused with a typed error (`cbcf_not_confirmed`, `cbcf_source_missing` or `cbcf_invalid`), so a half-finished or guessed mapping can never be applied. **Nothing calls it today.** Using a confirmed mapping would also mean extending the report schema, which allows only the pending status, and the evaluator. That is a deliberate change for whoever holds the source. The loader is tested only with made-up mappings (`server/evaluator/cbcf.test.ts`).

## What the rubric cannot do

- **It is not a performance assessment.** It is a practice signal. Do not rank people with it or use it in any employment decision.
- **It is rules-based.** The classifier and the CARE detectors look for patterns in words. They can miss a good way of saying something ("Consider it handled" may not be read as ownership) or read a sentence too generously. Quotes are shown so a reviewer can see what a score rests on.
- **It reads words only.** Warmth, pauses and tone cannot be assessed, even in a spoken call.
- **It cannot read a turn with no Latin letters or digits.** Speech to text in another script, or only an emoji, leaves no sentence to quote. Such a turn is not credited as a recap, and a live classifier flagging it cannot stop the evaluation (`server/evaluator/careRobustness.test.ts`).
- **The customer is a simulation** with a fixed scenario. Behaviour that is fine with a real customer can score low here, and the reverse.
- **A short call gives little evidence.** That is why short calls say so.
- **Scores from different evaluator or rubric versions are not directly comparable.**
- **No comparison with mentors' scores is recorded in this repository.** Firefly includes no tool for making one.

A mentor's review adds what the rubric cannot: judgement about the moment, tone, and what the trainee needs next. Treat the report as a starting point for that conversation, not a result.
