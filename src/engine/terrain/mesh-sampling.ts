import { sampleBilinear } from './sampling.js';

/** Match the two triangles of PlaneGeometry, rather than the full DEM between vertices. */
export function sampleMeshSurface(
  heights: ArrayLike<number>,
  noData: ArrayLike<number>,
  meta: { width: number; height: number },
  u: number,
  v: number,
  segments: number,
): number | null {
  if (
    !Number.isFinite(u) ||
    !Number.isFinite(v) ||
    u < 0 ||
    u > 1 ||
    v < 0 ||
    v > 1 ||
    !Number.isInteger(segments) ||
    segments < 1
  )
    return null;
  const x = Math.min(segments - 1, Math.floor(u * segments));
  const y = Math.min(segments - 1, Math.floor(v * segments));
  const fx = u * segments - x;
  const fy = v * segments - y;
  const at = (dx: number, dy: number) => {
    const sample = sampleBilinear(
      heights,
      noData,
      meta,
      (x + dx) / segments,
      (y + dy) / segments,
    );
    return sample.noData ? null : sample.elevationM;
  };
  // PlaneGeometry's diagonal joins north-east and south-west.
  const taps =
    fx + fy <= 1
      ? [
          [at(0, 0), 1 - fx - fy],
          [at(1, 0), fx],
          [at(0, 1), fy],
        ]
      : [
          [at(1, 1), fx + fy - 1],
          [at(1, 0), 1 - fy],
          [at(0, 1), 1 - fx],
        ];
  if (taps.some(([height, weight]) => height === null && weight! > 1e-10)) return null;
  return taps.reduce((sum, [height, weight]) => sum + (height ?? 0) * weight!, 0);
}
