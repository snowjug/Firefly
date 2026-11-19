# Firefly design system

Firefly's interface is built from a small set of tokens, materials and components. This page is the
reference for anyone adding or changing a screen. The source of truth is the CSS in
`web/src/styles/` (tokens in `tokens.css`) and the components in `web/src/components/`.

## Principles

- **Clarity before decoration.** Every screen has one primary action, strong hierarchy and plain
  language. Visual effects exist to explain state or give the product identity, never to fill space.
- **Calm, not busy.** Glass, glow and motion are used sparingly. The transcript and the coaching text
  are always the most readable things on a screen.
- **Accessible by default.** WCAG 2.2 AA is a release requirement, not a polish step (see the
  checklist below).
- **Honest.** Demo mode is always labelled. No fake progress, fake metrics or disguised mock output.
- **Two real themes.** Dark ("midnight with a warm firefly glow") and light ("daylight") are both
  designed, not inverted. Never hard-code colours; use tokens.

## Tokens

All values are CSS variables defined in `web/src/styles/tokens.css`.

| Group       | Tokens (examples)                                                                                                                                        |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Layers      | `--bg`, `--surface`, `--surface-2`, `--surface-3` (solid), `--glass-bg`, `--glass-bg-strong`, `--glass-border`, `--glass-fallback`                       |
| Text        | `--text`, `--text-2`, `--text-3` (all pass AA on their intended surfaces)                                                                                |
| Accent      | `--accent`, `--accent-strong`, `--accent-2`, `--glow`, `--cta-bg` (primary gradient), `--cta-text`                                                       |
| Semantic    | `--positive`, `--caution`, `--negative`, `--info` and matching `-bg` tints                                                                               |
| Temperature | `--temp-calm`, `--temp-concerned`, `--temp-frustrated`, `--temp-angry`, `--temp-escalating` (always paired with a text label)                            |
| Type        | `--font-sans`, `--font-display`, `--font-mono`; scale `--fs-display`, `--fs-title`, `--fs-section`, `--fs-body`, `--fs-small`, `--fs-meta`, `--fs-label` |
| Space       | `--sp-1` (4px) to `--sp-9` (96px); use the scale, avoid arbitrary values                                                                                 |
| Radius      | `--r-control` (10px), `--r-card` (18px), `--r-modal` (24px), `--r-panel` (28px), `--r-pill`                                                              |
| Shadow      | `--shadow-1` (resting), `--shadow-2` (raised/modal), `--shadow-lift` (primary action glow)                                                               |
| Motion      | durations `--dur-1` 120ms, `--dur-2` 200ms, `--dur-3` 320ms, `--dur-4` 450ms; easing `--ease-out`, `--ease-in-out`, `--ease-spring` (restrained)         |
| Blur        | `--blur-1` 14px, `--blur-2` 26px                                                                                                                         |
| Focus       | `--focus` (2px outline with 3px offset, applied globally with `:focus-visible`)                                                                          |

## Materials

- **Glass** (`.glass`, `.glass-strong`): navigation, cards that need to feel layered over the ambient
  background, dialogs, the report summary. Every glass surface has a solid fallback
  (`--glass-fallback`) when `backdrop-filter` is unavailable or `prefers-reduced-transparency` is set,
  a thin top highlight, and contrast checked against both themes.
- **Solid surface** (`.surface`): dense content such as tables and long text, where glass would hurt
  readability. Do not nest glass inside glass.
- Blur is limited to the navigation, dialogs and a few cards. Never blur large areas.

## Components and classes

- Buttons: `.btn` + `.btn-primary | .btn-secondary | .btn-ghost | .btn-danger | .btn-danger-solid`,
  sizes `.btn-sm`, `.btn-lg`, `.btn-icon`. Minimum target size is 44px (36px for `.btn-sm` inside dense
  rows). One primary button per view.
- Chips and badges: `.chip` with `.chip-accent | -positive | -caution | -negative | -info`.
  `DifficultyChip` and `SettingChips` render scenario settings in plain language.
- Cards: `.glass.card` (default), `.card-tight`, `.panel`; add `.card-interactive` for hover lift.
- Forms: `.field`, `.label`, `.hint`, `.field-error`, `.input`, `.textarea`, `.select`. Selectable cards
  use `.option` (radio or checkbox inside, visually hidden but focusable); toggles use `.segmented`.
- Feedback: `.callout` (+ `-caution`, `-negative`, `-positive`), `EmptyState`, `ErrorState`,
  `LoadingCards`, `SkeletonBlock`, the toast provider (`useToast`).
- Overlays: `Dialog` (focus trap, Escape, inert background, focus restore); `variant="sheet"` slides up
  on mobile.
- Data display: `ScoreMeter` (1-5), `TemperatureOrb`, `.table` inside `.table-wrap`.
- Layout helpers: `.stack`, `.row`, `.cluster`, `.grow`, `.between`, `.grid-cards`, `.grid-2`,
  `.grid-3`, `.page`, `.page-narrow`, `.page-wide`.

Page structure: `<Page title="...">` sets the document title and applies the page transition;
`<PageHeader eyebrow title lead actions />` renders the heading. There is exactly one `h1` per page.

## Motion

Motion explains what changed. It never blocks input and never carries essential information.

- Micro-interactions 100-180ms, navigation 180-280ms, complex panels 280-450ms.
- Prefer `transform` and `opacity`. Do not animate layout properties or large blurred regions.
- Route changes use the View Transitions API where available (`viewTransition` on links), a short
  crossfade.
- Reduced motion: honoured from the system setting and from Settings (`data-motion="reduce"`). All
  animation and transitions are effectively disabled; state changes remain visible.
- The home-page beacon is a restrained CSS 3D motif (no WebGL). It pauses when off screen and is
  static under reduced motion.

## Accessibility checklist

Every page must:

1. Use semantic landmarks and one `h1`; headings go in order.
2. Label every control (visible `label` or `aria-label`); associate errors with `aria-describedby` and
   `aria-invalid`.
3. Be fully usable by keyboard with a visible focus indicator; no hover-only functionality.
4. Keep targets at least 44x44 CSS pixels (except dense secondary controls, which keep 36px).
5. Not rely on colour alone (pair colour with text, shape or position). Temperature is always text.
6. Announce asynchronous results politely (`role="status"` / `aria-live="polite"`); never announce
   text character by character; move focus predictably (dialogs, route changes, errors).
7. Render all user and model text as plain text nodes (never HTML).
8. Reflow without horizontal scrolling from 320px; respect browser zoom and text spacing.
9. Provide a text alternative for charts (a data table or equivalent list).
10. Work in both themes and with reduced motion.

## Writing style

Clear, specific, supportive and calm. Avoid marketing language ("revolutionary", "AI-powered
excellence") and empty praise. Good: "Ask focused questions to understand impact and recent
changes." Bad: "Unlock next-generation conversational mastery." Never present scores as employee
performance ratings.

## Working on a screen

1. Read the closest existing page for patterns (`web/src/pages/Dashboard.tsx` and
   `web/src/styles/dashboard.css`).
2. Fetch data with `useApi` from `web/src/lib/hooks.ts` and the typed client in
   `web/src/lib/api.ts`. Handle loading, empty, error and long-content states.
3. Put page-specific CSS in `web/src/styles/<page>.css` and import it from the page.
4. Check both themes and 390px and 1440px wide. The options of `scripts/shot.mjs` are documented at
   the top of that file; it can create sample sessions and calls so you can capture any state.
5. Run `npm run lint`, `npm run typecheck`, `npm run format:check` and `npm test` before committing.
