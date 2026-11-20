# Firefly

**Practice difficult customer conversations before they become real ones.**

[![CI](https://github.com/snowjug/Firefly/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/snowjug/Firefly/actions/workflows/ci.yml?query=branch%3Amain)
[![Node.js 24 or newer](https://img.shields.io/badge/node-%E2%89%A524-339933?logo=nodedotjs&logoColor=white)](package.json)

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/images/home-dark.jpg">
    <img src="docs/images/home-light.jpg" alt="The Firefly home page: a greeting, a call left in progress with its instrument glyph and a Return to your call action, and a floating dock with six numbered destinations." width="900">
  </picture>
</p>

Firefly is a customer-call training simulator for new technical support engineers and apprentices. You choose a fictional customer, configure how difficult they are, hold an unscripted conversation (typed or, as a beta, spoken) with a simulated one, and get coaching tied to your own words. Technical knowledge alone does not make a good support experience, and learning conversation skills on live cases puts real customers at risk. Firefly lets trainees rehearse first.

| Status              | Detail                                                                                                                                                   |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Application         | Working. The interface was rebuilt as a spatial, editorial experience; see [The experience](#the-experience).                                            |
| Demo mode           | Available locally. No credentials needed: a built-in rules engine plays the customer and writes the coaching.                                            |
| Live model provider | Optional. Gemini has been run end to end against the real API; Azure OpenAI and OpenAI-compatible endpoints are tested only against a local fake server. |
| Voice               | Beta. Opt-in, works in Chromium-based browsers, and Firefly never records audio. See [Voice (Beta)](#voice-beta).                                        |
| Deployment          | Not deployed. Firefly runs on your own machine.                                                                                                          |

```bash
git clone https://github.com/snowjug/Firefly.git
cd Firefly
npm ci
npm run build
npm start
```

Then open <http://127.0.0.1:8787>. You need Node.js 24 or newer. [Getting started](#getting-started) covers development mode, live providers and tests.

**On this page:** [The experience](#the-experience) · [Why Firefly](#why-firefly) · [What it does](#what-firefly-does) · [Rewards](#rewards-for-practising) · [Voice](#voice-beta) · [Features](#key-features) · [Signal instrument](#the-signal-instrument) · [Scenario model](#scenario-model) · [Coaching dimensions](#coaching-dimensions) · [Architecture](#architecture) · [Tech stack](#tech-stack) · [Project structure](#project-structure) · [Getting started](#getting-started) · [Accessibility and performance](#accessibility-and-performance) · [Responsible AI](#responsible-ai-and-data-safety) · [Calibration](#evaluation-and-calibration) · [Testing](#quality-and-testing) · [Limitations](#current-limitations) · [Roadmap](#roadmap) · [Contributing](#contributing)

## The experience

A walk through one practice session. Open a section to see its screen. Every picture is a real screenshot of the running app in demo mode, with a fictional learner and practice calls driven by a script, so call lengths read as a few seconds. [The steps to regenerate them](#regenerate-the-screenshots) are below, and the design reasoning is in [docs/experience-design.md](docs/experience-design.md).

<details open>
<summary><strong>1 · A calm front door, then a console</strong></summary>

&nbsp;

![The front door: the line "Practice difficult customer conversations before they become real ones" in large serif type beside an engraved circular instrument with lettered marks A to F, and three plain statements beneath: fictional customers, no account, coaching not ranking](docs/images/landing.jpg)

The front door says what Firefly is and what it is not: fictional customers, no account, coaching rather than ranking. The engraved instrument is the one object the whole interface is built around (see [The Signal instrument](#the-signal-instrument)). **Sign-in is a local profile**: you give a name (a first name is enough) and it is saved in this browser. There is no account and no password, and organisation sign-in is not pretended.

![The home page in the dark theme: a greeting, a call in progress with its glyph, a Return to your call action, a suggested next mission, and the floating dock](docs/images/home-dark.jpg)

Home is a console rather than a wall of statistics: the call you left open (or the recommended mission and the reason it is recommended), the last call, the skill to work on next, and the way to start something new. A new learner sees an honest first-run state, never invented history.

</details>

<details>
<summary><strong>2 · Choose a mission, then calibrate the call</strong></summary>

&nbsp;

![The mission field: thirteen missions drawn as small instrument glyphs, grouped by family and labelled with difficulty and minutes, beside a key to what each mark means](docs/images/missions.jpg)

The 13 fictional missions are an atlas: each is a small glyph at a stable position, grouped by issue family. The marks are a key to the call. Rings are difficulty, size is business impact, the edge is how the customer starts, the shape of the heart is the call stage and its fill is whether you have practised it. A pointer light, arrow keys and a detail card help you explore, and a list with the same information is one press away (it is the default on a phone).

![Calibration: an engraved instrument that turns as the settings change, with lettered marks A to F and their meanings, beside the issue, a difficulty choice and a business impact choice, and an Enter the call button](docs/images/calibration.jpg)

Choosing a mission carries its glyph into the **calibration core**, an instrument that turns as you change difficulty, business impact, customer temperature, technical proficiency, communication style, call stage, curveballs and practice mode. Each choice says in a sentence what it does. Hidden facts are always on, because every scenario has details the customer shares only when you ask. The brief tells you the situation and your goal, never the hidden facts.

</details>

<details>
<summary><strong>3 · Hold the conversation (type it, or say it)</strong></summary>

&nbsp;

![A live call in guided practice: a presence made of concentric rings beside the customer's name, role and mood word, and the conversation set along a vertical line with the latest customer reply large, ideas to fill the message box, and the End call button](docs/images/call.jpg)

- The customer is an **abstract presence**, not a face: rings that tighten, fray and ease back with the customer's mood. Nothing is scripted: the customer reacts to what you say, holds facts back until you ask a fitting question, and may raise a curveball.
- The conversation is typeset along a line (a filament) rather than in chat bubbles: the speaker and turn in the margin, the latest customer reply large, your own turns in italic.
- **Guided practice** shows the mood in words with whether it is rising, steady or easing, how many signals (hidden facts) you have uncovered so far, a note when the customer's mood or the conversation shifts, and a few ideas that fill the message box without sending. **Immersive practice** shows none of that and keeps the presence neutral, because a real call would not show you.
- The field behind the page answers the conversation: it warms and tightens as the customer becomes frustrated, and opens again as they ease.

![A tense call: the customer has been blamed, the rings are compressed with a toothed edge, the field is warmer and the line has frayed](docs/images/call-tension.jpg)

- **Voice (Beta)** adds a microphone and spoken replies. See [Voice (Beta)](#voice-beta).

![Voice controls on the call: Voice call, Talk, Mute, Stop and a hands-free switch, a live status saying the customer is speaking and a line saying the browser's online speech service is recognising speech](docs/images/voice.jpg)

</details>

<details>
<summary><strong>4 · Read the debrief (it opens as soon as you end the call)</strong></summary>

&nbsp;

![The top of the practice coaching report: the mission title, the customer, the date and status, the frozen presence at the end of the call, a line tracing the customer's mood through the call and a section rail](docs/images/report.jpg)

Ending a call locks the transcript, shows the real stages of evaluation, and opens the full coaching report: six skill scores with evidence labels, what went well, skill details with quoted moments, opportunities with a stronger way to say it, a discovery review, the customer's journey through the call, the rewards the call earned and one next practice target.

![The customer's journey: a line across the call with turning points marked, and the text of the selected turning point](docs/images/journey.jpg)

![One skill in the report: Opening and Rapport scored 5 of 5, the reason, three quoted moments that each link to their turn in the conversation, and what to try next](docs/images/evidence.jpg)

![Discovery: how many of the hidden facts were found, and for each one whether it was found, the trainee's own question that brought it out, linked to its turn, and what the customer had held back](docs/images/discovery.jpg)

A call that ends early is labelled as such, and the report says its scores rest on limited evidence instead of inventing a complete assessment. **Report incorrect feedback** copies a note for a mentor (a session id, a skill and a turn number, never the transcript) and links to a public issue with a warning not to paste customer information.

</details>

<details>
<summary><strong>5 · Earn points, review history, watch the sky fill in</strong></summary>

&nbsp;

![My progress: six clusters of stars, one for each coaching skill, lit as far as completed calls support, with the skill to focus on next and a summary beside it](docs/images/progress.jpg)

Progress is a constellation: six clusters of fourteen stars, one cluster for each coaching skill, lit only as far as completed calls support. An outline means no evidence yet, which is not a low score.

![Recognition: 375 points and a level, with badges drawn as engraved marks that say Earned, In progress or Locked in words, and tabs for badges and challenges](docs/images/recognition.jpg)

Recognition sits below the sky (`/rewards` leads there): points, never a leaderboard, with the reason for every award. See [Rewards for practising](#rewards-for-practising).

![My practice history: a trail of calls grouped by month, each with its glyph, date, title, customer, difficulty, status and score](docs/images/history.jpg)

History is a month-by-month trail. Filter it, reopen a report or transcript, compare two finished calls, practise a scenario again or delete a call.

</details>

<details>
<summary><strong>6 · Studio, settings, and every screen size</strong></summary>

&nbsp;

![The Studio: the Calibration tab of the mentor tools, with an explanation of why to calibrate and four steps](docs/images/studio.jpg)

The Studio holds the trainer tools and the mentor calibration flow, and is deliberately the quietest part of the product. See [Evaluation and calibration](#evaluation-and-calibration).

![Settings, on the Preferences tab: the default difficulty, when to show hints and the voice switch, under tabs for Profile, Preferences, Notifications and Data and privacy](docs/images/settings.jpg)

![The home page, a live call and a coaching report on a phone-sized screen](docs/images/mobile.jpg)

Phone to ultra-wide, light and dark themes, reduced motion from the device or the app, a persistent **Pause ambient motion** control, keyboard-only use (Ctrl or Cmd + K opens a palette to go anywhere), an optional tour, and a calm notice when the browser goes offline. See [Accessibility and performance](#accessibility-and-performance).

</details>

## Why Firefly?

Technical knowledge alone does not guarantee a strong support experience. Trainees also have to learn to:

- open calls professionally and establish business impact
- scope unclear issues with focused discovery questions
- communicate without unnecessary jargon
- handle frustrated or escalating customers and de-escalate
- take ownership, set expectations and agree on next steps
- close calls professionally

Practising these skills only on live cases creates risk for customers and delays useful feedback. Firefly gives trainees a place to rehearse as often as they like, and shows them where a call went well or badly, in their own words.

It is an FY27 apprentice team project. It focuses on customer-handling and support-conversation skills and is product-agnostic: it does not teach the details of any one product. All scenarios are fictional and every customer detail is synthetic. Firefly is a coaching tool, not an employee-performance assessment system.

## What Firefly does

```mermaid
flowchart LR
  A["Configure<br/>pick a scenario, shape the customer"] --> B["Simulate<br/>an unscripted conversation"]
  B --> C["Adapt<br/>the customer reacts, facts surface, curveballs land"]
  C --> D["Evaluate<br/>six skills, verified quotes, a mood timeline"]
  D --> E["Improve<br/>rewards, history, progress, the next call"]
  E --> A
```

| Stage         | What happens                                                                                                                                                                                                              |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Configure** | Choose one of 13 fictional scenarios and set its business impact, customer temperature, technical proficiency, communication style, call stage and difficulty, with optional curveballs, on one page.                     |
| **Simulate**  | Start the call and hold an unscripted conversation with a simulated customer, typed or spoken. The preview never shows hidden facts.                                                                                      |
| **Adapt**     | The customer's mood, trust and patience move with what the trainee says. Hidden facts appear only for relevant questions, and a curveball may land mid-call.                                                              |
| **Evaluate**  | Ending the call opens a coaching report: six scored skills with verified quotes, strengths, improvements with alternative phrasing, a discovery review, a mood timeline, the rewards earned and one next practice target. |
| **Improve**   | Reopen any report from History, follow quotes into the transcript, earn points and badges for practising, and use Progress to see each skill's trend and what to work on next.                                            |

## Rewards for practising

Firefly rewards **practising**, never speed, volume or a high score on its own. Rewards are points, four levels, a streak and six badges, shown under Recognition on the Progress page. Each is worked out from your saved calls every time it is asked for, by plain tested rules (`shared/domain/rewards.ts`, served by `GET /api/rewards`), so nothing is stored, nothing can be paid twice, and deleting a call takes back exactly what it earned. Every entry in the points history gives the reason and, where there is one, the quoted moment. The full rules are in [docs/rewards.md](docs/rewards.md).

| Rule                              | Points          | Earned when                                                                                            |
| --------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------ |
| **Complete a full scenario**      | 50 (repeats 10) | You take a call all the way to a close with enough said for real coaching. Ending early earns nothing. |
| **Uncover a hidden fact**         | 10              | A question of yours brought out something the customer had not volunteered. Each fact pays once.       |
| **Give a clear owner and update** | 10              | You named the owner, the next step and when the customer will hear back, and the report quotes you.    |
| **Lift a skill**                  | 15              | A skill scored a point above your own recent average at the same difficulty.                           |
| **Try a new scenario family**     | 20              | Your first full call in a kind of customer issue you have not practised.                               |
| **Practise on a day**             | 5               | At least one full call on a calendar day. A missed day never costs you anything.                       |
| **A mentor confirms the result**  | 25              | A mentor reviewed the call and scored every skill within one point of the rubric result.               |

**Levels** need both points and breadth: Foundation, Builder (150 points, 2 kinds of call), Practitioner (400, 4) and Confident Handler (800, 6). **Badges:** First Practice, Scope Detective, De-escalator, Ownership Builder, Scenario Explorer and Consistency Streak.

**Deliberately missing:** no leaderboard, no ranking, no comparison with colleagues, no points for speed or call length, no reward for the overall score alone, and nothing taken away for a retry or a missed day. Sample sessions never earn anything.

## Voice (Beta)

Voice lets you practise the way a call happens: you **speak**, and the simulated customer **answers out loud**. It is optional, **off until you turn it on in Settings or on the call screen**, and typing always keeps working.

- **How it works.** Your browser turns speech into text (the Web Speech API), and Firefly receives only that text, which goes through the same personal-data check as typed text. The customer's replies are read aloud with a voice from your browser. Short call tones are generated in the browser. The microphone is closed while the customer speaks.
- **Hands-free or push to talk.** Hands-free listens again by itself after the customer finishes. Push to talk listens when you press the button and lets you edit the text before sending. Every message also has a "Listen" button.
- **Privacy, plainly.** Firefly never records, keeps or uploads audio. In Chrome and Edge the browser itself usually sends your audio to its maker's online speech service, unless the device can recognise speech on-device (Firefly asks for that when the browser offers it). Some browser voices are online voices too. Turning voice on shows this first. See [docs/voice.md](docs/voice.md#what-leaves-your-device).
- **Honest limits.** Speech input works in Chromium-based browsers over https or localhost; speech output works in most. Recognition can mishear words, so a call that used voice carries a reminder to check the quotes against the transcript, and coaching reads words only, not tone, accent or pace. There is no recording, and you cannot interrupt the customer by speaking (use Stop or Talk to take the turn). Firefly's server allows the microphone for its own pages only (`Permissions-Policy: microphone=(self)`); a proxy that sends `microphone=()` makes the browser refuse speech input. It has been checked in Edge with a synthetic audio device, not with a person speaking.

## Key features

| Area                                                                                  | Status                                                                                                                                             |
| ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Front door, local profile, command dock and palette, light and dark themes            | Implemented and verified by unit and browser tests                                                                                                 |
| Mission atlas, calibration core, live call                                            | Implemented and verified by unit and browser tests                                                                                                 |
| Customer simulation, hidden facts, curveballs                                         | Implemented and verified (rules engine in demo mode)                                                                                               |
| Call feedback: scores, evidence, discovery, customer journey, next practice           | Implemented and verified (rules evaluator in demo mode)                                                                                            |
| Rewards: points, levels, streak, badges, challenges, points history                   | Implemented and verified (pure rules with tests; endpoint tested)                                                                                  |
| History, Progress, transcript review                                                  | Implemented and verified                                                                                                                           |
| Animated field, effects tiers, reduced motion, pause control                          | Implemented and checked in Chromium-based browsers. Not measured on a range of real devices.                                                       |
| Voice (Beta): speech input, spoken replies, call tones                                | Implemented against fake browser speech APIs in tests. Not verified with a real microphone on every browser.                                       |
| Mentor review and calibration tooling, trainer tools                                  | Implemented and verified. No real mentor data exists yet.                                                                                          |
| Notifications (in the bell menu only), optional sound, first-run tour, offline notice | Implemented and verified                                                                                                                           |
| Live Gemini provider                                                                  | Implemented. Needs an API key. Run end to end against the real Gemini API in a few scripted calls; free-tier rate limits and data-use terms apply. |
| Live Azure OpenAI or OpenAI-compatible provider                                       | Implemented. Requires credentials. Tested only against a local fake server; not verified against a real service.                                   |
| Accessibility                                                                         | Automated checks and keyboard tests pass. No screen-reader validation.                                                                             |
| Hosted deployment, organisation sign-in, trainer-authored scenarios                   | Not implemented (future work)                                                                                                                      |

<details>
<summary><strong>Adaptive customer, hidden facts, curveballs, coaching and tools in detail</strong></summary>

### Configurable scenarios

There are 13 fictional scenarios (4 Starter, 5 Standard, 4 Challenge) across 7 issue types. Each can be reconfigured before a call, and the settings used are stored with the session so a call can be replayed and evaluated as it was configured. See [Scenario model](#scenario-model). Every scenario is checked by `npm run validate:scenarios` and the library tests, which fail if a hidden fact cannot be found or leaks into the customer's opening.

### Adaptive customer simulation

In demo mode the customer is produced by a deterministic rules engine. It classifies what the trainee did (empathy, ownership, next steps, jargon, blame, focused questions and more), updates the customer's state, and composes a reply grounded in the scenario's persona, communication style, proficiency and the facts the customer is allowed to share.

- **Customer state.** Seven bounded values (0-100), among them temperature, trust, patience, confidence and urgency, changed only by explicit rules. Trainees see the mood in words (Calm, Concerned, Frustrated, Angry, Escalating) and its trend, never the numbers.
- **Behaviour that matters.** Specific empathy, acknowledging impact, clear ownership and focused questions help. Blame, dismissal, unexplained jargon, repeated questions and premature fixes hurt.
- **Practice modes.** Guided practice shows light cues (mood, hints, areas worth exploring). Immersive practice shows none.

### Hidden-fact discovery

Each scenario holds facts the customer reveals only when asked an appropriate question. Some also need enough trust or an acknowledgement of the impact first. After the call, the report lists which facts were found, partly found or missed, the question that revealed each, and a better question for any that were missed.

### Controlled curveballs

Curveballs are optional. There are eight types: asks for a manager, threatens to cancel, imposes a deadline, changes the issue, goes quiet, mentions a bad experience, demands a guarantee and challenges credibility. Each fires deterministically when its conditions are met (a window of turns plus a state condition, such as ownership still being unclear), and the report says how the trainee handled it.

### Evidence-based coaching

Each report scores six dimensions from 1 to 5 and includes a rationale for every score with verified quotes from the trainee's own turns, strengths and improvement opportunities with alternative phrasing, discovery results (including what the customer held back), the customer's journey (a mood line with turning points linked to the transcript), an assessment of any curveball and one suggested next practice target. Short calls say that the report rests on limited evidence. See [Coaching dimensions](#coaching-dimensions).

### History, progress and the mentor tools

**History** is a month-by-month trail of practice sessions. Filter them, reopen a report or transcript, compare two finished sessions, retry a failed report or delete one. **Progress** shows the skill constellation (each skill's trend with a text summary, where to focus next and the opportunities that keep repeating) with points and badges under Recognition. It is for personal coaching: practice signals from a handful of calls, never an assessment, and never compared with other people. A mentor can score a completed session from its transcript alone and then see how the evaluator's scores compared (the Calibration tab of the **Studio**); `npm run calibrate` compares scores kept in files. The Studio's Trainer tab offers a spotlight scenario, a quick start, a demo checklist, the provider status, labelled sample sessions and confirmed resets. See [Evaluation and calibration](#evaluation-and-calibration).

### Demo and live provider modes

|                     | Demo mode (default)                                                | Live mode (optional)                                                                         |
| ------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| Set with            | `FIREFLY_PROVIDER=mock`, or leave it unset                         | `FIREFLY_PROVIDER=gemini`, `azure-openai` or `openai-compatible`                             |
| Credentials         | None                                                               | Required (see [Configure a live provider](#configure-a-live-provider))                       |
| Customer replies    | Rules engine, from phrase banks, scenario facts and customer state | A model, from what the engine has allowed the customer to say in that reply                  |
| Turn classification | Rules                                                              | A model                                                                                      |
| Coaching            | Rules evaluator                                                    | A model drafts it; the server verifies every quote and caps scores by the evidence           |
| Labelled in the app | "Demo mode (built-in rules engine)"                                | The configured provider                                                                      |
| Status              | Verified                                                           | Gemini: run end to end against the real API. Others: tested only against a local fake server |

If a live provider is requested but its variables are incomplete, Firefly starts in demo mode and prints a notice that names the missing variables (verified). Customer state, discovery, curveballs and the checks on the report stay in code in both modes. Details are in [docs/ai-providers.md](docs/ai-providers.md).

</details>

## The Signal instrument

One drawing carries most of the interface, so a mission, a calibration, a live customer and a finished call read as the same object. Every mark is also written out in words, so nothing is carried by shape or colour alone.

| Mark         | Meaning                                                                                                             |
| ------------ | ------------------------------------------------------------------------------------------------------------------- |
| Rings        | Difficulty: Starter one ring, Standard two, Challenge three                                                         |
| Overall size | Business impact: low, medium or high                                                                                |
| Edge         | How the customer starts: calm is a smooth line, anxious round dashes, frustrated long and short dashes, angry teeth |
| Heart shape  | Call stage: first contact a circle, follow-up a diamond, escalated a triangle, closure a square                     |
| Heart fill   | Status: new is an outline, attempted is half filled, completed is solid                                             |
| Ticks        | Duration: one tick is a minute                                                                                      |
| Glint        | The recommended next mission                                                                                        |

On the mission atlas it is a glyph. On the calibration page it is an engraved core that turns as the settings change. On the live call it is the customer's presence: mood changes its compression, edge and fragmentation, and a discovery lights a dot on its rim. In the report and in History it is the presence frozen at the moment that matters, and the same stars at sky scale are the Progress constellation. The design reasoning, the motion rules and the three directions that were prototyped before this one was chosen are in [docs/experience-design.md](docs/experience-design.md).

## How a simulation works

1. **Create a profile** (a name, kept in your browser) and open **Home**.
2. **Choose a mission** on the atlas, or take the recommended one, and **calibrate the call**: difficulty, business impact, customer temperature and the rest. Keep the defaults if you like.
3. **Enter the call.** Read the situation and your goal in the brief; hidden facts are never shown.
4. **Hold the conversation.** Type in your own words, or turn on voice. Nothing is scripted.
5. **Ask discovery questions:** what is happening, when it started, what changed, who is affected, what the screen says, what was tried and what it means for the business.
6. **Respond to changing behaviour and curveballs.** Acknowledge impact, take ownership and notice what moves the customer's mood.
7. **End the call.** Firefly asks for confirmation, locks the transcript and shows the stage of evaluation it has actually reached.
8. **Read the debrief** and follow quotes into the transcript.
9. **See what you earned** on the report and under Recognition, reopen the call from History, and watch your Progress.

## Scenario model

| Parameter             | Purpose                                      | Options                                                                                                             |
| --------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Issue type            | Defines the fictional support problem        | Sign-in or access, service outage, slow performance, data missing, billing or licence, how-to, feature not working  |
| Business impact       | Controls customer urgency                    | Low, medium, high                                                                                                   |
| Customer temperature  | Establishes starting behaviour               | Calm, anxious, frustrated, angry / escalating                                                                       |
| Technical proficiency | Controls vocabulary and technical depth      | Novice, intermediate, expert                                                                                        |
| Communication style   | Changes how the customer communicates        | Talkative, terse, demanding, vague, non-native English speaker                                                      |
| Call stage            | Establishes expectations and prior history   | First contact, follow-up, escalated, closure                                                                        |
| Hidden facts          | Tests discovery and scoping                  | Defined per scenario and always on. Starter has fewer in play and clearer clues; Challenge puts every fact in play. |
| Curveballs            | Introduces controlled complications          | Eight types. Up to one at Starter (off by default) and Standard, up to two at Challenge.                            |
| Difficulty            | Bundles scenario complexity                  | Starter, Standard, Challenge                                                                                        |
| Practice mode         | Sets how many cues are shown during the call | Guided (the Starter default) or immersive (the Standard and Challenge default)                                      |

Difficulty also sets the customer's starting trust and patience, how strongly good and bad behaviour moves them and how readily they volunteer context. Scenarios are written as TypeScript files; see [docs/scenario-authoring.md](docs/scenario-authoring.md).

## Coaching dimensions

Scores are whole numbers from 1 (not demonstrated) to 5 (excellent). The overall score is the mean of the six, rounded to one decimal place, and is left out when the call was too short to judge.

| #   | Dimension               | What it looks at                                                         | CARE behaviour (working mapping) |
| --- | ----------------------- | ------------------------------------------------------------------------ | -------------------------------- |
| 1   | Opening & Rapport       | Greeting, introduction, an open question, early connection               | Communicate, Be empathetic       |
| 2   | Scoping & Discovery     | Focused questions, hidden facts found, core topics covered               | Be resourceful                   |
| 3   | Empathy & De-escalation | Specific empathy, acknowledging impact, how the customer's mood moved    | Be empathetic                    |
| 4   | Clarity                 | Plain language, jargon explained, recap and check-ins                    | Communicate                      |
| 5   | Ownership & Next Steps  | Clear ownership, specific next steps with a time, realistic promises     | Be accountable                   |
| 6   | Closing                 | Recap of what was agreed, next contact confirmed, anything else, goodbye | Be accountable, Communicate      |

- **Evidence rules.** A 4 needs one verified quote and a 5 needs two. Quotes are checked against the trainee turn they cite before a report is saved.
- **Never penalised.** Short messages, grammar, spelling, an accent or non-native phrasing never lower a score.
- **Limited evidence.** Short calls are labelled as resting on limited evidence.
- **CARE mapping.** The rubric maps the dimensions loosely to the four CARE behaviours (communicate effectively, be accountable, be resourceful, be empathetic). It is a working aid for coaching conversations, not an official standard.

The full rules are in [docs/evaluation-rubric.md](docs/evaluation-rubric.md).

## Architecture

Firefly is a single Node.js process. It serves a JSON API and the built web app, and keeps everything in a local SQLite file.

```mermaid
flowchart LR
  subgraph Browser
    UI["React single-page app<br/>front door, command dock, signal field"]
    LOCAL[("This browser only<br/>profile, preferences, theme,<br/>notices seen, voice-call ids")]
    SPEECH["Browser speech features<br/>recognition, synthesis, Web Audio"]
  end
  subgraph Server["Node server, one process"]
    API[HTTP API and static files]
    SVC[Session service]
    ENG[Simulation engine]
    EVAL[Coaching evaluator]
    RW[Rewards service]
    PROV[Model provider]
    DB[(SQLite)]
  end
  UI --> LOCAL
  UI <--> SPEECH
  UI -->|JSON over HTTP, anonymous cookie profile| API
  API --> SVC
  API --> RW
  SVC --> ENG
  SVC --> EVAL
  ENG --> PROV
  EVAL --> PROV
  SVC --> DB
  RW --> DB
  PROV -.->|only when configured| LLM[Gemini, Azure OpenAI or an OpenAI-compatible endpoint]
```

```mermaid
flowchart TD
  A["Scenario configuration<br/>13 scenarios, one setup page"] --> B[Practice session]
  B -->|trainee message: typed or recognised text| C["Customer simulation<br/>classify, discover, update state, curveballs, reply"]
  C -->|customer reply| B
  C --> D[("Transcript and state events<br/>SQLite")]
  D --> E["Evaluation<br/>six dimensions, verified quotes"]
  E --> F[Coaching report]
  F --> G["Rewards, history, progress"]
  D --> H[Mentor review and calibration]
  F --> H
  C -.->|only when configured| P["Live model provider"]
  E -.->|only when configured| P
```

### One message, end to end

```mermaid
sequenceDiagram
  participant T as Trainee (browser)
  participant S as Session service
  participant C as Classifier (rules or model)
  participant E as Engine
  participant P as Customer writer (demo or live)
  T->>S: POST /api/sessions/:id/messages (text, clientMessageId)
  S->>C: what did the trainee just do?
  C-->>S: classification
  S->>S: save the trainee turn first
  S->>E: discovery, then customer state, then curveballs
  E->>P: write the reply from the facts the customer may share
  P-->>E: reply text
  E-->>S: reply, state events, discovery records
  S->>S: save reply, events and runtime in one transaction
  S-->>T: reply and the public state (mood band, trend, facts found)
```

### Ending a call

```mermaid
stateDiagram-v2
  [*] --> active
  active --> completing: End call
  completing --> completed: report saved
  completing --> evaluation_failed: evaluation error
  evaluation_failed --> completing: retry
  completed --> [*]
```

- **Frontend.** A React single-page app on a React Router data router, with a public frame (front door, sign-in), an app frame (a masthead, the page and a command dock) and a call frame (the page owns the whole screen). One lazy route per screen: Home, Practice, Missions, Setup (the calibration core), Call, Report, Transcript, History, Progress (with Recognition), Studio (Trainer and Calibration), Settings, Help and a designed not-found page. The tour and the animated field are their own chunks, so neither is part of the first download. The shape of the web app is sketched below.
- **Identity.** A local profile in `localStorage` (a name, an optional role and location, a few preferences). There is no account. The server separates one browser's practice from another's with an anonymous cookie.
- **Server and API.** A hand-written router on `node:http`, with a strict Content-Security-Policy, same-origin checks on writes and rate limits.
- **Simulation.** A deterministic rules engine runs every turn: classify, apply discovery rules, update the bounded customer state, check curveball triggers, then compose the reply. The trainee's message is saved before the reply, so a failed reply loses nothing and a retry creates no duplicate.
- **Evaluator.** Scores the transcript and the engine's records, verifies every quote and builds the report. Ending a call is a real state change with phases, and exactly one report is saved.
- **Rewards.** Pure functions over the saved calls, reports and mentor reviews; the only API addition of the redesign is `GET /api/rewards`.
- **Voice.** Browser speech features behind one hook (`useVoiceCall`); only recognised text reaches the server.
- **Live model provider.** Optional and off by default. A model can classify turns, write replies and draft the coaching, but the state, discovery, curveballs and checks stay in code.
- **Persistence.** SQLite through `node:sqlite`, with versioned migrations. Transcripts, state events, reports and mentor reviews are stored locally.
- **Visuals.** The Signal instrument drawn in SVG, a Canvas2D field behind the page, plain CSS on design tokens, three self-hosted open-licensed fonts, the View Transitions API for route changes, and no raster images. No animation, 3D, chart, icon or UI library.

```mermaid
flowchart TD
  M["main.tsx<br/>theme, ambient motion, effects tier,<br/>config, notices, error boundary"] --> R["Data router<br/>lazy pages, view transitions"]
  R --> SH["Shell<br/>masthead, command dock, palette, colophon"]
  SH --> P["Pages<br/>Home, Missions, Setup, Call, Report,<br/>History, Progress, Studio, Settings"]
  P --> SIG["Signal components<br/>glyph, core, presence, constellation"]
  P --> API["Typed API client<br/>anonymous cookie profile"]
  M -.-> W["Signal field<br/>Canvas2D, lazy, effects tiers"]
```

See [docs/architecture.md](docs/architecture.md) for the full picture and [docs/experience-design.md](docs/experience-design.md) for the design.

## Tech stack

| Layer          | Technology                                                                                                                                                             |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend       | React 19, React Router 7, Vite 8, TypeScript 5.9 (strict)                                                                                                              |
| Visuals        | SVG instruments, a Canvas2D field, CSS custom properties, three self-hosted open-licensed fonts, the View Transitions API. No animation, 3D, chart, icon or UI library |
| Audio          | Optional tones synthesised with the Web Audio API. Voice uses the browser's Web Speech API. No audio files                                                             |
| Server and API | Node.js 24 or newer running TypeScript directly, `node:http` (no web framework), zod 4 for validation                                                                  |
| Simulation     | Deterministic TypeScript rules engine in `server/engine` (classifier, discovery, state, curveballs)                                                                    |
| AI provider    | Built-in demo provider by default. Optional Gemini, Azure OpenAI or OpenAI-compatible chat completions via `fetch`                                                     |
| Styling        | Plain CSS on design tokens, light and dark themes, no UI framework                                                                                                     |
| Testing        | Vitest 5 with Testing Library and jsdom; Playwright 1.65 with axe-core                                                                                                 |
| Code quality   | ESLint 9 (typescript-eslint, jsx-a11y, react-hooks), Prettier 3 and bundle-size budgets (`npm run check:budgets`)                                                      |
| CI             | GitHub Actions                                                                                                                                                         |
| Storage        | SQLite file through `node:sqlite`; the browser's `localStorage` for the local profile and preferences                                                                  |

The runtime dependencies are React, React Router and zod. The redesign, rewards and voice added none.

## Project structure

```text
Firefly/
├── server/                 Node.js server, written in TypeScript
│   ├── engine/             Simulation engine and the demo-mode customer
│   ├── scenarios/          Scenario registry and the 13 built-in scenarios
│   ├── evaluator/          Coaching evaluator and verification of model drafts
│   ├── providers/          Demo and live model providers
│   ├── prompts/            Versioned prompts used in live mode
│   ├── services/           Sessions, progress, calibration, rewards, sample data
│   ├── db/                 SQLite schema, migrations and queries
│   └── http/               Router, API routes, security, static files
├── shared/domain/          Types, schemas and pure logic shared by server and web,
│                           including rewards, achievements and recommendations
├── web/src/
│   ├── pages/              One lazy-loaded route per screen
│   ├── components/         signal (the instrument), frame (primitives), shell (masthead, dock,
│   │                       palette), world (the field), atlas, call, voice, report, progress,
│   │                       rewards, dashboard, history, settings, trainer, calibration, tour
│   │                       and more
│   ├── lib/                API client, hooks, profile, theme, sound, voice engine, tour,
│   │                       motion (ambient pause, pointer light, view transitions), effects tiers
│   └── styles/             Design tokens, base, type, materials and transitions, then plain CSS
│                           with one file per area
├── web/public/fonts/       Self-hosted fonts and their licences
├── e2e/                    Playwright browser tests
├── calibration/samples/    Invented example records for the calibration tool
├── scripts/                Dev runner, scenario validation, calibration CLI, screenshot tool,
│                           performance probe, bundle-size budgets, secret and lockfile checks
├── docs/                   Architecture, experience design, design system, accessibility,
│   │                       performance, attribution, rubric, providers, rewards, voice,
│   │                       calibration, demo guide
│   └── images/             Screenshots used in this README
├── .github/workflows/      Continuous integration
├── .env.example            Configuration template with placeholders only
└── package.json            Scripts and dependencies. The tool configs (vite, vitest, playwright, eslint, tsconfig) sit beside it.
```

## Getting started

### Prerequisites

- **Node.js 24 or newer.** This is the `engines` requirement in `package.json`, because the server runs TypeScript directly and uses the built-in `node:sqlite`. Older versions are not supported.
- **npm**, which comes with Node.js.
- **No credentials** for demo mode.
- **A Chromium-based browser** to run the browser tests (see [Test](#test)) and to try voice input.

### Install and run in demo mode

```bash
git clone https://github.com/snowjug/Firefly.git
cd Firefly
npm ci
npm run build
npm start
```

No credentials are needed. Open <http://127.0.0.1:8787>, choose **Begin** and enter a name. The label beside the wordmark says "Demo mode". Data is kept in `data/firefly.db`, which is git-ignored.

| Goal                    | Command                           | Opens at                                                                                  |
| ----------------------- | --------------------------------- | ----------------------------------------------------------------------------------------- |
| Use the built app       | `npm run build`, then `npm start` | <http://127.0.0.1:8787>                                                                   |
| Develop with hot reload | `npm run dev`                     | <http://localhost:5173> (the API runs on port 8787 and restarts when server files change) |

If port 8787 is busy, set `FIREFLY_PORT`. Firefly has no account system, so keep `FIREFLY_HOST` on its loopback default.

### Configure a live provider

Copy `.env.example` to `.env` (also git-ignored) and fill in **one** provider. Use your own values; never commit real keys.

For Google's Gemini API (a key from [Google AI Studio](https://aistudio.google.com/apikey); only the key is required):

```bash
FIREFLY_PROVIDER=gemini
GEMINI_API_KEY=<your-api-key>
```

Gemini defaults to `gemini-3.5-flash-lite`; set `GEMINI_MODEL` to use another model. A free-tier project is rate limited (15 requests per minute for that model when this was tested, and each message sent uses two), and Google's terms say it uses content sent through unpaid services to improve its products and that human reviewers may read it, so use fictional scenarios only. Details are in [docs/ai-providers.md](docs/ai-providers.md#gemini-google-ai-studio).

For Azure OpenAI:

```bash
FIREFLY_PROVIDER=azure-openai
AZURE_OPENAI_ENDPOINT=<https://your-resource.openai.azure.com>
AZURE_OPENAI_API_KEY=<your-api-key>
AZURE_OPENAI_DEPLOYMENT=<your-deployment-name>
AZURE_OPENAI_API_VERSION=<api-version>
```

For any OpenAI-compatible chat-completions endpoint:

```bash
FIREFLY_PROVIDER=openai-compatible
FIREFLY_LLM_BASE_URL=<https://your-endpoint/v1>
FIREFLY_LLM_API_KEY=<your-api-key>
FIREFLY_LLM_MODEL=<model-name>
```

The console prints which provider is running when the server starts, and the app labels it everywhere. Only Gemini has been run against a real service (see [Verified against the Gemini API](docs/ai-providers.md#verified-against-the-gemini-api)); run the smoke test in [docs/ai-providers.md](docs/ai-providers.md) with your own credentials before relying on Azure OpenAI or an OpenAI-compatible endpoint. To go back to demo mode, set `FIREFLY_PROVIDER=mock` and restart.

### Build

```bash
npm run build
```

This writes the production web app to `dist/web`.

### Test

| Purpose                                | Command                                                     |
| -------------------------------------- | ----------------------------------------------------------- |
| Everything below plus the build        | `npm run check`                                             |
| Unit, component and API tests          | `npm test`                                                  |
| Browser tests, including accessibility | `npm run test:e2e`                                          |
| Scenario validation                    | `npm run validate:scenarios`                                |
| Calibration on the bundled sample data | `npm run calibrate`                                         |
| Secret scan                            | `npm run check:secrets`                                     |
| Bundle-size budgets (after a build)    | `npm run check:budgets`                                     |
| Lockfile and registry check            | `npm run check:lockfile`                                    |
| Format, lint and type checks           | `npm run format:check`, `npm run lint`, `npm run typecheck` |

`npm run check` runs formatting, lint, types, scenario validation, tests, the build, the bundle budgets, the secret scan and the lockfile check in that order. Browser tests need a browser: install Playwright's with `npx playwright install chromium`, or reuse an installed Edge or Chrome by setting `PW_CHANNEL=msedge` (in PowerShell: `$env:PW_CHANNEL = 'msedge'`). See [docs/troubleshooting.md](docs/troubleshooting.md) if anything does not start.

### Regenerate the screenshots

The pictures in this README come from a script, so they can be refreshed after a design change. Start Firefly in demo mode with an empty in-memory database, then run the script (its options are documented at the top of the file). It uses an installed browser through `PW_CHANNEL` (`msedge` or `chrome`) and pins the animated field to its highest effects tier, so the pictures show what a capable device shows:

```bash
FIREFLY_DB_PATH=:memory: FIREFLY_PROVIDER=mock FIREFLY_MOCK_DELAY_MS=120 FIREFLY_PORT=4444 npm start
node scripts/readme-screenshots.mjs --base http://127.0.0.1:4444
```

<details>
<summary><strong>Environment variables</strong></summary>

Firefly loads `.env` at startup, and variables already in the environment win. Nothing is required for demo mode.

| Variable                                                                                               | Required                         | Purpose                                                                                                                         |
| ------------------------------------------------------------------------------------------------------ | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `FIREFLY_PROVIDER`                                                                                     | No (default `mock`)              | `mock` (demo mode), `gemini`, `azure-openai` or `openai-compatible`                                                             |
| `GEMINI_API_KEY`                                                                                       | Only with `gemini`               | Google Gemini API key. Keep it in the git-ignored `.env`.                                                                       |
| `GEMINI_MODEL`, `GEMINI_BASE_URL`                                                                      | No (with `gemini`)               | Model (default `gemini-3.5-flash-lite`) and OpenAI-compatible endpoint (default Google's)                                       |
| `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_DEPLOYMENT`, `AZURE_OPENAI_API_VERSION` | Only with `azure-openai`         | Azure OpenAI chat-completions deployment                                                                                        |
| `FIREFLY_LLM_BASE_URL`, `FIREFLY_LLM_API_KEY`, `FIREFLY_LLM_MODEL`                                     | Only with `openai-compatible`    | Any OpenAI-compatible chat-completions endpoint                                                                                 |
| `FIREFLY_LLM_TIMEOUT_MS`                                                                               | No (default `30000`)             | Timeout for each model call                                                                                                     |
| `FIREFLY_LLM_MAX_RETRIES`                                                                              | No (default `1`, at most `3`)    | Retries for a failed model call                                                                                                 |
| `FIREFLY_PORT`                                                                                         | No (default `8787`)              | Port the server listens on                                                                                                      |
| `FIREFLY_HOST`                                                                                         | No (default `127.0.0.1`)         | Address the server listens on. Keep it on loopback: there is no sign-in.                                                        |
| `FIREFLY_DB_PATH`                                                                                      | No (default `./data/firefly.db`) | SQLite file. `:memory:` keeps data in memory.                                                                                   |
| `FIREFLY_LOG_LEVEL`                                                                                    | No (default `info`)              | `info`, `warn`, `error` or `silent`. Logs never contain transcripts.                                                            |
| `FIREFLY_MOCK_DELAY_MS`                                                                                | No (default `700`)               | Pause before demo-mode replies so the typing state is visible                                                                   |
| `FIREFLY_TEST_HOOKS`, `FIREFLY_DEV_DIAGNOSTICS`                                                        | No (off)                         | Failure injection and internal diagnostics for tests. Never enable on a shared host.                                            |
| `FIREFLY_WEB_DIR`                                                                                      | No (default `dist/web`)          | Which web build the server serves, so several builds can run side by side                                                       |
| `FIREFLY_OUT_DIR`, `FIREFLY_WEB_PORT`                                                                  | No (build and development)       | Where `vite build` writes (relative to `web/`, default `../dist/web`), and the Vite development port (default `5173`)           |
| `PW_CHANNEL`, `E2E_PORT`, `E2E_BASE_URL`                                                               | No (tests only)                  | Playwright: browser channel such as `msedge`, test server port (default `4321`), or the URL of a server that is already running |

</details>

## Accessibility and performance

**Accessibility.** WCAG 2.2 AA is the target and a release requirement. It is a target, not a certificate: nobody outside the team has audited Firefly. The interface is spatial and animated, so the rule is that nothing depends on colour, motion or a pointer:

- Every spatial view has a written or list alternative: the mission atlas has a list (the default on a phone), the instrument has a written key, the progress sky has a skill list and a table of scores, and a call's customer journey has a table. Every score, mood, difficulty, status and badge is also written out in words.
- Everything works from the keyboard: the dock, the Ctrl or Cmd + K palette, the atlas and the journey (arrow keys), setup, the call and its voice controls, tabs and every dialog. Focus is always visible, is never hidden behind the floating dock or the sticky "Enter the call" bar, and moves to the new page's main content when the address changes.
- Reduced motion is honoured from the device and from Settings, and it is a designed mode, not a switch-off: nothing loops and state changes are instant. A **Pause ambient motion** control on every page (and **Pause motion** inside a call) stills everything that moves on its own, and nothing flashes.
- Two themes with contrast worked out from the design tokens against the worst case the animated field can make. Increased-contrast and forced-colours modes have defined results.
- Designed from 320 px wide with no sideways scrolling, and a live call can still be ended on a 320 x 256 screen (a desktop zoomed to 400%).
- axe-core runs on every page and state in both themes in the browser tests (see [Quality and testing](#quality-and-testing)). A hands-on keyboard review found real problems, which were fixed; they and the gaps that remain are listed in [docs/accessibility.md](docs/accessibility.md).
- Nobody has tested Firefly with a screen reader, a magnifier, voice control or a real touch device (see [Current limitations](#current-limitations)).

**Performance.** Every page is its own chunk, and the page for the opening address is fetched before the first render. The animated field is a separate chunk of about 7 kB, requested when the browser is idle. It adapts to the device: three effects tiers, a first guess from what the browser reports, and a frame monitor that only ever steps down when frames run slow. Budgets are enforced in CI by `npm run check:budgets`; these are the sizes of the production build (gzip):

| Budget                                             | Limit  | Now      | Before the redesign |
| -------------------------------------------------- | ------ | -------- | ------------------- |
| First-load JavaScript (entry and preloaded chunks) | 125 kB | 119.4 kB | 93.1 kB             |
| First-load CSS                                     | 22 kB  | 12.9 kB  | 8.4 kB              |
| Largest page chunk (the call)                      | 70 kB  | 22.8 kB  | 20.7 kB             |
| Fonts on the critical path (two preloaded)         | 110 kB | 69.3 kB  | none                |
| All fonts (five files)                             | 150 kB | 119.1 kB | none                |

On one laptop in Microsoft Edge, with its graphics card, the redesigned pages kept almost every frame under 20 ms at the highest tier, even with the CPU slowed to a quarter, except the mission atlas, which dropped frames under the slow-down. The largest element painted between 0.65 and 1.14 s at full speed (earlier than in the previous interface on four of seven pages and within 0.13 s on the rest), and between 1.8 and 2.7 s with the CPU four times slower (earlier on all seven). With no graphics card, the highest tier ran at about 8 frames a second, and the frame monitor stepped down to the lowest tier in every run. The redesign costs about 26 kB more first-load JavaScript, 69 kB of fonts and roughly twice the script time of the interface it replaced. Phones, low-end machines, other browsers and real networks were not measured. [docs/performance.md](docs/performance.md) has the method, the tables and the caveats, and [`scripts/perf-probe.mjs`](scripts/perf-probe.mjs) repeats the measurements.

## Example training session

<details>
<summary><strong>An illustration written for this document</strong></summary>

&nbsp;

It is not taken from a built-in scenario, so it gives nothing away about the scenarios in the library.

| Setting               | Value                                                              |
| --------------------- | ------------------------------------------------------------------ |
| Issue                 | Production service unavailable (a customer-facing booking service) |
| Business impact       | High                                                               |
| Starting temperature  | Frustrated                                                         |
| Technical proficiency | Intermediate                                                       |
| Communication style   | Demanding                                                          |
| Difficulty            | Challenge                                                          |

- **What the trainee is told.** The preview says a fictional operations lead is calling because clients cannot make bookings. It gives the trainee a goal: find out what is happening and who is affected, take ownership, and agree what happens next and when. It never lists hidden facts.
- **A hidden fact.** Suppose the customer's team raised the same errors in a case yesterday and it was closed without a fix. The customer will not mention it unprompted. It comes out only if the trainee asks something like "Has anyone contacted support about this already?"
- **A possible curveball.** A few turns in, if no one has taken ownership, the customer may ask for a manager. The report later says whether the trainee acknowledged the request, explained what they would do and offered a route.
- **How feedback is produced.** When the trainee ends the call, Firefly locks the transcript, reviews which hidden facts were found, scores the six dimensions and builds a report. Each score is explained and, where there is something to quote, cites quotes from the trainee's own turns. The report names any fact that was missed together with a better question to ask, shows how the customer's temperature moved, lists the points and badges the call earned and suggests one thing to practise next.

</details>

## Responsible AI and data safety

Firefly is a training aid.

- **Fictional data only.** Use fictional and synthetic customer information. Do not enter real customer names, case details, logs, screenshots or identifiers.
- **Best-effort redaction.** Emails, phone numbers, long numbers and identifiers are removed from messages (typed or spoken) before they are saved or sent to a model, and the call screen warns before you send something that looks like one. This is pattern matching, so it will not catch everything.
- **Coaching can be wrong.** AI-generated coaching can be incomplete or wrong. Review it with a mentor.
- **Practice, not assessment.** Scores, points and badges are for practice and must not be treated as employee-performance assessments. Firefly never ranks or compares colleagues.
- **Honest labelling.** Demo mode is always labelled and never presented as a model. Quotes are verified against the transcript, and short calls say their reports rest on limited evidence.
- **Controlled model use.** A live model is given only what the engine has decided the customer may say in that reply. Model output is validated and shown as plain text, and API keys stay on the server.
- **Voice is opt-in and explained.** Firefly never records audio; the browser may send your speech to its maker's service, and the app says so before you turn voice on.
- **No telemetry.** There are no accounts, analytics or tracking. The local profile stays in the browser. Logs contain short ids and timings, never transcripts. With a live provider, redacted transcripts go to the endpoint you configure. With a free-tier Gemini key, Google's terms say it uses content sent through unpaid services to improve its products and that human reviewers may read it, so keep everything fictional.
- **Secrets stay out of Git.** Never commit secrets. `.env` is git-ignored, `.env.example` holds placeholders only and `npm run check:secrets` scans for common patterns, including Google API key shapes.

Firefly makes no compliance or certification claims. Data lives in a local SQLite file that Firefly does not encrypt. The full picture is in [docs/responsible-ai.md](docs/responsible-ai.md).

## Evaluation and calibration

<details>
<summary><strong>How scores are produced, and what is and is not validated</strong></summary>

&nbsp;

**How scores are produced.** In demo mode a rules evaluator reads the classified transcript and the engine's records and scores each dimension. With a live provider a model drafts the scores and wording, and the server then verifies every quote against the turn it cites, caps scores by the evidence, and builds discovery, the mood timeline, the curveball assessment and the overall score itself.

**How transcript evidence is used.** Every quoted moment is a real excerpt from a trainee turn and links to that turn in the transcript. A quote that cannot be found is dropped, and a score cannot rise above what its verified quotes support. Rewards use the same evidence: a reward for a clear owner and update, for example, needs a score of 4 or more, enough evidence and a quoted turn.

**How mentors score sessions.** On the Calibration page a mentor picks a completed session that has no review yet and scores the six dimensions from 1 to 5 using only the transcript and the rubric scale. The review screen never loads the evaluator's scores or the report, and the review queue does not carry them either. After saving, the page shows the evaluator's scores beside the mentor's. This blindness is a process aid, not an access control: anyone using the app can open a report from History, so mentors should score before they read it. A mentor review that agrees with the rubric result also earns the learner points, so that rule trusts the Calibration page, which has no sign-in.

**How the calibration command works.** `npm run calibrate` reads records from `calibration/samples/` by default, or from the files you give it (`npm run calibrate -- path/to/records.json`). It prints the mean absolute difference, the share of scores within one point and any consistent over- or under-scoring, overall and per dimension. The file format is described in [docs/calibration.md](docs/calibration.md).

**What calibration currently proves.** Nothing yet about real-world agreement. The only records in the repository are six invented examples, all marked as samples, and the tool says so and warns when there are fewer than 20 reviews. The tool, the file format and the in-app flow work; there is no real mentor data.

**What remains unvalidated.** Agreement between the evaluator and real mentors, and the quality of coaching from a live model (Gemini has been run end to end, but its coaching has not been compared with mentors' scoring). Treat every score as a starting point for a conversation.

</details>

## Quality and testing

Last verified on commit [`75c462f`](https://github.com/snowjug/Firefly/commit/75c462f) on 21 November 2026, with the browser tests run in Microsoft Edge. Commits after it change only this README.

| Check                                                             | Result                                                                                                                                                                   |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Formatting, lint, types and scenario validation (`npm run check`) | Pass                                                                                                                                                                     |
| Unit, component and API tests (`npm test`)                        | 2,586 passed in 136 files                                                                                                                                                |
| Browser tests (`npm run test:e2e`)                                | 44 passed: 42 on a desktop viewport, 2 on a phone                                                                                                                        |
| Accessibility                                                     | axe-core on 28 page states in both themes (WCAG 2.0 to 2.2, A and AA rules): no serious or critical violations                                                           |
| Layout                                                            | No sideways scrolling at 320 px or 1440 px on the same 28 states, nor at 320 px and 390 px on 14 first-run pages; a live call can still be ended on a 320 x 256 screen   |
| Bundle budgets (`npm run check:budgets`)                          | All met. First-load JavaScript 119.4 of 125 kB, first-load CSS 12.9 of 22 kB, the largest page chunk 22.8 of 70 kB, fonts on the critical path 69.3 of 110 kB (all gzip) |
| Secret scan and lockfile check                                    | No findings in 636 files; every resolved URL canonical                                                                                                                   |
| Calibration command on the bundled sample (`npm run calibrate`)   | Runs. Its six records are invented samples and prove nothing about agreement with mentors.                                                                               |
| Continuous integration                                            | GitHub Actions runs the same checks and the browser tests on Ubuntu with Node 24 for every push and pull request (see the badge at the top)                              |
| Performance                                                       | Measured on one laptop only: see [docs/performance.md](docs/performance.md)                                                                                              |

The unit tests cover the domain rules (customer state, discovery, curveballs, scoring, rewards, recommendations), the evaluator and its quote checks, the HTTP API and database, the providers (against a local fake model server), the voice engine (against fake browser speech APIs), the design tokens and styles (contrast, class ownership, 44 px targets), and every page and component. The browser tests run real journeys against the production build with an in-memory database, then sweep every page for accessibility and sideways scrolling. See [CONTRIBUTING.md](CONTRIBUTING.md) for how to run them and [docs/troubleshooting.md](docs/troubleshooting.md) if a browser will not start.

## Current limitations

- The Gemini provider has been run end to end against the real API only in a few scripted calls, and free-tier rate limits apply (about 15 requests a minute for the default model when tested). Azure OpenAI and other OpenAI-compatible services were tested only against a local fake server.
- No real mentor calibration dataset exists, so nothing is known about how closely the scores agree with people.
- Voice input needs a Chromium-based browser (Chrome or Edge) on https or localhost. It is tested against fake speech APIs, not on every browser or microphone, and recognition accuracy varies with accent, noise and microphone. You cannot interrupt the customer by speaking; use Stop or Talk.
- Accessibility is checked by automated tools, keyboard tests and review. Nobody has tested with a screen reader or voice control.
- Browser tests run in Chromium (Edge and Chromium). Other browser engines are not tested.
- Demo mode is pattern-based. It can miss unusual phrasing, and it cannot answer small-talk questions about itself, such as the customer's name or phone number, so the customer carries on with the call instead. It is less flexible than a person or a model.
- When a curveball lands, guided practice says only that the conversation changed, never which kind of curveball it was, and immersive practice shows nothing. Mood shifts and silence are shown in guided practice the same way, and the report explains the curveball afterwards.
- The local profile is a name for greetings, not a login: there is no account, no password and no organisation sign-in. Keep Firefly on a trusted network.
- "Practice time" on the home page adds up the length of each call from start to end, so a call left open for hours inflates it.
- Immersive practice hides the mood, the signal count, shifts and ideas in the interface, but the API still returns them with each reply, so anyone using the browser's developer tools can read them. It is a training mode, not a secret.
- The Studio has no sign-in and no roles. A learner who opens its Trainer tab can see the areas worth exploring and the kinds of curveball for the demo spotlight scenario.
- In demo mode, report wording can occasionally disagree with its own scores, and a quoted moment longer than about 160 characters is cut without an ellipsis. A call of a single message still lists six scores, labelled as limited evidence, and History's Compare shows the change between two reports without that caveat.
- Rough edges in the call: there is no offline notice inside a live call, a failed send says to check that the server is running even when the browser is offline, a slow reply shows the typing dots with no time limit, and two tabs open on the same call can drop or skip a turn. Demo-mode customers repeat themselves in long calls (one scripted 60-reply call had 34 different replies).
- Rough edges in the interface: on screens 1920 px wide or more the live call ignores the 1360 px column, the guided "Ideas" chips scroll sideways inside their row at 390 px and below, and some wording differs between pages (Configure and Calibrate, Trainer and Studio, missions and scenarios, Rewards and Recognition). [docs/accessibility.md](docs/accessibility.md) lists the accessibility gaps.
- Performance was measured on one laptop in Microsoft Edge, with and without the graphics card ([docs/performance.md](docs/performance.md)). Phones, low-end machines and other browsers were not measured, so the effects tiers are a safeguard that has been tested in code and on one machine, not a proven result on a weak device.
- Firefly is not deployed. There is no hosting configuration. The interface is English only.

## Roadmap

✅ **Available**

- 13 configurable scenarios, a mission atlas, a calibration page and a live call
- Adaptive demo-mode customer with hidden facts and curveballs
- Evidence-based call feedback with a customer journey line, rewards from the call and a report-incorrect-feedback path
- Points, levels, a streak and badges that explain themselves, History, Progress and transcript review
- A spatial interface: the Signal instrument, a command dock and palette, an animated field with effects tiers, reduced motion and a pause control
- Voice (Beta): speech input, spoken customer replies and call tones, opt-in
- Blind mentor review and calibration tooling, trainer tools and labelled sample sessions
- Local profile, notifications in the app, optional sound, a first-run tour and an offline notice
- Live-provider integration for Gemini, Azure OpenAI and OpenAI-compatible endpoints (Gemini run against the real API; the others tested against a fake server only)

🚧 **In progress**

- None right now.

🔭 **Future possibilities**

- Validating Azure OpenAI or another OpenAI-compatible service against a real endpoint, and measuring coaching quality from a live model
- Collecting real mentor reviews to calibrate the scores
- A hosted deployment with real sign-in for panel demonstrations
- Richer progress analytics
- Trainer-managed scenario libraries and wider scenario coverage
- Deeper accessibility validation with assistive technology and wider voice testing

The future items are possibilities, not commitments.

## Documentation

| Document                                                 | Contents                                                                          |
| -------------------------------------------------------- | --------------------------------------------------------------------------------- |
| [docs/architecture.md](docs/architecture.md)             | Components, data flow, persistence, API, security, the web app                    |
| [docs/experience-design.md](docs/experience-design.md)   | Design concept, principles, route by route, motion, accessibility, visual review  |
| [docs/design-system.md](docs/design-system.md)           | Tokens, surfaces, components, accessibility checklist                             |
| [docs/accessibility.md](docs/accessibility.md)           | What is built for accessibility, how it was checked and the known gaps            |
| [docs/performance.md](docs/performance.md)               | Budgets, effects tiers, how performance was measured and what the numbers were    |
| [docs/attribution.md](docs/attribution.md)               | Fonts, packages, licences, and what was studied but not copied                    |
| [docs/rewards.md](docs/rewards.md)                       | Points, levels, badges, challenges, the endpoint and what is deliberately missing |
| [docs/voice.md](docs/voice.md)                           | Voice mode: behaviour, browser support, what leaves your device, troubleshooting  |
| [docs/evaluation-rubric.md](docs/evaluation-rubric.md)   | How each dimension is scored and what is never penalised                          |
| [docs/ai-providers.md](docs/ai-providers.md)             | Configuring a live model, what is sent to it, failure behaviour                   |
| [docs/calibration.md](docs/calibration.md)               | Comparing evaluator and mentor scores                                             |
| [docs/scenario-authoring.md](docs/scenario-authoring.md) | Writing and testing scenarios                                                     |
| [docs/responsible-ai.md](docs/responsible-ai.md)         | Safeguards and limits                                                             |
| [docs/demo-guide.md](docs/demo-guide.md)                 | A 20-minute demo runbook                                                          |
| [docs/troubleshooting.md](docs/troubleshooting.md)       | Common problems                                                                   |

## Contributing

1. **Branch from `main`.** Name the branch for the change, for example `feature/short-description` or `fix/short-description`.
2. **Make focused changes.** One idea per pull request.
3. **Run the checks.** `npm run check`, plus `npm run test:e2e` for anything visible, and try the change in the browser in both themes, at phone width and with the keyboard only. For a design change, regenerate and review the screenshots (see [Regenerate the screenshots](#regenerate-the-screenshots)).
4. **Open a pull request** that says what changed, why and how you tested it.
5. **Update the docs** whenever behaviour changes.

[CONTRIBUTING.md](CONTRIBUTING.md) has the conventions. Use fictional data only and never commit secrets.

## Team

Firefly is a collaborative FY27 apprentice project. See the [GitHub contributors page](https://github.com/snowjug/Firefly/graphs/contributors) for the people who have contributed.

## License

This repository does not currently specify a license: there is no `LICENSE` file, so no license is granted to others by the repository itself. Ask the repository owner before reusing the code.
