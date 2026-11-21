# Performance

What Firefly measures about its own speed and its use of the microphone and audio, the limits it
enforces, what was found and changed, and how to repeat every number. Every number here was taken on
one machine in one sitting (see below). They show how two builds compare when measured back to back;
they say nothing about other hardware, and nothing here is a claim about a machine that was not tested.

## The machine and the sitting

|           |                                                                          |
| --------- | ------------------------------------------------------------------------ |
| Date      | 21 November 2026                                                         |
| Processor | 11th Gen Intel Core i7-1185G7 at 3.00 GHz, 4 cores, 8 logical processors |
| Memory    | 31.3 GB                                                                  |
| System    | Windows 11 Enterprise, version 10.0.26300                                |
| Browser   | Microsoft Edge 158.0.4370.33 (Chromium 158.0.8127.18)                    |
| Tools     | Node 26.13.1, Playwright 1.65, Vite 8                                    |

Other programs (other people's browsers and test runs) were using the same machine during the
sitting, so single timings carry noise. Where a number comes from several runs it is the median with
the lowest and highest in brackets. "CPU x4" means Chrome's CPU throttling at four times slower
(`Emulation.setCPUThrottlingRate`): a rough stand-in for a modest office laptop, not a measurement of
one. The network is the loopback, so transfer times are not representative.

## What is measured, and why

| Measure                                                                                        | Why                                                                       |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| First-load JavaScript and CSS, gzip                                                            | The code that must arrive before any page can draw.                       |
| First and largest contentful paint, layout shift, long tasks (50 ms or more)                   | How the first view feels, and whether the main thread is blocked.         |
| DOM nodes and JavaScript heap                                                                  | Cost that grows with a long call, and leaks.                              |
| Script time while a long transcript sits idle, scrolls, or gets a new turn                     | A call can run for many minutes; the page must not slow down as it grows. |
| Time from a click to the next paint (Event Timing)                                             | Whether a control feels instant.                                          |
| Microphone tracks, audio contexts, audio nodes, object URLs, audio elements, timers, listeners | A spoken call opens real resources and must give every one of them back.  |

## Budgets

`scripts/budgets.json` holds the limits and `scripts/check-budgets.mjs` enforces them on the production
build (`npm run build`, then `npm run check:budgets`). Sizes are gzip at its highest level, the unit a
compressing host sends. To read another build, set `FIREFLY_BUILD_DIR` (relative to the repository
root). Raising a limit is a decision: say why in the commit.

| Limit (gzip)                                               | Budget | Measured 21 Nov 2026 | Before this work |
| ---------------------------------------------------------- | ------ | -------------------- | ---------------- |
| First-load JavaScript (entry and the chunk loaded with it) | 110 kB | 109.4 kB             | 114.8 kB         |
| First-load CSS                                             | 8 kB   | 7.1 kB               | 10.5 kB          |
| Largest lazy JavaScript chunk (the call page)              | 38 kB  | 34.8 kB              | 34.4 kB          |
| Largest CSS file (the call page)                           | 6 kB   | 5.5 kB               | 5.8 kB           |

The first-load JavaScript limit is the product target, not the measured value plus headroom, so that
the mistake that cost 5.4 kB cannot come back unnoticed. The others are the measured value plus about
8 percent. The check also fails the build if it contains a source map, a font file, any page other than
`index.html` (the component galleries and development pages never ship), or the string `ZodError` in
any script (the web app must never ship zod). Each of those was checked by feeding the script a build
with one added.

### What was in the first load, and what changed

Source maps from a throwaway build (never the production configuration) were used to attribute each
chunk's bytes to its sources. Before the change the first load was two files:

- the entry, 226 kB raw / 70.1 kB gzip: React DOM and its scheduler (about 205 kB raw) and the app
  shell, router, config and API client (about 20 kB);
- a shared chunk named `design`, 137.5 kB raw / 44.7 kB gzip: React Router (94 kB raw), React (7.6 kB),
  the whole icon set (9.6 kB), every design primitive (18.6 kB) and the shared vocabulary module
  (5.9 kB, pulled in by the score bar).

The app shell imported its buttons, links and message bar from the design barrel
(`web/src/design/index.ts`). The barrel re-exports every primitive and each primitive imports its own
stylesheet, so the bundler treats all of them as needed by the entry: the dialog, the form fields, the
tabs, the score bar, the vocabulary and their CSS were all downloaded before the first page drew. The
shell and the router now import the one primitive they need from its own file.

|                             | Before                               | After                                                                         |
| --------------------------- | ------------------------------------ | ----------------------------------------------------------------------------- |
| First-load JavaScript       | 114.8 kB                             | 109.4 kB                                                                      |
| First-load CSS              | 10.5 kB                              | 7.1 kB                                                                        |
| Entry chunk                 | 226.0 kB raw, 70.1 kB gzip           | unchanged                                                                     |
| Chunk loaded with the entry | `design`: 137.5 kB raw, 44.7 kB gzip | 120.5 kB raw, 39.3 kB gzip                                                    |
| Page-only primitives        | in the first load                    | their own chunk, 16.9 kB raw, 6.0 kB gzip, fetched with a page that uses them |
| Report chunk                | 15.3 kB gzip                         | 15.2 kB gzip                                                                  |
| Call chunk                  | 34.4 kB gzip                         | 34.8 kB gzip (other changes to the call screen landed meanwhile)              |

React DOM (about 62 kB), React Router (about 31 kB) and React (about 3 kB) are 96 kB of the 109.4 kB,
so the first load cannot get much smaller while those three stay. The journey chart is its own
chunk (1.2 kB gzip). There are no web fonts and no source maps in the build. A test
(`web/src/app/entry-imports.test.ts`) fails if the entry imports from the barrel again.

The A/B check that the change altered no styling: the nine main views (landing, responsible AI, about,
scenarios, scenarios with one chosen, brief, call, report, not found) at 1440 and 375 px wide were
captured from the old and the new build and compared pixel by pixel: no pixel differed, in the first
screen of each.

Not done: the Node server (`server/http/static.ts`) sends files uncompressed. The first load is about
355 kB raw there, and the probe below reports the transferred size. A host or proxy that compresses
brings it to the gzip figures above; compressing in the server itself would be a server change.

## Long transcripts

A real call is capped at 60 trainee messages, at most 121 turns. The 200 and 500 turn calls below are
invented: the page is served a longer copy of a real session (route interception in
`e2e/perf.spec.ts`), so they test the interface beyond what a call can reach and are labelled
synthetic wherever they appear.

**The defect.** Every change to the call's snapshot (the clock once a second, the microphone level up to
fifteen times a second while listening) drew every turn of the transcript again, because the retry
callback handed to each row was a new function each time. A unit test
(`web/src/features/call-ui/Transcript.test.tsx`) counts the rows drawn: before, ten such updates drew
330 customer rows of a 60-turn call instead of 30, and a new turn drew 31 rows; now none, and at most 2
(the new turn, and the one that stopped being among the newest).

