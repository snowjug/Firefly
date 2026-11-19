# Firefly experience design

This page explains why Firefly looks and behaves the way it does, and how the design is built. It is
written from the code: where a claim depends on a rule, the file that holds the rule is named. The
token reference and component list live in [design-system.md](design-system.md); how the pieces fit
together on the server and in the browser is in [architecture.md](architecture.md).

## Creative concept

Firefly is a training room for hard conversations. The idea that runs through the interface is
**light is learning**: a firefly is a small light that shows up in the dark, and in Firefly a light
is only ever _earned_ by something that really happened in a call.

- A **customer** is a light you are talking to. Its colour and restlessness follow how the customer
  feels, and it brightens when you find something they were holding back.
- A **skill** is a constellation. It lights up with completed calls and says in words exactly what
  the next light needs.
- A **mission** is a place on a map. It is lit once you have practised it.
- A **milestone** is a star that appears only when your own words in a call support it.

The look is a _night meadow_. The dark theme is deep pine-black with one warm point of light and cool
mist. The light theme is warm linen paper with ink-green text and burnt amber for the same light.
Both are designed, not inverted.

## Design principles

1. **Evidence, not decoration.** Every light on a screen has a meaning that is also written in words.
   Nothing glows because glowing is attractive.
2. **Practice, not pressure.** There are no points, streaks, rankings, leaderboards or comparisons
   with other people anywhere in the product. A skill that is not lit yet is simply the next one to
   light, never a failure.
3. **Text first.** Colour, motion and shape are never the only signal. Customer temperature is always
   written out; constellations always have a text description; scores are real text.
4. **Motion with a reason.** Movement shows cause and effect (a reply arrives, a fact is found, a
   mood shifts). It is short, it never carries essential information, and it disappears under
   reduced motion.
5. **The conversation comes first.** The live call and the coaching text are always the most
   readable things on their screens. Effects sit behind them.
6. **Honest.** Demo mode is always labelled. Nothing is fabricated: a milestone, a tier or a
   recommendation is shown only when the saved data supports it, and each says why.
7. **No new weight.** The redesign adds no runtime dependency, no web fonts, no images and no
   third-party artwork.

## The visual system

All colour, type, spacing, radius, motion and layering values are CSS custom properties in
`web/src/styles/tokens.css`, defined once per theme (dark, light, and the system preference). Three
of them carry the identity:

| Token                                 | Role                                                                                                     |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `--glow`, `--glow-soft`               | The warm light: primary actions, earned light, the Core, lit stars                                       |
| `--glow-text`                         | The same warmth, darkened in the light theme so it passes contrast **as text** (`--glow` alone does not) |
| `--accent`, `--accent-2`              | Mist and mint: selection, structure, links                                                               |
| `--star-0` ... `--star-4`             | The five mastery tiers, from an empty ring to a beacon                                                   |
| `--temp-calm` ... `--temp-escalating` | The customer-temperature ramp, always paired with a label                                                |

Display text uses a serif from the system font stack (`--font-display`); interface text uses the
platform sans. No font is downloaded. `.glass` surfaces no longer blur; only `.glass-strong`
(navigation, dialogs) does, and every glass surface has a solid fallback.

## The Firefly Core

The Core is the product's recurring visual: a small light with a halo, drifting filaments, rim rings
and orbiting points. It is drawn by a hand-written Canvas 2D engine
(`web/src/components/core/engine.ts`), not by a library, and it is the only animated canvas in the
app.

- **Mood.** The engine takes a mood (neutral, calm, concerned, frustrated, angry, escalating) and
  eases towards its parameters: tempo, filament jitter, breathing rate, orbit spread and halo
  strength. Calm is open and slow; escalating is tight and tense. The breathing rate stays well under
  1 Hz, so nothing ever flashes.
- **Signals.** The orbiting points are signals. A dormant signal is a faint outline; when one is found
  it lights and a single burst plays.
- **Where it appears.** The start page (its six orbiting lights are your six skills, lit from your own
  completed calls), the customer presence in the live call, the call ending, the next-practice
  suggestion in a report, the setup preview and brief, the tour and the launch sequence.
- **Cost control.** The component (`FireflyCore.tsx`) pauses when it is off screen or the tab is
  hidden, caps the device pixel ratio at 1.5, and lowers its own quality (drawing at most every 30 ms
  at pixel ratio 1) if the average frame takes longer than 30 ms over 120 frames.
- **Fallbacks.** If a 2D canvas cannot be created the CSS glow behind it stays. Under reduced motion
  the Core draws one still frame and never starts the loop.

