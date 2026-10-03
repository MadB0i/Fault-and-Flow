/**
 * Metric geometry, contour intervals and legend ticks, derived from a sidecar.
 *
 * Pure module. Every function here is a pure function of its arguments, which is
 * what lets the numbers the HUD shows be asserted in a unit test rather than
 * eyeballed on a render nobody can see.
 *
 * The recurring theme is that GLO-30 pixels are neither square nor 30 m, so
 * nothing in this file multiplies width by a single pixel size. East-west and
 * north-south are carried as a pair throughout. See docs/DATA.md section 1.
 */

import type { TerrainSidecar, Bbox } from './sidecar.js';

/**
 * Contour intervals, in metres. Not arbitrary: every one is a value a reader can
 * do mental arithmetic with, and the set is deliberately sparse so the picker
 * cannot choose something like 175 m.
 *
 * Capped at 1000 m. The overview area's relief is 7.3 km, which at 1000 m
 * already gives only seven bands, and pushing further would mean inventing
 * intervals outside the set. A coarser contour line on that area is the correct
 * trade against a value nobody can estimate at a glance.
 */
export const NICE_CONTOUR_INTERVALS: readonly number[] = [
  10, 25, 50, 100, 250, 500, 1000,
] as const;

/**
 * Most contour bands we will draw across an area's full relief. Above roughly
 * this the lines stop reading as a readable set of levels and start reading as
 * hatching, which is the opposite of what a contour is for.
 */
export const MAX_CONTOUR_BANDS = 14;

/**
 * Smallest contour interval that will not alias against the grid.
 *
 * Two pixels of separation. On flat ground contours are far apart anyway; this
 * bound only bites on steep ground, where a contour interval finer than the
 * sample spacing produces a line per pixel and the level information is gone.
 */
export const MIN_INTERVAL_PIXELS = 2;

/** Extent of a grid in metres, east-west and north-south. */
export type ExtentM = {
  readonly widthM: number;
  readonly heightM: number;
  /** Diagonal in metres; the unit camera zoom limits are expressed in. */
  readonly diagonalM: number;
};

export function extentMeters(meta: {
  width: number;
  height: number;
  pixelSizeMx: number;
  pixelSizeMy: number;
}): ExtentM {
  const widthM = meta.width * meta.pixelSizeMx;
  const heightM = meta.height * meta.pixelSizeMy;
  return { widthM, heightM, diagonalM: Math.hypot(widthM, heightM) };
}

/** Relief of a sidecar, in metres. Zero for a degenerate range, never negative. */
export function reliefMeters(meta: {
  minElevation: number;
  maxElevation: number;
}): number {
  return Math.max(0, meta.maxElevation - meta.minElevation);
}

/**
 * Pick the contour interval for a given relief and ground sampling.
 *
 * The smallest interval in {@link NICE_CONTOUR_INTERVALS} that keeps the band
 * count at or under {@link MAX_CONTOUR_BANDS} and stays at least
 * {@link MIN_INTERVAL_PIXELS} pixels above the sampling. If nothing in the set
 * qualifies - which happens for the overview area, whose relief is large enough
 * that even 1000 m bands sit closer than two pixels - the largest interval is
 * returned rather than extrapolating outside the documented set.
 *
 * Bands are counted against the full relief, including the part outside the
 * viewport, so the interval does not change as the camera moves. An interval
 * that rescaled under zoom would make the legend wrong half the time.
 */
export function pickContourInterval(reliefM: number, pixelSizeM: number): number {
  if (!(reliefM > 0) || !(pixelSizeM > 0)) return NICE_CONTOUR_INTERVALS[0] ?? 10;

  const floor = MIN_INTERVAL_PIXELS * pixelSizeM;
  const largest = NICE_CONTOUR_INTERVALS[NICE_CONTOUR_INTERVALS.length - 1] ?? 1000;

  for (const interval of NICE_CONTOUR_INTERVALS) {
    if (reliefM / interval <= MAX_CONTOUR_BANDS && interval >= floor) return interval;
  }
  return largest;
}

/**
 * The contour interval a sidecar should use, derived from its own numbers.
 *
 * Pixel size is the LARGER of the two axes, because the tighter constraint is
 * the coarser axis: a grid whose cells are 530 m one way and 60 m the other
 * still cannot resolve a contour closer than its widest cell.
 */
export function contourIntervalFor(sidecar: TerrainSidecar): number {
  const coarser = Math.max(sidecar.pixelSizeMx, sidecar.pixelSizeMy);
  return pickContourInterval(reliefMeters(sidecar), coarser);
}

/**
 * Tick steps for a legend axis. Also "nice numbers" only, for the same reason as
 * contour intervals: a legend reading 0, 37, 74, 111 asks the reader to do
 * arithmetic, which is the one thing a legend exists to avoid.
 */
