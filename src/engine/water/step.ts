/**
 * Virtual-pipes shallow-water step, headless CPU mirror of the GPU shaders.
 *
 * This module is the physics of FLOW phase 1 in plain TypeScript over typed
 * arrays: no DOM, no Three.js, no React. The GPU layer in `water-layer.ts`
 * implements the same equations in GLSL; this copy exists so the behaviour
 * is unit-testable in milliseconds (`tests/water-step.test.ts`), which is
 * the whole point of the engine rule in AGENTS.md section 3.
 *
 * ## The equations (identical in the shaders)
 *
 * Per cell, with terrain height h, water depth d, surface w = h + d, and one
 * outflow flux fX per compass pipe (m3/s, always >= 0):
 *
 *   1. Flux update:  fX += dt * A * g * (w - wN) / l,  then fX = max(0, fX)
 *      A is the cell area, g gravity, l the pipe length (dx or dy).
 *   2. Overshoot guard: if dt * sum(fOut) > d * A, scale all outflows by
 *      K = d * A / (dt * sum(fOut)), so a cell can never lose more than it holds.
 *   3. Depth update:  d += dt * (sum(fIn) - sum(fOut)) / A + source, then d = max(0, d).
 *
 * This is the "virtual pipes" scheme (Mei, Decaudin & Hu 2007, simplified):
 * diffusive, unconditionally stable for the guarded update, and honest about
 * what it is not — there is no momentum here, no inertia, no supercritical
 * flow. It spreads water downhill and ponds it in lows, which is the
 * mechanism FLOW phase 1 exists to show.
 *
 * ## Units
 *
 * Metres, seconds, m3/s throughout. The discharge slider's value is a
 * user-chosen *scenario* (PRODUCT.md section 4.3); the "illustrative" label
 * lives in the UI, the number here is just physics input.
 */

export const GRAVITY_M_S2 = 9.81;

/** Safety factor on the shallow-water CFL condition. Below 1 by construction. */
export const CFL_NUMBER = 0.25;

/** Reference depth used to size the fixed timestep before any water exists. */
export const REFERENCE_MAX_DEPTH_M = 30;

/** Pipe order in the per-cell flux quad. [west, east, north, south]. */
export const FLUX_W = 0;
export const FLUX_E = 1;
export const FLUX_N = 2;
export const FLUX_S = 3;

export type BoundaryKind = 'closed' | 'open';

export interface WaterBoundaries {
  readonly west: BoundaryKind;
  readonly east: BoundaryKind;
  readonly north: BoundaryKind;
  readonly south: BoundaryKind;
}

/** The domain's outer edges: west (downstream) open, everything else a wall. */
export const ASSAM_BOUNDARIES: WaterBoundaries = {
  west: 'open',
  east: 'closed',
  north: 'closed',
  south: 'closed',
};

export interface WaterGrid {
  readonly width: number;
  readonly height: number;
  /** Cell size east-west in metres. Must be finite and positive. */
  readonly dxM: number;
  /** Cell size north-south in metres. Must be finite and positive. */
  readonly dyM: number;
  /** Static terrain, metres. NaN (or mask 1) means solid: never wet, never flows. */
  readonly terrain: Float32Array;
  /** No-data mask: 1 where terrain is missing. Mirrors the decoder's mask. */
  readonly noData: Uint8Array;
  /** Water depth in metres, mutated by stepWater. Starts dry (all 0). */
  readonly depth: Float32Array;
  /** Four outflow fluxes per cell in FLUX_* order, m3/s, mutated by stepWater. */
  readonly flux: Float32Array;
}

export interface InflowSource {
  /** Flat cell index receiving the discharge. */
  readonly cell: number;
  /** User-chosen scenario rate in m3/s. Never presented as observed. */
  readonly rateM3s: number;
}

