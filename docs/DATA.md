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

| Dataset                          | Purpose                     | Status                                                  | Ship it?                                                                |
| -------------------------------- | --------------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------- |
| **Copernicus DEM GLO-30**        | Terrain, all modes          | **VERIFIED**                                            | **Yes — chosen source**, with mandatory attribution (DECISIONS §8, §11) |
| **Natural Earth**                | Coastline, basemap fallback | **VERIFIED** (public domain)                            | Yes                                                                     |
| **USGS ANSS ComCat**             | FAULT earthquake history    | **VERIFIED BY OWNER** (public domain, credit requested) | **Yes — event parameters only**, no product imagery (DECISIONS §2)      |
| **Bird PB2002** plate boundaries | PLATES mode                 | **UNVERIFIED**                                          | **No** — no licence found anywhere (DECISIONS §6)                       |
| **SRTM**                         | Terrain alternative         | **UNVERIFIED** + no keyless route                       | **No** — rejected for the DEM (§5, §11)                                 |
| **Mapzen Terrain Tiles**         | Bare-earth DEM alternative  | Composite, per-source terms                             | **No** — untraceable provenance (§11)                                   |
| **NCS (seismo.gov.in)**          | Indian earthquake authority | **RESTRICTIVE**                                         | Link and cite only                                                      |
| **IMD**                          | Weather / hydrology         | No licence asserted                                     | Link only                                                               |
| **ASDMA**                        | Flood authority, Assam      | **UNVERIFIED**                                          | **Link only — never bundle** (DECISIONS §4)                             |
| **CWC** discharge / river stage  | FLOW                        | Out of scope                                            | Not used — FLOW uses a user-controlled level (DECISIONS §3)             |

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

### Technical profile, measured from the source (2026-10-01)

Not copied from marketing. Every figure below was read out of the delivered files over
HTTP range requests, so it is what the pipeline will actually see.

**Distribution route — anonymous S3, no account, no key.** The AWS Open Data mirror is the
route. `aws s3 ls --no-sign-request` works, which means a plain `GET` works too.

| Field          | Value                                                                 |
| -------------- | --------------------------------------------------------------------- |
| GLO-30 bucket  | `s3://copernicus-dem-30m` (eu-central-1)                              |
| GLO-90 bucket  | `s3://copernicus-dem-90m` (eu-central-1)                              |
| Registry entry | <https://registry.opendata.aws/copernicus-dem/> — **HTTP 200**        |
| Tile manifest  | `s3://copernicus-dem-30m/tileList.txt` — 26,450 entries, **HTTP 200** |
| Managed by     | Sinergise (per the registry), on behalf of the Copernicus Programme   |

> **Naming trap, verified — read this before writing any fetch code.** The bucket called
> `copernicus-dem-30m` contains the **GLO-30** product, and its files are named
> `Copernicus_DSM_COG_10_<tile>_DEM/`. **The `10` is 10 arcseconds, not the resolution in
> metres, and GLO-30 is the _1_-arcsecond product.** Confirmed by reading the sidecar XML
> inside the bucket:
>
> | Path                                            | `resolutionVariant` | `productCustomizationDescr` | Grid      | arcsec  |
> | ----------------------------------------------- | ------------------- | --------------------------- | --------- | ------- |
> | `copernicus-dem-30m/…COG_10_N27_00_E094_00_DEM` | **10**              | **Copernicus GLO-30 DGED**  | 3601×3601 | **1.0** |
> | `copernicus-dem-90m/…COG_30_N27_00_E094_00_DEM` | **30**              | **Copernicus GLO-90 DGED**  | 1201×1201 | **3.0** |
>
> So the `10`/`30` in the path tracks the _arcsecond_ figure and is offset by one step from
> the product name: GLO-30 is `…COG_10…`, GLO-90 is `…COG_30…`. **Globbing for `_30_`
> returns the 90 m product.** The bucket names, by contrast, are correct and
> unambiguous. Both facts were verified against the registry page, not assumed.

