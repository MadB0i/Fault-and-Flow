# Atlas implementation review — 2026-10-03

The first impression is a geographic atlas: the terrain dominates, with river and
seismic accents tied to the active mode. The serif title establishes an editorial
identity; the bottom dock holds the scenario or timeline action. The mobile layout
keeps the map above its controls. Evidence is in `docs/screenshots/` at 1440 × 900
and 390 × 844, with all three modes in both languages.

## Confirmed defects fixed

- **P1 — artificial water creation:** clamped incoming flux at the simulation
  boundary duplicated outgoing flow. Explicit neighbour bounds now agree with the
  independent CPU solver. The browser regression measured GPU volume
  408.03785283567464 m³ and CPU volume 408.03784747105 m³, against scenario input
  408.04015978989014 m³. This is a numerical regression, not hydrologic validation.
- **P1 — invisible/misaligned water:** the display shader and engine used different
  world-size uniform names and inconsistent north-first coordinates. They now
  share the terrain orientation and full-resolution display heights. The legacy
  channel-cut function was removed; scenario seeding never changes the DEM.
- **P2 — unreadable map framing:** the old camera formula divided by its projected
  angle and made the terrain small. Projected-corner checks and both-width pixel
  review now verify the framing.
- **P2 — label collisions:** place labels overlapped on narrow maps, and plate
  labels shared screen space. Measured text bounds now suppress overlapping place
  labels; separate plate anchors and mobile sizing keep the diagram readable.
- **P2 — modal focus:** closing the mobile layer dialog lost the invoking control.
  Native dialog close handling now restores focus. Keyboard and Escape checks pass.
- **P2 — irrelevant controls:** the plate diagram no longer shows geographic layer
  controls. The unused legacy water panel and mode helper were removed.

## Verification

- `npm run verify`: formatting, lint, TypeScript, 152 unit tests and production build.
- Native Python Playwright: 32 desktop/mobile checks, including both languages,
  axe, keyboard camera input, dialog focus, failed-load retry, flood reset,
  earthquake replay, attributed PNG download and GPU/CPU conservation.
- `npm run shots`: 12 mode/language/viewport combinations. Actual PNGs reviewed,
  including the exported map with embedded notice and required DEM credit.
- Existing palette contrast results remain unchanged. Decorative terrain/water
  exceptions remain documented in `DESIGN.md`; no palette substitution was made.

## Remaining limits

Historical floods are sourced reports, without inundation footprints. Water is an
illustrative chosen scenario; bank erosion and calibrated hydrology are absent.
Earthquake markers represent catalogue parameters, without damage or measured
shaking footprints. Ground-motion demonstration and plate geometry are explicitly
synthetic. The geographic camera-flight opener remains outstanding.

Assamese glyph coverage passes; native-speaker copy review is pending. Browser QA
used headless Chromium with software WebGL, so physical-device frame-rate claims
are unverified. The production build still warns about JavaScript chunks above
300 kB (approximately 386 kB app and 496 kB Three.js, before gzip). No current
official alert was verified or asserted. Downloads and temporary profiles for this
work were kept on the project drive.