export function createWaterGrid(
  width: number,
  height: number,
  dxM: number,
  dyM: number,
  terrain: Float32Array,
  noData: Uint8Array,
): WaterGrid {
  if (!Number.isInteger(width) || width < 3)
    throw new Error('water grid needs width >= 3');
  if (!Number.isInteger(height) || height < 3)
    throw new Error('water grid needs height >= 3');
  if (!(dxM > 0) || !(dyM > 0) || !Number.isFinite(dxM) || !Number.isFinite(dyM)) {
    throw new Error('water grid needs finite positive cell sizes');
  }
  if (terrain.length !== width * height || noData.length !== width * height) {
    throw new Error('terrain/noData must match width * height');
  }
  return {
    width,
    height,
    dxM,
    dyM,
    terrain,
    noData,
    depth: new Float32Array(width * height),
    flux: new Float32Array(width * height * 4),
  };
}

/**
 * Largest stable fixed timestep for a cell size and expected max depth.
 * Shallow-water wave speed is sqrt(g * d); the step must stay a CFL fraction
 * of the time a wave needs to cross one cell.
 */
export function stableDt(dxM: number, dyM: number, maxDepthM: number): number {
  const depth = maxDepthM > 0.01 ? maxDepthM : 0.01;
  return (CFL_NUMBER * Math.min(dxM, dyM)) / Math.sqrt(GRAVITY_M_S2 * depth);
}

/** Total water volume in m3. Closed domains conserve this up to float error. */
export function totalVolumeM3(grid: WaterGrid): number {
  let sum = 0;
  const cellArea = grid.dxM * grid.dyM;
  for (let i = 0; i < grid.depth.length; i += 1) {
    const d = grid.depth[i] ?? 0;
    if (d > 0) sum += d * cellArea;
  }
  return sum;
}

/**
 * Advance the sim by dt seconds. Mutates depth and flux in place.
 *
 * Ghost rule at the domain edge: an 'open' neighbour is terrain at the
 * cell's own height carrying no water, so water pours out downhill and never
 * comes back. A 'closed' neighbour (or a no-data cell, anywhere) is a wall:
 * its pipes stay exactly 0.
 */
