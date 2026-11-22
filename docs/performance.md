# Performance

What Firefly checks about its own speed and size, the limits it enforces, and how to repeat each check. Paths start at the repository root.

**This page records no timing for the current interface.** The interface was rebuilt, so the timings taken on the earlier one (paint times, long-transcript scrolling, input latency, microphone and audio resource counts) no longer describe it and have been removed. The only numbers here are the size budgets, which the repository enforces, and one reading of them taken for this document.

## What is checked

| Check                              | Where                                                 | Runs in CI?                             | What it covers                                                                                                                                                        |
| ---------------------------------- | ----------------------------------------------------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Size budgets and the build's shape | `npm run check:budgets` (`scripts/check-budgets.mjs`) | Yes, after the build                    | Gzip size of the first load and of the largest chunks, and a build with no source maps, no fonts, no extra pages and no zod.                                          |
| The page probe                     | `scripts/perf-probe.mjs`                              | No                                      | Paint times, layout shift, long tasks, DOM nodes, heap and requests for the landing, scenarios, brief, call and report pages of a running server, in Edge or Chrome.  |
| Timing tests                       | `e2e/perf.spec.ts` (tests tagged `@perf`)             | No: they need `E2E_PERF=1`              | Timings in a long transcript and for input, in a real Chromium-based browser.                                                                                         |
| Media-lifecycle tests              | `e2e/perf.spec.ts` (the untagged tests)               | Yes, with 12 spoken turns instead of 30 | That a spoken call gives back every microphone track, audio context, object URL, audio element and listener it opened. They count resources rather than milliseconds. |

The probe and the timing tests give numbers that belong to one machine in one sitting. They mean something only beside numbers taken in the same sitting, so compare two builds back to back, never across machines or days.

## Budgets

`scripts/budgets.json` holds the limits and `scripts/check-budgets.mjs` enforces them on the production build. Sizes are gzip at its highest level, which is what a compressing host sends. The Node server itself does not compress. To read another build, set `FIREFLY_BUILD_DIR` (a folder, absolute or relative to the repository root). Raising a limit is a decision: say why in the commit.

| Limit (gzip)                                               | Budget | One reading, 22 November 2026 |
| ---------------------------------------------------------- | ------ | ----------------------------- |
| First-load JavaScript (entry and the chunk loaded with it) | 114 kB | 112.5 kB                      |
| First-load CSS                                             | 11 kB  | 9.7 kB                        |
| Largest lazy JavaScript chunk                              | 38 kB  | 36.3 kB (the call page)       |
| Largest CSS file                                           | 9 kB   | 8.2 kB (the entry stylesheet) |

The readings come from running `scripts/check-budgets.mjs` on a production build of the working tree on 22 November 2026, so they move with every change. Each limit is the measured value plus roughly 1 to 2 kB, so growth shows up in review instead of being absorbed quietly.

The limits were raised from 110, 8, 38 and 6 kB, which the previous interface passed at 109.3, 7.2, 30.3 and 5.8 kB. The rebuild added an authored dark theme (the token stylesheet, which every page downloads, went from 3.3 to 5.9 kB), a theme runtime and a sliding indicator in the header (both part of the first load), and richer call and report screens (the call chunk is 5.7 kB larger). These are the measured differences. No attempt was made to win the size back by trimming the dark theme.

Besides sizes, the check fails the build if it contains a source map, a font file, any page other than `index.html` (the component galleries and development pages never ship), or the string `ZodError` in any script (the web app must never ship zod). When the first load grows because the voice catalogue or the spoken-text sanitiser has become reachable from the entry, `web/src/features/voice/entry-weight.test.ts` names the chain of imports that leads to it.

## Run the checks

```
npm run build
npm run check:budgets
```

To read the size budgets of a build written elsewhere, for example next to a build you are comparing:

```
FIREFLY_OUT_DIR=<folder> npm run build
FIREFLY_BUILD_DIR=<folder> node scripts/check-budgets.mjs
```

`FIREFLY_OUT_DIR` is relative to `web/`; an absolute path also works.

### The probe

`scripts/perf-probe.mjs` measures the pages of a server that is already running. It starts and stops nothing.

```
npm run build
$env:FIREFLY_PROVIDER='mock'; $env:FIREFLY_SPEECH_PROVIDER='mock'; $env:FIREFLY_DB_PATH=':memory:'; npm start
node scripts/perf-probe.mjs http://127.0.0.1:8787 --runs=3
node scripts/perf-probe.mjs http://127.0.0.1:8787 --pages=call,report --throttle=4 --json
```

Options are `--pages` (landing, scenarios, brief, call, report), `--runs`, `--throttle`, `--w`, `--h`, `--wait`, `--exchanges` and `--json`. Set `PW_CHANNEL` to `msedge` (the default) or `chrome`, or to `none` for Playwright's own Chromium. For the call and report pages it starts a call of its own through the API, so run it against a server in demo mode with a database of its own. Each run is a fresh browser context with a cold cache, only the CPU is throttled, and the network is the loopback, so transfer times are not representative.

### The timing and lifecycle tests

```
$env:E2E_PERF='1'; $env:E2E_BASE_URL='http://127.0.0.1:8787'; $env:PW_CHANNEL='msedge'; npx playwright test e2e/perf.spec.ts --project=desktop
```

Start the server first as above, with `FIREFLY_TEST_HOOKS=1` and `FIREFLY_SPEECH_PROVIDER=mock`. Each test prints `PERF {...}` lines and attaches them to the report. Without `E2E_PERF=1` the `@perf` tests are left out and only the media-lifecycle tests run. `PERF_SPOKEN_TURNS` and `PERF_CPU_RATE` change the number of spoken turns and the CPU slowdown. The test turns Playwright's tracing off for itself, because the trace recorder keeps DOM nodes alive and adds script time. Two Playwright runs in one folder delete each other's `test-results`, so give each run its own `--output`.

## Not measured

Nothing on this list has been measured for the current interface, and nothing here is a claim about it:

- Paint times, layout shift, long tasks, DOM size and heap for any page.
- A long transcript, input latency and the wait after **End and review**.
- The resources a spoken call opens, beyond what the lifecycle tests count with fake devices.
- Low-end machines, real mobile devices and their browsers.
- Firefox and Safari.
- Real Azure speech latency, real model latency and real network latency.
- The browser's own speech recognition and speech synthesis in a real call.
