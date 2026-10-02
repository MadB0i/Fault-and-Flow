# ROADMAP

Eight phases. **We are in Phase 1.** Do not start a later phase unprompted — see
`AGENTS.md` §10.

Each phase lists what must be true before it is called done. Phases 2–8 are written as
intent, not permission.

---

## Phase 1 — Foundation ✅ _in progress_

**Goal:** a repository that another engineer can run, and a design system that can be
trusted.

- [x] Repo scaffold, MIT licence, `.gitignore`, 5 MB file ceiling enforced
- [x] `AGENTS.md` — binding rules for agents
- [x] `PRODUCT.md` — audience, goals, non-goals, honesty rules, success criteria
- [x] `DESIGN.md` — tokens, rationale, computed contrast table, anti-patterns
- [x] `docs/ARCHITECTURE.md` — engine/UI split, typed API contract, data flow
- [x] `docs/DATA.md` — sources researched, licences quoted or marked `UNVERIFIED`
- [x] `docs/ROADMAP.md` — this file
- [x] `docs/DECISIONS.md` — owner decisions of record, dated, each with a reversal condition
- [x] Tooling: Vite + strict TS, ESLint flat config, Prettier, Tailwind, Vitest, Playwright
- [x] `npm run verify` green
- [x] Placeholder page proving the design system
- [x] Assamese glyph coverage verified against the shipped font file
- [x] Screenshots at 1440px and 390px in `docs/screenshots/`

**Done when:** a clean clone passes `npm run verify`, and the placeholder page renders
Fraunces, Instrument Sans, JetBrains Mono, and correct Assamese.

---

## Phase 2 — Data pipeline

**Goal:** real, licensed, reproducible data on disk. No rendering yet.

- [x] Fetch Copernicus DEM GLO-30 tiles for the Brahmaputra valley into `data/raw/`
      (gitignored) — over HTTP range requests against the anonymous AWS Open Data mirror,
      reading the cheapest COG overview that still supports the output grid (`DATA.md` §1)
- [x] Clamp, reproject, and resample to committed artefacts under the 5 MB ceiling — three
      areas as Terrain-RGB PNG plus a JSON sidecar: `assam-overview`, `majuli`,
      `sadiya-dibrugarh` (`DATA.md` §13, `DECISIONS.md` §8)
- [x] Attach the **mandatory** Article 6(b) "produced using Copernicus WorldDEM-30"
      attribution to every processed file — in each sidecar and in `manifest.json`
- [x] `scripts/build-dem.ts` — deterministic; writes `data/processed/manifest.json` with
      source URLs, tile IDs, SHA-256 of outputs, tool versions, attribution and
      licence. `npm run data:dem` rebuilds from scratch, `--check` runs the landmark
      assertions alone, `--previews` writes throwaway hillshades to `data/raw/previews/`
- [x] Headless decoder in `src/engine/terrain/` — PNG bytes to `Float32Array` plus
      metadata, no DOM and no React, no-data as `NaN` plus an explicit mask
- [ ] **Record SHA-256 of the input tile windows.** `manifest.json` records the SHA-256 of
      every output and identifies each source tile by ID and URL, but the bytes fetched
      over HTTP range requests are not hashed, so a silent upstream change cannot be
      distinguished from a pipeline fault. Needs a decision on whether to hash the raw
      window, the containing tile, or both — hashing a range request is only meaningful
      alongside the exact byte range it covered
- [ ] **Independent elevation validation is still missing.** The committed tests assert
      GLO-30 self-consistency and two loose plausibility checks; a real check needs benchmark
      levelling from the Survey of India or GSI, which we do not hold and have not verified a
      licence for (`DATA.md` §13, open gap)
- [ ] Fetch a quake subset for NE India and compile to `src/data/quakes.ts`
- **ComCat is unblocked** — terms read by the owner 2026-10-01, public domain with credit
  requested (`DATA.md` §3, `DECISIONS.md` §2). Bundle **event parameters only** (time,
  lat, lon, depth, magnitude, id): no ShakeMap or PAGER imagery, nothing from a
  `products/` URL
