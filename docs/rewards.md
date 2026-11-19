# Rewards

Rewards are a private, explainable way to see that practice is adding up. They encourage three things: practising again, trying different kinds of call, and getting better at a skill. They are not a performance rating. Nothing here ranks you, compares you with anyone, or takes anything away.

The rules are pure functions in `shared/domain/rewards.ts`, covered by tests, so every number can be explained. The server assembles the inputs in `server/services/rewards.ts` and serves the result at `GET /api/rewards`.

## How they are worked out

Nothing is stored. Each time rewards are requested, Firefly reads your saved calls, their coaching reports and any mentor reviews, takes the calls in the order they ended, and works out what each one earned.

- **Only full calls count.** A call counts when it is finished, has a saved coaching report, ran through to a close (the report says `completed`, not `ended early`) and had enough said to score (the evidence is not `insufficient`). A call that ended early earns nothing at all.
- **Sample sessions never count**, nor do the sample mentor reviews that come with them.
- **Each call only looks backwards.** What a call earned depends on the calls before it, never after it, so adding a later call can never change what an earlier call earned.
- **Nothing can be paid twice.** Every reward has a stable id, for example `complete-scenario:<call id>` or `hidden-fact:<scenario>:<fact>`. Asking again, retrying an evaluation or ending a call twice gives exactly the same result.
- **Deleting a call removes what it earned**, because nothing remembers it. Deleting the sample data changes nothing.
- **Your day is your local day.** The browser sends its time zone offset, so a call that ends at 00:30 where you are counts for that calendar day.

## Points

| Rule                              | Points          | Earned when                                                                                                               | Safeguard                                                                                                                                                 |
| --------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Complete a full scenario**      | 50 (repeats 10) | You take a call all the way to a close, with enough said for real coaching.                                               | The first two completions of a scenario earn 50; repeats earn 10. A call that ends early earns nothing.                                                   |
| **Uncover a hidden fact**         | 10              | A question of yours brought out something the customer had not volunteered. The question is quoted.                       | Each fact pays once, ever, however many times you find it. A fact that was only partly uncovered earns nothing.                                           |
| **Give a clear owner and update** | 10              | You named who owns the issue, what happens next and when the customer will hear back, and the report quotes you doing it. | Needs a score of 4 or more on Ownership & Next Steps, enough evidence and a quoted moment. Once per call.                                                 |
| **Lift a skill**                  | 15              | One skill scored at least a point above your own recent average at the same difficulty, and at least 3.                   | Compared only with your own last three calls at that difficulty (you need two), never with other people. Once per call, for the skill that rose furthest. |
| **Try a new scenario family**     | 20              | Your first full call in a kind of customer issue you have not practised before.                                           | Once per family, so trying something different earns more than doing more.                                                                                |
| **Practise on a day**             | 5               | At least one full call on a calendar day, in your own time zone.                                                          | One award per day however many calls you make, and a missed day never costs you anything.                                                                 |
| **A mentor confirms the result**  | 25              | A mentor reviewed the call and scored every skill within one point of the rubric result.                                  | Needs a real mentor review, not a sample one. Once per call, and it is not taken back if another mentor sees the call differently.                        |

The seven scenario families are: Sign-in or access problem, Service outage, Slow performance, Data missing, Billing or licence question, How-to question, and Feature not working as expected.

Every entry in the ledger says why it was awarded in one plain sentence and, where there is one, quotes the moment from the call.

## Levels

Your level depends on both points and breadth, so a lot of points from one kind of call is not enough on its own.

| Level             | Points | Scenario families practised |
| ----------------- | ------ | --------------------------- |
| Foundation        | 0      | 0                           |
| Builder           | 150    | 2                           |
| Practitioner      | 400    | 4                           |
| Confident Handler | 800    | 6                           |

Your level is the highest one whose two minimums you have both met. The next level always says how many points and how many new families it still needs. Because points are never taken away, only deleting calls can lower a level.

## Streak

A streak is a chain of practice days in which each day is at most two calendar days after the one before it, so **one missed day is forgiven**. Monday, Wednesday and Thursday make a streak of three. A gap of three days or more simply starts a new chain.

- **Best** is your longest chain ever.
- **Current** is the chain that ends on your latest practice day, shown only while that day is today or at most two days ago. After that it reads 0 until you practise again. It never costs you points or a badge.
- **Active days** is the number of different days you practised, and **practised today** says whether today is one of them.

## Badges

Six badges, always shown in the same order, each with what it takes and your progress towards it. A badge records the call that completed it and when, and stays earned.

