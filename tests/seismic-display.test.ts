import { describe, expect, it } from 'vitest';
import {
  magnitudeBand,
  magnitudeRadius,
  syntheticBuildingSway,
} from '../src/shared/seismic-display.js';
import { sampleMeshSurface } from '../src/engine/terrain/mesh-sampling.js';
import { sampleBilinear } from '../src/engine/terrain/sampling.js';

describe('catalogue symbol semantics', () => {
  it('uses explicit magnitude boundaries and preserves unknown values', () => {
    expect([5, 5.9, 6, 6.9, 7, 8.6].map(magnitudeBand)).toEqual([
      'amber',
      'amber',
      'light',
      'light',
      'red',
      'red',
    ]);
    expect(magnitudeBand(null)).toBe('unknown');
    expect(magnitudeBand(NaN)).toBe('unknown');
    expect(magnitudeRadius(8.6)).toBeGreaterThan(magnitudeRadius(5));
    expect(magnitudeRadius(100)).toBe(9);
  });
});

describe('rendered terrain attachment', () => {
  const meta = { width: 2, height: 2 };
  // Synthetic test fixture: a saddle where a full DEM interpolation differs
  // from the renderer's triangles. These are not geographic measurements.
  const heights = [0, 100, 100, 0];
  const valid = [0, 0, 0, 0];
  it('follows the mesh diagonal instead of floating at the DEM interpolation', () => {
    expect(sampleBilinear(heights, valid, meta, 0.5, 0.5).elevationM).toBe(50);
    expect(sampleMeshSurface(heights, valid, meta, 0.5, 0.5, 1)).toBe(100);
    expect(sampleMeshSurface(heights, valid, meta, 0.25, 0.25, 1)).toBe(50);
    expect(sampleMeshSurface(heights, valid, meta, 0.75, 0.75, 1)).toBe(50);
    expect(sampleMeshSurface(heights, valid, meta, 1, 1, 1)).toBe(0);
  });
  it('does not invent ground in a data gap or outside the map', () => {
    expect(sampleMeshSurface(heights, [0, 1, 0, 0], meta, 0.5, 0.5, 1)).toBeNull();
    expect(sampleMeshSurface(heights, valid, meta, -0.1, 0.5, 1)).toBeNull();
    expect(sampleMeshSurface(heights, valid, meta, NaN, 0.5, 1)).toBeNull();
  });
});

describe('explicitly synthetic building motion', () => {
  it('increases the display amplitude and always settles after the demo', () => {
    expect(Math.abs(syntheticBuildingSway(1, 'strong'))).toBeGreaterThan(
      Math.abs(syntheticBuildingSway(1, 'gentle')),
    );
    expect(syntheticBuildingSway(0, 'medium')).toBe(0);
    expect(syntheticBuildingSway(4, 'strong')).toBe(0);
    expect(syntheticBuildingSway(10, 'strong')).toBe(0);
  });
});
