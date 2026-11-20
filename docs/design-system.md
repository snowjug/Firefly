# Firefly design system

Firefly's interface is built from a small set of tokens, materials, primitives and one recurring
object. This page is the reference for anyone adding or changing a screen. The source of truth is the
CSS in `web/src/styles/` (tokens in `tokens.css`) and the components in `web/src/components/`. For the
reasoning behind the experience, see [experience-design.md](experience-design.md).

## Principles

- **Signals, not decoration.** Every effect has to explain state. If it does not, delete it.
- **Type and space before boxes.** Ask "does this information need a container?" before adding one.
  Prefer whitespace, typography, hairlines, tick scales, light and scale.
- **Reading surfaces are opaque; glass floats.** Glass is for the dock, the palette, an inspector, a
  dialog and a discovery signal. Never glass inside glass, and never glass under long text.
- **Meaning is never carried by colour alone.** Mood, status and score always have a word and a shape.
- **Honest.** Demo mode is always labelled. No fake progress, fake metrics or disguised mock output.
  Rewards are points with a stated reason; there is no ranking.
- **Two real themes.** The dark "night field" and the light "luminous parchment" are both designed.
  Never hard-code a colour that exists as a token.

## Tokens

All values are CSS custom properties in `web/src/styles/tokens.css`: once for dark (the default), once
for light (`[data-theme='light']`) and once for the system preference when nobody has chosen a theme
(`prefers-color-scheme: light` on `:root:not([data-theme])`). The light blocks must stay in step.
Components use tokens, never raw colours, so one state can change a whole environment.

| Group           | Tokens (examples)                                                                                                                                                                                                                                                                                                                                                                     |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The field       | `--field-0` to `--field-4` (the environment), `--solid-1` to `--solid-3` (opaque reading surfaces)                                                                                                                                                                                                                                                                                    |
| Ink and lines   | `--ink-1`, `--ink-2`, `--ink-3`, `--ink-inverse`; `--line-1`, `--line-2`, `--line-3` (hairlines; `--line-3` for strokes that carry meaning)                                                                                                                                                                                                                                           |
| The lights      | `--amber`, `--amber-hi`, `--amber-text`, `--amber-ink`; the same set for `--aqua`, `--sage`, `--coral`; `--ember`. **Fill** variants are for shapes and glows, **`-text`** variants are the ones safe to read                                                                                                                                                                         |
| Mood            | `--mood-calm`, `--mood-concerned`, `--mood-frustrated`, `--mood-angry`, `--mood-escalating`, `--mood-recovering` (always paired with a word and a shape)                                                                                                                                                                                                                              |
| Meaning         | `--discovered`, `--missed`, `--verified`, `--pending`, `--strength`, `--improvement`, `--focus`, `--scrim`                                                                                                                                                                                                                                                                            |
| Glass roles     | `--glass-nav-bg`, `--glass-control-bg`, `--glass-report-bg`, `--glass-inspector-bg`, `--glass-modal-bg`, `--glass-signal-bg`, each with a `-solid` fallback; edge lights `--glass-edge-a/b/c`; `--blur-nav`, `--blur-control`, `--blur-modal`                                                                                                                                         |
| Atmosphere      | `--atm-tension`, `--atm-open`, `--atm-warmth`, `--atm-energy` (registered with `@property` so they interpolate), set per `[data-mood]`; `--world-base`, `--world-light-a/b`                                                                                                                                                                                                           |
| Type            | `--font-display`, `--font-read`, `--font-ui`, `--font-mono`; scale `--t-hero`, `--t-display`, `--t-title`, `--t-heading`, `--t-lead`, `--t-read`, `--t-body`, `--t-small`, `--t-micro` (never below 12 px)                                                                                                                                                                            |
| Space and shape | `--sp-1` (4 px) to `--sp-9` (112 px), `--gutter`, `--page-max` (1360 px), `--read-max`, `--tap` (44 px); radius `--r-1` to `--r-4` and `--r-pill`                                                                                                                                                                                                                                     |
| Layers (z)      | `--z-world` 0, `--z-atlas` 10, `--z-app` 20, `--z-surface` 30, `--z-dock` 60, `--z-overlay` 80, `--z-transient` 100, `--z-cursor` 200, `--z-skip` 300                                                                                                                                                                                                                                 |
| Motion          | durations `--dur-response` 100 ms, `--dur-micro` 160, `--dur-component` 260, `--dur-route` 440, `--dur-cinematic` 800, `--dur-ambient` 24 s; easings `--ease-enter-emphasised`, `--ease-exit-decelerated`, `--ease-signal-pulse`, `--ease-tension-shift`, `--ease-evidence-link` and the `linear()` springs `--ease-spatial-spring`, `--ease-discovery-settle`, `--ease-press-spring` |
| Shell layout    | `--masthead-h` (clearance above a page), `--dock-clear` (clearance below it: the dock, the safe area and a gap)                                                                                                                                                                                                                                                                       |

