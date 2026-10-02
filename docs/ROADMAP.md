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

- Fetch Copernicus DEM GLO-30 tiles for the Brahmaputra valley into `data/raw/` (gitignored)
- Clamp, reproject, and resample to a committed artefact under the 5 MB ceiling
- Attach the **mandatory** Article 6(b) "produced using Copernicus WorldDEM-30" attribution
  to every processed file
- Fetch a quake subset for NE India and compile to `src/data/quakes.ts`
- **ComCat is unblocked** — terms read by the owner 2026-10-01, public domain with credit
  requested (`DATA.md` §3, `DECISIONS.md` §2). Bundle **event parameters only** (time,
  lat, lon, depth, magnitude, id): no ShakeMap or PAGER imagery, nothing from a
  `products/` URL
- Commit `scripts/build-terrain.ts` and `scripts/build-quakes.ts` — fully reproducible
- Credit lines from `DATA.md` §10 ship in the footer and about panel, in English and Assamese
- **Decide the plate-boundary source: a clearly licensed dataset, or our own tracing from
  cited published sources.** PB2002 is not shipped either way (`DATA.md` §4,
  `DECISIONS.md` §6 — the choice lands in _this_ phase, not phase 6)
- Natural Earth coastline into `src/data/`

**Done when:** `npm run run-pipeline` from a clean clone produces byte-identical output,
every committed artefact has a `DATA.md` row, and nothing is over 5 MB.

---

## Phase 3 — Terrain renderer

**Goal:** the Brahmaputra valley on screen, lit and readable.

- Engine loads a DEM into a `THREE.BufferGeometry`
- Elevation ramp from `--terrain-1` → `--terrain-4`
- Hillshade and a subtle specular pass; no heavy post-processing
- Orbit camera with damped, cinematic movement (600ms, `--ease`)
- Responsive: DPR capped at 2, reduced below 768px
- Headless test: terrain mesh builds with correct vertex count and bounding box

**Done when:** terrain renders at 60fps on a mid-range Android and the engine builds it
in Node without a browser.

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

| Risk                                           | Where it bites | Status                                                                                                                                                                                            |
| ---------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| USGS ComCat terms not yet transcribed verbatim | Phase 2, 5     | **Licence cleared 2026-10-01** — owner read the crediting page; public domain, credit requested. Bundle event parameters only. **Open:** paste the page text into `DATA.md` §3, `DECISIONS.md` §2 |
| Bird PB2002 has no verifiable licence          | Phase 2        | **Source choice moves to phase 2** — PB2002 not shipped, `DECISIONS.md` §6                                                                                                                        |
| CWC discharge data                             | —              | **Settled: out of scope.** FLOW uses a user-chosen scenario, `DECISIONS.md` §3, §7                                                                                                                |
| ASDMA not redistributable                      | —              | **Settled: link only, never bundle.** No longer a phase-4 blocker, `DECISIONS.md` §4                                                                                                              |
| Two palette pairs below 3:1                    | Phase 7        | **Settled as a documented exception**, re-checked against real renders, `DECISIONS.md` §1                                                                                                         |
| Assamese copy unreviewed                       | Phase 7        | **Open** — owner native-speaker review required, `DECISIONS.md` §5                                                                                                                                |
| GLO-30 is a DSM, not a DTM                     | Phase 3        | Document limitation; affects slope/flow math                                                                                                                                                      |
