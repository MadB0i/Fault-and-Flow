/**
 * Orbit camera maths, with no Three.js in sight.
 *
 * Split out from the view so the parts that can be wrong silently - the polar
 * clamp that stops the camera going under the terrain, the damping that decides
 * whether motion is smooth or jittery, the distance limits - are pure functions
 * with unit tests rather than geometry buried in a render loop nobody can watch.
 *
 * Coordinate frame, matching {@link gridToWorld}: x east, z south, y up. The
 * orbit target is the origin.
 */

export type Spherical = {
  /** Degrees from straight down. 0 = plan view, 90 = edge on. */
  readonly polarDeg: number;
  /** Degrees around the vertical axis. 0 looks from the south, clockwise. */
  readonly azimuthDeg: number;
  /** Orbit radius in metres. */
  readonly distanceM: number;
};

export type Vec3 = { readonly x: number; readonly y: number; readonly z: number };

/**
 * Hard floor on the polar angle, degrees from straight down.
 *
 * This is the one clamp that is not about taste. Above this the camera drops
 * below the terrain surface, which means either clipping through a hillside or
 * seeing the underside of the ground plane, and both read as the renderer being
 * broken rather than as a viewpoint.
 */
export const MIN_POLAR_DEG = 6;

/**
 * Soft ceiling on the polar angle: 88 degrees, two degrees short of edge-on.
 *
 * At exactly 90 the view direction is parallel to the ground plane, the far
 * distance degenerates and the perspective matrix becomes ill-conditioned. Two
 * degrees of margin keeps the horizon stable while still allowing a
 * near-profile view.
 */
export const MAX_POLAR_DEG = 88;

/** Camera field of view, degrees. Narrow: a wide FOV distorts terrain relief. */
export const CAMERA_FOV_DEG = 45;

/**
 * Clamp a polar angle into the allowed band.
 *
 * Also folds the angle into [0, 360) first, so a caller accumulating azimuth
 * over a long session cannot drift a polar value out of range through wrapping.
 */
export function clampPolar(polarDeg: number): number {
  if (!Number.isFinite(polarDeg)) return MIN_POLAR_DEG;
  return Math.min(MAX_POLAR_DEG, Math.max(MIN_POLAR_DEG, polarDeg));
}

/** Wrap an azimuth into [0, 360). */
export function wrapAzimuth(azimuthDeg: number): number {
  if (!Number.isFinite(azimuthDeg)) return 0;
  const wrapped = azimuthDeg % 360;
  return wrapped < 0 ? wrapped + 360 : wrapped;
}

/** Clamp an orbit distance into the area's zoom limits. */
export function clampDistance(distanceM: number, minM: number, maxM: number): number {
  const lo = Math.max(1, minM);
  const hi = Math.max(lo, maxM);
  if (!Number.isFinite(distanceM)) return lo;
  return Math.min(hi, Math.max(lo, distanceM));
}

/** Clamp every component of a spherical camera state at once. */
export function clampSpherical(s: Spherical, minM: number, maxM: number): Spherical {
  return {
    polarDeg: clampPolar(s.polarDeg),
    azimuthDeg: wrapAzimuth(s.azimuthDeg),
    distanceM: clampDistance(s.distanceM, minM, maxM),
  };
}

/**
 * Spherical to Cartesian, about the origin.
 *
 * polar 0 puts the camera straight above the target looking down; polar 90 puts
 * it level with the target, south of it for azimuth 0. Azimuth rotates from the
 * south toward the east, which puts the opening view of a north-south river
 * valley looking up the valley.
 */
/**
 * Orbit distance at which a horizontal extent fills the viewport.
 *
 * The old opening distance was `diagonal * 0.95`, which is a geometric guess:
 * it fits the area's diagonal regardless of how the box sits against the
 * viewport's aspect, so a wide valley either overflowed the sides or sat small
 * in the middle. This solves the actual fit — the half-extent the camera must
 * cover on its near and far edges, with the vertical FOV widened by the aspect
 * ratio on wide screens — then adds a small margin so nothing touches the edge.
 *
 * Pure and unit-tested (`tests/terrain-camera.test.ts`).
 */
