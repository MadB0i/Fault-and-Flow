# DECISIONS.md

Decisions taken by the project owner, recorded so they are not relitigated from memory.

**Format:** one short paragraph per decision, dated, with what would reverse it. A decision
without a stated reversal condition becomes a superstition, and a superseded decision that
was never written down gets re-argued six months later.

This file records decisions, not research. The evidence behind each one — licence text,
computed ratios, HTTP responses — lives in `docs/DATA.md` and `DESIGN.md`, cross-referenced
below.

| #   | Decision                                                                      | Date       | Status                                                    |
| --- | ----------------------------------------------------------------------------- | ---------- | --------------------------------------------------------- |
| 1   | Terrain and deep-water contrast: keep values, document exception              | 2026-10-01 | Settled, re-check in phase 7                              |
| 2   | USGS ComCat: terms read by the owner; bundle event parameters only            | 2026-10-01 | Settled, with a scope limit                               |
| 3   | CWC discharge data: out of scope; FLOW uses user-controlled level             | 2026-10-01 | Settled                                                   |
| 4   | ASDMA: link only, never bundle                                                | 2026-10-01 | Settled                                                   |
| 5   | Assamese copy is DRAFT until owner review                                     | 2026-10-01 | Open, blocks phase 7                                      |
| 6   | Bird PB2002: not shipped                                                      | 2026-10-01 | Blocked, decide in phase 2                                |
| 7   | FLOW inputs are user-chosen scenarios, not observations                       | 2026-10-01 | Settled                                                   |
| 8   | DEM: Copernicus GLO-30; three areas as Terrain-RGB, overview at a 0.15 m step | 2026-10-01 | Settled; re-check if a verified bare-earth source appears |
| 9   | Terrain renderer: float32 heights, render on demand, exaggeration stated      | 2026-10-02 | Settled, re-check when the scene grows past one mesh      |
| 10  | No-data offset is one step below the minimum; artefacts migrated, not rebuilt | 2026-10-02 | Settled; rebuild one area to verify byte reproducibility  |

**On numbering.** Decision 3 is the narrower fact — CWC is out of scope. Decision 7 is the
general rule that supersedes it: _no_ FLOW input is an observation, whoever would have supplied
it. Where 3 and 7 overlap, 7 governs.

---

## 1. Terrain and deep-water contrast — keep current values, document as a documented exception

**Date 2026-10-01.** `--terrain-1` (`#1C3B35`, 1.58:1 on `--bg`) and `--water-deep` (`#0E5A73`,
2.50:1 on `--bg`) **keep their current values** rather than being adjusted to the computed
3.01:1 and 3.03:1 alternatives. Both are treated as **non-text 3D render data**, not as UI
components or boundaries, so WCAG 2.2 SC 1.4.11 is documented as a reviewed exception rather
than silently satisfied. The exception is only defensible because of a binding product rule:
**elevation and water depth are never conveyed by colour alone** — a numeric readout or a
legend must always be present wherever these shades encode a value. Where a legend is needed
it uses the **adjusted** shades (`#4B645F` for terrain, `#21677E` for water), because a legend
swatch sits on the HUD surface and must be legible as a UI element, while the 3D fill does
not. Accepting the exception trades a little legibility of the valley floor for a terrain
ramp that keeps its intended depth; that is a judgement about the render, not about
compliance. **Reversed by:** re-running the contrast check against real 3D renders in
phase 7, when the actual scene is on screen — a judgement made from flat swatches may not
survive contact with terrain, lighting and hillshade. See `DESIGN.md` §4.3.

## 2. USGS ComCat — terms read by the owner; bundle event parameters, not products

**Date 2026-10-01 (original), same date (resolved).** The USGS ANSS Comprehensive Catalog
licence was originally recorded **`UNVERIFIED`** and no USGS data was to be bundled. The
blocker was mechanical: the `usgs.gov` policy pages return an HTTP 202 JavaScript robot-check
interstitial to a plain HTTP client, so an agent could never read them, and a
search-result snippet is not a source. The owner has now opened
<https://www.usgs.gov/information-policies-and-instructions/crediting-usgs> in a real browser
on **2026-10-01** and reported what it says: **most USGS information is public domain and may
be used without restriction; USGS asks for credit; and some non-USGS images and graphics are
used with permission.** That resolves the licence status to **`VERIFIED BY OWNER`** —
deliberately a weaker label than `VERIFIED`, because what the repo holds is the owner's
summary of a page rather than a transcription of it, and this file's own rule is _quote,
never paraphrase_. Pasting the page's text verbatim into `docs/DATA.md` §3 remains the one
outstanding piece of paperwork.

