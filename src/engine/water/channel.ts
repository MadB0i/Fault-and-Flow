/**
 * Where the river is, found in the DEM itself — never hardcoded.
 *
 * FLOW phase 1 simulates the whole Brahmaputra across the loaded area: water
 * enters at the upstream (eastern) edge and leaves through an open boundary
 * at the downstream (western) edge. The exact cells come from the data:
 *
 * - `buildSimGrid` downsamples the decoded DEM to the simulation grid with
 *   the same bilinear sampler the renderer is checked against
 *   (`../terrain/sampling.ts`), so the sim and the readout agree on heights.
 * - `deriveChannel` finds the main channel as the lowest continuous route
 *   from the east edge to the west edge: a minimax path that minimises the
 *   maximum elevation along the way. On a flat floodplain with a carved
 *   channel ribbon this tracks the channel; over hills it finds the valley.
 *   Depressions and flats need no special-casing, unlike D8 accumulation.
 *
 * Pure module: no DOM, no Three.js. The GPU layer consumes the same sim
 * grid, so what you see is what the tests below assert on.
 */

import { sampleBilinear } from '../terrain/sampling.js';

export interface SimGrid {
  readonly width: number;
  readonly height: number;
  /** Cell size east-west in metres (extent / width, cell-centred). */
  readonly dxM: number;
  /** Cell size north-south in metres (extent / height, cell-centred). */
  readonly dyM: number;
  readonly heights: Float32Array;
  readonly noData: Uint8Array;
}

export interface ChannelCells {
  /** Flat index of the upstream (east edge) inflow cell. */
  readonly inflow: number;
  /** Flat index of the downstream (west edge) outlet cell. */
  readonly outlet: number;
  /** Downstream-ordered cell indices from inflow to outlet, inclusive. */
  readonly path: readonly number[];
}

/**
 * Downsample a decoded DEM to simulation resolution, preserving aspect.
 * A sim sample that touches any source no-data cell is marked no-data
 * rather than blended across the gap (same rule as the pointer sampler).
 */
export function buildSimGrid(
  heights: ArrayLike<number>,
  noData: ArrayLike<number>,
  srcWidth: number,
  srcHeight: number,
  extentWM: number,
  extentHM: number,
  targetWidth: number,
): SimGrid {
  if (!Number.isInteger(targetWidth) || targetWidth < 8) {
    throw new Error('sim grid needs targetWidth >= 8');
  }
  const width = targetWidth;
  const height = Math.max(8, Math.round((targetWidth * srcHeight) / srcWidth));
  const out = new Float32Array(width * height);
  const mask = new Uint8Array(width * height);
  const meta = { width: srcWidth, height: srcHeight };
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const s = sampleBilinear(
        heights,
        noData,
        meta,
        (x + 0.5) / width,
        (y + 0.5) / height,
      );
      const i = y * width + x;
      if (s.noData) {
        out[i] = Number.NaN;
        mask[i] = 1;
      } else {
        out[i] = s.elevationM;
      }
    }
  }
  return {
    width,
    height,
    dxM: extentWM / width,
    dyM: extentHM / height,
    heights: out,
    noData: mask,
  };
}

export function gridIndex(x: number, y: number, width: number): number {
  return y * width + x;
}

/**
 * Main channel, found in the DEM itself — never hardcoded.
 *
 * Water enters where the river enters: the lowest cell of the east (upstream)
 * edge, and leaves at the lowest cell of the west (downstream) edge. Between
 * them runs the lowest continuous route: a minimax path that minimises the
 * maximum elevation along the way, with the summed elevation as the tiebreak
 * so the route keeps descending instead of wandering once the maximum
 * plateaus. Depressions and flats need no special-casing, unlike D8
 * accumulation — and unlike a free-endpoint search, the anchored ends cannot
 * drift into the hills when a mid-route saddle sets the maximum.
 *
 * Pure module: no DOM, no Three.js. Deterministic for a given input. Throws
 * when no route exists rather than inventing one — a missing channel is a
 * data fact the UI must report, not paper over.
 */
