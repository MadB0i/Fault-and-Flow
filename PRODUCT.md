# PRODUCT.md

> **One plate pushes. One river answers.**

**Fault & Flow** is an interactive 3D sandbox of Assam's earth and water, running
entirely in the browser. No backend, no accounts, no tracking. Everything is client-side.

This document is the product's contract. Where an implementation decision conflicts with
something written here, the conflict is a bug in the implementation, not a refinement of
the product. `AGENTS.md` is binding on any agent editing this repo.

---

## 1. Who this is for

| Audience                            | What they arrive wanting                                                           | What we give them                                                                                      |
| ----------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| **Students in Assam** (ages ~14–22) | "Why does the Brahmaputra break its banks here? Why did the ground shake in 1950?" | A place they can _touch_ the answer — move a slider, watch water cut a bank, scrub 100 years of quakes |
| **Curious public**                  | "I've heard about the 1950 Assam earthquake. Show me."                             | A three-minute cinematic they can reach from a link, no install                                        |
| **Developers on GitHub**            | "Is this real? What's the stack? Can I trust the numbers?"                         | Open source, MIT, reproducible data pipeline, honest citations                                         |

The primary reader is a **student in Assam**. This is not a Western museum piece about a
place that is not theirs — the interface ships in **Assamese and English** from the first
usable build, and every dataset is about the Brahmaputra valley and NE India specifically.

---

## 2. Goals

1. **Make the coupling visible.** The Himalaya rises; the Brahmaputra carries the debris;
   the delta floods. One plate pushes, one river answers. The two primary experiences, FLOW and FAULT, are
   supported by the secondary "Why Assam shakes" plate explainer. The visitor can
   explore the connections without three competing primary navigation choices.
2. **Run on a phone.** A student on a ₹8,000 Android in Guwahati has the same access as
   someone on a laptop. Target: usable at 390px, 60fps on mid-range hardware.
3. **Zero friction to entry.** A URL. No signup, no backend, no API keys, works offline
   after first load.
4. **Earn trust through verifiable data.** Every number traceable to a named source with
   a real licence. Where we do not know, we show "—" and say so.
5. **Be bilingual in substance, not just strings.** Assamese is a first-class
   rendering path with its own verified typeface, not a find-and-replace.

---

## 3. Non-goals

Stating these plainly saves us from a hundred feature arguments later.

- **Not a forecast tool.** We do not predict floods or river stage. See §4.
- **Not a hydrology product.** We present no observed, forecast or modelled river data as
  though it were live. FLOW runs on scenarios the user sets. See §4.3.
- **Not a hazard map.** No evacuation routes, no safe/unsafe zones, no parcel-level risk.
- **Not an early warning system.** There is no official warning to display; we will link
  to the bodies that do.
- **Not a research instrument.** No peer-reviewable analysis, no novel hydrology. Where we
  approximate, the approximation is labelled.
- **Not a surveillance or civic-control product.** No user accounts, no geolocation, no
  telemetry. We do not want to know who opened it.
- **Not a 3D showpiece first.** A cinematic that cannot be trusted is worse than a plain
  chart. Honesty outranks spectacle; the "one memorable moment" must be the _insight_,
  not the rendering.
- **Not India-wide.** Assam and the Brahmaputra valley. Expanding scope is a new product.
- **No mobile app.** Web only, PWA at most. The constraint is what makes it shareable.

---

## 4. Honesty rules — non-negotiable

These are product requirements, not copy suggestions. They appear on-screen, and they
govern every number, label, and animation in the app.

### 4.1 Not a forecast, not a hazard map

The sandbox must never present a visual as a prediction. The correct framing is
**"here is what happened"** (historical, from data) and **"here is what this process does"**
(mechanism, from simulation). The forbidden framing is **"here is what will happen"**.

