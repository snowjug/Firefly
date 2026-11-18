# How Firefly scores a practice call

This page is for trainers and mentors. It describes what the coaching report looks at, exactly how the
built-in rules evaluator turns a call into scores, what counts as evidence, what is never penalised, and
where automatic scoring stops being reliable.

Firefly's scores are **coaching feedback on a practice call with an invented customer**. They are not an
assessment of a person's performance, and nobody should use them as one. A mentor reading the transcript
will often see things the report cannot.

- Evaluator: `Firefly rules evaluator`, version `rules-1.0.0` (code: `server/evaluator/`)
- Rubric version: `rubric-1`
- When a live model writes the judgement instead, the server still verifies it. See
  [When a model writes the evaluation](#when-a-model-writes-the-evaluation).

## What the evaluator is given

- The transcript, with a number on every turn. Turn 1 is the customer's opening. Trainee turns are the
  even numbers.
- For each trainee turn, a **classification**: what the trainee did in that turn (greeted, showed
  empathy, acknowledged the impact, took ownership, gave next steps, made a promise, blamed, used
  jargon, summarised, wrapped up, and so on), with short quotes as proof.
- The hidden facts the trainee found, partly found or missed.
- Every recorded change in the customer's state (temperature, trust, patience and others), each with the
  turn that caused it and a short reason.
- The scenario settings: impact, customer proficiency, call stage, difficulty, curveballs.

The scores come from the classifications and the recorded state changes, not from an opinion formed by
re-reading the messages. The evaluator reads the wording itself in a few places where a classification
does not say enough:

- in the first two turns, whether the trainee gives a name or role, asks an open question or confirms
  why the customer called, and (on follow-up and escalated calls) mentions the history or the wait;
- whether a next step names a time;
- whether the last turn says thanks or goodbye.

Those checks look for plain phrases and ignore grammar, spelling and length. No score depends on how
long, formal or polished a message was.

## Scores

| Score | Label            | Meaning                                                    |
| ----- | ---------------- | ---------------------------------------------------------- |
| 1     | Not demonstrated | Critical behaviours were absent or counterproductive.      |
| 2     | Emerging         | Some attempt was made, but major gaps affected the call.   |
| 3     | Developing       | Core behaviour was shown inconsistently.                   |
| 4     | Strong           | Behaviour was effective, specific and appropriate.         |
| 5     | Excellent        | Behaviour was consistent, adaptive and backed by evidence. |

Every score is a whole number from 1 to 5. The overall score is the mean of the six, rounded to one
decimal place. There is no overall score when the call was too short to judge (see
[Evidence rules](#evidence-rules)).

## The six dimensions

Dimensions are mapped loosely to four CARE behaviours (communicate, be accountable, be resourceful, be
empathetic). That mapping is a working aid for coaching conversations, not an official standard.

### 1. Opening & Rapport

Looks at the **first two trainee turns**. Starts at 1.

| Add or remove | When                                                                                                                             |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| +1            | The first turn greets, introduces or offers help.                                                                                |
| +1            | The trainee gives their name, role or team, or explicitly offers help.                                                           |
| +1            | An open question (one that cannot be answered yes or no) or invitation to explain, or a confirmation of why the customer called. |
| +1            | Empathy or an acknowledgement of the impact. See the stage notes below.                                                          |
| −1            | The first turn goes straight into troubleshooting instructions without inviting the story, or blames or dismisses.               |

Stage notes: on a follow-up or escalated call, acknowledging the history or the wait also earns the
empathy point. On a closure call, confirming the purpose of the call also earns it.

### 2. Scoping & Discovery

Starts from the share of hidden facts found, weighted by importance (critical 3, important 2,
helpful 1). A partly found fact counts half.

| Weighted share | Score |
| -------------- | ----- |
| 85% or more    | 5     |
| 65% to 84%     | 4     |
| 40% to 64%     | 3     |
| 20% to 39%     | 2     |
| under 20%      | 1     |

Then −1 for each of: fewer than three **core topics** asked about (what is happening, when it started,
recent changes, who is affected, business impact, the exact error, what was already tried,
environment); two or more repeated questions; fixes offered before the problem was understood. The
score stays between 1 and 5.

Evidence: the questions that revealed facts.

### 3. Empathy & De-escalation

Starts at 2.

| Add or remove | When                                                                                                       |
| ------------- | ---------------------------------------------------------------------------------------------------------- |
| +1            | At least one turn with **specific** empathy (tied to what the customer said), or two general ones.         |
| +1            | The impact was acknowledged at least once.                                                                 |
| +1            | The customer ended 8 or more points cooler than they started, or at 30 or below with nothing harmful said. |
| −1 per turn   | A turn blamed or dismissed the customer (at most −2). A turn that does both counts once.                   |
| +1 or −1      | A curveball was resolved (+1) or went unresolved (−1). A curveball still open at the end changes nothing.  |

A **5** also needs two or more specific-empathy turns, nothing harmful, and a final temperature no
higher than the start. Otherwise the score is held at 4.

The rationale lists the turns with specific and general empathy, the turns that acknowledged the
impact, and how the temperature moved over the whole call in words ("eased a lot, from Angry at the
start to Concerned at the end"), and says so when that counts as calming the customer.

### 4. Clarity

Starts at 3.

| Add or remove | When                                                                                                    |
| ------------- | ------------------------------------------------------------------------------------------------------- |
| +1            | Two or more turns were clear, or at least one turn summarised.                                          |
| +1            | There was a summary, no unexplained jargon and no unclear turns.                                        |
| −1 per turn   | Unexplained jargon, for a **novice** customer (at most −2).                                             |
| −1            | Unexplained jargon in two or more turns, for an **intermediate** customer. One such turn costs nothing. |
| −1            | Two or more turns were hard to follow.                                                                  |

Jargon is not penalised for an **expert** customer. A one-word reply such as "ok" is never counted as
unclear.

The written rationale describes only what was seen: a recap, a technical term put into plain words,
unexplained terms, replies that were hard to follow. It never counts "clear" turns ("1 of your 5 turns
was clear" would wrongly suggest the other four were unclear), and when no recap happened it says that
there was no recap before the call ended.

### 5. Ownership & Next Steps

Add up points, then convert.

| Points | When                                                                     |
| ------ | ------------------------------------------------------------------------ |
| +2     | Clear ownership at least once (+1 if only vague).                        |
| +2     | Specific next steps at least once (+1 if only vague).                    |
| +1     | The next contact was confirmed.                                          |
| −1     | Per promise that could not be verified, such as a fix time (at most −2). |

| Total points | Score |
| ------------ | ----- |
| 0 or less    | 1     |
| 1            | 2     |
| 2 to 3       | 3     |
| 4            | 4     |
| 5 or more    | 5     |

### 6. Closing

Starts at 1 and adds a point for each of the following. The ending carries the weight.

| Point | When                                                                                         |
| ----- | -------------------------------------------------------------------------------------------- |
| +1    | Summarised or wrapped up what was agreed, in the **last two** trainee turns.                 |
| +1    | Confirmed the next contact, or gave a specific next step with a time, in the last two turns. |
| +1    | Checked for anything else, or whether the customer was comfortable, in the last two turns.   |
| +1    | Closed politely (thanks, goodbye, take care) in the **final** turn.                          |

A summary or a confirmed next contact made **earlier** in the call counts half, because agreements
still need to be confirmed at the end. Half points are rounded down when added up. A "thanks" in the
middle of the call, or "thanks for calling" in the greeting, is not a polite close.

If nothing like this happened, the score is 1 and the report says the call ended without a summary or
confirmation of next steps.

## Evidence rules

- **Every quote is checked.** A quote in the report is a short, word-for-word part of the trainee turn
  it points to (ignoring capital letters and punctuation), usually one sentence and never longer than
  about 160 characters. If a recorded quote is not really in the turn, the evaluator uses a sentence
  from the turn instead, or leaves the point out.
- **No high score without evidence.** A 4 needs at least one quoted example and a 5 needs at least two.
  If the quotes are missing, the score is held down and the report says so.
- **No invented facts.** What the report says about the customer's reaction comes only from the
  changes that were recorded for that turn. If nothing was recorded, the report does not describe a
  reaction.

### How the report describes the customer

The simulation keeps the customer's temperature, trust, patience and confidence on a scale from 0 to 100. Those numbers are internal and mean nothing to a trainee, so **no number of that kind appears in
any report text** (summary, rationales, guidance, strengths, improvements, journey reasons, curveball
assessment). The timeline chart still draws them as bands. The text uses the five band names and the
size and direction of the change:

| Change in temperature (points) | Wording                                                    |
| ------------------------------ | ---------------------------------------------------------- |
| 4 or fewer, up or down         | Not mentioned at all in a strength, risk or curveball note |
| Down by 5 to 9                 | "eased a little"                                           |
| Down by 10 to 19               | "eased noticeably"                                         |
| Down by 20 or more             | "eased a lot"                                              |
| Up by 5 to 9                   | "rose a little"                                            |
| Up by 10 or more               | "rose sharply"                                             |

Trust, patience and confidence use "rose a little", "rose noticeably" (10 or more), "rose a lot" (20 or
more), "fell a little" and "fell sharply" (10 or more), and nothing for a change of 4 or fewer. When the
band changed, it is named in brackets: "Declan's temperature eased a little (Angry to Frustrated)". For
the whole call, Empathy says how far the temperature moved between the start and the end ("eased a lot,
from Angry at the start to Concerned at the end") or that it "held steady". Only the size and direction
of what a behaviour caused are described, never a number. A reason on the journey chart that would print
a raw value is left out, and a small count in it is written as a word ("after three replies").

### How firm each score is

| Trainee turns | Evidence for each dimension | Overall score |
| ------------- | --------------------------- | ------------- |
| 5 or more     | sufficient                  | shown         |
| 3 or 4        | limited                     | shown         |
| 0 to 2        | insufficient                | not shown     |

Closing is judged on how a call ends. If a call was ended before any closing behaviour appeared (no
recap, no confirmed next contact, no check for anything else, no goodbye), Closing is at most `limited`,
and `insufficient` with three trainee turns or fewer, because the call stopped before the point where
closing could be judged. The score is still 1 and says so.

With limited or insufficient evidence, the report says so in plain words, and says it reflects only what
was said. With two trainee turns or fewer it also does not call out things that never happened (no
summary, no next steps, a missed fact), because the call was too short for them to appear. A call with no
trainee turns scores 1 everywhere with "insufficient" and nothing else.

A call that ends before a natural close is marked `ended-early`. Its report is based on what was said.

## What else the report contains

**Strengths (up to three).** Only behaviours with a quote: a question that uncovered a critical or
important hidden fact, clear ownership, acknowledging the impact, specific empathy, a summary or recap,
a specific next step, honest limits on a promise, a confirmed next contact, a check for anything else,
a gentle test of a belief the customer holds, a technical term explained, a good opening. They are
chosen from different dimensions where possible, and ranked by how much they helped, using the recorded
change in the customer. A turn that also blamed or dismissed the customer is never praised. If there
is nothing to praise, there are no strengths and the summary says so. The title names the fact when a
question uncovered one; the explanation says why that kind of behaviour helps without repeating it. The
customer's reaction is added in words only when it was big enough to mention (see above).

**Improvements (two or three when the transcript supports them).** Real findings come first, ranked
by harm (the recorded damage to the customer and how low the dimension scored), one per dimension where
possible:

1. Things the trainee said: blame, dismissal, unexplained jargon (novice, or intermediate with two or
   more turns), an unverified promise, fixes before understanding the problem, a repeated question,
   vague ownership or next steps, replies that were hard to follow.
2. Missed or partly found **critical or important facts**. Each has its own better question and what
   missing it cost. Two such facts in one dimension are both shown, because each brings its own question.
   A second point in a dimension already covered is also shown when it is serious (blame after a
   dismissal, say).
3. Gaps the dimension scorers found: no opening greeting, no open question in the first two turns,
   fewer than three areas covered, no ownership or next step, no next contact, no acknowledgement of the
   impact, no empathy (while the customer was upset, when that is the case), no recap, no check for
   anything else, no closing at all.

The list is short only when the transcript supports no more. With five or more trainee turns, a call
with fewer than two real findings gets a **stretch**: a suggestion to build on something it really did,
with a quote of that behaviour (or, for a belief the customer voiced and nobody tested, no quote because
it never happened). A stretch says plainly "Nothing went wrong here". The stretches are: keep the
empathy going (specific empathy came once), check understanding as you go (a recap was given but
clarity was not a 5), say what happens if the next step slips (clear ownership and a confirmed next
contact), ask the customer to say back what was agreed (a recap was given), and test what the
customer assumed (they said something the scenario knows to be mistaken and it was never tested). The
weakest dimension's stretch comes first. Calls with limited or insufficient evidence never get a
stretch. A transcript with only one real finding gets one
improvement.

Each improvement has a quote when something was said (or no quote when something never happened), the
risk for this customer, a suggested line and why it works. The suggested lines come from a template
library filled with the customer's first name, the customer's own words about the impact or deadline
(only if they really said them), the product name and, for a missed fact, the scenario's own better
question. A jargon alternative restates the same sentence in plain words.

**Discovery.** Each hidden fact as found, partly found or missed, with the question that revealed it, what
was hidden (shown only after the call), the better question and the consequence of missing it.

**Customer journey.** The temperature after every trainee turn, from the recorded events (carried
forward when nothing changed). A point is a turning point when the temperature moved by 6 or more or
changed band. A point where a curveball was raised or answered is marked as a curveball, and the last
point as the end. Each point shows the quote and the reason for the biggest change that turn. The
reason is a plain sentence from the engine and never prints a raw value. The chart shows the values as
bands.

**Curveball.** If one fired: what the trainee did in response and whether it was resolved, with the
customer's reaction in words when it was big enough to mention. If it was not resolved, what a
stronger response looks like, taken from the scenario.

**Next practice.** The lowest-scoring dimension (ties go to the scenario's coaching focus, then the usual
order), one concrete action, and a suggested difficulty: one step harder when the overall score is 4 or
more, one step easier when it is 2.5 or less, otherwise the same (no change when there is no overall
score). A scenario from the library that practises that dimension is suggested, preferably a different
one at the suggested difficulty. If every dimension scored 5, the recommendation is a stretch.

**Summary and note.** The summary is two or three natural sentences. The first says what stood out,
with a short quote and, when it was big enough to mention, how the customer reacted ("At turn 2, you
acknowledged what this meant for Declan (“...”), and Declan's temperature eased a little"). With
nothing to praise it says that no single moment stood out as a clear strength. The second gives the single
biggest opportunity as advice about behaviour ("The biggest opportunity is to ask whether every
customer, region or storefront is affected, or whether anything is still working"), with the moment and
the reaction when the behaviour happened at a turn, or "To stretch further, ..." for a stretch. The third
gives the discovery result in plain words and names the most important gap, with its label in lower
case: "You uncovered 2 of the 6 hidden facts and one more in part; the biggest gap was an important fact
(one regional storefront still works)". With limited evidence, the third sentence also says so
plainly ("and with only 4 trainee turns this rests on limited evidence"). With insufficient evidence
the summary says the call was too short to score, gives the discovery count "so far" and names no gap in
what was found. A closing note states that this is automatic practice coaching, names the evaluator and
recommends a mentor's review.

## What is never penalised

Scores never go down because of:

- Short messages, or a terse style.
- Grammar, spelling or punctuation.
- Accent or non-native phrasing.
- A different communication style from the reviewer's own.
- A customer who gave short answers (the customer's style does not change any score).
- A single technical term for an intermediate customer, or any technical term for an expert.

If a classification is wrong about one of these, the score will be wrong too. Please tell the
maintainers (see [Limits](#limits-of-automatic-scoring)).

## When a model writes the evaluation

With a live model provider, the model proposes scores, rationales, evidence, strengths, improvements and a
practice focus. The server then:

1. Rejects the draft if a dimension is repeated or missing.
2. Checks every quote against the trainee turn it cites, drops any that fail, and records a warning.
3. Lowers any score that lacks evidence (a 4 needs one verified quote, a 5 needs two).
4. Marks a dimension `limited` if all of its evidence was dropped, and never lets a model claim more
   certainty than the number of turns allows.
5. Builds discovery, the journey, the curveball assessment, completion, the overall score and the
   difficulty suggestion itself, from the same code as the rules evaluator.
6. Cleans model text of markup before saving it, and drops any sentence that prints a raw customer-state
   value ("trust rose from 40 to 70"), with a warning. A field left empty by that falls back to safe text.

A model can write the words. It cannot change a number the engine recorded.

## Limits of automatic scoring

- The scores are only as good as the classifications. A classifier can miss a way of saying something
  ("I'll unlock it and stay with this" may not be read as taking ownership) or read a sentence too
  generously. Quotes are shown so a reviewer can see what the score rests on.
- Tone of voice, pace and warmth cannot be heard in text. Empathy is judged from what was said.
- The customer is a simulation with a fixed scenario. Behaviours that would be fine with a real customer
  can score low here, and the reverse.
- A short call gives little evidence. That is why short calls say so and give no overall score.
- The rules are simple on purpose so they can be explained. They do not weigh the importance of a single
  moment, such as one badly timed remark in an otherwise strong call, beyond the rules above.
- Scores from different evaluator or rubric versions are not directly comparable. The version is stored
  with every report.
- Agreement between these scores and mentors' scores has to be measured on reviewed calls. Until it has
  been, treat the scores as a starting point for a conversation, not a result.
