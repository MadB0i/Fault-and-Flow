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
2. **Runtime fetch (large data).** The committed terrain heightfields are fetched at
   runtime from `/public` with progress reported through the API, handled by the loading
   state in §5.
3. **Procedural (no data at all).** Synthetic shake illustration, and any decorative
   motion. **Must be visibly synthetic** — see `AGENTS.md` §6.

### Decoding terrain in the browser, and why the decode options are load-bearing

Terrain PNGs are **Terrain-RGB**: a 16-bit elevation packed across R, G, B. That is a
_measurement_ encoding, not a picture, which changes how the browser may touch it.

> **Decode with `createImageBitmap` using `premultiplyAlpha: 'none'` and
> `colorSpaceConversion: 'none'`.** Both are required, and neither is a performance tweak.
>
> - Default alpha handling **premultiplies RGB by alpha**. Terrain files are written
>   colour-type 2 with no alpha precisely so this cannot bite — but the option is set
>   explicitly rather than left to a default that would one day be unsafe.
> - Default colour management **transforms values** through a colour profile. Elevations
>   are not colours, and a transform would shift every one.

The failure mode is what makes this worth writing down: a mis-decoded heightfield still
_looks_ like terrain. It is not obviously wrong, it is wrong.

The headless decoder in `src/engine/terrain/` exists for the same reason. It is pure
TypeScript with no DOM, so the values the tests assert on come from the same arithmetic the
browser will use, and a pipeline fault surfaces in `npm test` rather than on screen. The
decode path is byte-based and identical in both environments: `decodePng` parses the
container, `decodeTerrainRgba` unpacks elevations and marks no-data as `NaN` with an
explicit mask.

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

---

## 9. The terrain renderer

Phase 3. One mesh, one height texture, no post-processing.

### What renders

A single `PlaneGeometry(1, 1, 512, 512)` — 513 × 513 vertices, one draw call — rotated
into the XZ plane. Its real extent comes from the sidecar, not from the geometry, so one
buffer serves all three areas. The **vertex shader** displaces it by sampling the height
texture; the **fragment shader** does the rest.

**The fragment shader recomputes the surface normal per fragment from the full-resolution
heights**, taking the gradient from neighbouring texels rather than interpolating a normal
from the mesh. That is the reason the mesh may be as coarse as 512 segments while the
hillshade stays sharp: the lighting detail comes from the data, not the tessellation.
Raising the segment count would cost vertices and buy nothing.

The gradient is taken in true metres and **then** multiplied by the exaggeration, because
the rendered surface is exaggerated and the hillshade has to describe the surface actually
on screen. Omitting that multiply makes the lighting flatter than the terrain as the user
raises the slider, which reads as a bug in the control.

Colour comes from the four `--terrain-*` tokens in ramp order, mapped across the sidecar's
declared elevation range. Light is from the north-west at low altitude — the cartographic
convention, and a real bearing rather than a decorative one. Terrain edges fade into the
background over a fraction of the half-extent so the bounding box never shows as a hard cut,
with a light depth haze on top.

### Coordinates, and the flip that matters

`+x` is east, `+z` is south, `+y` is up, and the orbit target is the origin. Row 0 of the
decoded grid is the **north** edge.

`PlaneGeometry` puts `uv.y = 1` at local `+y`; rotating −90° about X sends local `+y` to
world `−z`, i.e. north. Row 0 of the data is therefore at `uv.y = 1`, not `uv.y = 0`, and the
shader uses `v = 1 - uv.y`. Getting this backwards mirrors the terrain north–south, which
looks almost right until you put a river on it. `tests/terrain-sampling.test.ts` pins the
row order on the CPU side.

GLO-30 pixels are **not square**, so `pixelSizeMx` and `pixelSizeMy` are carried as a pair
everywhere and never multiplied into a single number. See `docs/DATA.md` §1.

### The height texture: float32, and why

`R32F`, `NearestFilter`, no mipmaps, bilinear by hand in the shader.

The rejection of narrower types is in `DECISIONS.md` §9 because it is the kind of decision
that gets re-litigated: the two reaches encode at a 0.1 m step, so 16 bits over their range
is already a 6.5 m step, larger than the whole floodplain relief. Half float is worse.
Manual bilinear rather than hardware filtering means the path never depends on
`OES_texture_float_linear`.

Capability is **probed, not assumed**: a 1×1 R32F texture is uploaded and the GL error state
read. A device that fails gets the `float-texture-unsupported` error state with its own
explanation, because "the map is blank" and "your GPU cannot do this" call for different
actions.

