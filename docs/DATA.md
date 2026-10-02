# DATA.md

Every dataset this project uses or plans to use, with its real licence.

---

## How to read this file

**Licence text in this file is quoted verbatim from the source page.** Where a licence
could not be confirmed, the entry says **`UNVERIFIED`** and the dataset is **not shipped**.
This is the rule from `AGENTS.md` §6, and it is not negotiable: a fabricated licence claim
in a public repo is a legal problem for every downstream user.

Two distinctions that are easy to get wrong, and that this file keeps separate:

- **Using data is not redistributing it.** Public access does not imply redistribution
  rights.
- **A conversion inherits the converter's licence, not the upstream one.** A shapefile
  someone converted to GeoJSON on GitHub is governed by _that repo's_ licence unless the
  converter says otherwise.

Research was conducted **2026-10-01** by fetching each official page directly. Where a page
could not be read by a plain HTTP client, the **owner read it in a real browser** and the
entry is labelled accordingly. Status labels:

| Label                 | Meaning                                                                                                                              |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **VERIFIED**          | Official licence text retrieved and quoted from the source                                                                           |
| **VERIFIED BY OWNER** | Terms read by the owner in a real browser on the stated date. Not yet transcribed verbatim — treat as weaker evidence than VERIFIED. |
| **UNVERIFIED**        | Could not confirm from an official source. **Not shipped.**                                                                          |
| **RESTRICTIVE**       | Licence confirmed, and it forbids what this project needs                                                                            |

---

## Status summary

| Dataset                          | Purpose                     | Status                                                  | Ship it?                                                           |
| -------------------------------- | --------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------ |
| **Copernicus DEM GLO-30**        | Terrain, all modes          | **VERIFIED**                                            | Yes, with mandatory attribution                                    |
| **Natural Earth**                | Coastline, basemap fallback | **VERIFIED** (public domain)                            | Yes                                                                |
| **USGS ANSS ComCat**             | FAULT earthquake history    | **VERIFIED BY OWNER** (public domain, credit requested) | **Yes — event parameters only**, no product imagery (DECISIONS §2) |
| **Bird PB2002** plate boundaries | PLATES mode                 | **UNVERIFIED**                                          | **No** — no licence found anywhere (DECISIONS §6)                  |
| **SRTM**                         | Terrain alternative         | **UNVERIFIED**                                          | Not yet                                                            |
| **NCS (seismo.gov.in)**          | Indian earthquake authority | **RESTRICTIVE**                                         | Link and cite only                                                 |
| **IMD**                          | Weather / hydrology         | No licence asserted                                     | Link only                                                          |
| **ASDMA**                        | Flood authority, Assam      | **UNVERIFIED**                                          | **Link only — never bundle** (DECISIONS §4)                        |
| **CWC** discharge / river stage  | FLOW                        | Out of scope                                            | Not used — FLOW uses a user-controlled level (DECISIONS §3)        |

**Nothing from this table is committed to git in Phase 1.** These are research findings and
a plan, recorded now so the data pipeline can be built against verified terms later.

Decisions of record that govern this table live in [`docs/DECISIONS.md`](DECISIONS.md) —
notably §2 (ComCat), §3 (CWC), §4 (ASDMA) and §6 (PB2002). Where this file and
`DECISIONS.md` disagree, `DECISIONS.md` is the newer word.

---

## 1. Copernicus DEM GLO-30 — **VERIFIED**

Primary terrain source. 30m global surface elevation.

| Field           | Value                                                                                                                            |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Licence PDF     | <https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Data/DEM/resources/license/License-COPDEM-30.pdf>                |
| Collection page | <https://dataspace.copernicus.eu/explore-data/data-collections/copernicus-contributing-missions/collections-description/COP-DEM> |
| Retrieved       | 2026-10-01                                                                                                                       |
| Status          | **VERIFIED** — full text extracted from the official PDF                                                                         |

**Licence name (verbatim):**

> Licence for Copernicus DEM instance COP-DEM-GLO-30-F Global 30m Full, Free & Open —
> Licence for the use of the Copernicus WorldDEM-30

**Key terms (verbatim):**

> Copernicus data and information policy, regulated under European law, ensures access on a
> full, open and free-of-charge basis as a rule with rare exceptions when needed to protect
> the security interest of the Union and its Member States as well as third party IPRs.

> Copernicus is therefore making it available on a free basis for the general public under
> the terms and conditions of this Licence.

