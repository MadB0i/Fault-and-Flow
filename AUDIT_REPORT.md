# AUDIT_REPORT.md — Fault & Flow, full evidence-based audit

> **Archived foundation audit.** This report describes commit `7a96027`, not
> the v0.2.0 atlas. Findings and test results below are historical evidence.
> See [the current interface review](docs/ATLAS_REVIEW.md) and
> [remaining work](docs/ROADMAP.md) for the newer implementation. The report's
> original findings are preserved; formatting and this archive note were added
> for publication.

> READ-ONLY audit. No source file was modified. Only this file was created.
> Branch audited: `fix/terrain-nodata` at `7a96027 fix(data): keep the reserved no-data code out of reach of real terrain`
> Date (UTC): 2026-10-02. Auditor: senior software auditor (headless + browser runs).
> Rule: every finding cites `file:line` or exact command output. Unverifiable = marked `UNVERIFIED`.

---

## STEP 1 — Discovery

### Stack (from `package.json:1-66`)

| Concern     | Choice                                                                                                | Evidence                                                          |
| ----------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Build       | Vite `^8.3.1`                                                                                         | `package.json:64`, `vite.config.ts:1-33`                          |
| Language    | TypeScript `strict:true` + `noUnusedLocals`, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess` | `tsconfig.json:17-24`                                             |
| UI          | React 18.3.1 (HUD only)                                                                               | `src/main.tsx:1-16`, `src/ui/App.tsx:1-170`                       |
| 3D          | Three.js `^0.171.0` imperative, no React in engine                                                    | `src/engine/terrain/terrain-view.ts:34`, `eslint.config.js:41-70` |
| UI state    | Zustand `^5.0.2`                                                                                      | `src/ui/state/useUiStore.ts:6`                                    |
| Styling     | Tailwind `^4.3.3` + CSS-var tokens                                                                    | `src/ui/styles/base.css:1-2`, `tokens.css:6-80`                   |
| Animation   | `motion ^11.15.0` installed, **zero imports** (dead dep, see §4)                                      | `package.json:37`, grep §4                                        |
| Tests       | Vitest `^5.0.3` (node env), Playwright `^1.49.1`                                                      | `vitest.config.ts:18-26`, `playwright.config.ts:1-59`             |
| Lint/format | ESLint flat + Prettier `3.9.9` pinned exact                                                           | `package.json:60`, `eslint.config.js:1-139`                       |
| Fonts       | Self-hosted `@fontsource/*` only, no CDN                                                              | `src/ui/styles/base.css:5-18`                                     |
| Package mgr | npm only, Node `>=20`                                                                                 | `package.json:8-10`                                               |

Scripts (`package.json:11-30`): `dev`, `build` (`tsc --noEmit && vite build`), `preview`, `lint`, `format`, `format:check`, `typecheck`, `test`, `e2e`, `shots`, `verify` (= format:check + lint + typecheck + test + build), `contrast`, `data:dem*`.

### Folder structure (actual, `git ls-files` + disk)

```
src/
  shared/types.ts              domain types (Mode, Locale, Provenance, TerrainSample, EngineSnapshot, QuakeEvent, FlowParams)
  shared/i18n/strings.ts       EN + AS strings, MODE_ENTRIES
  engine/terrain/              ONLY terrain exists: area-registry, camera-math, decode-terrain,
                               metrics, sampling, shaders, sidecar, terrain-rgb, terrain-view, index
  ui/App.tsx                   shell + honesty banner + <TerrainScene/>
  ui/ModeRail.tsx              3 disabled buttons
  ui/LangToggle.tsx            radio group en/as
  ui/state/useUiStore.ts       locale + mode (mode never set, see §4)
  ui/terrain/                  TerrainScene, TerrainPanel, TerrainLegend, TerrainReadout,
                               TerrainAttribution, useTerrainView, assets
  main.tsx                     StrictMode createRoot
data/processed/                assam-overview.{png,json}, majuli.{png,json}, sadiya-dibrugarh.{png,json}, manifest.json
scripts/                       build-dem.ts, dem-areas.ts, dem-spacing.ts, migrate-nodata-encoding.ts,
                               check-contrast.mjs, review.mjs
tests/ (8 files, 119 tests)    dem-artifacts, design-tokens-sync, engine-architecture, flow-params,
                               fonts, terrain-camera, terrain-metrics, terrain-sampling
e2e/                           accessibility.spec.ts (15 tests x2 projects), screenshots.spec.ts
docs/                          ARCHITECTURE.md, DATA.md, DECISIONS.md, ROADMAP.md + DESIGN.md, PRODUCT.md, README.md
```

What does **not** exist despite `docs/ARCHITECTURE.md:49-57` describing it: `src/engine/api.ts`, `src/shared/api.ts`, `src/engine/scene|water|quake|plates|data|core/`, `src/engine/terrain/terrain-rgb` pipeline output aside, `src/data/quakes.ts`, `scripts/build-quakes.ts`, `src/ui/components/*`, `src/ui/hooks/*`. The doc is aspirational; the code is terrain-only. Not a bug in code, a doc/reality gap.

Entry points: `index.html:16` → `/src/main.tsx` → `src/ui/App.tsx:33` → `TerrainScene` → `useTerrainView.ts:83` → `createTerrainView(canvas, {palette, sources, reducedMotion})` → `loadArea('majuli')`. Data via Vite `?url` in `src/ui/terrain/assets.ts:23-34`.

### How the loop / layers connect

```
Copernicus GLO-30 S3 ──range req──> scripts/build-dem.ts ──> data/processed/*.png+json + manifest.json
        │                                    │ Terrain-RGB, offset = floor(min)-step, noData code 0
        ▼                                    ▼
src/engine/terrain/decode-terrain.ts (headless PNG→Float32Array+mask, NaN holes)
        │ sampling.ts (bilinear CPU probe)    metrics.ts (extent, contours, ticks)
        ▼
terrain-view.ts:161 createTerrainView — ONE PlaneGeometry(512x512) + R32F DataTexture + custom shaders
        │ render-on-demand only (camera/resize/param/area), DPR≤1.5, damping chain, dispose()
        ▼
useTerrainView.ts (React binding, status/area/exaggeration/contours/probe) ──> TerrainScene/Panel/Legend/Readout/Attribution
```

No water/flood sim, no erosion, no quake timelapse, no plates animation exists. `FlowParams`/`QuakeEvent`/`EngineSnapshot` are types + contract tests only.

```
        ┌───────────┐
        │  shared/  │  types only (enforced: eslint.config.js:73-89)
        └─────┬─────┘
      ┌───────┴────────┐
      ▼                ▼
 ┌─────────┐    ┌──────────┐
 │ engine/ │    │   ui/    │  ui imports @engine/terrain barrel only
 └─────────┘    └──────────┘
```

---

## 1. Executive summary

**What this is:** an educational 3D sandbox of Assam (Brahmaputra terrain viewer today; flood/erosion + quake timelapse + plates cinematic planned). Phase 3 of 8 per `docs/ROADMAP.md:11`. Terrain renderer on real Copernicus DEM is built and honest; everything else is types, docs, and disabled buttons.

**Health score: 6.5 / 10.**

Why not higher: `npm run verify` is green and the terrain engineering is unusually careful (headless decoder, float32 rationale, render-on-demand, provenance types), but `npm run e2e --project=a11y` is red (4/15 fail, stale placeholder specs), README + screenshots + ARCH docs describe a different app than what ships, and three promised modes are STUBs with no sim code. Why not lower: zero vulns, zero lint/type errors, 119/119 unit pass, no secrets, no invented data, contrast computed, disposal present, mobile + keyboard + reduced-motion handled.

**Top 5 problems:**

1. **E2E suite is stale and red** — 4 failures on `a11y` project (`accessibility.spec.ts:290,306,335,340`); specs still assert the Phase-1 placeholder (`assamese-phrase`, `phase-label`, single h2) while the app ships terrain. `verify` hides this because it excludes `e2e`. See §3.
2. **Docs present a fiction** — `README.md:12-13,49-51` says "no 3D scene yet / Not done: terrain"; `docs/ARCHITECTURE.md:50-57,102-124` documents `EngineApi/createEngine/water/quake/plates` that do not exist; screenshots are `placeholder-*` only. A newcomer cannot trust the front door. See §7.
3. **FLOW/FAULT/PLATES are STUBs** — no hydraulic step, no erosion, no catalogue, no boundary geometry; `motion` dep unused; `FlowParams` defaults arbitrary-by-design but no sim consumes them. Roadmap Phases 4-6 unstarted. See §2.
4. **Retry-after-fatal is dead** — `useTerrainView.ts:89-95,120-130,148-150`: if `createTerrainView` throws (no WebGL2 / no float), `viewRef` stays null and `retry` early-returns. The error panel offers a button that cannot work. See §5.
5. **Bundle + data weight unexamined at runtime** — `three` chunk 470 KB raw (build warns >300 KB), three PNGs 7.86 MB wire / 25.3 MiB GPU (one resident at a time, but no lazy-route split; all three emitted as static assets). Under the stated budgets today, but no budget test guards JS. See §6.

---

## 2. What is built and working

| Feature                                                                                                                             | Verdict                             | Evidence                                                                                                                                                                                        |
| ----------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Terrain DEM pipeline (GLO-30 → Terrain-RGB + sidecar + manifest)                                                                    | COMPLETE                            | `scripts/build-dem.ts:1-824`, `data/processed/manifest.json:1-368`, `tests/dem-artifacts.test.ts` 24 pass; 3 areas 1.94/2.21/3.70 MB, each <5 MB; migration lossless per `DECISIONS.md:258-310` |
| Headless Terrain-RGB decoder (PNG→Float32Array, NaN + mask, no DOM)                                                                 | COMPLETE                            | `src/engine/terrain/decode-terrain.ts:73-103`, `tests/terrain-sampling.test.ts` 12 pass incl. zero-holes assertion                                                                              |
| Terrain renderer (1 mesh, R32F + hand bilinear, hillshade per-fragment, contours, exaggeration, on-demand, DPR≤1.5, probe, dispose) | COMPLETE                            | `src/engine/terrain/terrain-view.ts:161-868`, `shaders.ts:95-206`, `MAX_MESH_SEGMENTS=512:66`, `MAX_PIXEL_RATIO=1.5:69`; dispose `825-847` disposes texture/geometry/material/renderer          |
| Camera (orbit/pinch/wheel/keys, clamp, damping terminates, reduced-motion cut, hidden-tab cancel)                                   | COMPLETE                            | `camera-math.ts:53-154`, `terrain-view.ts:349-378,409-505`; `tests/terrain-camera.test.ts` 22 pass                                                                                              |
| Sidecar parsing (strict, throws on missing)                                                                                         | COMPLETE                            | `src/engine/terrain/sidecar.ts:98-171`                                                                                                                                                          |
| Metrics (extent, relief, contour picker nice-set, legend ticks)                                                                     | COMPLETE                            | `metrics.ts:53-229`, `tests/terrain-metrics.test.ts` 31 pass                                                                                                                                    |
| Area registry (3 areas, per-area exaggeration 8/6/8, zoom factors)                                                                  | COMPLETE                            | `area-registry.ts:82-110`, test `terrain-metrics` + `dem-artifacts` pin manifest                                                                                                                |
| HUD terrain panel (area radios, exaggeration slider 1-30, contours checkbox, reset)                                                 | COMPLETE                            | `TerrainPanel.tsx:40-201`, native inputs, 44px targets                                                                                                                                          |
| Legend (numeric ticks, units, interval, always-visible exaggeration, `—` empty)                                                     | COMPLETE with 1 dead ternary        | `TerrainLegend.tsx:38-172`; dead `{atEdge?'':''}:138` (both branches empty)                                                                                                                     |
| Readout (pointer + keyboard-target, `—` unknown, 0.1 m formatting, aria-live polite)                                                | COMPLETE                            | `TerrainReadout.tsx:39-120`                                                                                                                                                                     |
| Attribution from sidecar verbatim + limitations                                                                                     | COMPLETE                            | `TerrainAttribution.tsx:22-91`                                                                                                                                                                  |
| Loading skeleton + distinct WebGL2/float/load errors + retry UI                                                                     | PARTIAL                             | `TerrainScene.tsx:114-174` renders states; retry dead after fatal (see §5); `terrain-view.ts:207-217,631-683`                                                                                   |
| Mode rail / lang toggle / honesty banner / skip link / focus ring                                                                   | COMPLETE (rail intentionally inert) | `ModeRail.tsx:56-87` disabled buttons; `LangToggle.tsx:20-69`; `App.tsx:112-159`; `base.css:51-55`                                                                                              |
| Bilingual strings (EN + AS, same shape, DRAFT-flagged) + glyph coverage test                                                        | PARTIAL                             | `strings.ts:129-304`, `ASSAMESE_COPY_STATUS='DRAFT':316`; `tests/fonts.test.ts` 13 pass; owner review open per `DECISIONS.md:110-124`                                                           |
| FLOW flood sim + erosion + channel migration                                                                                        | STUB                                | No `step()` exists; only `FlowParams` type `shared/types.ts:73-100` + `tests/flow-params.test.ts` contract test. Roadmap Phase 4 unstarted                                                      |
| FAULT quake timelapse + scrubber + ring + prediction notice                                                                         | STUB                                | Only `QuakeEvent` type `types.ts:57-70`; no catalogue (`src/data/quakes.ts` absent, ROADMAP Phase 2 unchecked); e2e honesty test for prediction text fails because string unrendered (§3)       |
| PLATES cinematic + boundary geometry                                                                                                | STUB                                | No code; `DATA.md:344-398` + `DECISIONS.md:126-138` forbid PB2002, decision deferred to Phase 2                                                                                                 |
| Engine typed API `EngineApi/createEngine/sampleAt/getSnapshot/on()`                                                                 | STUB                                | Documented `ARCHITECTURE.md:102-124` but no `src/shared/api.ts` / `src/engine/api.ts`; UI talks to `createTerrainView` directly via `useTerrainView.ts`                                         |
| Share cards / headless capture / deploy                                                                                             | STUB                                | Roadmap Phase 8; `getSnapshot()` type exists `types.ts:44-54` but no implementation                                                                                                             |
| Data sources beyond DEM                                                                                                             | PARTIAL                             | GLO-30 VERIFIED + shipped; ComCat VERIFIED-BY-OWNER but verbatim text still missing (`DATA.md:284-289`), no subset fetched; Natural Earth VERIFIED unused; NCS/IMD/ASDMA link-only by design    |

---

## 3. Current errors and warnings

### Commands actually run (trimmed; full log in Appendix)

| Command                                              | Result                           | Exact output (trim)                                                                                                                                                                                                                                                                      |
| ---------------------------------------------------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npx tsc --noEmit -p tsconfig.json`                  | PASS EXIT 0                      | no output (clean)                                                                                                                                                                                                                                                                        |
| `npx eslint .`                                       | PASS EXIT 0                      | no output (clean)                                                                                                                                                                                                                                                                        |
| `npx prettier --check .`                             | PASS EXIT 0                      | `Checking formatting... All matched files use Prettier code style!`                                                                                                                                                                                                                      |
| `npx vitest run`                                     | PASS 119/119 EXIT 0              | `Test Files 8 passed (8), Tests 119 passed`, dem-artifacts prints Sadiya 129.90 m → Dhubri 26.55 m etc.                                                                                                                                                                                  |
| `npx vite build`                                     | PASS EXIT 0 with 1 warning       | `✓ built in 7.36s`; `[plugin builtin:vite-reporter] (!) Some chunks are larger than 300 kB after minification` (three `470.25 kB │ gzip 116.80 kB`); assets: `index 66.18 kB (21.34 gzip)`, `react 139.82 (45.32)`, `three 470.25 (116.80)`, CSS `53.75 (20.92)`, PNGs 2.04/2.32/3.88 MB |
| `npm audit --audit-level=low`                        | PASS 0 vulns                     | `found 0 vulnerabilities`                                                                                                                                                                                                                                                                |
| `node scripts/check-contrast.mjs`                    | 2 FAIL (documented exception)    | `terrain-1 #1C3B35 on bg 1.58:1 (needs 3:1)`, `water-deep #0E5A73 2.50:1`; `2 of 24 pairs FAIL` + suggested `#4B645F (3.01)`, `#21677E (3.03)`; script deliberately does not auto-modify                                                                                                 |
| `npm outdated`                                       | info only                        | `motion 11.18.2→13.5.0`, `lucide-react 0.469→1.49`, `three 0.171→0.186.1`, `react 18.3.1→19.3.0`, `typescript 5.9.3→7.0.2`, `eslint 9.39.5→10.11.0`, etc. (full table Appendix)                                                                                                          |
| `npx playwright test --project=a11y`                 | **FAIL 11 pass / 4 fail EXIT 1** | 4 failures below                                                                                                                                                                                                                                                                         |
| `npx playwright test --project=a11y -g "has one h1"` | PASS                             | `1 passed (4.8s)` — shell landmarks still hold                                                                                                                                                                                                                                           |

### E2E failures (exact, `e2e/accessibility.spec.ts`)

1. `290:3 language toggle → Assamese` — `expect(locator).toHaveAttribute failed, Locator: getByTestId('assamese-phrase'), Expected: "as", Error: element(s) not found`. The test looks for `assamese-phrase` from Phase 1; `App.tsx` no longer renders it.
2. `306:3 required Assamese phrase, no tofu` — `Test timeout 30000ms exceeded, waiting for getByTestId('assamese-phrase')`. Same stale selector.
3. `335:3 honesty disclaimer` — `getByText(/earthquakes cannot be predicted/i) Expected: visible, element(s) not found`. String exists `strings.ts:152-154` but is never rendered (FAULT unbuilt; banner shows `disclaimerShort` + `terrainIllustrativeNote` only `App.tsx:140-156`).
4. `340:3 canvas empty-state` — `getByRole('heading',{level:2}) strict mode violation: resolved to 2 elements (Elevation ×2)` + expects `phase-label /phase 1 of 8/` which no longer exists. Spec asserts placeholder; app ships `terrain-legend` + `terrain-readout`.

Note: `npm run verify` does **not** run `e2e`, so verify is green while the browser suite is red. That is the gap to close, not a flaky browser.

### Runtime / console

- `a11y` run: `renders without console errors` passed (1/15). No unhandled rejection, no WebGL failure on Desktop Chrome (SwiftShader). No NaN crash observed in the automated run.
- `UNVERIFIED` on real low-end Android GPU, on `float-texture-unsupported` path, and on offline/fetch-fail paths — no device lab run in this audit. Code paths exist (`terrain-view.ts:237-243,676-682`) but were not exercised here.
- Deprecation warnings: none in `vitest`/`vite build` output beyond the chunk-size warning. `UNVERIFIED` for `dev` HMR console (not captured).

---

## 4. Dead code and unused material

| Location                                                                                                                          | What                                                                                                                                                                                                                                                          | Recommendation                                                                                              |
| --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `package.json:37` `motion ^11.15.0` — zero `from 'motion'` imports (grep §Appendix)                                               | Unused dependency (~SHIP weight, outdated 11.18.2→13.5.0)                                                                                                                                                                                                     | **Safe to delete** until Phase 6 needs it; re-add when cinematic lands                                      |
| `src/ui/terrain/TerrainLegend.tsx:129,138` `const atEdge = ...; {atEdge ? '' : ''}`                                               | Dead ternary, both branches `''`; `atEdge` computed for nothing                                                                                                                                                                                               | **Safe to delete** the expression (keep `key={value}`)                                                      |
| `src/shared/i18n/strings.ts:48-49,70-71,142-144,159-161,228-232,250-253` `canvasEmptyTitle/Body`, `phaseLabel/Body`               | Strings for the Phase-1 placeholder; unrendered since `TerrainScene` replaced it (`App.tsx` has no reference)                                                                                                                                                 | **Needs check**: delete when e2e placeholder specs are retired, or keep 1 cycle as deprecated               |
| `src/shared/types.ts:13-14` `MODES`, `28-54` `TerrainSample/EngineSnapshot`, `57-70` `QuakeEvent`, `96-100` `DEFAULT_FLOW_PARAMS` | Future-phase contract, consumed only by `flow-params.test.ts` + docs                                                                                                                                                                                          | **Keep** (contract + honesty guard), but mark clearly as pre-implementation; do not expand until sim exists |
| `src/engine/terrain/sampling.ts:101` `sampleNearest`                                                                              | Exported, tested (`terrain-sampling.test.ts:180`), never called in prod (`terrain-view.ts` uses `sampleBilinear` only)                                                                                                                                        | **Needs check**: keep as tested utility or delete prod export if truly unneeded                             |
| `src/engine/terrain/metrics.ts:229` `gridToWorld`, `camera-math.ts:157` `DEG`, `area-registry.ts:117` `areaDefinition` (singular) | Exported via barrel `index.ts`, used only in tests or once                                                                                                                                                                                                    | **Keep** (barrel API), no action                                                                            |
| `src/ui/terrain/assets.ts:85-87` `availableAreas()`                                                                               | Exported, never called (picker uses `AREA_IDS` from `@engine/terrain` in `TerrainPanel.tsx:72`)                                                                                                                                                               | **Safe to delete** or wire picker to it                                                                     |
| `src/ui/state/useUiStore.ts:16,25` `mode` + `setMode`                                                                             | State exists, default `'plates'`; `setMode` never called (grep: only definition); `ModeRail` buttons `disabled`                                                                                                                                               | **Keep** (Phase 4-6 will need it) but note it is write-only dead today                                      |
| `src/data/.gitkeep`, `src/engine/.gitkeep`, etc.                                                                                  | Placeholder keeps                                                                                                                                                                                                                                             | Keep                                                                                                        |
| CSS                                                                                                                               | No unused CSS found by inspection; `tokens.css` all consumed via `var(--*)`; `review.mjs` reports spacing/motion but was not run against live DOM here                                                                                                        | No action; consider wiring `review.mjs` into CI if useful                                                   |
| Assets                                                                                                                            | `data/raw/previews/*.png` 2.19/3.34/5.47 MB on disk, correctly **not** committed (`git ls-files` has no `data/raw/*` except `.gitkeep`); `docs/screenshots/placeholder-*` 4 files stale (see §7)                                                              | Previews: keep ignored. Screenshots: regenerate via `shots` after spec fix                                  |
| Dependencies duplicate/unused                                                                                                     | `geotiff`, `pngjs`, `@types/pngjs` are pipeline-only but in `devDependencies` — correct (pipeline runs on dev machine, not browser). `axe-core`, `jsdom` test-only — correct. No duplicates in `package-lock`. `allowScripts` pins esbuild only — intentional | No action except `motion`                                                                                   |
| Debug / `console.log`                                                                                                             | `src/`, `tests/` (non-script), `e2e/` have **zero** `console.log` (grep: only `scripts/*` + `tests/dem-artifacts` informational prints). No `TODO/FIXME/HACK` in code (grep clean)                                                                            | No action; `tests/dem-artifacts.test.ts:372,417,478` prints are test diagnostics, acceptable                |
| Comments                                                                                                                          | No commented-out blocks found in `src/` (spot-checked `terrain-view`, `App`, `TerrainScene`)                                                                                                                                                                  | No action                                                                                                   |

Hex discipline: `index.html:11` `content="#0A0F14"` is **uppercase**, violating `AGENTS.md §8` lowercase rule (`tokens.css:8` is `#0a0f14`). `scripts/check-contrast.mjs:16-30` uppercase is the verbatim TOKENS block the checker itself prints (exception allowed); `DESIGN.md:323-326` uppercase is quoted tool output (allowed). Fix only `index.html`.

---

## 5. Missing pieces

1. **FLOW sim absent** — Roadmap Phase 4: no `step(sim,params)→sim`, no inflow control, no erosion, no accumulator, no modelled-vs-scenario labelling in UI (labels exist in types only). `TerrainSample.dischargeM3s` type exists but nothing writes it.
2. **FAULT data + UI absent** — no `src/data/quakes.ts`, no `scripts/build-quakes.ts`, no timeline/scrubber/ring/notice; prediction disclaimer string unrendered (§3 failure 3). ComCat cleared (`DECISIONS §2`) but verbatim licence text still not pasted (`DATA.md:284-289`).
3. **PLATES source undecided** — `DATA.md:390-394` + `ROADMAP Phase 2`: licensed source vs own tracing. Nothing ships; correct to block, but it blocks Phase 6.
4. **Independent elevation validation** — open gap carried Phase 2→3 (`ROADMAP:59-62,127`; `DATA.md §13`): tests are self-consistency + 2 loose plausibility checks, one on tertiary source. Needs Survey of India / GSI levelling (licence unverified).
5. **Byte-identical rebuild unverified** — artefacts migrated not rebuilt (`manifest.json:359-367` `pipelineRebuilt:false, reproducibilityVerified:false`; `ROADMAP:120-126`). One-area rebuild + hash compare still unchecked.
6. **Input SHA-256 of tile windows** — `ROADMAP:53-58`: manifest hashes outputs only; upstream silent change indistinguishable from pipeline fault.
7. **Error handling gaps** — fatal-retry dead (§4); `fetchJson`/`fetchTerrainRgba` throw generic `Error(fetch … HTTP)` with no timeout/abort (`terrain-view.ts:914-954`); `canvas.setPointerCapture` unguarded (`442`); `OffscreenCanvas` fallback touches `globalThis.document` without SSR guard (`962`). Partial/offline states from `ARCHITECTURE §5` not all reachable in UI (no partial-retry per part, no offline copy).
8. **Loading/empty states** — loading skeleton + `—` empty exist; no per-part retry, no stale-while-revalidate, no progress % (API promises `on('load')` progress, unimplemented).
9. **Input validation** — `clampExaggeration` handles NaN (`area-registry.ts:138-145`); sidecar strict; but URL/area-id from store not validated against `isAreaId` on load path (`useTerrainView.loadArea` trusts caller).
10. **Tests missing** — no FLOW/FAULT/PLATES tests (nothing to test yet — correct); no e2e for terrain states (loading/error/retry/contours/exaggeration/area switch); no perf/FPS test; no offline test.
11. **Docs missing** — `README` stub (§7); no `CONTRIBUTING`; no offline/PWA note; `ARCHITECTURE §8 Invariants` lists 10 rules but only ~4 have tests/lint (React-free, hex-free tested; i18n parity, spacing, focus-ring, file-size have partial tests).
12. **LICENSE present** (`LICENSE` MIT, `package.json:6`) — not missing. Attribution strings live in sidecar + `DATA.md §10`, rendered — good.
13. **A11y gaps** — automated axe passes on current suite, but suite is stale; keyboard walk passes for shell; terrain canvas keyboard orbit exists but no e2e asserts area-switch/exaggeration/contour operability; `TerrainScene.tsx:99` canvas `focus-visible:outline-2` relies on global ring — verified present.
14. **Mobile/touch** — pinch + responsive layout exist (`terrain-view.ts:464-470`, `TerrainScene.tsx:177-216`); `UNVERIFIED` on real 390px GPU + touch lab (only Playwright Pixel 7 emulation in config, not run here beyond a11y which passed overflow/overlap checks).
15. **WebGL-absent fallback** — error panel exists (`TerrainScene.tsx:139-174`) but is an overlay on a fixed canvas, not the "static informative panel + data view" `ARCHITECTURE §5` promises; no non-WebGL data table.

---

## 6. What should be better

### Code quality / architecture

- **ARCH doc vs code drift is the biggest smell.** `ARCHITECTURE.md` describes a finished 3-mode system; code is terrain-only. Split the doc: keep §§1-2,7 as built, move `EngineApi`/`water|quake|plates` to "planned" or gate on Phase. Evidence: missing files list §1.
- **God file forming:** `terrain-view.ts` 864 lines owns renderer + camera + input + loading + probing + sizing. It is well-commented and the split (pure math/metrics/sampling out) is right, but the next feature (water) must not land here. Extract `camera-controls.ts` + `loader.ts` when touching it next.
- **Duplicated exaggeration state:** `useTerrainView` holds `exaggeration` + `areaId` in React **and** `terrain-view` holds them internally; they sync via setters but can drift (area switch resets both paths `useTerrainView.ts:120-130` + `terrain-view.ts:738`). Single-source (engine emits, React mirrors) would remove a class of bugs.
- **`attachCanvas` timing is fragile:** view created in `useEffect[]` reading `canvasRef.current` set by callback ref (`useTerrainView.ts:77-106,116-118`). Works today (ref fires before effect) but breaks under Suspense/remount. Create on callback-ref directly, or guard with state.
- **Magic numbers:** `TerrainScene.tsx:62` 700 ms camera-target delay, `terrain-view.ts:461-463` 0.4 px/deg, `488-491` wheel `0.0012`, fog `0.55/1.6`, ambient `0.45` — each justified in comments, but none is a named export with a test. Promote the 2-3 that affect honesty (probe refinement, fog) to constants.
- **`atEdge` dead code** (§4) suggests review pressure; add the existing `review.mjs` to CI or delete it if unused.

### Performance

- Measured (build log): JS `index 66.18 (21.34 gzip)` + `react 139.82 (45.32)` + `three 470.25 (116.80)` = **~183.5 KB gzip JS + 20.9 CSS**, under the 300 KB gzip budget. Raw `three` 470 KB trips the 300 KB chunk warning — expected for Three, mitigated by `manualChunks` (`vite.config.ts:25-29`). No JS budget test exists; add one (assert gzip <300 KB in `dem-artifacts`-style test) before Phase 4 adds water state.
- Terrain: 1 draw call, 263k verts (513²), R32F 4.75/8.07/12.49 MiB GPU (25.3 total, one resident — dispose on switch `terrain-view.ts:690`). Wire 1.94/2.21/3.70 = 7.86 MB, just under the 8 MB transfer budget. Idle 0 fps (render-on-demand). This is good engineering; the risk is Phase 4 water doubling GPU without a budget.
- Per-frame allocs: `onFrame` allocates nothing visible; `publishProbeFromPointer` + `gridFromNdc` allocate small objects per pointermove — fine. `fetchTerrainRgba` transient `Uint8ClampedArray` ~13 MB for the largest area + `Float32Array` heights — acceptable, but large-area switch on 390px still decodes full res. Pull ARCH §6 lever 1 next: decode at reduced res on small screens (or `createImageBitmap resize`), behind a test.
- `UNVERIFIED`: FPS on mid-range Android, memory under area-switch thrash, `OES_texture_float_linear` absence path (hand bilinear avoids it — good).

### Simulation correctness / realism

- No sim to audit — correct to say so. The honesty scaffolding is right: `scenarioInflowM3s` naming + `NOT an observed discharge` doc (`types.ts:74-82`), `DEFAULT_FLOW_PARAMS` documented arbitrary (`91-99`), `dischargeM3s` flux marked scenario-derived never-measured (`32-40`), DSM-no-bathymetry + LE90 1.472 m limits in sidecar/`DATA.md §12`.
- When FLOW lands: fix timestep accumulator (ARCH §6 requires it for determinism), units in m³/s + Manning n documented, seed any synthetic variation with named generator (lint already bans `Math.random` `eslint.config.js:95-102`), keep `—` for unknown, never station/gauge/date in FLOW UI (`DECISIONS §7`).

### UX / UI

- Mode rail honest (disabled + `Not built yet`) — keep until modes exist; then enable one at a time with real e2e.
- Exaggeration always visible (legend + slider + area default) — exemplary. Contours true-altitude — exemplary.
- Missing: onboarding ("what do I drag?"), area descriptions (sidecar `description` unrendered — check `TerrainAttribution` renders attribution+limitations but not `description`), scale bar / north arrow, units on probe coords (°N/°E present — good).
- Reduced motion: camera cut + CSS kill-switch present (`base.css:103-112`); seismic ring N/A yet. Verify with OS setting in e2e when FAULT lands.

### Security / dependency health

- `npm audit`: 0 vulns. No secrets in repo (grep for `apiKey|secret|token` — only pointer `loadToken` + palette `token()` naming, no credentials; `.env` gitignored, none committed).
- External requests: build-time S3 `copernicus-dem-30m.s3.amazonaws.com` over HTTPS in `manifest.json:51+`; runtime only same-origin `?url` assets. No CDN fonts/scripts (verified `base.css`, no `http` imports in `src/`).
- Outdated majors exist (`react 19`, `three 0.186`, `eslint 10`, `motion 13`) — do not chase during foundation; pin as now, revisit Phase 7. `motion` should be removed, not upgraded, until needed.

### Build / deploy readiness

- `vite build` green; `base`-aware `?url` assets verified by doc (`ARCHITECTURE.md:375-379`) but **not re-verified here** — `UNVERIFIED` for `--base=/fault-and-flow/` in this audit (doc claims verified; rerun 1 command to confirm before Pages deploy).
- `dist/` gitignored (correct); no `gh-pages` config yet (correct for Phase 3).
- `.gitignore` works (PNGs tracked via `!` exceptions, previews/cache excluded) but is fragile: `data/processed/*` ignored then re-included per-file (`14-32`). One new area without a matching `!` line silently vanishes from git. Replace with explicit allowlist + test (the `dem-artifacts` size test already asserts presence — extend it to assert `git ls-files` match, or simplify ignore to `data/processed/**` + `!` per area pattern `!data/processed/*.png` capped by size test).

---

## 7. Repo and presentation quality

| Item               | Verdict               | Evidence                                                                                                                                                                                                                                                                                                                                                     |
| ------------------ | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| README             | **STALE — fix today** | `README.md:12-13` "no simulation and no 3D scene yet"; `:49-51` "Not done: terrain, water, earthquakes, plates" — terrain shipped Phase 3. Install/run table `:57-72` still correct. Screenshot `:55` is `placeholder-desktop-en` only                                                                                                                       |
| Screenshots        | STALE                 | `docs/screenshots/` has `placeholder-{desktop,mobile}-{en,as}.png` + `.gitkeep`; no terrain capture; `screenshots.spec.ts:49,62` still writes `placeholder-*` names                                                                                                                                                                                          |
| Install/run        | GOOD                  | `npm install` (node_modules present), `npm run dev` serves (Playwright webServer booted it twice), `verify` green                                                                                                                                                                                                                                            |
| Folder cleanliness | GOOD                  | No `node_modules`/`dist` committed; `data/raw/previews` on disk but ignored; 9 MB `data/processed` PNGs intentional + budgeted                                                                                                                                                                                                                               |
| Commit hygiene     | GOOD with 1 note      | `git log --oneline -15`: conventional (`fix:`, `feat:`, `docs:`, `test:`, `chore:`), imperative, scoped; one commit per task visible. Note: audit ran on `fix/terrain-nodata` branch, not `main` — merge + delete after review                                                                                                                               |
| `.gitignore`       | WORKS BUT FRAGILE     | See §6; `dist/`, `coverage/`, `test-results/`, `data/raw/*`, `.env` correct                                                                                                                                                                                                                                                                                  |
| File size ceiling  | PASS                  | `git ls-files` PNGs 1.94/2.21/3.70 MB each <5 MB; total 7.86 MB <9 MB budget asserted `tests/dem-artifacts.test.ts`                                                                                                                                                                                                                                          |
| Resume-worthy?     | YES, after 3 fixes    | The DEM honesty trail (`DATA.md` verbatim licences, `DECISIONS.md` reversals, no-data migration with ULP analysis) + headless-tested renderer is standout. To stand out more: (a) fix README + screenshots, (b) green e2e, (c) one 30-sec terrain clip at 390px showing exaggeration label + probe. Do not add spectacle before honesty checks (§6 PRODUCT). |

---

## 8. Prioritized action plan

| ID  | Issue                                                         | Severity | Effort | Files affected                                             | Suggested fix                                                                                                                                                                                                                  |
| --- | ------------------------------------------------------------- | -------- | ------ | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A1  | E2E `a11y` 4/15 red (stale placeholder selectors)             | Critical | S      | `e2e/accessibility.spec.ts`, `e2e/screenshots.spec.ts`     | Rewrite specs for terrain app: drop `assamese-phrase`/`phase-label`/single-h2; assert lang toggle via `data-locale`, honesty banner, legend ticks, area radios, canvas keyboard. Rename shots to `terrain-*`, keep both widths |
| A2  | README claims no 3D/terrain                                   | High     | S      | `README.md:9-13,47-55`                                     | Rewrite Status + What-it-is: Phase 3 terrain shipped, FLOW/FAULT/PLATES not; link ROADMAP; swap screenshot to terrain 1440+390                                                                                                 |
| A3  | Fatal-retry button dead (view null)                           | High     | S      | `src/ui/terrain/useTerrainView.ts:89-150`                  | Recreate view on retry (extract `createView(canvas)` fn, call from effect + retry); e2e: force `webgl2-unavailable` via stub, assert retry re-attempts                                                                         |
| A4  | `motion` unused dep                                           | Medium   | S      | `package.json:37`, lockfile                                | `npm uninstall motion`; re-add in Phase 6. Verifies no import breaks (`lint`+`build`)                                                                                                                                          |
| A5  | ARCH doc describes unbuilt EngineApi/water/quake/plates       | High     | S      | `docs/ARCHITECTURE.md:50-57,94-136,256-267`                | Mark §§3-4,7-table as `Planned (Phase 4+)`; keep built terrain §§7,9 as `Built`. One docs commit                                                                                                                               |
| A6  | `index.html:11` uppercase `#0A0F14` vs lowercase rule         | Low      | S      | `index.html:11`                                            | Lowercase to `#0a0f14`; `design-tokens-sync` already enforces css side                                                                                                                                                         |
| A7  | Legend dead ternary `{atEdge?'':''}`                          | Low      | S      | `src/ui/terrain/TerrainLegend.tsx:129-139`                 | Delete; if edge-anchoring needed, implement `translateX` clamp with test                                                                                                                                                       |
| A8  | `availableAreas()` unused; picker uses `AREA_IDS`             | Low      | S      | `src/ui/terrain/assets.ts:85-87`, `TerrainPanel.tsx:72`    | Delete helper or switch picker to it (one source)                                                                                                                                                                              |
| A9  | No JS budget test; three chunk warns                          | Medium   | S      | `vite.config.ts:18`, `tests/`                              | Add `tests/bundle-budget.test.ts`: parse `dist` gzip or assert `manualChunks` + `<300KB gzip` initial (mirror dem-artifacts pattern)                                                                                           |
| A10 | `.gitignore` data/processed fragile allowlist                 | Medium   | S      | `.gitignore:14-32`                                         | Simplify to `data/processed/**` + `!*.json !*.png !README !.gitkeep` + keep size test as guard                                                                                                                                 |
| A11 | Byte-rebuild + input-hash gaps                                | High     | M      | `scripts/build-dem.ts`, `manifest.json`, `ROADMAP Phase 2` | Rebuild one area (majuli, 4 tiles) `npm run data:dem`, compare SHA; record `pipelineRebuilt`; decide raw-window hash (range+bytes)                                                                                             |
| A12 | Independent elevation validation                              | High     | L      | `docs/DATA.md §13`, `tests/dem-artifacts`                  | Seek SoI/GSI benchmark (licence first); add as `UNVERIFIED`-gated test, not blocker for Phase 4                                                                                                                                |
| A13 | ComCat verbatim text missing                                  | Medium   | S      | `docs/DATA.md:284-289`, `DECISIONS.md §2`                  | Owner paste of crediting page text (1 copy-paste); then fetch subset + `build-quakes.ts`                                                                                                                                       |
| A14 | Terrain e2e coverage (area/exaggeration/contours/probe/error) | High     | M      | `e2e/`                                                     | Add: area switch changes legend ticks; slider updates `legend-exaggeration`; contours toggle shows interval; probe `aria-live`; stubbed 404 → error + retry                                                                    |
| A15 | Fetch robustness (timeout/abort, pointer-capture guard)       | Medium   | S      | `terrain-view.ts:442,914-954,958-966`                      | `AbortController` + 15 s timeout per fetch; guard `setPointerCapture` in try; document offline copy                                                                                                                            |
| A16 | Exaggeration dual-source + attach timing                      | Medium   | M      | `useTerrainView.ts:64-118`, `terrain-view.ts:738`          | Engine-emits/React-mirrors; create view in ref callback; test remount                                                                                                                                                          |

**Fix today:** A1, A2, A4, A6, A7.
**Fix this week:** A3, A5, A8, A9, A10, A13, A14, A15.
**Later / nice to have:** A11, A12, A16 + Phases 4-6 features, Pages base re-verify, real-device FPS lab, onboarding/scale-bar/north-arrow, per-part partial retry, progress %.

---

## 9. Appendix

### A. Commands + trimmed outputs

```
$ npx tsc --noEmit -p tsconfig.json        → EXIT 0 (clean)
$ npx eslint .                              → EXIT 0 (clean)
$ npx prettier --check .                    → All matched files use Prettier code style! EXIT 0
$ npx vitest run                            → 8 passed, 119 passed in 4.42s EXIT 0
    dem-artifacts prints: Sadiya 129.90 / Dibrugarh 107.10 / Jorhat 93.00 / Guwahati 65.25 / Barpeta 39.90 / Dhubri 26.55 m
    majuli centre 87.4 m (published 87.5 ±30), Sadiya 127.3 (published 123 ±30)
$ npx vite build                            → ✓ built in 7.36s EXIT 0; 1598 modules
    dist/assets/index 66.18 kB (21.34 gzip), react 139.82 (45.32), three 470.25 (116.80),
    css 53.75 (20.92); PNGs 2.04/2.32/3.88 MB; warning: Some chunks >300 kB
$ npm audit --audit-level=low               → found 0 vulnerabilities EXIT 0
$ node scripts/check-contrast.mjs            → 22 pass / 2 FAIL (documented): terrain-1 1.58:1, water-deep 2.50:1 EXIT 0
$ npx playwright test --project=a11y        → 11 passed, 4 failed EXIT 1 (failures §3 verbatim)
$ npx playwright test --project=a11y -g "has one h1" → 1 passed EXIT 0
$ git log --oneline -15                     → 7a96027 fix(data)… / 36a8366 docs(terrain)… / 7936a59 feat(terrain)… (+12 more, conventional)
$ git status --short                       → clean; branch fix/terrain-nodata
$ npm outdated                              → see table B
```

`npm run verify` was **not** re-run as one command (it chains the five green steps above); equivalent result: PASS excluding e2e (e2e is not in `verify` by design `package.json:24`).

### B. Dependencies (outdated / vulnerable)

`npm audit`: 0 vulnerabilities (2026-10-02).

`npm outdated` (Current → Latest): `@eslint/js 9.39.5→10.0.1`, `@types/node 26.6.3→26.6.4`, `@types/react 18.3.31→19.3.0`, `@types/react-dom 18.3.7→19.3.0`, `@types/three 0.171.0→0.186.0`, `eslint 9.39.5→10.11.0`, `eslint-config-prettier 9.1.2→10.1.8`, `globals 15.15.0→17.13.0`, `jsdom 25.0.1→30.1.1`, `lucide-react 0.469.0→1.49.0`, `motion 11.18.2→13.5.0` (remove, don't upgrade), `react 18.3.1→19.3.0`, `react-dom 18.3.1→19.3.0`, `three 0.171.0→0.186.1`, `typescript 5.9.3→7.0.2`, `vite 8.3.1→8.3.2`. No action recommended now except removing `motion`.

Direct deps (11): fontsource×4, lucide-react, motion (dead), react, react-dom, three, zustand. Dev (16): eslint×3, playwright, tailwind×2, types×4, vite plugin, axe-core, geotiff, globals, jsdom, pngjs, prettier, tailwindcss, typescript, vite, vitest.

### C. File tree (`git ls-files`, 78 entries, trimmed sizes)

```
index.html, package.json/lock, vite/tsconfig/vitest/playwright/eslint/prettier configs
src/main.tsx (366 B), shared/types.ts (3.5 KB), shared/i18n/strings.ts (14.8 KB)
src/engine/terrain/*.ts (10 files, ~90 KB total; largest terrain-view.ts 33 KB/864 lines)
src/ui/*.tsx/*.ts (App 6.3 KB, ModeRail 3.8 KB, LangToggle 3.0 KB, useUiStore 0.8 KB, terrain/* ~30 KB)
src/ui/styles/{tokens,base}.css (~5.7 KB)
scripts/build-dem.ts (34.5 KB), migrate-nodata-encoding.ts (14 KB), check-contrast.mjs (10 KB), dem-areas.ts (9.5 KB), review.mjs (5.2 KB)
tests/*.test.ts (8 files, ~80 KB), e2e/*.spec.ts (16 KB)
data/processed/*.png 1.94+2.21+3.70 MB + *.json + manifest.json 15 KB
docs/*.md (ARCH 469 lines, DATA 773+ lines, DECISIONS 325, ROADMAP 270, DESIGN 395, PRODUCT 262)
LICENSE (MIT), README.md, AGENTS.md
```

`dist/` (build output, ignored): JS ~676 KB raw / ~184 KB gzip + CSS 54 KB raw; PNG assets copied hashed.

### D. Line counts per major module (src+tests+scripts+e2e, `Measure-Object -Line`)

| File                                  | Lines  | Notes                                               |
| ------------------------------------- | ------ | --------------------------------------------------- |
| src/engine/terrain/terrain-view.ts    | 864    | renderer+camera+input+loading — split on next touch |
| scripts/build-dem.ts                  | 824    | pipeline                                            |
| tests/dem-artifacts.test.ts           | 530    | artefact assertions                                 |
| e2e/accessibility.spec.ts             | 318    | STALE — rewrite (A1)                                |
| scripts/migrate-nodata-encoding.ts    | 317    | one-shot migration                                  |
| tests/terrain-metrics.test.ts         | 311    |                                                     |
| src/engine/terrain/decode-terrain.ts  | 300    | headless decoder                                    |
| src/shared/i18n/strings.ts            | 284    | EN+AS                                               |
| scripts/check-contrast.mjs            | 284    |                                                     |
| tests/helpers/woff2.ts                | 264    | font parse                                          |
| tests/terrain-sampling.test.ts        | 262    |                                                     |
| scripts/dem-areas.ts                  | 225    |                                                     |
| src/engine/terrain/metrics.ts         | 213    |                                                     |
| src/engine/terrain/shaders.ts         | 206    | ESSL1                                               |
| src/ui/terrain/TerrainScene.tsx       | 204    | states+HUD                                          |
| tests/terrain-camera.test.ts          | 200    |                                                     |
| src/ui/terrain/useTerrainView.ts      | 189    | binding (fragile attach)                            |
| src/ui/terrain/TerrainPanel.tsx       | 188    |                                                     |
| tests/design-tokens-sync.test.ts      | 169    |                                                     |
| tests/fonts.test.ts                   | 161    |                                                     |
| src/ui/terrain/TerrainLegend.tsx      | 161    | incl. dead ternary                                  |
| src/ui/App.tsx                        | 157    | shell+banner                                        |
| src/engine/terrain/sidecar.ts         | 155    | strict parser                                       |
| src/engine/terrain/camera-math.ts     | 142    |                                                     |
| src/engine/terrain/area-registry.ts   | 135    |                                                     |
| tests/engine-architecture.test.ts     | 133    | React/hex guards                                    |
| src/ui/terrain/TerrainReadout.tsx     | 110    |                                                     |
| src/engine/terrain/sampling.ts        | 109    | bilinear+nearest                                    |
| src/ui/ModeRail.tsx                   | 94     | disabled by design                                  |
| src/shared/types.ts                   | 91     | future contract                                     |
| tests/flow-params.test.ts             | 90     | honesty guard                                       |
| src/engine/terrain/index.ts           | 90     | barrel                                              |
| src/ui/terrain/TerrainAttribution.tsx | 83     | sidecar-verbatim                                    |
| src/engine/terrain/terrain-rgb.ts     | 82     | constants                                           |
| src/ui/terrain/assets.ts              | 79     | ?url + palette                                      |
| src/ui/styles/tokens.css              | 70     | source of truth                                     |
| src/ui/LangToggle.tsx                 | 65     | radio group                                         |
| Total src                             | ~4,200 | engine ~1,900 / ui ~1,800 / shared ~400             |

### E. Evidence index (spot file:line)

- No React in engine: `eslint.config.js:41-70`, `tests/engine-architecture.test.ts:56-124` pass
- No hex in engine: same test `:108-123` pass; `index.html:11` uppercase exception noted
- `Math.random` ban: `eslint.config.js:95-102`, zero hits in `src/` (grep §4)
- Provenance: `shared/types.ts:21-25`, honesty docs `PRODUCT.md:66-145`
- DPR/budget: `terrain-view.ts:68-69`, `ARCHITECTURE.md:230-242`, build log §A
- Decode options load-bearing: `terrain-view.ts:931-954`, `ARCHITECTURE.md:170-190`
- Migration lossless + unverified rebuild: `manifest.json:359-367`, `DECISIONS.md:258-310`, `ROADMAP:120-128`
- DRAFT Assamese: `strings.ts:10-26,215,316`, `DECISIONS.md:110-124`
- Disabled rail honest: `ModeRail.tsx:56-69`
- Retry dead: `useTerrainView.ts:89-95,120-130,148-150`
- Stale e2e selectors: `e2e/accessibility.spec.ts:290-344` vs `App.tsx`/`TerrainScene.tsx`
- Stale README: `README.md:12-13,49-51` vs `ROADMAP Phase 3` + `terrain-view.ts`
- Unused motion: `package.json:37` vs zero imports (grep)
- Dead ternary: `TerrainLegend.tsx:138`
- Unused helper: `assets.ts:85-87` vs `TerrainPanel.tsx:72`
- Unset mode: `useUiStore.ts:16,25` vs zero `setMode` calls (grep)

---

_End of audit. Only `AUDIT_REPORT.md` was created. All else read-only._
