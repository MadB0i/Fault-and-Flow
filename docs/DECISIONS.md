# DECISIONS.md

Decisions taken by the project owner, recorded so they are not relitigated from memory.

**Format:** one short paragraph per decision, dated, with what would reverse it. A decision
without a stated reversal condition becomes a superstition, and a superseded decision that
was never written down gets re-argued six months later.

This file records decisions, not research. The evidence behind each one — licence text,
computed ratios, HTTP responses — lives in `docs/DATA.md` and `DESIGN.md`, cross-referenced
below.

| # | Decision | Date | Status |
| --- | --- | --- | --- |
| 1 | Terrain and deep-water contrast: keep values, document exception | 2026-10-01 | Settled, re-check in phase 7 |
| 2 | USGS ComCat: `UNVERIFIED`, do not bundle | 2026-10-01 | Blocked, awaiting owner |
| 3 | CWC discharge data: out of scope; FLOW uses user-controlled level | 2026-10-01 | Settled |
| 4 | ASDMA: link only, never bundle | 2026-10-01 | Settled |
| 5 | Assamese copy is DRAFT until owner review | 2026-10-01 | Open, blocks phase 7 |
| 6 | Bird PB2002: not shipped | 2026-10-01 | Blocked, decide in phase 2 |

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

## 2. USGS ComCat licence — `UNVERIFIED`; do not bundle until resolved

**Date 2026-10-01.** The USGS ANSS Comprehensive Catalog licence stays **`UNVERIFIED`** and
**no USGS data is bundled** into this repository, committed or fetched at build time. The
`usgs.gov/policies-and-notices` pages return an HTTP 202 JavaScript robot-check interstitial,
so the terms have never actually been read, and a search-result snippet is not a source. The
blocker is now explicitly **the owner pasting the attribution text from usgs.gov in a real
browser** into `docs/DATA.md` §3; the attribution wording matters as much as the licence
status, because it is what a downstream user must reproduce. A plausible-sounding
"USGS content is public domain" claim would be exactly the fabrication `AGENTS.md` §6 exists
to prevent, and would land in a public repo that anyone may build on. **Reversed by:** the
verbatim terms being pasted from the official page. Until then FAULT has no event data and
says so. See `docs/DATA.md` §3.

## 3. CWC discharge data — out of scope; FLOW uses a user-controlled river level

**Date 2026-10-01.** **Central Water Commission discharge and river-stage data is out of scope
for now.** FLOW will be driven by a **user-controlled river level** rather than by observed
or modelled discharge. This removes a dependency the project cannot yet satisfy honestly:
CWC is the correct authority for Brahmaputra river-stage data, its licence has never been
verified, and inventing a plausible discharge figure is precisely the defect `PRODUCT.md` §4
forbids. A user-chosen level is a *control input*, not a measurement, so labelling it
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
Glyph coverage proves the characters *render*; it says nothing about whether the words are
*right*. Assamese is the primary language for this project's main audience, so shipping
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

---

## Superseded

*(none yet — this is the first decisions record)*

## Related documents

| Question | File |
| --- | --- |
| What must an agent not change? | `AGENTS.md` |
| Why are these decisions necessary at all? | `PRODUCT.md` §4, §6 |
| Evidence behind decisions 1 | `DESIGN.md` §4.3 |
| Evidence behind decisions 2–4, 6 | `docs/DATA.md` |
| Which phase acts on each decision | `docs/ROADMAP.md` |