export function framingDistance(
  widthM: number,
  heightM: number,
  fovDeg: number,
  aspect: number,
  polarDeg: number,
  margin = 1.06,
): number {
  const w = Math.max(widthM, 1);
  const h = Math.max(heightM, 1);
  const fov = (fovDeg * Math.PI) / 180;
  const polar = (polarDeg * Math.PI) / 180;
  // Tilted away from plan view, the area's depth foreshortens by cos(polar),
  // so the same distance has to cover more ground to keep it on screen.
  const tilt = Math.max(Math.cos(polar), 0.25);
  const depthNeeded = h / 2 / Math.max(Math.sin(fov / 2), 1e-3) / tilt;
  const hfov = 2 * Math.atan(Math.tan(fov / 2) * Math.max(aspect, 0.2));
  const widthNeeded = w / 2 / Math.max(Math.tan(hfov / 2), 1e-3);
  return Math.max(depthNeeded, widthNeeded) * Math.max(margin, 1);
}

export function sphericalToCartesian(s: Spherical): Vec3 {
  const polar = (clampPolar(s.polarDeg) * Math.PI) / 180;
  const azim = (wrapAzimuth(s.azimuthDeg) * Math.PI) / 180;
  const r = s.distanceM;

  const horizontal = r * Math.sin(polar);
  return {
    x: horizontal * Math.sin(azim),
    // cos(polar) is the component along the up axis; at polar 0 the whole radius
    // is vertical, at polar 90 none of it is.
    y: r * Math.cos(polar),
    z: horizontal * Math.cos(azim),
  };
}

/**
 * Frame-rate-independent damping factor for exponential decay.
 *
 * Returns the FRACTION OF THE GAP CLOSED over `deltaSeconds`. `rate` is the
 * fraction of the distance remaining after one second, so the factor is
 * `1 - rate**dt`.
 *
 * Using an exponential rather than a fixed per-frame lerp is what makes a drag
 * feel the same on a 60 Hz and a 120 Hz display, which a naive
 * `x += (t - x) * 0.1` does not.
 *
 * This function does NOT decide when the animation is over. That is
 * {@link hasSettled}'s job, and the separation matters: rounding this factor to
 * zero below some threshold would leave the camera frozen without the caller
 * ever being told it had arrived, and the render-on-demand chain would then
 * never stop requesting frames. A small factor is always safe here precisely
 * because termination is decided by comparing the gap, not the step.
 */
export function dampingFactor(rate: number, deltaSeconds: number): number {
  if (!(rate > 0) || !(rate < 1)) return 0;
  if (!(deltaSeconds > 0)) return 0;
  // Clamped to (0, 1]: a factor of exactly 1 would snap, and a factor above 1
  // would overshoot and oscillate.
  const progress = 1 - Math.pow(rate, deltaSeconds);
  return Math.min(1, Math.max(0, progress));
}

/**
 * Whether a damped value is close enough to its target to stop animating.
 *
 * Both absolute and relative, because the areas differ by three orders of
 * magnitude in distance: 1 m of slack is invisible on a 700 km overview and
 * unnoticeable-but-jittery on a 60 km reach, while 10 km of slack on the
 * overview is a visible gap.
 */
export function hasSettled(current: number, target: number, relEpsilon = 1e-4): boolean {
  if (!Number.isFinite(current) || !Number.isFinite(target)) return true;
  const scale = Math.max(Math.abs(target), 1);
  return Math.abs(target - current) <= relEpsilon * scale;
}

/**
 * Default damping rate: the fraction of the gap remaining after one second.
 *
 * 1e-5 closes about 99.999% of a gap in 0.6 s, which is DESIGN.md's `--dur-slow`
 * of 600 ms on the `--ease` curve. A faster rate feels snappy but starts to read
 * as the camera snapping rather than settling, and a slower one leaves a visible
 * crawl after a drag ends.
 */
export const DEFAULT_DAMPING_RATE = 1e-5;

/** Radians per degree, for the few places that need it. */
export const DEG = Math.PI / 180;
