# Accessibility

Firefly's target is **WCAG 2.2 level AA**, and it is treated as a release requirement. It is a target and
not a certificate: the interface has not been audited by anyone outside the team, and it has not been
tested with a screen reader, a screen magnifier or voice control. This page says what is built, how it
was checked, what was found and fixed along the way, and what is still open.

## What is built

The interface is spatial and animated, so the rule is that nothing depends on a pointer, on colour, or
on motion. The design reasons are in [experience-design.md](experience-design.md#accessibility-approach).

**Every spatial view has a semantic alternative.** The mission atlas has a list with the same
information (the default on a phone). The Signal instrument has a written key (`describeGlyph`,
`describeCore`). The progress sky has a list of the six skills and, below the page, a table of scores. The
customer's journey through a call has a table. Mood is carried by shape, word and movement together,
never by colour alone, and every score, status, badge and difficulty is also written out.

**Structure.** One `h1` per page with no skipped levels, a skip link to `main`, a `nav` named "Main" with
`aria-current="page"` on the dock, a document title per page, `lang="en"`, and a viewport that never
blocks zoom. When the address changes, focus moves to the page's `main` (including from the front door
into the app), so a keyboard or screen-reader user starts at the top of the new page.

**Keyboard.** Everything is reachable and operable without a pointer: the Ctrl or Cmd + K palette, the
dock, the atlas (arrow keys move across the plane), the skill sky and the journey line (arrow keys move
between points), tabs, the live call and its voice controls, and every dialog. Dialogs trap focus, close on
Escape and give focus back to what opened them. Focus is always visible (a 2 px ring with an offset that
survives any background), and a focused control is scrolled clear of the floating dock, the masthead and
the sticky "Enter the call" bar (`scroll-padding`, WCAG 2.4.11). Nothing is a keyboard trap.

**Motion.** Reduced motion is honoured from the device and from Settings and is a designed mode: nothing
loops, nothing is drawn by `requestAnimationFrame`, and state changes are instant with the same words.
A persistent **Pause ambient motion** control (top right of every page, and **Pause motion** in the call's
own controls, because the cluster is not on screen during a call) stills everything that moves by itself
(WCAG 2.2.2) and remembers the choice. Nothing flashes, and nothing changes faster than three times a
second. The animated field has three effects tiers (`?perf=high|medium|low`), and the lowest draws no field.

**Colour and contrast.** Colours are tokens, in two designed themes. Text that carries meaning uses the
`-text` variants of the lights and `--ink-1` or `--ink-2`; a unit test works out their contrast from the
token files, against the worst case the animated field can make (4.5:1 for `--ink-1` and `--ink-2`, 3:1
for `--ink-3`). The quietest ink, `--ink-3`, is for decoration and secondary labels (see the open items).
`prefers-contrast: more` makes lines stronger and the field weaker. `forced-colors: active` gives every
stylesheet a defined result (system colours, borders instead of shadows, a solid ground wherever a
gradient was the ground). `prefers-reduced-transparency` removes glass.

**Size and reflow.** Designed from 320 CSS pixels with no two-dimensional scrolling (a few controls, such
as the tab row and the guided "Ideas", scroll or wrap within themselves). Text is in `rem`. Primary
controls are at least 44 px; a few secondary ones are smaller (see below), and nothing is under the 24 px
that WCAG 2.2 asks for except links inside a sentence.

**Names, labels and messages.** Native elements first, with ARIA only for tabs, switches, the palette's
combobox and listbox, and dialogs. Every form control has a visible label. A polite live region announces a
new customer reply once as a whole, a discovery ("Signal found") and a shift in the conversation, and never
announces character by character. Errors say what happened and what to do, and offer a retry only when
retrying can help. Message text is shown as plain text with `dir="auto"`, so right-to-left text aligns
itself.

**Voice** is opt-in, labelled Beta, and typing always works. It cannot be the only way to do anything.

## How it is checked

| What                                                                                                     | Where                                                      | When                       |
| -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | -------------------------- |
| Lint rules for accessible markup (`jsx-a11y`)                                                            | `npm run lint`                                             | CI                         |
| Component and unit tests by role and name: focus, dialogs, tabs, the palette, live regions, alternatives | `web/src/**/*.test.tsx`                                    | CI                         |
| Contrast of `--ink-1`, `--ink-2` and `--ink-3` against the worst case the animated field can make, computed from the real token files | `world-draw.test.ts`                                       | CI                         |
| Stylesheets use tokens only (no raw colours), and primary controls are at least 44 px                    | `frame-css.test.ts`                                        | CI                         |
| axe-core (WCAG 2.0 to 2.2, A and AA) on every page and state, in light and dark                          | `e2e/pages.spec.ts` (the sweep), `e2e/call.spec.ts`        | CI (Playwright, Chromium)  |
| No sideways scrolling at 320 px and 1440 px, and for first-time learners at 320 px and 390 px            | `e2e/pages.spec.ts`                                        | CI                         |
| A live call can still be ended on a 320 x 256 screen (a desktop zoomed to 400%)                          | `e2e/call.spec.ts`                                         | CI                         |
| Keyboard-only journeys: setup, the call, the dock, the palette                                           | `e2e/journey.spec.ts`, `e2e/pages.spec.ts`                 | CI                         |

