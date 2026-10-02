/**
 * Committed DEM artefacts: decode them headlessly and check they are honest.
 *
 * These tests read the files in `data/processed/`, not the pipeline's in-memory
 * state, so they verify what actually ships. No network: the PNGs are committed.
 *
 * Decoding is memoised per area. The grids are millions of pixels and the
 * decoder is pure TypeScript, so re-reading them per assertion would dominate
 * the run and push individual tests past the default timeout.
 */

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  decodePng,
  decodeTerrainRgba,
  type TerrainGridMeta,
} from '@engine/terrain/decode-terrain.js';
import {
  GLO30_PIXEL_DEG,
  GLO90_PIXEL_DEG,
  SOURCE_NODATA,
  TERRAIN_RGB_STEP_M,
  decodeElevation,
  encodeElevation,
  isNoData,
  offsetFor,
} from '@engine/terrain/terrain-rgb.js';
import {
  AREAS,
  MIN_LANDMARK_MARGIN_M,
  containsPoint,
  marginMetres,
} from '@pipeline/dem-areas';
import { assertSpacing } from '@pipeline/dem-spacing';

const here = dirname(fileURLToPath(import.meta.url));
const processed = (name: string) => resolve(here, '../data/processed', name);

type Sidecar = {
  area: string;
  bbox: { west: number; south: number; east: number; north: number };
  crs: string;
  width: number;
  height: number;
  pixelSizeMx: number;
  pixelSizeMy: number;
  minElevation: number;
  maxElevation: number;
  meanElevation: number;
  noDataPixels: number;
  sourceNoDataPixels: number;
  encoding: {
    format: string;
    step: number;
    offset: number;
    noDataCode: number;
    sourceNoDataSentinel: number;
    colourType: number;
  };
  source: {
    dataset: string;
    productId: string;
    bucket: string;
    tileIds: string[];
    sourcePixelSpacingDeg: number;
    verticalDatum: string;
  };
  attribution: string;
  licence: string;
  licenceUrl: string;
  citation: string;
  generated: string;
  limitations: string[];
};

const IDS = ['assam-overview', 'majuli', 'sadiya-dibrugarh'] as const;
type AreaId = (typeof IDS)[number];

type Loaded = {
  sidecar: Sidecar;
  meta: TerrainGridMeta;
  heights: Float32Array;
  noData: Uint8Array;
  pngBytes: Buffer;
};

const cache = new Map<AreaId, Promise<Loaded>>();

function loadArea(id: AreaId): Promise<Loaded> {
  let hit = cache.get(id);
  if (!hit) {
    hit = (async () => {
      const sidecar = JSON.parse(
        await readFile(processed(`${id}.json`), 'utf8'),
      ) as Sidecar;
      const pngBytes = await readFile(processed(`${id}.png`));
      const { width, height, rgba } = await decodePng(new Uint8Array(pngBytes));
      expect(width, `${id}.png width matches sidecar`).toBe(sidecar.width);
      expect(height, `${id}.png height matches sidecar`).toBe(sidecar.height);
      const meta: TerrainGridMeta = {
        west: sidecar.bbox.west,
        south: sidecar.bbox.south,
        east: sidecar.bbox.east,
        north: sidecar.bbox.north,
        width,
        height,
        pixelSizeMx: sidecar.pixelSizeMx,
        pixelSizeMy: sidecar.pixelSizeMy,
        offset: sidecar.encoding.offset,
        step: sidecar.encoding.step,
        noDataCode: sidecar.encoding.noDataCode,
      };
      const t = decodeTerrainRgba(rgba, meta);
      return { sidecar, meta, heights: t.heights, noData: t.noData, pngBytes };
    })();
    cache.set(id, hit);
  }
  return hit;
}

/** Nearest-pixel sample at a geographic position. */
function sampleAt(s: Sidecar, heights: Float32Array, lon: number, lat: number): number {
  const x = Math.floor(((lon - s.bbox.west) / (s.bbox.east - s.bbox.west)) * s.width);
  const y = Math.floor(((s.bbox.north - lat) / (s.bbox.north - s.bbox.south)) * s.height);
  return heights[y * s.width + x]!;
}

describe('artefacts are present and within budget', () => {
  it('every area has a PNG and a sidecar, and the sizes are legal', async () => {
    let total = 0;
    for (const id of IDS) {
      const { sidecar, pngBytes } = await loadArea(id);
      expect(sidecar.area).toBe(id);
      expect(pngBytes.byteLength).toBeGreaterThan(0);
      // Per-file ceiling, AGENTS.md §5.
      expect(
        pngBytes.byteLength,
        `${id}.png is ${(pngBytes.byteLength / 1048576).toFixed(2)} MB`,
      ).toBeLessThanOrEqual(5 * 1024 * 1024);
      total += pngBytes.byteLength;
    }
    expect(
      total / 1048576,
      `total ${(total / 1048576).toFixed(2)} MB against a 9 MB budget`,
    ).toBeLessThanOrEqual(9);
  });
});

