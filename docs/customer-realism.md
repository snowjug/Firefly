# Customer realism

How the synthetic customer behaves, what that behaviour is built from, and what has and has not been tested. It describes the code in `server/engine/`, `server/prompts/` and `server/providers/`. Paths start at the repository root.

The customer is a rules engine plus a writer. The engine decides what the customer may say and how they feel. The writer turns that decision into words. In demo mode the writer is Firefly's own phrase banks. In live mode it is a chat model. Both write from the same plan, so the facts, the reactions and the numbers are the same in both. Only the wording differs.

**What this page does not claim.** The behaviour below is heuristic: patterns in text and fixed rules, not understanding. The tests run scripted calls. No rating of the customer's realism by real trainees is recorded in this repository. A live model has had only a limited smoke check, which says nothing about the customer's voice or realism (see [Live-model guards](#live-model-guards) and the provider table in the [README](../README.md#demo-mode-and-live-providers)).

## One plan, two writers

For each trainee turn the pipeline in `server/engine/pipeline.ts` runs these steps:

1. **Classify** what the trainee did (greeted, asked about timing, took ownership, blamed, and so on). Demo mode uses the rules classifier. Live mode asks the model, and falls back to the rules classifier if the model call fails.
2. **Analyse** the turn against the call's memory: a repeat, a summary, a commitment, a time that changed.
3. **Discover**: which facts the customer may say now.
4. **Update the customer's state** (temperature, trust, patience and others) by fixed rules. A model never sets these numbers.
5. **Curveballs**: fire one only when its stated conditions hold.
6. **Plan the reply** (`server/engine/plan.ts`): the reactions, the facts, the one thing the customer may push for, and the length.
7. **Write** the reply (demo composer or model).
8. **Conform** the reply, then record what was really said.

The two writers differ like this:

| Part              | Demo mode (rules)                                                                                                                                                      | Live mode (model)                                                                                  |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Classifying turns | Word patterns (`server/engine/classifier.ts`, `lexicon.ts`)                                                                                                            | The model, using each hidden fact's `revealWhen` description                                       |
| Cues              | A fact with cues is told only when the question contains one of them                                                                                                   | Left to the model's reading of the question                                                        |
| Wording           | Phrase banks and the scenario's authored lines (`server/engine/mock/`)                                                                                                 | The model, from the plan and the scenario                                                          |
| Facts and state   | The same engine                                                                                                                                                        | The same engine                                                                                    |
| Variety           | Limited. The composer avoids phrasings it used recently, but each situation has a fixed set, so a long call can reuse one. The customer is simpler than the live model | The model's own. How much it varies, and whether it drifts, has not been measured                  |
| Opening           | Composed by code                                                                                                                                                       | Composed by code (the model never writes the opening)                                              |
| On failure        | Not applicable                                                                                                                                                         | The classifier falls back to rules. A failed reply is a typed error with Retry. No silent fallback |

Demo mode is always labelled "Demo mode" in the app and in stored calls.

## The first minute

A first-contact customer opens in two beats (`server/engine/opening.ts`, `plan.ts`):

1. **A greeting only.** It fits the time of day, the customer's mood and style, and the product: "Good morning. Is this Microsoft support?" An anxious or high-impact customer may add one line about what is at stake. Then the customer waits.
2. **The reason, once the engineer has answered.** The customer says why they called, in one to three sentences. A terse customer says the problem in a sentence of its own after any lead; it is not dropped to keep the reply short. The reason counts as given only when it has been said. If the engineer's first words are only "Yes.", "Okay." or "Sure.", nothing about the problem was said, so the reply does not give it and it comes with the greeting that follows (`opening` in `pipeline.ts`, tested in `server/engine/engine.test.ts`). A trainee turn that only greets does not count as a wasted turn: the timing rules ignore it (`greetingTurns`).

A call-back does not wait. A follow-up, escalated or closure call opens with its purpose in one to three sentences, taken from the scenario's stage frame: "I'm following up on a case I raised earlier." It gives no detail beyond that.

The opening is composed by code in both modes, and the same scenario and seed give the same opening. The tests (`server/engine/library.test.ts`) check, for every scenario, stage and starting mood, that the opening is short, holds no hidden fact, and states the stage's purpose on a call-back. They also check, for every scenario and style, that the first-contact greeting asks whether this is the support line and that the reason the customer then gives still holds the problem.

If the engineer starts without a greeting or an introduction, the customer notices and says so. They give a name, a role, an organisation or a case reference only when asked, and say so when they have no case number to hand. "Can you tell me your name and your role?" gets both, and "Do you have a case number?" is a question about the customer's details, not about whether they have called before. A role is said as a person says it ("I'm the head of programme delivery", "I'm an operations manager"), not as the scenario's job-title field.

In demo mode, when the engineer gives their name ("I'm Sam", "My name is Sam", "This is Sam"), a customer who is not terse sometimes says it back when they answer the greeting ("Hi Sam, thanks.") (`introducedAs` in `memory.ts`, the greeting banks in `mock/phrasebank.ts`). In both modes the conformer then keeps the name to once in any five of the customer's replies, and counts it only when it is said to the engineer ("Thanks, Sam."). A name that is also a word, like "Will" in "Will you call me?", is not counted (`server/engine/conform.ts`).

## What the customer knows

Every scenario sorts what the customer knows into classes (`shared/domain/scenario.ts`). The class decides how a question is answered.

| Class                | How the customer answers                                                                                                               |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Known                | Confidently, when the topic comes up. A talkative customer may add colour. A non-native customer uses the plain wording.               |
| Vague                | With a hedge. Once the engineer narrows it down or asks to confirm, the customer firms it up (`confirmedText`).                        |
| Checkable            | Says a holding line first ("Give me a moment"), then what they found.                                                                  |
| Unknown              | Says honestly that they do not have it, and names who would know. Never guesses. The customer remembers that they said they would ask. |
| Irrelevant           | Background a talkative customer may offer, at most one aside per reply, only when there is room and the customer is not heated.        |
| Hidden               | Only when a question addressed it and the customer is willing (below).                                                                 |
| Incorrect assumption | A belief the customer states and that is not true. A correction is accepted. Doubt alone is not.                                       |

**Hidden facts.** A hidden fact is revealed only when the question addressed it. The customer may still hold it back for one of three reasons: not enough trust yet (`minTrust`), the impact has not been acknowledged (`requiresImpactAck`), or it is too early (`availableAfterTurn`). At most two hidden facts come out in one reply, and one for a terse customer. A broad question can reveal a partial statement.

A fact counts as discovered only if its words are in the reply the customer really gave. The reply is shortened and checked first, and only then recorded (`pipeline.ts`). A reply that lost the fact to the length limit does not count it.

**Case notes.** A call-back has the earlier contact and what was tried on the case. If the engineer asks for them again, the customer says them once more as something already told: "As I told you before." Notes are turned into the customer's own voice (`server/engine/record.ts`). A note that restates a hidden fact the engineer has not earned is left unsaid.

**Beliefs.** A non-expert customer states a wrong belief early, if they are talkative or vague, or when asked what the problem is. An expert customer opens with their diagnosis instead.

## Memory and commitments

The runtime state saved with each call (`EngineRuntime`) holds what the customer remembers:

- **What they have said**, by fact id and count, so they stay consistent and can say it again.
- **What the engineer asked.** The last twelve questions are kept, so a real repeat can be told from a follow-up.
- **A commitments ledger.** Up to eight, newest last, from both sides: the engineer's owner, action and time, and the customer's own ("I'll ask our administrator").
- **Corrections and misunderstandings.** Who got something wrong and what was put right.

How a turn is read against that memory (`server/engine/memory.ts`):

| What the engineer did                                  | What the customer does                                                                                                                                                                                                                                                                                                                             |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Asked the same question again (a near copy)            | Says they already answered it, and says the earlier answer again. A terse customer keeps the irritated lead and then restates the answer. The engine records a repetition: the temperature rises and trust and patience fall.                                                                                                                      |
| Asked a follow-up that narrows an answer down          | Answers it. This is not charged as a repeat.                                                                                                                                                                                                                                                                                                       |
| Asked what the customer meant                          | Says the last thing again, in other words where the scenario has some.                                                                                                                                                                                                                                                                             |
| Gave a recap that matches what the customer said       | Confirms it ("Yes, that's right."). The temperature eases and trust rises a little. If the recap leaves out something the customer said, they usually add it in one short sentence.                                                                                                                                                                |
| Gave a recap that is wrong (the count or a detail)     | Puts it right. The temperature and trust move the wrong way.                                                                                                                                                                                                                                                                                       |
| Asked the customer to confirm ("So you'll call at 3?") | Answers the question. A short yes to the customer's own "so you'll do that?" is not treated as a thin reply.                                                                                                                                                                                                                                       |
| Corrected themselves                                   | Takes the correction. It is not charged as a repeat.                                                                                                                                                                                                                                                                                               |
| Made a clear commitment (owner, action, time)          | Says it back as a question ("So you'll call me by 3pm, correct?") or takes it in with a few words that name the time ("Okay, by 3pm then."), by who the customer is. See [Ownership and closing the call](#ownership-and-closing-the-call).                                                                                                        |
| Made a vague commitment ("soon")                       | Asks for a time, once (see [below](#ownership-and-closing-the-call)). "I'll call you back later" and "I'll get back to you" are vague too. Saying again a commitment that already has a time, without the time ("so I'll own this and call you back"), is not vague: it keeps the time and the clarity it had, and the customer does not ask when. |
| Changed a time they gave earlier                       | Points out the difference. Only a time for the same promise (the same kind and action) counts as a change. Another promise for another time does not, and neither does how often the customer will hear ("every hour", "daily").                                                                                                                   |
| Promised an outcome nobody can know                    | Reacts to it. Trust and confidence fall. Honesty about what can and cannot be committed calms them instead.                                                                                                                                                                                                                                        |
| Said the same owner or the same time again             | Is not credited again. The state rules record only "said again" (a point of temperature and trust, `server/engine/state.ts`), and a different time for the same promise earns no credit at all.                                                                                                                                                    |
| Asked "Is there anything you need from your side?"     | Answers it as a closing question, not as a question about the problem: it cannot unlock a fact.                                                                                                                                                                                                                                                    |
| Closed the call                                        | Answers "Is there anything else?" or a goodbye in a few words, giving the time they were promised when it has just been recapped. Raises no new problem. See [below](#ownership-and-closing-the-call).                                                                                                                                             |

A recap that ends with "Is that right?" is a question to answer, not a goodbye: the customer confirms and the call goes on. The tag is not judged as a claim, and what comes before it is, whether the tag is a sentence of its own or ends the same sentence ("You have 12 users affected, is that right?").

**Blame and brush-offs.** The rules classifier reads them narrowly (`server/engine/lexicon.ts`). "You should have restarted it", "That was your mistake", "Whatever.", "Just answer the question." and "As I already told you" count, and the customer reacts to them. Words that take the customer's side do not: "You shouldn't have to chase us", "You must have been waiting a long time" and "As I said" ("I'll ring at 3 as I said") are not blame or a brush-off (`server/engine/behaviour.test.ts`).

## Ownership and closing the call

What the customer does once the engineer says who owns the case and when they will act, and how the call ends. Both writers follow the same plan (`commitmentMove`, `pressesForTime`, `asksOffer` and `closeKindOf` in `server/engine/plan.ts`). The demo wording is in `server/engine/mock/customer.ts` and `phrasebank.ts`, and the live guidance is in `server/prompts/reactions.ts`.

**A clear owner and a time.** The customer takes it in once. A customer who is demanding, talkative, non-native, a novice or not calm says it back as a question ("So you'll call me by 3pm, correct?"), and accepts it in a few words when the engineer confirms ("That works for me."). A terse or calm customer takes it in at once and names the time ("Okay, by 3pm then."). A recap that contains the plan is answered in one line ("Yes, that's right. Okay, by 3pm then."). Neither is repeated when the engineer says the same thing again.

**A vague promise.** "I'll look into it" or "I'll call you back" has no time, so the customer asks when, once, in their own words ("When will I hear back?"). An angry or demanding customer asks every time. Anyone else asks only if no time has been given yet and the usual gap between asks has passed (see [How often the customer asks](#stage-behaviour)). A calm customer with little at stake, given an owner but no time, may let it go unless the scenario expects a next update. The ask is recorded as the customer asking when they will hear back, so the stage rules do not ask it again straight after.

**Anything needed from the customer.** A cooperative customer (starts calm or anxious, is not terse or demanding, is not at Challenge) who has just taken a plan in may ask once, in a few words, whether the engineer needs anything from their side before then ("Is there anything you need from our side before then?"). It is asked at most once in a call, and not in a reply that carries a curveball.

**Ending the call.** The plan names three ways the engineer can end it, and the customer answers each in a few words:

- **"Is there anything else?"** (or "Is there anything you need from your side?"). Usually "No, I think that's everything." The customer names the time when the engineer has just recapped, and sometimes otherwise. A customer who said they would check something with someone may offer to ("I can ask our administrator."), and so may one who has said who would know about something they did not know. They never offer a hidden fact. A terse customer does not offer. A concern the customer raised earlier and says again is the answer instead. "Anything else" in a question about the problem ("Did you change anything else?", "Is there anything else you noticed?", "Is there anything else I should know?") is not this: it is answered as a question about the problem, and can reveal a fact (`asksIfThatIsAll` in `server/engine/lexicon.ts`).
- **Wrapping up without a goodbye** (a recap, "so that's everything"). One short line, without a goodbye.
- **A goodbye** ("Thanks for your time, goodbye", "Take care"). One short goodbye, with the time when there is one ("Thanks, bye. Speak to you at 3pm."). "Thanks", "thanks for calling", "until then" and "speak to you at 3pm" on their own are not goodbyes.

In every closing the customer raises no new problem, drops no hint, does not recap the case and asks for nothing, and a bare "Okay." is not said twice in a row. A closure-stage customer who has not yet heard what changed asks for it instead (see [Stage behaviour](#stage-behaviour)). The engineer's goodbye, and a confirmation of what the customer said back, are progress in the state rules, not a wasted turn. A curveball that is due does not come on a closing turn either (see [Curveballs](#curveballs)).

## Personalities

The customer's behaviour comes from three settings that the trainee can change: starting temperature, communication style and proficiency. The customer's mood then moves during the call by the state rules. The tone of a reply follows the current temperature band: calm, worried, firm or hot (`server/engine/tone.ts`). A heated customer is blunt and upset, never abusive. The prompt forbids swearing, threats and abuse.

| Setting      | What it changes                                                                                                                     |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| Calm         | Even-tempered and cooperative. Polite unless given a reason not to.                                                                 |
| Anxious      | Worries about consequences. May ask how long it will take, or say again how urgent it is. A clear next step with a time calms them. |
| Frustrated   | Short on patience. May point out a lack of progress or ask who owns the case. Concrete action helps more than sympathy.             |
| Angry        | Blunt and unwilling to accept vague answers. May ask to escalate, except on a call that is already escalated.                       |
| Talkative    | Gives context and an occasional aside. Replies run a little longer.                                                                 |
| Terse        | One or two sentences, answering only what was asked. Uses the short version of a fact.                                              |
| Demanding    | Asks for an owner, a plan and a time, and says commitments back.                                                                    |
| Vague        | Answers a broad question in general terms and becomes specific when asked something specific.                                       |
| Non-native   | Plain, correct English with no contractions and no idioms. May ask the engineer to say it more simply. Never an imitated accent.    |
| Novice       | Everyday words. Asks what an unexplained term means.                                                                                |
| Intermediate | Comfortable with common terms, unfamiliar with how the system works inside.                                                         |
| Expert       | Uses technical vocabulary, comes with a diagnosis, and is impatient with the obvious.                                               |

The starting temperatures are 12 (calm), 32 (anxious), 52 (frustrated) and 72 (angry) on a 0 to 100 scale, and the difficulty and call stage set the starting trust and patience (`shared/domain/state.ts`). Those numbers are internal and never shown to the trainee.

A customer's language never changes how the engineer is judged. A test (`behaviour.test.ts`) plays the same lines to a talkative and a non-native customer and checks that the recorded state changes are identical.

## Reply length and the conformer

How long a reply may be is part of the plan (`sentenceBudget` in `plan.ts`):

| Reply                                                                   | Most sentences |
| ----------------------------------------------------------------------- | -------------- |
| Silent, off-role or low-effort                                          | 2              |
| The reason for the call (two for a terse customer)                      | 3              |
| A terse customer, any other reply                                       | 2              |
| A heated reply, or one to a blame, a dismissal, a repeat or a curveball | 3              |
| A talkative customer, or a reply that clarifies or puts a recap right   | 4              |
| Any other reply                                                         | 3              |

The first row that applies wins.

Every reply then goes through the conformer (`server/engine/conform.ts`), in demo and live mode alike. It:

- cuts a long reply at a sentence boundary, never in the middle of one;
- turns the lines of a list or heading into sentences of their own, and flattens the rest into plain speech. The lines become sentences before line breaks are collapsed (`endListItems`), so a list is not run together as one long sentence that the sentence limit could not see;
- removes praise ("great question", "good troubleshooting step", "well done") and turns "that's correct" into "that's right";
- removes coaching ("you should ask me about...", "a better question would be..."). The customer's own offer or plan ("I'll try asking our administrator", "next time I'll try the web version") is not coaching;
- removes what an assistant says and a customer does not: "Certainly!", "I understand your concern", "Thank you for your patience", "I'm happy to help", "Is there anything else I can help with?", and a reply that is only "Understood." or "Noted.". "Thanks for waiting." and "I understand it takes time" are what a customer says, and stay;
- keeps the engineer's name to once in any five of the customer's replies, and once at most within a reply ("Thanks, Sam." becomes "Thanks." when it was said recently);
- removes any sentence that announces a hidden fact ("here's another fact").

Whatever the conformer removes, the customer never praises the engineer, never coaches them, never talks like an assistant and never announces what they are holding back. If nothing of a reply survives, the customer says "Okay."

The conformer reports what it found (`too-long`, `praise`, `coaching`, `announces-facts`, `ai-politeness`, `repeats-name`, `list-or-heading`, `empty`). The live provider uses these findings, and two checks of its own (a recap of the case, a bare "Okay." again), to decide whether to ask the model again.

In demo mode a reply that has to carry what the customer is answering with (facts the engineer asked for, a curveball) may run past the budget rather than lose one, but never past six sentences. A curveball that would take the reply past six is cut to its first sentence or two (`MOST_SENTENCES` in `mock/customer.ts`). In live mode the conformer cuts the reply to the plan's budget.

## Stage behaviour

The call stage changes what the customer expects (`server/engine/stage.ts`). Each expectation counts once. The customer notices a missing one and may ask for it. The same ask is not repeated until three trainee turns have passed.

| Stage         | What the customer expects                                                                                                   | What they push for                                                                    |
| ------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| First contact | An introduction, scoping, an impact check and clear ownership.                                                              | An owner, when the mood, the impact or the scenario calls for one.                    |
| Follow-up     | Awareness of the earlier contact and a progress update. No needless repetition.                                             | An update, then an owner.                                                             |
| Escalated     | The earlier experience acknowledged, the escalation explained and an update cadence.                                        | History, an owner, an explanation of the escalation, then a cadence.                  |
| Closure       | The fix confirmed, agreement to close checked and what changed explained. Closing too early, before either, costs a little. | The cause, and confirmation that it works. A wary customer asks if it will come back. |

On any stage, a customer may also ask when they will hear back, while no specific next step has been given. That needs high impact, a very urgent or demanding customer, or a scenario whose own expectation names a next update. It comes from the engineer's third turn, or the fourth when only the scenario's expectation calls for it.

**How often the customer asks.** One place decides whether the customer may ask for anything in a reply (`server/engine/pressing.ts`), so that asks cannot add up to a request in every reply. It counts every kind of ask: the stage's pushes, the question about when they will hear back, a concern raised again, and the lines of personality that ask for something (how long it will take, who owns the case, what progress there is, a plan, an escalation).

- Asks are spaced by mood: at least six trainee turns apart for a calm customer, three for a worried or firm one and two for a hot one. A curveball counts as an ask for this spacing.
- A calm customer does not ask for an owner, a plan or a time to hear back before the engineer's seventh turn. A first turn that was only a greeting is not counted.
- On a first contact, the customer starts asking only after the engineer has asked about three different topics.
- The customer stops asking once the engineer has taken ownership clearly and given a specific next step.
- A reply that raises or follows up a curveball asks for nothing. A push or the timeline question is also left out of a reply that already asks the engineer something, such as to explain a term or to give a clear time.

A closing call is the exception. A customer who called to understand what changed does not let the call close without hearing what changed and that it works, and asks as soon as the engineer starts to wrap up.

On a call-back, suggesting something the customer already tried, asking what was tried when it is on the case, asking about the earlier contact, and asking the customer to tell the whole story again each cost a little trust and patience.

The scenario's own `customerExpectation` and `desiredOutcome` are read for four expectations: ownership, a time for the next update, a plain explanation, and a way to carry on in the meantime (`server/engine/expectation.ts`). This is a pattern search over free text, so it reads only what those words say. An expectation still ignored after eight trainee turns costs a little, once.

## Curveballs

Curveballs are controlled (`server/engine/curveballs.ts`). Each scenario lists the types it allows and authors some of them. A curveball:

- fires only when its trigger conditions hold (an earliest turn, a temperature, an unacknowledged impact, a discovered fact), never at random;
- fires at most once, and never within three trainee turns of another;
- never comes on a turn that ends the call, and is dropped once the call is closing (below);
- is limited by difficulty: none by default at Starter (at most one if chosen), one at Standard, up to two at Challenge;
- is judged on the trainee's next reply, and counts as resolved or unresolved. An unresolved one may be followed up once.

**Not on the way out.** A customer who has said that is everything, or goodbye, does not come back with a new demand. So no curveball is raised on a turn on which the engineer says goodbye, asks "is there anything else?" or wraps up, not even a forced one whose `latestTurn` has come. The call counts as closing from the first turn on which the engineer says goodbye or, once the customer has been told what happens next, asks if that is all or wraps up. A curveball that had not come up by then is dropped for the rest of the call, not put off to a later turn. Before a next step has been given, an offer of help at the start of the call ("Is there anything I can help you with today?") or a recap in the middle of it is not the end, though no curveball comes on that turn either. The call records the turn at which it began to close (`closingAtTurn` in `server/engine/types.ts`). A curveball that never came leaves the customer's curveball state, the list of those fired, the public shift count and the state events as they are for a call with none, so the report has no curveball section and the escalation milestone is "not applicable". The live prompt is built from the same decision, so a model is never told to raise one on a closing turn.

A customer who "goes silent" sends short replies that share no facts until the engineer re-engages.

## Live-model guards

These apply only in live mode. They are tested against local fakes (`server/providers/live.test.ts`, `server/prompts/*.test.ts`). Apart from the limited Gemini smoke check (see [ai-providers.md](ai-providers.md#status-of-each-provider)), they have not been run against a real model. That check looked for errors, retries, coaching and list-style replies with simple automatic checks. It is not a quality evaluation, and it was not repeated for the `customer-4` prompt or for the guards against stock phrases, the engineer's name, recaps and a repeated bare "Okay.": those have only met the fake model.

- **Hidden facts stay out of the request.** The customer prompt reads facts only through the plan, which holds what the customer may say in this reply. The statement, label and id of an unearned hidden fact are not in the request in any form, and there is no "do not mention" list. The one exception is a fact's `hint`, the author's gentle clue, which the plan may let the customer drop at Starter difficulty. (It is not the **Live hints** switch, which adds a list of areas to explore to the case panel.) The engineer's words travel only as user turns, never inside the system message.
- **Screening.** Scenario text can restate a hidden fact (a setup note, say). Each such line is checked and left out of the request until the fact is earned (`server/prompts/facts.ts`).
- **Reply checks.** A reply is turned down if it is empty, longer than 900 characters, out of character (it mentions being an AI, a language model, a system prompt, its instructions, the simulation or the rubric), repeats a number, name or phrase that only an unearned fact holds, or gives a specific for something the customer does not know. On the first attempt it is also turned down if it coaches the engineer (the customer's own "I'll try asking our administrator" is an offer, not coaching), announces a hidden fact, praises the engineer, uses the stock phrases of an assistant ("Certainly!", "I understand your concern"), says the engineer's name again within five replies, tells the case over again (two sentences that say, nearly word for word, what the customer has already said), says "Okay." or "Understood." and nothing else straight after doing so, or says the previous reply again. On the retry those are let through: the conformer cuts the advice, the praise, the stock phrases, the announcing and the name out of whatever is used, and a customer asked the same thing twice may say the same thing. A retry for the assistant-like patterns carries a generic reminder about speaking as a customer would on the phone (`CUSTOMER_REMINDERS.style`).
- **One retry, then what is safe, then a typed error.** A rejected reply is regenerated once with a generic reminder that never repeats the bad reply. If the second reply is also turned down, Firefly keeps what can be said safely, sentence by sentence (`server/providers/guards.ts`), from the second reply or, if nothing is left of it, from the first. A sentence that leaks an unearned fact, makes up what the customer does not know or breaks character is dropped, and where the customer has nothing to answer with but "I don't know", the scenario's own line for it is added. Only when nothing safe remains does the call fail with a `provider_bad_output` error. The trainee's message is already saved, so Retry sends the same message and cannot duplicate it. There is no silent fallback to the demo customer.
- **Prompt injection.** The classifier flags a turn that tries to make the customer break character or reveal instructions. The customer then gives a short reply as a confused customer would (in demo mode a line from a phrase bank), and nothing is revealed.
- **Structured output.** A classifier answer must match the schema, unknown ids are dropped, and every quote must appear in the trainee's message. One repair attempt is made, then the turn falls back to the rules classifier.
- **Model settings.** Customer prompt `customer-4`, temperature 0.7, at most 400 tokens per reply (`server/prompts/customer.ts`). The prompt versions are stored with every call. The prompt's rules tell the model the same things the guards look for: no stock assistant phrases, no thanks in every reply, no bare "Understood." or "Okay." twice running, the engineer's name at most once in five replies, and no recap of the whole case.

What is sent to a provider is in [ai-providers.md](ai-providers.md#what-is-sent-to-the-model-and-what-is-not).

## Old calls and retired scenarios

The thirteen generic scenarios the project started with were replaced by the Microsoft scenarios. A call started on a scenario that has since left the library still works:

- The call keeps a snapshot of its scenario, so it can still take messages and be ended.
- A report can still be made. The library is used only to suggest a scenario to practise next, and a missing or empty library suggests none (`server/evaluator/retired.test.ts`).
- A call saved before the customer had a memory is read with empty memory and carries on as a call that is under way (`normaliseRuntime`, `server/engine/runtime.test.ts`).
- A link to a retired scenario shows "Scenario unavailable" on the brief, and a note on the scenario list.
- A scenario with `enabled: false` is hidden from the list and cannot start a new call.

## What was tested

Run `npm test` for everything, or one area at a time:

```
npx vitest run server/engine
npx vitest run server/prompts server/providers
```

The tests cover:

- **The first exchange**, repeats against clarifications and corrections, promises and times, and how the customer takes blame, empathy and jargon (`server/engine/behaviour.test.ts`).
- **Ownership and the end of a call** (`behaviour.test.ts`): a clear owner and time said back or taken in, a vague promise asked about once, the one question about anything needed from the customer's side, "anything else?" and goodbyes (and the wrap-ups and thanks that are not goodbyes), "anything else" in a question about the problem, a recap that is right, wrong or leaves something out, and the customer's name, role and organisation.
- **A curveball and the end of a call** (`engine.test.ts`, `library.test.ts`, `server/evaluator/realEngine.test.ts`, `server/prompts/prompts.test.ts`): a curveball that is due is raised when the call goes on and not on a goodbye, a wrap-up or "anything else?" or later in the call; an opening offer of help or an "anything else" about the problem does not drop it; it can still come on the turn after the customer asked for a time; a sweep over all 16 scenarios at Challenge with three seeds, each with every curveball due on the closing turn, finds none said, recorded or evented; the report of such a call has no curveball; and the live prompt is not told to raise one (`runtime.test.ts` checks that a call saved before `closingAtTurn` existed loads).
- **The opening**: a short greeting, the reason given once the engineer has answered, and a first turn of only "Yes.", "Okay." or "Sure." (`server/engine/engine.test.ts`). The engineer's name said back once in five replies, however often a model says it (`engine.test.ts`).
- **Fact classes**: vague, checkable, unknown, irrelevant, cue-gated and case-note facts (`facts.test.ts`, `record.test.ts`).
- **Stages**: a call-back, an escalated call and a closure call (`stages.test.ts`).
- **How often the customer asks**: spacing by mood, a first call that has not been scoped, stopping once an owner and a time are given, and a closing call that still asks what changed (`pressing.test.ts`).
- **Every scenario in every stage**: short, plain replies, no unearned hidden fact, a plain style for a non-native customer, and an answer to "have you contacted us before?" from the case itself (`library.test.ts`). A whole scripted call, from the greeting to the goodbye, for each of the 16 scenarios, five styles and four stages in demo mode, with one starting mood per combination (rotated, not every mood). No reply may praise the engineer, say an assistant's stock phrase, be a list, repeat the reply before it, say the engineer's name twice in five replies, or run past six sentences or 80 words. The reasons for calling keep the problem.
- **The conformer** (`conform.test.ts`), **the closing question and the housekeeping questions** (`classifier.test.ts`) and **discovery counting only what was said** (`behaviour.test.ts`).
- **The live path** against a fake model: the fact policy, the leak guard, retries and the typed error, and a model that praises, sounds like an assistant, repeats the engineer's name, recaps the case or says "Okay." twice (`server/providers/live.test.ts`, `server/prompts/`).

What the tests do not show: that the customer sounds natural to a person, that the closing lines and goodbyes land well, that a live model obeys the plan or the new guidance, or that the demo customer is as flexible as one. The patterns the tests and the guards look for are the ones listed here; a stock phrase or a recap in other words gets through. Treat the demo customer as a practice partner with a fixed script of reactions, not as a person.
