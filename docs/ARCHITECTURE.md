# ARCHITECTURE.md

How Fault & Flow is put together, and why the seam between the 3D engine and the React UI
is the most important decision in the repo.

---

## 1. The one rule

> **The engine is framework-agnostic and runnable headless. The UI talks to it through a
> small typed API.**

Everything below follows from that. Three.js, the scene graph, the flood simulation, and
the earthquake catalogue live in `src/engine/` and know nothing about React. React lives in
`src/ui/` and renders state. They meet at exactly one typed interface in `src/shared/`.

This is enforced, not merely documented:

- An ESLint rule (`no-restricted-imports`) rejects any React import from `src/engine/**`.
- The simulation modules are pure functions over typed arrays and run in plain Node, so
  `npm test` exercises them with no browser, no WebGL, and no jsdom.
- If a change requires React inside the engine, **the design is wrong**, not the rule.

### Why this rule and not just "keep it tidy"

Three concrete reasons, in order of how much pain they prevent:

1. **Testability.** Flood hydraulics are the kind of thing that silently breaks. A pure
   `step(sim, params) → sim` function can be unit-tested against known inputs in
   milliseconds. The same code reachable only through a React component and a live WebGL
   context is untestable in practice, and untestable physics rots.
2. **Headless rendering of the same scene.** Because the engine owns the scene graph, a
   script can drive it to produce a thumbnail or a share card without a UI. That becomes
   `npm run shots`.
3. **The engine outlives the UI.** If the HUD is rewritten — and at this stage it will be
   — the terrain, the water, and the catalogue should not notice.

---

## 2. Layout

```
src/
  shared/      Types + pure helpers used by BOTH sides. The contract lives here.
    api.ts       The engine's public typed API (the seam).
    types.ts     Domain types: QuakeEvent, TerrainGrid, FlowParams, Mode, Locale...
    units.ts     Unit formatting and conversion. No DOM. No Three.

  engine/      Three.js, simulations, data loading. NO React, ever.
    api.ts       createEngine(): the public facade implementing shared/api.ts
    scene/       Renderer, camera, lights, post-processing
    terrain/     DEM loading, mesh generation, elevation ramp
    water/       Flood simulation + mesh update
    quake/       Earthquake catalogue, timelapse driver
    plates/      Plate boundary geometry, collision animation
    data/        Loaders for files in data/processed/
    core/        Loop, clock, resource disposal, headless-safe math

  ui/          React. The HUD and nothing else.
    App.tsx      Composition root; owns the engine lifecycle
    components/  ModeRail, ReadoutPanel, TimelineScrubber, Disclaimer, LangToggle
    hooks/       useEngine, useLocale, useFocusTrap
    state/       Zustand stores (UI state only)
    styles/      tokens.css, base.css, tailwind.css

  data/        Generated TypeScript data modules emitted from data/processed/

scripts/       Pipeline, tooling, contrast checker, screenshot capture
tests/         Vitest unit tests (engine + shared; no DOM required)
e2e/           Playwright browser tests
```

### Direction of dependency

```
        ┌───────────┐
        │  shared/  │   types only, no imports from either side
        └─────┬─────┘
      ┌───────┴────────┐
      ▼                ▼
 ┌─────────┐    ┌──────────┐
 │ engine/ │    │   ui/    │
 └─────────┘    └──────────┘
      ▲                ▲
      └──── shared/api ┘   the only call path across the seam
```

`engine/` imports from `shared/` and from `three`. `ui/` imports from `shared/` and from
the engine facade. **Neither imports from the other.** There is no `any` cast between them
either — if the UI needs a new value from the engine, the API changes.

---

## 3. The typed API contract

The seam is one interface, declared in `src/shared/api.ts` and implemented in
`src/engine/api.ts`. It is the engine's entire public surface.

Shape of it as built in Phase 1 — deliberately small:

```ts
export interface EngineApi {
  // lifecycle
  mount(canvas: HTMLCanvasElement): void;
  unmount(): void;

  // mode
  setMode(mode: Mode): void;
  getMode(): Mode;

  // simulation control
  setFlowParams(params: FlowParams): void;
  setTime(t: number): void; // scrub, seconds or unix ms per mode
  play(): void;
  pause(): void;

  // read state for the HUD
  sampleAt(x: number, y: number): TerrainSample;
  getSnapshot(): EngineSnapshot;

  // events -> UI
  on(event: EngineEvent, handler: (payload: never) => void): () => void;
}
```

Rules for this interface:

- **It returns data, not objects.** No `THREE.Object3D` crosses the seam. The UI must not
  be able to reach into the scene graph.
- **`getSnapshot()` is a plain serialisable struct.** This is what makes share cards and
  headless capture possible.
- **`on()` returns an unsubscribe function.** No event-emitter objects leaking.
- **Changing this interface is a breaking change.** It gets a commit message that says so.
- **Async work is explicit.** Loading a DEM returns progress through `on('load', …)`;
  nothing in this interface blocks.

---

## 4. Data flow

### Build time

```
upstream source  ──►  data/raw/  ──►  scripts/ pipeline  ──►  data/processed/
   (network)         (gitignored)      (committed)            (small, committed)
                                                                    │
                                                                    ▼
                                                            src/data/*.ts
                                                            (typed modules)
```

