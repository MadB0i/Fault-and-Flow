/**
 * Tests for channel derivation (`src/engine/water/channel.ts`).
 *
 * The inflow and outlet cells are found in the DEM, not hardcoded: a minimax
 * east-west route that minimises the maximum elevation along the way. These
 * tests pin that on a synthetic valley (where the answer is known) and on the
 * real committed overview DEM (where only loose, data-grounded bounds hold).
 */

import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import {
  decodePng,
  decodeTerrainRgba,
  type TerrainGridMeta,
} from '@engine/terrain/decode-terrain.js';
import { gridToLonLat } from '@engine/terrain/metrics.js';
import { burnChannel, buildSimGrid, deriveChannel } from '@engine/water/channel.js';

const here = dirname(fileURLToPath(import.meta.url));
const processed = (name: string): string =>
  resolve(here, '..', 'data', 'processed', name);

function valleyGrid(w: number, h: number): { heights: Float32Array; noData: Uint8Array } {
  // West-falling valley with a meandering low channel down the middle:
  // high in the east, low in the west, banks rising off the channel.
  const heights = new Float32Array(w * h);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const centre = h / 2 + 2 * Math.sin((x / w) * Math.PI * 2);
      const bank = Math.abs(y - centre);
      heights[y * w + x] = x * 1.5 + bank * bank * 0.6;
    }
  }
  return { heights, noData: new Uint8Array(w * h) };
}

describe('deriveChannel on a synthetic valley', () => {
  it('runs east to west along the channel, continuously', () => {
    const w = 24;
    const h = 12;
    const { heights, noData } = valleyGrid(w, h);
    const c = deriveChannel(heights, noData, w, h);

    expect(c.inflow % w).toBe(w - 1);
    expect(c.outlet % w).toBe(0);
    expect(c.path.length).toBeGreaterThanOrEqual(w);
    expect(c.path[0]).toBe(c.inflow);
    expect(c.path[c.path.length - 1]).toBe(c.outlet);

    for (let k = 1; k < c.path.length; k += 1) {
      const a = c.path[k - 1] ?? -1;
      const b = c.path[k] ?? -2;
      const dx = Math.abs((b % w) - (a % w));
      const dy = Math.abs(Math.floor(b / w) - Math.floor(a / w));
      expect(Math.max(dx, dy)).toBeLessThanOrEqual(1);
    }

    const inH = heights[c.inflow] ?? Number.POSITIVE_INFINITY;
    const outH = heights[c.outlet] ?? Number.NEGATIVE_INFINITY;
    expect(outH).toBeLessThanOrEqual(inH);
  });

  it('is deterministic for the same input', () => {
    const { heights, noData } = valleyGrid(24, 12);
    const a = deriveChannel(heights, noData, 24, 12);
    const b = deriveChannel(heights, noData, 24, 12);
    expect([...b.path]).toEqual([...a.path]);
  });

  it('burnChannel cuts a trough only along the route, and only downward', () => {
    const w = 24;
    const h = 12;
    const { heights, noData } = valleyGrid(w, h);
    const sim = { width: w, height: h, dxM: 100, dyM: 100, heights, noData };
    const before = new Float32Array(heights);
    const c = deriveChannel(heights, noData, w, h);
    burnChannel(sim, c, 2);

    const onRoute = new Set(c.path);
    let loweredOnRoute = 0;
    let loweredOffRoute = 0;
    let raised = 0;
    for (let i = 0; i < before.length; i += 1) {
      const delta = (sim.heights[i] ?? 0) - (before[i] ?? 0);
      if (delta > 1e-6) raised += 1;
      if (delta < -1e-6) {
        if (onRoute.has(i)) loweredOnRoute += 1;
        else loweredOffRoute += 1;
      }
    }
    // The trough exists, it never raises ground, and it stays local: the cells
    // it touches are the route plus a rim, not the whole grid.
    expect(loweredOnRoute).toBeGreaterThan(0);
    expect(raised).toBe(0);
    expect(loweredOnRoute + loweredOffRoute).toBeLessThan(before.length / 2);
    // Route cells end up below their original height by a real margin.
    for (const cell of c.path) {
      expect(sim.heights[cell]).toBeLessThan(before[cell] ?? 0);
    }
  });

  it('burnChannel is a no-op for a zero-width request and skips no-data', () => {
    const w = 16;
    const h = 8;
    const { heights, noData } = valleyGrid(w, h);
    const sim = { width: w, height: h, dxM: 100, dyM: 100, heights, noData };
    const c = deriveChannel(heights, noData, w, h);
    const before = new Float32Array(heights);
    burnChannel(sim, c, 0);
    expect([...sim.heights]).toEqual([...before]);

    // Every no-data cell keeps its NaN rather than being filled in.
    noData[5] = 1;
    heights[5] = Number.NaN;
    burnChannel(sim, c, 3);
    expect(Number.isNaN(sim.heights[5] ?? 0)).toBe(true);
  });

  it('throws rather than inventing a route through a full wall', () => {
    const w = 8;
    const h = 8;
    const heights = new Float32Array(w * h).fill(10);
    const noData = new Uint8Array(w * h);
    for (let y = 0; y < h; y += 1) noData[y * w + 4] = 1;
    expect(() => deriveChannel(heights, noData, w, h)).toThrow(/no continuous/);
  });
});