Call page, CPU x1 (before: the same measurement on the build before the change; after:
`e2e/perf.spec.ts`):

| Turns           | DOM elements | Script time idle, ms per second, before / after | New turn, script ms, before / after | Scroll frame, 95th percentile |
| --------------- | ------------ | ----------------------------------------------- | ----------------------------------- | ----------------------------- |
| 60              | 837          | 2 / 2.1                                         | 14 / 19                             | 16.7 ms, both                 |
| 200 (synthetic) | 2,237        | 5 / 3.4                                         | 22 / 18                             | 16.7 ms, both                 |
| 500 (synthetic) | 5,237        | 10 / 2.7                                        | 30 / 20                             | 16.7 ms, both                 |

The idle cost used to grow with the call (2, 5, 10 ms per second) and no longer does. At CPU x4 the
same measurement gave 77 ms per second before and 5 ms after at 500 turns (20 and 11 at 60 turns), and
the 95th-percentile scroll frame at 500 turns went from 82.9 to 66.4 ms. New-turn script time at CPU x4
was within the noise (257 before, 160 after at 500 turns). Opening the call page with 500 turns took
about 0.6 s at CPU x1 and about 3.4 to 4.2 s at CPU x4, which is the cost of drawing 500 rows once; at
the real maximum of 121 turns it is close to the 200-turn figure (about 2.4 s at CPU x4).

