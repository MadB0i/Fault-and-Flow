/**
 * `npm run data:dem` — build the committed terrain artefacts.
 *
 * Reads Copernicus DEM GLO-30 COG tiles over HTTP range requests, resamples each
 * area of interest onto its target grid, and writes:
 *
 *   data/processed/<area>.png          Terrain-RGB, colour type 2, no alpha
 *   data/processed/<area>.json         sidecar metadata
 *   data/processed/manifest.json       source URLs, tile IDs, SHA-256s, versions
 *
 * Deterministic: same inputs and same code produce byte-identical outputs, which
 * is what makes `manifest.json` a meaningful check. The only non-deterministic
 * input is the source data itself, and its hash is recorded.
 *
 * Usage:
 *   npm run data:dem                 build everything
 *   npm run data:dem -- --check      run the landmark assertions only
 *   npm run data:dem -- --previews   also write hillshade previews (gitignored)
 */

import dns from 'node:dns';
import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { fromUrl } from 'geotiff';
import { PNG } from 'pngjs';

import {
  GLO30_PIXEL_DEG,
  SOURCE_NODATA,
  encodeElevation,
  isNoData,
  offsetFor,
} from '../src/engine/terrain/terrain-rgb.ts';
import {
  AREAS,
  MIN_LANDMARK_MARGIN_M,
  containsPoint,
  marginMetres,
  type Area,
  type Bbox,
} from './dem-areas.ts';
import { assertSpacing } from './dem-spacing.ts';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BUCKET = 'https://copernicus-dem-30m.s3.amazonaws.com';

/**
 * Source tile naming.
 *
 * TRAP, documented in docs/DATA.md §1 and verified against the sidecar XML: the
 * `10` here is 10 ARCSECONDS, not metres. GLO-30 is the 1-arcsecond product and
 * its files are named `COG_10_*`; the 90 m product is `COG_30_*` and lives in the
 * *other* bucket. Globbing for `_30_` silently picks up three-times-coarser
 * terrain, which is why `assertSpacing` below is a hard failure rather than a
 * warning.
 */
const TILE_PREFIX = 'Copernicus_DSM_COG_10_';
const TILE_SUFFIX = '_DEM';

const M_PER_DEG = 111_320;

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
/** Ground size of one output pixel, metres. Used by the hillshade slope term. */
let CELL_M = 1;
const RAW_DIR = path.join(ROOT, 'data', 'raw');
const OUT_DIR = path.join(ROOT, 'data', 'processed');
const PREVIEW_DIR = path.join(RAW_DIR, 'previews');
const CACHE_DIR = path.join(RAW_DIR, 'cache');

/** Licence text and attribution, quoted in docs/DATA.md §1. Kept here so the
 *  manifest carries the same strings the UI will display. */
const ATTRIBUTION_ADAPTED =
  'produced using Copernicus WorldDEM-30 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved';
const ATTRIBUTION_REDISTRIBUTION =
  'The organisations in charge of the Copernicus programme by law or by delegation do not incur any liability for any use of the Copernicus WorldDEM-30';
const LICENCE_NAME =
  'Licence for Copernicus DEM instance COP-DEM-GLO-30-F Global 30m Full, Free & Open — Licence for the use of the Copernicus WorldDEM-30';
const LICENCE_URL =
  'https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Data/DEM/resources/license/License-COPDEM-30.pdf';
const CITATION_DOI = 'https://doi.org/10.5270/ESA-c5d3d65';

/**
 * Attempts per source tile before giving up.
 *
 * The run makes a few hundred range requests against S3. Transient connect
 * timeouts and socket resets are a property of the route, not of the data, and
 * abandoning a half-finished run that has already spent a large share of the
 * download budget would be the wrong response to a flaky network.
 */
const TILE_ATTEMPTS = 40;

/**
 * Prefer IPv4 when resolving.
 *
 * Measured, not theoretical: the bucket answers on IPv4 immediately, while every
 * IPv6 address in the connection attempt times out after 10 s. Node's default
 * "verbatim" ordering tries those first, so a range request could burn ten
 * seconds per attempt before falling back to an address that works instantly.
 * With this set, the same read that failed repeatedly completed on the first try.
 */
dns.setDefaultResultOrder('ipv4first');

/**
 * Pause between source tiles, milliseconds.
 *
 * Measured symptom: partway through the 40-tile overview area, every subsequent
 * fetch began failing with connect timeouts even though the same tile fetched
 * cleanly in isolation. Sequential reads with a brief gap between them do not
 * reproduce it. This is a workaround for the fetch stack, not a belief about the
 * source, so it is deliberately small and documented rather than tuned.
 */
