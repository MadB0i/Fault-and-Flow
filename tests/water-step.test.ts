/**
 * Headless tests for the virtual-pipes step (`src/engine/water/step.ts`).
 *
 * No GPU, no DOM: small synthetic grids stepped in plain Node. These pin the
 * properties the GPU shaders must also hold — conservation, non-negativity,
 * finiteness, and downhill motion — because a flood that gains water from
 * nothing is a defect no screenshot can catch.
 */

import { describe, it, expect } from 'vitest';

import {
  createWaterGrid,
  stableDt,
  totalVolumeM3,
  stepWater,
  type WaterBoundaries,
  type WaterGrid,
} from '@engine/water/step.js';

const CLOSED: WaterBoundaries = {
  west: 'closed',
  east: 'closed',
  north: 'closed',
  south: 'closed',
};

function flatGrid(w: number, h: number, elevation: number, cell = 10): WaterGrid {
  const terrain = new Float32Array(w * h).fill(elevation);
  return createWaterGrid(w, h, cell, cell, terrain, new Uint8Array(w * h));
}

/** Assert volumes match to a relative tolerance, which float32 depth needs. */
function expectRelativeVolume(got: number, want: number, relTol: number): void {
  const drift = Math.abs(got - want) / Math.max(want, 1);
  expect(
    drift,
    `volume drifted ${(drift * 100).toFixed(4)}%: ${got} vs ${want}`,
  ).toBeLessThanOrEqual(relTol);
}

function scan(grid: WaterGrid): { min: number; nan: number } {
  let min = Number.POSITIVE_INFINITY;
  let nan = 0;
  for (let i = 0; i < grid.depth.length; i += 1) {
    const d = grid.depth[i] ?? 0;
    if (!Number.isFinite(d)) nan += 1;
    else if (d < min) min = d;
  }
  for (let i = 0; i < grid.flux.length; i += 1) {
    if (!Number.isFinite(grid.flux[i] ?? 0)) nan += 1;
  }
  return { min, nan };
}

