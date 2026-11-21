# Design system

Firefly's interface is built on one small design system, written for this project. It is informed by Microsoft's public Fluent 2 web light theme (colour values and type ramp checked against Microsoft's open-source Fluent UI tokens) but it is an original implementation: Fluent UI React is not used, no Microsoft asset is copied, and the logo mark is Firefly's own. The interface is **light only**, by decision. It uses the system's Segoe UI Variable where it exists, and system fonts elsewhere; no web font is downloaded.

Where it lives:

| Path                                  | Contents                                                                                                                   |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `web/src/design/tokens.css`           | Every colour, type, spacing, radius, shadow, motion and focus value, as CSS custom properties.                             |
| `web/src/design/base.css`, `type.css` | The reset, focus, reduced-motion, contrast and forced-colours rules, and the type roles (`t-*`).                           |
| `web/src/design/layout.css`           | Page and layout helpers (`l-*`) and small utilities (`u-*`).                                                               |
| `web/src/design/primitives/`          | One component and one stylesheet each. Imported through `web/src/design/index.ts`.                                         |
| `web/src/design/icons.tsx`            | About 70 hand-drawn inline SVG icons (`Icon`, `ICON_NAMES`). No icon font or icon library.                                 |
| `web/src/app/`                        | The shell: router, layouts, headers, footer, wordmark, route errors, skip link, offline notice, scroll and focus handling. |
| `web/gallery.html`                    | A development-only page that shows every primitive in every state. Served by the Vite dev server; not part of the build.   |

## Principles

- **Calm and legible.** White canvas, restrained neutrals, one brand colour for actions, selection and active state. Nothing decorative moves.
- **Colour never carries meaning alone.** Customer mood, scores, status and found/missed facts always have a word, and mood has a distinct icon shape for each of its six states.
- **Native first.** Native `<dialog>`, `<select>`, radio groups and checkboxes where they do the job, with roving tabindex only where a pattern needs it (tabs).
- **Targets are large.** Primary controls are 44 px high, dense controls 32 px, and nothing is below 24 px.
- **Motion explains, then stops.** Short, interruptible transitions; every animation has a still equivalent under `prefers-reduced-motion`.
- **Text is plain.** Anything from a user or a model is rendered as text, never as HTML.

## Tokens

Components use semantic tokens (`--fg-*`, `--bg-*`, `--brand*`, `--state-*`, `--status-*`) and never raw colour values.

| Group          | Tokens                                                                                                                                                                           |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Type           | `--font-base`, `--font-display`, `--font-mono`; scale from caption (12/16) through body (14/20), reading (16/24), subtitle, title 3 to 1 and a fluid display size (30 to 40 px). |
| Neutrals       | `--bg-canvas` `#ffffff`, `--bg-quiet`, `--bg-subtle`, `--bg-section`, `--bg-strong`; text `--fg-1`, `--fg-2`, `--fg-3` (`#616161`, the lightest text used), `--fg-disabled`.     |
| Brand          | `--brand` `#0f6cbd`, hover `#115ea3`, pressed `#0c3b5e`, tint `#ebf3fc`, link `#115ea3`.                                                                                         |
| Status         | `--status-{success,warning,danger,info,neutral}-{fg,bg,border}`.                                                                                                                 |
| Customer mood  | `--state-{calm,concerned,frustrated,angry,escalating,recovering}-{fg,bg,border}`. Always shown with a label and its own icon.                                                    |
| Accents        | `--ai-*` (analysis written by the coaching evaluator, used sparingly), `--voice-trainee` and `--voice-customer` (waveforms).                                                     |
| Spacing, shape | A 4 px grid (`--sp-*`), radii, three shadow levels, an acrylic-style surface for sticky bars.                                                                                    |
| Control sizes  | `--ctl-sm` 32, `--ctl-md` 44, `--ctl-lg` 48.                                                                                                                                     |
| Focus          | A 2 px black outline with a 1 px white inner ring (21:1 on white), on every focusable element. In forced-colours mode the system colours are used instead.                       |

Breakpoints cannot be custom properties, so they are written as media queries: 30em (480), 40em (640), 48em (768), 64em (1024), 80em (1280), 90em (1440) and 120em (1920).

## Components

Everything below is exported from `web/src/design/index.ts`. Pages import from the barrel and never write their own button, field or dialog.

| Export                                                                        | Notes                                                                                                                                                                                                                         |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Button`, `IconButton`, `ToggleButton`, `LinkButton`                          | Appearances primary, secondary, outline, subtle, danger; sizes small, medium, large. `loading` keeps width and focus and sets `aria-busy`. `IconButton` requires a `label`. External links announce that they open a new tab. |
| `TextLink`, `BackLink`, `Breadcrumb`                                          | Router links and external links.                                                                                                                                                                                              |
| `Field`, `TextInput`, `TextArea`, `SearchBox`, `Select`, `Checkbox`, `Switch` | `Field` wires the label, hint and error (a polite live region) to the single control inside it. `Switch` uses `role="switch"`.                                                                                                |
| `SegmentedControl`                                                            | A native radio group (arrow keys work) with segment, card or automatic layout.                                                                                                                                                |
| `Badge`, `Tag`, `StateBadge`                                                  | Tones for status, analysis and each customer mood. Customer-state helpers (`CUSTOMER_STATES`, labels, icons) live here.                                                                                                       |
| `MessageBar`                                                                  | Intents info, success, warning, error. Error uses `role="alert"`; the others `role="status"`. The intent is also written as hidden text.                                                                                      |
| `Spinner`, `ProgressBar`, `Skeleton`                                          | Reduced motion shows a still bar and a static indicator.                                                                                                                                                                      |
| `Avatar`                                                                      | Initials, with a speaking ring that stays still under reduced motion.                                                                                                                                                         |
| `Surface`, `Card`, `Divider`                                                  | Flat, outlined and elevated surfaces.                                                                                                                                                                                         |
| `ScoreBar`                                                                    | Always shows the number and the word as text, in one calm colour.                                                                                                                                                             |
| `Tabs`, `TabList`, `Tab`, `TabPanel`                                          | Roving tabindex, arrow keys, Home and End.                                                                                                                                                                                    |
| `Dialog`                                                                      | A native `<dialog>`. The safe action takes `data-autofocus`; a must-answer dialog is `dismissible={false}`; on narrow screens it becomes a sheet or full screen. Focus returns to the opener.                                 |
| `AnnouncerProvider`, `LiveRegion`, `useAnnouncer`                             | Screen-reader announcements are queued, de-duplicated and read one at a time.                                                                                                                                                 |
| `VisuallyHidden`, `cx`                                                        |                                                                                                                                                                                                                               |

Deliberately **not** included: toasts, tooltips and menus (use `MessageBar`, visible text and links), auto-growing text areas, and right-to-left layout.

## Shell and routing

`web/src/app/router.tsx` builds a React Router data router with three layouts: **public** (`/`, `/responsible-ai`, `/about`, the not-found page), **app** (`/scenarios`, `/scenarios/:id/brief`, `/sessions/:id/report`) and **call** (`/calls/:id`, which has no navigation, only a skip link and `main`, so the call has the whole screen).

- Every page is a lazy route and a default export. Titles go through `useDocumentTitle`; the page's place in the app header goes through `useAppSection`.
- After a client navigation, focus moves to the section a `#hash` names, or to `main` for a new path. A query-only change and the first load never move focus.
- Each layout has its own error boundary, so a failing page keeps the header and footer around the error message. A failed lazy chunk offers a reload.

## Class ownership

| Prefix        | Owner                                                                                                                                                |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ff-*`        | The design system: one stylesheet per primitive (`design/primitives/*.css`) and per shell part (`app/shell/*.css`).                                  |
| `l-*`, `u-*`  | `layout.css`: `l-page`, `l-stack`, `l-cluster`, `l-grid`, `l-split`, gaps `l-gap-1` to `l-gap-12`; `u-nowrap`, `u-truncate`, `u-scroll-x` and so on. |
| `t-*`         | `type.css`.                                                                                                                                          |
| Anything else | A feature's own short prefix (for example `cw-` for the call workspace, `rp-` for the report).                                                       |

A feature stylesheet must never be the subject of a rule on an `ff-*` class. Joined selectors (`.ff-button.cw-x`), descendants (`.cw-x .ff-button`) and `:has` scopes are allowed, and a test (`class-ownership.test.ts`) scans every stylesheet under `web/src` and fails otherwise.

## Contrast and accessibility

Contrast is measured from the tokens by a test (`tokens` tests, 56 assertions), so a colour change that fails fails the build. The lowest text pair is 4.81:1.

| Pair                                                                                           | Ratio                        |
| ---------------------------------------------------------------------------------------------- | ---------------------------- |
| `--fg-1`, `--fg-2`, `--fg-3` on white                                                          | 15.5, 10.1, 6.2              |
| White on brand, brand hover, danger                                                            | 5.4, 6.7, 7.1                |
| Status foreground on its background (success, warning, danger, info, neutral)                  | 5.9, 4.9, 6.6, 4.8, 9.2      |
| Mood foreground on its background (calm, concerned, frustrated, angry, escalating, recovering) | 5.9, 5.9, 5.1, 6.6, 9.9, 5.9 |
| Accessible control edge on white                                                               | 6.2                          |
| Focus ring on white                                                                            | 21                           |

The accessibility checks that were run on the finished interface, and what they did not cover, are in [accessibility.md](accessibility.md).

## Changing the system

1. Use an existing token or primitive. If none fits, add it to `web/src/design` with its own stylesheet, a gallery entry and a test, rather than styling it inside a page.
2. Keep names additive: do not rename or remove an export that a page uses.
3. Run `npm run dev` and open `/gallery.html` to see every state, then check the result at 320 px and 1440 px, with the keyboard only, with reduced motion and with forced colours.
4. A new dependency needs a reason in the commit message. The browser bundle contains React, React Router and Firefly's own code. `zod` is a server-side dependency and stays out of the browser bundle: the web app imports only types and plain constants from `shared/`.