**Raster characteristics**, read from `N27_00_E094_00` (NE Assam):

| Property          | Value                                                         | Source                           |
| ----------------- | ------------------------------------------------------------- | -------------------------------- |
| Format            | GeoTIFF, DEFLATE (8), floating-point predictor (3)            | TIFF tags                        |
| Sample type       | 32-bit float                                                  | tag 258                          |
| No-data value     | **-32767** (not in a GeoTIFF tag — see below)                 | sidecar XML `valueInvalidPixels` |
| Internal tiling   | 1024×1024                                                     | tags 322/323                     |
| Full tile         | 3600×3600 (from 3601×3601, shared edge rows removed)          | tag 256/257                      |
| Overview levels   | 1800×1800, 900×900, 450×450                                   | IFD chain                        |
| Layout            | `LAYOUT=IFDS_BEFORE_DATA` — all metadata precedes pixel data  | GDAL structural metadata         |
| Horizontal CRS    | WGS 84-G1150, geographic, EPSG:4326                           | sidecar XML                      |
| Vertical datum    | **EGM2008 geoid** (EPSG vertical CS 6499, datum 1027)         | sidecar XML                      |
| Vertical spacing  | 0.1 m                                                         | sidecar XML                      |
| Vertical accuracy | **LE90 1.472 m, LE68 1.810 m**                                | sidecar XML                      |
| Acquisition       | TanDEM-X, 2011–2015, 13 acquisitions / 44 scenes on this tile | sidecar XML                      |
| Release           | 2020-11-11, edition 03, quality remark `Approved`             | sidecar XML                      |

> **The no-data value is only in the XML, not in the TIFF.** Tag 42113 (GDAL_NODATA) is
> **absent** from the GeoTIFF. A decoder that trusts the TIFF alone will read -32767 as a
> real elevation of **-32.7 km**. This is the single most dangerous detail in this file and
> it is why `src/engine/terrain/` must treat -32767 as no-data by contract.

**Ground resolution is not 30 m, and pixels are not square.** GLO-30 is an _angular_
1-arcsecond grid. Because a degree of longitude shrinks with latitude, the ground footprint
of a pixel is:

| Latitude | N–S         | E–W         | Area       |
| -------- | ----------- | ----------- | ---------- |
| 24°N     | 30.92 m     | 28.25 m     | 874 m²     |
| **27°N** | **30.92 m** | **27.55 m** | **852 m²** |
| 28.5°N   | 30.92 m     | 27.17 m     | 840 m²     |

At Assam's latitude a GLO-30 pixel is about **31 × 28 m**, not 30 × 30. Any sidecar must
record the pixel size as a _pair_, and any slope computation must not assume square cells.
Overview levels are exact halves and quarters, so `1800`, `900`, `450` px per degree.

**Range requests work, and overviews are cheap to fetch.** The COG layout means an overview
can be read without touching full-resolution bytes:

| Level | Grid      | Ground at 27°N | Bytes in one tile |
| ----- | --------- | -------------- | ----------------- |
| full  | 3600×3600 | ~31 × 28 m     | ~30–39 MB         |
| ov1   | 1800×1800 | ~62 × 55 m     | ~8–10 MB          |
| ov2   | 900×900   | ~124 × 110 m   | —                 |
| ov3   | 450×450   | ~247 × 220 m   | —                 |

This is what makes a 40-tile area affordable; see §11.

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

**Re-checked 2026-10-01 for the DEM decision — still `UNVERIFIED`, and now positively
worse.** The USGS EROS SRTM page returned **HTTP 403** (it previously returned a 202
robot-check interstitial; 403 is a harder refusal). NASA's own distribution route
(`eodc.usgs.gov`) requires Earthdata Login, so there is **no keyless route** to the NASA/NGA
original. SRTM is therefore rejected on availability as well as licence — see §11.

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

## 11. DEM choice — Copernicus GLO-30, and why not the alternatives

