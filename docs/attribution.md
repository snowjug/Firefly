# Attribution

What in Firefly comes from somewhere else, under which licence, and what was studied but not copied.
The short version: three open-licensed font families and four npm packages ship with the product;
everything else is written for Firefly.

## What ships in the product

### Fonts

Three families, self-hosted in `web/public/fonts/` and served from Firefly's own origin (nothing is
loaded from a font service). All three are licensed under the SIL Open Font License 1.1. The
copyright notices and the licence text are in [`web/public/fonts/LICENSES.md`](../web/public/fonts/LICENSES.md),
which stays with the files.

| Loaded in the page as | Derived from   | Used for                                   | Copyright                               |
| --------------------- | -------------- | ------------------------------------------ | --------------------------------------- |
| Newsreader            | Newsreader     | Display type and reading text              | 2020 The Newsreader Project Authors     |
| Hanken Grotesk        | Hanken Grotesk | Interface text                             | 2021 The Hanken Grotesk Project Authors |
| Firefly Mono          | IBM Plex Mono  | Telemetry: small uppercase labels, numbers | 2017 IBM Corp.                          |

The files are subsets (Latin letters, numerals and common punctuation, and only the weights Firefly
uses), which the licence counts as Modified Versions. They came from the Fontsource packages on npm.

**Reserved Font Names.** Newsreader and Hanken Grotesk declare none in their upstream licence notices,
so they keep their names. IBM declares the Reserved Font Name "Plex", and the licence does not let a
Modified Version use a Reserved Font Name without permission. Firefly has none, so the mono files were
renamed (to Firefly Mono) before they were added, and nothing else in them was changed: the glyph
outlines, metrics, character map and layout tables are identical to the subset they came from, and the
IBM copyright notice and licence URL are still in the files. The details are in `LICENSES.md`.

### Runtime packages

The browser bundle contains React, React DOM, React Router and zod. The Node server uses zod too and
otherwise only Node's built-in modules (`node:http`, `node:sqlite`). Nothing was added for the
interface redesign, the rewards or voice.

| Package        | Version at the time of writing | Licence |
| -------------- | ------------------------------ | ------- |
| `react`        | 19.3.1                         | MIT     |
| `react-dom`    | 19.3.1                         | MIT     |
| `react-router` | 7.18.5                         | MIT     |
| `zod`          | 4.6.7                          | MIT     |

### Everything else

- **Code, styles and drawings.** The interface, the Signal instrument, the animated field, the icons,
  the favicon and the wordmark are written and drawn for Firefly (SVG, Canvas2D and CSS).
- **No stock material.** There are no photographs, illustrations, 3D models, icon sets, sound files or
  datasets. Call tones are synthesised in the browser.
- **Scenarios and people** are fictional and written for Firefly.
- **Screenshots** in `docs/images/` are screenshots of Firefly itself with a fictional learner.

## Development tooling (not shipped)

Used to build and test, and not part of what a learner downloads. The full list, with versions, is in
`package.json`.

| Tool                              | Licence    |
| --------------------------------- | ---------- |
| Vite, Vitest, ESLint, Prettier    | MIT        |
| Testing Library, jsdom            | MIT        |
| Playwright, TypeScript            | Apache-2.0 |
| axe-core (`@axe-core/playwright`) | MPL-2.0    |

## Studied, not copied

The redesign began with research into current interface craft and the libraries behind it. These were
read for ideas and for their licence terms. **Nothing from them was copied into the repository:** the
plan for the redesign was to re-implement any technique in-house and never to copy code, no source
file carries a provenance note, and the implementations were written for Firefly's own needs.

| Source                                                                       | Licence, as read                                                                                                 | What was learned                                                                            | What Firefly does                                                                                                                                                                               |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| React Bits                                                                   | MIT with a Commons Clause condition (use inside an application is allowed; redistributing the components is not) | How animated backgrounds and pointer lights treat reduced motion                            | Not used. Whether publishing its source in a public repository counts as redistribution is a question for the licence holder, so nothing was taken. The field is written for Firefly (Canvas2D) |
| 21st.dev and its Magic MCP                                                   | Each component has its own licence; the site has its own terms                                                   | Floating dock navigation, glass surfaces and command palette ranking as patterns            | Ideas only. The dock, the palette and the materials are written for Firefly. Firefly's source is not sent to the hosted service                                                                 |
| Anime.js                                                                     | MIT                                                                                                              | Timelines, SVG drawing and morphing                                                         | Not used. CSS transitions, the Web Animations API and small tweens cover the need                                                                                                               |
| GSAP                                                                         | The standard "No Charge" licence, which is not MIT                                                               | Shared-element and flip-style transitions                                                   | Not used. The View Transitions API does this natively                                                                                                                                           |
| Motion                                                                       | MIT                                                                                                              | Layout animation between routes                                                             | Not used, for the same reason                                                                                                                                                                   |
| three.js, React Three Fiber, Drei                                            | MIT                                                                                                              | Particle and strand fields                                                                  | Not used. About 250 kB gzipped for a scene that Canvas2D and SVG draw at about 1 ms a frame                                                                                                     |
| Awarded sites and games, atmospheric-layer tools                             | Their own terms                                                                                                  | Hierarchy through scale contrast, atmosphere as a layer behind readable content             | Inspiration only. No branding, asset or implementation was reused                                                                                                                               |
| WCAG 2.2, the WAI-ARIA Authoring Practices, MDN, Microsoft Fluent 2 guidance | Published guidance                                                                                               | Focus appearance, target size, pause-stop-hide, reduced motion, forced colours, short fades | Followed as guidance. No Microsoft branding or assets are used                                                                                                                                  |

The reasoning behind each choice is in [experience-design.md](experience-design.md#dependency-choices).

## Reporting a concern

If you believe something in the repository should be credited or should not be here, please open an
issue on the repository with the file and the source, and it will be fixed.
