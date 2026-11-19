# Firefly design system

Firefly's interface is built from a small set of tokens, surfaces and components. This page is the
reference for anyone adding or changing a screen. The source of truth is the CSS in
`web/src/styles/` (tokens in `tokens.css`) and the components in `web/src/components/`. For the
reasoning behind the experience, see [experience-design.md](experience-design.md).

## Principles

- **Clarity before decoration.** Every screen has one primary action, strong hierarchy and plain
  language. Visual effects exist to explain state, never to fill space.
- **A calm, confident workspace.** A deep navy sidebar frames bright white cards on a pale canvas.
  One vivid blue carries every primary action. A blue-to-violet gradient marks the moments that
  invite you to start something (the practice banner, the landing hero). Warm amber is **reserved
  for rewards**: points, stars and badges.
- **Accessible by default.** WCAG 2.2 AA is a release requirement, not a polish step (see the
  checklist below).
- **Honest.** Demo mode is always labelled. No fake progress, fake metrics or disguised mock output.
  Rewards are points with a stated reason; there is no ranking and no comparison with other people.
  Identity is a local profile in this browser, not an account. Voice is labelled Beta and is opt-in.
- **Two real themes.** Light (white cards on a pale blue canvas) and dark (deep navy surfaces) are both
  designed, not inverted. Never hard-code colours that exist as tokens.

## Tokens

All values are CSS variables defined in `web/src/styles/tokens.css`: once for light (the default), once
for dark (`[data-theme='dark']`) and once for the system preference when nobody has chosen a theme
(`prefers-color-scheme: dark`, on `:root:not([data-theme])`). The dark blocks must stay in step.

| Group       | Tokens (examples)                                                                                                                                                                |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Layers      | `--bg`, `--surface`, `--surface-2`, `--surface-3`, `--border`, `--border-strong`                                                                                                 |
| Text        | `--text`, `--text-2`, `--text-3` (all pass AA on their intended surfaces)                                                                                                        |
| Brand       | `--primary`, `--primary-hover`, `--primary-soft`, `--accent`, `--accent-strong`, `--accent-2` (violet), `--cta-bg`, `--cta-text`, `--banner-bg`                                  |
| Rewards     | `--glow` (fills, rings), `--glow-text` (the same amber **for text**, darker in the light theme), `--glow-soft`; used only for points, stars and badges                           |
| Semantic    | `--positive`, `--caution`, `--negative`, `--info` and matching `-bg` tints                                                                                                       |
| Temperature | `--temp-calm`, `--temp-concerned`, `--temp-frustrated`, `--temp-angry`, `--temp-escalating` (always paired with a text label)                                                    |
| Shell       | `--sidebar-bg`, `--sidebar-text`, `--sidebar-muted`, `--sidebar-hover-bg`, `--sidebar-active-bg`, `--sidebar-border`                                                             |
| Type        | `--font-sans`, `--font-heading`, `--font-mono`; scale `--fs-display`, `--fs-title`, `--fs-section`, `--fs-body`, `--fs-small`, `--fs-meta`, `--fs-label`                         |
| Space       | `--sp-1` (4px) to `--sp-9` (96px); use the scale, avoid arbitrary values                                                                                                         |
| Radius      | `--r-control` (10px), `--r-card` (14px), `--r-modal` and `--r-panel` (20px), `--r-pill`                                                                                          |
| Shadow      | `--shadow-1` (resting), `--shadow-2` (raised, modal), `--shadow-lift` (primary action)                                                                                           |
| Motion      | durations `--dur-1` 120ms to `--dur-6` 1000ms; easing `--ease-out`, `--ease-settle`, `--ease-in-out`, `--ease-spring`; `--stagger` 70ms                                          |
| Layers (z)  | `--z-nav` 40, `--z-sheet` 60, `--z-dialog` 70, `--z-toast` 80, `--z-launch` 90                                                                                                   |
| Layout      | `--sidebar-w`, `--topbar-h` (set by the shell), `--nav-height` (the sticky offset above a page: 0 on wide screens, the top bar on small ones), `--content-width`, `--tap` (44px) |
| Focus       | `--focus` (2px outline with 3px offset, applied globally with `:focus-visible`)                                                                                                  |