**Decision: Copernicus DEM GLO-30 Public, over the AWS Open Data mirror.** Recorded as
[`docs/DECISIONS.md` §8](DECISIONS.md).

This section exists because "which DEM" looks like a technical question and is not. The
three candidates fail or pass on licence, on whether an anonymous client can fetch them at
all, and on what the numbers physically mean — in that order.

|                   | **Copernicus GLO-30**                    | **SRTM (NASA/NGA)**                | **Mapzen Terrain Tiles**                                        |
| ----------------- | ---------------------------------------- | ---------------------------------- | --------------------------------------------------------------- |
| Licence           | **Free, verified verbatim** (§1)         | **`UNVERIFIED`** (§5)              | Composite; **per-source attribution, no single licence**        |
| Keyless download  | **Yes — anonymous S3**                   | **No — Earthdata Login required**  | Yes — anonymous S3                                              |
| Surface model     | **DSM**                                  | DSM (C-band, edited)               | **Bare-earth DTM** (per registry: "bare-earth terrain heights") |
| Sensor / era      | TanDEM-X radar, 2011–2015                | C-band radar, 2000                 | Mixed: 3DEP, SRTM, ETOPO1, CDEM, EUDEM…                         |
| Vertical accuracy | **LE90 1.472 m** (per-tile, measured)    | ~5–10 m typical, not verified here | Not stated per tile                                             |
| Vertical datum    | **EGM2008 geoid**, stated                | not verified here                  | mixed per source                                                |
| Water bodies      | **Flattened and edited** — no bathymetry | interpolation voids                | varies                                                          |
| Grid              | 1 arcsec (≈31 × 28 m at 27°N)            | 1 arcsec                           | 30 m / 90 m / higher by region                                  |
| Repo size risk    | low, via overviews (§1, §12)             | medium                             | low                                                             |

**Why GLO-30 wins.**

1. **It is the only candidate whose licence is verified from the source.** SRTM's terms
   have never been read (§5). The Mapzen tiles are a _mosaic_ of a dozen providers with a
   dozen different terms — §4's PB2002 lesson applies directly, and the project's own rule
   "check the converter" would apply: we would be redistributing a derivative whose
   provenance depends on which upstream tile a given pixel came from.
2. **It is the only one we can fetch reproducibly without an account.** Reproducibility is
   a `npm run verify` property here. A dataset behind Earthdata Login cannot be rebuilt by
   a clean clone, which would fail the phase-2 done-when outright.
3. **The vertical accuracy is an order of magnitude better than what we need, which is the
   point.** LE90 of 1.472 m against a floodplain whose relief is a few metres means the
   _signal_ is in the data. On SRTM at ~5–10 m the floodplain's own topography would be
   inside the error bar, and the FLOW sandbox would be drawing noise.
4. **The radar acquisition is better suited to water.** TanDEM-X is radar, so it sees
   through cloud — relevant for a monsoon-fed river whose flood peaks happen when optical
   satellites are frequently obscured.

**Its weaknesses, which we accept.**

- **It is a DSM, not a DTM.** Over Assam's forested floodplain and hillock terrain, canopy
  and buildings sit _on top of_ the ground we would be eroding. Slopes derived from it are
  surface slopes, not ground slopes.
- **Water is flattened and edited, so there is no riverbed.** Verbatim from the collection
  page: the product "is derived from an edited DSM named WorldDEM™ , i.e. flattening of
  water bodies and consistent flow of rivers has been included." The Brahmaputra's channel
  is therefore a **smoothed, near-uniform surface**, not a bathymetric trough. This is the
  single most important limitation for FLOW and is restated in §12.
- **It is infilled from other DEMs where radar failed**, including SRTM. Verbatim from the
  collection page, sources are "WorldDEM™ infilled on a local basis with the following DEMs:
  ASTER, SRTM90, SRTM30, SRTM30plus, GMTED2010, TerraSAR-X Radargrammetric DEM, ALOS World
  3D-30m, Norway National DEM and Spanish National DEM." So the fill provenance is mixed even
  within one product. The per-tile **FLM (Filling Mask)** identifies filled pixels and is
  available alongside the DEM.

