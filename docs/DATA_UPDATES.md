# Dated history updates

The browser uses a bundled historical catalogue and works without a runtime data
service. `npm run data:quakes:refresh` makes a fresh USGS FDSN query for the same
M5+, geographical and start-date subset, ending at UTC midnight on the build day.
It stores the actual retrieval date, cutoff, source URL and raw-response SHA-256.
The timeline's endpoints, replay limit and source readout derive from that data.
It does not make a future earthquake prediction or fetch current flood observations.

The updater rejects HTTP errors, empty or truncated responses, duplicate IDs,
invalid coordinates, non-finite measurements, out-of-subset events and invalid
record links before replacing the last good file. The valid response is formatted
and written through a temporary file. Offline failure regressions verify that
the previous catalogue bytes remain unchanged. A real refresh was verified on
2026-10-03: 289 records, cutoff 2026-10-03 UTC.

The existing Pages workflow refreshes before formatting, lint, typecheck, unit
tests and build. It also has a daily schedule at 01:17 UTC / 06:47 IST. A failed
step prevents publishing a replacement site. The workflow builds the dated data
into the site without committing a new data snapshot to the repository.
The deployed snapshot's source metadata appears in the UI. For a new committed
baseline, run the updater and review the JSON diff and this document's provenance.

This automation is prepared in the current branch. It requires the workflow on
the repository's default branch, Actions enabled, and Pages using Actions with
its existing environment permissions. No remote settings or deployment were
changed here. GitHub can delay scheduled runs; public repositories' schedules can
be disabled after 60 days without repository activity. Manual dispatch or a main
push also refreshes. See [GitHub schedule documentation](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule).

This is a daily historical refresh, not a real-time monitoring application. USGS
recommends [real-time GeoJSON feeds](https://earthquake.usgs.gov/fdsnws/event/1/)
for automated live displays; a future live feed should have its own stale/error
states and retain this dated baseline. FLOW remains driven by user-set inputs.
Historical flood reports are curated links; official ASDMA, NCS and IMD warnings
remain links, without a claim that this app has verified an active alert.

District names and administration-centre anchors are a separately licensed OSM
extract, reviewed as of 2026-10-03. They are not automatically revised by the quake
job: a district rename or administrative change needs source and naming review.
Run `node scripts/build-districts.mjs` to reproduce cached inputs on the project
drive. Source URLs, hashes and per-source retrieval dates are inside the extract.