The older turns were already skipped by the browser (`content-visibility: auto` with
`contain-intrinsic-size`); "Jump to latest" and following the newest turn were already in place.

Report page: the turns now also use `content-visibility: auto` (and are laid out in full for
printing). At CPU x1 the report was already smooth at every length (16.7 ms frames), so the change shows
no gain there; at CPU x4 the 95th-percentile scroll frame at 500 turns was 49.6 ms before and 33.3 ms
after, but the 60-turn figures moved the other way (16.7 before, 32.9 after), so treat that as noise.

| Turns           | Open, ms | DOM nodes | Typing in "Find in transcript" |
| --------------- | -------- | --------- | ------------------------------ |
| 60              | 617      | 1,634     | no long task                   |
| 200 (synthetic) | 641      | 2,614     | no long task                   |
| 500 (synthetic) | 429      | 4,714     | no long task                   |

Search is already deferred (`useDeferredValue`). At every length, stepping through six matches with
"Next match" scrolled each match into view, so skipped turns do not break it. The report shows a layout
shift of 0.063, below the 0.1 threshold: the footer sits at the bottom of the screen under the short
loading view and leaves the screen when the report arrives. It was not changed.

## The wait after End and review

Measured with the demo engine made to take longer (the session is served as "still being evaluated"
for four polls, then as it is), under `prefers-reduced-motion: reduce`:

- five polls until the report appeared, one every 800 ms (3 s in a background tab; covered by
  `ReportPage.test.tsx`), and none in the three seconds after leaving the page by a link in the app;
- no animation running without end (none under reduced motion, because the global rule makes every
  animation run once);
- one long task, 57 ms, during the wait: no task of 100 ms or more;
- the chart code is its own chunk, and the polling timer and request are cleared when the page is left.

The polling interval is fixed at 800 ms in the foreground; it does not back off. Each poll is a small
request, but a slow live evaluation (the page says the wait is longer than usual after 40 s) means
dozens of polls; a gentle back-off would be a change to `useReportSession.ts`, not made.

## The microphone, the audio and what a call opens

Two kinds of proof. The unit tests with the fakes in `web/src/features/voice/testing` (666 tests in the
call and voice folders) already show, for 100 exchanges and for ending, pausing, replacing and leaving a
call at every phase, that no track, context, node, listener, URL or timer is left. The browser test
(`e2e/perf.spec.ts`, "a spoken call") adds what fakes cannot: a real `AudioContext`, real
`MediaStreamTrack`s, real object URLs and the real heap, in Edge with Chromium's fake microphone playing
a generated tone and the server's mock speech provider.

Results, 30 spoken turns (every tenth reply heard to the end, the rest interrupted), then pause, resume
and End and review:

| What                                                              | After turn 5  | After turn 30      | After pause | After End and review                 |
| ----------------------------------------------------------------- | ------------- | ------------------ | ----------- | ------------------------------------ |
| Microphone tracks live (opened in all)                            | 1 (1)         | 1 (1)              | 0           | 0 (2: pause and resume asked again)  |
| Audio contexts alive (created in all)                             | 2 (2)         | 2 (2)              | 1           | 0 (3)                                |
| Object URLs live (created / revoked)                              | 0 (7 / 7)     | 0 (32 / 32)        |             | 0 (32 / 32)                          |
| Audio elements: ever played, at most playing at once, playing now | 1, 1, 0       | 1, 1, 0            |             | 1, 1, 0                              |
| Capture worklets created / disconnected / port closed             | 1 / 0 / 0     | 1 / 0 / 0          |             | 2 / 2 / 2                            |
| Listeners on window / document                                    | 5 / 1         | 5 / 1              |             | 7 / 1 (the report page adds its own) |
| Repeating timers                                                  | 1 (the clock) | 1                  |             | 0                                    |
| Heap after a full garbage collection                              | 4.58 MB       | 5.89 MB (+1.31 MB) |             |                                      |
| DOM nodes                                                         | 637           | 1,768              |             |                                      |