export function deriveChannel(
  heights: ArrayLike<number>,
  noData: ArrayLike<number>,
  width: number,
  height: number,
): ChannelCells {
  const east = width - 1;
  const inflow = lowestInColumn(heights, noData, width, height, east);
  const outletTarget = lowestInColumn(heights, noData, width, height, 0);
  if (inflow < 0 || outletTarget < 0) {
    throw new Error('deriveChannel: no usable edge cell in this grid');
  }

  const n = width * height;
  const maxCost = new Float64Array(n).fill(Number.POSITIVE_INFINITY);
  const sumCost = new Float64Array(n).fill(Number.POSITIVE_INFINITY);
  const parent = new Int32Array(n).fill(-1);
  const settled = new Uint8Array(n);
  const heap: number[] = [];

  const less = (a: number, b: number): boolean => {
    const ma = maxCost[a] ?? Number.POSITIVE_INFINITY;
    const mb = maxCost[b] ?? Number.POSITIVE_INFINITY;
    if (ma !== mb) return ma < mb;
    const sa = sumCost[a] ?? Number.POSITIVE_INFINITY;
    const sb = sumCost[b] ?? Number.POSITIVE_INFINITY;
    if (sa !== sb) return sa < sb;
    return a < b;
  };
  const push = (i: number): void => {
    heap.push(i);
    let c = heap.length - 1;
    while (c > 0) {
      const p = (c - 1) >> 1;
      const cv = heap[c];
      const pv = heap[p];
      if (cv === undefined || pv === undefined || !less(cv, pv)) break;
      heap[c] = pv;
      heap[p] = cv;
      c = p;
    }
  };
  const pop = (): number | undefined => {
    const top = heap[0];
    const last = heap.pop();
    if (heap.length > 0 && last !== undefined) {
      heap[0] = last;
      let p = 0;
      for (;;) {
        const l = p * 2 + 1;
        const r = l + 1;
        let m = p;
        const mv = heap[m];
        const lv = heap[l];
        const rv = heap[r];
        if (lv !== undefined && mv !== undefined && less(lv, mv)) m = l;
        const mv2 = heap[m];
        if (rv !== undefined && mv2 !== undefined && less(rv, mv2)) m = r;
        if (m === p) break;
        const a = heap[p];
        const b = heap[m];
        if (a === undefined || b === undefined) break;
        heap[p] = b;
        heap[m] = a;
        p = m;
      }
    }
    return top;
  };

  const startH = heights[inflow];
  if (startH === undefined || Number.isNaN(startH)) {
    throw new Error('deriveChannel: inflow cell has no elevation');
  }
  maxCost[inflow] = startH;
  sumCost[inflow] = startH;
  push(inflow);

  let outlet = -1;
  while (heap.length > 0) {
    const i = pop();
    if (i === undefined || settled[i] === 1) continue;
    settled[i] = 1;
    if (i === outletTarget) {
      outlet = i;
      break;
    }
    const x = i % width;
    const y = Math.floor(i / width);
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const ni = gridIndex(nx, ny, width);
        if (settled[ni] === 1 || noData[ni] === 1) continue;
        const h = heights[ni];
        if (h === undefined || Number.isNaN(h)) continue;
        const nm = Math.max(maxCost[i] ?? Number.POSITIVE_INFINITY, h);
        const ns = (sumCost[i] ?? Number.POSITIVE_INFINITY) + h;
        const om = costOf(maxCost, ni);
        if (nm < om || (nm === om && ns < costOf(sumCost, ni))) {
          maxCost[ni] = nm;
          sumCost[ni] = ns;
          parent[ni] = i;
          push(ni);
        }
      }
    }
  }

  if (outlet < 0)
    throw new Error('deriveChannel: no continuous east-west route in this grid');

  const reversed: number[] = [outlet];
  let cur = parent[outlet] ?? -1;
  while (cur >= 0) {
    reversed.push(cur);
    cur = parent[cur] ?? -1;
  }
  reversed.reverse();
  return { inflow: reversed[0] ?? outlet, outlet, path: reversed };
}

/** Lowest finite cell in a grid column, or -1 when the column is all walls. */
function lowestInColumn(
  heights: ArrayLike<number>,
  noData: ArrayLike<number>,
  width: number,
  height: number,
  x: number,
): number {
  let best = -1;
  let bestH = Number.POSITIVE_INFINITY;
  for (let y = 0; y < height; y += 1) {
    const i = gridIndex(x, y, width);
    if (noData[i] === 1) continue;
    const h = heights[i];
    if (h === undefined || Number.isNaN(h) || !(h < bestH)) continue;
    bestH = h;
    best = i;
  }
  return best;
}

function costOf(costs: ArrayLike<number>, i: number): number {
  return costs[i] ?? Number.POSITIVE_INFINITY;
}
