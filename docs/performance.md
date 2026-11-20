# Performance

Firefly's interface is spatial and animated, so speed is a design constraint, not an afterthought. This
page says what is budgeted and enforced, how the animated field adapts to the device, how the interface
was measured, what the numbers were, and what has **not** been measured.

> The measurements come from **one laptop and one browser**. They compare the redesigned interface with
> the one it replaced, on the same machine, in the same sitting. They are not a promise about any other
> device, and nobody has measured a phone.

## Budgets

`npm run check:budgets` runs after `npm run build` (it is part of `npm run check` and of CI) and fails if
the production build in `dist/web` grows past `scripts/budgets.json`. Sizes are gzip, because that is
what the network carries. It also fails if a source map reaches the build. Raising a limit is a decision:
it shows up in review and needs a reason in the commit message.

| Budget                                             | Limit  | Now      | Before the redesign |
| -------------------------------------------------- | ------ | -------- | ------------------- |
| First-load JavaScript (entry and preloaded chunks) | 125 kB | 119.4 kB | 93.1 kB             |
| First-load CSS                                     | 22 kB  | 12.9 kB  | 8.4 kB              |
| Largest page chunk                                 | 70 kB  | 22.8 kB  | 20.7 kB             |
| Largest CSS file                                   | 26 kB  | 8.5 kB   | not recorded        |
| Fonts on the critical path (preloaded)             | 110 kB | 69.3 kB  | none: no web fonts  |
| All fonts                                          | 150 kB | 119.1 kB | none                |

The redesign costs about 26 kB of first-load JavaScript (the data router, the shell, the instrument and
the view transitions), 4.5 kB of CSS and, the biggest single addition, 69 kB of fonts: two faces are
preloaded (Newsreader, for headings, and Hanken Grotesk, for text). The monospaced pair and the italic
load only when a page uses them. Text uses `font-display: swap` over fallback faces sized to match
Georgia, Arial and Courier New, so it does not jump when a font arrives.

## What keeps a page light

- **One chunk per page.** Every route is its own lazily loaded chunk. The router fetches a page's code
  before it commits the navigation, so the page for the opening address is ready before the first render
  and there is no empty frame to flash.
- **The field is separate.** The animated field is its own small chunk (about 7.4 kB gzip), requested
  when the browser is idle; until then the page shows the still gradient the field is drawn over. The
  field draws one still frame, never a loop, in reduced motion, in a hidden tab and while ambient motion
  is paused, and on the lowest tier it is only the gradient. The first-run tour is a chunk of its own.
- **No raster images.** The instrument is SVG and the field is a canvas. There is no UI, animation, chart
  or icon library, and the only web fonts are the five font files described above.
- **A pointer move costs no render.** The mission atlas follows the pointer from one handler that runs
  once per frame: it reads the plate's rectangle when the pointer arrives and again only after a scroll or
  a resize, and it moves the light and the two rulers with `transform` on three small elements.
- **Reserved space.** Loading states take the room their content will take, so little moves when data
  arrives (see layout shift below).

## Effects tiers

Decoration is a budget, not a given. A **tier** (`high`, `medium` or `low`) decides how much is drawn.

| Tier     | The field                                                                     | Glass blur and decorative loops | Pointer effects                                        |
| -------- | ----------------------------------------------------------------------------- | ------------------------------- | ------------------------------------------------------ |
| `high`   | 90 strands of 28 points, up to 5 lights, a canvas up to 1.5 pixels per pixel  | On                              | The atlas light, and the field's lens (a fine pointer) |
| `medium` | 60 strands of 22 points, up to 3 lights, a canvas up to 1.25 pixels per pixel | On                              | The atlas light, but no lens in the field              |
| `low`    | None: the still gradient only                                                 | Off                             | None                                                   |

**Where a tier comes from.** The first guess uses what the browser reports: data saver asks for `low`,
two cores or 2 GB or less is `low`, four cores or 4 GB or less or a touch screen as the main pointer is
`medium`, and anything else is `high`. Anything the browser does not report counts as no evidence, not as
a weak device. Then a **frame monitor** watches the gaps between animation frames in windows of 1.5 s:
a median above 22 ms steps down one tier, above 40 ms goes straight to `low`. It never steps back up
(so it cannot flap), ignores windows in which the page was hidden or suspended, and stops itself after
five steady windows. The field also watches its own cost and steps down when its drawing averages above
6 ms a frame. Tiers change how much decoration is drawn, never what the app does.

`?perf=high`, `?perf=medium` or `?perf=low` in the address pins a tier and turns the monitor off, so each
can be tried on any machine. `?worldstats=1` makes the field report its own cost per frame in
`window.__fireflyWorld`.

## How it was measured

[`scripts/perf-probe.mjs`](../scripts/perf-probe.mjs) opens a page in a fresh browser (Microsoft Edge,
driven by Playwright and the DevTools protocol) and records first and largest contentful paint, layout
shift, long tasks (50 ms or more) and, from `requestAnimationFrame`, the time between frames for three
seconds untouched and for three and a half seconds while the pointer sweeps across the page. A frame at
60 Hz takes 16.7 ms. Each figure below is the **median of three runs**.

