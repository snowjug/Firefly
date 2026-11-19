# Firefly design system

Firefly's interface is built from a small set of tokens, materials and components. This page is the
reference for anyone adding or changing a screen. The source of truth is the CSS in
`web/src/styles/` (tokens in `tokens.css`) and the components in `web/src/components/`. For the
reasoning behind the design, see [experience-design.md](experience-design.md).

## Principles

- **Clarity before decoration.** Every screen has one primary action, strong hierarchy and plain
  language. Visual effects exist to explain state or give the product identity, never to fill space.
- **Light is earned.** The warm light (`--glow`) marks an action or something that really happened:
  a fact found, a skill lit, a milestone earned. Do not use it as general decoration.
- **Calm, not busy.** Glow and motion are used sparingly. The transcript and the coaching text are
  always the most readable things on a screen.
- **Accessible by default.** WCAG 2.2 AA is a release requirement, not a polish step (see the
  checklist below).
- **Honest.** Demo mode is always labelled. No fake progress, fake metrics or disguised mock output.
  No points, streaks or comparisons with other people.
- **Two real themes.** Dark (a night meadow: pine-black with one warm light) and light (linen paper
  with ink-green text and burnt amber) are both designed, not inverted. Never hard-code colours; use
  tokens.

## Tokens

All values are CSS variables defined in `web/src/styles/tokens.css`, once for dark, once for light and
once for the system preference (the three blocks must stay in step).

| Group       | Tokens (examples)                                                                                                                                                                           |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Layers      | `--bg`, `--surface`, `--surface-2`, `--surface-3` (solid), `--glass-bg`, `--glass-bg-strong`, `--glass-border`, `--glass-highlight`, `--glass-fallback`                                     |
| Ambient     | `--bg-glow-1` to `--bg-glow-3` (large soft washes behind the page), `--speck` (the few static light points)                                                                                 |
| Text        | `--text`, `--text-2`, `--text-3` (all pass AA on their intended surfaces)                                                                                                                   |
| Accent      | `--accent`, `--accent-strong`, `--accent-2` (mist and mint: selection, structure, links)                                                                                                    |
| Warm light  | `--glow` (fills, rings, glows), `--glow-text` (the same colour **for text**, darker in the light theme), `--glow-soft`, `--cta-bg` and `--cta-text` (primary action)                        |
| Semantic    | `--positive`, `--caution`, `--negative`, `--info` and matching `-bg` tints                                                                                                                  |
| Temperature | `--temp-calm`, `--temp-concerned`, `--temp-frustrated`, `--temp-angry`, `--temp-escalating` (always paired with a text label)                                                               |
| Mastery     | `--star-0` (dormant ring) to `--star-4` (beacon)                                                                                                                                            |
| Type        | `--font-sans`, `--font-heading`, `--font-display` (a system serif), `--font-mono`; scale `--fs-display`, `--fs-title`, `--fs-section`, `--fs-body`, `--fs-small`, `--fs-meta`, `--fs-label` |
| Space       | `--sp-1` (4px) to `--sp-9` (96px); use the scale, avoid arbitrary values                                                                                                                    |
| Radius      | `--r-control` (10px), `--r-card` (16px), `--r-modal` (24px), `--r-panel` (26px), `--r-pill`                                                                                                 |
| Shadow      | `--shadow-1` (resting), `--shadow-2` (raised/modal), `--shadow-lift` (primary action glow)                                                                                                  |
| Motion      | durations `--dur-1` 120ms to `--dur-6` 1000ms; easing `--ease-out`, `--ease-settle`, `--ease-in-out`, `--ease-spring` (a damped spring); `--stagger` 70ms                                   |
| Blur        | `--blur-1` 14px, `--blur-2` 26px                                                                                                                                                            |
| Layers (z)  | `--z-nav` 40, `--z-sheet` 60, `--z-dialog` 70, `--z-toast` 80, `--z-launch` 90                                                                                                              |
| Focus       | `--focus` (2px outline with 3px offset, applied globally with `:focus-visible`)                                                                                                             |

Use `--glow-text` for any text in the warm colour. In the light theme `--glow` is about 3.9:1 on the
page, which is enough for a shape but not for text.

## Materials

- **Glass** (`.glass`, `.glass-strong`): cards and panels that should feel layered over the ambient
  background. Only `.glass-strong` (navigation, dialogs, the call header) blurs what is behind it;
  plain `.glass` is a translucent surface with no blur. Every glass surface has a solid fallback
  (`--glass-fallback`) when `backdrop-filter` is unavailable or `prefers-reduced-transparency` is set,
  and contrast is checked against both themes.
- **Solid surface** (`.surface`): dense content such as tables, long text and the report's evidence,
  where glass would hurt readability. Do not nest glass inside glass.
- Never blur large areas.

## Components and classes

- Buttons: `.btn` + `.btn-primary | .btn-secondary | .btn-ghost | .btn-danger | .btn-danger-solid`,
  sizes `.btn-sm`, `.btn-lg`, `.btn-icon`. Minimum target size is 44px (36px for `.btn-sm` inside dense
  rows). One primary button per view; the primary button is the warm one.
