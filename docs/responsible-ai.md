# Responsible AI and data safety

Firefly is a **training aid**. It gives apprentices a safe place to practise customer conversations and get feedback they can act on. It is not a tool for judging people. The same points, in short form, are on the Responsible AI page inside the app.

## What Firefly is for, and what it is not

| It is for                                                                   | It is not for                                                       |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Practising realistic conversations with a simulated, fictional customer     | Assessing, ranking or comparing colleagues                          |
| Getting feedback tied to what you actually said, with quotes from your call | Performance reviews, promotion decisions or any employment decision |
| Discussing a call with a mentor, who adds what automatic feedback cannot    | Replacing mentor review                                             |
| Repeating a scenario at a different difficulty                              | Training on or storing real customer cases, logs or screenshots     |

Scores are practice signals from a simulated call. Firefly has no leaderboard, no ranking, no points and no progress tracking, no screen that lists calls or scores together, and it never compares one person with another. A report shows that call's own scores and nothing else.

## Safeguards in the product

**Fictional by design**

- Every scenario uses invented people, organisations and products. The library tests fail if a scenario contains an email address, a phone number or a link.
- The interface labels the customer as fictional: the footer on the landing, scenario, brief, report and information pages says "A training aid. Customers and scenarios are fictional.", the brief's ground rules say so, and the Responsible AI page tells you to keep every call fictional.

**Less personal data**

- Obvious personal data in a trainee's message (email addresses, phone numbers, long numbers, identifiers) is replaced with a marker before the message is saved or sent to any model. This runs on recognised speech as well as typed text, after recognition. It is pattern matching and will not catch everything, and it cannot touch audio, so the safest approach is to say and type nothing real.
- There is no account, no password, no analytics, no tracking and no telemetry. One anonymous cookie keeps a browser's calls apart. Logs hold short session ids, codes and timings, never transcripts or audio.

**Voice**

- A call can always be typed. A spoken call asks for the microphone only after an explicit click (the optional **Check microphone** on the brief, or **Start voice call** on the pre-flight page), and the brief and the pre-flight page say before that where your speech will be processed.
- Firefly never writes audio to disk, logs it or stores it. With a server speech provider (Azure AI Speech) the recording goes through Firefly's server to the provider and is held in memory for one request. With the browser's own recognition, the audio is handled by the browser, which in Chrome and Edge is usually the browser maker's online service; Firefly does not record or send it. With the scripted demo provider, the audio is discarded. See [privacy-audio.md](privacy-audio.md).
- The customer's voice is synthetic: a prebuilt voice from the browser or the provider, not a real person, not a clone and not an imitation. The trainee chooses between four neutral voices, labelled by pace and never by a person, a gender or an accent. Pace and pitch (and, for a few voices, a style) are adjusted to suggest the customer's mood. No test or measurement here checks how that sounds, and Firefly does not claim it shows real emotion.
- Firefly does not analyse your voice for emotion, stress, tone, accent or pace. Coaching reads the words only. Speech recognition can mishear words, so a report on a call that used voice says to check the quotes against what you said.

**Control of the model**

- In live mode, a model only ever receives the facts the engine has decided the customer may share in the current reply. Hidden facts the trainee has not earned are never in the prompt, apart from a gentle clue the scenario's author wrote for a fact, which the customer may drop at Starter difficulty. Replies are scanned for details that appear only in an unearned fact. See [ai-providers.md](ai-providers.md#how-hidden-facts-are-protected).
- The customer, the turn classifier and the coaching evaluator are separate steps with separate instructions, so the customer's role cannot be changed by what a trainee types. Attempts to make the customer break character or reveal instructions are recognised and answered in character.
- A model never decides the customer's state. Customer state, discovery and curveball timing are computed in code, and every model output is validated before it is used. When a live model drafts the coaching, it proposes the six skill scores and the server checks them against the evidence; CARE behaviours, milestones, discovery and the overall score are always computed in code. Text that came from a model is shown as plain text, never as HTML.
- API keys, for the model and for speech, live only in the server's environment. They are never sent to the browser or written to logs.

**Honest feedback**

