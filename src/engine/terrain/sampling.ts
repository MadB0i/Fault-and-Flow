/**
 * Bilinear height sampling from a decoded grid.
 *
 * Pure module, no DOM, no Three.js. This is the CPU twin of what the vertex and
 * fragment shaders do on the GPU, and it exists so that the pointer readout is
 * computed by the same arithmetic the render uses and can be asserted in a unit
 * test. Two implementations of a sampler that can disagree is exactly the kind
 * of thing that shows up as "the tooltip says 103 m and the hill is clearly
 * higher".
 *
 * No-data is NaN in `heights` and 1 in `noData`. A sample that touches any
 * no-data cell returns NaN rather than blending a hole into a number, because a
 * partially-interpolated elevation across a data gap is not a measurement of
 * anything.
 */

import type { TerrainGridMeta } from './decode-terrain.js';
import { NO_DATA_HEIGHT } from './decode-terrain.js';

export type SampleResult = {
  /** Metres, or NaN where the sample falls on or touches no-data. */
  readonly elevationM: number;
  /** True when the sample could not be produced from real data. */
  readonly noData: boolean;
};

/** Bilinear sample at fractional grid coordinates. Row 0 is the north edge. */
export function sampleBilinear(
  heights: ArrayLike<number>,
  noData: ArrayLike<number>,
  meta: Pick<TerrainGridMeta, 'width' | 'height'>,
  u: number,
  v: number,
): SampleResult {
  const { width, height } = meta;

  // Outside the grid entirely: nothing to sample, and not a measurement.
  if (!Number.isFinite(u) || !Number.isFinite(v)) {
    return { elevationM: NO_DATA_HEIGHT, noData: true };
  }
  if (u < 0 || u > 1 || v < 0 || v > 1) {
    return { elevationM: NO_DATA_HEIGHT, noData: true };
  }

  // Pixel centres sit at (i + 0.5) / n in fractional coordinates, so the
  // bilinear cell at u = 0 starts half a pixel in. Getting this wrong shifts
  // every sample by half a pixel, which is invisible on a hill and 30 m of error
  // on a riverbank.
  const x = u * width - 0.5;
  const y = v * height - 0.5;

  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;

  // Clamp the four taps into the grid. The outermost half-pixel therefore repeats
  // the edge row rather than reading past the array, so a probe at the very
  // border of the bbox still returns the edge elevation.
  const x1 = Math.min(width - 1, x0 + 1);
  const y1 = Math.min(height - 1, y0 + 1);
  const cx0 = Math.min(width - 1, Math.max(0, x0));
  const cy0 = Math.min(height - 1, Math.max(0, y0));

  const h00 = readCell(heights, noData, cx0, cy0, width);
  const h10 = readCell(heights, noData, x1, cy0, width);
  const h01 = readCell(heights, noData, cx0, y1, width);
  const h11 = readCell(heights, noData, x1, y1, width);

  if (h00 === null || h10 === null || h01 === null || h11 === null) {
    return { elevationM: NO_DATA_HEIGHT, noData: true };
  }

  // Weighted blend, row-major lerps.
  const top = h00 + (h10 - h00) * fx;
  const bottom = h01 + (h11 - h01) * fx;
  return { elevationM: top + (bottom - top) * fy, noData: false };
}

function readCell(
  heights: ArrayLike<number>,
  noData: ArrayLike<number>,
  x: number,
  y: number,
  width: number,
): number | null {
  const i = y * width + x;
  if (noData[i] === 1) return null;
  const h = heights[i];
  // Guard the NaN case too: a height can be NaN without the mask being set if a
  // caller hands us a grid built by something other than decodeTerrainRgba.
  return h === undefined || Number.isNaN(h) ? null : h;
}

/**
 * Nearest-neighbour sample. Used where interpolating would be wrong rather than
 * merely inexact - currently nowhere in the renderer, but kept because it is the
 * honest answer for a "which cell is this" query and it is the reference the
 * bilinear sampler is checked against.
 */
export function sampleNearest(
  heights: ArrayLike<number>,
  noData: ArrayLike<number>,
  meta: Pick<TerrainGridMeta, 'width' | 'height'>,
  u: number,
  v: number,
): SampleResult {
  const { width, height } = meta;
  if (!Number.isFinite(u) || !Number.isFinite(v) || u < 0 || u > 1 || v < 0 || v > 1) {
    return { elevationM: NO_DATA_HEIGHT, noData: true };
  }
  const x = Math.min(width - 1, Math.max(0, Math.floor(u * width)));
  const y = Math.min(height - 1, Math.max(0, Math.floor(v * height)));
  const i = y * width + x;
  if (noData[i] === 1) return { elevationM: NO_DATA_HEIGHT, noData: true };
  const h = heights[i];
  if (h === undefined || Number.isNaN(h)) {
    return { elevationM: NO_DATA_HEIGHT, noData: true };
  }
  return { elevationM: h, noData: false };
}
