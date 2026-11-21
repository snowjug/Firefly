# Accessibility

Firefly is a practice tool for people who are learning a job, and some of them use a keyboard, a
screen reader, a magnifier, voice control or their phone with one hand. This page says what the
interface is built to do, what has been checked and how, what has **not** been checked, and where it
falls short.

## The standard

The target is **WCAG 2.2 level AA**, and it is a release gate: a WCAG violation found by the checks
below fails the build. It is a target, not a claim. Firefly has not been audited by an accredited
body, and it has not been tested with a screen reader or any other assistive technology (see
[What was not checked](#what-was-not-checked)). Nothing here should be read as a statement of
conformance.

## What is built in

### Structure and navigation

- Every page has one `h1`, headings that do not skip a level, a title of its own (`Page name ·
Firefly`) and `lang="en"` on the document.
- The first Tab stop on every page is a **Skip to main content** link. `main` has the id `main` and
  takes focus, so the skip link and every change of page leave keyboard and screen-reader focus at
  the top of the new page. A link to a section (`/#how-it-works`, the report's "On this page") puts
  focus on that section's heading.
- Landmarks: `header`, a named `nav` ("Primary", "On this page", "Jump to", "Breadcrumb"), `main`,
  `footer`, and named regions for the parts of a long page. No two landmarks share a role and a name.
- The call page is the one exception to the header and footer. It has the skip link, a "Jump to" list
  (the call controls, the transcript, the reply box) and `main`. Its command bar is a `header` inside
  `main`, so it is not a banner. See [Decisions](#decisions).
- Long pages have a way round them: the report has "On this page" (a sticky list on wide screens, a
  "Jump to" disclosure on narrow ones), and every quote in the report links to the turn it came from,
  with a "Back to…" button that returns focus to the link.

### Focus

- Focus is always visible: a 2 px black outline with a 2 px white ring inside it, which reads on
  white, on grey and on the brand blue. Scrolling areas draw it inside their edge so that it is not
  clipped. In forced colours it is a 2 px `Highlight` outline.
- Every control is reachable by Tab in reading order. Lists of choices (the scenario list, the
  difficulty and the other segmented controls, the transcript filter) are native radio groups: one Tab
  stop, then the arrow keys.
- Native `<dialog>` elements opened with `showModal()` are used for every dialog and sheet. Focus goes
  to the safe control (**Continue call**, **Cancel**), stays inside, and returns to what opened the
  dialog when it closes. Escape closes every dialog except "Ending the call", which is a progress
  screen and cannot be dismissed.

### What a screen reader is told

- One polite `role="status"` region at the root says changes in whole sentences, one at a time: the
  same sentence is not repeated within four seconds, each sentence is held long enough to be read, and
  at most six wait. A dialog has its own region, because a modal makes the rest of the page inert.
- The call's transcript is a `role="log"` (polite, additions only) inside a focusable, named region,
  and it is the only place transcript text is announced. The customer's reply is written there
  **before** its voice plays. The live caption of what the trainee is saying is hidden from assistive
  technology. The timer is `role="timer"` with `aria-live="off"` and is never announced.
- The status line of the call ("Listening", "Hearing you", "Transcribing what you said", "The customer
  is thinking", "The customer is speaking", "Microphone muted", "Call paused") is text with its own icon
  and waveform shape; the announcer says each change once.
- Problems are said as what happened, what was kept and what to do, with the actions that really apply
  (Try again, Continue by typing, Play customer reply). Inside a live call they are shown quietly and
  announced once through the polite region. `role="alert"` is kept for errors that arrive on their own:
  a call or report that cannot be loaded, an evaluation that failed, a delete that did not work.
- Controls report their state: Mute and Stop talking are pressed buttons (`aria-pressed`), disclosures
  have `aria-expanded`, and a field with an error is `aria-invalid` with the error in its description.
- Charts have a table alternative: the report's customer-temperature chart is followed by an ordered
  list of what moved the customer and a "Show as a table" disclosure; the call's temperature trace has
  "Show the points as a table".

### Voice, without surprises

- Nothing starts before a click. The microphone, the audio output and the speech service are not
  touched until **Allow microphone and start** (or **Start text-only call**) is pressed. The first
  customer line plays after that click.
- The microphone's state is always in words: the status line, and a badge in the command bar (Live
  call, Muted, Paused, Text-only call, Reconnecting, Offline). A typed call says "The microphone is off".
- There are no keyboard shortcuts and no single-character keys, so nothing can fire while someone is
  typing or using speech input.
- Stopping the microphone is one press: the Talk control keeps focus when it becomes **Stop talking**,
  so Enter or Space stops it; **Mute** and **Pause** are one press too. There is no Escape shortcut
  for the microphone.
- Anything that waits shows a message and a way on rather than ending quietly: speech that is not
  understood offers typing, a slow reply or transcription shows the problem with **Try again**, and a
  failed ending explains itself inside the dialog.

### Motion, colour and contrast

- All animation and transition is cut to a moment under `prefers-reduced-motion`; the waveform becomes
  a still level meter, the report does not fade in, and every stage of the call keeps its own words and
  icon.
- Colour is never the only carrier. Customer states have a word and a distinct icon shape; scores have
  a number and a word; found and missed facts have words and icons; chart markers have different
  shapes; the chosen scenario has a check mark as well as a border.
- `forced-colors: active` has its own rules for every component: system colours, borders where a
  background carried meaning, `Highlight` focus. `prefers-contrast: more` strengthens borders and text.
- The interface is light only, by decision. It declares `color-scheme: light`, so a dark system theme
  does not change it or make it unreadable.

### Targets, zoom and reflow

- **End call** and the **Talk / Stop talking / Interrupt** control are at least 44 by 44 CSS pixels at
  every width tested (320 to 1920 px), and every other control is at least 24 by 24.
- The pages reflow without sideways scrolling from 320 to 1920 px, at 320 by 256 px (400 percent zoom
  of a 1280 by 1024 window) and at 640 by 512 px (200 percent). The call is three columns from 80em,
  two from 64em and one below, with the controls in a dock at the bottom of the screen. The dock and
  the dialogs respect `env(safe-area-inset-bottom)`, and the page asks for `viewport-fit=cover`.
- With a phone keyboard open (a viewport 300 px high) the reply box, the transcript and End call stay
  in view.

## Keyboard map

There are no shortcuts of Firefly's own. These are the keys the controls use.

| Where                                                            | Keys                                    | What happens                                                         |
| ---------------------------------------------------------------- | --------------------------------------- | -------------------------------------------------------------------- |
| Everywhere                                                       | Tab, Shift+Tab                          | Move through the controls in reading order                           |
| Every page                                                       | Enter on the first stop                 | **Skip to main content**                                             |
| The call                                                         | Tab to the first stops                  | "Jump to the call controls", "…the transcript", "…the reply box"     |
| Buttons and links                                                | Enter (Space for buttons)               | Activate                                                             |
| Switches, check boxes                                            | Space                                   | Turn on or off                                                       |
| The scenario list, the segmented controls, the transcript filter | Arrow keys                              | Move to and choose the next or previous option; Tab leaves the group |
| Menus on a phone ("Menu", "Demo mode")                           | Enter, Escape                           | Open; close and keep focus on the button                             |
| Dialogs and sheets                                               | Escape                                  | Close, and return focus to what opened them                          |
| The reply box                                                    | Enter, Shift+Enter                      | Send; start a new line                                               |
| Talk, Stop talking, Interrupt                                    | Enter or Space                          | Start listening; stop listening; stop the customer's voice           |
| Mute, Pause                                                      | Enter or Space                          | Turn on or off                                                       |
| Find in transcript                                               | Enter, Shift+Enter                      | Go to the next or the previous match                                 |
| A quote in the report                                            | Enter on "See turn N in the transcript" | Move focus to that turn; **Back to…** returns it                     |

## How it was checked

The checks are Playwright specs that run against a production build served by the real Firefly server
in demo mode, with an in-memory database and the scripted mock speech provider. They were run on
21 November 2026 with Microsoft Edge (Chromium) on Windows, Playwright 1.65 and axe-core 4.14.0
(`@axe-core/playwright`). The keyboard journey, the dialogs, the header menu, the reflow check and
the reduced-motion, forced-colours and enlarged-text checks were also run once on Playwright's own
Chromium, which is what CI uses.

| Spec                     | Tests | What it checks                                                                                                                                                                                                                                                                                                                                              |
| ------------------------ | ----: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `e2e/a11y.spec.ts`       |    20 | axe on every page and every significant state, at 1440 and at 375 px wide; landmarks, heading outline, titles, `lang`; nothing plays or listens before a click; announcements; a field's error linked to the box                                                                                                                                            |
| `e2e/keyboard.spec.ts`   |     8 | A keyboard-only journey from the landing page to a finished report; the skip link and no keyboard trap on every layout; radio groups; every dialog (focus in, trapped, Escape, focus back); the header menu; Tab stops to the call's controls; stopping the microphone with one key; no key fires a shortcut                                                |
| `e2e/responsive.spec.ts` |    16 | No sideways scrolling at 320, 375, 430, 768, 1024, 1280, 1440 and 1920 px; target sizes; the call at 320 by 256, 640 by 512 and 320 by 300 px; the transcript scrolling inside its own region; the report's score table at 320 px; safe areas; reduced motion, forced colours, more contrast, a dark colour scheme, 200 percent text and wider text spacing |

axe ran with the rule sets `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa` and `wcag22aa` (which include
colour contrast and target size) and with the `best-practice` rules. Any WCAG violation fails a test;
so does a serious or critical best-practice violation; lesser best-practice findings are recorded on
the test instead. There are no rule exemptions.

The states scanned, at both widths: the landing page, Responsible AI, About and the not-found page;
the scenario workspace (the list, a scenario selected with a setting changed, no match for a search,
the filters open, the sheet on a phone, recent calls, a call in progress); the brief and an unknown
scenario; the call's pre-flight, a refused microphone, a text-only call and an unknown call; a spoken
call while the customer speaks, while it listens, while it hears the trainee, while it transcribes, while
the customer thinks, muted and paused; the end-of-call dialog, voice settings, the details sheet
(phone), and a problem banner; the report while it is built, when it fails, when the call is unknown, the
report itself, its transcript with a filter and a cited turn, and the delete dialog.

The spoken states use the server's mock speech provider and a microphone that the test controls
(silence, then a steady tone the voice-activity detector hears as speech), so each stage holds still
long enough to be examined. The customer's voice is lengthened for the same reason. Speech
recognition built into the browser could not be tested: Edge and Chrome under automation return no
words.

### Results

Counts from the runs of 21 November 2026 (Microsoft Edge, one worker). The "before" column comes from
a first pass over the same build before the four fixes listed below it, made with the same helpers.

| What                                                     | Before the fixes                                                                                                       | After the fixes                                                                             |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| axe, WCAG rules, the static pages (12 pages at 2 widths) | 24 scans, 0 violations                                                                                                 | 0                                                                                           |
| axe, WCAG rules, the call at 1440 px                     | 1 violation (`scrollable-region-focusable`, serious) in every workspace state scanned with no dialog open (at least 8) | 0                                                                                           |
| axe, best-practice rules                                 | 1 finding (`skip-link`, moderate) in every call state with the reply box closed (at least 15, both widths)             | 0                                                                                           |
| axe in the final suite                                   |                                                                                                                        | 75 runs (72 with every rule set, 3 for target size): 0 violations, 0 best-practice findings |
| Keyboard                                                 | Focus fell to the top of the page when the scenario sheet opened by "Review and set up" was closed                     | 8 of 8 tests pass                                                                           |
| Reflow                                                   | With the text made 200 percent larger from script, the scenario toolbar was 111 px wider than a 1440 px window         | 16 of 16 tests pass                                                                         |
| The whole suite                                          |                                                                                                                        | 44 tests; three full runs in a row passed; the last took 5.3 minutes                        |

Eleven defects were found and fixed: numbers 1 to 4 by the specs on a Windows machine, numbers 5 to 8
and 11 by the runs on the Linux CI runner (its fallback font, DejaVu Sans, is wider than Segoe UI),
and numbers 9 and 10 by an independent code review of the screens:

1. **The call's context column was not reachable by keyboard** (WCAG 2.1.1, serious). On wide screens
   it scrolls on its own and holds only text, so nothing in it could take focus. The scrolling area is
   now the named, focusable region (`ContextPanel.tsx`, `context.css`).
2. **"Jump to the reply box" pointed at nothing** while the reply box was closed, so it had no target
   (best practice). The box's address now stays in the page (`Composer.tsx`).
3. **Focus was lost when the scenario sheet closed** (WCAG 2.4.3). The "Review and set up" button that
   opened it was removed while the sheet was open, so focus fell back to the top of the page. The
   button now stays in place behind the sheet (`ScenarioWorkspace.tsx`).
4. **The scenario toolbar overflowed with large text** (WCAG 1.4.4). Its four minimum widths are in
   `rem` and added up to more than the row at 200 percent text. Each minimum is now capped at a share
   of the row, which changes nothing at normal sizes (`toolbar.css`).
5. **The public header overflowed on a 320 px screen with a wide font** (WCAG 1.4.10). "Start
   simulation" stuck out by 23 px, and at 200 percent text the links and the button no longer fitted
   on one row at 1440 px. The bar now wraps instead of overflowing, the links wrap as whole links, and
   on screens up to 22em wide the button reads "Start" (its name is still "Start simulation")
   (`PublicHeader.tsx`, `header.css`).
6. **The report's score table and facts block overflowed at 200 percent text** (WCAG 1.4.4). The table
   stacked into one block per skill only below a window width, which larger text does not change. It
   now stacks by the room it has, with a container query in `rem`, and the facts block fits as many
   columns as there is room for (`Scores.tsx`, `report.css`).
7. **A hidden table on the landing page made it 5 px wider than a 320 px screen** (WCAG 1.4.10). A
   table ignores the clipping that hides other elements, so it now sits inside a clipped wrapper
   (`CoachingPreview.tsx`).
8. **The reply box pushed Send out of view at 200 percent text in a 1024 px window**. Send now wraps
   below the box when there is no room beside it (`composer.css`).
9. **Focus was dropped when the control under it disappeared** (WCAG 2.4.3). Declining the
   microphone prompt on the pre-flight, hiding the reply box, acting on or dismissing a notice, and a
   problem taking the place of the voice controls each left focus on nothing. The keyboard now goes
   to the replacement, and focus that is somewhere real is never moved (`use-rescue-focus.ts`,
   `Preflight.tsx`, `Composer.tsx`, `VoiceZone.tsx`, `CallWorkspace.tsx`).
10. **A failed "End and review" was silent and left the keyboard on nothing** (WCAG 4.1.3, 2.4.3).
    The notice inside the dialog now announces itself, the question's first button takes the keyboard
    back, and being offline while ending is treated like any other failed attempt, so Continue call
    lets the call carry on (it used to leave the call blocked until the page was reloaded)
    (`EndCallDialog.tsx`, `problems.ts`).
11. **A badge's text spilled out of its pill** (WCAG 1.4.10). "Written by the coaching evaluator" is
    one line that did not fit the 246 px header of the landing page's report preview at 320 px with
    DejaVu Sans, so it ran 49 px outside the pill and made the page 1 px wider than the screen. Only
    the Linux runner showed it, and only once its real font was loaded here. A badge's text now
    wraps when there is less room than it needs (`badge.css`).

Each has a regression test: 1 to 3 in the unit tests (`CallWorkspace.test.tsx`,
`ScenarioWorkspace.test.tsx`) and in the specs above; 4 to 7 and 11 in `responsive.spec.ts`, which measures
layout and so needs a real browser, and which now sets every element to a deliberately wide font
(Verdana, or DejaVu Sans where it is missing) so that its result does not depend on the machine's
fonts (Verdana is wider than DejaVu Sans but did not show number 11, which depends on exact widths:
only the Linux runner and a local run with the real DejaVu Sans did); 9 and 10 in
`use-rescue-focus.test.tsx`, `Preflight.test.tsx` and `CallWorkspace.flows.test.tsx`. Number 8 has no
test of its own (see Known gaps). The same run showed that the forced-colours check read a button's
colour while it was still easing from one colour to another, which failed on the fast runner; it now
waits for the colour to settle.

### Manual review

Besides the specs, these were done by hand in the browser and recorded here:

- The accessibility tree of the call (pre-flight, a spoken turn, a problem) and of the report was read
  in order, and the reading order matches the visual order. The one difference: on wide screens the
  report's "On this page" list is drawn to the left of the title but comes after it in the tab order.
- Forced-colours screenshots of the landing page, the scenario workspace, the report (with the chart)
  and the call at 1440 and 375 px: borders, the selected scenario's border and check mark, the
  focus ring and the chart's marker shapes all stay visible.
- The focus ring of the call context region, which clips its content, is drawn inside its edge and was
  checked on a screenshot.
- The call at 320 by 300 px (a phone with its keyboard open): the reply box, the transcript and End call
  stay in view.
- The 20-second limit on turning speech into text was watched in the browser: the call says "Turning
  your speech into text took too long. Nothing was sent…" and offers **Try again** and **Continue by
  typing**. The call engine's own tests cover the other limits.
- Nothing plays, listens or loads speech before the start button is pressed (also in the specs).

## What was not checked

- **No screen reader was used.** Not NVDA, JAWS, Narrator, VoiceOver or TalkBack. What a screen reader
  says is inferred from the accessibility tree, the roles, names and live regions the tests read, not
  from listening. Behaviour that differs between screen readers (how a live region queues, whether
  `role="log"` is read as new lines arrive, how a modal dialog is announced) has not been confirmed.
- **No other assistive technology**: no screen magnifier, no switch device, no eye tracker.
- **No voice control** (Dragon, Windows Voice Access, Apple Voice Control). Controls have visible text
  labels and accessible names, but nobody has driven the interface by voice.
- **No real devices.** Phones and tablets were emulated with viewport sizes; real touch, a real
  on-screen keyboard, real safe areas and real zoom were not tried. 400 percent zoom is emulated by a
  320 by 256 px viewport.
- **One browser engine.** Everything ran in Microsoft Edge (Chromium). Firefox and Safari were not
  used.
- **Forced colours and contrast preferences** were tested with the browser's emulation and by looking at
  screenshots, not on Windows contrast themes.
- **The real microphone prompt** cannot be driven by automation, so permission was given or refused by
  the test. Real speech recognition and real speech synthesis were not exercised.
- **No cognitive accessibility review and no testing with disabled people.** The copy is written to be
  plain and the pages are consistent, but that has not been tested with the people it is for.
- **Automated rules find a fraction of problems.** axe finds the kind of defect a rule can describe.
  Whether the reading order makes sense, whether a label is helpful and whether the interface is easy
  to use need a person.

## Known gaps and limitations

- **The announcer can lag the screen by a few seconds.** It reads one sentence at a time and holds each
  long enough to be heard (about 0.7 s plus 25 ms a character), so a burst of changes is read in turn.
  Starting a spoken call produces three sentences in a row ("Waiting for you to allow the microphone…",
  "Asking for the microphone.", "The customer is speaking."). It is polite and never repeats text, but
  it is not instant.
- **The report's "building" view does not set `aria-busy`.** Progress is announced step by step through
  the polite region, and the list of five steps shows each one's state in words.
- **Text enlarged from script.** Making the text 200 percent larger by styling the root element does
  not move the layout breakpoints, because media queries ignore it. The scenario toolbar, the public
  header, the report's score table and facts block, and the reply box overflowed under that emulation
  and were fixed; with it, and with a wide font, no page scrolls sideways in a 1440 px window. A 1024 px
  window is not clean: the landing page's list of scenario kinds, the scenario summary's chips, the
  report's "About this report" list and a speaker's name in the transcript still stick out of their
  boxes. Those were found by a one-off scan, are not covered by a test and are not fixed. Browser
  zoom, which narrows the viewport in CSS pixels and so does move the breakpoints, was emulated at 200
  and 400 percent (640 by 512 and 320 by 256 px). A change to the browser's default font size, which
  also moves em-based media queries, was not tried.
- **`lang="en"`, not `en-GB`.** The text is British English, but the document is declared as English
  without a region.
- **Voice interruption is by button.** Interrupting the customer by speaking over them is not built;
  the **Interrupt** button is the way, and it is reachable by keyboard.
- **Focus can still be dropped when "Try again" is replaced by a loading state.** On the scenarios
  page, in the Recent calls sheet and on the report's "could not be loaded" view, pressing Try again
  swaps the button for a skeleton, and the keyboard is left on nothing until the content arrives. The
  call screens were fixed (number 9 above); these were found by the same review and not fixed.
- **Evidence links repeat their text.** Several "See turn 12 in the transcript" links can sit on one
  screen. They lead to the same place, so the repeated name is accurate, but it is a long list for a
  screen-reader user to hear.

## Decisions

- **The call has `main` and no `banner` or `contentinfo`.** This is acceptable. WCAG does not ask for a
  banner, and a banner stands for site-wide identity and navigation, which the call deliberately does
  not have: while a call is live the only ways out are **End call** and, before the call, **Back to
  brief**. The command bar is controls (the customer, the state of the call, the time, **Details**,
  **End call**), it comes first in the tab order after the skip links, and the three "Jump to" links go
  straight to the controls, the transcript and the reply box. The landmark list is still complete and
  named: main, "Jump to", "Customer and voice", "Transcript", "Reply" and "Call context" (the last on wide
  screens).
- **Keyboard shortcuts: none.** A single-character shortcut would have to be switched off for people
  who use speech input (WCAG 2.1.4) and could fire while someone types. The standard keys are enough.
- **Light theme only.** The interface does not follow a dark system setting.

## Running the checks

Build, then run the three specs. They need a Firefly that is set up for the tests (demo customer, mock
speech provider, failure hooks): the Playwright config starts one.

```powershell
cmd /c "npm run build"
$env:PW_CHANNEL = 'msedge'   # optional: reuse the installed Edge; CI uses Playwright's own Chromium
cmd /c "npx playwright test e2e/a11y.spec.ts e2e/keyboard.spec.ts e2e/responsive.spec.ts --project desktop"
```

To run beside other work, give the run its own port, build and output folder:

```powershell
$env:E2E_PORT = '4331'
$env:E2E_WEB_DIR = (Resolve-Path 'path\to\build').Path
$env:E2E_OUTPUT_DIR = 'scripts/_tmp/pw-a11y'
```

The helpers the specs share (axe scans, landmarks, the focus indicator, a controllable microphone,
sessions made through the API) are in `e2e/support/a11y.ts`. A failing test names the page or state,
and axe's message names the rule, the element and its HTML.