export function stepWater(
  grid: WaterGrid,
  dtS: number,
  sources: readonly InflowSource[],
  boundaries: WaterBoundaries = ASSAM_BOUNDARIES,
): void {
  if (!(dtS > 0) || !Number.isFinite(dtS))
    throw new Error('stepWater needs finite dt > 0');
  const { width, height, dxM, dyM, terrain, noData, depth, flux } = grid;
  const cellArea = dxM * dyM;
  // Double-buffered passes, exactly like the GPU ping-pong: the flux pass
  // reads frozen depths and writes a scratch field, and the depth pass reads
  // the scratch. Updating fluxes in place would let a cell export its new
  // flux while a neighbour already imported the old one, which silently
  // creates or destroys water every step.
  const nextFlux = new Float32Array(flux.length);
  const nextDepth = new Float32Array(depth.length);

  // Neighbour offsets in FLUX_* order: W(-x), E(+x), N(-row), S(+row).
  // Row 0 is the north edge, matching the terrain convention.
  const offX = [-1, 1, 0, 0];
  const offY = [0, 0, -1, 1];
  const pipeLen = [dxM, dxM, dyM, dyM];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = y * width + x;
      if (noData[i] === 1) {
        nextDepth[i] = 0;
        continue;
      }
      const h = terrain[i] ?? Number.NaN;
      const d = depth[i] ?? 0;
      if (!(d >= 0)) {
        // Defensive: a NaN must never propagate into the flux field, where it
        // would poison neighbours. Clamp and move on; the depth test pins this.
        nextDepth[i] = 0;
        nextFlux[i * 4] = 0;
        nextFlux[i * 4 + 1] = 0;
        nextFlux[i * 4 + 2] = 0;
        nextFlux[i * 4 + 3] = 0;
        continue;
      }
      const w = h + d;

      // Pass 1: update this cell's outflow pipes into the scratch field.
      for (let p = 0; p < 4; p += 1) {
        const nx = x + (offX[p] ?? 0);
        const ny = y + (offY[p] ?? 0);
        const outside = nx < 0 || ny < 0 || nx >= width || ny >= height;
        let wN = w;
        let wall = false;
        if (outside) {
          const edge: BoundaryKind =
            p === FLUX_W
              ? boundaries.west
              : p === FLUX_E
                ? boundaries.east
                : p === FLUX_N
                  ? boundaries.north
                  : boundaries.south;
          if (edge === 'closed') wall = true;
          else wN = h; // open ghost: own terrain, no water
        } else {
          const ni = ny * width + nx;
          if (noData[ni] === 1) wall = true;
          else wN = (terrain[ni] ?? Number.NaN) + (depth[ni] ?? 0);
        }
        const fi = i * 4 + p;
        if (wall) {
          nextFlux[fi] = 0;
          continue;
        }
        const l = pipeLen[p] ?? dxM;
        const f = Math.max(
          0,
          (flux[fi] ?? 0) + (dtS * cellArea * GRAVITY_M_S2 * (w - wN)) / l,
        );
        nextFlux[fi] = Number.isFinite(f) ? f : 0;
      }
    }
  }

  // Pass 2: move volume through the scratch fluxes. Every pipe is read from
  // the same field it was written to, so each export has exactly one import.
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = y * width + x;
      if (noData[i] === 1) {
        nextDepth[i] = 0;
        continue;
      }
      const d = depth[i] ?? 0;
      if (!(d >= 0)) {
        nextDepth[i] = 0;
        continue;
      }
      let outSum =
        (nextFlux[i * 4] ?? 0) +
        (nextFlux[i * 4 + 1] ?? 0) +
        (nextFlux[i * 4 + 2] ?? 0) +
        (nextFlux[i * 4 + 3] ?? 0);

      // Overshoot guard: never export more volume than the cell holds.
      if (outSum > 0 && d > 0) {
        const available = (d * cellArea) / dtS;
        if (outSum > available) {
          const k = available / outSum;
          for (let p = 0; p < 4; p += 1)
            nextFlux[i * 4 + p] = (nextFlux[i * 4 + p] ?? 0) * k;
          outSum = available;
        }
      } else if (d <= 0) {
        for (let p = 0; p < 4; p += 1) nextFlux[i * 4 + p] = 0;
        outSum = 0;
      }

      // Net inflow: neighbours' outflow pipes pointing at this cell.
      // The W pipe of the eastern neighbour flows west into us, and so on.
      let inSum = 0;
      inSum += inflowFrom(grid, nextFlux, x, y, 1, 0, FLUX_W);
      inSum += inflowFrom(grid, nextFlux, x, y, -1, 0, FLUX_E);
      inSum += inflowFrom(grid, nextFlux, x, y, 0, 1, FLUX_N);
      inSum += inflowFrom(grid, nextFlux, x, y, 0, -1, FLUX_S);

      const nd = d + (dtS * (inSum - outSum)) / cellArea;
      nextDepth[i] = nd;
    }
  }

  flux.set(nextFlux);

  for (const s of sources) {
    if (s.cell < 0 || s.cell >= nextDepth.length) continue;
    if (noData[s.cell] === 1 || s.rateM3s <= 0) continue;
    nextDepth[s.cell] = (nextDepth[s.cell] ?? 0) + (s.rateM3s * dtS) / cellArea;
  }

  for (let i = 0; i < nextDepth.length; i += 1) {
    const v = nextDepth[i] ?? 0;
    depth[i] = v > 0 && Number.isFinite(v) ? v : 0;
  }
}

/** Outflow of a neighbour's pipe aimed at cell (x, y); 0 at walls and edges. */
function inflowFrom(
  grid: WaterGrid,
  flux: Float32Array,
  x: number,
  y: number,
  dx: number,
  dy: number,
  pipe: number,
): number {
  const nx = x + dx;
  const ny = y + dy;
  if (nx < 0 || ny < 0 || nx >= grid.width || ny >= grid.height) return 0;
  const ni = ny * grid.width + nx;
  if (grid.noData[ni] === 1) return 0;
  return flux[ni * 4 + pipe] ?? 0;
}