describe('buildSimGrid', () => {
  it('preserves aspect and propagates no-data', () => {
    const { heights, noData } = valleyGrid(48, 24);
    noData[12 * 48 + 20] = 1;
    const sim = buildSimGrid(heights, noData, 48, 24, 4800, 2400, 24);
    expect(sim.width).toBe(24);
    expect(sim.height).toBe(12);
    expect(sim.dxM).toBeCloseTo(200, 6);
    expect(sim.dyM).toBeCloseTo(200, 6);
    expect([...sim.noData].some((v) => v === 1)).toBe(true);
    const finite = [...sim.heights].filter((v) => Number.isFinite(v));
    expect(finite.length).toBeGreaterThan(sim.heights.length / 2);
  });
});

describe('deriveChannel on the real overview DEM', () => {
  it('finds the Brahmaputra: Sadiya side in, Bangladesh side out', async () => {
    const sidecar = JSON.parse(
      await readFile(processed('assam-overview.json'), 'utf8'),
    ) as {
      bbox: { west: number; south: number; east: number; north: number };
      width: number;
      height: number;
      pixelSizeMx: number;
      pixelSizeMy: number;
      encoding: { offset: number; step: number; noDataCode: number };
    };
    const pngBytes = await readFile(processed('assam-overview.png'));
    const { width, height, rgba } = await decodePng(new Uint8Array(pngBytes));
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
    const sim = buildSimGrid(
      t.heights,
      t.noData,
      width,
      height,
      width * sidecar.pixelSizeMx,
      height * sidecar.pixelSizeMy,
      160,
    );
    const c = deriveChannel(sim.heights, sim.noData, sim.width, sim.height);

    // Structural: east edge in, west edge out, continuous, downhill overall.
    expect(c.inflow % sim.width).toBe(sim.width - 1);
    expect(c.outlet % sim.width).toBe(0);
    expect(c.path.length).toBeGreaterThan(sim.width);
    const inH = sim.heights[c.inflow] ?? Number.POSITIVE_INFINITY;
    const outH = sim.heights[c.outlet] ?? Number.NEGATIVE_INFINITY;
    expect(outH).toBeLessThan(inH);

    // Geographic, loose and data-grounded: in near Sadiya (~95.6E), out near
    // the western border lowland. Sadiya reads ~130 m, Dhubri ~27 m
    // (tests/dem-artifacts.test.ts), so these bounds have room on both sides.
    const toLonLat = (cell: number): { lon: number; lat: number } => {
      const x = cell % sim.width;
      const y = Math.floor(cell / sim.width);
      return gridToLonLat(sidecar.bbox, (x + 0.5) / sim.width, (y + 0.5) / sim.height);
    };
    const inflowAt = toLonLat(c.inflow);
    const outletAt = toLonLat(c.outlet);
    expect(inflowAt.lon).toBeGreaterThan(95);
    expect(outletAt.lon).toBeLessThan(91);
    expect(inH).toBeLessThan(250);
    expect(outH).toBeLessThan(120);
  }, 30000);
});