**The decision itself: bundle event parameters, never products.** ComCat merges records from
many contributing networks and its entries reference ShakeMap and PAGER products that carry
their own terms and can embed third-party material, so a public-domain finding about USGS
information does not travel to every byte a ComCat record points at. We therefore commit
**time, epicentre latitude and longitude, depth, magnitude, and event ID** — and nothing
else. No ShakeMap imagery, no product graphics, nothing fetched from a `products/` URL. The
UI carries the credit line _"Earthquake catalog data courtesy of the U.S. Geological
Survey"_, registered in `docs/DATA.md` §10, because the terms request credit and it costs us
nothing. This clears the phase 2 earthquake-catalogue fetch and unblocks FAULT's real event
data, which had been building against fixtures with no date to graduate on. **Reversed by:**
the terms being found to restrict redistribution of the parameter fields, or a decision to
ship product imagery once each product's own licence is read. See `docs/DATA.md` §3.

**One boundary this decision does not move.** ComCat can be queried for recent events, and
FAULT ships a _historical_ subset. A live feed would be a different product with its own
honesty problems (`PRODUCT.md` §4.2), and nothing here authorises one.

## 3. CWC discharge data — out of scope; FLOW uses a user-controlled river level

**Date 2026-10-01.** **Central Water Commission discharge and river-stage data is out of scope
for now.** FLOW will be driven by a **user-controlled river level** rather than by observed
or modelled discharge. This removes a dependency the project cannot yet satisfy honestly:
CWC is the correct authority for Brahmaputra river-stage data, its licence has never been
verified, and inventing a plausible discharge figure is precisely the defect `PRODUCT.md` §4
forbids. A user-chosen level is a _control input_, not a measurement, so labelling it
correctly costs nothing — where the water sits is something the user set, not something the
project claims to know. This is a scope reduction, not a design change: it makes FLOW smaller
and more honest, and it defers the CWC research rather than abandoning it. **Reversed by:**
CWC's licence being verified and a cited discharge series being added, at which point FLOW
can offer observed discharge as an additional, clearly-labelled input. See `docs/DATA.md` §9.

## 4. ASDMA — link only, never bundle

**Date 2026-10-01.** ASDMA is **linked and cited, never bundled.** No ASDMA map, inundation
layer, report or document may be redistributed through this repository. ASDMA's policy pages
(`/policy/disclaimer`, `/policy/copyright-policy`, `/policy/terms-use`) all return HTTP 200
with **completely empty bodies**, so no licence text exists to quote, and the flood
documents the site links to return 200 with empty content bodies as well. Combined with the
absence of any explicit redistribution grant, the only defensible posture is to treat
ASDMA as a link. This costs us the locally authoritative flood material, and that is the
correct trade: for the audience this project actually serves — students in Assam who need
real warnings — sending them to ASDMA is more useful than shipping a cached copy with
unknown terms. **Reversed by:** explicit redistribution permission in writing from ASDMA,
quoted verbatim in `docs/DATA.md` §8. See `docs/DATA.md` §8.

## 5. Assamese copy — DRAFT until reviewed by the owner

**Date 2026-10-01.** **All Assamese strings in `src/shared/i18n/strings.ts` are marked DRAFT
and require review by the owner, a native speaker, before phase 7.** The existing Assamese
was drafted from standard orthography by a non-native speaker and has been verified for
**glyph coverage only** — that the shipped font actually contains ৰ (U+09F0), ৱ (U+09F1) and
every other codepoint used, proven by parsing the shipped font binary in `tests/fonts.test.ts`.
Glyph coverage proves the characters _render_; it says nothing about whether the words are
_right_. Assamese is the primary language for this project's main audience, so shipping
machine-drafted copy as if it were reviewed would be a form of the same dishonesty this
project exists to avoid: an unmarked claim of authority the copy does not have. Native review
is a gate, not a nice-to-have, and it is cheap because the string count is still small. The
English is authoritative in the interim; Assamese is not to be treated as a translation of
record until reviewed. **Reversed by:** owner sign-off recorded against each string in
`docs/DECISIONS.md` or a linked review note.

## 6. Bird PB2002 plate boundaries — not shipped

