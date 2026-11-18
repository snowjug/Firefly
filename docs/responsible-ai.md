# Responsible AI and data safety

Firefly is a **training aid**. It gives apprentices a safe place to practise customer conversations and get feedback they can act on. It is not a tool for judging people.

## What Firefly is for, and what it is not

| It is for                                                                   | It is not for                                                       |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Practising realistic conversations with a simulated, fictional customer     | Assessing, ranking or comparing colleagues                          |
| Getting feedback tied to what you actually said, with quotes from your call | Performance reviews, promotion decisions or any employment decision |
| Discussing a call with a mentor, who adds what automatic feedback cannot    | Replacing mentor review                                             |
| Repeating a scenario at a different difficulty                              | Training on or storing real customer cases, logs or screenshots     |

Scores are practice signals from a handful of simulated calls. The Progress page shows no leaderboard, ranking, streak or points, and never compares one person with another.

## Safeguards in the product

**Fictional by design**

- Every scenario uses invented people, organisations and products. The library tests fail if a scenario contains an email address, a phone number or a link.
- The interface labels the customer as simulated and fictional, and the app warns against entering real customer information before a call starts, in the message box, in the private notes and on the About page.

**Less personal data**

- Obvious personal data in a trainee's message (email addresses, phone numbers, long numbers, identifiers) is replaced with a marker before the message is saved or sent to any model. The message box warns before sending.
- Private notes stay in the browser tab. They are not sent to the server or included in reports.
- There is no sign-in, no analytics, no tracking and no telemetry. Logs hold short session ids, codes and timings, not transcripts.

**Control of the model**

- In live mode, a model only ever receives the facts the engine has decided the customer may share in the current reply. Hidden facts the trainee has not earned are never in the prompt, and replies are scanned for details that appear only in an unearned fact. See [ai-providers.md](ai-providers.md#how-hidden-facts-are-protected).
- The customer, the turn classifier and the coaching evaluator are separate steps with separate instructions, so the customer's role cannot be changed by what a trainee types. Attempts to make the customer break character or reveal instructions are recognised and answered in character.
- A model never decides a number. Customer state, discovery, curveball timing and scoring arithmetic are computed in code, and every model output is validated before it is used. Text that came from a model is shown as plain text, never as HTML.
- API keys live only in the server's environment. They are never sent to the browser or written to logs.

**Honest feedback**

- Every quote in a report is checked against the turn it cites. A quote that does not appear there is removed before a report is saved.
- A score needs evidence: a 4 needs a verified quote and a 5 needs two. A short call says its report rests on limited evidence instead of inventing a full assessment.
- Scores do not go down because of short messages, a terse style, grammar or spelling, an accent or non-native phrasing, or a communication style that differs from the reviewer's own ([evaluation-rubric.md](evaluation-rubric.md#what-is-never-penalised)).
- Demo mode is always labelled. Replies and feedback from the built-in rules engine are never presented as coming from an AI model.

**Human review**

- Calibration is part of the product: mentors score the same calls from the transcript alone and Firefly compares the two sets of scores. The review screen never loads the AI's scores, though anyone using the app can still open a report from History, so mentors should score first. It reports only what the stored records show, warns when there are too few, and tracks evaluator and rubric versions. See [calibration.md](calibration.md).

## Limits you should know about

- **Automatic coaching can be wrong.** The rules evaluator reads patterns in text, so it can miss a good way of saying something or read a sentence too generously. A model-written evaluation can be fluent and still mistaken. Quotes are shown so a person can check what a score rests on.
- **No tone of voice.** Firefly is text only. Warmth, pace and pauses cannot be assessed.
- **A simulation is not a customer.** A scenario has fixed facts, and the demo-mode customer is rules-based and less flexible than a person or a model.
- **English only**, and nothing here has been tested for how well it works for every kind of speaker. Non-native phrasing must never be marked down; if you see it happen, treat that as a bug.
- **The live model path is unverified** against real services in this repository. See the verification note in [ai-providers.md](ai-providers.md).
- **No certification.** Firefly makes no claim of compliance with any standard or regulation, and nothing here is legal advice.

## For people who run Firefly

- **Where data lives.** In the default setup, everything is in a SQLite file on the machine that runs the server (`data/firefly.db`, git-ignored) and is not encrypted by Firefly. If you use a live model, trainee messages and call transcripts are sent to the provider you configure, so choose and configure it with your organisation's data rules in mind.
- **Who can see it.** Firefly has no accounts. An anonymous browser cookie separates one learner's history from another's on a shared server. It is not authentication. Keep Firefly on a trusted network, or put sign-in and TLS in front of it.
- **Deleting data.** The Trainer page can remove sample sessions, delete a profile's practice sessions, or reset everything for that profile. A single session can be deleted from History. Deleting the database file removes everything.
- **Using it well.** Use scores to start a conversation with a mentor. Do not use them for evaluation, and do not publish individual results.
