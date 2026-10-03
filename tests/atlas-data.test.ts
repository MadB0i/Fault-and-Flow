import { describe, expect, it } from 'vitest';
import geography from '../src/data/geography.json';
import catalogue from '../src/data/earthquakes.json';
import { ATLAS_COPY } from '../src/shared/i18n/atlas.js';
import { seedRiverScenario } from '../src/engine/water/scenario.js';

describe('cited atlas extracts', () => {
  it('keeps real events within the documented time, area and magnitude subset', () => {
    expect(catalogue.events.length).toBeGreaterThan(0);
    expect(new Set(catalogue.events.map((e) => e.id)).size).toBe(catalogue.events.length);
    for (const e of catalogue.events) {
      expect(e.magnitude).toBeGreaterThanOrEqual(catalogue.minMagnitude);
      expect(e.longitude).toBeGreaterThanOrEqual(catalogue.bbox[0]!);
      expect(e.longitude).toBeLessThanOrEqual(catalogue.bbox[2]!);
      expect(e.latitude).toBeGreaterThanOrEqual(catalogue.bbox[1]!);
      expect(e.latitude).toBeLessThanOrEqual(catalogue.bbox[3]!);
      expect(Date.parse(e.time)).toBeGreaterThanOrEqual(Date.parse(catalogue.start));
      expect(Date.parse(e.time)).toBeLessThanOrEqual(Date.parse(catalogue.cutoff));
      expect(e.url).toMatch(/^https:\/\/earthquake\.usgs\.gov\//);
    }
  });
  it('retains source hashes and pinned map provenance', () => {
    for (const source of [...geography.sources, catalogue.source])
      expect(source.sha256).toMatch(/^[a-f0-9]{64}$/);
    for (const source of geography.sources)
      expect(source.url).toContain(geography.revision);
    expect(geography.rivers.some((r) => r.name === 'Brahmaputra')).toBe(true);
    expect(geography.boundaries.some((r) => r.name === 'Assam')).toBe(true);
  });
  it('provides both languages for every atlas string', () => {
    expect(Object.keys(ATLAS_COPY.as).sort()).toEqual(Object.keys(ATLAS_COPY.en).sort());
    for (const value of Object.values(ATLAS_COPY.as)) expect(value.trim()).not.toBe('');
  });
});

describe('illustrative river starting condition', () => {
  const bbox = { west: 0, east: 1, south: 0, north: 1 };
  const river = [
    {
      coordinates: [
        [0, 0.5],
        [1, 0.5],
      ],
    },
  ];
  const make = () => ({
    width: 16,
    height: 16,
    dxM: 10,
    dyM: 10,
    heights: new Float32Array(256).fill(100),
    noData: new Uint8Array(256),
  });
  it('seeds mapped river cells, respects missing data and leaves terrain unchanged', () => {
    const sim = make();
    sim.noData[8 * 16 + 8] = 1;
    sim.heights[8 * 16 + 8] = NaN;
    const before = sim.heights.slice();
    const depth = seedRiverScenario(sim, bbox, river, 2);
    expect(depth[8 * 16 + 8]).toBe(0);
    expect(depth[8 * 16 + 2]).toBe(2);
    expect(depth[0]).toBe(0);
    expect(sim.heights).toEqual(before);
    expect([...depth].every((d) => Number.isFinite(d) && d >= 0 && d <= 2)).toBe(true);
  });
  it('starts dry at zero depth, without a mapped river, or for invalid input', () => {
    for (const d of [0, -1, NaN])
      expect([...seedRiverScenario(make(), bbox, river, d)].every((v) => v === 0)).toBe(
        true,
      );
    expect([...seedRiverScenario(make(), bbox, [], 2)].every((v) => v === 0)).toBe(true);
  });
  it('does not place water across high banks or outside the map', () => {
    const sim = make();
    sim.heights[7 * 16 + 4] = 150;
    expect(seedRiverScenario(sim, bbox, river, 2)[7 * 16 + 4]).toBe(0);
    expect(
      [
        ...seedRiverScenario(
          sim,
          bbox,
          [
            {
              coordinates: [
                [2, 2],
                [3, 3],
              ],
            },
          ],
          2,
        ),
      ].every((v) => v === 0),
    ).toBe(true);
  });
});