- Commit `scripts/build-quakes.ts` — fully reproducible
- Credit lines from `DATA.md` §10 ship in the footer and about panel, in English and Assamese
- **Decide the plate-boundary source: a clearly licensed dataset, or our own tracing from
  cited published sources.** PB2002 is not shipped either way (`DATA.md` §4,
  `DECISIONS.md` §6 — the choice lands in _this_ phase, not phase 6)
- Natural Earth coastline into `src/data/`

**Done when:** `npm run data:dem` from a clean clone produces byte-identical output,
every committed artefact has a `DATA.md` row, and nothing is over 5 MB. **Not yet done:**
the earthquake catalogue and the plate-boundary source are outstanding, and independent
elevation validation is an open gap rather than a completed item.

---

## Phase 3 — Terrain renderer

**Goal:** the Brahmaputra valley on screen, lit and readable.

- [x] Engine loads a DEM and displaces one mesh — `createTerrainView` in
      `src/engine/terrain/`, one `PlaneGeometry` at 512 × 512 segments, one draw call, extent
      in true metres from each sidecar
- [x] Elevation ramp from `--terrain-1` → `--terrain-4`, colours read from the CSS variables at
      runtime and passed in through `options.palette` so the engine holds no colour of its own
- [x] Hillshade from **full-resolution** heights computed per fragment, light from the
      north-west at low altitude. No specular pass and no post-processing: `--terrain-1` and
      `--water-deep` are already a documented WCAG exception, and adding a shine to them would
      make the exception harder to defend rather than the terrain better to read
- [x] Float32 height path — R32F with manual bilinear in the shader, capability probed for
      real, clear error state if unsupported (`DECISIONS.md` §9)
- [x] Shader contour lines, interval from 10/25/50/100/250/500/1000 m by visible relief, shown
      in the legend. 1000 m on the overview, 250 m on both reaches
- [x] Orbit camera with damped movement, polar angle clamped so it can never go under the
      terrain, per-area zoom limits, touch pinch, and keyboard orbit/zoom/reset
- [x] Render on demand — **zero frames while idle**, cancelled while the tab is hidden.
      DPR capped at 1.5
- [x] Vertical exaggeration, per-area default, slider 1–30×, **always** shown in the legend and
      beside the slider. Contours stay at true altitude
- [x] Loading skeleton matching the real panel geometry, plus distinct WebGL2, float-texture
      and load-failure error states with a retry
- [x] Legend with numeric elevation ticks in the mono font, contour interval, units, and the
      pointer readout with a keyboard-accessible equivalent. Elevation is never carried by
      colour alone
- [x] Attribution and the limitations list rendered **from the sidecar JSON**, never retyped
- [x] Data loaded through Vite `?url`, verified to respect a configurable `base`
- [x] Headless tests: bilinear probe against decoder values, metric scaling from sidecars,
      contour-interval picker, legend tick generator, camera polar clamp and damping
      termination, area registry matching `manifest.json` exactly, and no React or hex literal
      under `src/engine/`
- [x] **Fix the no-data encoding collision.** `offsetFor` returns `floor(minElevation) - step`
      now, so code 0 is unreachable by a real measurement. 1,987 cells recovered (1,938 on
      Majuli, 49 on the overview); 0 holes remain in all three areas
      (`DECISIONS.md` §10)
- [ ] **UNCHECKED — verify byte-identical rebuild.** The artefacts were migrated by
      `scripts/migrate-nodata-encoding.ts`, not regenerated: `npm run data:dem` was **not**
      re-run against the fixed encoder, so byte-identical reproducibility is unverified.
      Rebuild **one** area (majuli is the cheapest at 4 tiles) and compare the SHA-256
      against `manifest.json`. A mismatch means the migration and the pipeline disagree
      somewhere — most plausibly PNG encoder options — and the committed file must then be
      replaced by the pipeline's output rather than patched. Recorded in `docs/DATA.md` §13
