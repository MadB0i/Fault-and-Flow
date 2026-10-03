/** Refresh only the historical USGS extract. Never reuse cached network bytes. */
import { readFile, writeFile, rename } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { format, resolveConfig } from 'prettier';

const root = resolve(import.meta.dirname, '..');
const file = resolve(root, 'src/data/earthquakes.json');
const previous = JSON.parse(await readFile(file, 'utf8'));
// UTC midnight: a clear historical cutoff, without claiming the current day is complete.
const cutoff = new Date().toISOString().slice(0, 10);
const url = new URL('https://earthquake.usgs.gov/fdsnws/event/1/query');
for (const [key, value] of Object.entries({
  format: 'geojson',
  starttime: previous.start,
  endtime: cutoff,
  minlatitude: previous.bbox[1],
  maxlatitude: previous.bbox[3],
  minlongitude: previous.bbox[0],
  maxlongitude: previous.bbox[2],
  minmagnitude: previous.minMagnitude,
  orderby: 'time-asc',
}))
  url.searchParams.set(key, String(value));
const response = await fetch(url, { signal: AbortSignal.timeout(90000) });
if (!response.ok)
  throw new Error(`USGS refresh failed (${response.status}); snapshot retained.`);
const raw = await response.text();
const source = JSON.parse(raw);
if (
  source.type !== 'FeatureCollection' ||
  !Array.isArray(source.features) ||
  !source.features.length ||
  source.features.length >= 20000
)
  throw new Error('Incomplete or invalid USGS response; snapshot retained.');
const ids = new Set();
const events = source.features.map((f) => {
  const [longitude, latitude, depthKm] = f.geometry?.coordinates ?? [];
  const {
    mag: magnitude,
    magType: magnitudeType,
    time,
    url: recordUrl,
  } = f.properties ?? {};
  if (
    !f.id ||
    ids.has(f.id) ||
    ![longitude, latitude, depthKm, magnitude, time].every(Number.isFinite) ||
    longitude < previous.bbox[0] ||
    longitude > previous.bbox[2] ||
    latitude < previous.bbox[1] ||
    latitude > previous.bbox[3] ||
    magnitude < previous.minMagnitude ||
    time < Date.parse(previous.start) ||
    time > Date.parse(cutoff) ||
    typeof recordUrl !== 'string' ||
    !recordUrl.startsWith('https://earthquake.usgs.gov/') ||
    typeof magnitudeType !== 'string'
  )
    throw new Error('Invalid USGS event; snapshot retained.');
  ids.add(f.id);
  return {
    id: f.id,
    time: new Date(time).toISOString(),
    latitude,
    longitude,
    depthKm,
    magnitude,
    magnitudeType,
    url: recordUrl,
  };
});
const snapshot = {
  ...previous,
  retrieved: cutoff,
  cutoff,
  source: { url: url.href, sha256: createHash('sha256').update(raw).digest('hex') },
  events,
};
const formatted = await format(JSON.stringify(snapshot), {
  ...(await resolveConfig(root)),
  parser: 'json',
});
// Only replace the last good snapshot after the entire response passes validation.
await writeFile(file + '.tmp', formatted);
await rename(file + '.tmp', file);
console.log(
  `USGS: ${events.length} M${previous.minMagnitude}+ records through ${cutoff} UTC. No forecasts.`,
);