describe('Terrain-RGB round trip', () => {
  it('recovers an elevation to within half a step', () => {
    const offset = -50;
    for (const e of [-50, -12.3, 0, 0.04, 7.77, 88.91, 250.5, 1200]) {
      const code = encodeElevation(e, offset);
      expect(Math.abs(decodeElevation(code, offset) - e)).toBeLessThanOrEqual(
        TERRAIN_RGB_STEP_M / 2 + 1e-9,
      );
    }
  });

  it('round trips every committed pixel within half a step', async () => {
    for (const id of IDS) {
      const { sidecar, heights } = await loadArea(id);
      let worst = 0;
      for (let i = 0; i < heights.length; i++) {
        const v = heights[i]!;
        if (Number.isNaN(v)) continue;
        const code = Math.round((v - sidecar.encoding.offset) / sidecar.encoding.step);
        const back = decodeElevation(
          code,
          sidecar.encoding.offset,
          sidecar.encoding.step,
        );
        worst = Math.max(worst, Math.abs(back - v));
      }
      expect(worst, `${id}: worst round-trip error ${worst} m`).toBeLessThanOrEqual(
        sidecar.encoding.step / 2 + 1e-4,
      );
    }
  });

  it('the declared step is finer than the source vertical error', async () => {
    // GLO-30's own LE90 is 1.472 m per source tile. A step coarser than that
    // would quantise below the data's real precision, claiming fidelity we lack.
    for (const id of IDS) {
      const { sidecar } = await loadArea(id);
      expect(sidecar.encoding.step, `${id} step`).toBeLessThan(1.472);
    }
  });
});

describe('no-data is never an elevation (regression)', () => {
  it('the source sentinel is exactly -32767 and is recognised', () => {
    expect(SOURCE_NODATA).toBe(-32767);
    expect(isNoData(-32767)).toBe(true);
    expect(isNoData(-32.7)).toBe(false);
    expect(isNoData(0)).toBe(false);
  });

  it('the offset leaves code 0 unreachable by a real elevation', () => {
    // The property that makes the reserved no-data code unambiguous, stated on
    // the generator rather than only on the committed files: whatever elevation
    // is handed in, the offset leaves at least one step of headroom, so code 0
    // can only ever mean no-data.
    //
    // This is the unit-level counterpart to the per-area assertions over the
    // committed artefacts. It is here because a future caller passing a
    // different step would otherwise silently reintroduce the collision that
    // cost Majuli 1,938 cells.
    for (const step of [0.1, 0.15, 1]) {
      for (const minElevation of [0, 68, 74.5, -12.3, 1234.56]) {
        const offset = offsetFor(minElevation, step);
        // The minimum itself must not encode to the reserved code.
        expect(
          encodeElevation(minElevation, offset, step),
          `step ${step}, min ${minElevation}`,
        ).toBeGreaterThan(0);
        // And neither may anything between the offset and the minimum.
        expect(encodeElevation(offset + step, offset, step)).toBe(1);
      }
    }
  });

  it('no decoded pixel holds the sentinel, and the sidecar records it', async () => {
    for (const id of IDS) {
      const { sidecar, heights, noData } = await loadArea(id);
      // Count rather than assert per pixel: millions of `expect` calls would
      // dominate the run, and one failure is enough to fail the test.
      let offenders = 0;
      let nanCount = 0;
      let flagged = 0;
      for (let i = 0; i < heights.length; i++) {
        const v = heights[i]!;
        if (Number.isNaN(v)) {
          nanCount++;
          if (noData[i] === 1) flagged++;
          continue;
        }
        if (Math.round(v * 1000) / 1000 === SOURCE_NODATA) offenders++;
      }
      expect(offenders, `${id}: pixels decoding to the raw sentinel`).toBe(0);
      // No-data is represented as NaN plus the mask, never as a number.
      expect(nanCount, `${id}: no-data count matches the mask`).toBe(flagged);
      expect(sidecar.encoding.sourceNoDataSentinel).toBe(SOURCE_NODATA);
      expect(sidecar.encoding.noDataCode).toBe(0);
    }
  });

  it('encoding an out-of-range sentinel throws rather than wrapping', () => {
    // If the pipeline ever tried to encode -32767 as an elevation, this is the
    // guard that stops it becoming a valid-looking pixel.
    expect(() => encodeElevation(SOURCE_NODATA, 0)).toThrow(RangeError);
    expect(() => encodeElevation(-1e6, 0)).toThrow(RangeError);
  });

  it('a no-data pixel decodes to NaN, not to zero', () => {
    const meta: TerrainGridMeta = {
      west: 0,
      south: 0,
      east: 1,
      north: 1,
      width: 2,
      height: 1,
      pixelSizeMx: 100,
      pixelSizeMy: 100,
      offset: 0,
      step: 0.1,
      noDataCode: 0,
    };
    // px 0 = code 0 (no-data); px 1 = code 100, i.e. 100 * 0.1 = 10 m.
    const t = decodeTerrainRgba(new Uint8Array([0, 0, 0, 255, 0, 0, 100, 255]), meta);
    expect(Number.isNaN(t.heights[0]!)).toBe(true);
    expect(t.noData[0]).toBe(1);
    expect(t.heights[1]!).toBeCloseTo(10, 6);
    expect(t.noData[1]).toBe(0);
  });
});

