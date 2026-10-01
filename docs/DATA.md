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
  someone converted to GeoJSON on GitHub is governed by *that repo's* licence unless the
  converter says otherwise.

Research was conducted **2026-10-01** by fetching each official page directly. Status
labels:

| Label | Meaning |
| --- | --- |
| **VERIFIED** | Official licence text retrieved and quoted from the source |
| **UNVERIFIED** | Could not confirm from an official source. **Not shipped.** |
| **RESTRICTIVE** | Licence confirmed, and it forbids what this project needs |

---

## Status summary

| Dataset | Purpose | Status | Ship it? |
| --- | --- | --- | --- |
| **Copernicus DEM GLO-30** | Terrain, all modes | **VERIFIED** | Yes, with mandatory attribution |
| **Natural Earth** | Coastline, basemap fallback | **VERIFIED** (public domain) | Yes |
| **USGS ANSS ComCat** | FAULT earthquake history | **UNVERIFIED** | Not yet — confirm first |
| **Bird PB2002** plate boundaries | PLATES mode | **UNVERIFIED** | **No** — no licence found anywhere |
| **SRTM** | Terrain alternative | **UNVERIFIED** | Not yet |
| **NCS (seismo.gov.in)** | Indian earthquake authority | **RESTRICTIVE** | Link and cite only |
| **IMD** | Weather / hydrology | No licence asserted | Link only |

**Nothing from this table is committed to git in Phase 1.** These are research findings and
a plan, recorded now so the data pipeline can be built against verified terms later.

---

## 1. Copernicus DEM GLO-30 — **VERIFIED**

Primary terrain source. 30m global surface elevation.

| Field | Value |
| --- | --- |
| Licence PDF | <https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Data/DEM/resources/license/License-COPDEM-30.pdf> |
| Collection page | <https://dataspace.copernicus.eu/explore-data/data-collections/copernicus-contributing-missions/collections-description/COP-DEM> |
| Retrieved | 2026-10-01 |
| Status | **VERIFIED** — full text extracted from the official PDF |

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

- This is a **dedicated GLO-30/GLO-90 licence**, *not* the generic Copernicus Data Licence
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

| Field | Value |
| --- | --- |
| Terms | <https://www.naturalearthdata.com/about/terms-of-use/> |
| Retrieved | 2026-10-01 |
| Status | **VERIFIED** |

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

## 3. USGS ANSS Comprehensive Earthquake Catalog (ComCat) — **UNVERIFIED**

Intended source for FAULT mode's earthquake history.

| Field | Value |
| --- | --- |
| Data page | <https://earthquake.usgs.gov/data/comcat/> — **HTTP 200** |
| FDSN event API | <https://earthquake.usgs.gov/fdsnws/event/1/> — **HTTP 200** |
| Retrieved | 2026-10-01 |
| **Licence** | **`UNVERIFIED`** |
| Attribution | see below |

**Why UNVERIFIED.** Both pages were fetched and **neither contains any licence, copyright,
redistribution, or public-domain statement.** Both link only to `https://www.usgs.gov/policies-and-notices`.

The widely-repeated claim that USGS content is public domain comes from those policy pages,
which **could not be retrieved** — they returned **HTTP 202 with a JavaScript robot-check
interstitial**, so the text was never read. Search-result snippets appear to quote language
about public-domain status, but a snippet is not a source and **this file does not record
snippets as verified**.

**Attribution we did verify, from the ComCat page (verbatim):**

> Geological Survey, Earthquake Hazards Program, 2017, Advanced National Seismic System
> (ANSS) Comprehensive Catalog of Earthquake Events and Products : Various,
> https://doi.org/10.5066/F7MS3QZH

**To resolve before use:** open `https://www.usgs.gov/policies-and-notices` in a real
browser, read the terms, and quote them here. Until then, **ComCat data is not committed
and not bundled.**

---

## 4. Bird (2003) PB2002 plate boundaries — **UNVERIFIED — DO NOT SHIP**

Intended source for PLATES mode's boundary geometry.

| Field | Value |
| --- | --- |
| Author's directory | <http://peterbird.name/oldFTP/PB2002/> — **HTTP 200** |
| README | <http://peterbird.name/oldFTP/PB2002/2001GC000252_readme.txt> — retrieved in full |
| Retrieved | 2026-10-01 |
| **Licence** | **`UNVERIFIED` — no licence statement found anywhere** |

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