There is no WebGL and no 3D scene. The sense of depth comes from layered 2D drawing, so there is no
WebGL failure mode to handle.

## Route by route

| Route                | What changed, and why                                                                                                                                                         |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Start                | One composition: the Core with your six skills, an open-call banner, the recommended next mission with the evidence behind it, recent practice and a skill constellation      |
| Scenarios            | A **mission map** (below) from 1000 px wide, the familiar list below that and on request; each mission shows whether it is new, in progress or practised, with the best score |
| Setup and Brief      | The same eight steps and brief, with a live Core that takes the customer's starting temperature; Begin call opens the **launch sequence**                                     |
| Live call            | A **chamber**: the customer's presence beside the conversation, an atmosphere that follows their mood, and discovery cues in guided practice                                  |
| Ending, Report       | A debrief that reveals in order: the score constellation, what was earned, evidence in place, the discovery trail, the mood timeline and one next target                      |
| Transcript, History  | Re-themed through the tokens; behaviour unchanged                                                                                                                             |
| Progress             | A mastery journey: constellations, the next skill to light, a path of calls, milestones and opportunities that point at a scenario to practise                                |
| Trainer, Calibration | Re-themed through the tokens; behaviour unchanged                                                                                                                             |
| Settings             | Theme, reduced motion, **sound effects** (off by default), **replay the tour**, data counts, server details                                                                   |
| Not found, errors    | Plain explanations with a way forward; every data view has loading, empty, error and retry states; an offline notice appears when the browser loses its connection            |

### The mission map

`web/src/components/mission/` lays the 13 scenarios out as a path in three bands (Starter, Standard,
Challenge). Positions depend only on the scenario set, so the map never rearranges while you filter.
A node shows difficulty, how the customer starts and your practice state; practised missions and the
path to them are lit; one mission carries a **Recommended** marker.

It is fully usable by keyboard: the arrow keys move to the nearest node in that direction (within a
45 degree cone, falling back to path order), Home and End jump to the ends, and only one node is in
the tab order at a time. Scenarios that do not match a search or filter are inert. The list is one
switch away, the choice is remembered on this device, and phones get the list only.

### The launch sequence

Begin call opens a short full-screen moment: the scenario locks, the customer connects, the line
opens. It is honest: **"Line open" appears only when the session has really been created**, and if
creating it fails the overlay closes and every choice is kept. It never blocks: Skip, Escape, Enter
and Space all end it, and under reduced motion it is not shown at all. While it plays, the page
behind is inert and cannot scroll, and the call screen is prefetched so the hand-off is immediate.

### The live call chamber

The conversation stays a plain, readable list of messages (one list item per message, so assistive
technology announces it naturally). Around it:

- **Immersive practice shows no cues.** The presence stays neutral: no mood colour, no signal dots,
  no counts. This is a deliberate privacy rule of the product (it is how real calls feel) and it is
  enforced in `Presence.tsx` (`presenceFor`) and covered by tests.
- **Guided practice** shows the customer's mood and trend in words, a row of signal dots (how many
  are lit, never how many exist), a "Signal found" chip when a fact comes out, and a line in the
  conversation when the mood shifts.
- The atmosphere around the chamber changes with the mood band through a registered CSS property, so
  the tint blends smoothly.

The API did not change for any of this. The call state the browser receives (`PublicStateDTO`) has no
curveball flag, so there is no dedicated curveball cue mid-call; mood shifts and silence are shown,
and the report explains the curveball afterwards.

### The debrief

The report keeps every previous guarantee (verified quotes that link to the transcript, honest
limited-evidence labels) and adds structure: a constellation of the six scores with the overall score
as real text, an "Earned in this call" section, each quoted moment shown with the turns around it,
a discovery trail, and a timeline of how the customer's mood moved. Entrance motion on the report
only ever moves shapes; text never fades in, so it is readable and contrast-checked at every moment.

## Gamification

Firefly rewards practice, reflection and mastery, and nothing else. Every rule is a pure function
with tests, so the numbers can be explained and audited.

### Mastery tiers

`shared/domain/mastery.ts`. One constellation per coaching skill, with five tiers. Only **completed**
calls count (not calls that ended early, and not the built-in sample sessions unless you switch them
on). A tier is judged on your latest five calls that scored the skill, so a skill can improve and
volume alone changes nothing.

