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

- `npm run verify`: formatting, lint, TypeScript, 162 unit tests and production build.
- Native Python Playwright: 56 desktop/mobile checks, including both languages,
  axe, keyboard camera input, dialog focus, failed-load retry, flood reset,
  earthquake replay, attributed PNG download and GPU/CPU conservation. New checks
  verify depth paint without resetting the solver, a moving cross-section,
  updated depth after a scenario change, full-Assam-only FAULT controls and normal
  earthquake animation alongside reduced-motion coverage.
- `npm run shots`: 22 screenshot/layout checks across modes, languages, viewports, depth sections and portrait sharing. Actual PNGs reviewed,
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
300 kB (approximately 424 kB app and 495 kB Three.js, before gzip). No current
official alert was verified or asserted. Downloads and temporary profiles for this
work were kept on the project drive.

## Follow-up visual inspection

Depth-section PNGs at both widths and in both languages show the same A–B markers
and model column. The mobile chart sits below the 3D map, rather than obstructing
it. Essential desktop depth/height values remain above the region controls;
method notes are reachable by scrolling the section. A mobile depth legend
overlap with the region selector was fixed by separating their vertical anchors.
The normal-motion earthquake capture confirms wave-front geometry changes on the
terrain; radius/timing remain synthetic. No new scientific dataset was added.

## District and premium interface follow-up

The 35-name OSM extract is documented separately in `DATA.md`. District search,
empty results, district focus, centre wheel input, zoom buttons and share-link
restoration pass at both widths. Its administration-centre anchors are not legal
district boundaries. Leader lines retain the sourced anchor when a desktop label
separates from nearby text; phones declutter labels and keep the full directory.
Source Assamese names have verified glyph coverage; missing translations retain
source English names.

Actual pixel review found two layout defects in this change: dense phone labels
crossed the title and tools, and the cross-section toolbar inherited a static
position below the chart. Label safe areas and a canvas-relative toolbar anchor
fix them. A bounding-box regression requires the tools to remain within the
canvas when the chart is open. Plate labels now have a legible screen-space size
and their cached layout is invalidated on diagram rebuilds. Computed tool bounds
and document widths were checked at 1440 and 390; no horizontal overflow was found.
The existing tokens supply the segmented header, framed map, compact HUD and
bottom dock. No colour token, font dependency or icon set was changed.

Fresh USGS retrieval succeeded for 2026-10-03 UTC. Failed, empty and invalid
responses retain the exact last good catalogue bytes in offline unit checks.
At the time of this local review, automated remote updates were prepared but
had not been deployed. Publication setup is documented in [Data updates](DATA_UPDATES.md).
Physical-device performance and native-speaker translation review remain pending.

## Map-first exploration and portrait sharing — 2026-10-03

The desktop map now measures 1408 × 614 CSS pixels at a 1440 × 900 viewport.
Its display title is 31.248 CSS pixels (the existing step-3 token); the dock uses
16/32-pixel token padding. At 390 × 844 the map is 390 × 438.875 CSS pixels and
Play ends at y=754.875, within the first viewport. No horizontal overflow was
observed. These are measured layout values, not performance targets.

- **P2 — map crowded by permanent controls:** compact headings and the opt-in
  detail dock leave the map dominant. A named district action and Share stay on
  the map; geographical controls use the native modal at both widths.
- **P2 — small phone overview:** a portrait camera frames the valley vertically.
  District leaders are limited to nearby placements; zoom and the searchable
  directory retain all 35 names without long lines crossing neighbouring terrain.
- **P2 — Share obstructed by expanded controls:** the desktop toolbar sits at the
  map's lower edge, so expanding inflow controls cannot move it over Share.
- **P2 — plate-label overlap:** screen-space separation ignores invisible map
  groups and restores anchors each layout pass, preventing label drift.
- **P2 — incomplete shared FLOW context:** links now validate and restore the
  region, chosen starting depth and chosen inflow. No link starts water or claims
  to reproduce elapsed simulation output. The full-Assam FAULT scope remains.

Portrait exports are static 1080 × 1920 PNGs with a preview of the central crop,
district/region title, chosen settings, educational notice and wrapped credits.
Phone captures temporarily raise rendering resolution for the export and restore
the live buffer afterwards. PLATES cards cite the conceptual geology source;
geographic cards retain the DEM, Natural Earth and OSM credits as applicable.
The full-view PNG download remains separate. An image-capture failure leaves the
copyable link available; the share sheet can be reopened to retry.

The updated screenshot suite covers both widths, all three modes and languages,
the depth section and portrait/share states. Actual English and Assamese pixels
were inspected, including plate-label separation and exported text. New browser
regressions check first-screen Play, portrait dimensions, unchanged live resolution
and terrain after export, shared scenario restoration, and failed-capture recovery.

No dependencies or scientific datasets were added; no colour token changed.
Native-speaker translation review, a physical-phone performance pass and a manual
screen-reader pass remain outstanding. Video export, a before/after comparison
and a guided camera-flight introduction are not part of this change. No remote
publication or activation of the existing scheduled refresh was performed.

