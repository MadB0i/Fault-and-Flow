/** Geographic distances are derived from catalogue coordinates, not hazard estimates. */
export function distanceKm(
  a: { longitude: number; latitude: number },
  b: { longitude: number; latitude: number },
): number {
  const radians = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * radians;
  const dLon = (b.longitude - a.longitude) * radians;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.latitude * radians) *
      Math.cos(b.latitude * radians) *
      Math.sin(dLon / 2) ** 2;
  // NASA NSSDCA Earth Fact Sheet: volumetric mean radius 6371.000 km.
  // https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html (2026-10-03)
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))));
}

export function nearestRecords<
  T extends { longitude: number; latitude: number; id: string },
>(
  anchor: { longitude: number; latitude: number },
  records: readonly T[],
  limit = 5,
): { record: T; distance: number }[] {
  return records
    .map((record) => ({ record, distance: distanceKm(anchor, record) }))
    .sort((a, b) => a.distance - b.distance || a.record.id.localeCompare(b.record.id))
    .slice(0, Math.max(0, limit));
}

/** A 44 CSS pixel picking target; the closest visible symbol wins. */
export function pickRecord(
  point: { x: number; y: number },
  records: readonly { id: string; x: number; y: number }[],
): string | null {
  let result: string | null = null;
  let distance = 22;
  for (const record of records) {
    const d = Math.hypot(record.x - point.x, record.y - point.y);
    if (d <= distance) {
      distance = d;
      result = record.id;
    }
  }
  return result;
}