The heap rule (growth under 10 percent or 2 MB, whichever is larger) holds: +1.31 MB. The increments
shrink (+0.63, +0.25, +0.14, +0.12 and +0.17 MB per five turns) and the page holds 45 more DOM nodes per
turn, which is the transcript growing; the counters above are flat. The same run with Playwright's trace
recorder on showed more (+1.44 MB, 4,700 nodes) because the recorder keeps nodes alive.

Leaving the call without ending it: the browser's back button leaves no live track, no audio context, the
same listeners as before the call and no repeating timer; leaving the page for another document and coming
back loads the app afresh (it was not kept in the back/forward cache) with no live microphone.

Found and changed:

- The capture worklet's `MessagePort` was never closed explicitly; it relied on the context closing.
  `microphone.ts` now closes it on release (a unit test and the browser test check it).
- The transcript redraw above (a cost, not a leak).

Not as the brief assumed: at most one `AudioContext` is not true by design. A call holds two: one for
the microphone (16 kHz, with the capture worklet) and one that only measures the customer's voice level.
Routing the voice through the microphone's 16 kHz context would degrade the playback. The count is two
for the whole call (a third appears only after a pause and resume, because pausing releases the
microphone), never grows with turns, and is zero after the call ends.

Left for the browser to do and not observable here: closing the tab (the browser ends capture itself);
other browsers' back/forward cache. Browser speech synthesis is covered by the unit tests only (the
server's speech provider was used in the browser test), and the browser's own speech recognition cannot
be tested: Edge and Chrome return no words under automation.

## Input latency

200 synthetic turns, a spoken call with the fake microphone, click to next paint (Event Timing, which
rounds to 8 ms). CPU x1, three runs, medians (range):

| Control                           | ms           |
| --------------------------------- | ------------ |
| Mute                              | 52 (24-88)   |
| Pause                             | 24 (24-40)   |
| Resume                            | 56 (48-64)   |
| Send                              | 40           |
| End call (opens the dialog)       | 32 (24-48)   |
| Continue call (closes it)         | 24 (24-32)   |
| Voice settings (opens the dialog) | 104 (96-120) |

CPU x4, three runs of the build before and the build after the transcript change, taken in turn so that
the load on the machine was shared, medians (range), ms:

| Control                           | Before        | After         |
| --------------------------------- | ------------- | ------------- |
| Mute                              | 212 (104-336) | 148 (72-304)  |
| Pause                             | 128 (72-136)  | 64 (64-176)   |
| Resume                            | 128 (88-168)  | 120 (112-184) |
| Send                              | 256 (224-256) | 240 (152-336) |
| End call (opens the dialog)       | 176 (112-256) | 192 (88-272)  |
| Continue call (closes it)         | 168 (128-328) | 120 (80-232)  |
| Voice settings (opens the dialog) | 304 (272-376) | 312 (264-432) |

The target of under 100 ms at CPU x4 is not met. At CPU x1 every control is under 100 ms except the
first opening of a dialog, which is about 100 ms. The transcript change helped the controls that do not
open a dialog; the dialogs and Send are unchanged. A profile of End call showed the dialog's native
`showModal()` (the browser's style and layout work for the whole page) as the largest single cost, and
it did not depend on the length of the transcript (the first opening cost about the same at 3, 60 and
200 turns). No handler does heavy work of its own: the remaining cost is that the whole call screen
draws again on every change. Memoising its panels (they are given new objects and callbacks each draw)
is the next step, in the call screen rather than in the engine.

## The probe

`scripts/perf-probe.mjs` measures the pages of a running Firefly. It starts and stops nothing.

```
npm run build
$env:FIREFLY_PROVIDER='mock'; $env:FIREFLY_SPEECH_PROVIDER='mock'; $env:FIREFLY_DB_PATH=':memory:'; npm start
node scripts/perf-probe.mjs http://127.0.0.1:8787 --runs=3
node scripts/perf-probe.mjs http://127.0.0.1:8787 --pages=call,report --throttle=4 --json
```

Options: `--pages` (landing, scenarios, brief, call, report), `--runs`, `--throttle`, `--w`, `--h`,
`--wait`, `--exchanges`, `--json`; `PW_CHANNEL=msedge` (the default) or `chrome`, or `none` for
Playwright's Chromium. For the call and report pages it starts a call of its own through the API (30
exchanges, 61 turns) as a new anonymous profile each, so run it against a server in demo mode with its
own database. A run is a fresh browser context with a cold cache.