**A hands-on review during the redesign** (scripted with Playwright in Microsoft Edge, not part of CI):

- A keyboard-only walk from the front door to every part of the app, in both themes: skip link, heading
  outline, tab order, focus ring contrast (measured at 10 to 13:1 on dark and 4.8 to 6:1 on light),
  arrow keys where promised, and every dialog (palette, end call, voice, tour, compare, delete, edit
  profile, feedback) trapping focus both ways, closing on Escape and restoring focus.
- axe on 21 pages and states, in both themes, at 1440 and 390 px wide (84 runs): no violations of any
  impact. Contrast over the gradient and the canvas is reported by axe as "needs review", so text
  contrast was also measured from screenshots on the 12 most text-heavy page and theme combinations at
  1440 px and 8 at 390 px: body text in `--ink-1` and `--ink-2` never fell below 4.5:1.
- Reduced motion on 13 pages in both themes: no infinite animation, no animation frames requested and a
  still field. Increased contrast, forced colours (emulated) and the three effects tiers were looked at
  on the main pages.
- 320 px reflow and a 320 x 256 viewport (400% zoom) on the main pages.

## What the review found, and what was done

The review found real problems, which is why the list is here.

| Found                                                                                                                                                          | Done                                                                                                                                 |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| The live call on a narrow, short screen (400% zoom, a small window) had no End call and a conversation squeezed to 17 px                                         | The buttons stay unless the on-screen keyboard is what makes the screen short, and the page scrolls round a conversation of sensible height. A browser test covers it |
| The glow around the instrument made the front door, practice page and setup scroll sideways on phones; the empty Progress sky ran 43 px past the edge          | The shell clips decorative overflow; the empty Progress page opens as a list on a small screen. Browser tests now cover first-run pages |
| On setup at 390 px a keyboard-focused control could sit under the sticky "Enter the call" bar                                                                  | The bar's height is part of the page's `scroll-padding`                                                                              |
| On wide screens the sticky sky slid 54 px over the "Scores as a table" row                                                                                     | The table moved out of the sky's grid                                                                                                |
| In forced colours a gradient-only ground vanished, so scrolled content printed through the masthead and the setup bar                                         | A solid system ground in forced colours                                                                                              |
| No way to pause the call's moving presence and field during a call                                                                                             | A Pause motion control in the call                                                                                                   |
| Focus stayed on the page body after Begin and Create profile                                                                                                   | Focus moves to the new page's `main`                                                                                                 |
| After opening the mission Lens, Tab went to the search before the options                                                                                      | The options follow the button in the DOM                                                                                             |
| Earlier turns in the call, and some small functional labels (the Ctrl K hint, the report's section links, the call strip), were below 4.5:1 in places          | Those use `--ink-2`; the top fade over earlier turns is shorter                                                                      |
| Tab rows clipped on phones                                                                                                                                     | They wrap                                                                                                                            |
| A click made while a page transition was running was lost (35 of 36 quick two-click sequences in a real browser)                                               | A click that began during a transition is delivered to the control under the pointer. 0 of 36 are lost now                           |

## Known gaps

- **No assistive-technology testing.** Nobody has used Firefly with NVDA, JAWS, VoiceOver, TalkBack,
  a magnifier or voice control, and there has been no external audit. The semantics are tested by role and
  name, and by axe, which finds only a part of the problems.
- **The quietest ink.** `--ink-3` (small uppercase labels, hints, tick numbers) is guaranteed 3:1 at its
  worst and measured 4.8 to 6.6:1 on average, but in the review four small labels dipped to 3.3 to 3.6:1
  at their worst pixels where the field is brightest. The functional ones were moved to `--ink-2`; the
  rest is decoration or repeats information that is written elsewhere. Text over the animated field is
  checked from screenshots, not by axe.
- **Targets.** History row actions, the Voice buttons, the call's Home link and the report's turn links
  are 34 to 40 px tall (above WCAG 2.2's 24 px, below the 44 px the design aims for).
- **Reflow.** The guided "Ideas" chips scroll sideways inside their row at 390 px and below, and the
  third can sit partly out of view.
- **Tab order.** On Progress, focus visits the sky, then the left column, then the table, then "Include
  sample sessions", which is not the visual order.
- **Not exercised.** Real browser zoom and operating-system high-contrast palettes (emulated with a
  viewport size and `forcedColors`), touch and an on-screen keyboard, Firefox and Safari, and Voice with
  a real person speaking.
- **Language.** The interface is in English only.

## Reporting a problem

Open an issue with the page, what you did, what you expected and what happened, and say which browser
and assistive technology you used. Fixes to accessibility are made with a test where a test can catch
the problem.