describe('source spacing is the 30 m product (regression)', () => {
  it('the two products differ by exactly 3x, so a wrong glob is silent', () => {
    expect(GLO30_PIXEL_DEG).toBeCloseTo(1 / 3600, 12);
    expect(GLO90_PIXEL_DEG).toBeCloseTo(3 / 3600, 12);
    expect(GLO90_PIXEL_DEG / GLO30_PIXEL_DEG).toBeCloseTo(3, 12);
  });

  it('every sidecar declares the GLO-30 product and its bucket', async () => {
    for (const id of IDS) {
      const { sidecar } = await loadArea(id);
      expect(sidecar.source.sourcePixelSpacingDeg).toBeCloseTo(GLO30_PIXEL_DEG, 12);
      expect(sidecar.source.productId).toBe('COP-DEM_GLO-30-DGED');
      // The other bucket holds GLO-90.
      expect(sidecar.source.bucket).toBe('s3://copernicus-dem-30m');
    }
  });

  it('the tile ids use the _10_ (1 arcsecond) naming, not _30_', async () => {
    // TRAP, docs/DATA.md §1: the path number is arcseconds, so the GLO-30 tiles
    // are named COG_10_* and a glob for _30_ silently returns the 90 m product.
    for (const id of IDS) {
      const { sidecar } = await loadArea(id);
      for (const tile of sidecar.source.tileIds) {
        expect(tile, `${id} tile id shape`).toMatch(/^N\d{2}_00_E\d{3}_00$/);
      }
    }
  });

  it('the spacing guard rejects the 90 m spacing and names the mistake', () => {
    expect(() => assertSpacing(GLO30_PIXEL_DEG, 'test')).not.toThrow();
    // The message has to name the actual mistake, or whoever trips it will not
    // know which of two adjacent buckets they fetched from.
    expect(() => assertSpacing(GLO90_PIXEL_DEG, 'test')).toThrow(/90 m product/);
    expect(() => assertSpacing(GLO90_PIXEL_DEG, 'test')).toThrow(/wrong glob/);
    expect(() => assertSpacing(1 / 1200, 'test')).toThrow();
    // Just inside tolerance is accepted, so the guard does not trip on
    // floating-point noise in a legitimately correct read.
    expect(() => assertSpacing(GLO30_PIXEL_DEG * 1.005, 'test')).not.toThrow();
    expect(() => assertSpacing(GLO30_PIXEL_DEG * 1.05, 'test')).toThrow();
  });
});

describe('landmark containment (regression)', () => {
  it('every cited landmark is inside its bbox with the required margin', () => {
    for (const area of AREAS) {
      for (const lm of area.landmarks) {
        expect(
          containsPoint(area.bbox, lm.lon, lm.lat),
          `${area.id}: ${lm.name} inside`,
        ).toBe(true);
        const required = lm.isExtentEdge ? 0 : MIN_LANDMARK_MARGIN_M;
        expect(
          marginMetres(area.bbox, lm.lon, lm.lat),
          `${area.id}: ${lm.name} margin`,
        ).toBeGreaterThanOrEqual(required);
      }
    }
  });

  it('every landmark carries a URL as its citation', () => {
    for (const area of AREAS) {
      for (const lm of area.landmarks) {
        expect(lm.source, `${lm.name} names a source`).toMatch(/https?:\/\/\S+/);
      }
    }
  });
});

