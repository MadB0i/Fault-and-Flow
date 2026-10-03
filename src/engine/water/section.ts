import type { RiverSection } from '../../shared/atlas.js';
import type { SimGrid } from './channel.js';

/** A north-to-south slice of actual GPU readback, centred on its deepest wet cell.
 * Heights are the solver's resampled DEM, never invented bathymetry or geology. */
export function readRiverSection(
  sim: SimGrid,
  rgba: Float32Array,
  bbox: { west: number; east: number; north: number; south: number },
  position: number,
  simTimeS: number,
): RiverSection | null {
  if (!Number.isFinite(position) || rgba.length !== sim.width * sim.height * 4)
    return null;
  const x = Math.min(sim.width - 1, Math.max(0, Math.floor(position * sim.width)));
  let centre = -1;
  let deepest = 0.02;
  for (let y = 0; y < sim.height; y++) {
    const i = y * sim.width + x;
    const depth = rgba[i * 4 + 1]!;
    if (!sim.noData[i] && Number.isFinite(depth) && depth > deepest) {
      deepest = depth;
      centre = y;
    }
  }
  if (centre < 0) return null;
  const first = Math.max(0, centre - 12);
  const last = Math.min(sim.height - 1, centre + 12);
  const samples = [];
  for (let y = first; y <= last; y++) {
    const i = y * sim.width + x;
    const h = rgba[i * 4]!;
    const d = rgba[i * 4 + 1]!;
    const valid = !sim.noData[i] && Number.isFinite(h) && Number.isFinite(d) && d >= 0;
    samples.push({
      distanceM: (y - first) * sim.dyM,
      terrainM: valid ? h : null,
      depthM: valid ? d : null,
    });
  }
  const latitude = (y: number) =>
    bbox.north - ((y + 0.5) / sim.height) * (bbox.north - bbox.south);
  return {
    longitude: bbox.west + ((x + 0.5) / sim.width) * (bbox.east - bbox.west),
    northLatitude: latitude(first),
    southLatitude: latitude(last),
    simTimeS,
    samples,
  };
}