- [ ] **Independent elevation validation** — still open, carried from phase 2
      (`docs/DATA.md` §13)
- [ ] **Visually review the render.** Done by eye in a real browser, not by an automated
      check: whether 8× reads as terrain or as spikes, whether the edge fade is invisible,
      whether the hillshade is legible at 390px, and whether the fog is doing anything at all

**Done when:** terrain renders at 60fps on a mid-range Android and the engine builds it
in Node without a browser.

**Not yet done.** The automated half of that is met and green: `npm run verify` is green and
every number the HUD shows is asserted rather than eyeballed. The half that cannot be
automated is the render itself — nobody has yet confirmed that the scene looks like Assam.

---

## Phase 4 — Water engine + flood UI

**Goal:** the memorable moment. Water that responds and a bank that visibly erodes.

- Headless hydraulic step — `step(sim, params) → sim`, pure, deterministic
- **Scenario inflow control** — the user sets a level or inflow; water spreads across the DEM.
  Not a discharge control, and not wired to any gauge (`DECISIONS.md` §3, §7)
- Erosion at flow/bank contact; channel migration over time
- Fixed-timestep accumulator so behaviour is frame-rate independent
- Full state matrix: loading, ready, partial, error, offline, WebGL-absent, unknown
- **Every eroded cell labelled "modelled". Every input labelled "scenario" — user-chosen, not
  measured.** (`PRODUCT.md` §4.3)
- Persistent "illustrative model, not a forecast" framing in FLOW
- No station names, no gauge figures and no dates anywhere in the FLOW UI

**Done when:** the simulation is covered by unit tests running headless, and no screen
can be mistaken for a flood forecast _or_ for a reading of the river.

---

## Phase 5 — Fault layer

**Goal:** a century of the ground shaking, replayed.

- Quake markers at real locations, sized by magnitude, at real dates
- Timeline scrubber, keyboard-operable, with `aria-live` announcements
- Magnitude 6+ triggers the 1.2s expanding seismic ring — **reduced-motion turns it into a
  static marker**
- **"Earthquakes cannot be predicted" notice** — present, dismissable, re-encounterable
- Shake is explicitly labelled an **illustration of ground motion**, never a specific event
- "—" for any event with no depth or magnitude value
- Each marker links its ComCat event ID, so a magnitude is traceable to the record it came
  from rather than to this sandbox

**Done when:** every rendered magnitude traces to a cited record, and no copy in the mode
implies prediction.

> **Data unblocked.** `DECISIONS.md` §2 cleared 2026-10-01 — ComCat terms read by the owner,
> event parameters only. Build the timeline, markers and notice against a fixture now, and
> wire the real compiled subset in as it lands from phase 2.

---

## Phase 6 — Plates opener

**Goal:** the cinematic that earns the rest of the app.

- India–Eurasia collision from cited convergence rates
- Camera flies down from the Himalaya along the Brahmaputra into the sandbox, ~30–45s
- Skippable at any point; replays on demand
- **Depends on the plate-boundary source chosen in phase 2** (`DECISIONS.md` §6 — PB2002 is
  not shipped, and the choice between a licensed dataset and our own tracing lands in phase 2).
  This phase consumes that decision; it does not make it.
- `prefers-reduced-motion` reduces the flight to a cut

**Done when:** a first-time viewer understands _why_ the landscape exists within 45 seconds,
and no unsourced plate geometry ships.

---

## Phase 7 — UI polish, Assamese, accessibility

**Goal:** every user, both languages, nothing broken.

- Complete English and Assamese — no English-only string in an Assamese session
- **Owner (native speaker) reviews the Assamese copy and clears the DRAFT markers** — this is
  a gate, not a polish item (`DECISIONS.md` §5). Glyph coverage is already proven; whether the
  words are _right_ is not
