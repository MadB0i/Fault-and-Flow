/**
 * Terrain-RGB codec — the pure, dependency-free core.
 *
 * Lives in `src/engine/terrain/` because the engine needs to read these files
 * headlessly, with no DOM and no Node-only API. The build script imports the
 * same functions to write them, so encode and decode cannot drift apart.
 *
 * Encoding: `code = round((elevation - offset) / 0.1)`, packed big-endian into
 * R, G, B. No-data is written as code 0 and flagged in the sidecar, so a decoder
 * never has to distinguish "0 m" from "no data" by guessing.
 */

export const TERRAIN_RGB_STEP_M = 0.1;

/**
 * Source no-data sentinel for Copernicus GLO-30.
 *
 * TRAP, documented in docs/DATA.md §1: this value appears ONLY in the tile's
 * sidecar XML (`valueInvalidPixels="-32767"`). GeoTIFF tag 42113 is absent from
 * these files, so a reader that trusts the GeoTIFF silently treats -32767 as an
 * elevation of -32.7 km. Every read path in this project goes through
 * {@link isNoData}.
 */
export const SOURCE_NODATA = -32767;

/** Pixel spacing of the GLO-30 product in degrees (1 arcsecond). */
export const GLO30_PIXEL_DEG = 1 / 3600;

/** Pixel spacing of the GLO-90 product, which must never be accepted. */
export const GLO90_PIXEL_DEG = 3 / 3600;

/** Tolerance for the spacing assertion, as a fraction of the expected value. */
export const SPACING_TOLERANCE = 0.01;

/** True when a value read from the source DEM means "no data", not an elevation. */
export function isNoData(value: number): boolean {
  return value === SOURCE_NODATA;
}

/** Offset to record in a sidecar for a given observed minimum elevation. */
export function offsetFor(minElevation: number): number {
  return Math.floor(minElevation);
}

/** Quantise an elevation to a 16-bit Terrain-RGB code. */
export function encodeElevation(
  elevation: number,
  offset: number,
  step: number = TERRAIN_RGB_STEP_M,
): number {
  const v = Math.round((elevation - offset) / step);
  if (!Number.isFinite(v) || v < 0 || v > 65535) {
    throw new RangeError(
      `elevation ${elevation} m is outside the Terrain-RGB range for offset ${offset} m`,
    );
  }
  return v;
}

/** Inverse of {@link encodeElevation}. Exact to within `step / 2`. */
export function decodeElevation(
  code: number,
  offset: number,
  step: number = TERRAIN_RGB_STEP_M,
): number {
  return code * step + offset;
}