### Why we did not choose the bare-earth option despite it being physically nicer

Mapzen's tiles are a genuine DTM, which would be _better_ physics for bank erosion. We are
declining them on provenance and licence, not on quality: a composite whose per-pixel
upstream is untraceable is exactly the failure mode `AGENTS.md` §6 exists to prevent, and
the attribution burden is a dozen notices we would have to reproduce correctly. If a
verified bare-earth source for NE India appears later, the DSM limitation is the thing to
revisit first.

---

## 12. What GLO-30 cannot tell us — limitations that constrain FLOW

These are properties of the data, not of the code. They are recorded here because
`PRODUCT.md` §4.3 and `DECISIONS.md` §7 require the terrain to be presented as what it is,
and because each one changes what the sandbox is entitled to claim.

1. **Surface, not ground.** Buildings, tree canopy and bamboo are in the elevation. In
   settled areas the DSM surface can sit several metres above the ground a flood would
   actually reach. Any slope or flow-path computation inherits this.
2. **No riverbed bathymetry.** Water surfaces are flattened and rivers made "consistent"
   during editing. A channel reads as a flat ribbon at roughly water level. **The engine
   cannot infer channel depth from this DEM**, and no "bathymetry" claim may be made.
3. **Vertical error is comparable to the floodplain's relief.** Measured LE90 is 1.472 m and
   LE68 1.810 m per tile. The Brahmaputra floodplain's relief between bank and bar is on the
   order of a few metres. The signal is present but it is not clean: individual bar heights
   carry roughly a metre of uncertainty, which is a large fraction of the thing being
   modelled.
4. **The pixel is not square and not 30 m.** 1 arcsec is ~31 m north–south and ~28 m
   east–west at 27°N. Longitudes are visibly compressed relative to latitudes, so shapes are
   not true to scale and area computations need the cos(latitude) factor.
5. **Mixed fill provenance.** Infilled from SRTM, ASTER and others where radar had no
   coverage. The FLM mask marks those pixels.
6. **Ocean and large water bodies are absent**, and where absent "one can assume height
   values equal to zero" (verbatim, bucket README). That is a metadata convention, not a
   measurement, and must not be presented as sea level.

### The consequence, stated plainly

Every one of these limits means **FLOW's terrain is illustrative**. The mechanism being
taught — where flow concentrates, how a bank is attacked, how a channel migrates — is real
and is worth showing. The specific elevations are not survey-grade, and the UI must say so
where elevations are displayed. This is the same product rule as `DECISIONS.md` §7: the
numbers are the user's scenario, and the terrain underneath is a demonstration surface. A
screenshot must never be mistakable for a survey or a forecast.

---

## 13. Committed terrain artefacts

Built by `npm run data:dem`. Three areas, Terrain-RGB PNG plus a JSON sidecar each, and
`manifest.json` recording source URLs, tile IDs, SHA-256 of outputs, tool versions,
licence and attribution.

> **What the hashes cover, and what they do not.** The SHA-256 values in
> `manifest.json` are of the **outputs** — the PNGs and sidecars this repository
> commits. The source tiles are identified by **ID and URL**, and their bytes are
> **not** hashed. So the manifest proves the committed artefacts have not changed
> since they were written; it does not prove the Copernicus tiles behind them are
> unchanged. Hashing the inputs is tracked as an open item in `docs/ROADMAP.md`
> phase 2, and it needs a decision first: the pipeline reads HTTP range requests,
> so an input hash is only meaningful recorded together with the byte range it
> covered.