Use `--glow-text` for any text in the warm colour. Text that carries meaning is checked against both
themes; the contrast tests in `e2e/pages.spec.ts` run axe (WCAG 2.2 AA) on every page in light and dark.

## The app shell

`web/src/components/shell/`:

- **`AppShell`** is the signed-in frame. On wide screens it is a navy **sidebar** (Home, Practice,
  Scenarios, My Progress, Rewards, History; a "For mentors" group with Calibration and Trainer; Settings
  and Help at the foot) beside the main column, which holds a **top bar** (scenario search, provider
  badge, theme toggle, notifications, account menu), the page and a footer carrying the training-aid
  line. Below 960px the sidebar becomes a **drawer** (`Dialog variant="drawer"`) opened from the top bar.
  During a live call (`/calls/:id`) the top bar and footer are hidden and the sidebar shrinks to an icon
  rail, so the conversation owns the screen.
- **`PublicShell`** frames the landing page and sign-in, which draw their own headers.
- `nav.ts` holds the destinations and which addresses light each one (Practice stays lit through setup,
  the call and the report). `NotificationsMenu` derives its notices from saved calls and keeps a "seen"
  timestamp in this browser; nothing is sent anywhere.
- The local profile (`web/src/lib/profile.ts`) holds a name, optional role and location and a few
  preferences in `localStorage`. There is no account system.

## Surfaces

- **Card** (`.glass`, `.surface`, `.card`, `.card-tight`, `.panel`): a white (or dark navy) solid
  surface with a hairline border and a soft shadow. `.glass` keeps its old name but is no longer
  translucent. `.card-interactive` adds a hover lift. `.surface-soft` is a quieter tinted panel.
- **Banner** (`.banner`): the blue-to-violet invitation panel with white text. Direct children are laid
  out as content plus an optional illustration.
- Do not nest cards inside cards more than one level, and never blur large areas.

## Components and classes

- **Buttons:** `.btn` + `.btn-primary | .btn-secondary | .btn-ghost | .btn-danger | .btn-danger-solid`,
  and `.btn-light | .btn-outline-light` on dark or gradient backgrounds. Sizes `.btn-sm`, `.btn-lg`,
  `.btn-icon`. Minimum target size is 44px (36px for `.btn-sm` inside dense rows). One primary button
  per view.
- **Chips:** `.chip` with `-accent | -violet | -amber | -positive | -caution | -negative | -info`.
  `DifficultyChip` and `SettingChips` render scenario settings in plain language.
- **Forms:** `.field`, `.label`, `.hint`, `.field-error`, `.input`, `.textarea`, `.select` and
  `.input-icon` (a leading icon). Selectable cards use `.option` (a native radio or checkbox inside,
  visually hidden but focusable). Compact radio rows use `.choice-row > .choice`. On/off settings use
  `Switch` (a native checkbox with `role="switch"`). Segmented controls use `.segmented`.
- **Tabs:** `Tabs` (`components/ui/Tabs.tsx`) is the WAI-ARIA tabs pattern with one tab stop and arrow
  keys; the caller renders the `role="tabpanel"`.
- **Numbers and progress:** `StatCard`, `ProgressBar` (always has an accessible name and values),
  `ScoreRing` (reads as "4.2 out of 5"), `.meter`, and `IssueIcon` (one icon and tint per issue type; the
  issue type is always written out beside it).
- **Feedback:** `.callout` (+ `-caution`, `-negative`, `-positive`), `EmptyState`, `ErrorState`,
  `LoadingCards`, `SkeletonBlock`, the toast provider (`useToast`) and `OfflineBanner`.
- **Overlays:** `Dialog` (focus trap, Escape, inert background, focus restore) with `variant="dialog"`,
  `"sheet"` (slides up) and `"drawer"` (slides in from the left, used for the mobile navigation).