> **Article 4. Right of Use** — The Licensor grants to the User the following non-exclusive
> rights of use regarding the Copernicus WorldDEM-30: (a) reproduction; (b) distribution;
> (c) communication to the General Public; (d) adaptation, modification and combination
> with other data and information.

> **Article 5. Financial Conditions** — The use rights granted under this licence are free of
> charge to the User.

> **Article 7. Warranty and Liability** — The Copernicus WorldDEM-30 is made available to the
> Users 'as is'. The User uses it under its own responsibility.

> **Article 9. IPRs** — The Provider has not relinquished the IPR and related rights it or its
> licensors holds on the Copernicus WorldDEM™-30 and the User is not receiving any IPR titles
> on the Copernicus WorldDEM-30 through this Licence.

**Attribution — all three are mandatory:**

> **Article 6(a), unmodified use:** © DLR e.V. 2010 -2014 and © Airbus Defence and Space GmbH
> 2014 -2018 provided under COPERNICUS by the European Union and ESA; all rights reserved.

> **Article 6(b), adapted/modified use:** produced using Copernicus WorldDEM-30 © DLR e.V.
> 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the
> European Union and ESA; all rights reserved

> **Article 6(c), required in any licence or legal notice covering redistribution:** The
> organisations in charge of the Copernicus programme by law or by delegation do not incur
> any liability for any use of the Copernicus WorldDEM-30

**Citation (verbatim from the collection page):**

> ESA – EU users who use the Copernicus DEM in their research are requested to use the
> following DOI when citing the data source in their publications:
> https://doi.org/10.5270/ESA-c5d3d65

**Constraints this project must respect:**

- This is a **dedicated GLO-30/GLO-90 licence**, _not_ the generic Copernicus Data Licence
  (Regulation 1159/2013). Do not cite the wrong one.
- The 10m EEA product is **expressly excluded**: "The higher resolution, Copernicus
  WorldDEM-10 is subject of a separate licence and distribution to the general public of
  these higher resolution DEMs is expressly excluded from this Licence."
- **GLO-30 is a DSM, not a bare-earth DTM** — it includes buildings and vegetation. If we
  compute slopes or overland flow from it, that is a known limitation and belongs in
  `docs/ARCHITECTURE.md`.
- Because Article 6(b) applies to anything we process, **every processed terrain artefact
  must carry the "produced using Copernicus WorldDEM-30" string** in its attribution.

---

## 2. Natural Earth — **VERIFIED (public domain)**

Coastline and base geometry. The safest asset in this file, and a good fallback when a
higher-stakes dataset's licence is unresolved.

| Field     | Value                                                  |
| --------- | ------------------------------------------------------ |
| Terms     | <https://www.naturalearthdata.com/about/terms-of-use/> |
| Retrieved | 2026-10-01                                             |
| Status    | **VERIFIED**                                           |

**Licence name (verbatim):** `public domain`

**Key terms (verbatim):**

> All versions of Natural Earth raster + vector map data found on this website are in the
> public domain. You may use the maps in any manner, including modifying the content and
> design, electronic dissemination, and offset printing. The primary authors, Tom Patterson
> and Nathaniel Vaughn Kelso, and all other contributors renounce all financial claim to the
> maps and invites you to use them for personal, educational, and commercial purposes. No
> permission is needed to use Natural Earth. Crediting the authors is unnecessary. However,
> if you wish to cite the map data, simply use one of the following.

> The authors provide Natural Earth as a public service and are not responsible for any
> problems relating to accuracy, content, design, and how it is used.

**Attribution (verbatim) — explicitly optional:**

> Short text: Made with Natural Earth. Long text: Made with Natural Earth. Free vector and
> raster map data @ naturalearthdata.com.

**Caveats:**

- Attribution is optional but we will include it anyway — it costs nothing and this project
  should be a good citizen.
- **Placenames are English-only.** There is no Assamese label set here. If we need Assamese
  place labels in the 3D scene, they must come from a project with an Assamese gazetteer, or
  we label in English and say so.
- Natural Earth is cartographically simplified. Fine for a coastline; **not** suitable where
  precise political boundaries are needed.
- GADM was considered as an alternative and **rejected** — it is non-commercial and requires
  registration.

---

## 3. USGS ANSS Comprehensive Earthquake Catalog (ComCat) — **VERIFIED BY OWNER**

Source for FAULT mode's earthquake history.