Sample, CPU x1, three runs, 21 November 2026, this machine (medians, range in brackets):

```
Page                FCP ms         LCP ms                  CLS  Long tasks      Long ms  DOM nodes  Heap MB  Requests  JS gzip kB  JS xfer kB  CSS gzip kB
landing      236 (208-304)  568 (424-768)                0.000     0 (0-1)     0 (0-52)        650      2.3        11       121.4       384.6         14.1
scenarios    176 (152-236)  392 (316-500)                0.000     0 (0-1)     0 (0-58)        726      2.9        17       125.8       397.2         14.3
brief        208 (144-224)  388 (260-424)                0.032     0 (0-1)     0 (0-54)        233      2.3        15       123.7       388.9         12.3
call         236 (168-264)    284 (0-548)                0.000     2 (0-2)  122 (0-125)        846      3.6        13       151.1       483.9         16.6
report       212 (204-216)  596 (520-596)  0.000 (0.000-0.063)           1   51 (50-51)       2194      4.1        16       132.8       421.0         16.0
```

The first load transfers about 355 kB because the Node server does not compress; "JS gzip" is what
`scripts/budgets.json` counts. The call page's largest contentful paint is read from the screen before
the call starts, and one run recorded none (0).

## Repeating each number

| Number                                             | How                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Sizes and budgets                                  | `npm run build`, then `npm run check:budgets` (or `FIREFLY_BUILD_DIR=... node scripts/check-budgets.mjs`)                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| What is in a chunk                                 | build with `sourcemap: true` into another folder with a throwaway config, then `npx --yes source-map-explorer <folder>/assets/*.js`. On the measuring machine the package feed refused that package, so the attribution was computed with a short script of the same method                                                                                                                                                                                                                                                                                        |
| Long transcripts, latency, the wait, the lifecycle | start the server as above with `FIREFLY_TEST_HOOKS=1` and `FIREFLY_SPEECH_PROVIDER=mock`, then `$env:E2E_PERF='1'; $env:E2E_BASE_URL='http://127.0.0.1:8787'; $env:PW_CHANNEL='msedge'; npx playwright test e2e/perf.spec.ts --project=desktop --output=scripts/_tmp/pw-perf`; each test prints `PERF {...}` lines. `E2E_PERF=1` switches on the timing tests (tagged `@perf`), which are left out of ordinary and CI runs because they depend on how fast the machine is; the media-lifecycle tests, which count tracks, contexts, URLs and listeners, always run |
| Number of spoken turns, CPU slowdown               | `PERF_SPOKEN_TURNS=30`, `PERF_CPU_RATE=4`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Before and after                                   | build the earlier commit into another folder, serve it with `FIREFLY_WEB_DIR`, and run the same command against it in the same sitting                                                                                                                                                                                                                                                                                                                                                                                                                             |
| The probe                                          | as above                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |

Two cautions for measuring. Playwright's trace recorder keeps the page's DOM nodes alive and adds script
time, which showed up as extra heap and nodes in the lifecycle test, so `e2e/perf.spec.ts` turns
tracing off for itself. Two Playwright runs in one folder delete each other's `test-results`, so give
each run its own `--output`.

## Not measured

- Low-end machines, real slow CPUs, mobile devices and their browsers: only a four-times CPU throttle on
  one laptop.
- Chrome, Firefox and Safari (Edge only), and other versions of Edge.
- Real Azure speech latency, real language-model latency, real network latency and transfer times.
- The browser's own speech recognition and its speech synthesis in a real call.
- The heap over calls longer than 30 spoken turns, and heap snapshots to prove the absence of a leak (the
  counters above stayed flat, which is evidence, not proof).
- Closing the tab, and the back/forward cache in other browsers.
- Hidden-tab polling in a real browser (covered by a unit test).
- A graphics-free machine (software rendering), forced colours and print performance.