Use the `-text` variant of a light (`--amber-text`, `--coral-text`, and so on) for any text in a
colour. Text that carries meaning is checked against both themes: unit tests compute contrast from the
token files, and `e2e/pages.spec.ts` runs axe (WCAG 2.2 AA) on every page in light and dark.

### Typography

Three families, self-hosted and subset (`web/public/fonts/`, SIL Open Font License; see
[attribution.md](attribution.md)), with metric-matched fallbacks so the swap does not shift layout:

- **Newsreader** (display, reading text, the customer's words, the learner's reply): variable weight
  300 to 600, with an italic.
- **Hanken Grotesk** (interface text): variable weight 400 to 700.
- **IBM Plex Mono** (telemetry and labels): 400 and 500. Uppercase with 0.1 em tracking, never below
  12 px and never used for sentences.

Roles are classes in `styles/type.css` (`type-hero`, `type-display`, `type-title`, `type-heading`,
`type-lead`, `type-read`, `type-ui`, `type-small`, `type-label`, `type-number`). Components pick a role;
they do not invent sizes. Scale contrast (very large serif beside small mono telemetry) is the voice of
the product.

## Materials

`styles/materials.css`:

- **`.glass`** floats above the environment: a wash, a blur and an edge lit by the three lights (aqua,
  neutral, amber), drawn as a 1 px masked gradient so the surface stays translucent. Roles:
  `.glass--nav`, `--control`, `--report`, `--inspector`, `--modal`, `--signal`. Every role falls back to
  a solid surface without `backdrop-filter`, on the low performance tier, under
  `prefers-reduced-transparency`, and in forced colours.
- **`.plate`** is an opaque reading surface with a hairline.
- **`.rule`** and **`.rule--point`** separate things without boxes: a hairline, optionally ending in an
  amber point.

## Primitives (`web/src/components/frame/`)

Everything a page is made of. No cards, no pills, no gradients: hairlines, type and one ink-coloured
primary action.