> **Decision of record:** [`docs/DECISIONS.md` §2](DECISIONS.md), 2026-10-01. Terms read
> by the project owner in a real browser. **Event parameters may be bundled**; ComCat
> product imagery may not.

| Field          | Value                                                                              |
| -------------- | ---------------------------------------------------------------------------------- |
| Data page      | <https://earthquake.usgs.gov/data/comcat/> — **HTTP 200**                          |
| FDSN event API | <https://earthquake.usgs.gov/fdsnws/event/1/> — **HTTP 200**                       |
| Terms page     | <https://www.usgs.gov/information-policies-and-instructions/crediting-usgs>        |
| Retrieved      | 2026-10-01 by automated fetch; **terms read 2026-10-01 by the owner in a browser** |
| **Licence**    | **Public domain**, per the USGS crediting page                                     |
| Attribution    | **Credit requested, not required** — see the credit line below                     |

**How this was verified.** The `usgs.gov` policy pages return an HTTP 202 JavaScript
robot-check interstitial to a plain HTTP client, so an agent could never read them. The
owner opened the USGS crediting page in a real browser on **2026-10-01** and reported its
substance: most USGS information is **public domain** and may be used without
restriction; USGS **asks for credit**; and some **non-USGS** images and graphics are used
with permission. That is the source for the public-domain status, and it is why the
third-party-graphics caveat below exists.

> **Not yet quoted verbatim.** Rule 1 of this file requires licence text in quotation
> marks, and what is above is the owner's summary of the page rather than a transcription
> of it. That is a weaker form of evidence than the rest of this file and it is recorded as
> such, not papered over. **The verbatim text of the crediting page should still be pasted
> here** — it costs the owner one copy-paste and it is the only thing standing between
> this entry and a licence claim this project cannot show a reader.

**Attribution (verbatim from the ComCat page):**

> Geological Survey, Earthquake Hazards Program, 2017, Advanced National Seismic System
> (ANSS) Comprehensive Catalog of Earthquake Events and Products : Various,
> https://doi.org/10.5066/F7MS3QZH