export const NICE_TICK_STEPS: readonly number[] = [
  1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 2500, 5000,
] as const;

/** Default number of labelled bands on the legend ramp. */
export const DEFAULT_TICK_TARGET = 5;

/**
 * A legend tick step that divides the range into roughly `target` bands.
 *
 * Prefers the smallest step that keeps the band count at or under the target,
 * matching how the contour picker works, so the two controls feel like the same
 * family rather than two unrelated heuristics.
 */
export function pickTickStep(
  min: number,
  max: number,
  target: number = DEFAULT_TICK_TARGET,
): number {
  const range = max - min;
  if (!(range > 0) || !(target > 0)) return NICE_TICK_STEPS[0] ?? 1;

  const needed = range / target;
  for (const step of NICE_TICK_STEPS) {
    if (step >= needed) return step;
  }
  const last = NICE_TICK_STEPS[NICE_TICK_STEPS.length - 1] ?? 1;
  return range / last < 1 ? range / last : last;
}

/**
 * Legend ticks at multiples of a step, within the range.
 *
 * Returned ascending. Always at least the two endpoints when the range is
 * non-degenerate, because a legend whose ends are missing cannot tell the reader
 * what the colour at the very top and bottom of the ramp means.
 */
export function legendTicks(min: number, max: number, step: number): readonly number[] {
  if (!(step > 0) || !(max > min)) return [min, max];

  const ticks: number[] = [];
  const first = Math.ceil(min / step);
  const last = Math.floor(max / step);
  for (let i = first; i <= last; i++) {
    const v = i * step;
    // Re-round to kill binary-float dust, which would otherwise print as
    // 2500.0000000000005 in the mono face.
    const rounded = Math.round(v / step) * step;
    ticks.push(Number(rounded.toPrecision(12)));
  }

  const hasMin = ticks.some((t) => Math.abs(t - min) < step * 1e-6);
  const hasMax = ticks.some((t) => Math.abs(t - max) < step * 1e-6);
  if (!hasMin) ticks.unshift(min);
  if (!hasMax) ticks.push(max);

  return ticks;
}

/**
 * The elevation range the colour ramp actually displays.
 *
 * The sidecar's own min/max is the wrong range for a view. On the Assam
 * overview it is 0..7330 m because the bounding box clips the Mishmi Hills,
 * which puts the entire Brahmaputra floodplain (roughly 50..130 m) inside the
 * bottom 2% of the ramp: the entire valley the product is about renders as the
 * darkest colour. Stretching to the 2nd..98th percentile of the elevations that
 * actually occupy the area puts the floodplain across the middle of the ramp
 * and lets the hills clip, which the UI states rather than hides.
 */
export type RampRange = {
  /** Metres; the ramp's low end. */
  readonly min: number;
  /** Metres; the ramp's high end. */
  readonly max: number;
  /** True when real terrain lies below `min` and is drawn as the low colour. */
  readonly clippedLow: boolean;
  /** True when real terrain lies above `max` and is drawn as the high colour. */
  readonly clippedHigh: boolean;
  /** True when the data is flat enough that percentiles collapsed the range. */
  readonly degenerate: boolean;
};

export const RAMP_PERCENTILES = { low: 0.02, high: 0.98 } as const;

/**
 * Nearest-rank percentile of a finite sample, no interpolation: a percentile of
 * a measured elevation should be a measurement, not a value between two.
 */
export function percentileOf(heights: ArrayLike<number>, p: number): number {
  const finite: number[] = [];
  for (let i = 0; i < heights.length; i += 1) {
    const v = heights[i];
    if (v !== undefined && Number.isFinite(v)) finite.push(v);
  }
  if (finite.length === 0) return Number.NaN;
  finite.sort((a, b) => a - b);
  const clampedP = Math.min(1, Math.max(0, p));
  const rank = Math.ceil(clampedP * finite.length) - 1;
  return finite[Math.min(Math.max(rank, 0), finite.length - 1)] ?? Number.NaN;
}

/**
 * Ramp range for one area: 2nd..98th percentile, widened to the true min/max
 * when that would make the range degenerate or inverted.
 */
