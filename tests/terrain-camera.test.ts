/**
 * Camera clamps and damping.
 *
 * The polar floor is the one assertion here that is about correctness rather
 * than feel: above MAX_POLAR_DEG the camera drops under the terrain, which reads
 * as a broken renderer rather than as a viewpoint. Everything else exists so a
 * change to the damping maths cannot silently reintroduce an endless render
 * loop, which is the failure mode render-on-demand is most fragile to.
 */

import { describe, it, expect } from 'vitest';

import {
  CAMERA_FOV_DEG,
  DEFAULT_DAMPING_RATE,
  MAX_POLAR_DEG,
  MIN_POLAR_DEG,
  clampDistance,
  clampPolar,
  clampSpherical,
  dampingFactor,
  framingDistance,
  hasSettled,
  sphericalToCartesian,
  wrapAzimuth,
} from '@engine/terrain/index.js';

describe('opening view framing', () => {
  it('needs less distance on a wide viewport for a wide, shallow area', () => {
    // Depth-limited (a tall area) the aspect barely matters; width-limited
    // (a long valley) it is what decides the distance.
    const shallowWide = framingDistance(900_000, 60_000, CAMERA_FOV_DEG, 21 / 9, 50);
    const shallowTall = framingDistance(900_000, 60_000, CAMERA_FOV_DEG, 3 / 2, 50);
    expect(shallowWide).toBeLessThan(shallowTall);
    expect(Number.isFinite(shallowWide)).toBe(true);
  });

  it('backs off for a wider area at the same aspect', () => {
    const wide = framingDistance(699_000, 500_000, CAMERA_FOV_DEG, 16 / 9, 50);
    const island = framingDistance(114_000, 67_000, CAMERA_FOV_DEG, 16 / 9, 50);
    expect(wide).toBeGreaterThan(island * 2);
  });

  it('sits closer when tilted, because ground depth foreshortens', () => {
    const overhead = framingDistance(500_000, 500_000, CAMERA_FOV_DEG, 16 / 9, 0);
    const tilted = framingDistance(500_000, 500_000, CAMERA_FOV_DEG, 16 / 9, 60);
    expect(tilted).toBeLessThan(overhead);
  });

  it('keeps every projected ground corner inside the viewport', () => {
    for (const aspect of [390 / 512, 1440 / 560])
      for (const angle of [0, 50, 75]) {
        const polar = (angle * Math.PI) / 180;
        const tan = Math.tan((CAMERA_FOV_DEG * Math.PI) / 360);
        const distance = framingDistance(699000, 500000, CAMERA_FOV_DEG, aspect, angle);
        for (const z of [-250000, 250000]) {
          const depth = distance - z * Math.sin(polar);
          expect(Math.abs((z * Math.cos(polar)) / (depth * tan))).toBeLessThan(1);
          expect(349500 / (depth * tan * aspect)).toBeLessThan(1);
        }
      }
  });

  it('never returns zero or NaN for degenerate input', () => {
    expect(framingDistance(0, 0, CAMERA_FOV_DEG, 0, 90)).toBeGreaterThan(0);
    expect(framingDistance(1, 1, CAMERA_FOV_DEG, 1.6, 0)).toBeGreaterThan(0);
  });
});

describe('polar clamp', () => {
  it('refuses any angle that would put the camera under the terrain', () => {
    expect(clampPolar(0)).toBe(MIN_POLAR_DEG);
    expect(clampPolar(-45)).toBe(MIN_POLAR_DEG);
    expect(clampPolar(90)).toBe(MAX_POLAR_DEG);
    expect(clampPolar(180)).toBe(MAX_POLAR_DEG);
    expect(clampPolar(1000)).toBe(MAX_POLAR_DEG);
  });

  it('leaves the usable band untouched', () => {
    for (const angle of [6, 20, 40, 45, 60, 87.9]) {
      expect(clampPolar(angle)).toBe(angle);
    }
  });

  it('stays clear of a degenerate edge-on view', () => {
    // At exactly 90 degrees the view direction is parallel to the ground plane
    // and the perspective matrix goes singular.
    expect(MAX_POLAR_DEG).toBeLessThan(90);
    expect(clampPolar(Number.NaN)).toBe(MIN_POLAR_DEG);
  });

  it('keeps a narrow field of view, so relief is not barrel-distorted', () => {
    expect(CAMERA_FOV_DEG).toBeLessThanOrEqual(50);
    expect(CAMERA_FOV_DEG).toBeGreaterThan(20);
  });
});

