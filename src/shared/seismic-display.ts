/** Presentation bands for catalogue magnitudes; never local hazard or intensity. */
export function magnitudeBand(
  magnitude: number | null,
): 'amber' | 'light' | 'red' | 'unknown' {
  if (magnitude === null || !Number.isFinite(magnitude)) return 'unknown';
  return magnitude >= 7 ? 'red' : magnitude >= 6 ? 'light' : 'amber';
}

/** Symbol radius in CSS pixels, chosen for legibility rather than physical size. */
export function magnitudeRadius(magnitude: number | null): number {
  if (magnitude === null || !Number.isFinite(magnitude)) return 4;
  return Math.max(4, Math.min(9, 4 + (magnitude - 5) * 1.4));
}

/** Original animation in normalised diagram units, not simulated building response. */
export function syntheticBuildingSway(
  age: number,
  strength: 'gentle' | 'medium' | 'strong',
): number {
  if (age < 0 || age >= 4) return 0;
  const amplitude = { gentle: 0.012, medium: 0.035, strong: 0.065 }[strength];
  return Math.sin(age * 15) * Math.sin((Math.PI * age) / 4) * amplitude;
}