- **Data display:** `.table` inside `.table-wrap` (stacks into cards on narrow screens where a page
  needs it), the temperature timeline and the report's evidence components.
- **Illustrations:** `components/illustration/` holds the 2D SVG customer avatars, the agent avatar, the
  landing orb and the sign-in building. They are decorative and hidden from assistive technology
  unless given a label.
- **Layout helpers:** `.stack`, `.row`, `.cluster`, `.grow`, `.between`, `.grid-cards`, `.grid-2`,
  `.grid-3`, `.grid-4`, `.page`, `.page-narrow`, `.page-wide`, `.section-head`.

Page structure: `<Page title="...">` sets the document title and applies the page transition;
`<PageHeader eyebrow title lead actions />` renders the heading. There is exactly one `h1` per page.

Page CSS lives in `styles/<page>.css` and is imported by the page. Class names carry a short page
prefix (for example `dash-`, `rp-`) so rules never collide. A page is at least one screen tall, so the
footer starts below the fold and never jumps as content arrives.

## Motion

Motion explains what changed. It never blocks input and never carries essential information.

- Feedback 120-200ms, state changes 320-450ms, reveals 640ms, and 1000ms only for the score ring and
  the launch.
- Animate `transform` and `opacity`. Do not animate layout properties or large blurred regions, and
  never fade text in.
- Route changes use the View Transitions API where available (`viewTransition` on links), a short
  crossfade.
- Reduced motion is honoured from the system setting and from Settings (`data-motion="reduce"`). All
  animation and transitions are effectively disabled; state changes remain visible. The score ring
  draws at its final value and the launch sequence is skipped.
- Sound is optional and off by default (`web/src/lib/sound.ts`); nothing depends on it. Voice is a
  separate opt-in (see [voice.md](voice.md)).

## Accessibility checklist

Every page must:

1. Use semantic landmarks and one `h1`; headings go in order.
2. Label every control (visible `label` or `aria-label`); associate errors with `aria-describedby` and
   `aria-invalid`.
3. Be fully usable by keyboard with a visible focus indicator; no hover-only functionality.
4. Keep targets at least 44x44 CSS pixels (except dense secondary controls, which keep 36px).
5. Not rely on colour alone (pair colour with text, shape or position). Temperature, status and score
   are always text as well.
6. Announce asynchronous results politely (`role="status"` / `aria-live="polite"`); never announce
   text character by character; move focus predictably (dialogs, route changes, errors).
7. Render all user and model text as plain text nodes (never HTML).
8. Reflow without horizontal scrolling from 320px; respect browser zoom and text spacing.
9. Provide a text alternative for charts and pictures (a data table, an equivalent list or a full
   description); decorative graphics are hidden from assistive technology.
10. Work in both themes and with reduced motion.
11. Use `--glow-text` (not `--glow`) for warm-coloured text.

## Writing style

Clear, specific, supportive and calm. Plain words, short sentences, British spelling, sentence case for
headings and buttons. Avoid marketing language ("revolutionary", "AI-powered excellence"), game jargon
("XP", "level up", "top performer") and empty praise. Good: "Ask focused questions to understand impact
and recent changes." Bad: "Unlock next-generation conversational mastery." Never present scores as
employee performance ratings, and never imply ranking or comparison.

## Working on a screen

1. Read the closest existing page for patterns (`web/src/pages/Dashboard.tsx` and its stylesheet).
2. Fetch data with `useApi` from `web/src/lib/hooks.ts` and the typed client in
   `web/src/lib/api.ts`. Handle loading, empty, error and long-content states.
3. Put page-specific CSS in `web/src/styles/<page>.css` and import it from the page.
4. Check both themes at 360px and 1440px wide. `scripts/readme-screenshots.mjs` regenerates the
   documentation images; see [experience-design.md](experience-design.md#visual-review).
5. Run `npm run lint`, `npm run typecheck`, `npm run format:check` and `npm test` before committing,
   and `npm run test:e2e` for anything visible (it checks accessibility in both themes and that nothing
   scrolls sideways).