**Date 2026-10-01.** **Bird's PB2002 plate boundary files are not shipped**, and PLATES must
not depend on them. No licence statement exists anywhere reachable — not in the directory
index, not in the complete README, not on the author's site root — and the ODC-By licence
that appears attached to PB2002 in some places belongs to a third party's GeoJSON conversion,
not to Bird's originals. Two acceptable paths exist, and **the choice is deferred to phase 2**:
either a plate-boundary source with a licence that can be quoted verbatim, or **tracing the
boundaries ourselves from cited published sources**, with every input cited. Self-tracing is
genuinely viable here because PLATES needs only the India–Eurasia boundary as a drawn line
for a cinematic, not a full global plate model — which is why this is a deferred choice and
not a blocked one. **Reversed by:** a verifiable licence for PB2002 itself. See
`docs/DATA.md` §4.

## 7. FLOW inputs are user-chosen scenarios, not observations

**Date 2026-10-01.** **Every FLOW input is a scenario the user sets.** Not one is a
measurement, an observation, or a forecast, and no future dataset may be wired in without
this decision being revisited first. This generalises decision 3: rather than saying only
"do not use CWC", it states the property that makes CWC unnecessary — if no input is an
observation, there is nothing for an observation feed to be compared against, and the honest
framing is available for free. A scenario needs no citation to be truthful, whereas a
plausible gauge figure needs a real one we do not have, so this is the cheapest integrity
available here. It also closes off the quiet failure mode in which a later contributor adds
"just the current river level" as a convenience, breaking a rule that was never written down.
The rule governs presentation as much as data: every scenario value is labelled as
user-chosen wherever it appears, the FLOW UI carries no station names, gauge figures or
dates, and any readout derived from a scenario inherits its label. This is also why
`FlowParams.dischargeM3s` is now `scenarioInflowM3s` — the name shipped a claim the project
could not support, and the type is where that claim would otherwise have lived permanently.
**Reversed by:** a cited, licensed observational source being added to FLOW as an
_additional_ input alongside the scenario control, at which point the labelling rule extends
to it. It may never replace the scenario control, because the scenario is what makes FLOW a
sandbox rather than a readout. See `PRODUCT.md` §4.3 and `docs/DATA.md` §9.

---

## 8. DEM — Copernicus GLO-30; three areas of Terrain-RGB, and an explicit vertical step

**Date 2026-10-01.** Terrain comes from **Copernicus DEM GLO-30 Public**, fetched from the
anonymous AWS Open Data mirror, and is committed as **Terrain-RGB PNG plus a JSON sidecar**
for three areas: `assam-overview`, `majuli`, `sadiya-dibrugarh`. The rejected alternatives
and the reasoning are in `docs/DATA.md` §11; the limitations that constrain the product are
in §12.

Four decisions inside that are worth stating separately, because in each case the obvious
implementation is wrong.

**The overview area is encoded at a 0.15 m vertical step, not 0.1 m.** 16-bit Terrain-RGB
holds 65,535 codes, so at 0.1 m the maximum span is 6,554 m. The overview's bbox includes
the Mishmi Hills to 7,446.5 m — a 7,447 m span — and therefore _cannot_ be encoded at 0.1 m
at all. At 0.15 m the budget is 9,830 m and it fits. This is not a shortcut: one step is
0.0003 of that area's 530 m pixel and an order of magnitude below the source's own 1.472 m
vertical error, so the coarsening gives away nothing. The step is per-area and recorded in
each sidecar, because it follows from the data's range rather than from the format.

**No-data is code 0 and is declared, never inferred.** The source sentinel −32767 exists
only in the tile's sidecar XML, not in any GeoTIFF tag, so a reader that trusts the GeoTIFF
alone reads −32.7 km as an elevation. Committed files reserve code 0 and record
`noDataPixels` per area; the decoder returns `NaN` plus an explicit mask, and
`encodeElevation` throws on an out-of-range value rather than wrapping.

**The source tile path is asserted, not trusted.** GLO-30 and GLO-90 differ only in pixel
spacing and live in adjacent buckets, and the GLO-30 tiles are named `COG_10_*` because
that number is arcseconds — so a glob for `_30_` silently returns terrain three times too
coarse, with no error anywhere. `assertSpacing` throws on any spacing that is not
1/3600°, names the mistake when it recognises it, and has a regression test.

**Pixel size is recorded as a pair, never a number.** GLO-30 is a 1 arcsecond angular grid,
so at Assam's latitude a pixel is ~31 × 28 m rather than 30 × 30. Any sidecar that recorded
a single "30 m" would be quietly wrong about every derived area and slope.