---

## 5. SRTM — **UNVERIFIED**

Terrain alternative, and the historically obvious choice. Needs verification before use.

| Field | Value |
| --- | --- |
| USGS EROS page | <https://www.usgs.gov/centers/eros/science/usgs-eros-archive-digital-elevation-shuttle-radar-topography-mission-srtm-non> |
| Retrieved | 2026-10-01 |
| **Licence** | **`UNVERIFIED`** |
| DOI | `/10.5066/F7PR7TFT` (per snippet only — see below) |

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
> Three targeted searches all returned results about the India–*Nepal* *political* border
> dispute, which is unrelated to DEM artefacts. One peer-reviewed source
> (*Scientific Reports*, PMC5296860) actually argues *against* systematic horizontal
> displacement in C-band SRTM. **Do not publish that claim without an independent verified
> source.** The well-documented SRTM problem in this region is **data voids and void-fill
> interpolation error**, not a border shift — the USGS page itself notes "Some tiles may
> still contain voids".

**To resolve:** fetch the USGS EROS page in a browser, or use Copernicus GLO-30 instead,
which is already verified. **GLO-30 is the current plan; SRTM is a fallback.**

---

## 6. National Center for Seismology (NCS) — **RESTRICTIVE — link and cite only**

The Indian seismic authority. Linked from the UI as an official source; **its data is not
redistributed.**

| Field | Value |
| --- | --- |
| Site | <https://seismo.gov.in/> — **HTTP 200** |
| Real-time portal | <https://riseq.seismo.gov.in/> — **HTTP 200** |
| Retrieved | 2026-10-01 |
| Status | **VERIFIED** text, **RESTRICTIVE** terms |

> **URL correction.** The National Center for Seismology is at **`seismo.gov.in`**.
> **`seismology.gov.in` does not resolve — NXDOMAIN**, verified against
> `seismology.gov.in`, `www.seismology.gov.in`, `ncs.gov.in`, `ncsindia.gov.in`,
> `seismology.moes.gov.in`, and `ncs.moes.gov.in`. Separately, **`ncs.gov.in` is the
> National *Career* Service**, an entirely unrelated organisation — a plausible-looking
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

So the project's line *"earthquakes cannot be predicted"* is **our own statement, not NCS's.**
Do not attribute it to them. Quoting it as theirs would be a fabricated attribution —
precisely the failure this file exists to prevent.

**What NCS publishes:** "Seismological Data", "Preliminary Earthquake Data", "Earthquake
catalogue", "Seismological Bulletins", "Station Metadata", "Event Waveform", over "a
National Seismological Network of more than 170 stations". Waveform and strong-motion data
are **on request only**, and regional reports are provided "on payment basis".

---

## 7. India Meteorological Department (IMD) — no licence asserted, link only

| Field | Value |
| --- | --- |
| Site | <https://mausam.imd.gov.in/> — **HTTP 200** |
| Disclaimer | <https://mausam.imd.gov.in/responsive/disclaimer.php> — **HTTP 200** |
| Retrieved | 2026-10-01 |
| Licence | **None asserted** |

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

## 8. ASDMA — Assam State Disaster Management Authority — **UNVERIFIED**

The most locally relevant authority, and the one we most want to cite properly.

| Field | Value |
| --- | --- |
| Site | <https://asdma.assam.gov.in/> — **HTTP 200** |
| Retrieved | 2026-10-01 |
| **Licence / map disclaimer** | **`UNVERIFIED`** |

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

**To resolve:** open the `/policy/disclaimer` page in a real browser. A human with a browser
can read what a scripted fetch could not.

---

## 9. Discharges and river data — **not yet researched**

FLOW mode needs Brahmaputra discharge and river-stage observations. **No source has been
researched or verified yet.** Likely candidates to investigate:

- **Central Water Commission (CWC)** — the actual authority for Brahmaputra river-stage data
  and flood warnings. Highest priority.
- **ASDMA** flood reports and inundation mapping, once the repository is reachable.

**Until a source is verified and a row is added to this file, FLOW mode displays no
discharge data at all.** Per `AGENTS.md`, an unknown value renders as "—" — it does not
render as an invented discharge figure.

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