| Tier     | What it takes                                                                                              |
| -------- | ---------------------------------------------------------------------------------------------------------- |
| Dormant  | No completed call has scored this skill yet                                                                |
| Kindling | One completed call, whatever the score                                                                     |
| Glowing  | Two calls and a recent average of 3.0 or more                                                              |
| Radiant  | Three calls in two scenarios, a recent average of 3.8 or more, and a Standard or Challenge call scoring 4+ |
| Beacon   | Four calls in three scenarios, a recent average of 4.4 or more, and a Challenge call scoring 4+            |

Each skill always shows the tier it has and **exactly what is missing for the next one** ("1 more
completed call in a different scenario", "a recent average of 3.8 or more (now 3.5)").

### Milestones

`shared/domain/achievements.ts`. Six milestones, each awarded from the saved coaching report and
nothing else. A call that ended early, or whose evidence was too thin to score, earns none. All but
Handled the Turn need a quoted turn to point at.

| Milestone         | Earned when                                                                       |
| ----------------- | --------------------------------------------------------------------------------- |
| Found the Signal  | A critical hidden fact came out because of a question you asked                   |
| Steady the Call   | The customer reached frustrated or worse and ended at least 20 points calmer      |
| Clear Ownership   | Ownership & Next Steps scored 5: a plan, an owner and a time for the next contact |
| Plain Language    | Clarity scored 4 or more with a customer who is new to the technology             |
| Complete the Loop | Closing scored 4 or more: agreement confirmed and the call closed properly        |
| Handled the Turn  | A curveball changed the conversation and was resolved                             |

The report shows what a call earned; Progress shows all six across your latest eight completed
calls, lit or dim, with what each takes and, when earned, the quote that earned it.

### Recommendations

`shared/domain/recommend.ts`. The next mission is derived from saved practice and always says why:
a gentle first call, a scenario that practises your lowest skill, a step up after strong calls, a
step back after hard ones, a scenario you have not tried, or a second attempt at one you have. Calls
in progress are never offered, and sample calls never influence a recommendation.

### What is deliberately missing

No points or XP, no streaks, no daily goals, no levels for time spent, no leaderboards, no
comparison with colleagues and no rewards for message volume or long calls. Practice that is
sporadic, hard or imperfect is never penalised. Scores stay practice signals, not an assessment of
the trainee (see [responsible-ai.md](responsible-ai.md)).

## Motion language

One vocabulary, defined in `tokens.css`:

| Token                         | Value         | Used for                                            |
| ----------------------------- | ------------- | --------------------------------------------------- |
| `--dur-1` to `--dur-4`        | 120 to 450ms  | Feedback and state changes                          |
| `--dur-5`, `--dur-6`          | 640, 1000ms   | Reveals and the launch only                         |
| `--ease-out`, `--ease-settle` | curves        | Most movement                                       |
| `--ease-spring`               | damped spring | A single, small overshoot (sampled into `linear()`) |
| `--stagger`                   | 70ms          | Offset between sibling reveals                      |

Rules: animate `transform` and `opacity` of non-text shapes; entrance motion on the report, the call
and the Progress page never fades text in (it is transform-only), so text is never partly
transparent; nothing flashes. The only looping motion is the Core canvas (paused when off screen or
hidden) and a few small CSS loops: the typing dots, the loading spinner and skeleton shimmer, the
open-call marker, the ring on a Beacon star, the recommended marker on the mission map and the slow
ring around the next-mission marker. All of them stop under reduced motion. Page changes use the View
Transitions API where the browser has it (a short crossfade, switched off under reduced motion), and
each page fades in briefly.

### Sound

Optional and **off by default**. Four short tones (a call connecting, a signal found, a report
opening, a milestone earned) are synthesised in the browser from sine waves at low gain by
`web/src/lib/sound.ts`, so no audio file is loaded and nothing is licensed. It is switched on with the
speaker button in a call or in Settings, and the choice is kept on this device.

## Accessibility approach

Automated and keyboard checks are part of the test suite; they are not a substitute for testing with
assistive technology, which has not been done (see [Limitations](#limitations)).

- **Semantics.** Constellations are images with a full text description, and their labels are real
  text. Lists are lists (the call, the path of calls, milestones, the map's nodes); sections are named
  regions; there is one `h1` per page.
- **Keyboard.** Everything can be done without a pointer: the map's arrow-key navigation, the setup
  steps, the call composer, the launch (Skip, Escape), the tour (every step can be skipped) and the
  dialogs (focus trap, Escape, focus restored).
- **Contrast.** Text on the warm colour uses `--glow-text`. axe-core runs against every page state in
  both themes in the browser tests (19 page states, no serious or critical violations).
- **Colour is never alone.** Mood, tier, score, state and difficulty are always also text or shape.
- **Reduced motion.** See below. It is honoured from the operating system and from Settings.
- **Reflow.** No page scrolls sideways at 320 px or 1440 px (checked in the browser tests on every page
  state); the layouts were also reviewed at 390, 768, 1024 and 2560 px.

### Reduced-motion behaviour

| Where                            | With reduced motion                                                           |
| -------------------------------- | ----------------------------------------------------------------------------- |
| The Firefly Core                 | One still frame; no animation loop at all                                     |
| Launch sequence                  | Not shown; the call opens as soon as it exists                                |
| Report and constellation reveals | Content is simply there; shapes do not animate in                             |
| Mastery stars                    | Drawn in place; no staggered light-up, no pulsing beacon ring                 |
| Mood atmosphere                  | Changes at once instead of blending                                           |
| Page transitions, smooth scroll  | Off                                                                           |
| Everything else                  | `animation` and `transition` collapse to near-zero duration for every element |

## Responsive strategy

Phone first, then widen. The main layout changes happen at 560, 720, 900, 1000 and 1180 px, with finer
adjustments at 480 and 640 px. The mission map needs room, so it appears from 1000 px and phones get
the list. The call becomes a single column with the customer's details in a sheet. Reports reflow
from a two-column layout with a section rail to one column. Targets stay at least 44 px, and no page
scrolls sideways from 320 px.

## Performance strategy

- **Nothing heavy on the first download.** Every page is its own chunk. The Core's canvas code, the
  next-mission card, the mastery stars, the Progress views and the first-run tour are loaded after the
  first paint through `useOnDemand` (`web/src/lib/onDemand.ts`); the tour is only fetched when someone
  asks for it (and warmed when the pointer reaches its button). A piece that cannot be loaded is
  reported through `failed` and never thrown, so it cannot take a page, or the app, down.
- **The first render does not wait for its page.** `main.tsx` fetches the page for the opening address
  before React starts, waiting at most 1.5 s (`preloadPage` in `web/src/App.tsx`; every route carries
  its own loader, so the table of pages is declared once). Without this React commits a loading
  placeholder and then holds the real page back until 300 ms after it. We saw exactly that: the page
  arrived 305 to 312 ms after the placeholder in five of five runs, and the first screen of Start and
  Scenarios painted 130 to 290 ms later than in the previous release. It is also why optional pieces use
  `useOnDemand` and not `React.lazy` with `Suspense` inside a page's first render.
- **Pure data, no extra requests.** Mastery, recommendations and milestones are computed in the browser
  from calls and reports the app already loads; the Progress page reads at most 100 call summaries and
  8 reports.
- **Cheap rendering.** The call is one list item per message; the report's entrance motion is CSS; the
  mission map is plain DOM and SVG. The Core caps its pixel ratio and degrades itself.
- **A footer that does not jump.** A page is at least one screen tall, so the footer starts below the
  fold instead of being seen jump out of view as content arrives. That jump was the whole layout shift on
  Progress and Report.

### Measured against the previous release

The release before the redesign (`e805b21`) and this one were each built and served by their own
demo-mode Firefly, side by side. A script that is not part of the repository opened every page in
headless Microsoft Edge on one Windows machine, with the cache off and no throttling, alternating the
two builds on every run, and took the median of 9 runs. Pages that need data were filled with fictional
calls first. Read each cell as previous release → this release.

| Page                      | First contentful paint | Largest contentful paint | JavaScript (gzip) | CSS (gzip)     | JS and CSS requests | DOM nodes   | Layout shift | Script time  |
| ------------------------- | ---------------------- | ------------------------ | ----------------- | -------------- | ------------------- | ----------- | ------------ | ------------ |
| Start                     | 376 → 332 ms           | 708 → 680 ms             | 95.7 → 111.7 kB   | 6.9 → 9.9 kB   | 10 → 25             | 171 → 259   | 0 → 0        | 86 → 173 ms  |
| Scenarios (map)           | 648 → 408 ms           | 980 → 772 ms             | 100.6 → 107.3 kB  | 7.7 → 10.9 kB  | 13 → 20             | 502 → 277   | 0 → 0        | 121 → 133 ms |
| A call                    | 288 → 316 ms           | 288 → 316 ms             | 101.3 → 110.2 kB  | 8.1 → 10.8 kB  | 11 → 17             | 125 → 145   | 0 → 0        | 69 → 115 ms  |
| A long call (40 messages) | 536 → 308 ms           | 536 → 308 ms             | 101.3 → 110.2 kB  | 8.1 → 10.8 kB  | 11 → 17             | 413 → 460   | 0 → 0        | 69 → 107 ms  |
| A report                  | 848 → 484 ms           | 1,196 → 484 ms           | 107.8 → 118.4 kB  | 11.4 → 15.5 kB | 13 → 21             | 974 → 1,146 | 0 → 0        | 80 → 96 ms   |
| Progress                  | 500 → 492 ms           | 832 → 824 ms             | 96.5 → 112.4 kB   | 12.4 → 16.0 kB | 10 → 26             | 267 → 641   | 0.04 → 0.06  | 75 → 101 ms  |

The Core animates at 60 frames a second in both releases (95th-percentile frame 16.7 ms).

How to read it:

- **First screens are no slower.** First contentful paint is lower on five of the six pages and 28 ms
  higher on the call page, which is inside the noise.
- **The price is bytes, requests and scripting.** Each page carries 7 to 16 kB more JavaScript and 3 to
  4 kB more CSS (gzip), 6 to 16 more requests (the code is split into smaller pieces), and more script
  time because the pages do more: Start's doubles. Progress draws 641 DOM nodes against 267. The mission
  map draws fewer than the old list of cards did (277 against 502).
- **Layout shift is 0 everywhere except Progress** (0.06 against 0.04), where an occasional shift of one
  section remains. 0.1 is the usual "good" threshold.

Limits of these numbers:

- They come from one machine, one browser and localhost, so there is no network latency and no phone.
  The same build's first contentful paint moved by 100 ms or more between repeated sessions, so read
  smaller differences as noise. Earlier runs agree on the direction; before the first-render fetch
  described above, Start and Scenarios were 130 to 290 ms slower in five runs out of five.
- A run with the processor slowed fourfold was started and abandoned: some pages painted after the
  script had stopped waiting, so its figures are not valid and are not reported. Slower devices, real
  networks and other browsers were not measured, and Lighthouse was not run.

## Dependency choices

No runtime dependency was added. The product still runs on React, React Router and zod.

| Considered                 | Decision                                                                                 |
| -------------------------- | ---------------------------------------------------------------------------------------- |
| Three.js / WebGL           | Not used. Heavy for a decorative element, adds a failure mode, and 2D layering is enough |
| Animation libraries        | Not used. CSS transitions, one spring easing and a small canvas engine cover every need  |
| Web fonts                  | Not used. A system serif and sans stack means no download and no layout shift            |
| Audio files                | Not used. Tones are synthesised                                                          |
| Icon or illustration packs | Not used. Icons are simple inline SVG paths in `web/src/components/Icon.tsx`             |

## Visual review

Design changes are checked in a real browser, in both themes, on a phone-sized and a desktop-sized
screen. Two tools help:

- `node scripts/shot.mjs` captures any single state (it can create calls, send messages, end a call
  and load sample sessions first). Its options are documented at the top of the file.
- `node scripts/readme-screenshots.mjs` regenerates the README and documentation images from a
  running demo-mode Firefly with a clean in-memory database (the command is at the top of the file).
  After running it, `git diff --stat docs/images` shows what changed; open those pictures and review
  them. There are no pixel-comparison baselines.

The automated guards against regressions are the browser tests: accessibility in both themes on 19
page states, no sideways scrolling at 320 and 1440 px, reduced motion (the Core holds one still frame),
theme persistence, keyboard setup, the mission map and the full trainee journey.

A design change should also be reviewed against the questions the redesign used: does it look
original, does every animation say something, does gamification reinforce learning, does it work with
the keyboard and with reduced motion, and does it stay fast.

## Attribution and licences

The interface uses no third-party fonts, images, icons, sounds, 3D assets or animation libraries.
Fonts come from the visitor's system. The screenshots in `docs/images` are of Firefly itself with
fictional data. The repository has no LICENSE file, so no licence is granted to others by the
repository itself.

## Limitations

- Nobody has used Firefly with a screen reader or voice control; accessibility is checked by
  automated tools, keyboard tests and review.
- Browser coverage is Chromium (Edge and Chromium); other engines are not tested.
- There is no dedicated mid-call cue when a curveball lands, because the call state sent to the
  browser does not include one; the mood-shift lines and silence show its effect.
- Mastery, milestones and recommendations are practice signals from a handful of calls, derived from
  rules-based or model-drafted coaching, and they have not been calibrated against real mentor scoring
  (see [calibration.md](calibration.md)).