- Assamese verified visually, not just by codepoint test
- Full keyboard operability; focus visible everywhere; no traps
- axe scan clean on all three modes
- 390px and 1440px verified by looking at pixels
- Every state designed: empty, loading, partial, error, offline, reduced-motion
- Copy pass against `PRODUCT.md` §6 — the honesty criteria first, polish second
- **Re-check the terrain/deep-water contrast decision against real renders here**
  (`DECISIONS.md` §1, `DESIGN.md` §4.3) — a judgement made from flat swatches may not hold
  with hillshade and slope shading applied

**Done when:** the `PRODUCT.md` §6 checklist passes with real evidence, a non-specialist
looking at a screenshot cannot mistake this for an official product _or_ for a reading of the
river, and the Assamese DRAFT markers are cleared.

---

## Phase 8 — Share cards + deploy

**Goal:** someone sends it, someone opens it.

- Headless capture via the engine's `getSnapshot()` — no UI required (the payoff of
  `docs/ARCHITECTURE.md` §1)
- Share card per mode with honest framing baked into the image
- Deploy to static hosting. No backend, no accounts, no telemetry — a hard constraint
- Bundle within the performance budget (`docs/ARCHITECTURE.md` §6)
- `README.md` rewritten from stub to real documentation
- Licence and attribution audit: every shipped asset traced to a `DATA.md` row

**Done when:** a stranger can open a share card, understand what they are looking at, and
know it is not an official warning.

---

## Cross-cutting

These apply in every phase, not just one:

| Rule                                                                         | Source                |
| ---------------------------------------------------------------------------- | --------------------- |
| `npm run verify` green before any phase is called done                       | `AGENTS.md` §4        |
| No React in `src/engine/`                                                    | `AGENTS.md` §3        |
| No invented data, no guessed licences                                        | `AGENTS.md` §6        |
| No committed file over 5 MB                                                  | `AGENTS.md` §5        |
| No raw hex, no off-grid spacing                                              | `AGENTS.md` §8        |
| Recompute contrast after touching a colour                                   | `DESIGN.md` §4        |
| Every string in English and Assamese                                         | `AGENTS.md` §11       |
| Check `docs/DECISIONS.md` before starting a phase — it records settled calls | `docs/DECISIONS.md`   |
| Every FLOW input is a user-chosen scenario, never an observation             | `DECISIONS.md` §3, §7 |

## Open risks carried forward

| Risk                                           | Where it bites | Status                                                                                                                                                                                                                      |
| ---------------------------------------------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| USGS ComCat terms not yet transcribed verbatim | Phase 2, 5     | **Licence cleared 2026-10-01** — owner read the crediting page; public domain, credit requested. Bundle event parameters only. **Open:** paste the page text into `DATA.md` §3, `DECISIONS.md` §2                           |
| Bird PB2002 has no verifiable licence          | Phase 2        | **Source choice moves to phase 2** — PB2002 not shipped, `DECISIONS.md` §6                                                                                                                                                  |
| CWC discharge data                             | —              | **Settled: out of scope.** FLOW uses a user-chosen scenario, `DECISIONS.md` §3, §7                                                                                                                                          |
| ASDMA not redistributable                      | —              | **Settled: link only, never bundle.** No longer a phase-4 blocker, `DECISIONS.md` §4                                                                                                                                        |
| Two palette pairs below 3:1                    | Phase 7        | **Settled as a documented exception**, re-checked against real renders, `DECISIONS.md` §1                                                                                                                                   |
| Assamese copy unreviewed                       | Phase 7        | **Open** — owner native-speaker review required, `DECISIONS.md` §5                                                                                                                                                          |
| GLO-30 is a DSM, not a DTM                     | Phase 3, 4     | **Settled: accepted and documented.** Canopy and buildings sit on the eroded surface; no riverbed bathymetry. `DATA.md` §12, `limitations` in every sidecar, `DECISIONS.md` §8                                              |
| No independent elevation validation            | Phase 2, 4     | **Open gap.** Terrain tests are GLO-30 self-consistency plus two loose plausibility checks, one on a tertiary source. Needs Survey of India / GSI benchmark levelling, licence unverified. `DATA.md` §13, `DECISIONS.md` §8 |