| Badge                  | What it takes                                                                                                                    |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **First Practice**     | Complete your first full scenario. A call that ends early does not count.                                                        |
| **Scope Detective**    | Find every hidden fact in three different scenarios. A scenario counts once any full call found all of its facts.                |
| **De-escalator**       | Bring a tense customer back down: they reached frustrated or worse and ended at least 20 points calmer, backed by a quoted turn. |
| **Ownership Builder**  | Give a clear owner, action and next-update time in three calls, each backed by a quoted turn.                                    |
| **Scenario Explorer**  | Complete full calls across four different scenario families.                                                                     |
| **Consistency Streak** | Build a streak of three practice days. One missed day in between is forgiven.                                                    |

## Challenges

Personal, recommended next steps that update as you practise. Each can suggest a scenario to try.

- **Try a new scenario family** (20 points). Progress is the families you have practised out of seven. It suggests the gentlest scenario (easiest difficulty, then shortest) in a family you have not tried.
- **Find every hidden fact in one call** (toward Scope Detective). Progress is the scenarios where you found every hidden fact, up to three. It suggests a scenario you have not fully uncovered yet, gentlest first.
- **Lift a skill by a point** (15 points). It appears once you have two full calls at the same difficulty, and targets your lowest recent average there. It says what that average is and what score would lift it, and it is met when your latest call lifted that skill. It also names the difficulty, because a skill is only compared with your own calls at the same one. It is left out if every skill already averages above 4, since no skill could rise by a whole point.
- **Practise on another day** (toward Consistency Streak). Progress is your best streak, up to three days. It always says that a missed day never counts against you.

## What is deliberately not rewarded

- **Speed, call length or the number of messages.** A quick call and a long one earn the same.
- **The overall score on its own.** Rewards come from specific, evidenced behaviours, and a low score on a call never removes anything you earned.
- **Repeating one scenario for points.** After two completions a repeat earns 10, and a fact only ever pays once.
- **Comparing people.** There is no ranking, leaderboard or comparison with colleagues, and rewards are never shared between browser profiles.
- **Calls that ended early, or had too little to coach on.**
- **Sample sessions.**
- **Missed days and retries.** Nothing is ever subtracted for either.

## The endpoint

```
GET /api/rewards?tzOffset=-330
```

`tzOffset` is the browser's `new Date().getTimezoneOffset()`: whole minutes, UTC minus local time, so India (UTC+5:30) is `-330` and New York in winter is `300`. It is optional and defaults to `0`. A value that is not a whole number from `-840` to `840` is rejected with a `400` and the error code `validation_failed`. Like every other endpoint it is private to the browser profile that asks.

The response is a single JSON object (`RewardsDTO` in `shared/domain/api.ts`):

| Field        | Contents                                                                                                                                                                               |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `points`     | The total of every entry, including any not shown in `ledger`.                                                                                                                         |
| `level`      | The current level (`index` runs 1 to 4), with its minimum points and families.                                                                                                         |
| `nextLevel`  | The level after it with `pointsToGo` and `familiesToGo` (0 when met), or `null` at the top.                                                                                            |
| `levels`     | All four levels.                                                                                                                                                                       |
| `families`   | The families practised so far, and the total (7).                                                                                                                                      |
| `streak`     | `current`, `best`, `activeDays` and `practisedToday`.                                                                                                                                  |
| `badges`     | The six badges with `earned`, `earnedAt`, `earnedInSessionId` and `progress`.                                                                                                          |
| `challenges` | The challenges, each with `progress`, `status` (`active` or `completed`) and a suggested `scenarioId` when there is one. Lift a skill also carries the `difficulty` it is measured at. |
| `ledger`     | The newest 200 entries, newest first. Each has a stable `id`, the `ruleId`, `points`, a `title`, a one-sentence `reason` and any `evidence`.                                           |
| `rules`      | The seven rules above, with their points, plain details and safeguards.                                                                                                                |
| `note`       | A reminder that rewards are private, are encouragement rather than assessment and are never compared.                                                                                  |

## Limits

- **Mentor reviews are trusted.** They come from the Calibration page, which has no sign-in, so the mentor reward relies on a real person having scored the call blind, just as calibration itself does. Rewards follow the saved reviews, so a mentor who revises their own review can change whether it confirms the result.
- **The time zone is the one the browser reports now.** If you travel, a call near midnight can move to a neighbouring day, and the practice-day entries move with it.
- **It reads every completed call on each request.** That is quick for one learner's history on one machine, which is what Firefly is built for.
- **Points are encouragement, not an assessment.** See [responsible-ai.md](responsible-ai.md) for how Firefly treats scores and what it never claims.