**What this does not establish.** The elevation checks are **self-consistency**, not accuracy
validation: a monotonic fall from Sadiya to Dhubri can catch a pipeline fault but cannot
detect an error in Copernicus itself. Two loose plausibility checks against published figures
are in place, one of them resting on a tertiary source. Proper validation needs benchmark
levelling data from the Survey of India or GSI, which we do not hold. Recorded as an open
gap in `docs/DATA.md` §13 and `docs/ROADMAP.md`. **Reversed or extended by:** a verified
bare-earth (DTM) source for NE India, which would remove the surface-model limitation that
most constrains FLOW; or benchmark levelling data, which would turn the plausibility checks
into real validation.

## 9. Terrain renderer — float32 heights, render on demand, and a stated exaggeration

**Date 2026-10-02.** Three choices that a reader of the render could not otherwise explain.

**Heights live in an R32F texture and are interpolated by hand in the shader.** The
alternative was packing elevation into an 8-bit or half-float texture, which is the
default-looking way to do this and is wrong here for a reason worth stating in metres
rather than adjectives. The two reaches encode at a **0.1 m** step, and 16 bits across a
1,742 m range is already a **6.5 m** step — larger than the _entire_ floodplain relief the
product exists to explain. Half float is worse: 11 bits of mantissa, so it sheds metres at
any plausible range. A quantised height field does not look like a bug; it looks like
terrain with suspiciously flat benches. Bilinear filtering is done in the shader rather
than by the sampler so the path never depends on `OES_texture_float_linear`, which is not
universal on mobile. Capability is **probed for real** — a 1×1 R32F texture is uploaded and
the GL error state read — and a device that cannot does so gets a stated error rather than
a black plane. See `docs/ARCHITECTURE.md` §7.

**Rendering happens on demand, never in a loop.** An idle viewer requests **zero** frames,
which is the whole point on a ₹8,000 Android. A frame is requested on camera input, resize,
parameter change, and area load. Damping looks like it needs a permanent loop and does not:
each step requests the next frame, and the chain ends when the camera settles. Termination
is decided by comparing the _remaining gap_, not by rounding the damping factor to zero —
a factor rounded to zero leaves the camera frozen without telling the caller it had
arrived, and the loop then runs forever. `tests/terrain-camera.test.ts` simulates the actual
loop and asserts it stops. Frames are also cancelled outright while the tab is hidden.

**Vertical exaggeration is stated, always, and defaulted per area.** At 1× the Brahmaputra
floodplain is flat, because a few metres of relief spread across tens of kilometres is a
sheet — the ridges that would make the landscape legible are not there at true scale. So the
default is per-area, chosen by one rule — make the area's own relief about a tenth of its
east–west extent — which gives 8× / 6× / 8× for the three areas. The alternative, a single
global default, would leave the 699 km overview unreadable at any value that suits a 114 km
island. The multiplier is **always visible** in the legend and beside the slider, because a
scene whose heights are multiplied by eight and does not say so misleads about every slope
in it. Contours are unaffected: they are drawn at true-altitude multiples, so a contour
means the same altitude whatever the exaggeration, which is the property that makes them
worth having. **Reversed by:** evidence that the honest presentation is 1× — which would
mean a different teaching aid entirely, a labelled cross-section rather than a landscape —
or a verified bare-earth source with enough vertical accuracy to justify a smaller
multiplier.

**One consequence, recorded here and fixed on 2026-10-02 — see decision 10.** The committed
encoding originally reserved code 0 for no-data and set `offset` to the minimum elevation,
so a real pixel sitting exactly at the minimum encoded as the no-data code and read back as
a hole: 1,938 cells on Majuli (0.09%) and 49 on the overview. The renderer treated those as
no-data, which is the safe failure — it shows "—" rather than inventing a number — but it is
not accurate, because those cells are data.

---

## 10. The no-data offset sits one step below the minimum, and the artefacts were migrated rather than rebuilt

**Date 2026-10-02.** Fixes the collision recorded as an open consequence in decision 9.
Two halves, and the second is the one worth arguing about.

**`offsetFor` now returns `floor(minElevation) - step`, not `floor(minElevation)`.** Code 0
is reserved for no-data, so the offset — the elevation of code 0 — has to sit strictly
below the lowest elevation that can occur. Flooring was not enough, and the reason is a
property of the source rather than of the code: GLO-30 flattens water surfaces and the
floodplain is a few metres of relief, so a real pixel sitting at exactly the floor
elevation is **common**, not exotic. It encoded to the reserved code and the decoder had no
way to know that was not a hole. The alternative fixes — reserving a different code, or
special-casing the minimum — both make the decoder carry knowledge the format does not have,
whereas lowering the offset by one step moves the entire problem into the encoder where it
belongs. The cost is 0.1 m of additional span against a 65,535-code budget the overview
already spends 48,873 of, and 0.15 m on the overview, where one step is 0.0003 of a pixel.
The invariant is asserted twice: per area over the committed files, and as a unit-level
property of `offsetFor` across several steps and minimum elevations, so a future caller
passing a different step cannot silently reintroduce it.