| What          | Detail                                                                                                                                                                                                                                                                                                                             |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Machine       | 11th Gen Intel Core i7-1185G7 (4 cores, 8 threads), 31 GB of memory, Intel Iris Xe Graphics (through Direct3D 11), Windows. Other applications were running.                                                                                                                                                                       |
| Browser       | Microsoft Edge 158, a 1440 x 900 window, dark theme, device pixel ratio 1                                                                                                                                                                                                                                                          |
| Builds        | The redesign and the interface it replaced (`main` at `1a1c946`), each as a production build served by Firefly's own server on the loopback in demo mode                                                                                                                                                                           |
| Data          | In-memory databases. Each run is a new anonymous learner, so most pages show a first-time learner with no calls. The call page run starts one call with two messages. "With history" runs use one profile with eight practice calls (seven finished, one open) that was created in each server beforehand with a throwaway script. |
| CPU slow-down | "4x" uses the DevTools CPU throttle, a rough stand-in for a slower processor. It is not a real device.                                                                                                                                                                                                                             |
| Network       | The loopback, with no throttling, so transfer times mean nothing. Bytes transferred are reported instead.                                                                                                                                                                                                                          |

### With the graphics card

At full CPU speed, with each page's effects tier left to choose itself (it stayed on `high` in every run).
In every cell the redesign comes first and the previous interface second. "First run" is a learner with
no calls; "with history" is the profile with eight.

| Page                   | First paint   | Largest paint  | Layout shift  | Long tasks | Frames over 20 ms, pointer moving |
| ---------------------- | ------------- | -------------- | ------------- | ---------- | --------------------------------- |
| Home, first run        | 720 / 860 ms  | 770 / 1770 ms  | 0.037 / 0.000 | 0 / 0      | 0% / 0%                           |
| Home, with history     | 1040 / 780 ms | 1140 / 1010 ms | 0.059 / 0.005 | 2 / 0      | 0% / 0%                           |
| Missions               | 880 / 720 ms  | 1020 / 960 ms  | 0.007 / 0.000 | 2 / 0      | 0% / 0%                           |
| Call                   | 420 / 1800 ms | 650 / 1800 ms  | 0.000 / 0.000 | 1 / 1      | 0% / 0%                           |
| Progress, first run    | 730 / 520 ms  | 840 / 800 ms   | 0.027 / 0.000 | 2 / 0      | 0% / 0%                           |
| Progress, with history | 880 / 790 ms  | 880 / 1120 ms  | 0.018 / 0.000 | 3 / 0      | 1% / 0%                           |
| Report, with history   | 800 / 560 ms  | 970 / 1910 ms  | 0.000 / 0.000 | 2 / 1      | 0% / 0%                           |

With the CPU four times slower:

| Page                   | First paint    | Largest paint  | Layout shift  | Long tasks (time)      | Frames over 20 ms, pointer moving |
| ---------------------- | -------------- | -------------- | ------------- | ---------------------- | --------------------------------- |
| Home, first run        | 1680 / 2300 ms | 1850 / 2750 ms | 0.037 / 0.005 | 7 (1.1 s) / 7 (1.0 s)  | 0% / 2%                           |
| Home, with history     | 1980 / 2280 ms | 2220 / 2780 ms | 0.059 / 0.005 | 8 (1.2 s) / 8 (1.1 s)  | 0% / 1%                           |
| Missions               | 1660 / 2180 ms | 2140 / 2720 ms | 0.007 / 0.000 | 7 (1.3 s) / 4 (0.8 s)  | 5% / 0%                           |
| Call                   | 1230 / 1310 ms | 1810 / 3250 ms | 0.000 / 0.000 | 8 (1.1 s) / 51 (5.7 s) | 0% / 89%                          |
| Progress, first run    | 1760 / 2100 ms | 2140 / 2340 ms | 0.027 / 0.000 | 9 (1.3 s) / 5 (0.9 s)  | 0% / 0%                           |
| Progress, with history | 1770 / 1940 ms | 1770 / 2620 ms | 0.023 / 0.010 | 8 (1.6 s) / 6 (0.8 s)  | 1% / 0%                           |
| Report, with history   | 1870 / 1900 ms | 2650 / 4900 ms | 0.000 / 0.000 | 10 (2.1 s) / 8 (2.7 s) | 0% / 2%                           |

The cost, from the same runs (four times slower CPU, redesign / previous): script time 1.8 to 2.6 s
against 0.8 to 1.2 s (for example 2.3 / 1.1 s on the first-run Home, 2.6 / 1.0 s on Missions and
2.2 / 1.2 s on Call), and bytes transferred 688 to 809 kB against 378 to 578 kB.