| Area                 | bbox (W, S, E, N)       | Grid      | Pixel | Step   | PNG     | Source               |
| -------------------- | ----------------------- | --------- | ----- | ------ | ------- | -------------------- |
| **assam-overview**   | 89.5, 24.0, 96.5, 28.5  | 1318×945  | 530 m | 0.15 m | 1.94 MB | 40 tiles, overview 3 |
| **majuli**           | 93.55, 26.7, 94.7, 27.3 | 1901×1113 | 60 m  | 0.1 m  | 2.21 MB | 4 tiles, full res    |
| **sadiya-dibrugarh** | 94.6, 27.1, 96.0, 28.0  | 2125×1541 | 65 m  | 0.1 m  | 3.70 MB | 2 tiles, full res    |

Total **7.86 MB**, against the 9 MB budget for this task and the 5 MB per-file ceiling of
`AGENTS.md` §5. Both are asserted in `tests/dem-artifacts.test.ts`, so the budget cannot be
quietly exceeded by a later edit.

The PNG column is measured from the committed files — 2,038,300, 2,315,279 and 3,883,836
bytes respectively — and rounded to two decimal places in MiB, which is the unit the total
uses. The `bytes` field of each entry in `manifest.json` is the exact value.

### The no-data encoding, and how the committed files were migrated

`offset` is the elevation of code 0, and **code 0 is reserved for no-data**. So the offset
must sit strictly below the lowest elevation that can occur, or the minimum encodes to 0
and the decoder cannot tell it from a hole. `offsetFor` therefore returns
`Math.floor(minElevation) - step`.

Until 2026-10-02 it returned `Math.floor(minElevation)`, which is not enough: GLO-30
flattens water surfaces and the floodplain has metres of relief, so a real pixel sitting
at exactly the floor elevation is common, and it encoded to the reserved code. On
read-back those cells became holes — real terrain the renderer was discarding:

| Area                 | Cells lost | Share of grid | Old offset | New offset |
| -------------------- | ---------- | ------------- | ---------- | ---------- |
| **assam-overview**   | 49         | 0.004%        | 0          | −0.15      |
| **majuli**           | 1,938      | 0.09%         | 68         | 67.9       |
| **sadiya-dibrugarh** | 0          | 0%            | 74         | 73.9       |

**1,987 cells recovered, 0 remaining.** Sadiya-dibrugarh never collided because its
minimum of 74.5 m already sat above the floored offset of 74.

`noDataPixels` in all three sidecars reads **0**, and after this migration that number is
finally true of the artefacts rather than only of the source tiles — it now agrees with
what the decoder finds.

#### These files were migrated, not rebuilt

> **The committed artefacts were NOT regenerated from the Copernicus source.**
> `npm run data:dem` was not re-run against the fixed encoding. What happened instead is
> `npm run data:dem:migrate` (`scripts/migrate-nodata-encoding.ts`), a one-off that
> transformed the committed bytes:
>
> ```
> every Terrain-RGB code  += 1
> sidecar encoding.offset -= step
> ```
>
> That is exactly invertible, because decoding is `code * step + offset`:
> `(c+1)*step + (O−step) === c*step + O`. **No pixel's elevation changed.** Measured over
> all 6,635,948 pixels: 0 pixels differ in the float32 values the decoder delivers. The
> worst float64 deviation between the two algebraically identical forms is 2.2e-16
> relative — one ULP — and it vanishes on narrowing to float32, which is what the decoder
> stores. Both the sidecars and `manifest.json` carry a `migration` block recording this,
> with `pipelineRebuilt: false` and `reproducibilityVerified: false`.

**What this means for reproducibility, stated plainly.** The manifest's SHA-256 values
cover the committed files, and the files are self-consistent: `tests/dem-artifacts.test.ts`
hashes them and `tests/terrain-sampling.test.ts` decodes them. What is **unverified** is
that running `npm run data:dem` against the fixed encoder would reproduce these exact
bytes. The migration uses the same `PNG.sync.write` call with the same options the
pipeline makes, which is the strongest claim available without network access, but it is
a claim rather than a measurement. Tracked as an unchecked item in `docs/ROADMAP.md`
phase 2: rebuild one area and compare hashes.