- Every quote in a report is checked against the turn it cites. A quote that does not appear there is removed before a report is saved.
- A score needs evidence: a 4 needs a verified quote and a 5 needs two. A short call says its report rests on limited evidence instead of inventing a full assessment, and a call of two trainee turns or fewer shows no overall score.
- Scores do not go down because of short messages, a terse style, grammar or spelling, an accent or non-native phrasing, or a communication style that differs from the reviewer's own ([care-cbcf-rubric.md](care-cbcf-rubric.md#what-is-never-scored)).
- Demo mode is always labelled. Replies and feedback from the built-in rules engine are never presented as coming from an AI model, and a live model is shown by its provider's name.
- The scripted demo speech provider is labelled "Demo speech (scripted)" on the pre-flight page and in voice settings, and says that it does not understand audio.
- CBCF mapping is not applied, and the report says so. No CBCF material was found in this repository or supplied for it, so Firefly makes no claim of alignment with it ([care-cbcf-rubric.md](care-cbcf-rubric.md#cbcf)).

**Human review**

- A mentor reading the transcript will see things the report cannot. Every report carries a note, in its About this report section, that a mentor's review adds what automatic coaching cannot. Firefly has no mentor tooling, and this repository holds no comparison of its scores with mentors' scores.

## Limits you should know about

- **Automatic coaching can be wrong.** The rules evaluator reads patterns in text, so it can miss a good way of saying something or read a sentence too generously. A model-written evaluation can be fluent and still mistaken. Quotes are shown so a person can check what a score rests on.
- **Tone of voice is not assessed.** Coaching reads the words that were said or typed. Warmth, pace, accent and pauses cannot be assessed, even when voice is used.
- **A simulation is not a customer.** A scenario has fixed facts, and the demo-mode customer is rules-based and less flexible than a person or a model.
- **English only**, and nothing here has been tested for how well it works for every kind of speaker. Non-native phrasing must never be marked down; if you see it happen, treat that as a bug.
- **Speech is only partly verified.** Azure AI Speech has never been run against the live service, and nothing has been tested with real speech or real recognition. The scripted demo speech works end to end in the browser tests, which run in Chromium with a fake microphone. See [voice-architecture.md](voice-architecture.md#verification).
- **Live models have had little testing.** Gemini had one limited smoke check on 21 Nov 2026 (two scripted calls; no errors, no retries, and no coaching or list-style replies found by simple automatic checks). That is a smoke check, not a quality evaluation: it says nothing about voice, other scenarios or paid-tier behaviour. Azure OpenAI and OpenAI-compatible services have been run only against a local fake server. None of this says how good a model's coaching is. See [ai-providers.md](ai-providers.md#status-of-each-provider).
- **Accessibility has not been checked with assistive technology.** See [accessibility.md](accessibility.md) for what was checked and what was not.
- **No certification.** Firefly makes no claim of compliance or alignment with any standard, framework or regulation, including CBCF, and nothing here is legal advice.

## For people who run Firefly

- **Where data lives.** In the default setup, everything is in a SQLite file on the machine that runs the server (`data/firefly.db`, git-ignored) and is not encrypted by Firefly. If you use a live model, redacted transcript text is sent to the provider you configure, and if you use a speech provider, recordings and the customer's lines go to it, so choose and configure them with your organisation's data rules in mind.
- **Free-tier model services may learn from what you send.** Google's Gemini API terms (effective 23 March 2026, read on 21 November 2026) say that, for unpaid services, Google uses the content you submit and the responses to improve its products, that human reviewers may read it, and that sensitive, confidential or personal information must not be submitted; terms differ by plan and region. Firefly sends only fictional scenario text and redacted trainee messages, so type nothing real. Read the provider's current terms before connecting any key. See [ai-providers.md](ai-providers.md#gemini-google-ai-studio).
- **Tell trainees which speech set-up is active.** The brief and the pre-flight page show it to them. Speech-to-text of something sensitive said aloud is processed by the provider you chose.
- **Keep API keys out of Git.** Keys belong in the git-ignored `.env`. If one is ever pasted into a chat, a ticket or a commit, treat it as exposed: delete it at the provider and create a new one.
- **Who can see it.** Firefly has no accounts: the anonymous cookie separates one browser's calls from another's on a shared server, but it is not authentication, and anyone with access to the server can read its database. Keep Firefly on a trusted network, or put sign-in and TLS in front of it.
- **Deleting data.** A call can be deleted from its report page ("Delete this call"). Deleting the database file removes everything.
- **Using it well.** Use scores to start a conversation with a mentor. Do not use them for evaluation, and do not publish individual results.