describe('azimuth wrapping', () => {
  it('folds into [0, 360)', () => {
    expect(wrapAzimuth(0)).toBe(0);
    expect(wrapAzimuth(360)).toBe(0);
    expect(wrapAzimuth(370)).toBe(10);
    expect(wrapAzimuth(-10)).toBe(350);
    expect(wrapAzimuth(725)).toBeCloseTo(5, 9);
    expect(wrapAzimuth(Number.NaN)).toBe(0);
  });
});

describe('distance clamp', () => {
  it('honours per-area zoom limits', () => {
    expect(clampDistance(500, 1000, 10000)).toBe(1000);
    expect(clampDistance(1e9, 1000, 10000)).toBe(10000);
    expect(clampDistance(5000, 1000, 10000)).toBe(5000);
  });

  it('survives inverted limits rather than inverting the camera', () => {
    // A caller passing max < min should not get a negative range.
    expect(clampDistance(50, 1000, 100)).toBe(1000);
    expect(clampDistance(500, 1000, 100)).toBe(1000);
  });

  it('maps junk input to the near limit', () => {
    expect(clampDistance(Number.NaN, 100, 1000)).toBe(100);
    expect(clampDistance(-5, 100, 1000)).toBe(100);
  });
});

describe('clampSpherical', () => {
  it('clamps every component at once', () => {
    const s = clampSpherical(
      { polarDeg: 200, azimuthDeg: 400, distanceM: 1e12 },
      10,
      1000,
    );
    expect(s.polarDeg).toBe(MAX_POLAR_DEG);
    expect(s.azimuthDeg).toBeCloseTo(40, 9);
    expect(s.distanceM).toBe(1000);
  });
});

describe('spherical to cartesian', () => {
  it('puts the camera overhead at the polar floor, south of the target', () => {
    // Polar 0 is clamped up to MIN_POLAR_DEG, because exactly 0 is a plan view
    // with no sense of relief. At azimuth 0 the camera sits on the +z side,
    // which is south in this frame.
    const polar = (MIN_POLAR_DEG * Math.PI) / 180;
    const p = sphericalToCartesian({ polarDeg: 0, azimuthDeg: 0, distanceM: 500 });
    expect(p.x).toBeCloseTo(0, 6);
    expect(p.z).toBeCloseTo(500 * Math.sin(polar), 6);
    expect(p.y).toBeCloseTo(500 * Math.cos(polar), 6);
    // Still overhead-ish, not edge-on.
    expect(p.y).toBeGreaterThan(490);
  });

  it('approaches the target plane as polar approaches 90', () => {
    const p = sphericalToCartesian({ polarDeg: 88, azimuthDeg: 0, distanceM: 500 });
    expect(p.y).toBeGreaterThan(0);
    expect(p.y).toBeLessThan(20);
    // Azimuth 0 looks from the south, so the camera sits at +z.
    expect(p.z).toBeGreaterThan(0);
  });

  it('keeps the orbit radius constant at every angle', () => {
    for (const polarDeg of [6, 30, 60, 88]) {
      const p = sphericalToCartesian({ polarDeg, azimuthDeg: 37, distanceM: 1000 });
      expect(Math.hypot(p.x, p.y, p.z)).toBeCloseTo(1000, 6);
    }
  });

  it('still clamps an out-of-range polar rather than going underground', () => {
    const p = sphericalToCartesian({ polarDeg: 200, azimuthDeg: 0, distanceM: 100 });
    expect(p.y).toBeGreaterThan(0);
  });
});