export function rampRangeFor(
  heights: ArrayLike<number>,
  trueMin: number,
  trueMax: number,
  lowP: number = RAMP_PERCENTILES.low,
  highP: number = RAMP_PERCENTILES.high,
): RampRange {
  let min = percentileOf(heights, lowP);
  let max = percentileOf(heights, highP);

  // Percentiles can collapse on flat data (a floodplain at one level), which
  // would divide by ~0 in the shader and hand every cell the same colour.
  if (!Number.isFinite(min) || !Number.isFinite(max) || !(max - min > 1)) {
    min = trueMin;
    max = trueMax;
    if (!(max - min > 0)) max = min + 1;
    // Clipping is still reported from the true range: on flat data every cell
    // renders as one colour, and claiming "nothing is clipped" would be a false
    // reassurance about terrain the user cannot see.
    return {
      min,
      max,
      clippedLow: trueMin < min - 1e-6,
      clippedHigh: trueMax > max + 1e-6,
      degenerate: true,
    };
  }

  return {
    min,
    max,
    clippedLow: trueMin < min - 1e-6,
    clippedHigh: trueMax > max + 1e-6,
    degenerate: false,
  };
}

/**
 * Legend tick steps for a ramp range, sized so ticks never collide.
 *
 * `legendTicks` alone overflows a narrow panel: a 60 m span with a 20 m step
 * yields four labels, and at panel width each label can overlap its neighbour.
 * Dropping to a coarser step until the labels are at least `minGapPx` apart at
 * `panelWidthPx` keeps the axis readable without changing what the ramp means.
 */
export function rampTickStepFor(
  range: RampRange,
  panelWidthPx: number,
  minGapPx: number,
): number {
  const span = range.max - range.min;
  if (!(span > 0) || !(panelWidthPx > 0) || !(minGapPx > 0)) {
    return pickTickStep(range.min, range.max);
  }
  const usable = Math.min(panelWidthPx, 320);
  const labels = Math.max(2, Math.floor(usable / minGapPx));
  return pickTickStep(range.min, range.max, labels);
}

/**
 * Legend ticks for a ramp range, first and last forced onto the ramp ends so
 * the axis always spans exactly what is displayed.
 */
export function rampTicks(range: RampRange, step: number): readonly number[] {
  if (!(step > 0) || !(range.max > range.min)) return [range.min, range.max];
  const ticks = legendTicks(range.min, range.max, step).filter(
    (t) => t >= range.min - step * 1e-6 && t <= range.max + step * 1e-6,
  );
  const hasMin = ticks.some((t) => Math.abs(t - range.min) < step * 1e-6);
  const hasMax = ticks.some((t) => Math.abs(t - range.max) < step * 1e-6);
  if (!hasMin) ticks.unshift(range.min);
  if (!hasMax) ticks.push(range.max);
  return ticks;
}

/** Convenience: the ticks a legend for this sidecar should carry. */
export function legendTicksFor(
  sidecar: TerrainSidecar,
  target: number = DEFAULT_TICK_TARGET,
): readonly number[] {
  const step = pickTickStep(sidecar.minElevation, sidecar.maxElevation, target);
  return legendTicks(sidecar.minElevation, sidecar.maxElevation, step);
}

// ---------------------------------------------------------------------------
// Geographic <-> grid <-> world conversions
// ---------------------------------------------------------------------------

export type GridPoint = {
  /** Fractional column, 0 at the west edge, 1 at the east edge. */
  readonly u: number;
  /** Fractional row, 0 at the NORTH edge, 1 at the south edge. */
  readonly v: number;
};

/** True when `lon`/`lat` fall inside the bounding box. Edges are inclusive. */
export function containsLonLat(bbox: Bbox, lon: number, lat: number): boolean {
  return lon >= bbox.west && lon <= bbox.east && lat >= bbox.south && lat <= bbox.north;
}

/** Geographic coordinates to fractional grid coordinates. */
export function lonLatToGrid(bbox: Bbox, lon: number, lat: number): GridPoint {
  const u = (lon - bbox.west) / (bbox.east - bbox.west);
  const v = (bbox.north - lat) / (bbox.north - bbox.south);
  return { u, v };
}

/** Fractional grid coordinates back to geographic. */
export function gridToLonLat(
  bbox: Bbox,
  u: number,
  v: number,
): { lon: number; lat: number } {
  return {
    lon: bbox.west + u * (bbox.east - bbox.west),
    lat: bbox.north - v * (bbox.north - bbox.south),
  };
}

/**
 * Height of the terrain in WORLD units, for the vertex shader's flat base grid.
 *
 * The plane is laid out in true metres from the sidecar - not degrees, not
 * arbitrary units - so a slope read off the render is a slope in the ground, and
 * so the two areas with very different pixel sizes sit at a consistent scale
 * relative to their own extent.
 *
 * Origin is the centre of the grid, x east and z south, so the orbit target is
 * (0, 0, 0) and no per-area offset has to be threaded through the camera.
 */
export function gridToWorld(
  meta: { width: number; height: number; pixelSizeMx: number; pixelSizeMy: number },
  u: number,
  v: number,
): { x: number; z: number } {
  const e = extentMeters(meta);
  return {
    x: (u - 0.5) * e.widthM,
    z: (v - 0.5) * e.heightM,
  };
}