**What this says.** On this machine, with its graphics card, the redesign kept almost every frame under
20 ms on every page it measured, at the highest tier, even with the CPU four times slower. The
exceptions were the mission atlas (4 to 6% of frames over 20 ms while the pointer moved under the
slow-down) and the first seconds of a page loading under the slow-down (up to 5% of frames on the Report
page, where one of the three runs stepped down to `medium`). At full speed its largest paint is earlier
than the previous interface's, or within about 0.13 s of it, on every page; its first paint is earlier on
the first-run Home and on the call and 0.1 to 0.3 s later on the others. With the CPU four times slower,
first and largest paint are earlier on every page. It does more work to get there: roughly twice the
script time, more time in long tasks on Missions and Progress, and about 1.4 to 1.9 times the bytes. The
previous Call page fared worst, with 51 long tasks and 89% of frames over 20 ms under the slow-down, and
its Report page painted its largest element at 4.9 s against 2.6 s.

Layout shift is small (0 to 0.059, where 0.1 is the usual threshold for "good") but it is not zero, and
the previous interface was steadier: it comes from placeholders being replaced by content. Home with
history is the largest: when the last call, the totals and the open call arrive, the hero grows and pushes
the lower part of the page down.

The spread between runs is real. The previous Call page's first paint ranged from 0.7 to 1.8 s at full
speed, so treat differences of a few hundred milliseconds as noise.

### The field's own cost

With `?worldstats=1` the field reports what its own script and drawing calls cost per frame (a single
run per page, with the pointer moving; it does not include the time the graphics card or the compositor
spends putting those pixels on screen). At full speed that was 0.5 to 0.6 ms a frame on average at
`high` (95th percentile 0.7 to 0.8 ms) and 0.4 ms at `medium`. With the CPU four times slower it was 3.3 to
4.1 ms at `high` (95th percentile 6.2 to 9.0 ms) and 2.4 to 2.9 ms at `medium`. The field steps down by
itself when its own work averages above 6 ms, which none of these runs reached.

### With no graphics card

To see what a machine with no hardware acceleration does, the same pages were opened with the software
renderer (`--software`, which draws with SwiftShader on the CPU). In every one of the redesign's 12 runs
the frame monitor had stepped the tier down to `low` by the end, about eight seconds after the page
opened, and the first seconds were rough: in the three seconds after load the call page drew only 12
frames. Pinned to `high` instead (`?perf=high`), Home ran at about 8 frames a second: a mean of 126 ms a
frame, with every frame over 20 ms. That is the reason for the monitor.

| Page     | First paint    | Tier at the end | Frame time, pointer moving (mean) | Frames over 20 ms |
| -------- | -------------- | --------------- | --------------------------------- | ----------------- |
| Home     | 2750 / 2410 ms | `low`           | 16.6 / 41.1 ms                    | 0% / 100%         |
| Missions | 3160 / 2070 ms | `low`           | 43.5 / 46.4 ms                    | 39% / 53%         |
| Call     | 3240 / 4730 ms | `low`           | 18.6 / 736 ms                     | 3% / 100%         |

(Redesign first, previous interface second, median of three runs.) Once it had stepped down, Home and the
call were close to smooth. Missions was not: the atlas is the heaviest page, and even at the lowest tier
it averaged 44 ms a frame with the pointer moving, though the previous Missions page was no better. The
previous call page was close to unusable without a graphics card: 7 frames in 3.5 s while the pointer
moved, against 176 for the redesign. Software rendering is slow to a first paint for both interfaces.

## What has not been measured

- **Any other device.** No phone, tablet, low-end laptop or machine without a hardware-accelerated canvas
  (apart from the software-rendering run above) was measured, and neither were other graphics cards, a
  high-density display (everything here is at a device pixel ratio of 1) or a second monitor.
- **Other browsers.** Firefox and Safari were not measured.
- **A real network.** The server was on the loopback.
- **Long sessions.** Memory use over a long call, battery and heat were not measured.
- **Real users.** There is no field data: Firefly has no telemetry and no analytics.

## Running it yourself

Build, then start Firefly in demo mode with a database that disappears when it stops:

```bash
npm run build
FIREFLY_DB_PATH=:memory: FIREFLY_PROVIDER=mock FIREFLY_PORT=4470 npm start
```

In another terminal (in PowerShell, set `$env:PW_CHANNEL = 'msedge'` first if Edge is the browser you
have; `PW_CHANNEL=chrome` or `PW_CHANNEL=none` choose Chrome or Playwright's own Chromium):

```bash
node scripts/perf-probe.mjs http://127.0.0.1:4470/home --runs=3
node scripts/perf-probe.mjs "http://127.0.0.1:4470/calls/{call}" --runs=3 --throttle=4
node scripts/perf-probe.mjs http://127.0.0.1:4470/home --runs=3 --software
```

`{call}` starts a practice call through the API and puts its id in the address. `--software` draws with
the software renderer, as a machine with no graphics card would. To compare two builds, build the other
revision into its own folder (`FIREFLY_OUT_DIR=../dist/other npx vite build` from `web/` writes
`dist/other`) and serve it on another port with `FIREFLY_WEB_DIR=dist/other`. Run both in the same sitting
and compare medians: numbers from different days or machines are not comparable.
