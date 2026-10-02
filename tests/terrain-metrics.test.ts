/**
 * The numbers the HUD shows, asserted rather than eyeballed.
 *
 * Nobody can watch the render, so these pure functions are where the geometry a
 * reader would otherwise have to trust has to be checkable. Everything here is
 * checked against the committed sidecars, so a pipeline change that moves the
 * ground under the legend fails a test instead of quietly moving the labels.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import {
  AREA_IDS,
  MAX_CONTOUR_BANDS,
  NICE_CONTOUR_INTERVALS,
  clampExaggeration,
  contourIntervalFor,
  containsLonLat,
  extentMeters,
  gridToLonLat,
  gridToWorld,
  legendTicks,
  legendTicksFor,
  lonLatToGrid,
  parseSidecar,
  pickContourInterval,
  pickTickStep,
  reliefMeters,
  MAX_EXAGGERATION,
  MIN_EXAGGERATION,
  areaDefinitionOrFirst,
  areaDefinition,
  isAreaId,
} from '@engine/terrain/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

const sidecar = (area: string) =>
  parseSidecar(
    JSON.parse(readFileSync(resolve(root, `data/processed/${area}.json`), 'utf8')),
  );

describe('metric scaling from the sidecars', () => {
  it('multiplies each axis by its own pixel size, never one scalar', () => {
    const m = sidecar('majuli');
    const e = extentMeters(m);

    // GLO-30 pixels are not square (docs/DATA.md section 1), so east-west and
    // north-south must come out slightly different. Multiplying by a single
    // pixel size would make them identical and quietly stretch the grid.
    expect(e.widthM).toBeCloseTo(m.width * m.pixelSizeMx, 3);
    expect(e.heightM).toBeCloseTo(m.height * m.pixelSizeMy, 3);
    expect(e.widthM).not.toBeCloseTo(e.heightM, -1);
    expect(e.diagonalM).toBeCloseTo(Math.hypot(e.widthM, e.heightM), 6);
  });

  it('keeps the aspect ratio the sidecar implies', () => {
    for (const area of AREA_IDS) {
      const m = sidecar(area);
      const e = extentMeters(m);
      const implied = m.width / m.height;
      const actual = e.widthM / e.heightM;
      // Only the pixel-size difference can move these, and it is small.
      expect(Math.abs(actual / implied - 1), `${area} aspect skew`).toBeLessThan(0.01);
    }
  });

  it('reports relief, and never a negative range', () => {
    expect(reliefMeters(sidecar('majuli'))).toBeCloseTo(2089.16 - 68, 2);
    expect(reliefMeters({ minElevation: 100, maxElevation: 100 })).toBe(0);
    expect(reliefMeters({ minElevation: 200, maxElevation: 100 })).toBe(0);
  });

  it('places the grid origin at the centre, x east and z south', () => {
    const m = sidecar('majuli');
    const e = extentMeters(m);
    expect(gridToWorld(m, 0.5, 0.5)).toEqual({ x: 0, z: 0 });
    expect(gridToWorld(m, 0, 0).x).toBeCloseTo(-e.widthM / 2, 3);
    // v = 0 is the north edge, and north is -z.
    expect(gridToWorld(m, 0.5, 0).z).toBeCloseTo(-e.heightM / 2, 3);
    expect(gridToWorld(m, 0.5, 1).z).toBeCloseTo(e.heightM / 2, 3);
  });
});

describe('geographic conversion', () => {
  const m = sidecar('majuli');

  it('round-trips lon/lat through grid coordinates', () => {
    // Typed as tuples so noUncheckedIndexedAccess does not widen each element
    // to `number | undefined` and hide a real arity mistake.
    const cases: ReadonlyArray<readonly [number, number]> = [
      [94.1, 27.0],
      [93.6, 26.8],
      [94.65, 27.25],
    ];
    for (const [lon, lat] of cases) {
      const g = lonLatToGrid(m.bbox, lon, lat);
      const back = gridToLonLat(m.bbox, g.u, g.v);
      expect(back.lon).toBeCloseTo(lon, 9);
      expect(back.lat).toBeCloseTo(lat, 9);
    }
  });

  it('puts v = 0 at the north edge, not the south', () => {
    expect(lonLatToGrid(m.bbox, 94.1, m.bbox.north).v).toBe(0);
    expect(lonLatToGrid(m.bbox, 94.1, m.bbox.south).v).toBe(1);
    expect(lonLatToGrid(m.bbox, m.bbox.west, 27.0).u).toBe(0);
    expect(lonLatToGrid(m.bbox, m.bbox.east, 27.0).u).toBe(1);
  });

  it('tests containment inclusively at the edges', () => {
    expect(containsLonLat(m.bbox, 94.1, 27.0)).toBe(true);
    expect(containsLonLat(m.bbox, m.bbox.west, m.bbox.south)).toBe(true);
    expect(containsLonLat(m.bbox, m.bbox.east, m.bbox.north)).toBe(true);
    expect(containsLonLat(m.bbox, m.bbox.west - 0.001, 27.0)).toBe(false);
    expect(containsLonLat(m.bbox, 94.1, m.bbox.north + 0.001)).toBe(false);
  });
});

describe('contour interval picker', () => {
  it('only ever chooses from the documented set', () => {
    for (const relief of [1, 7, 120, 900, 7331, 40000]) {
      for (const pixel of [10, 60, 530]) {
        expect(NICE_CONTOUR_INTERVALS).toContain(pickContourInterval(relief, pixel));
      }
    }
  });

  it('keeps the band count at or under the limit', () => {
    for (const relief of [50, 300, 2021, 1742, 7331]) {
      const interval = pickContourInterval(relief, 10);
      expect(relief / interval, `relief ${relief} -> ${interval}`).toBeLessThanOrEqual(
        MAX_CONTOUR_BANDS,
      );
    }
  });

  it('never picks an interval the grid can resolve, unless the set runs out', () => {
    // Two pixels of separation is the aliasing floor. A 60 m pixel cannot
    // honestly carry a 25 m contour.
    expect(pickContourInterval(5000, 60)).toBeGreaterThanOrEqual(120);
    // At 530 m per pixel even 1000 m sits inside the floor. The documented set
    // is NOT extended to cope: the answer is the largest documented interval,
    // and a coarser contour on that area is the correct trade.
    const capped = pickContourInterval(5000, 530);
    expect(capped).toBe(1000);
    expect(NICE_CONTOUR_INTERVALS).toContain(capped);
  });

  it('caps at the largest documented interval rather than inventing one', () => {
    // The overview's relief is large enough that even 1000 m bands sit closer
    // than two of its 530 m pixels. The documented set is not extended to cope.
    const interval = pickContourInterval(7331, 530.257);
    expect(interval).toBe(1000);
    expect(NICE_CONTOUR_INTERVALS).toContain(interval);
  });

  it('gives the three committed areas the intervals they will actually show', () => {
    expect(contourIntervalFor(sidecar('assam-overview'))).toBe(1000);
    expect(contourIntervalFor(sidecar('majuli'))).toBe(250);
    expect(contourIntervalFor(sidecar('sadiya-dibrugarh'))).toBe(250);
  });

  it('does not rescale with the camera', () => {
    // Derived from the sidecar only, so the legend cannot disagree with itself
    // as the user orbits.
    const a = contourIntervalFor(sidecar('majuli'));
    const b = contourIntervalFor(sidecar('majuli'));
    expect(a).toBe(b);
  });

  it('degrades to the smallest interval on nonsense input', () => {
    expect(pickContourInterval(0, 60)).toBe(NICE_CONTOUR_INTERVALS[0]);
    expect(pickContourInterval(-5, 60)).toBe(NICE_CONTOUR_INTERVALS[0]);
    expect(pickContourInterval(100, 0)).toBe(NICE_CONTOUR_INTERVALS[0]);
  });
});

describe('legend tick generator', () => {
  it('picks a nice step that keeps the band count near the target', () => {
    expect(pickTickStep(0, 7330.79, 5)).toBe(2000);
    expect(pickTickStep(68, 2089.16, 5)).toBe(500);
    expect(pickTickStep(74.5, 1816.96, 5)).toBe(500);
  });

  it('returns ascending multiples of the step inside the range', () => {
    const ticks = legendTicks(0, 1000, 250);
    expect(ticks).toEqual([0, 250, 500, 750, 1000]);
    for (let i = 1; i < ticks.length; i++) {
      expect(ticks[i]!).toBeGreaterThan(ticks[i - 1]!);
    }
  });

  it('includes both endpoints so the ramp ends are labelled', () => {
    const ticks = legendTicks(68, 2089.16, 500);
    expect(ticks[0]).toBe(68);
    expect(ticks[ticks.length - 1]).toBe(2089.16);
  });

  it('has no floating-point dust, because it renders in a mono face', () => {
    const ticks = legendTicks(0, 2500, 500);
    for (const t of ticks) {
      expect(String(t), `${t} is not a clean number`).toMatch(/^-?\d+(\.\d+)?$/);
      expect(Math.abs(t - Math.round(t * 1000) / 1000)).toBeLessThan(1e-9);
    }
  });

  it('produces a readable number of bands for each committed area', () => {
    for (const area of AREA_IDS) {
      const m = sidecar(area);
      const ticks = legendTicksFor(m);
      expect(
        ticks.length,
        `${area} produced ${ticks.length} ticks`,
      ).toBeGreaterThanOrEqual(3);
      expect(ticks.length, `${area} produced ${ticks.length} ticks`).toBeLessThanOrEqual(
        9,
      );
      expect(ticks[0]).toBe(m.minElevation);
      expect(ticks[ticks.length - 1]).toBe(m.maxElevation);
    }
  });

  it('handles a degenerate range without dividing by zero', () => {
    expect(legendTicks(100, 100, 10)).toEqual([100, 100]);
    expect(legendTicks(0, 100, 0)).toEqual([0, 100]);
  });
});

describe('area registry', () => {
  it('matches manifest.json exactly, in both directions', () => {
    const manifest = JSON.parse(
      readFileSync(resolve(root, 'data/processed/manifest.json'), 'utf8'),
    ) as { areas: Array<{ id: string }> };
    const manifestIds = manifest.areas.map((a) => a.id).sort();
    expect([...AREA_IDS].sort()).toEqual(manifestIds);
    expect(manifestIds).toHaveLength(3);
  });

  it('has a sidecar on disk for every registered area', () => {
    for (const id of AREA_IDS) {
      const raw = readFileSync(resolve(root, `data/processed/${id}.json`), 'utf8');
      expect(parseSidecar(JSON.parse(raw)).area).toBe(id);
      expect(() => readFileSync(resolve(root, `data/processed/${id}.png`))).not.toThrow();
    }
  });

  it('keeps every default exaggeration inside the slider range', () => {
    for (const id of AREA_IDS) {
      const def = areaDefinition(id)!;
      expect(def.defaultVerticalExaggeration).toBeGreaterThanOrEqual(MIN_EXAGGERATION);
      expect(def.defaultVerticalExaggeration).toBeLessThanOrEqual(MAX_EXAGGERATION);
    }
  });

  it('picks defaults that make the relief roughly a tenth of the extent', () => {
    // The documented rule in area-registry.ts. If a future area breaks it, the
    // reason to change the number should show up here first.
    for (const id of AREA_IDS) {
      const m = sidecar(id);
      const def = areaDefinition(id)!;
      const ratio =
        (reliefMeters(m) * def.defaultVerticalExaggeration) / extentMeters(m).widthM;
      expect(ratio, `${id} relief-to-extent ratio`).toBeGreaterThan(0.05);
      expect(ratio, `${id} relief-to-extent ratio`).toBeLessThan(0.2);
    }
  });

  it('keeps zoom limits ordered and inside the polar clamp', () => {
    for (const id of AREA_IDS) {
      const def = areaDefinition(id)!;
      expect(def.minZoomFactor).toBeGreaterThan(0);
      expect(def.maxZoomFactor).toBeGreaterThan(def.minZoomFactor);
      expect(def.defaultPolarDeg).toBeGreaterThan(6);
      expect(def.defaultPolarDeg).toBeLessThan(88);
    }
  });

  it('degrades an unknown id to the first area rather than throwing', () => {
    expect(areaDefinitionOrFirst(null).id).toBe(AREA_IDS[0]);
    expect(isAreaId('majuli')).toBe(true);
    expect(isAreaId('nope')).toBe(false);
    expect(() => areaDefinition('nope' as never)).not.toThrow();
  });

  it('clamps exaggeration into the slider range, including junk input', () => {
    expect(clampExaggeration(10)).toBe(10);
    expect(clampExaggeration(0)).toBe(MIN_EXAGGERATION);
    expect(clampExaggeration(-4)).toBe(MIN_EXAGGERATION);
    expect(clampExaggeration(999)).toBe(MAX_EXAGGERATION);
    expect(clampExaggeration(Number.NaN)).toBe(MIN_EXAGGERATION);
    expect(clampExaggeration(Number.POSITIVE_INFINITY)).toBe(MAX_EXAGGERATION);
  });
});

describe('sidecar validation', () => {
  it('rejects a sidecar missing a field rather than defaulting it', () => {
    const raw = JSON.parse(
      readFileSync(resolve(root, 'data/processed/majuli.json'), 'utf8'),
    );
    for (const field of [
      'bbox',
      'encoding',
      'attribution',
      'pixelSizeMx',
      'limitations',
    ]) {
      const broken = { ...raw } as Record<string, unknown>;
      delete broken[field];
      expect(() => parseSidecar(broken), `missing ${field} was accepted`).toThrow(
        /terrain sidecar/,
      );
    }
  });

  it('rejects an inverted range and a degenerate bbox', () => {
    const raw = JSON.parse(
      readFileSync(resolve(root, 'data/processed/majuli.json'), 'utf8'),
    );
    expect(() => parseSidecar({ ...raw, minElevation: 9e9 })).toThrow(/maxElevation/);
    expect(() => parseSidecar({ ...raw, bbox: { ...raw.bbox, east: 0 } })).toThrow(
      /bbox/,
    );
  });

  it('keeps the attribution exactly as written, for the credit line', () => {
    // DATA.md section 10 rule 1: paraphrase voids a mandatory attribution.
    const m = sidecar('majuli');
    expect(m.attribution).toBe(
      'produced using Copernicus WorldDEM-30 © DLR e.V. 2010-2014 and © Airbus ' +
        'Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European ' +
        'Union and ESA; all rights reserved',
    );
  });

  it('carries the no-bathymetry limitation on every area', () => {
    for (const id of AREA_IDS) {
      const m = sidecar(id);
      const text = m.limitations.join(' ').toLowerCase();
      expect(text, `${id} does not disclaim bathymetry`).toContain('bathymetry');
      expect(text, `${id} does not disclose that it is a surface model`).toContain('dsm');
    }
  });
});