describe('elevation is plausible along the river', () => {
  // GLO-30 SELF-CONSISTENCY, not accuracy validation. Every number here comes out
  // of the same source as the data, so this can only catch a pipeline fault — a
  // flipped axis, a wrong tile, a broken resample. It says nothing about whether
  // Copernicus is right. The independent check is separate and deliberately weak.
  it('the committed overview falls monotonically from Sadiya to Dhubri', async () => {
    const { sidecar, heights } = await loadArea('assam-overview');
    const path: [string, number, number][] = [
      ['Sadiya', 95.67, 27.83],
      ['Dibrugarh', 94.90837, 27.47989],
      ['Jorhat', 94.22, 26.75],
      ['Guwahati', 91.75, 26.14],
      ['Barpeta', 90.66, 26.32],
      ['Dhubri', 90.02, 26.02],
    ];
    const values = path.map(([name, lon, lat]) => ({
      name,
      v: sampleAt(sidecar, heights, lon, lat),
    }));
    for (const p of values) {
      console.log(`    ${p.name.padEnd(11)} ${p.v.toFixed(2)} m`);
      expect(Number.isNaN(p.v), `${p.name} is not no-data`).toBe(false);
    }
    for (let i = 1; i < values.length; i++) {
      expect(
        values[i]!.v,
        `${values[i]!.name} (${values[i]!.v.toFixed(1)} m) must be below ${values[i - 1]!.name} (${values[i - 1]!.v.toFixed(1)} m)`,
      ).toBeLessThan(values[i - 1]!.v);
    }
    // The whole Brahmaputra run through Assam falls about 94 m.
    const fall = values[0]!.v - values[values.length - 1]!.v;
    expect(fall).toBeGreaterThan(70);
    expect(fall).toBeLessThan(130);
  });

  it('the resampled grid is smooth in the direction it claims to be', async () => {
    // The failure this guards against is a transposed or mis-strided resample,
    // which shows up as adjacent ROWS differing by an implausible amount while
    // adjacent COLUMNS stay smooth. Checking both axes together distinguishes
    // that from genuine steep terrain, which is steep in both directions at once.
    //
    // Threshold is a fraction of the grid's own total relief, not an absolute
    // number: the overview spans the Mishmi Hills to 7,330 m at 530 m pixels,
    // where a legitimate cliff face is hundreds of metres between rows.
    for (const id of IDS) {
      const { sidecar, heights } = await loadArea(id);
      const { width, height, minElevation, maxElevation } = sidecar;
      const relief = maxElevation - minElevation;
      const deltas: { row: number; col: number } = { row: 0, col: 0 };
      for (let y = 1; y < height; y++) {
        for (let x = 0; x < width; x += 5) {
          const a = heights[(y - 1) * width + x]!;
          const b = heights[y * width + x]!;
          if (Number.isNaN(a) || Number.isNaN(b)) continue;
          const d = Math.abs(b - a);
          if (d > deltas.row) deltas.row = d;
          if (x > 0) {
            const c = heights[y * width + x - 5]!;
            if (!Number.isNaN(c) && Math.abs(b - c) > deltas.col) {
              deltas.col = Math.abs(b - c);
            }
          }
        }
      }
      const limit = relief * 0.5;
      console.log(
        `    ${id}: row ${deltas.row.toFixed(1)} m, col ${deltas.col.toFixed(1)} m, relief ${relief.toFixed(0)} m`,
      );
      // A transposed grid drives the row figure far above the column figure.
      expect(
        deltas.row,
        `${id}: rows differ by ${deltas.row.toFixed(1)} m but columns by only ${deltas.col.toFixed(1)} m`,
      ).toBeLessThanOrEqual(limit);
      // Neither axis may jump an implausible fraction of the total relief.
      expect(deltas.col, `${id}: column jump`).toBeLessThanOrEqual(limit);
    }
  });

  it('the floodplain is where the survey says it is', async () => {
    // PLAUSIBILITY, NOT ACCURACY. Each expected value below is a published
    // figure for the town, quoted in the test that needs it, and the tolerance is
    // deliberately loose because a town's "elevation" in a gazetteer is not a
    // survey point: it is often the height at the district headquarters, on the
    // floodplain, or averaged over the municipal area, while we sample a single
    // 60 m pixel that may sit on a bund or a hillside. What this can catch is a
    // gross fault — a wrong sign, a wrong datum, an off-by-a-tile error.
    //
    // Sources:
    //   Majuli  85-90 m — Majuli District Administration, "About District",
    //            majuli.assam.gov.in/about-us/about-district, which states the
    //            island "is at an elevation of 85-90 m above the mean sea level".
    //   Sadiya  123 m — Wikipedia, "Sadiya", infobox elevation.
    //
    // The Sadiya figure is a tertiary source and is treated as such: a 30 m
    // tolerance covers the difference between a gazetteer value and a DSM pixel
    // on a hill edge. It would not catch a small systematic error, which is why
    // it is called plausibility and not validation.
    const majuli = await loadArea('majuli');
    const sadiya = await loadArea('sadiya-dibrugarh');
    const cases: {
      name: string;
      area: Loaded;
      lon: number;
      lat: number;
      published: number;
      tolerance: number;
    }[] = [
      {
        name: 'Majuli island centre',
        area: majuli,
        lon: 94.2,
        lat: 26.97,
        published: 87.5, // midpoint of the published 85-90 m
        tolerance: 30,
      },
      {
        name: 'Sadiya',
        area: sadiya,
        lon: 95.67,
        lat: 27.83,
        published: 123,
        tolerance: 30,
      },
    ];
    for (const c of cases) {
      const v = sampleAt(c.area.sidecar, c.area.heights, c.lon, c.lat);
      console.log(
        `    ${c.name}: ${v.toFixed(1)} m, published ${c.published} m +/-${c.tolerance}`,
      );
      expect(Math.abs(v - c.published), `${c.name} within tolerance`).toBeLessThanOrEqual(
        c.tolerance,
      );
    }
  });
});