describe('damping', () => {
  it('closes a fraction of the gap per frame, not a fixed amount', () => {
    const f = dampingFactor(DEFAULT_DAMPING_RATE, 1 / 60);
    expect(f).toBeGreaterThan(0.05);
    expect(f).toBeLessThan(0.5);
    // A fixed per-frame lerp would be identical for every timestep.
    expect(dampingFactor(DEFAULT_DAMPING_RATE, 1 / 30)).not.toBe(f);
  });

  it('is frame-rate independent', () => {
    // One 100 ms step and ten 10 ms steps must land in the same place, or the
    // camera feels different on a 60 Hz and a 144 Hz display.
    const oneBig = dampingFactor(DEFAULT_DAMPING_RATE, 0.1);
    let tenSmall = 1;
    for (let i = 0; i < 10; i++) {
      tenSmall *= 1 - dampingFactor(DEFAULT_DAMPING_RATE, 0.01);
    }
    expect(tenSmall).toBeCloseTo(1 - oneBig, 9);
  });

  it('keeps closing the gap at every timestep, however small', () => {
    // The factor is never rounded to zero. Termination is hasSettled's job:
    // returning 0 here would freeze the camera without telling the caller it
    // had arrived, and the render-on-demand chain would request frames forever.
    for (const dt of [0.001, 0.008, 0.016, 0.05, 0.5, 2]) {
      expect(dampingFactor(DEFAULT_DAMPING_RATE, dt), `dt=${dt}`).toBeGreaterThan(0);
      expect(dampingFactor(DEFAULT_DAMPING_RATE, dt), `dt=${dt}`).toBeLessThanOrEqual(1);
    }
  });

  it('closes more of the gap over a longer step, monotonically', () => {
    const factors = [0.008, 0.016, 0.05, 0.25].map((dt) =>
      dampingFactor(DEFAULT_DAMPING_RATE, dt),
    );
    for (let i = 1; i < factors.length; i++) {
      expect(factors[i]!).toBeGreaterThan(factors[i - 1]!);
    }
  });

  it('drives a real orbit to rest, which is what stops the render loop', () => {
    // Simulate the actual advance-and-check loop rather than testing the factor
    // in isolation. If this does not terminate, an idle viewer burns battery
    // forever, which is the failure render-on-demand exists to prevent.
    let current = 40;
    const target = 12;
    let frames = 0;
    while (!hasSettled(current, target) && frames < 10_000) {
      current += (target - current) * dampingFactor(DEFAULT_DAMPING_RATE, 1 / 60);
      frames += 1;
    }
    expect(frames, 'the orbit never settled').toBeLessThan(10_000);
    // DESIGN.md's --dur-slow is 600 ms; at 60 fps that is about 36 frames. The
    // window is generous because frame pacing varies, but a camera that took
    // 200 frames to stop would read as a crawl rather than a settle.
    expect(frames, 'the orbit should settle in roughly 600 ms').toBeGreaterThan(20);
    expect(frames, 'the orbit should settle in roughly 600 ms').toBeLessThan(90);
    // It stops once the gap is inside the relative tolerance, not at the target.
    expect(Math.abs(current - target)).toBeLessThanOrEqual(
      Math.abs(target) * 1e-4 + 1e-9,
    );
  });

  it('reports "arrived" for a zero or negative timestep', () => {
    expect(dampingFactor(DEFAULT_DAMPING_RATE, 0)).toBe(0);
    expect(dampingFactor(DEFAULT_DAMPING_RATE, -1)).toBe(0);
    expect(dampingFactor(0, 0.016)).toBe(0);
    expect(dampingFactor(1, 0.016)).toBe(0);
  });
});

describe('settled test', () => {
  it('closes on the target within tolerance', () => {
    expect(hasSettled(10, 10)).toBe(true);
    expect(hasSettled(10, 10.0001)).toBe(true);
    expect(hasSettled(10, 11)).toBe(false);
  });

  it('scales tolerance with distance, so a 700 km view is not jittery', () => {
    // Tolerance is 0.01% of the target. On the overview orbit that is 70 m,
    // which is invisible on a 699 km view; on a 6 km orbit it is 0.6 m, which
    // is tight enough to look locked.
    expect(hasSettled(699_950, 700_000)).toBe(true);
    expect(hasSettled(690_000, 700_000)).toBe(false);
    expect(hasSettled(5_999.5, 6_000)).toBe(true);
    expect(hasSettled(5_000, 6_000)).toBe(false);
  });

  it('treats junk as settled, so a NaN cannot spin the loop forever', () => {
    expect(hasSettled(Number.NaN, 10)).toBe(true);
    expect(hasSettled(10, Number.NaN)).toBe(true);
  });
});