Everything is reproducible from `scripts/` with no manual step. `docs/DATA.md` is the
authority on what each input is and under what licence.

### Runtime

Three distinct paths, deliberately kept separate:

1. **Static import (small data).** Earthquake catalogue subsets and terrain metadata are
   compiled into `src/data/*.ts` at build time. No fetch, no loading state, no failure
   mode. Chosen wherever the artefact is small enough.
2. **Runtime fetch (large data).** Terrain heightfields exceed what should be in the
   bundle. They load via `fetch` from `/public` with progress reported through the API.
   Handled by the loading state in §5.
3. **Procedural (no data at all).** Synthetic shake illustration, and any decorative
   motion. **Must be visibly synthetic** — see `AGENTS.md` §6.

### The honesty boundary in the data layer

Every value the UI renders carries its provenance:

```ts
// src/shared/types.ts
export type Provenance =
  | { kind: 'measured'; source: string; url: string; retrieved: string }
  | { kind: 'modelled'; note: string }
  | { kind: 'illustrative' }
  | { kind: 'unknown' }; // renders as "—"
```

`getSnapshot()` returns provenance alongside values. The UI renders "measured" data
normally, "modelled" with a model badge, "illustrative" with an illustration notice, and
`unknown` as **"—"**. The component is not allowed to flatten these — if it does, a
modelled number is one refactor away from being presented as a measurement, which is the
exact failure `PRODUCT.md` §4 forbids.

---

## 5. States the UI must handle

From the UX workflow — the UI is designed around states, not screens. Each of these
applies to every mode:

| State                    | Trigger                          | Requirement                                                                                                                                |
| ------------------------ | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **Loading**              | DEM or catalogue fetching        | Skeleton matching the real HUD layout, delayed ~200ms so fast loads don't flash. Keep the canvas background visible — never a white flash. |
| **Ready**                | Data loaded                      | Full HUD.                                                                                                                                  |
| **Partial**              | Some sources failed, some loaded | Show what loaded, mark what didn't, offer retry for that part only.                                                                        |
| **Error — recoverable**  | Fetch timeout, offline           | Say what happened and what to do; a retry control. Never a raw status code.                                                                |
| **Error — WebGL absent** | No GPU context                   | Fall back to a static, informative panel. Say the 3D view needs WebGL and point at the data view.                                          |
| **Empty / unknown**      | No data for a location           | "—" with an accessible name explaining why. Never `0`.                                                                                     |
| **Reduced motion**       | OS setting                       | Camera moves become cuts, the seismic ring becomes a static marker. Information is never motion-only.                                      |

---

## 6. Performance budget

Target: 60fps on a mid-range Android, which is the realistic device for the primary
audience. Hard ceilings:

| Budget                 | Value                                   |
| ---------------------- | --------------------------------------- |
| First meaningful paint | < 3s on 4G                              |
| JS bundle (initial)    | < 300 KB gzipped                        |
| DEM transfer           | < 8 MB total; per-tile decodable        |
| Draw calls             | < 120                                   |
| Device pixel ratio     | capped at 2; reduced to 1.5 below 768px |

Levers if the budget is missed, in the order to pull them:

1. Drop DEM resolution on small screens — invisible cost, biggest win.
2. Reduce the water simulation's spatial granularity; step fewer cells per frame.
3. Decouple simulation rate from render rate — the sim can run at 20Hz under a 60fps
   render without the user noticing, because water movement is slow relative to the frame.

The simulation stepping on a fixed accumulator (not per-frame delta) is required for the
headless tests to be deterministic. A flood that behaves differently on a 30fps laptop and
a 60fps desktop is a flood we cannot test.

---

## 7. Testing strategy

| Layer        | Tool       | What it covers                                                             | Needs a browser? |
| ------------ | ---------- | -------------------------------------------------------------------------- | ---------------- |
| Simulation   | Vitest     | Flood step, erosion, channel migration, catalogue queries, unit conversion | No               |
| Shared       | Vitest     | Type guards, formatters, provenance handling                               | No               |
| Fonts        | Vitest     | Assamese glyph coverage in the shipped font file                           | No               |
| UI behaviour | Playwright | Rendering, keyboard operability, axe scan, language toggle                 | Yes              |
| Visual       | Playwright | Screenshots at 1440px and 390px → `docs/screenshots/`                      | Yes              |

Headless-testable simulation is the reason for §1. If a simulation cannot be unit-tested
without a browser, it belongs in the wrong layer.

Accessibility is verified three ways, all required: an **automated axe scan**, a
**keyboard walk** (Tab through everything, assert a visible focus indicator on each stop),
and reading the screenshots at both widths. The first catches about a third of issues; the
other two catch the rest.

---

## 8. Invariants

Cheap to check, expensive to lose. Each should have a lint rule or a test.

1. No React import in `src/engine/**`.
2. No import from `src/ui/` in `src/engine/**`.
3. No `THREE.*` type in `src/shared/**` or crossing the API seam.
4. No raw hex outside `src/ui/styles/tokens.css`.
5. No CDN font or script URL anywhere.
6. No committed file over 5 MB.
7. No `Math.random()` standing in for a measurement.
8. Every shipped string present in both `en` and `as`.
9. Every `--space-*` value a multiple of the 8px grid; no raw px spacing.
10. No `outline: none` without a `:focus-visible` replacement.