## Navigation, magnitude symbols and settlement follow-up (2026-10-03)

The primary drag now moves the map, with visible Move map / Rotate 3D controls,
keyboard equivalents, right/middle drag, combined two-finger pan/pinch and
pointer-anchored double-click zoom. All regions permit closer inspection.
District focus retains the camera's orientation; close cameras remain above the
exaggerated rendered terrain.

Historical symbols use magnitude bands and readable screen sizes. Their bases
follow the tessellated terrain, including steep slopes and data gaps. The visible
legend identifies magnitude rather than local shaking. Selected records retain
their magnitude type, depth and catalogue source.

PLATES adds an original miniature settlement, illuminated windows, roof details,
schematic roads, crustal strata and an underthrusting tongue. Building visibility
and chosen motion strength are controllable. No actual building survey, local
hazard map, damage prediction or future earthquake forecast is claimed. The dated
ASDMA 2022 context is cited separately from the diagram. Collision progress updates
existing objects; it does not regenerate the settlement each frame.

New magnitude text colours pass AA on all three HUD surfaces: light red **9.15 /
8.35 / 7.50:1**, red **6.01 / 5.49 / 4.92:1**, as computed by `npm run contrast`.
The two pre-existing terrain/deep-water decorative exceptions remain documented
in DESIGN.md. Native-speaker Assamese review, a manual screen-reader session and
physical-phone performance testing remain outstanding. No dependency was added.

Validation: `npm run verify` passes (166 tests across 15 files); the native Python
browser suite passes 64 checks. Screenshot generation passes 26 layout/axe checks
and updates 28 PNGs. Actual 1440px and 390px English/Assamese renders were inspected,
including the expanded building controls. The updated earthquake portrait's text
fits its 1080 × 1920 frame in both languages. Temporary browser caches are kept on
D: and excluded from lint; no cache or reference PDF is committed.

## Final exploration and release pass

First impression: the terrain reads as the main exhibit; FLOW/FAULT provide two
clear starting choices. Run scenario or Play history is the primary action.
Fraunces headings, restrained water/seismic accents and the data typography retain
the field-atlas identity. The collision diagram now has a secondary educational
entry, "Why Assam shakes", rather than competing in the primary rail.

Confirmed improvements from actual 1440px and 390px renders:

- **P1 — dots without a direct inspection path:** stationary clicks/taps now open
  the sourced event record. A closest-symbol 44 CSS pixel target helps touch use;
  double-clicks remain zoom, drags and pinches do not select. Magnitude filtering
  affects both the scene and its accessible record selector. The keyboard path
  remains available, and focusing an epicentre closes the native dialog.
- **P1 — unclear scenario comparison:** one-camera scissored rendering keeps the
  wet right side unchanged and removes scenario water from the left. Browser
  pixel checks exclude the divider handle and confirm both behaviours. The native
  map handle and companion slider support dragging and keyboard input, bounded
  to 5–95 percent. Dry/scenario labels name the two views.
- **P2 — district discovery ending at a name:** district context now links the
  nearest five original records and regional flood reports. Approximate distances
  explicitly use administration-centre anchors, not district boundaries or risk.
- **P2 — weak record hierarchy:** the event magnitude uses `--step-3`/data type.
  Computed values at both widths are **31.248px**, JetBrains Mono/Noto Sans Bengali,
  with the full-red token **rgb(255, 79, 100)** for the selected M7+ example. The
  modal radius is the established **10px** token; no new palette was introduced.
- **P2 — export without a moving share format:** a local silent WebM preserves
  the portrait labels/credits while the map moves. Decoded browser frames at two
  timestamps differ, and dimensions are 720 × 1280. Context is labelled at the
  recording start. Missing MediaRecorder or WebM codecs preserve PNG/link sharing.

The paced tour never starts water automatically. Lite is a display-resolution
choice, not a different simulation. A real-browser GIF is encoded with reserved
semantic accents so compression retains the earthquake colours; its file stays
below 5 MB. Release screenshots, source attribution and the professional README
are prepared locally. No dependency, fabricated scientific dataset, forecast,
live alert, public deployment or GitHub push was added.

Validation: `npm run verify` passes **170 tests across 16 files**. The core native
browser suite passes **64 checks**; the release suite passes **14 checks** for
comparison, direct symbol selection, source/district dialogs in both languages,
Lite resolution, the paced tour, actual changing WebM frames and recording
fallbacks. Screenshot generation passes **26 layout/axe checks**. Eight additional
feature screenshots document the comparison, picked events and district context.
All three portrait modes fit within 1080 × 1920 in English and Assamese; measured
text bounds stay within the export frame. Actual pixels were inspected, including
mobile controls, Assamese labels, source panels and decoded video frames.

Native-speaker Assamese review, physical Android performance and manual
screen-reader review remain outstanding. Automated viewport tests do not claim
physical-phone performance. Existing decorative terrain/deep-water contrast
exceptions and build-size warnings remain documented; no palette adjustment was
made in this pass. One transient browser execution-context/navigation interruption
was followed by a clean full core-suite run with the application sources stable.