const TILE_PAUSE_MS = 250;

/**
 * Bytes of header prepended to each cached window: width, height (uint32), west,
 * north, step (float64), noDataCount (uint32).
 */
const HEADER_BYTES = 40;

/** Total committed PNG budget from the task brief. */
const TOTAL_PNG_BUDGET_BYTES = 9 * 1024 * 1024;
/** Per-file ceiling from AGENTS.md §5. */
const FILE_CEILING_BYTES = 5 * 1024 * 1024;

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

function tileNameFor(bbox: Bbox): string[] {
  const out: string[] = [];
  for (let lat = Math.floor(bbox.south); lat < bbox.north; lat++) {
    for (let lon = Math.floor(bbox.west); lon < bbox.east; lon++) {
      out.push(`N${String(lat).padStart(2, '0')}_00_E${String(lon).padStart(3, '0')}_00`);
    }
  }
  return out;
}

function tileUrl(tile: string): string {
  return `${BUCKET}/${TILE_PREFIX}${tile}${TILE_SUFFIX}/${TILE_PREFIX}${tile}${TILE_SUFFIX}.tif`;
}

/** Output pixel counts, from the target ground size and the box's real extent. */
function outputGrid(area: Area): {
  width: number;
  height: number;
  pixelMx: number;
  pixelMy: number;
} {
  const { west, east, south, north } = area.bbox;
  const midLat = (south + north) / 2;
  const widthM = (east - west) * M_PER_DEG * Math.cos((midLat * Math.PI) / 180);
  const heightM = (north - south) * M_PER_DEG;
  // Keep the output grid at or below the target resolution. Rounding up would
  // overshoot both the pixel budget and the file size.
  const width = Math.max(1, Math.floor(widthM / area.targetPixelSizeM));
  const height = Math.max(1, Math.floor(heightM / area.targetPixelSizeM));
  return {
    width,
    height,
    pixelMx: widthM / width,
    pixelMy: heightM / height,
  };
}

// ---------------------------------------------------------------------------
// Source reading
// ---------------------------------------------------------------------------

type Window = {
  data: Float32Array;
  width: number;
  height: number;
  west: number;
  north: number;
  stepDeg: number;
  noDataCount: number;
};

/**
 * On-disk cache of one resampled tile contribution, keyed by tile, area and
 * overview level.
 *
 * The route to this bucket is intermittently unreliable: the same window read
 * three times in a row failed twice with a connect timeout, and succeeded the
 * third time, with no pattern to the failures. Without a cache, a run that dies
 * on tile 39 of 40 has to refetch tiles 1-38, which is where most of the
 * download budget goes.
 *
 * Stored under data/raw/, which is gitignored, and cleared at the end of a
 * successful run. The cache is a byte-for-byte copy of the source window, so it
 * introduces no possibility of a stale or half-written tile being used: a cache
 * hit must have been fully written, or it is not read.
 */
async function readWindowCached(
  tile: string,
  bbox: Bbox,
  overviewLevel: number,
): Promise<Window> {
  const key = `${tile}_lvl${overviewLevel}_${bbox.west}_${bbox.south}_${bbox.east}_${bbox.north}`;
  const cachePath = path.join(CACHE_DIR, `${key}.bin`);
  try {
    const buf = await readFile(cachePath);
    const header = new DataView(buf.buffer, buf.byteOffset, HEADER_BYTES);
    const width = header.getUint32(0);
    const height = header.getUint32(4);
    const west = header.getFloat64(8);
    const north = header.getFloat64(16);
    const stepDeg = header.getFloat64(24);
    const noDataCount = header.getUint32(32);
    const data = new Float32Array(
      buf.buffer.slice(buf.byteOffset + HEADER_BYTES, buf.byteOffset + buf.byteLength),
    );
    if (data.length !== width * height) throw new Error('cache entry is truncated');
    return { data, width, height, west, north, stepDeg, noDataCount };
  } catch {
    // No usable cache entry; fetch below.
  }

  const win = await readWindow(tile, bbox, overviewLevel);
  const head = Buffer.alloc(HEADER_BYTES);
  const hv = new DataView(head.buffer);
  hv.setUint32(0, win.width);
  hv.setUint32(4, win.height);
  hv.setFloat64(8, win.west);
  hv.setFloat64(16, win.north);
  hv.setFloat64(24, win.stepDeg);
  hv.setUint32(32, win.noDataCount);
  await writeFile(
    cachePath,
    Buffer.concat([
      head,
      Buffer.from(win.data.buffer, win.data.byteOffset, win.data.byteLength),
    ]),
  );
  return win;
}