No-data is `NaN` in the texture. GLSL ES 1.00 has no `isnan`, so the test is `h != h`, which
is equivalent for a quiet NaN and costs nothing. A sample touching any no-data texel
returns no-data rather than blending a hole into a number.

### Shaders are ESSL1 on a WebGL2 context

Not `#version 300 es`. Everything needed here works in ESSL1 on WebGL2 — derivatives are
core there, so `fwidth` needs no extension pragma, and exact texel fetches are done by
sampling texel centres on a NEAREST texture. The one requirement that actually needs
WebGL2 is the float texture _format_, which is not a shader-language question. Declaring an
explicit `out` for GLSL3 would collide with the output declaration Three.js emits for GLSL3
`ShaderMaterial`s, which is a link error waiting for a driver nobody tested against.

### Render on demand

No continuous `requestAnimationFrame`. A frame is requested on camera input, resize,
parameter change and area load; an idle viewer costs zero frames and therefore zero battery,
which matters when the primary audience is on a phone.

Damping is the only thing that looks like it needs a loop. It does not: each step requests
the next frame and the chain ends when the camera settles. **Termination is decided by
comparing the remaining gap, never by rounding the damping factor to zero** — a factor
rounded to zero leaves the camera frozen without the caller being told it arrived, and the
loop then never stops. `tests/terrain-camera.test.ts` runs the real loop and asserts it
stops within roughly DESIGN.md's 600 ms `--dur-slow`.

Frames are cancelled outright while the tab is hidden, and the frame timestamp is dropped so
the first frame back does not take one enormous damping step. Device pixel ratio is capped
at **1.5**, inside the DESIGN.md §6 ceiling of 2, because the target device is a mid-range
Android.

### Contours

Interval from `10 / 25 / 50 / 100 / 250 / 500 / 1000` m — nice numbers only, because a
contour at 175 m asks the reader to do arithmetic, which is the one thing a contour exists
to avoid. The picker takes the smallest interval keeping the band count at or under 14 and
the interval at least two pixels above the ground sampling; when nothing in the set
qualifies it returns the largest rather than extrapolating outside the documented set. The
overview gets 1000 m, both reaches 250 m.

Lines are drawn at multiples of the interval in **true** metres, so a contour means the same
altitude at every exaggeration. Width comes from `fwidth`, giving constant apparent
thickness, and the line fades out rather than aliasing when contours become denser than the
pixel grid can resolve.

### Data loading

Artefacts are imported with Vite's `?url` suffix, not copied by a build step. There is
therefore nothing to forget to copy, and the emitted URL already carries Vite's configured
`base` — verified by building with `--base=/fault-and-flow/` and confirming both
`index.html` and the asset references are prefixed. GitHub Pages is a one-line config
change rather than a path bug.

Loading **cancels**: a token guards each `loadArea`, and a superseded load returns without
touching state.

The browser decode path is `createImageBitmap` with `premultiplyAlpha: 'none'` and
`colorSpaceConversion: 'none'`, as §4 requires. Both are load-bearing: alpha premultiplication
multiplies the elevation bytes by alpha and a profile transform pushes them through a
transfer curve, and neither failure looks like an error.

A sidecar whose declared grid disagrees with its own PNG is a **pipeline fault and throws**,
rather than being resampled to fit. Silently reconciling them would defeat the point of
decoding the committed bytes.

Note that Vite inlines the three sidecars as `data:` URLs, because each is under its 4 KB
inline limit. `fetch()` on a `data:` URL is specified and works, so this is the load path
today; it also means a sidecar that grows past the limit becomes a network request with no
code change, which is a behaviour change worth knowing about.

### Where the CPU and GPU samplers can disagree

The renderer has two implementations of "what is the elevation here": one in GLSL and one in
`sampling.ts`, for the pointer readout. They are kept honest by testing the CPU one against
the decoder rather than against its own arithmetic — a test that re-derives bilinear by hand
over the same array the function reads proves nothing. `tests/terrain-sampling.test.ts` also
pins the exact per-area no-data counts, because they are **zero** and that is a fact worth
protecting: the encoding reserves code 0 for no-data and places `offset` one step below the
lowest elevation, so code 0 is unreachable by a real measurement. Before 2026-10-02 the
offset was the minimum elevation itself, cells at that minimum encoded to the reserved
code, and the decoder discarded them as holes — 1,938 cells on Majuli and 49 on the
overview (`DECISIONS.md` §9). A non-zero count here means the renderer is throwing away
real terrain, so the assertion is per area rather than an aggregate.

### The no-data encoding, and why the offset is not the minimum

