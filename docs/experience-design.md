# Firefly experience design

This is the design reasoning behind what a learner sees and does: the concept, the principles, each
screen, how rewards and voice fit in, and how accessibility, motion and performance are handled. The
mechanics live elsewhere: [design-system.md](design-system.md) for tokens and components,
[architecture.md](architecture.md) for how it is built, [rewards.md](rewards.md) and
[voice.md](voice.md) for those two features.

## Creative concept

A learner is rehearsing a hard conversation. The product should feel like a **calm, confident
workspace**, not a game and not a call centre dashboard.

- A deep **navy sidebar** frames bright **white cards** on a pale blue canvas, so the thing you are
  working on is always the brightest thing on the screen.
- **One vivid blue** carries every primary action. A **blue-to-violet gradient** marks the moments
  that invite you to start something: the practice banner and the landing hero.
- **Warm amber is reserved for rewards**: points, stars and badges. If something is amber, it was
  earned.
- The **customer is a person**, drawn as a 2D portrait whose expression follows how they feel, and
  who speaks (when voice is on) in a voice of their own.
- **Feedback is evidence.** Every score sits next to the words from the call that support it.

The look was shaped by a reference board of nine screens (landing, sign-in, dashboard, scenario
setup, call, feedback, history, rewards, profile and settings). Where the board suggested something
the product cannot honestly do (a working Microsoft sign-in, experience points, a "top performer"
label, 3D avatars), the design keeps the layout and replaces the claim: see
[What was adapted](#what-was-adapted-from-the-reference).

## Design principles

1. **Clarity before decoration.** One primary action per screen, strong hierarchy, plain language.
   Effects exist to explain state, never to fill space.
2. **Honest.** Demo mode is always labelled and never presented as a model. No fake progress, fake
   metrics or disguised mock output. Identity is a local profile, not an account. Voice is labelled
   Beta and is opt-in.
3. **Evidence over opinion.** Scores, strengths, opportunities and rewards each carry the reason and,
   where one exists, the quoted moment. Quotes link to the exact turn in the transcript.
4. **Practice, not performance.** Scores are practice signals. There is no leaderboard, no ranking,
   no comparison with colleagues, and no reward for speed or volume. Every report and many screens say
   so.
5. **Calm.** No countdown pressure, no streak shaming, no confetti. A missed day costs nothing.
6. **Private by default.** The profile and preferences stay in the browser. Notices are derived
   locally. Voice never records audio.
7. **Accessible by default.** WCAG 2.2 AA is a release requirement (see
   [Accessibility approach](#accessibility-approach)).
8. **Two real themes.** Light and dark are both designed, not inverted.

## The visual system

The tokens, surfaces and components are documented in [design-system.md](design-system.md). In short:
system fonts only (no download, no layout shift), a 4 px spacing scale, 14 px card radius, solid
cards with a hairline border and a soft shadow, native form controls restyled, and CSS custom
properties for every colour so both themes share one set of rules. The 2D illustrations are drawn in
SVG (`web/src/components/illustration/`): customer portraits generated from a seed (the same name
always gives the same person), an agent with a headset for the home banner, the landing sphere and
a night-time building for sign-in.

## Route by route

| Route                               | Screen                  | What it is for                                                                                                                                    |
| ----------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                                 | Landing                 | What Firefly is and is not, a way in, and the principles in plain words                                                                           |
| `/sign-in`                          | Sign-in                 | Create a local profile (a name). Organisation sign-in is shown as not available                                                                   |
| `/home`                             | Home                    | Greeting, four real numbers, the "start a new practice session" banner (or "resume call"), recommended scenarios with the reason, recent practice |
| `/practice`, `/scenarios/:id/setup` | Practice setup          | Configure a call on one page and start it                                                                                                         |
| `/scenarios`                        | Scenarios               | A searchable catalogue of the 13 scenarios                                                                                                        |
| `/calls/:id`                        | Call                    | The conversation, typed or spoken                                                                                                                 |
| `/sessions/:id/report`              | Call feedback           | The full coaching report, opened as soon as a call ends                                                                                           |
| `/sessions/:id/transcript`          | Transcript              | The conversation with markers, and the target of every quote link                                                                                 |
| `/history`                          | History                 | Every call as a table: score, badges earned, view, resume, retry, compare, delete                                                                 |
| `/rewards`                          | Rewards                 | Level, badges, challenges, streak, how points work and the points history                                                                         |
| `/progress`                         | My progress             | Trends per skill, where to focus next, repeated opportunities                                                                                     |
| `/settings`                         | Profile and settings    | The profile, preferences, notifications, data and privacy                                                                                         |
| `/help`                             | Help and responsible AI | How things work, voice and privacy, points, working with a mentor, limits                                                                         |
| `/calibration`, `/trainer`          | Mentor area             | Blind review and calibration; demo tools and sample data                                                                                          |

### Landing and sign-in

A dark hero with the promise ("Practice real conversations. Build real impact."), a glowing orbit
sphere, four highlights and a short explanation. The landing page and the sign-in's side panel are
always dark because they are brand moments; everything else follows the theme. Sign-in asks only for a
name (role and location are optional), says in the first paragraph that there is no password and no
account, and leaves the organisation sign-in button visibly disabled with the reason. Anyone with a
saved profile sees "Welcome back" and one button.

### Home

The first screen after sign-in answers "what should I do now?". It shows four real numbers (scenarios
completed, average score, badges earned, practice time; sample calls never count), then one big
invitation. If a call is open, the invitation becomes **Resume call**. Below it are four
recommended scenarios, the first chosen by `recommend.ts` with the reason in words, and the last three
finished calls. The first-run tour is offered once, never forced.

### Practice setup

One page replaces the earlier eight-step wizard and the separate pre-call brief.

- **Quick start** is a radio group (Starter, Standard, Challenge), the same difficulty presets the
  engine uses.
- **Custom configuration** changes the issue type, scenario, business impact, customer temperature,
  technical proficiency, communication style, call stage and curveballs. Hidden facts are shown as a
  read-only "always on" row: every scenario has details the customer shares only when asked.
- Everything starts from the scenario as written. A **Customised** chip says when something differs,
  and **Reset to scenario defaults** puts it back.
- The **scenario preview** is what the old brief page was: the customer, the situation, your goal,
  what you will practise, ground rules, and the honest reminders (fictional customers, the provider
  note). It never shows hidden facts.
- **Start call simulation** stays in a bar at the bottom of the screen. It is safe to press twice and
  safe to retry; a short launch moment is skipped under reduced motion.

### Scenarios

A plain catalogue: search (pre-filled by the top bar search), filters for issue type, difficulty and
impact, and cards that say how often you have practised the scenario and your best score. One card is
recommended, with the reason.

### The call

The call screen owns the viewport. The sidebar shrinks to an icon rail (and disappears below 960 px).

- **Stage.** The customer's portrait, their name, role and organisation, the business impact and their
  latest message as a speech bubble (a decoration: the conversation list is the accessible record).
- **Chat.** Customer messages on the left, yours on the right, a typing indicator, and a composer
  whose accessible name is "Your reply to the customer". Enter sends, Shift+Enter adds a line, a
  message that looks like personal data is warned about before it is sent, and a failed send keeps the
  message with a Retry.
- **Guided practice** adds the mood in words, a mood meter, a count of facts uncovered (never how many
  exist) and a few hint chips that insert a generic starter phrase and never reveal a fact.
  **Immersive practice** shows none of that, and the portrait stays calm, so the face cannot give the
  mood away.
- **Voice (Beta)** adds a microphone, mute, hands-free, a live caption and a status line. See
  [voice.md](voice.md).
- **Details** opens the briefing (situation, goal, ground rules, areas worth exploring) and private
  notes, which never leave the tab.
- **End call** asks for confirmation, locks the transcript, shows the real stage evaluation has
  reached, and then opens the report by itself.

### Call feedback

The report is the payoff, so nothing is hidden behind a click.

1. A **meta card**: the scenario, date, duration, difficulty, practice mode, whether the call was
   completed or ended early, the customer's mood at the end, who produced the coaching, and the summary.
2. An **overall score ring** ("a practice signal, not a grade or a ranking"), hidden facts found, the
   customer's mood range, your turns and the coaching focus, beside **six skill bars** with their
   evidence labels.
3. **On this page** navigation, **What went well** and **Areas to improve**.
4. **Skill details**: the rationale, the CARE behaviours, evidence quotes with "see it in the
   conversation", and what to try.
5. **Opportunities**: what you said, why it matters, a stronger way to say it and why it works.
6. **Discovery**: for every hidden fact whether it was found, a question worth asking, what the customer
   had held back and why it mattered.
7. The **customer temperature timeline**, with turning points you can walk with the arrow keys.
8. **Rewards from this call**, with the reason for each award.
9. **Next practice target** and a suggested call.
10. **About this report**: how it was produced, the disclaimer, the rubric, and **Report incorrect
    feedback**.

A call that ends early, or has too little in it, says so instead of inventing a full assessment: no
overall score, evidence labels on the skills that rest on little, and rewards that explain why a call
earned nothing. A call that used voice carries a reminder to check quotes against the transcript.
**Download report** opens the browser's print dialog with a dedicated print stylesheet.

### History, Rewards and My progress

- **History** is a table on wide screens and stacked cards on narrow ones. The Badges column shows what
  each call earned.
- **Rewards** shows a level and what the next one needs (both points and kinds of call), earned and
  locked badges in words, three personal challenges, the streak, the seven rules with their safeguards,
  and a points history that gives the reason for every award. See [rewards.md](rewards.md).
- **My progress** shows, per skill, a small trend with a text summary ("Latest 4, average 3.2,
  rising"), where to focus next and the opportunities that keep coming back. It never compares one
  person with another.

### Settings, Help and the mentor area

- **Settings** keeps device choices (theme, reduced motion, sound, language) apart from profile choices
  (default difficulty, hints, voice, notifications). Without a profile the profile choices are disabled
  with a reason. Every change is saved at once and confirmed.
- **Help** explains the product in plain language and carries the Responsible AI content.
- **Calibration** and **Trainer** are mentor tools. They sit under their own heading in the sidebar and
  use the same cards and tables. They keep their purpose: a blind mentor review, and demo tools with
  clearly labelled sample data.

### The tour

An optional five-step tour (about 45 seconds): pick a scenario, hidden facts, the customer reacts,
feedback, ready. It is offered from Home and Settings, never opens by itself, can be skipped at any
step and ends at the practice page. It is its own chunk, so it is not part of the first download.

## Rewards

Rewards are in the product to encourage practice, and the design makes four promises:

- **Every award explains itself.** The points history gives one plain sentence and, where there is one,
  the quoted moment.
- **They cannot be gamed.** Nothing is paid for speed, call length or message count; a fact pays once;
  repeats of one scenario pay little; calls that end early or have too little evidence earn nothing.
- **They are forgiving.** A streak forgives one missed day. Nothing is taken away for a retry or a
  missed day.
- **They are private.** No ranking, no leaderboard, no sharing. They are worked out from your own saved
  calls every time they are asked for, so deleting a call takes back what it earned.

The rules, levels, badges and challenges are in [rewards.md](rewards.md).

## What was adapted from the reference

| The reference showed                      | What Firefly does instead                                                                                               |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| "Sign in with Microsoft"                  | A local profile (a name). The organisation button is visible but disabled, with the reason                              |
| XP, levels and a "Top Performer" label    | Points with a reason for each, four levels that need breadth as well as points, and no ranking of any kind              |
| "AI-powered" practice                     | Plain language: demo mode is a rules engine and says so; a live model is named when one is configured                   |
| A 3D-style customer                       | A 2D illustration that follows the customer's mood                                                                      |
| Push notifications                        | A bell menu with notices worked out in the browser; nothing is emailed or pushed                                        |
| Voice and "Download report" as decoration | Voice is a real, opt-in beta with its privacy stated; Download report opens a real print dialog with a print stylesheet |

## Motion language

Motion explains what changed. It never blocks input and never carries essential information.

- Durations: feedback 120 to 200 ms, state changes 320 to 450 ms, reveals 640 ms, and 1000 ms only for
  the score ring and the launch moment.
- Only `transform` and `opacity` are animated. Layout is never animated and text is never faded in.
- Route changes use the View Transitions API where it exists: a short crossfade.
- The customer's portrait breathes, blinks and moves its mouth while the customer speaks or types. The
  orbit lights on the landing sphere drift. All of it stops under reduced motion.
- **Reduced motion** is honoured from the device and from Settings (`data-motion="reduce"`). Animation
  and transitions collapse to near zero, the score ring draws at its final value, the portrait holds
  still and the launch moment is skipped. State changes remain visible.
- **Sound** is optional and off by default (`web/src/lib/sound.ts`): short tones synthesised in the
  browser, never required. Voice is a separate opt-in.

## Accessibility approach

The checklist every page must meet is in [design-system.md](design-system.md#accessibility-checklist).
How it shows up in practice:

- **Landmarks and headings.** One `h1` per page, ordered headings, a skip link, a named region for the
  conversation.
- **Never colour alone.** Every mood, score, status, badge and difficulty is also written out. Score
  rings and sparklines come with a text equivalent, the temperature chart with a data table.
- **Keyboard.** Everything works without a pointer: setup, the composer and voice controls, tabs and
  radio groups (arrow keys), the timeline (arrow keys between points), menus and dialogs (focus trap,
  Escape, focus restored).
- **Announcements.** New customer replies are announced politely, once, as a whole message. Status
  changes ("Listening", "Customer is speaking") use polite live regions.
- **Targets.** Primary controls are at least 44 px. A few dense secondary controls are 36 px.
- **Illustrations** are decorative and hidden from assistive technology.
- **Automated checks.** The browser tests run axe-core (WCAG 2.0 to 2.2, A and AA) on every page in both
  themes and check that nothing scrolls sideways at 320 and 1440 px.
- **Not done.** Nobody has tested with a screen reader or voice control.

## Responsive strategy

- **Above 960 px** the sidebar is a column. **At or below 960 px** it becomes a drawer opened from the
  top bar, and the top bar shows the brand. **At or below 420 px** the brand's name steps aside so the
  three action buttons still fit at 320 px.
- Pages that hold dense content (feedback, history, home) respond to the width of the page itself with
  container queries, so they behave the same beside a sidebar, in a drawer layout or on paper.
- History becomes stacked cards, the call's stage becomes a compact strip above the chat, and the
  setup preview moves below the form.
- Everything is designed down to 320 px without horizontal scrolling and up to ultra-wide screens.

## Performance strategy

- **Nothing blocks the first screen.** No web fonts, no raster images, no UI framework; the runtime
  dependencies are React, React Router and zod.
- **Every page is its own chunk.** The page for the opening address is fetched before the first render,
  and optional pieces (the tour, the avatar artwork on Home) load after the first paint through
  `useOnDemand`, never through `Suspense` inside a page's first render.
- **No layout jumps.** A page is at least one screen tall so the footer never jumps, loading states are
  skeletons of the final layout, and illustrations have fixed aspect ratios.
- **Cheap animation.** Transform and opacity only; the portrait's animation is CSS, with no React
  re-render per frame.
- **Sizes.** From the production build (gzip): the shared app code is about 93 kB, the stylesheet shared
  by every page about 8 kB, the largest page chunks (Call and Report) about 21 kB and 17 kB, and a typical
  page chunk 4 to 6 kB. These are build sizes. Load times have not been measured for this release.

## Dependency choices

No runtime dependency was added for the redesign, rewards or voice.

| Considered                 | Decision                                                                                          |
| -------------------------- | ------------------------------------------------------------------------------------------------- |
| Three.js / WebGL           | Not used. 2D SVG portraits are enough, load instantly and have no failure mode                    |
| Animation libraries        | Not used. CSS transitions, one spring easing and CSS keyframes cover every need                   |
| Web fonts                  | Not used. A system stack means no download and no layout shift                                    |
| Audio files                | Not used. Call tones are synthesised with Web Audio; speech uses the browser's own voices         |
| Speech services            | None of Firefly's own. Voice uses the browser's Web Speech API and sends only recognised text     |
| Icon or illustration packs | Not used. Icons are inline SVG paths in `web/src/components/Icon.tsx`; portraits are hand-drawn   |
| Charting libraries         | Not used. The temperature timeline and sparklines are small SVG components with text alternatives |

## Visual review

Design changes are checked in a real browser, in both themes, on a phone-sized and a desktop-sized
screen. Two tools help:

- `node scripts/shot.mjs` captures any single state (it can create calls, send messages, end a call
  and load sample sessions first). Its options are documented at the top of the file.
- `node scripts/readme-screenshots.mjs` regenerates the README and documentation images from a
  running demo-mode Firefly with a clean in-memory database (the command is at the top of the file).
  After running it, `git diff --stat docs/images` shows what changed; open those pictures and review
  them. There are no pixel-comparison baselines.

The automated guards against regressions are the browser tests: accessibility in both themes on every
page, no sideways scrolling at 320 and 1440 px, reduced motion, theme persistence, the profile and
voice opt-in, keyboard setup and the full trainee journey from the landing page to the report.

A design change should also be reviewed against these questions: does it look like the rest of the
product, is every animation saying something, does every reward explain itself, does it work with the
keyboard and with reduced motion, and does it stay fast.

## Attribution and licences

The interface uses no third-party fonts, images, icons, sounds, 3D assets or animation libraries.
Fonts come from the visitor's system. The illustrations are drawn for this project. The screenshots in
`docs/images` are of Firefly itself with fictional data. The repository has no LICENSE file, so no
licence is granted to others by the repository itself.

## Limitations

- Nobody has used Firefly with a screen reader or voice control; accessibility is checked by automated
  tools, keyboard tests and review.
- Browser coverage is Chromium (Edge and Chromium); other engines are not tested. Voice input needs a
  Chromium-based browser.
- There is no dedicated mid-call cue when a curveball lands, because the call state sent to the browser
  does not include one; the mood-shift lines and silence show its effect.
- The local profile is a name for greetings, not a login.
- Rewards and recommendations are practice signals from a handful of calls, derived from rules-based or
  model-drafted coaching, and they have not been calibrated against real mentor scoring (see
  [calibration.md](calibration.md)).
- "Practice time" adds up the length of each call from start to end, so a call left open for hours
  inflates it.