**Credit line for the UI** (from the USGS crediting page's own template):

> Earthquake catalog data courtesy of the U.S. Geological Survey

Registered in the attribution list at §10.

### What may be bundled, and what may not

ComCat is not one agency's catalogue. It is a **merge of records contributed by many
networks**, and the merged catalogue also references products — ShakeMap imagery, W-phase
and PAGER products — that carry their own terms and may embed third-party material. The
public-domain finding covers USGS information, not every byte a ComCat record points at.

**Therefore: bundle event parameters only.**

| Bundled                          | Not bundled                             |
| -------------------------------- | --------------------------------------- |
| Event time                       | ShakeMap and PAGER images               |
| Epicentre latitude and longitude | Any product graphic or thumbnail        |
| Depth                            | Contributor network logos or map tiles  |
| Magnitude and magnitude type     | Station metadata, waveform files        |
| Event ID (for citation)          | Anything fetched from a `products/` URL |

Bundling parameters rather than products is also what keeps the repository small enough to
stay under the 5 MB ceiling, and it means the credit line in §10 is the full extent of what
a downstream user has to reproduce.

**Constraints this project must respect:**

- **Credit is requested, so we give it**, in the app footer and in `README.md`. It costs
  nothing and the terms ask for it.
- **Redistribution is public domain**, but "public domain" covers the _data_, not our
  presentation of it. Do not imply USGS endorses this sandbox.
- **A contributing network's record is not USGS's own measurement.** Where a magnitude's
  provenance matters, the UI shows the event ID and links the ComCat page rather than
  claiming USGS measured it. Contributed magnitudes are also not homogeneous — `Mlv`,
  `mb` and `Ms` are not comparable without care.
- **No real-time claims.** ComCat can be queried for recent events, but this product ships
  a **historical** subset and says so. A live feed would be a different product with its
  own honesty problems (`PRODUCT.md` §4.2).

**Related:** SRTM (§5) is distributed by USGS EROS and was blocked on the same unreadable
policy pages. It stays `UNVERIFIED` until someone reads its own terms page; this entry does
not clear it by analogy.

---

## 4. Bird (2003) PB2002 plate boundaries — **UNVERIFIED — NOT SHIPPED**

Intended source for PLATES mode's boundary geometry.

> **Decision of record:** [`docs/DECISIONS.md` §6](DECISIONS.md), 2026-10-01. PB2002 files are
> not shipped and PLATES must not depend on them. The replacement source — a licence that can
> be quoted verbatim, or our own tracing from cited published sources — is **decided in
> phase 2**.

| Field              | Value                                                                             |
| ------------------ | --------------------------------------------------------------------------------- |
| Author's directory | <http://peterbird.name/oldFTP/PB2002/> — **HTTP 200**                             |
| README             | <http://peterbird.name/oldFTP/PB2002/2001GC000252_readme.txt> — retrieved in full |
| Retrieved          | 2026-10-01                                                                        |
| **Licence**        | **`UNVERIFIED` — no licence statement found anywhere**                            |

**Why UNVERIFIED.** The directory index and the complete README were searched for
`licen`, `copyright`, `public domain`, `terms`, `permission`, and `attribut`. **Zero
matches.** The README is purely technical — coordinate formats, segment encoding, boundary
classes — with no licensing or redistribution clause. The author's site root carries no
licence statement either.

**Citation (verbatim from the directory listing):**

> Bird, P. [2003] An updated digital model of plate boundaries, Geochemistry Geophysics
> Geosystems, 4(3), 1027, doi:10.1029/2001GC000252

**Corrections to assumptions made when this dataset was chosen:**

1. **`soest.hawaii.edu/plates/` does not resolve — HTTP 404.** `plates.earth` returns an
   83-byte meta-refresh stub with no licence text.
2. **PB2002 is not the same thing as NNR-MORVEL**, and NNR-MORVEL's licence could not be
   verified either. The MORVEL pages at `geology.wisc.edu/~chuck/MORVEL` were unreachable.
3. **The ODC-By licence attached to PB2002 in some places belongs to a third party.** It
   appears on `https://github.com/fraxen/tectonicplates`, Hugo Ahlenius's shapefile→GeoJSON
   conversion. Verbatim from that repo's `LICENSE.md`:

   > This collection of data is made available under the Open Data Commons Attribution
   > License: http://opendatacommons.org/licenses/by/1.0/

   **That licence governs Ahlenius's converted files only, not Bird's originals.** Do not
   attribute it to Bird.

**To resolve:** contact P. Bird directly, or read the data-availability statement in the
AGU article. Until then **PB2002 files stay out of this repo entirely.**

**The phase 2 choice.** Two acceptable paths (`DECISIONS.md` §6):

1. **A clearly licensed source** whose terms can be quoted verbatim in this file, or
2. **Our own tracing** of the India–Eurasia boundary from cited published sources, with every
   input cited.

Path 2 is viable because PLATES needs only that one boundary drawn as a line for a cinematic,
not a full global plate model — which is why this is a deferred decision rather than a blocked
one.

---

## 5. SRTM — **UNVERIFIED**

Terrain alternative, and the historically obvious choice. Needs verification before use.

| Field          | Value                                                                                                                     |
| -------------- | ------------------------------------------------------------------------------------------------------------------------- |
| USGS EROS page | <https://www.usgs.gov/centers/eros/science/usgs-eros-archive-digital-elevation-shuttle-radar-topography-mission-srtm-non> |
| Retrieved      | 2026-10-01                                                                                                                |
| **Licence**    | **`UNVERIFIED`**                                                                                                          |
| DOI            | `/10.5066/F7PR7TFT` (per snippet only — see below)                                                                        |

**Why UNVERIFIED.** The USGS EROS page returned **HTTP 202 with a JavaScript robot-check
interstitial.** The page was never read. Search snippets show a "Sources/Usage: Public
Domain" label and language about "open distribution", but **this file will not record a
snippet as a licence.**

**Two warnings.**

> **CGIAR-CSI's SRTM90 v4 is NOT public domain.** Its own FAO catalogue metadata states:
> "Users are prohibited from any commercial, non-free resale, or redistribution without
> explicit written permission from CIAT. Users should acknowledge CIAT as the source used…"
> Using CGIAR/SRTM v4 instead of the NASA/NGA original inherits a **restrictive** licence.
> "SRTM = public domain" does not cover it.

> **The commonly cited "Bimanak/Bihar border artifact" in SRTM could not be substantiated.**
> Three targeted searches all returned results about the India–_Nepal_ _political_ border
> dispute, which is unrelated to DEM artefacts. One peer-reviewed source
> (_Scientific Reports_, PMC5296860) actually argues _against_ systematic horizontal
> displacement in C-band SRTM. **Do not publish that claim without an independent verified
> source.** The well-documented SRTM problem in this region is **data voids and void-fill
> interpolation error**, not a border shift — the USGS page itself notes "Some tiles may
> still contain voids".

**To resolve:** fetch the USGS EROS page in a browser, or use Copernicus GLO-30 instead,
which is already verified. **GLO-30 is the current plan; SRTM is a fallback.** The USGS
crediting page read for ComCat (§3) does **not** clear this entry by analogy — SRTM's own
terms have still never been read.

---

## 6. National Center for Seismology (NCS) — **RESTRICTIVE — link and cite only**

The Indian seismic authority. Linked from the UI as an official source; **its data is not
redistributed.**

| Field            | Value                                         |
| ---------------- | --------------------------------------------- |
| Site             | <https://seismo.gov.in/> — **HTTP 200**       |
| Real-time portal | <https://riseq.seismo.gov.in/> — **HTTP 200** |
| Retrieved        | 2026-10-01                                    |
| Status           | **VERIFIED** text, **RESTRICTIVE** terms      |

> **URL correction.** The National Center for Seismology is at **`seismo.gov.in`**.
> **`seismology.gov.in` does not resolve — NXDOMAIN**, verified against
> `seismology.gov.in`, `www.seismology.gov.in`, `ncs.gov.in`, `ncsindia.gov.in`,
> `seismology.moes.gov.in`, and `ncs.moes.gov.in`. Separately, **`ncs.gov.in` is the
> National _Career_ Service**, an entirely unrelated organisation — a plausible-looking
> wrong answer. This correction is recorded in `PRODUCT.md` too.

**Terms (verbatim, from <https://seismo.gov.in/terms-use>):**

> All copyrights are reserved with the National Center for Seismology, Ministry of Earth
> Sciences, Government of India. The material posted on the website may be reproduced
> without formal permission for the purposes of non-commercial research, private study,
> review, and news reporting provided that the material is appropriately attributed.

> The material has to be reproduced accurately and not to be used in a derogatory manner or
> in a misleading context.

**Legal Notice Policy (verbatim, same page) — this is the blocker:**

> All content of this site is owned or controlled by National Center for Seismology,
> Ministry of Earth Sciences, Government of India, and is protected by copyright laws and
> international treaties. You may download content only for your personal use for
> non-commercial purposes but no modification or further reproduction of the content is
> permitted. The content may otherwise not be copied or used in any way.

**Copyright policy (verbatim, from <https://seismo.gov.in/copyright-policy>):**

> Material featured on this website may be reproduced free of charge in any format on media
> without requiring specific permission. This is subject to the material being reproduced
> accurately and not being used in a derogatory manner or in a misleading context. Where the
> material is being published or issued to others, the source must be prominently acknowledged.

> However, the permission to reproduce this material shall not extend to any material which
> is identified as being copyright of a third party.

**Consequence for this project.** NCS asserts all copyrights reserved, limits use to
personal non-commercial purposes, and forbids modification and further reproduction. **An
open-source repo redistributing NCS-derived catalogue data is not covered by that grant.**
This project will **link to NCS and cite it. It will not bundle or redistribute NCS data.**

**One thing NCS does not say.** Searches of all NCS pages found **no statement about
earthquake prediction** — no prediction claim and no prediction disclaimer. The general
disclaimer reads (verbatim): "The contents of this website are for information purposes
only, enabling the public at large to have quick and easy access to information and do not
have any legal sanctity."

So the project's line _"earthquakes cannot be predicted"_ is **our own statement, not NCS's.**
Do not attribute it to them. Quoting it as theirs would be a fabricated attribution —
precisely the failure this file exists to prevent.

**What NCS publishes:** "Seismological Data", "Preliminary Earthquake Data", "Earthquake
catalogue", "Seismological Bulletins", "Station Metadata", "Event Waveform", over "a
National Seismological Network of more than 170 stations". Waveform and strong-motion data
are **on request only**, and regional reports are provided "on payment basis".

---

## 7. India Meteorological Department (IMD) — no licence asserted, link only

| Field      | Value                                                                |
| ---------- | -------------------------------------------------------------------- |
| Site       | <https://mausam.imd.gov.in/> — **HTTP 200**                          |
| Disclaimer | <https://mausam.imd.gov.in/responsive/disclaimer.php> — **HTTP 200** |
| Retrieved  | 2026-10-01                                                           |
| Licence    | **None asserted**                                                    |

**Disclaimer (verbatim) — quotable, and directly relevant to our own framing:**

> This Ministry of Earth Sciences (MoES) website is intended for information to the general
> public based on the real time data. The information contained in this website is subject
> to the uncertainties of scientific and technical research and is liable to change without
> notice. It is also not a substitute for independent professional advice. In no event
> shall the MoES or its constituents be liable to the user or to any third party for any
> direct, indirect, incidental, consequential, damages or loss of profit resulting from any
> use or misuse of the data in the website.

Note this is a **Ministry of Earth Sciences site-level** disclaimer, not IMD-specific, and
**IMD asserts no redistribution licence.** Linked only.

**Products published:** Flash Flood Bulletin
(`https://mausam.imd.gov.in/responsive/flashFloodBulletin.php`); Hydrometeorological
Services (purpose, verbatim: "India Meteorological Department renders assistance and advice
on the meteorological aspects of hydrology, water management and multipurpose river valley
projects management."); Warnings (subdivision-wise, district-wise nowcast); Quantitative
Precipitation Forecast; and hydrology and forecasting SOPs.

> **Important correction of scope.** IMD's hydrological services are **advisory input to the
> Central Water Commission**. IMD is **not** the authority publishing official river-stage
> flood warnings for the Brahmaputra — **CWC is.** If this project ever displays Brahmaputra
> river-stage warnings, CWC is the correct source. **CWC's licence has not been verified and
> is an open task.**

---

## 8. ASDMA — Assam State Disaster Management Authority — **UNVERIFIED — link only, never bundle**

The most locally relevant authority, and the one we most want to cite properly.

> **Decision of record:** [`docs/DECISIONS.md` §4](DECISIONS.md), 2026-10-01. ASDMA is linked
> and cited; no ASDMA map, inundation layer, report or document is redistributed through this
> repository.

| Field                        | Value                                        |
| ---------------------------- | -------------------------------------------- |
| Site                         | <https://asdma.assam.gov.in/> — **HTTP 200** |
| Retrieved                    | 2026-10-01                                   |
| **Licence / map disclaimer** | **`UNVERIFIED`**                             |

**Confirmed live.** The site confirms ASDMA publishes an "Assam Flood Report",
"Inundation Mapping - NRSC", "Reports on Assam Flood/Storm/Earthquake/Landslide etc.", the
"Assam DRR Roadmap", and "Success Stories of Flood 2019". However **every one of those
resource pages returned HTTP 200 with an empty content body** — the document repository
does not serve content to a plain HTTP client. ASDMA publishes flood material; **we could
not retrieve any of it.**

**A disclaimer we were told to look for does not exist.** ASDMA links to `/policy/disclaimer`,
`/policy/copyright-policy`, and `/policy/terms-use`, but **all three return HTTP 200 with
completely empty bodies.** We searched the whole site for language about maps being "for
general public use only" or "not for legal use" and **found nothing.** Only
`/policy/terms-and-conditions` has real text:

> This official website of the 'Department of Revenue & Disaster Management, Govt. of Assam'
> has been developed to provide information to the general public. The documents and
> information displayed in this website are for reference purposes only and does not purport
> to be a legal document. Department does not warrant the accuracy or completeness of the
> information, text, graphics, links or other items contained within the Website.

**Do not quote a map disclaimer ASDMA has not published.** That clause is close in spirit
to what we expected but is not the "maps are for general public use only, not for legal use"
language. Writing that as an ASDMA quote would be fabrication.

**Consequence for this project.** **Link and cite; never bundle.** No redistribution
permission exists in any retrievable text, and the resource pages return 200 with empty
bodies, so there is nothing to quote and nothing to rely on. For this project's audience the
cost of not bundling is low and the cost of bundling is a legal one: students who need real
warnings are better served by a link to ASDMA than by a cached copy with unknown terms.

**To resolve:** explicit redistribution permission in writing from ASDMA, quoted verbatim
here. A browser session may also read the empty `/policy/disclaimer` page.

---

## 9. Discharges and river data (CWC) — **out of scope; FLOW uses a user-controlled level**

> **Decision of record:** [`docs/DECISIONS.md` §3](DECISIONS.md), 2026-10-01. CWC discharge
> and river-stage data is **out of scope for now**.

FLOW is driven by a **user-controlled river level**, not by observed or modelled discharge.

**Why.** CWC is the correct authority for Brahmaputra river-stage data and flood warnings —
IMD is only advisory input to it. But CWC's licence has never been verified, and a
plausible-looking discharge figure would be exactly the fabrication `AGENTS.md` §6 and
`PRODUCT.md` §4 forbid. A user-chosen level is a **control input, not a measurement**, so it
can be labelled correctly for free: where the water sits is something the user set, not
something this project claims to know. This is a scope reduction that makes FLOW smaller and
more honest, and it defers the CWC research rather than abandoning it.

**Consequence for the pipeline.** No CWC request is made, no CWC artefact is fetched, and no
CWC figure appears anywhere in the UI. `FlowParams.scenarioInflowM3s` in
`src/shared/types.ts` carries that contract in its own name and doc comment: a user-chosen
scenario value in m³/s, **not** an observed discharge. It was renamed from `dischargeM3s`,
which implied an instrument reading, because a field name is documentation that ships. The
related `TerrainSample.dischargeM3s` is a _scenario-derived_ flux at a location and can never
carry `measured` provenance.

The same principle is generalised beyond CWC as a standing product rule — **every FLOW input
is a user-chosen scenario, never an observation** — recorded in
[`docs/DECISIONS.md` §7](DECISIONS.md).

**Reversed by:** CWC's licence being verified and a cited discharge series added, at which
point observed discharge becomes an additional, clearly-labelled input — not a replacement for
the level control.

---

## 10. Attribution strings to ship in the UI

Every credit line the running app must display, in the words the source uses. These are
**strings the product ships**, so they live here rather than in a component: a credit that
only exists in a commit message is not an attribution. Rendered in the app footer and the
about panel, in both English and Assamese, and mirrored in `README.md`.

| Source                    | Credit line to display                                                                                                                                                                  | Basis                            | Required?                                                                                                        |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **Copernicus DEM GLO-30** | `produced using Copernicus WorldDEM-30 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved` | Licence Article 6(b), §1         | **Yes** — mandatory for adapted use, and we resample and clamp                                                   |
| **USGS ANSS ComCat**      | `Earthquake catalog data courtesy of the U.S. Geological Survey`                                                                                                                        | USGS crediting page template, §3 | Requested, not required — we give it                                                                             |
| **Natural Earth**         | `Made with Natural Earth`                                                                                                                                                               | §2                               | Optional — we give it                                                                                            |
| **Bird PB2002**           | —                                                                                                                                                                                       | §4                               | **Not shipped.** Nothing to credit.                                                                              |
| **NCS, IMD, ASDMA, CWC**  | —                                                                                                                                                                                       | §6–§9                            | **Linked and cited, never bundled.** Nothing to credit, but each must be linked where its subject matter appears |

**Rules for this list:**

1. **Use the source's own wording.** Paraphrasing a mandatory attribution voids it. Where the
   licence gives a template, use the template.
2. **Nothing enters this list that is not in a section above.** An attribution with no
   `DATA.md` entry is a claim about a source nobody checked.
3. **A credit is not an endorsement.** Displaying a USGS credit must not imply USGS
   publishes, reviews or endorses this sandbox.
4. **Keep them out of the scene.** Attributions live in the HUD footer and about panel. Text
   over the terrain competes with the one thing the design system says may glow.
5. **Bilingual.** Every line needs an Assamese rendering before phase 7 signs off
   (`DECISIONS.md` §5). A transliterated credit is still a credit, but an unreviewed one.

Adding a dataset means adding a row here in the same change, not a later one.

---

## Rules for editing this file

1. **Quote, never paraphrase.** Licence terms go in verbatim, in quotation marks, with the
   URL you retrieved them from and the date.
2. **`UNVERIFIED` is a valid, respectable answer.** It means "I did not find it", and it
   blocks shipping. That is the system working.
3. **One row per dataset, and the row must match reality.** Verify a URL resolves before
   committing it. A dead link in a citation is a lie by omission.
4. **Check redistribution, not just access.** "Free to download" says nothing about
   redistribution.
5. **Check the converter.** A converted file is governed by the converter's licence unless
   stated otherwise. This already burned us once with PB2002 (§4).
6. **Re-verify before every release.** Terms change. A `RETRIEVED` date older than a year
   is stale and flagged as such.
7. **Record the decision, not just the finding.** When a dataset's status is settled rather
   than merely observed, add an entry to [`docs/DECISIONS.md`](DECISIONS.md) and reference it
   from this file. A licence finding with no decision attached gets re-litigated.
