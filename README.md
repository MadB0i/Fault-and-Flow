# Fault & Flow

> **One plate pushes. One river answers.**

An interactive 3D sandbox of Assam's earth and water, running entirely in the browser.

---

## ⚠️ Work in progress — this is not a forecast

**This is an educational sandbox. It is not a forecast, not a hazard map, and not a
prediction tool.** What runs today is a 3D terrain viewer on processed Copernicus DEM
terrain, with an honesty banner, legend, readout, and attribution. There is no
flood/erosion simulation yet.

Three rules shape everything in this project, and they are not negotiable:

1. **Earthquakes cannot be predicted.** No one can tell you when or where the next one will
   happen. We will never claim otherwise, or imply it with future-tense language.
2. **Flood visuals are illustrative**, not modelled forecasts.
3. **Unknown is a value.** An unavailable measurement renders as "—" with a reason, never
   as `0` and never as an invented number.

For actual warnings and official flood information, go to the authorities:

| Body                                                                 | URL                           |
| -------------------------------------------------------------------- | ----------------------------- |
| **ASDMA** — Assam State Disaster Management Authority                | <https://asdma.assam.gov.in/> |
| **NCS** — National Center for Seismology, Ministry of Earth Sciences | <https://seismo.gov.in/>      |
| **IMD** — India Meteorological Department                            | <https://mausam.imd.gov.in/>  |

---

## What it is and will be

Live today: a 3D terrain viewer of the Brahmaputra valley (real Copernicus DEM
terrain, orbit camera, legend and readout). Planned next, all client-side:

- **PLATES** — a cinematic intro: the India–Eurasia collision, then a camera flight down
  from the Himalaya along the Brahmaputra into Assam.
- **FAULT** — a timelapse of recorded NE India earthquake history you can scrub through.
  Every marker is a real, cited event.
- **FLOW** — a Brahmaputra bank-erosion sandbox on real terrain. You set a river level or
  an inflow scenario and watch the channel respond. The water is **not** observed hydrology —
  every input is a value you chose.

Interface languages: **English and Assamese**.

## Status

**Phase 3 of 8 — terrain renderer.** Done: DEM pipeline with committed Terrain-RGB
artefacts, headless decoder, R32F terrain renderer with orbit camera, and the terrain
HUD (area picker, exaggeration, contours, legend, readout, attribution).
Not done: FLOW water/erosion simulation, FAULT earthquake timelapse, PLATES cinematic.

See [`docs/ROADMAP.md`](docs/ROADMAP.md) for what comes next.

> Screenshots in `docs/screenshots/` still show the Phase-1 placeholder page and will be
> regenerated for the terrain view. Nothing is linked here until then.

## Getting started

Requires **Node 20+** and npm.

```bash
npm install
npx playwright install chromium   # once, for the browser tests
npm run dev                       # http://localhost:5173
```

```bash
npm run verify      # lint + typecheck + test + build  ← run this before any commit
npm run e2e         # browser tests, accessibility audit
npm run shots       # regenerate docs/screenshots/
npm run contrast    # recompute WCAG contrast for the palette
```

## Stack

Vite · TypeScript (strict) · React (HUD only) · Three.js (imperative engine, no React
imports) · Zustand · Tailwind + CSS-variable tokens · Vitest · Playwright ·
ESLint · Prettier. Fonts are self-hosted via `@fontsource` — never a CDN.

The 3D engine under `src/engine/` is framework-agnostic and runnable headless, so
simulations can be unit-tested without a browser. React talks to it through one typed API.
That rule is enforced by ESLint, not just documented.

## Data and licensing

Every dataset traces to a row in [`docs/DATA.md`](docs/DATA.md) with its source URL,
retrieval date, and licence text quoted verbatim from the source. **Where a licence could
not be verified, the entry says `UNVERIFIED` and the data is not shipped.** Cleared for
use: Copernicus DEM GLO-30, Natural Earth, and the USGS ANSS earthquake catalogue — event
parameters only, credited as "Earthquake catalog data courtesy of the U.S. Geological
Survey". Several intended sources are not yet cleared — see that file before relying on
anything.

Licence: [MIT](LICENSE).

## Documentation

| File                                           | What it covers                                              |
| ---------------------------------------------- | ----------------------------------------------------------- |
| [`PRODUCT.md`](PRODUCT.md)                     | Audience, goals, non-goals, honesty rules, success criteria |
| [`AGENTS.md`](AGENTS.md)                       | Rules for coding agents working on this repo                |
| [`DESIGN.md`](DESIGN.md)                       | Tokens, rationale, computed contrast table, anti-patterns   |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Engine/UI split, typed API contract, data flow              |
| [`docs/DATA.md`](docs/DATA.md)                 | Dataset sources, licences, attribution                      |
| [`docs/ROADMAP.md`](docs/ROADMAP.md)           | Phases 1–8                                                  |