**The committed artefacts were migrated, not rebuilt.** `npm run data:dem` was **not**
re-run — it reads 46 Copernicus COG tiles over HTTP, and a rebuild was not warranted for a
purely arithmetic encoding change. Instead `scripts/migrate-nodata-encoding.ts` transformed
the committed bytes: every code `+1`, each sidecar offset `−step`. That is exactly
invertible under `code * step + offset`, since `(c+1)*step + (O−step) === c*step + O`, so
**no pixel's elevation changed**. Measured across all 6,635,948 pixels: zero differ in the
float32 values the decoder delivers; the worst float64 deviation between the two
algebraically identical forms is 2.2e-16 relative, one ULP, which vanishes on narrowing to
float32. The 1,987 previously-discarded cells are now code 1 and decode to the elevation
they always held; **0 holes remain** in all three areas.

The migration **refuses to run** if any sidecar reports non-zero `noDataPixels` or
`sourceNoDataPixels`. That guard is the whole reason it is safe: after the fact a genuine
hole is indistinguishable from the collision, so promoting one to code 1 would invent
terrain out of nothing. All three read 0, which is what makes the transform lossless.

**What is recorded as unverified.** Byte-identical reproducibility. The files were never
rebuilt from source against the fixed encoder, so it is not established that
`npm run data:dem` would produce these exact bytes. The migration uses the same
`PNG.sync.write` call with the same options as the pipeline, which is the strongest claim
available offline, but it is a claim and not a measurement. Every sidecar and the manifest
carry a `migration` block with `pipelineRebuilt: false` and
`reproducibilityVerified: false`, so the artefact itself does not claim a reproducibility
it does not have. `docs/DATA.md` §13 states it in prose, and `docs/ROADMAP.md` phase 2
carries an unchecked item to rebuild one area and compare hashes.

**Reversed or extended by:** rebuilding any area from source and finding a hash difference,
which would mean the migration and the pipeline disagree somewhere — most plausibly in PNG
encoder options, which is why the options are duplicated verbatim rather than imported.
Extended by any future area whose source contributes genuine no-data: those cells must
stay code 0, the count will be non-zero, and the sidecar's `noDataPixels` becomes a real
measurement rather than a formality.

---

## 11. Owner-requested interactive atlas prototype

**Date:** 2026-10-03. The owner asked to build the visually distinctive Assam
flood/earthquake/plate experience, expanding the foundation scope.

Use Natural Earth author-maintained GeoJSON for small cartographic extracts and
ComCat event parameters for recorded history. Licences and source hashes are in
`DATA.md` §14. USGS policy text is now transcribed directly in §3, resolving the
older transcription gap in decision 2.

Plate motion remains an explicitly schematic teaching diagram; no PB2002 data,
unsourced boundary tracing, rate or geological date ships. This delivers the
mechanism while the measured geographic opener remains open. Historical NASA
flood reports are linked and never treated as simulation inputs or inundation maps.

FLOW starts with a depth selected by the user near mapped centrelines on the
unchanged DEM. Optional scenario inflow defaults to zero. Remove the artificial
channel-burning routine: repeatedly overlapping cuts produced fictitious canyons,
while the renderer still displayed the original terrain. The display now drapes
simulated depth over the same terrain mesh without modifying measured heights.
This is an illustrative starting condition, not riverbed bathymetry or an observed
river level. Conservation is checked against the headless CPU equations.

Assamese additions remain a review draft; glyph coverage and bilingual browser
rendering are verified independently of linguistic approval.

---

## Superseded

_(none yet — this is the first decisions record)_

## Related documents

| Question                                  | File                |
| ----------------------------------------- | ------------------- |
| What must an agent not change?            | `AGENTS.md`         |
| Why are these decisions necessary at all? | `PRODUCT.md` §4, §6 |
| Evidence behind decision 1                | `DESIGN.md` §4.3    |
| Evidence behind decisions 2–4, 6–8        | `docs/DATA.md`      |
| Which phase acts on each decision         | `docs/ROADMAP.md`   |
