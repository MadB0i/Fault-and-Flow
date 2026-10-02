/**
 * Source-pixel-spacing guard for the DEM pipeline.
 *
 * Kept in its own module so a unit test can import and exercise it without
 * importing the pipeline's `main()`, which performs network I/O on load.
 */

import {
  GLO30_PIXEL_DEG,
  GLO90_PIXEL_DEG,
  SPACING_TOLERANCE,
} from '../src/engine/terrain/terrain-rgb.ts';

/**
 * Throw unless the source grid spacing is the expected one.
 *
 * This exists because of a trap documented in docs/DATA.md §1. The two Copernicus
 * products differ only in pixel spacing — GLO-30 is 1 arcsecond, GLO-90 is 3 — and
 * both live in adjacent AWS buckets under confusingly similar names. The GLO-30
 * tiles are named `COG_10_*` because the number is arcseconds, so a glob written
 * for `_30_` picks up the 90 m product without erroring. Nothing downstream would
 * notice: the elevations would be plausible and the terrain quietly three times
 * too coarse.
 *
 * Failing loudly is the only cheap defence, so this throws rather than warns, and
 * names the specific mistake when it recognises it.
 */
export function assertSpacing(
  spacingDeg: number,
  context: string,
  expected: number = GLO30_PIXEL_DEG,
): void {
  const tol = expected * SPACING_TOLERANCE;
  if (Math.abs(spacingDeg - expected) > tol) {
    const isGlo90 =
      Math.abs(spacingDeg - GLO90_PIXEL_DEG) <= GLO90_PIXEL_DEG * SPACING_TOLERANCE;
    throw new Error(
      `pixel spacing ${spacingDeg} deg is not the GLO-30 value ${expected} deg (${context}).` +
        (isGlo90
          ? ' This is the 90 m product (3 arcsec): a wrong glob or the wrong bucket fetched GLO-90 instead of GLO-30. See docs/DATA.md section 1.'
          : ' Unexpected grid; check the source tile.'),
    );
  }
}