| Primitive                                                       | Use                                                                                                                                                                                 |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PageFrame`, `PageHead`, `Section`                              | Sets the document title; consistent clearance under the masthead and above the dock; a mono eyebrow, a display title (the one `h1`) and a lead; sections with a hairline rule above |
| `EmptyNotice`, `ErrorNotice`, `LoadingNotice`, `NotFoundNotice` | One sentence and at most one action; errors that retry only when retrying can help; loading drawn as hairlines with end ticks                                                       |
| `ChoiceRow`                                                     | A typographic option row: a real fieldset and radios, serif words on a hairline, the chosen one in ink with an amber pip                                                            |
| `TabRow`                                                        | A real tablist with roving focus, arrow keys, Home and End                                                                                                                          |
| `Toggle`                                                        | A `role="switch"` button: hairline track, amber dot, and the state in words                                                                                                         |
| `Field`, `TextInput`, `TextArea`, `SelectInput`                 | Underlined fields with a mono label, linked errors and hints, and 44 px targets                                                                                                     |
| `Disclosure`, `Tag`, `Stat`, `StatRow`, `Ledger`                | A details/summary with a tick marker; a mono label with a leading point (text and shape, never a pill); figures and definition-list rows                                            |

Buttons are the `.action` classes: `.action` (solid ink with an arrow that travels on hover and a
1 px spring press), `.action--quiet`, `.action--danger`, `.action--compact`, `.action--icon` and
`.action-row`. Text links use `.text-link`. Icon-only buttons need an `aria-label`.

`Dialog` keeps its API and behaviour (focus trap, Escape, restore) with a glass modal, sheet or
inspector-drawer look. `lib/toast.tsx` is a quiet strip above the dock that renders outside the app root
so a toast raised from a dialog is still announced. A development gallery of every primitive is at
`web/gallery-ui.html` when the Vite dev server is running (it is not part of the build).

## The Signal instrument (`web/src/components/signal/`)

| Component                       | Use                                                                                                          |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `SignalGlyph`                   | A static mark per mission or call. Takes any object with the glyph traits (an `AtlasMission` works as it is) |
| `SignalCore`, `CoreLegend`      | The engraved calibration instrument and its lettered legend, driven by `coreParams`                          |
| `SignalPresence`                | The customer: takes an atmosphere, a discovered count, shifts, typing, and a `frozen` mode                   |
| `KeyToPlate`                    | The legend of the grammar, with mini marks per value                                                         |
| `describeGlyph`, `describeCore` | The same facts in plain English, from the same inputs                                                        |

Rules: the instruments show **public settings only**; the presence never receives a hidden-fact total
(it has a fixed pool of dots); idle animation lives on wrapper elements rather than the SVG root (an
animation on an `<svg>` root is not composited), and accent colours are set only on the elements that draw
them (setting them on the root restyles every descendant each frame). A development gallery is at
`web/gallery.html`.

## The field (`web/src/components/world/`)

`WorldLayer` is mounted once by the app shell and the public shell. First paint is the still mineral
gradient from the tokens; the animated Canvas2D field is a separate lazy chunk requested when the browser
is idle. Pages set a pose with `useWorldPose({ tension, open, warmth, energy, intensity })`; each route has
a resting intensity (`routePose`), nearly still on reading pages; `pulseWorld('discovery' | 'curveball')`
adds one short event. The canvas is capped in opacity (`--world-cap`) so body text keeps WCAG AA contrast in
the worst case (a test reads the real token files and the real gradient to enforce it), and `.world-veil`
puts a field-coloured scrim behind long text. It draws one still frame and stops when motion is reduced,
ambient motion is paused, the tab is hidden, or the tier is low. A development lab is at `web/world.html`.

## The app shell (`web/src/components/shell/`)

- **`AppShell`** is the signed-in frame: skip link, the field, `main`, the offline notice, the colophon,
  the dock and the utility cluster. **`PublicShell`** frames the front door and sign-in (the field, the
  wordmark and the theme and ambient controls, no dock).
- **`CommandDock`** is a `nav` list of six real links with `aria-current`, and an amber pip moved by one
  custom property. **`UtilityCluster`** holds search, theme, **Pause ambient motion** (`aria-pressed`),
  notices, the account and help. **`Palette`** is the Ctrl or Cmd + K dialog (a combobox and listbox).
  `nav.ts` holds the destinations and which addresses light each one (Missions stays lit through
  calibration, the call and the report; the transcript belongs to History; `/rewards` to Progress;
  `/calibration` to Studio).
- **`useShellMode()`** returns `'call' | 'app' | 'public'`. In call mode the dock, cluster, colophon and
  offline notice are removed from the screen and from the tab order.
- Contract for pages: the masthead and the dock float over the page, so a page keeps clear of them with
  `--masthead-h` above and `--dock-clear` below (`PageFrame` does this), and focus is never hidden under
  the dock (`scroll-padding-bottom`).
- The local profile (`web/src/lib/profile.ts`) holds a name, optional role and location and a few
  preferences in `localStorage`. There is no account system.

## Motion helpers (`web/src/lib/motion/`)

- **`ambient`**: the persisted "pause ambient motion" preference (WCAG 2.2.2). Reduced motion forces it
  on without changing what was chosen. Anything decorative that moves on its own is marked `data-ambient`
  (and `html[data-ambient="paused"]` pauses it) or reads `useAmbientPaused()`.
- **`transitions`**: the first pointer press or key press skips a running view transition, and the names
  an object keeps across routes (`signal-mission`, `firefly-dock`). **Do not name the field.**
- **`pointer`**: `useFinePointer()` and a per-frame pointer handler. Handlers write transforms and custom
  properties only and never read layout.
- **Performance tiers** (`lib/PerfTierProvider.tsx`, `lib/perf-tier.ts`): `usePerfTier()` and
  `useEffectBudget()` return `high`, `medium` or `low`. The tier starts from device hints and a frame
  monitor only ever steps it down. `data-perf` is set on `<html>` so CSS can switch blur off.

## Pure models

Layout and behaviour that can be tested without a browser are pure modules with their own tests:
`components/atlas/` (the atlas model, deterministic layout, label placement, the lens, the core
parameters, the constellation layout), `components/call/` (atmosphere, the conversation path, the cue
events), `components/report/` (the word diff, the journey model), `lib/spatial/traversal.ts` (arrow-key
traversal over a plane), `lib/seeded-noise.ts` and `lib/perf-tier.ts`. Keep logic there and keep the
components thin.

## Accessibility checklist

Every page must:

1. Use semantic landmarks and one `h1`; headings go in order.
2. Label every control (visible `label` or `aria-label`); associate errors with `aria-describedby` and
   `aria-invalid`.
3. Be fully usable by keyboard with a visible focus indicator; no hover-only functionality.
4. Keep targets at least 44 x 44 CSS pixels (24 at the very least).
5. Not rely on colour alone. Temperature, status and score are always text as well.
6. Announce asynchronous results politely (`role="status"`, initially empty); never announce text
   character by character or every frame; move focus predictably.
7. Render all user and model text as plain text nodes (never HTML).
8. Reflow without horizontal scrolling from 320 px; respect browser zoom and text spacing.
9. Give every spatial view a semantic alternative (a list, a table or a full description).
10. Work in both themes, with reduced motion, with `prefers-contrast: more`, in forced colours and with
    `prefers-reduced-transparency`.
11. Use the `-text` variant of a light for text in a colour.

More in [accessibility.md](accessibility.md).

## Writing style

Clear, specific, supportive and calm. Plain words, short sentences, British spelling, sentence case for
headings and buttons. Precise rather than enthusiastic: "Signal found: the issue began after a
configuration change." and "You acknowledged the production impact before troubleshooting." No marketing
language ("revolutionary", "AI-powered excellence"), no game jargon ("XP", "level up", "top
performer"), no exclamation marks, no "Oops", no empty praise, and no invented personalisation: a new
learner sees an honest empty state. Never present scores as employee performance ratings, and never imply
ranking or comparison.

## Working on a screen

1. Read the closest existing page for patterns (`web/src/pages/Dashboard.tsx` and its stylesheet), and
   build with the primitives in `components/frame`.
2. Fetch data with `useApi` from `web/src/lib/hooks.ts` and the typed client in `web/src/lib/api.ts`.
   Handle loading, empty, error and long-content states, and test with imperfect content (very long
   titles, one-word and very long replies, 60 or more messages, zero and maximum discoveries, no and many
   rewards, an empty and a large history).
3. Put page-specific CSS in `web/src/styles/<page>.css` and import it from the page. Class names carry a
   short page prefix (for example `rp-`, `cal-`) so rules never collide.
4. Use tokens only. If you need something the tokens do not have, add a token.
5. Give every spatial view a semantic alternative, and keep ambient motion behind `data-ambient`.
6. Look at real screenshots in both themes at 320 or 390, 768, 1440 and 1920 px, with reduced motion and
   with `?perf=low`. `scripts/readme-screenshots.mjs` regenerates the documentation images; see
   [experience-design.md](experience-design.md#visual-review).
7. Run `npm run lint`, `npm run typecheck`, `npm run format:check` and `npm test` before committing,
   `npm run check:budgets` after a build, and `npm run test:e2e` for anything visible (it checks
   accessibility in both themes and that nothing scrolls sideways).