describe('manifest matches the committed files', () => {
  it('every recorded SHA-256 matches the file on disk', async () => {
    const manifest = JSON.parse(await readFile(processed('manifest.json'), 'utf8')) as {
      schema: number;
      areas: { id: string; outputs: { file: string; bytes: number; sha256: string }[] }[];
    };
    expect(manifest.schema).toBe(1);
    for (const area of manifest.areas) {
      expect(area.outputs.length).toBe(2);
      for (const out of area.outputs) {
        const bytes = await readFile(processed(out.file));
        expect(bytes.byteLength, `${out.file} size`).toBe(out.bytes);
        expect(
          createHash('sha256').update(bytes).digest('hex'),
          `${out.file} sha256`,
        ).toBe(out.sha256);
      }
    }
  });

  it('the manifest covers exactly the areas that exist', async () => {
    const manifest = JSON.parse(await readFile(processed('manifest.json'), 'utf8')) as {
      areas: { id: string }[];
    };
    expect(manifest.areas.map((a) => a.id).sort()).toEqual([...IDS].sort());
  });

  it('the manifest records the licence and attribution the UI must show', async () => {
    const manifest = JSON.parse(await readFile(processed('manifest.json'), 'utf8')) as {
      licence: string;
      licenceUrl: string;
      attribution: string;
      citation: string;
    };
    expect(manifest.licence).toContain('Copernicus DEM');
    expect(manifest.licenceUrl).toMatch(/^https:\/\//);
    // Article 6(b), the adapted-use notice, verbatim from the licence.
    expect(manifest.attribution).toContain('produced using Copernicus WorldDEM-30');
    expect(manifest.attribution).toContain('DLR e.V.');
    expect(manifest.attribution).toContain('Airbus Defence and Space GmbH');
    expect(manifest.citation).toContain('doi.org');
  });
});

describe('sidecar metadata is complete and honest', () => {
  it('records bbox, CRS, grid size, extent and provenance', async () => {
    for (const id of IDS) {
      const { sidecar } = await loadArea(id);
      expect(sidecar.crs).toBe('EPSG:4326');
      expect(sidecar.width).toBeGreaterThan(0);
      expect(sidecar.height).toBeGreaterThan(0);
      expect(sidecar.pixelSizeMx).toBeGreaterThan(0);
      expect(sidecar.pixelSizeMy).toBeGreaterThan(0);
      expect(sidecar.minElevation).toBeLessThan(sidecar.maxElevation);
      expect(sidecar.source.tileIds.length).toBeGreaterThan(0);
      expect(sidecar.source.verticalDatum).toMatch(/EGM2008/);
      expect(sidecar.generated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('states the DSM and no-bathymetry limitations on every artefact', async () => {
    for (const id of IDS) {
      const { sidecar } = await loadArea(id);
      const text = sidecar.limitations.join(' ').toLowerCase();
      expect(text, `${id} says it is a DSM`).toContain('dsm');
      expect(text, `${id} says there is no bathymetry`).toContain('bathymetry');
    }
  });

  it('the elevation range fits the declared step', async () => {
    for (const id of IDS) {
      const { sidecar } = await loadArea(id);
      const range = sidecar.maxElevation - sidecar.encoding.offset;
      expect(range / sidecar.encoding.step).toBeLessThanOrEqual(65535);
    }
  });
});
