# ROADMAP

Eight phases. **We are in Phase 1.** Do not start a later phase unprompted — see
`AGENTS.md` §10.

Each phase lists what must be true before it is called done. Phases 2–8 are written as
intent, not permission.

---

## Phase 1 — Foundation ✅ *in progress*

**Goal:** a repository that another engineer can run, and a design system that can be
trusted.

- [x] Repo scaffold, MIT licence, `.gitignore`, 5 MB file ceiling enforced
- [x] `AGENTS.md` — binding rules for agents
- [x] `PRODUCT.md` — audience, goals, non-goals, honesty rules, success criteria
- [x] `DESIGN.md` — tokens, rationale, computed contrast table, anti-patterns
- [x] `docs/ARCHITECTURE.md` — engine/UI split, typed API contract, data flow
- [x] `docs/DATA.md` — sources researched, licences quoted or marked `UNVERIFIED`
- [x] `docs/ROADMAP.md` — this file
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
- Commit `scripts/build-terrain.ts` and `scripts/build-quakes.ts` — fully reproducible
- **Resolve USGS ComCat licence, or drop ComCat and use an alternative** (`DATA.md` §3)
- **Do not use PB2002** until its licence is resolved (`DATA.md` §4)
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
- Discharge control; water spreads across the DEM
- Erosion at flow/bank contact; channel migration over time
- Fixed-timestep accumulator so behaviour is frame-rate independent
- Full state matrix: loading, ready, partial, error, offline, WebGL-absent, unknown
- **Every eroded cell labelled "modelled". Every unknown discharge is "—".** (`PRODUCT.md` §4.3)
- Persistent "illustrative model, not a forecast" framing in FLOW

**Done when:** the simulation is covered by unit tests running headless, and no screen
can be mistaken for a flood forecast.

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

**Done when:** every rendered magnitude traces to a cited record, and no copy in the mode
implies prediction.

---

## Phase 6 — Plates opener

**Goal:** the cinematic that earns the rest of the app.

- India–Eurasia collision from cited convergence rates
- Camera flies down from the Himalaya along the Brahmaputra into the sandbox, ~30–45s
- Skippable at any point; replays on demand
- **Blocked on PB2002 licence resolution** (`DATA.md` §4). Until then this phase can only
  use plate geometry from a verified source, or describe the collision without boundaries.
- `prefers-reduced-motion` reduces the flight to a cut

**Done when:** a first-time viewer understands *why* the landscape exists within 45 seconds,
and no unsourced plate geometry ships.

---

## Phase 7 — UI polish, Assamese, accessibility

**Goal:** every user, both languages, nothing broken.

- Complete English and Assamese — no English-only string in an Assamese session
- Assamese verified visually, not just by codepoint test
- Full keyboard operability; focus visible everywhere; no traps
- axe scan clean on all three modes
- 390px and 1440px verified by looking at pixels
- Every state designed: empty, loading, partial, error, offline, reduced-motion
- Copy pass against `PRODUCT.md` §6 — the honesty criteria first, polish second

**Done when:** the `PRODUCT.md` §6 checklist passes with real evidence, and a non-specialist
looking at a screenshot cannot mistake this for an official product.

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

| Rule | Source |
| --- | --- |
| `npm run verify` green before any phase is called done | `AGENTS.md` §4 |
| No React in `src/engine/` | `AGENTS.md` §3 |
| No invented data, no guessed licences | `AGENTS.md` §6 |
| No committed file over 5 MB | `AGENTS.md` §5 |
| No raw hex, no off-grid spacing | `AGENTS.md` §8 |
| Recompute contrast after touching a colour | `DESIGN.md` §4 |
| Every string in English and Assamese | `AGENTS.md` §11 |

## Open risks carried forward

| Risk | Where it bites | Status |
| --- | --- | --- |
| USGS ComCat licence unverified | Phase 2, 5 | **Blocking** for FAULT data |
| Bird PB2002 licence unverified | Phase 6 | **Blocking** for plate geometry |
| CWC discharge licence unresearched | Phase 4 | Open — FLOW shows no discharge data yet |
| ASDMA policy pages unreadable by fetch | Phase 4 | Needs a human with a browser |
| Two palette pairs fail 3:1 | `DESIGN.md` §4.3 | Proposed, awaiting a decision |
| GLO-30 is a DSM, not a DTM | Phase 3 | Document limitation; affects slope/flow math |