describe('virtual-pipes step', () => {
  it('conserves volume in a closed box', () => {
    const grid = flatGrid(8, 8, 100);
    grid.depth.fill(2);
    const dt = stableDt(grid.dxM, grid.dyM, 5);
    const before = totalVolumeM3(grid);
    for (let s = 0; s < 50; s += 1) stepWater(grid, dt, [], CLOSED);
    const after = totalVolumeM3(grid);
    expect(after).toBeCloseTo(before, 6);
    expect(scan(grid).nan).toBe(0);
  });

  it('never produces negative depth or NaN', () => {
    const grid = flatGrid(10, 10, 50);
    // A spike next to dry cells is the harshest case for the overshoot guard.
    grid.depth[3 * 10 + 3] = 10;
    const dt = stableDt(grid.dxM, grid.dyM, 15);
    for (let s = 0; s < 100; s += 1) stepWater(grid, dt, [], CLOSED);
    const { min, nan } = scan(grid);
    expect(nan).toBe(0);
    expect(min).toBeGreaterThanOrEqual(0);
  });

  it('adds exactly the inflow volume in a closed box', () => {
    const grid = flatGrid(6, 6, 80);
    const dt = 0.1;
    for (let s = 0; s < 10; s += 1) {
      stepWater(grid, dt, [{ cell: 2 * 6 + 2, rateM3s: 100 }], CLOSED);
    }
    expect(totalVolumeM3(grid)).toBeCloseTo(100, 4);
  });

  it('conserves volume with a steep head next to dry ground', () => {
    // The case the flat box misses: a tall wet wall beside dry cells is
    // where the overshoot guard is actually load-bearing. If the guard runs
    // after neighbours have read a pipe, the domain manufactures water here
    // and this is the test that catches it.
    const w = 12;
    const h = 12;
    const terrain = new Float32Array(w * h).fill(50);
    const grid = createWaterGrid(w, h, 20, 20, terrain, new Uint8Array(w * h));
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < 6; x += 1) grid.depth[y * w + x] = 30;
    }
    const dt = stableDt(grid.dxM, grid.dyM, 40);
    const before = totalVolumeM3(grid);
    for (let s = 0; s < 60; s += 1) stepWater(grid, dt, [], CLOSED);
    // Relative tolerance: the state is float32, so per-step rounding
    // accumulates to ~1e-7 of the total. A drift of a few parts in a million
    // is the floor; anything larger is mass being created.
    expectRelativeVolume(totalVolumeM3(grid), before, 1e-5);
    expect(scan(grid).nan).toBe(0);
    expect(scan(grid).min).toBeGreaterThanOrEqual(0);
  });

  it('conserves volume down a uniform staircase of wet and dry cells', () => {
    const w = 16;
    const h = 4;
    const terrain = new Float32Array(w * h);
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) terrain[y * w + x] = 200 - x * 10;
    }
    const grid = createWaterGrid(w, h, 15, 15, terrain, new Uint8Array(w * h));
    for (let y = 0; y < h; y += 1) {
      grid.depth[y * w] = 12;
      if (y % 2 === 0) grid.depth[y * w + 5] = 12;
    }
    const dt = stableDt(grid.dxM, grid.dyM, 20);
    const before = totalVolumeM3(grid);
    for (let s = 0; s < 200; s += 1) stepWater(grid, dt, [], CLOSED);
    expectRelativeVolume(totalVolumeM3(grid), before, 1e-5);
    expect(scan(grid).nan).toBe(0);
  });

  it('moves water downhill on a tilted plane', () => {
    const w = 20;
    const h = 8;
    // High ground in the west, falling eastward: water piled in the west
    // must end up ponded in the east.
    const terrain = new Float32Array(w * h);
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) terrain[y * w + x] = 100 - x;
    }
    const grid = createWaterGrid(w, h, 10, 10, terrain, new Uint8Array(w * h));
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < 10; x += 1) grid.depth[y * w + x] = 3;
    }
    const dt = stableDt(grid.dxM, grid.dyM, 8);
    for (let s = 0; s < 200; s += 1) stepWater(grid, dt, [], CLOSED);
    let west = 0;
    let east = 0;
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const d = grid.depth[y * w + x] ?? 0;
        if (x < w / 2) west += d;
        else east += d;
      }
    }
    // Ponded against the low side: the east holds more than the west it ran from.
    expect(east).toBeGreaterThan(west);
    expect(scan(grid).nan).toBe(0);
  });

  it('drains through an open west boundary', () => {
    const w = 16;
    const h = 6;
    const terrain = new Float32Array(w * h);
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) terrain[y * w + x] = 60 - x;
    }
    const grid = createWaterGrid(w, h, 10, 10, terrain, new Uint8Array(w * h));
    grid.depth.fill(1.5);
    const before = totalVolumeM3(grid);
    const dt = stableDt(grid.dxM, grid.dyM, 5);
    for (let s = 0; s < 300; s += 1) stepWater(grid, dt, []);
    expect(totalVolumeM3(grid)).toBeLessThan(before);
    expect(scan(grid).nan).toBe(0);
    expect(scan(grid).min).toBeGreaterThanOrEqual(0);
  });

  it('treats no-data cells as walls', () => {
    const grid = flatGrid(6, 6, 40);
    for (let y = 0; y < 6; y += 1) grid.noData[y * 6 + 3] = 1;
    for (let y = 0; y < 6; y += 1) {
      for (let x = 0; x < 3; x += 1) grid.depth[y * 6 + x] = 2;
    }
    const dt = stableDt(grid.dxM, grid.dyM, 5);
    for (let s = 0; s < 60; s += 1) stepWater(grid, dt, [], CLOSED);
    for (let y = 0; y < 6; y += 1) {
      for (let x = 4; x < 6; x += 1) {
        expect(grid.depth[y * 6 + x]).toBe(0);
      }
    }
  });

  it('sizes dt smaller for deeper water', () => {
    const shallow = stableDt(60, 60, 1);
    const deep = stableDt(60, 60, 30);
    expect(shallow).toBeGreaterThan(0);
    expect(deep).toBeGreaterThan(0);
    expect(deep).toBeLessThan(shallow);
    expect(Number.isFinite(shallow) && Number.isFinite(deep)).toBe(true);
  });
});