Code 0 means no-data, so the offset — the elevation of code 0 — must sit strictly below
the lowest elevation that can occur. `offsetFor` returns `floor(minElevation) - step`
rather than `floor(minElevation)`, and the extra step costs 0.1 m of span against a
65,535-code budget that the overview already spends 48,873 of.

Flooring is not sufficient on its own, and the reason is worth stating because the
failure is invisible: GLO-30 flattens water surfaces, and the floodplain is a few metres of
relief, so a real pixel at exactly the floor elevation is common rather than exotic. It
encodes to code 0, and a decoder has no way to know that is not a hole. The renderer treated
those cells as missing data, which is the safe direction — it shows "—" rather than
inventing a number — but it is not accurate, because those cells _are_ data.

The committed artefacts were migrated rather than rebuilt: every code incremented by 1 and
each offset reduced by one step, which is exactly invertible under
`code * step + offset`. `docs/DATA.md` §13 records what is and is not verified about that,
including the fact that `npm run data:dem` was not re-run.

### Budget, measured

| Item                | Value                                                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------------------- |
| Draw calls          | 1 (plus the background clear)                                                                           |
| Mesh vertices       | 263,169 (513 × 513), one `PlaneGeometry`, built once for all areas                                      |
| Height texture      | **4 bytes/px** (R32F): 4.75 / 8.07 / 12.49 MiB GPU for the three areas                                  |
| On-the-wire terrain | 1.94 / 2.21 / 3.70 MiB PNG — roughly half the GPU cost, since the PNG is compressed                     |
| Uniforms            | 21                                                                                                      |
| Frame rate          | **0 fps when idle.** Frames are requested only on camera input, resize, parameter change and area load. |

The texture row is the one worth pausing on. `docs/ARCHITECTURE.md` §6 budgets _transfer_
at 8 MB, and the three PNGs come to 7.86 MB over the wire, but once decoded the float
heights occupy **25.3 MiB of GPU memory** in total — three times the transfer. That is the
direct cost of the float32 decision in `DECISIONS.md` §9, it is why only one area's texture
is resident at a time (loading a second disposes the first), and it is the number to watch
if phase 4 adds water simulation state alongside it.

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

## Current atlas adapter — 2026-10-03

The earlier `EngineApi` block is a planned facade, not a shipped interface. The
implemented browser seam is `TerrainView` in `src/engine/terrain/terrain-view.ts`,
exported from the terrain index, with `useTerrainView` as its React binding.
`src/shared/atlas.ts` supplies serialisable `AtlasPresentation` (mode, layer flags,
locale, catalogue year, selected event, schematic collision progress).

This release extends that seam with `setAtlas`, `setWaterLevel` and `captureImage`;
water-stat fields are nullable when unsupported or unreliable. This is a breaking
API change. React receives no Three.js object. Atlas controls live in Zustand;
modal/focus/playback UI lifetimes remain in the HUD.

`atlas-layer.ts` renders sourced geography and earthquake parameters and original
synthetic plate geometry. `seedRiverScenario` is pure and headlessly tested. It
leaves DEM heights unchanged and seeds a local initial condition within two cells
of mapped centrelines. No bathymetry, infiltration, friction calibration or bank
erosion is held. The virtual-pipes solver runs on a coarser grid; display depth is
draped on the visible DEM with the same sampling and mesh resolution. Both use
north-first row order. Widths and rings are labelled visual/cartographic styling.

The GPU checks compare real render-target depth to the independent CPU step,
including open-edge loss and numerical reset. PNG capture renders synchronously
before reading the canvas, so it does not rely on preserved drawing buffers.
The HUD appends framing, scenario context and the sidecar's required credit to the
export. Browser checks use native Python Playwright, with the npm Playwright
runner providing the dev server and installed Chromium executable.

### Depth views and sections — 2026-10-03

`AtlasPresentation` now adds `flowView`, `sectionOpen` and `sectionPosition`.
`WaterLayerState.section` carries a nullable `RiverSection` of serialisable samples.
These additions extend the typed public contract and are a breaking API change.
The engine reads the already-throttled GPU statistics buffer, selects a
north-to-south grid column and centres its slice on that column's deepest wet cell.
The map draws A–B at the same longitude and latitude bounds. No additional hot-path
GPU readback or React/Three.js coupling is introduced.

The section shows resampled solver terrain rather than high-resolution display
terrain; these representations can differ. Missing samples remain gaps. A labelled
vertical window improves depth readability and can clip high terrain without
flattening it. Layer switches and section position do not reset the simulation.
Depth bands use a fixed 0–8 m display scale, saturating deeper values while numeric
depth readouts retain the solver values. Surface streaks use a separate real-time
visual clock, follow model flux direction and are static under reduced motion.