The migration refuses to run if either `noDataPixels` or `sourceNoDataPixels` is non-zero
in any sidecar. Those are real holes, and after the fact a genuine hole is
indistinguishable from the collision — promoting one to code 1 would invent terrain out
of nothing, which is the failure `AGENTS.md` §6 exists to prevent. All three read 0.

### Why the overview uses a 0.15 m step and the reaches use 0.1 m

16-bit Terrain-RGB holds 65,535 codes, so the maximum representable span is
`65535 × step`: **6,554 m at 0.1 m**. The overview's bbox reaches into the Mishmi Hills,
whose highest point inside it measures **7,446.5 m**, giving a span of 7,447 m. That does
not fit at 0.1 m — it would need 74,470 codes — so the area is encoded at 0.15 m, where the
budget is 9,830 m.

This costs nothing real. The overview's pixel is 530 m across, so one step is 0.0003 of a
pixel, and 0.15 m sits an order of magnitude below the source's own 1.472 m LE90 vertical
error. The two river reaches span 2,031 m and 1,745 m, so 0.1 m is fine and is what they
use. The step is recorded **per area** in each sidecar rather than assumed globally, because
it follows from the data's range, not from the format.

### Reading the committed files

`src/engine/terrain/` decodes them headlessly, with no DOM and no React: `decodePng` for the
container, `decodeTerrainRgba` for the pixels. No-data is explicit — code 0 becomes `NaN`
in the height array with a companion `Uint8Array` mask, so a caller cannot read a no-data
cell as an elevation because there is no number there. `encodeElevation` throws rather than
wrapping on an out-of-range value.

Because the offset now sits one step below the lowest elevation, code 0 is unreachable by
a real measurement: no-data and "the lowest terrain in the world" are no longer the same
number. See "The no-data encoding" above.

> **In the browser, decode via `createImageBitmap` with `premultiplyAlpha: 'none'` and
> `colorSpaceConversion: 'none'`.** Terrain-RGB is a measurement encoding, not a picture.
> Default alpha handling premultiplies RGB by alpha and silently scales elevations; default
> colour management can transform the values. Files are written colour-type 2 with no alpha
> precisely so the first cannot bite. The failure is invisible — a mis-decoded heightfield
> still looks like terrain. See `docs/ARCHITECTURE.md`.

### Open gap: no independent elevation validation

> **Gap, recorded 2026-10-01.** The pipeline's elevation checks are **self-consistency**,
> not accuracy validation. `tests/dem-artifacts.test.ts` asserts that the committed overview
> falls monotonically from Sadiya to Dhubri (129.9 → 26.6 m, ~103 m of fall), which catches
> a pipeline fault — a flipped axis, a wrong tile, a broken resample — but every number in it
> comes out of the same source as the data, so it cannot detect an error in Copernicus.
>
> Two **plausibility** checks are in place against published figures, deliberately loose
> because a gazetteer "town elevation" is not a survey point — it is often the height at the
> district headquarters, or averaged over a municipal area, while we sample one pixel:
>
> | Place                | Published | Source                                           | Our value | Tolerance |
> | -------------------- | --------- | ------------------------------------------------ | --------- | --------- |
> | Majuli island centre | 85–90 m   | Majuli District Administration, "About District" | 87.4 m    | ±30 m     |
> | Sadiya               | 123 m     | Wikipedia infobox (tertiary)                     | 127.3 m   | ±30 m     |
>
> The Sadiya figure rests on a tertiary source and is treated as such. A ±30 m tolerance
> catches a gross fault (wrong sign, wrong datum, off-by-a-tile) and would not catch a
> systematic bias.
>
> **A real check needs benchmark levelling data from the Survey of India or GSI, which we do
> not hold and have not verified a licence for.** Until then, treat the terrain as
> unvalidated in absolute terms — which is already what §12 says, and what the
> `limitations` list in every sidecar says.

---

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