- "Scenario inflow 12,000 m³/s — a value you set" — allowed. It names itself as chosen.
- "Observed discharge at Dibrugarh: 41,200 m³/s" — forbidden. We hold no observed discharge
  data at all (§4.3), so any figure presented as one would be fabricated.
- "Expected flood level on 15 June" — forbidden.
- "This bank will collapse" — forbidden. "This bank erodes fastest where the channel turns
  sharply" — allowed, because it describes the mechanism, not a prediction.

### 4.2 Earthquakes cannot be predicted

This is the single most important line in the product.

> **Earthquakes cannot be predicted.** No one can tell you when or where the next one will
> happen, or if it will happen tomorrow. Nobody — not us, not any government, not any
> research group worldwide.

- Never imply prediction. Never use future-tense language about an upcoming earthquake.
- FAULT mode replays **recorded history**. It is a timelapse of the past.
- Any "shake" illustration is explicitly labelled as an **illustration of ground motion**,
  not a simulation of a specific future event.
- If a quake marker is placed at a real historic epicentre, the magnitude, date and depth
  come from a cited catalogue. If we generate a synthetic shake for demonstration, the UI
  says so in the same breath.

### 4.3 FLOW is a sandbox on real terrain, driven by scenarios the user sets

- FLOW runs on **real terrain** — a Copernicus DEM of the Brahmaputra valley — but on **no real
  hydrology**. The user sets a river level or an inflow scenario, and the water engine
  responds to it.
- **Every FLOW input is a user-chosen scenario.** A scenario value is not a measurement, not
  an observation, and not a forecast. This product holds **no observed or gauge-record
  discharge data**, and no FLOW number may be presented as if it did. See
  [`docs/DECISIONS.md` §3](docs/DECISIONS.md).
- Scenario values are **illustrative**, and the UI labels them as the user's own input so
  nobody reads a chosen number as a reading of the river.
- The water engine's parameters (roughness, infiltration, channel geometry) are chosen for
  legibility and speed, then documented in `docs/ARCHITECTURE.md`.
- A scenario that produces something alarming must still not be presented as a prediction for
  a place, a date or an event. The mechanism is the lesson; the numbers are the user's.

### 4.4 Unknown is a value

- An unavailable measurement renders as **"—"** with an accessible name explaining why.
  Never `0`, never a guess, never a plausible-looking constant.
- "—" is a first-class state with its own styling and its own empty-state copy.

### 4.5 Point at the authorities

Every mode that touches real-world risk links the official sources, so a user who needs
_actual_ information leaves us and goes to the people who publish it:

| Body                                                                 | URL                           | What they publish                                                 |
| -------------------------------------------------------------------- | ----------------------------- | ----------------------------------------------------------------- |
| **ASDMA** — Assam State Disaster Management Authority                | <https://asdma.assam.gov.in/> | Assam Flood Report, inundation mapping, DRR roadmap               |
| **NCS** — National Center for Seismology, Ministry of Earth Sciences | <https://seismo.gov.in/>      | Earthquake catalogue, seismological bulletins, real-time portal   |
| **IMD** — India Meteorological Department                            | <https://mausam.imd.gov.in/>  | Warnings, quantitative precipitation forecast, hydrology services |

> **Note on NCS's domain.** The National Center for Seismology is at `seismo.gov.in`.
> `seismology.gov.in` does not resolve. Verified 2026-10-01. See `docs/DATA.md`.