FAULT's region picker is removed from both HUD paths, and entering it through
navigation or browser history selects Assam overview. Its terrain-following wave
fronts use display choices for radius, timing and brightness. They are not P/S
arrivals, intensity contours or measured shaking fields.

### District navigation and dated snapshots — 2026-10-03

The typed public contract adds `TerrainView.zoomView(factor)` and
`focusLocation(lon, lat)`, and `AtlasPresentation.districts` / `selectedDistrict`.
This is a breaking API extension. The HUD passes numbers and sourced IDs only;
the engine keeps camera position, damping, ray intersection and screen-label
layout. Wheel/pinch zoom uses a geographic anchor, Shift-drag pans, and resize
preserves an already navigated camera. Home/reset returns to the overview.
Probing resets its temporary intersection plane on every path.

OSM district labels use independently attributed administration-centre anchors.
Leader lines connect displaced screen labels to their unchanged anchors. Small
viewports declutter close labels; all 35 names remain in a native button directory.
Layout is cached while the camera and label state are unchanged, avoiding a
district collision search on every water frame. Town labels are independently
available and off by default to keep the initial district view readable.

Shared links validate mode, locale, sourced district ID, historical year, event ID
and depth-view selection. They never start a water simulation. Clipboard failure
retains a selectable native text field. The build-time USGS updater atomically
replaces validated data, and the UI's timeline bounds derive from the snapshot
cutoff rather than a hard-coded year. See `docs/DATA_UPDATES.md` for activation
conditions and the distinction between historical refresh and live warnings.

### Map-first layout and share composition — 2026-10-03

The HUD starts with a compact dock and moves geographical layer switches into the
native modal at both widths. Essential Play and range inputs stay in the document
and visible while secondary controls collapse. Desktop expansion has a bounded,
scrollable height; phone expansion remains in normal document flow.

Portrait overview framing uses a 90-degree azimuth and swaps the terrain extents
passed to the existing pure framing calculation. The orbit API is unchanged.
District displacements are bounded to nearby candidates (24 screen pixels per
axis), so decluttering no longer draws long leaders over neighbouring terrain.

`SharedScenario` is a framework-free URL value object, separate from the engine
contract. Parsing validates the region, finite input ranges and slider increments.
FAULT/PLATES and district views always resolve to the Assam overview. The React
binding accepts an initial area to load the shared region directly. Chosen depth
and inflow live in the HUD and are applied when the visitor presses Run. Shared
URLs do not restore camera movement, elapsed solver time or automatically enable
water. Browser history applies the same validation.

`createAtlasStory` composes the engine's capture into a static 1080 × 1920 PNG.
The portrait uses a labelled central crop, with a preview before local download;
the original full-viewport export remains separately available. Export credits
are wrapped, fonts are the already loaded self-hosted faces, and all colours are
read from CSS tokens. Capture temporarily increases pixel ratio (capped at 3),
then restores both renderer resolution and the screen-height shader uniform in a
finally block. The scene camera and simulation state are unchanged. Drawing-buffer
errors leave the link-sharing path usable. No scientific input, dependency or
engine API was added.

### Navigation and illustrative settlement contract (2026-10-03)

`AtlasPresentation` now requires `navigation` (`pan` / `orbit`), `buildings`
and `buildingMotion` (`gentle` / `medium` / `strong`). This is a breaking
contract extension; hosts should initialise from `INITIAL_ATLAS`. The existing
motion replay counter also triggers the explicitly synthetic settlement demo.
The optional palette entries `seismicLight` and `seismicRed` come from CSS tokens.

Default pointer drag pans; the HUD switches to orbit. Shift and right/middle
drag always pan. Arrow keys follow the chosen mode, Shift-arrows pan, wheel and
double-click zoom at the pointer, and a two-finger gesture combines midpoint
translation with pinch zoom. Zoom limits allow close inspection in all regions;
district focus preserves azimuth. Camera clearance uses the rendered terrain.

Epicentre anchors use the same tessellated surface as the renderer, including
its triangle diagonal and no-data handling. Screen-sized sphere symbols touch
that surface; radius and colour are display choices based on recorded magnitude.
They are not depth markers, local shaking, pressure, damage or hazard zones.

The procedural settlement runs entirely in `src/engine/terrain/`. Its buildings,
roads, windows, heights and sway are original illustrative geometry. Collision
progress transforms the existing scene rather than reconstructing it per tick.
Reduced motion uses a static pose; a normal replay settles after four seconds.
Building controls and navigation mode are not persisted in share URLs.
