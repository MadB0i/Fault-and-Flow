/** Illustrative initial river depth, on the unchanged DEM. Never observed water. */
import type { SimGrid } from './channel.js';
import type { Bbox } from '../terrain/sidecar.js';

export function seedRiverScenario(
  sim: SimGrid,
  bbox: Bbox,
  rivers: readonly { coordinates: readonly (readonly number[])[] }[],
  scenarioDepthM: number,
): Float32Array {
  const depth = new Float32Array(sim.width * sim.height);
  const level = Math.max(0, Math.min(8, scenarioDepthM));
  if (!level) return depth;
  const cells = new Set<number>();
  for (const river of rivers) {
    for (let i = 1; i < river.coordinates.length; i++) {
      const a = river.coordinates[i - 1]!;
      const b = river.coordinates[i]!;
      const ax = ((a[0]! - bbox.west) / (bbox.east - bbox.west)) * sim.width;
      const ay = ((bbox.north - a[1]!) / (bbox.north - bbox.south)) * sim.height;
      const bx = ((b[0]! - bbox.west) / (bbox.east - bbox.west)) * sim.width;
      const by = ((bbox.north - b[1]!) / (bbox.north - bbox.south)) * sim.height;
      const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay)));
      for (let s = 0; s <= steps; s++) {
        const x = Math.floor(ax + ((bx - ax) * s) / steps);
        const y = Math.floor(ay + ((by - ay) * s) / steps);
        if (x >= 0 && y >= 0 && x < sim.width && y < sim.height)
          cells.add(y * sim.width + x);
      }
    }
  }
  for (const cell of cells) {
    const h = sim.heights[cell]!;
    if (!Number.isFinite(h) || sim.noData[cell]) continue;
    const cx = cell % sim.width;
    const cy = Math.floor(cell / sim.width);
    // A local initial condition, not an inundation prediction: at most two
    // neighbouring cells from mapped centreline, then the solver takes over.
    for (let dy = -2; dy <= 2; dy++)
      for (let dx = -2; dx <= 2; dx++) {
        const x = cx + dx;
        const y = cy + dy;
        if (x < 0 || y < 0 || x >= sim.width || y >= sim.height) continue;
        const j = y * sim.width + x;
        const d = h + level - sim.heights[j]!;
        if (!sim.noData[j] && Number.isFinite(d) && d > 0 && d <= level)
          depth[j] = Math.max(depth[j]!, d);
      }
  }
  return depth;
}
