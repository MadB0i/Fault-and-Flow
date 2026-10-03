# Fault & Flow

> One plate pushes. One river answers.

An interactive 3D atlas of Assam's earth and water. Browser only, with English and
Assamese controls, no backend, accounts or telemetry.

- **FLOW:** Copernicus terrain with mapped rivers, state outlines and places.
  Choose a starting depth or scenario inflow and watch illustrative water spread.
  Explore the Assam overview, Majuli and Sadiya–Dibrugarh.
- **FAULT:** replay 289 recorded M5+ earthquakes from the documented USGS subset,
  scrub years, open an event's original catalogue record and try a clearly labelled synthetic ground-motion illustration.
- **PLATES:** explore an original schematic India–Eurasia collision diagram.
- Open source, risk and historical flood-report panels; save an attributed map PNG.

**Educational sandbox, not a forecast, hazard map or prediction tool.** Earthquakes
cannot be predicted. Flood inputs are values you choose. Seismic rings and plate
geometry are illustrative. The catalogue is incomplete and cuts off on 1 October 2026. Historical flood footprints, bank erosion and calibrated shaking effects
are not implemented. Assamese copy awaits native-speaker review.

Current warnings and preparedness: [ASDMA](https://asdma.assam.gov.in/),
[NCS](https://seismo.gov.in/), [IMD](https://mausam.imd.gov.in/).

![Assam atlas](docs/screenshots/flow-desktop-en.png)

## Run locally

Node 20+ and npm:

```bash
npm install
npm run dev
```

```bash
npm run verify       # formatting, lint, TypeScript, headless tests and build
npm run e2e          # desktop/mobile, both languages, axe, interactions and GPU checks
npm run shots        # all three modes at 1440px and 390px, both languages
npm run data:atlas   # small Natural Earth and USGS extracts; local .cache/atlas
npm run contrast
```

Browser checks are native Python Playwright, launched through the npm Playwright
runner. They require Python 3 with its `playwright` package and Chromium installed
by `npx playwright install chromium`. Set `PYTHON` to an existing interpreter when
needed. The runner supplies the npm Chromium executable, so a second browser
download is unnecessary. Temporary browser profiles and test outputs stay inside
`.cache/` on the project drive.

For a drive with limited space, use `npm install --cache D:/npm-cache` and set
`TEMP`, `TMP` and `PLAYWRIGHT_BROWSERS_PATH` to directories on that drive before
any installation. No new browser download was needed for this implementation.

## Implementation and data

Vite, strict TypeScript, React HUD, imperative Three.js engine, Zustand, Tailwind
and CSS-variable tokens, motion, Vitest and Playwright. Fonts are self-hosted.

The simulation and shared contract remain framework-free. Every scientific input
traces to a source and licence in [DATA.md](docs/DATA.md). Natural Earth geometry
is pinned to an author-maintained revision; ComCat contains event parameters only.
Raw data stays out of Git and no committed file exceeds 5 MB. Cached input rebuilds
are deterministic; a fresh ComCat request can contain revised catalogue records.

[Product](PRODUCT.md) · [Architecture](docs/ARCHITECTURE.md) ·
[Design](DESIGN.md) · [Decisions](docs/DECISIONS.md) · [Roadmap](docs/ROADMAP.md)

Licence: [MIT](LICENSE), with the third-party data terms documented separately.