IMD's own site disclaimer is directly on point and worth quoting verbatim in the app's
footer (from <https://mausam.imd.gov.in/responsive/disclaimer.php>):

> "This Ministry of Earth Sciences (MoES) website is intended for information to the general
> public based on the real time data. The information contained in this website is subject
> to the uncertainties of scientific and technical research and is liable to change without
> notice. It is also not a substitute for independent professional advice."

Our own disclaimer must be **stronger and clearer** than that, because a 3D scene is more
persuasive than a table of numbers and so is more likely to be over-trusted.

---

## 5. The three modes

### PLATES — the cinematic opener

_From the collision to the valley._

The India–Eurasia collision rendered as it is understood: the Indian plate driving north
at a few cm/yr, the Himalaya rising, the crust shortening. Then the camera **flies down**
from the Himalaya along the Brahmaputra into Assam, arriving at the sandbox. ~30–45 seconds,
skippable, and it re-plays on demand.

- Purpose: establish _why_ the landscape exists before asking anyone to play with it.
- Data: plate boundary geometry (see `docs/DATA.md` — licence **UNVERIFIED**, do not ship
  until resolved), qualitative convergence rate.
- Honesty: convergence rates are from published geology, cited. The _motion_ is a
  visualisation of a rate, not a geological reconstruction of a specific date.

### FAULT — the earthquake timelapse

_A hundred years of the ground shaking._

North-east India sits in one of the most seismically active regions on Earth. Scrub a
timeline from 1900 to the present and watch real earthquakes appear at their real
locations, sized by magnitude, at their real dates.

- Purpose: make the **historical record** tangible, and make clear that the record is all
  we have — the future is not knowable.
- Data: USGS ANSS ComCat (licence status **UNVERIFIED** — see `docs/DATA.md`), with NCS
  linked as the Indian authority.
- Honesty: every marker is historical and cited. The "shake" is labelled an illustration.
  A permanent, dismissable notice states that earthquakes cannot be predicted.
- A magnitude-7+ event triggers an expanding seismic ring — this is the **one memorable
  moment** of the whole product, and it is a real event being marked, not theatre.

### FLOW — the flood sandbox

_The river moves; the bank gives way._

Real terrain of the Brahmaputra valley. You set a river level or an inflow scenario, water
flows across the DEM, and where the flow meets a bank it erodes it — visibly, over time.
Raise the scenario and watch where the channel migrates.

- Purpose: teach the _mechanism_ of bank erosion and channel migration by direct
  manipulation, which no map or chart can do.
- Data: Copernicus DEM GLO-30 (licence **VERIFIED**, with mandatory DLR/Airbus
  attribution). **No hydrological data** — see §4.3.
- Inputs: the level or inflow is a **scenario the user sets**, never an observation.
- Honesty: the model is simplified and labelled as such. It is **not** a flood forecast. It
  does **not** predict inundation for any real date.
- Every eroded cell is "modelled", not "measured". Every input is "scenario", not "observed".
  The UI must not blur either line.

---

## 6. Success criteria

### Honesty (the ones that matter most)

- [ ] No screen, label, tooltip, or export implies prediction or forecast.
- [ ] "Earthquakes cannot be predicted" appears in FAULT mode, dismissable but
      re-encountered, and in the app's about/footer.
- [ ] Every **measured** number traces to a row in `docs/DATA.md` with a licence and a URL.
      Every **scenario** number is labelled as user-chosen. Neither is ever presented as the
      other.
- [ ] Every unknown renders as "—" with a reason, never as a placeholder value.
- [ ] A non-specialist who reads only the UI could not mistake this for an official
      product. (Test: show a screenshot to someone unfamiliar with the project and ask
      "does this look like an official warning?" — the answer must be no.)
- [ ] A non-specialist who reads only the UI could not mistake a FLOW scenario value for a
      measurement of the river.

### Usability

- [ ] First meaningful paint in under 3s on a mid-range phone over 4G.
- [ ] Usable and legible at 390px wide and at 1440px wide.
- [ ] Full keyboard operability; visible focus everywhere; no keyboard trap.
- [ ] Zero WCAG 2.2 AA violations from an automated axe scan of each mode.
- [ ] A student who has never seen the project can reach a "oh, _that's_ why" moment in
      under 3 minutes without instructions.

### Open-source health

- [ ] `npm run verify` green on a clean clone.
- [ ] Data pipeline reproducible from `scripts/` with no manual steps.
- [ ] Every asset traceable to a licence quoted verbatim in `docs/DATA.md`; anything
      unverifiable is marked `UNVERIFIED` and excluded from the build.
- [ ] Both UI languages complete — no English-only string left in an Assamese session.

---

## 7. Known risks

| Risk                                        | Why it is real                                                                                 | Mitigation                                                                                                                                               |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A 3D flood looks like a forecast**        | Fluids in motion read as prediction. This is the single most likely way to mislead.            | Persistent "illustrative model" framing in FLOW; every input labelled as a scenario the user set; no date-bearing controls; never a "forecast for" label |
| **A scenario value reads as a measurement** | A plausible number beside a plausible river invites the reader to treat it as a reading of it. | Inputs named as scenarios in the control, the readout and the legend; no gauge figures, no station names and no dates anywhere in FLOW (§4.3)            |
| **DEM size**                                | GLO-30 tiles are large; a naive commit would blow the repo past 5 MB                           | Tiles stay in `data/raw/` (gitignored); commit a small preprocessed extract or fetch at build time                                                       |
| **Licence ambiguity**                       | USGS ComCat and Bird PB2002 licences could not be verified; NCS is explicitly restrictive      | Do not ship unverified data. Link and cite instead. See `docs/DATA.md`                                                                                   |
| **Assamese glyph coverage**                 | Assamese uses ৰ (U+09F0) and ৱ (U+09F1), which many Bengali-subset fonts lack                  | Test the shipped font file for the codepoints we actually use; do not assume                                                                             |
| **Mobile GPU limits**                       | A full-screen 3D scene can tank a mid-range Android                                            | Cap DPR, reduce terrain resolution on small screens, keep the engine headless-testable                                                                   |
| **Scope creep into "wow"**                  | 3D invites spectacle over honesty                                                              | Every mode must pass §6 honesty criteria before visual polish is considered done                                                                         |

---

## 8. Where to look

| Question                                                   | File                   |
| ---------------------------------------------------------- | ---------------------- |
| What may an agent change, and what is forbidden?           | `AGENTS.md`            |
| How is the code split between engine and UI?               | `docs/ARCHITECTURE.md` |
| Where did each dataset come from, under what licence?      | `docs/DATA.md`         |
| What are the colours, type, and motion values?             | `DESIGN.md`            |
| What gets built next?                                      | `docs/ROADMAP.md`      |
| Why is FLOW a scenario sandbox rather than real hydrology? | `docs/DECISIONS.md` §3 |

## Current implementation scope — 2026-10-03

The owner requested a visual Assam atlas spanning the three modes. This expands
the earlier foundation-only work into an interactive prototype:

- FLOW: real Copernicus terrain, mapped Natural Earth rivers and state outlines,
  user-chosen starting depth and optional inflow, illustrative GPU water spread.
- FAULT: a sourced M5+ ComCat subset, dated replay, selectable event records and
  visual emphasis rings and a separate synthetic motion demonstration. Rings are not shaking or damage footprints.
- PLATES: an original conceptual collision diagram. Its shapes, strata, progress,
  movement and relief are schematic, without a measured plate boundary or rate.
- Historical flood reports: three link-only NASA episodes, separate from the
  scenario. No historical inundation footprints or calibrated replay is claimed.
- Both languages, responsive controls, explicit risk framing, official links and
  local PNG export with notices and attribution inside the image.

Bank erosion, calibrated hydrology, actual shaking effects, a sourced boundary
map and the geographic camera-flight opener remain outstanding. Native-speaker
review of Assamese and physical-device performance validation remain open.
The honesty rules above continue to govern every mode and exported image.

The follow-up depth-view work adds a solver cross-section and labelled depth bands
to FLOW, with full-Assam-only FAULT controls and terrain-following illustrative
earthquake waves. The section shows water above resampled DEM heights. It contains
no surveyed riverbed, subsurface strata, pore-pressure field or calibrated shaking.
