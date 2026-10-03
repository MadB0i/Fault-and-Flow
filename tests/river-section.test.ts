import { describe, expect, it } from 'vitest';
import { readRiverSection } from '../src/engine/water/section.js';

describe('river section from actual solver readback', () => {
  const sim = {
    width: 4,
    height: 32,
    dxM: 10,
    dyM: 20,
    heights: new Float32Array(128).fill(100),
    noData: new Uint8Array(128),
  };
  const bbox = { west: 90, east: 94, north: 28, south: 24 };
  const rgba = () => {
    const buffer = new Float32Array(128 * 4);
    for (let i = 0; i < 128; i++) buffer[i * 4] = 100;
    buffer[(16 * 4 + 2) * 4 + 1] = 3;
    return buffer;
  };
  it('maps a north-first column and preserves terrain, water depth and time', () => {
    const result = readRiverSection(sim, rgba(), bbox, 0.5, 12)!;
    expect(result.longitude).toBe(92.5);
    expect(result.northLatitude).toBeGreaterThan(result.southLatitude);
    expect(result.samples).toHaveLength(25);
    expect(result.samples[12]).toEqual({ distanceM: 240, terrainM: 100, depthM: 3 });
    expect(result.simTimeS).toBe(12);
  });
  it('does not fabricate a section for a dry column or invalid buffer', () => {
    expect(readRiverSection(sim, rgba(), bbox, 0.1, 0)).toBeNull();
    expect(readRiverSection(sim, new Float32Array(2), bbox, 0.5, 0)).toBeNull();
    expect(readRiverSection(sim, rgba(), bbox, NaN, 0)).toBeNull();
  });
  it('preserves missing samples as gaps instead of joining them to zero', () => {
    const buffer = rgba();
    buffer[(15 * 4 + 2) * 4] = NaN;
    const result = readRiverSection(sim, buffer, bbox, 0.5, 0)!;
    expect(result.samples[11]).toEqual({ distanceM: 220, terrainM: null, depthM: null });
  });
});
