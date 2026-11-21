# Accessibility

Firefly is a practice tool for people who are learning a job, and some of them use a keyboard, a screen reader, a magnifier, voice control or a phone. This page says what the interface is built to do, how it is checked, what has **not** been checked and where it is known to fall short. Paths start at the repository root.

## What this page claims

- The target is **WCAG 2.2 level AA**. It is a target, not a claim of conformance. Firefly has not been audited by an accredited body.
- The only checks are **automated**: axe-core runs in the component tests and in the browser tests, and the browser tests also read focus, landmarks, headings, live regions and layout. These find the defects a rule can describe.
- **No screen reader or other assistive technology has been used to test Firefly.** What a screen reader says is inferred from roles, names and live regions that tests read, not from listening. See [What was not checked](#what-was-not-checked).
- This page records no pass count and no run date. A result belongs to a commit; CI runs the browser tests on every change (`.github/workflows/ci.yml`).

## What is built in

Every item below is in the code. Where a test covers it, the test is named.

### Structure and navigation

- The document is `<html lang="en">` (English, not a regional variant), declares `color-scheme: light` and asks for `viewport-fit=cover` (`web/index.html`).
- The first Tab stop on every page, the call page included, is a **Skip to main content** link (`web/src/app/shell/Shell.tsx`). `main` has the id `main` and can take focus.
- Landing, information, scenario, brief and report pages have a header, `main` and a footer. The call page has no header or footer: it draws its own command bar inside `main`, and adds a **Jump to** list (the call controls, the transcript and, in a typed call, the reply box) (`web/src/features/call-ui/JumpLinks.tsx`).
- The report has section navigation: **On this page** on wide screens, with the current part marked by `aria-current="location"`, and a **Jump to** disclosure on narrow ones (`web/src/features/report/SectionNav.tsx`).
- Browser tests check that each route has its own title, one `h1`, headings that do not skip a level and landmarks that are named without clashing (`e2e/a11y.spec.ts`).

### Focus and keyboard

- Focus is visible: a thick dark outline with a gap, and in forced colours a 2 px `Highlight` outline (`web/src/design/base.css`). The keyboard spec checks that every Tab stop it passes shows an indicator that is in view and has at least 3:1 contrast.
- Lists of choices (the difficulty and the other segmented controls, and the scenario list on wide screens) are native radio groups, so Tab enters once and the arrow keys move between options. On a phone the scenario list is a list of links, and the arrow, Home and End keys move between its rows (`ScenarioList.tsx`). A keyboard test covers the radio groups.
- Dialogs are native `<dialog>` elements opened with `showModal()` (`web/src/design/primitives/Dialog.tsx`). Focus stays inside, Escape closes, and focus returns to what opened the dialog. A dialog has its own live region, because a modal makes the rest of the page inert.
- When a control that held focus is replaced (a button swapped for a notice about it, or a notice dismissed), focus goes to the call controls instead of falling to the top of the page. Focus that is somewhere real is never moved (`use-rescue-focus.ts`).
- There are no keyboard shortcuts of Firefly's own and no single-character keys, so nothing can fire while someone types or uses speech input. In the reply box, Enter sends and Shift+Enter starts a new line (`Composer.tsx`). The keyboard spec checks that the microphone stops with one key press and that no letter key does anything.

### What a screen reader is told

- One polite `role="status"` region near the root says changes in whole sentences, one at a time. The same sentence is not repeated within four seconds, each is held for 0.7 s plus 25 ms a character (at most 5 s) so it can be read, and at most six wait (`web/src/design/primitives/announcer.ts`). It can lag the screen by a few seconds in a burst of changes.
- The call's transcript is a `role="log"` and is the place transcript text is announced. The customer's reply is written there **before** its voice plays. The call timer is `role="timer"` with `aria-live="off"` and is never announced.
- The call's status line comes from fixed words in `web/src/features/voice/states.ts`. Each state has a sentence for a screen reader, except "Microphone off" (nothing has happened yet) and "Hearing you", which flips many times a call and would talk over the trainee. A refused or missing microphone is announced assertively. A customer voice that failed is announced politely, because the words are on the screen.
- Problems say what happened, what was kept and what to do, with the actions that really apply (**Retry**, **Use text**, **Replay**, **Continue without audio**). See [voice-architecture.md](voice-architecture.md#when-something-fails).
- Controls report their state: **Mute** is a pressed button, disclosures have `aria-expanded`, and a field with an error has `aria-invalid` and the error in its description (`web/src/design/primitives/`).

### Voice, without surprises

- Nothing starts before a click. The microphone opens only after an explicit press: the optional **Check microphone** on the brief, or **Start voice call** on the pre-flight page. The browser test "nothing plays, listens or loads speech before the person starts the call" checks it.
- Typing always works. Every voice error says so, and a typed call hides the voice controls instead of leaving dead buttons.
- The microphone's state is always in words as well as an icon and a waveform. The customer's voice is never the only carrier of what the customer said.

### Motion, colour and contrast

- Under `prefers-reduced-motion`, animation and transition durations are cut to 0.01 ms and the waveform's dots stop moving (`web/src/design/base.css`, `web/src/features/call-ui/waveform.css`). A responsive spec checks that nothing animates for longer than a moment.
- Colour is not the only carrier: customer states, scores and found or missed facts have words or icon shapes as well.
- `forced-colors: active` has its own rules for the components, and `prefers-contrast: more` strengthens borders and text (`web/src/design/tokens.css` and the component stylesheets).
- The interface is light only, by decision. A dark system theme does not change it.

### Targets, zoom and reflow

- The browser tests check that pages reflow without sideways scrolling across a range of widths from 320 to 1920 px, that no control is smaller than 24 by 24 CSS pixels where the layout changes, that **End call** and the reply box stay in reach, and that the call stays usable at 400 percent zoom with an on-screen keyboard (`e2e/responsive.spec.ts`). Every responsive check runs with a deliberately wide font, so its result does not depend on the machine's fonts.
- The mobile project runs the main journeys on an emulated Pixel 7 (`e2e/mobile.spec.ts`).

## How it is checked

| Check                                                    | Where                                                                                    | What it covers                                                                                                                                                                                                                                                                                          |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| axe in the component tests                               | `web/src/features/call-ui/a11y.test.tsx` and the helper `axeViolations`                  | The WCAG 2.0, 2.1 and 2.2 A and AA rule sets and the best-practice rules, in jsdom. Colour contrast, scrollable regions and the page-region rule are switched off because jsdom has no layout or colour engine.                                                                                         |
| axe in the browser tests                                 | `e2e/a11y.spec.ts`, with `@axe-core/playwright` and the helpers in `e2e/support/a11y.ts` | The same rule sets on every page and significant state of the real app, at a desktop and a phone width. A WCAG violation fails the test, and so does a serious or critical best-practice violation. Lesser best-practice findings are attached to the test. There are no rule exemptions in the helper. |
| Landmarks, headings, titles, live regions, names, states | `e2e/a11y.spec.ts`                                                                       | Structure that axe cannot judge, and the call's announcements as a screen reader receives them.                                                                                                                                                                                                         |
| Keyboard                                                 | `e2e/keyboard.spec.ts`                                                                   | A keyboard-only journey from the landing page through a voice call to a report, the skip link and no keyboard trap on every layout, radio groups, every dialog, the header menu on a phone, and stopping the microphone with one key.                                                                   |
| Layout and preferences                                   | `e2e/responsive.spec.ts`                                                                 | Reflow, target sizes, the call at small sizes, reduced motion, forced colours (emulated), more contrast, a dark colour scheme, 200 percent text and wider text spacing.                                                                                                                                 |

The browser tests run against a production build served by the real Firefly server in demo mode, with an in-memory database, the scripted mock speech provider and a fake microphone that the test controls. They run in Chromium: Playwright's own Chromium in CI, or an installed Edge or Chrome with `PW_CHANNEL`. To run them:

```
npm run build
npx playwright test e2e/a11y.spec.ts e2e/keyboard.spec.ts e2e/responsive.spec.ts e2e/mobile.spec.ts
```

`npm run test:e2e` builds and runs every browser spec. `npm test` runs the component tests, which include the axe checks.

## What was not checked

- **No screen reader was used.** Not NVDA, JAWS, Narrator, VoiceOver or TalkBack. How a live region queues, whether `role="log"` is read as lines arrive and how a modal is announced differ between screen readers and have not been confirmed.
- **No other assistive technology**: no screen magnifier, switch device or eye tracker.
- **No voice control** (Dragon, Windows Voice Access, Apple Voice Control). Controls have visible text labels and accessible names, but no voice-control tool has been used to drive the interface.
- **No real devices.** Phones are emulated by viewport. Real touch, a real on-screen keyboard, real safe areas and real zoom were not tried, and 400 percent zoom is emulated by a small viewport.
- **One browser engine.** Everything runs in Chromium. Firefox and Safari have not been tried.
- **Forced colours and contrast preferences** are tested with the browser's emulation, not on Windows contrast themes.
- **The real microphone prompt** cannot be driven by automation, so a fake microphone stands in. Real speech recognition and real speech synthesis were not exercised.
- **No cognitive accessibility review and no testing with disabled people.** The copy is written to be plain and the pages are consistent, but that has not been tested with the people it is for.
- **Automated rules find a fraction of problems.** Whether the reading order makes sense, whether a label is helpful and whether the interface is easy to use need a person.

## Known limitations

- **The announcer can lag the screen** in a burst of changes, because it reads one sentence at a time and holds each long enough to be heard. It is polite and never repeats text, but it is not instant.
- **`lang="en"`, not `en-GB`.** The text is British English, but the document is declared as English without a region.
- **The interface is English only.** Speech languages are en-GB, en-US, en-IE, en-AU and en-IN.
- **A voice choice may not sound different.** A browser with one English voice cannot make four voices sound different, and the brief says so. This matters for people who rely on hearing the customer, who can read the transcript instead.

## If you find a problem

Treat an accessibility defect as a bug. Add a test that fails without the fix: a component test for structure, or a browser spec for anything that needs layout, focus or a real browser. Update this page if the fix changes what is claimed.