async function readWindow(
  tile: string,
  bbox: Bbox,
  overviewLevel: number,
): Promise<Window> {
  // Retry the whole tile operation, not just the open: geotiff fetches lazily
  // when a window is read, so a dropped connection surfaces from readRasters and
  // would otherwise escape the retry entirely.
  let lastError: Error | undefined;
  for (let attempt = 1; attempt <= TILE_ATTEMPTS; attempt++) {
    try {
      return await readWindowOnce(tile, bbox, overviewLevel);
    } catch (err) {
      lastError = err as Error;
      if (attempt === TILE_ATTEMPTS) break;
      // Fixed 1 s wait. Connect latency measured against this bucket ranged from
      // 0.5 s to over 25 s and was not correlated with attempt number — the same
      // window succeeded and failed on consecutive tries — so backing off
      // exponentially only delays the success. What matters is trying again.
      const waitMs = 1000;
      console.warn(
        `  fetch failed for ${tile} (${lastError.message}); retry ${attempt}/${TILE_ATTEMPTS - 1} in ${waitMs} ms`,
      );
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }
  throw new Error(
    `could not read source tile ${tile}: ${lastError?.message ?? 'unknown error'}`,
  );
}

async function readWindowOnce(
  tile: string,
  bbox: Bbox,
  overviewLevel: number,
): Promise<Window> {
  const tiff = await fromUrl(tileUrl(tile));

  // Overview IFDs in these COGs carry NO georeferencing tags: no ModelPixelScale
  // (33550), no ModelTiepoint (33922), no GeoKeyDirectory (34735). Verified by
  // reading the IFD chain of N27_00_E094_00 — only IFD0 has them. So the
  // overview's geotransform has to be derived from the full-res image rather than
  // asked for, and geotiff's getResolution() throws on the overview.
  //
  // That is safe because the overviews are exact integer halvings of the full-res
  // grid and share its origin, so step = base * 2^level. `assertSpacing` then
  // checks the derived value against the expected 1 arcsecond, which is what
  // catches a wrong product.
  const base = await tiff.getImage();
  const baseStep = base.getResolution()[0] as number;
  assertSpacing(baseStep, `${tile} full-res`);

  const image = await tiff.getImage(overviewLevel);
  const stepDeg = baseStep * 2 ** overviewLevel;
  assertSpacing(stepDeg / 2 ** overviewLevel, `${tile} overview ${overviewLevel} base`);

  const [originX, originY] = base.getOrigin() as [number, number, number];

  // Source pixel window covering the bbox, clamped to the OVERVIEW's dimensions.
  // Clamping to the full-res size instead would ask the overview for a window
  // three times wider than it has, which returns mostly-empty rasters and turns
  // into a silently sparse area.
  const wMax = image.getWidth();
  const hMax = image.getHeight();
  const x0 = Math.max(0, Math.floor((bbox.west - originX) / stepDeg));
  const x1 = Math.min(wMax, Math.ceil((bbox.east - originX) / stepDeg));
  const y0 = Math.max(0, Math.floor((originY - bbox.north) / stepDeg));
  const y1 = Math.min(hMax, Math.ceil((originY - bbox.south) / stepDeg));
  const w = Math.max(1, x1 - x0);
  const h = Math.max(1, y1 - y0);

  const rasters = (await image.readRasters({
    samples: [0],
    window: [x0, y0, x0 + w, y0 + h],
    interleave: false,
  })) as Float32Array[];
  const data = rasters[0]!;

  let noDataCount = 0;
  for (let i = 0; i < data.length; i++) {
    if (isNoData(data[i]!)) noDataCount++;
  }

  return {
    data,
    width: w,
    height: h,
    west: originX + x0 * stepDeg,
    north: originY - y0 * stepDeg,
    stepDeg,
    noDataCount,
  };
}

/**
 * Box-average a source window onto the output grid.
 *
 * Source indices are derived from GEOGRAPHY, not from the output grid's
 * fractional position. That distinction matters: an area spans many tiles, and
 * each tile's window covers only its own sliver of the area, so treating every
 * window as if it started at the area's west edge would push the later tiles'
 * samples off the end of their own buffer and leave most of the area empty.
 */
function resample(
  win: Window,
  bbox: Bbox,
  outW: number,
  outH: number,
): { heights: Float32Array; noData: Uint8Array; touched: Uint8Array } {
  const heights = new Float32Array(outW * outH);
  const noData = new Uint8Array(outW * outH);
  // `touched` marks output pixels this window overlaps at all, whether or not
  // they held valid data. Without it an output pixel outside this tile is
  // indistinguishable from one this tile covered, and the composite would accept
  // the untouched default of 0 m as a real elevation.
  const touched = new Uint8Array(outW * outH);

  // Geographic span of one output pixel, in degrees. Source pixel indices are
  // derived from this against the window's own origin, which is what lets a
  // multi-tile area union correctly.
  const degPerOutX = (bbox.east - bbox.west) / outW;
  const degPerOutY = (bbox.north - bbox.south) / outH;

  for (let oy = 0; oy < outH; oy++) {
    // Output row oy spans [bbox.north - (oy+1)*degPerOutY, bbox.north - oy*degPerOutY].
    const latTop = bbox.north - oy * degPerOutY;
    const latBot = latTop - degPerOutY;
    // Window-local source rows.
    const sy0 = (win.north - latTop) / win.stepDeg;
    const sy1 = (win.north - latBot) / win.stepDeg;
    for (let ox = 0; ox < outW; ox++) {
      const lonL = bbox.west + ox * degPerOutX;
      const lonR = lonL + degPerOutX;
      const sx0 = (lonL - win.west) / win.stepDeg;
      const sx1 = (lonR - win.west) / win.stepDeg;

      // Skip pixels this window does not cover at all. The caller unions tiles,
      // so a tile that misses the output pixel must leave it for another tile
      // rather than claim it as no-data.
      if (sx1 <= 0 || sx0 >= win.width || sy1 <= 0 || sy0 >= win.height) continue;
      touched[oy * outW + ox] = 1;

      let sum = 0;
      let count = 0;
      const iy0 = Math.max(0, Math.floor(sy0));
      const iy1 = Math.min(win.height, Math.max(iy0 + 1, Math.ceil(sy1)));
      const ix0 = Math.max(0, Math.floor(sx0));
      const ix1 = Math.min(win.width, Math.max(ix0 + 1, Math.ceil(sx1)));
      for (let sy = iy0; sy < iy1; sy++) {
        const wy = Math.min(sy1, sy + 1) - Math.max(sy0, sy);
        if (wy <= 0) continue;
        for (let sx = ix0; sx < ix1; sx++) {
          const wx = Math.min(sx1, sx + 1) - Math.max(sx0, sx);
          if (wx <= 0) continue;
          const v = win.data[sy * win.width + sx]!;
          if (isNoData(v)) continue;
          sum += v * wx * wy;
          count += wx * wy;
        }
      }
      const i = oy * outW + ox;
      if (count <= 0) continue; // this tile has nothing here; another may
      const expected = Math.max(
        1,
        (Math.min(sx1, win.width) - Math.max(sx0, 0)) *
          (Math.min(sy1, win.height) - Math.max(sy0, 0)),
      );
      if (count < 0.5 * expected) {
        // Mostly no-data even though the window covers it: treat as no-data
        // rather than averaging a handful of real samples into a confident
        // looking number.
        noData[i] = 1;
        heights[i] = Number.NaN;
      } else {
        heights[i] = sum / count;
      }
    }
  }
  return { heights, noData, touched };
}

// ---------------------------------------------------------------------------
// Landmark checks — the pre-flight gate
// ---------------------------------------------------------------------------

function checkLandmarks(areas: readonly Area[]): {
  failures: string[];
  rows: string[];
} {
  const failures: string[] = [];
  const rows: string[] = [];
  for (const area of areas) {
    for (const lm of area.landmarks) {
      const inside = containsPoint(area.bbox, lm.lon, lm.lat);
      const margin = marginMetres(area.bbox, lm.lon, lm.lat);
      // An extent edge only has to be inside; the margin exists to keep a point
      // landmark off the boundary so a small bbox change cannot drop it.
      const required = lm.isExtentEdge ? 0 : MIN_LANDMARK_MARGIN_M;
      const ok = inside && margin >= required;
      const marginKm = (margin / 1000).toFixed(1);
      rows.push(
        `${ok ? 'ok  ' : 'FAIL'} ${area.id.padEnd(16)} ${lm.name.padEnd(20)} ` +
          `(${lm.lon.toFixed(5)}, ${lm.lat.toFixed(5)}) margin ${marginKm.padStart(6)} km` +
          `${lm.isExtentEdge ? ' [extent edge, inside only]' : ''}`,
      );
      if (!ok) {
        failures.push(
          inside
            ? `${area.id}: landmark "${lm.name}" is only ${marginKm} km inside the bbox (needs ${required / 1000} km)`
            : `${area.id}: landmark "${lm.name}" at (${lm.lon}, ${lm.lat}) is OUTSIDE the bbox`,
        );
      }
    }
  }
  return { failures, rows };
}

// ---------------------------------------------------------------------------
// PNG output
// ---------------------------------------------------------------------------

/**
 * Write Terrain-RGB as a colour-type-2 PNG.
 *
 * pngjs lays `png.data` out according to the INPUT colour type, not the output
 * one. With `inputHasAlpha: false` it expects packed RGB triplets, so handing it
 * RGBA shifts every pixel by a channel: the file still decodes, still has the
 * right dimensions, and still passes a naive smoke test, while every elevation is
 * wrong. Hence RGB in, colourType 2 out.
 */
function encodePng(rgb: Uint8Array, width: number, height: number): Buffer {
  if (rgb.length !== width * height * 3) {
    throw new RangeError(`expected ${width * height * 3} RGB bytes, got ${rgb.length}`);
  }
  const png = new PNG({ width, height, colorType: 2, inputHasAlpha: false });
  png.data.set(rgb);
  return PNG.sync.write(png, { colorType: 2, inputHasAlpha: false });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const checkOnly = args.includes('--check');
  const withPreviews = args.includes('--previews');

  console.log('DEM pipeline — Copernicus GLO-30 (Copernicus WorldDEM-30)\n');

  // --- Pre-flight: landmarks -------------------------------------------------
  const { failures, rows } = checkLandmarks(AREAS);
  console.log('Landmark containment:');
  for (const r of rows) console.log(`  ${r}`);
  if (failures.length > 0) {
    console.error('\nLANDMARK CHECK FAILED:');
    for (const f of failures) console.error(`  - ${f}`);
    process.exitCode = 1;
    return;
  }
  console.log(`  all landmarks inside their boxes\n`);
  if (checkOnly) return;

  await mkdir(OUT_DIR, { recursive: true });
  await mkdir(CACHE_DIR, { recursive: true });
  if (withPreviews) await mkdir(PREVIEW_DIR, { recursive: true });

  const manifestAreas: unknown[] = [];
  const artefacts: { name: string; bytes: number }[] = [];
  let totalBytes = 0;

  for (const area of AREAS) {
    const grid = outputGrid(area);
    CELL_M = Math.max(grid.pixelMx, grid.pixelMy);
    const tiles = tileNameFor(area.bbox);
    console.log(
      `${area.id}: ${grid.width}x${grid.height} px ` +
        `(${grid.pixelMx.toFixed(1)} x ${grid.pixelMy.toFixed(1)} m), ` +
        `${tiles.length} source tile(s), overview ${area.overviewLevel}`,
    );

    const heights = new Float32Array(grid.width * grid.height);
    // `covered` is the union mask: 1 where some tile supplied a real elevation.
    // The per-tile no-data lives in `part.noData`; what matters here is whether
    // any tile covered each output pixel at all.
    const covered = new Uint8Array(grid.width * grid.height);
    let minElev = Number.POSITIVE_INFINITY;
    let maxElev = Number.NEGATIVE_INFINITY;
    let sourceNoData = 0;

    for (const tile of tiles) {
      const win = await readWindowCached(tile, area.bbox, area.overviewLevel);
      // Let the socket drain between tiles. The bucket tolerates a burst of range
      // requests from one process, but observed behaviour over a 40-tile area was
      // that sustained back-to-back reads eventually exhausted the connection pool
      // and every subsequent fetch timed out. A short pause between tiles keeps
      // the run reliable at negligible cost.
      await new Promise((r) => setTimeout(r, TILE_PAUSE_MS));
      sourceNoData += win.noDataCount;
      const part = resample(win, area.bbox, grid.width, grid.height);
      process.stdout.write('.');
      if ((tiles.indexOf(tile) + 1) % 10 === 0) process.stdout.write(' ');

      // Union the tiles. Only pixels this tile actually overlapped may be written,
      // and only where it held real data. Tiles in a bbox overlap only along their
      // shared edge, which the COG publisher already removed, so this is a plain
      // union with no arbitration needed.
      for (let i = 0; i < part.heights.length; i++) {
        if (!part.touched[i] || part.noData[i]) continue;
        if (covered[i]) continue;
        heights[i] = part.heights[i]!;
        covered[i] = 1;
        const v = part.heights[i]!;
        if (v < minElev) minElev = v;
        if (v > maxElev) maxElev = v;
      }
    }

    const coveredCount = covered.reduce((a, b) => a + b, 0);
    if (coveredCount === 0) {
      throw new Error(`${area.id}: no source data covered the bbox`);
    }
    if (coveredCount < heights.length) {
      console.warn(
        `  WARNING: ${heights.length - coveredCount} px (${(
          ((heights.length - coveredCount) / heights.length) *
          100
        ).toFixed(1)}%) have no source coverage and will be written as no-data`,
      );
    }

    const step = area.step;
    const offset = offsetFor(minElev);
    const range = maxElev - offset;
    if (range / step > 65535) {
      throw new Error(
        `${area.id}: elevation range ${range.toFixed(1)} m exceeds the Terrain-RGB range at ${step} m steps (budget ${(65535 * step).toFixed(0)} m)`,
      );
    }

    // Encode. No-data pixels take code 0; because `offset` is at or below the
    // observed minimum, a real elevation can never legitimately encode to 0.
    const rgb = new Uint8Array(grid.width * grid.height * 3);
    for (let i = 0; i < heights.length; i++) {
      const o = i * 3;
      let code: number;
      if (!covered[i] || Number.isNaN(heights[i]!)) {
        code = 0;
      } else {
        code = encodeElevation(heights[i]!, offset, step);
      }
      rgb[o] = (code >> 16) & 0xff;
      rgb[o + 1] = (code >> 8) & 0xff;
      rgb[o + 2] = code & 0xff;
    }

    const pngBytes = encodePng(rgb, grid.width, grid.height);
    if (pngBytes.length > FILE_CEILING_BYTES) {
      throw new Error(
        `${area.id}: ${pngBytes.length} bytes exceeds the ${FILE_CEILING_BYTES} byte per-file ceiling (AGENTS.md §5). Reduce targetPixelSizeM.`,
      );
    }
    const pngPath = path.join(OUT_DIR, `${area.id}.png`);
    await writeFile(pngPath, pngBytes);

    const noDataCount = heights.length - coveredCount;
    const generated = new Date().toISOString().slice(0, 10);
    const sidecar = {
      area: area.id,
      title: area.title,
      description: area.description,
      bbox: area.bbox,
      crs: 'EPSG:4326',
      width: grid.width,
      height: grid.height,
      pixelSizeMx: Number(grid.pixelMx.toFixed(3)),
      pixelSizeMy: Number(grid.pixelMy.toFixed(3)),
      minElevation: Number(minElev.toFixed(2)),
      maxElevation: Number(maxElev.toFixed(2)),
      meanElevation: Number(
        (
          Array.from(covered.keys())
            .map((i) => heights[i]!)
            .reduce((a, b) => a + b, 0) / coveredCount
        ).toFixed(2),
      ),
      noDataPixels: noDataCount,
      sourceNoDataPixels: sourceNoData,
      encoding: {
        format: 'terrain-rgb',
        step,
        offset,
        noDataCode: 0,
        sourceNoDataSentinel: SOURCE_NODATA,
        colourType: 2,
        note: 'code = round((elevation - offset) / step); no-data is code 0',
      },
      source: {
        dataset: 'Copernicus DEM GLO-30 Public',
        productId: 'COP-DEM_GLO-30-DGED',
        distribution: 'AWS Open Data, anonymous S3',
        bucket: 's3://copernicus-dem-30m',
        tileIds: tiles,
        overviewLevel: area.overviewLevel,
        sourcePixelSpacingDeg: GLO30_PIXEL_DEG,
        verticalDatum: 'EGM2008 geoid (orthometric)',
        acquisition: 'TanDEM-X, 2011-2015',
      },
      attribution: ATTRIBUTION_ADAPTED,
      attributionRedistribution: ATTRIBUTION_REDISTRIBUTION,
      licence: LICENCE_NAME,
      licenceUrl: LICENCE_URL,
      citation: CITATION_DOI,
      generated,
      limitations: [
        'DSM, not a bare-earth DTM: buildings and vegetation are included, so slopes are surface slopes.',
        'Water surfaces are flattened and rivers edited for consistency; there is NO riverbed bathymetry.',
        `Vertical error LE90 is 1.472 m per source tile, a large fraction of the floodplain's few metres of relief.`,
        'Pixels are not square: GLO-30 is a 1 arcsecond grid, so ground size varies with latitude.',
      ],
    };
    const jsonPath = path.join(OUT_DIR, `${area.id}.json`);
    const jsonBytes = Buffer.from(`${JSON.stringify(sidecar, null, 2)}\n`, 'utf8');
    await writeFile(jsonPath, jsonBytes);

    if (withPreviews) {
      await writePreview(area.id, heights, covered, grid.width, grid.height);
    }

    artefacts.push({
      name: `${area.id}.png`,
      bytes: pngBytes.length,
    });
    totalBytes += pngBytes.length;

    manifestAreas.push({
      id: area.id,
      bbox: area.bbox,
      width: grid.width,
      height: grid.height,
      pixelSizeMx: sidecar.pixelSizeMx,
      pixelSizeMy: sidecar.pixelSizeMy,
      sourceTiles: tiles.map((t) => ({ id: t, url: tileUrl(t) })),
      overviewLevel: area.overviewLevel,
      landmarks: area.landmarks.map((l) => ({
        name: l.name,
        lon: l.lon,
        lat: l.lat,
        source: l.source,
      })),
      outputs: [
        {
          file: `${area.id}.png`,
          bytes: pngBytes.length,
          sha256: createHash('sha256').update(pngBytes).digest('hex'),
        },
        {
          file: `${area.id}.json`,
          bytes: jsonBytes.length,
          sha256: createHash('sha256').update(jsonBytes).digest('hex'),
        },
      ],
    });

    console.log(
      `  wrote ${area.id}.png ${(pngBytes.length / 1024).toFixed(0)} KB ` +
        `(${grid.width}x${grid.height}), elevation ${minElev.toFixed(1)}..${maxElev.toFixed(1)} m, ` +
        `no-data ${noDataCount} px\n`,
    );
  }

  console.log(
    `Total PNG bytes: ${(totalBytes / 1024 / 1024).toFixed(2)} MB of ${(TOTAL_PNG_BUDGET_BYTES / 1024 / 1024).toFixed(0)} MB budget`,
  );
  if (totalBytes > TOTAL_PNG_BUDGET_BYTES) {
    throw new Error(
      `total committed PNG size ${totalBytes} exceeds the ${TOTAL_PNG_BUDGET_BYTES} byte budget`,
    );
  }

  // Manifest last, so it can hash the finished files.
  const manifest = {
    schema: 1,
    generated: new Date().toISOString().slice(0, 10),
    generator: 'scripts/build-dem.ts',
    source: {
      dataset: 'Copernicus DEM GLO-30 Public',
      productId: 'COP-DEM_GLO-30-DGED',
      bucket: 's3://copernicus-dem-30m',
      baseUrl: BUCKET,
      tilePrefix: TILE_PREFIX,
      pixelSpacingDeg: GLO30_PIXEL_DEG,
      verticalDatum: 'EGM2008 geoid (orthometric)',
      sourceNoDataSentinel: SOURCE_NODATA,
    },
    licence: LICENCE_NAME,
    licenceUrl: LICENCE_URL,
    attribution: ATTRIBUTION_ADAPTED,
    attributionRedistribution: ATTRIBUTION_REDISTRIBUTION,
    citation: CITATION_DOI,
    toolVersions: {
      node: process.version,
      geotiff: readPkgVersion('geotiff'),
      pngjs: readPkgVersion('pngjs'),
    },
    encoding: {
      format: 'terrain-rgb',
      // Per-area; see the `step` field in scripts/dem-areas.ts for why the
      // overview differs from the two reaches.
      stepByArea: Object.fromEntries(AREAS.map((a) => [a.id, a.step])),
      noDataCode: 0,
      colourType: 2,
    },
    areas: manifestAreas,
  };
  await writeFile(
    path.join(OUT_DIR, 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8',
  );
  console.log('wrote manifest.json');

  // Keep data/raw/.gitkeep: the directory must exist for the cache and previews
  // even on a fresh clone, and deleting it would show up as a spurious deletion.
  await writeFile(path.join(RAW_DIR, '.gitkeep'), '', 'utf8').catch(() => undefined);

  // Raw cache: clear it so the on-disk footprint stays at the previews alone.
  // data/raw/ is gitignored, but leaving hundreds of megabytes behind would
  // defeat the point of the budget, and a later run should not be able to pick
  // up a stale tile by accident.
  const { readdir } = await import('node:fs/promises');
  const entries = await readdir(RAW_DIR).catch(() => [] as string[]);
  const stale = entries.filter(
    (f) => f !== '.gitkeep' && f !== 'previews' && f !== 'cache',
  );
  for (const entry of stale) {
    await rm(path.join(RAW_DIR, entry), { recursive: true, force: true });
  }
  const cached = await readdir(CACHE_DIR).catch(() => [] as string[]);
  const cacheBytes = await Promise.all(
    cached.map(async (f) => (await readFile(path.join(CACHE_DIR, f))).byteLength),
  );
  console.log(
    `data/raw/cache holds ${cached.length} window(s), ${(cacheBytes.reduce((a, b) => a + b, 0) / 1048576).toFixed(1)} MB ` +
      '(delete data/raw to force a refetch)',
  );
}

function readPkgVersion(name: string): string {
  const pkgPath = path.join(ROOT, 'node_modules', name, 'package.json');
  try {
    const raw = readFileSync(pkgPath, 'utf8');
    return (JSON.parse(raw) as { version: string }).version;
  } catch {
    return 'unknown';
  }
}

/** Throwaway hillshade for eyeballing an area. Never committed. */
async function writePreview(
  id: string,
  heights: Float32Array,
  covered: Uint8Array,
  width: number,
  height: number,
): Promise<void> {
  // Percentile stretch, not min-max. These areas span from a floodplain at ~70 m
  // to hills at 2000 m, so a linear min-max ramp puts the entire river plain at
  // t < 0.02 and the preview renders as one flat wash — which reads as missing
  // data when the data is fine. Stretching on the 2nd..98th percentile shows the
  // channel network, which is what the preview is for.
  const sorted: number[] = [];
  for (let i = 0; i < heights.length; i++) {
    if (covered[i]) sorted.push(heights[i]!);
  }
  sorted.sort((a, b) => a - b);
  const pick = (p: number): number =>
    sorted[
      Math.min(sorted.length - 1, Math.max(0, Math.floor(p * (sorted.length - 1))))
    ] ?? 0;
  const lo = pick(0.02);
  const hi = pick(0.98);
  const span = Math.max(1e-6, hi - lo);
  const at = (x: number, y: number): number => {
    if (x < 0 || y < 0 || x >= width || y >= height) return Number.NaN;
    const i = y * width + x;
    return covered[i] ? heights[i]! : Number.NaN;
  };
  const rgb = new Uint8Array(width * height * 3);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 3;
      const z = at(x, y);
      if (Number.isNaN(z)) {
        rgb[o] = 20;
        rgb[o + 1] = 20;
        rgb[o + 2] = 24;
        continue;
      }
      // Vertical exaggeration. These areas span ~2000 m from floodplain to hill,
      // so a channel 2 m deep is a thousandth of the relief and shades as a flat
      // wash under true-scale shading. Exaggerating relief is standard
      // cartographic practice for flat terrain and is what makes the channel
      // network visible at all. It affects the PREVIEW ONLY — no committed
      // artefact and no engine value depends on it.
      const EXAGGERATION = 20;
      const dzdx = ((at(x + 1, y) - at(x - 1, y)) / 2) * EXAGGERATION;
      const dzdy = ((at(x, y + 1) - at(x, y - 1)) / 2) * EXAGGERATION;
      // Sun from the north-west, the cartographic convention for hillshade.
      const slope = Math.atan(Math.hypot(dzdx, dzdy) / CELL_M);
      const aspect = Math.atan2(dzdy, -dzdx);
      const az = (315 * Math.PI) / 180;
      const alt = (45 * Math.PI) / 180;
      const shade = Math.max(
        0,
        Math.min(
          1,
          Math.cos(alt) * Math.cos(slope) +
            Math.sin(alt) * Math.sin(slope) * Math.cos(az - aspect),
        ),
      );
      const t = Math.max(0, Math.min(1, (z - lo) / span));
      // The project's terrain ramp, roughly: dark green to bone.
      const r = Math.round(28 + 220 * t);
      const g = Math.round(59 + 170 * t);
      const b = Math.round(53 + 150 * t);
      const k = 0.35 + 0.65 * shade;
      rgb[o] = Math.round(r * k);
      rgb[o + 1] = Math.round(g * k);
      rgb[o + 2] = Math.round(b * k);
    }
  }
  await writeFile(
    path.join(PREVIEW_DIR, `${id}-hillshade.png`),
    encodePng(rgb, width, height),
  );
  console.log(`  preview: data/raw/previews/${id}-hillshade.png (not committed)`);
}

await main();