- Chips: `.chip` with `.chip-accent | -positive | -caution | -negative | -info`. `DifficultyChip` and
  `ScenarioChips` render scenario settings in plain language.
- Cards: `.glass.card` (default), `.card-tight`, `.panel`; add `.card-interactive` for hover lift.
- Forms: `.field`, `.label`, `.hint`, `.field-error`, `.input`, `.textarea`, `.select`. Selectable cards
  use `.option` (radio or checkbox inside, visually hidden but focusable); toggles use `.segmented`;
  on/off settings use `Switch` (a native checkbox with `role="switch"`).
- Feedback: `.callout` (+ `-caution`, `-negative`, `-positive`), `EmptyState`, `ErrorState`,
  `LoadingCards`, `SkeletonBlock`, the toast provider (`useToast`), and `OfflineBanner`.
- Overlays: `Dialog` (focus trap, Escape, inert background, focus restore); `variant="sheet"` slides up
  on mobile. `LaunchSequence` is a full-screen overlay used only when a call starts.
- Data display: `ScoreMeter` (1-5), `TemperatureOrb`, `TrendSparkline`, `.table` inside `.table-wrap`.
- Firefly visuals:
  - `FireflyCore` (`components/core`): the animated presence. Props set its mood, tone and signals;
    it owns its own pause, resize and fallback behaviour.
  - `MasteryStars` and `TierGlyph` (`components/mastery`): the six skill constellations and a single
    tier mark. Always accompany them with text (`describeStars` builds the description).
  - `MissionMap` (`components/mission`): the scenario map; `map-layout.ts` holds the pure layout and
    keyboard-navigation rules.
  - `NextMission`, `MasteryHero`, `PracticePath`, `MilestonesSection`: the recommended mission and the
    Progress page's journey views.
- Layout helpers: `.stack`, `.row`, `.cluster`, `.grow`, `.between`, `.grid-cards`, `.grid-2`,
  `.grid-3`, `.page`, `.page-narrow`, `.page-wide`.

Page structure: `<Page title="...">` sets the document title and applies the page transition;
`<PageHeader eyebrow title lead actions />` renders the heading. There is exactly one `h1` per page.

CSS for a component that is used on several pages is imported by the component itself (for example
`NextMission.tsx` imports `next-mission.css`), so it never depends on which page loaded first. Page
CSS lives in `styles/<page>.css`; styles that must beat shared rules are scoped under a page root class
(for example `.rp-root` on reports).

## Motion

Motion explains what changed. It never blocks input and never carries essential information.

- Feedback 120-200ms, state changes 320-450ms, reveals 640ms, and 1000ms only for the launch and the
  constellation reveal.
- Animate `transform` and `opacity` of shapes. Do not animate layout properties or large blurred
  regions, and never fade text in: entrances on anything that holds text are transform-only.
- Route changes use the View Transitions API where available (`viewTransition` on links), a short
  crossfade.
- Reduced motion: honoured from the system setting and from Settings (`data-motion="reduce"`). All
  animation and transitions are effectively disabled; state changes remain visible. The Core draws one
  still frame and the launch sequence is skipped.
- The Firefly Core is a Canvas 2D drawing (no WebGL). It pauses when off screen or hidden, lowers its
  own quality on slow hardware and falls back to a CSS glow when a canvas cannot be created.
- Sound is optional and off by default (`web/src/lib/sound.ts`); nothing depends on it.

## Accessibility checklist

Every page must:

1. Use semantic landmarks and one `h1`; headings go in order.
2. Label every control (visible `label` or `aria-label`); associate errors with `aria-describedby` and
   `aria-invalid`.
3. Be fully usable by keyboard with a visible focus indicator; no hover-only functionality.
4. Keep targets at least 44x44 CSS pixels (except dense secondary controls, which keep 36px).
5. Not rely on colour alone (pair colour with text, shape or position). Temperature, tier and score
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

Clear, specific, supportive and calm. Avoid marketing language ("revolutionary", "AI-powered
excellence"), game jargon and empty praise. Good: "Ask focused questions to understand impact and
recent changes." Bad: "Unlock next-generation conversational mastery." Never present scores as
employee performance ratings, and never imply ranking or comparison.

## Working on a screen

1. Read the closest existing page for patterns (`web/src/pages/Dashboard.tsx` and
   `web/src/styles/dashboard.css`).
2. Fetch data with `useApi` from `web/src/lib/hooks.ts` and the typed client in
   `web/src/lib/api.ts`. Handle loading, empty, error and long-content states.
3. Put page-specific CSS in `web/src/styles/<page>.css` and import it from the page.
4. Check both themes and 390px and 1440px wide. `scripts/shot.mjs` captures any single state, and
   `scripts/readme-screenshots.mjs` regenerates the documentation images; see
   [experience-design.md](experience-design.md#visual-review).
5. Run `npm run lint`, `npm run typecheck`, `npm run format:check` and `npm test` before committing,
   and `npm run test:e2e` for anything visible (it checks accessibility in both themes and that nothing
   scrolls sideways).
