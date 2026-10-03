/** Reproducible small atlas extracts. Downloads stay in this repository's D: cache. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { format, resolveConfig } from 'prettier';

const root = resolve(import.meta.dirname, '..');
const cache = resolve(root, '.cache/atlas');
const out = resolve(root, 'src/data');
await mkdir(cache, { recursive: true });
await mkdir(out, { recursive: true });
// Cached source bytes retain their original retrieval day. A clean network
// fetch receives today's date rather than claiming the snapshot's old date.
const previousGeography = JSON.parse(
  await readFile(resolve(out, 'geography.json'), 'utf8').catch(
    () => '{"retrieved":null}',
  ),
);
const previousHistory = JSON.parse(
  await readFile(resolve(out, 'earthquakes.json'), 'utf8').catch(
    () => '{"retrieved":null}',
  ),
);
const today = new Date().toISOString().slice(0, 10);
let mapFetched = false;
let historyFetched = false;
const formatting = await resolveConfig(root);
async function writeJson(name, data) {
  await writeFile(
    resolve(out, name),
    await format(JSON.stringify(data), { ...formatting, parser: 'json' }),
  );
}
const bbox = [89.5, 24, 96.5, 28.5];
async function fetchJson(url, name) {
  const file = resolve(cache, name);
  let raw;
  try {
    raw = await readFile(file, 'utf8');
  } catch {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`${r.status}: ${url}`);
    raw = await r.text();
    if (name === 'comcat-history.json') historyFetched = true;
    else mapFetched = true;
    JSON.parse(raw);
    await writeFile(file, raw);
  }
  return {
    data: JSON.parse(raw),
    sha256: createHash('sha256').update(raw).digest('hex'),
    url,
  };
}
const revision = 'ca96624a56bd078437bca8184e78163e5039ad19';
const base = `https://raw.githubusercontent.com/nvkelso/natural-earth-vector/${revision}/geojson/`;
const names = [
  'ne_10m_rivers_lake_centerlines',
  'ne_10m_admin_1_states_provinces',
  'ne_10m_populated_places',
];
const [rivers, states, places] = await Promise.all(
  names.map((n) => fetchJson(base + n + '.geojson', n + '.json')),
);
const inside = ([x, y]) => x >= bbox[0] && x <= bbox[2] && y >= bbox[1] && y <= bbox[3];
const round = (p) => p.slice(0, 2).map((v) => Math.round(v * 1e5) / 1e5);
function lines(geometry) {
  if (geometry.type === 'LineString') return [geometry.coordinates];
  if (geometry.type === 'MultiLineString' || geometry.type === 'Polygon')
    return geometry.coordinates;
  if (geometry.type === 'MultiPolygon') return geometry.coordinates.flat();
  return [];
}
// Keep actual segments; do not connect separate clipped pieces across the map.
function crop(line) {
  const chunks = [];
  let chunk = [];
  for (const point of line) {
    if (inside(point)) chunk.push(round(point));
    else {
      if (chunk.length > 1) chunks.push(chunk);
      chunk = [];
    }
  }
  if (chunk.length > 1) chunks.push(chunk);
  return chunks;
}
const geography = {
  retrieved: mapFetched ? today : (previousGeography.retrieved ?? today),
  bbox,
  revision,
  sources: [rivers, states, places].map(({ url, sha256 }) => ({ url, sha256 })),
  rivers: rivers.data.features.flatMap((f) =>
    lines(f.geometry)
      .flatMap(crop)
      .map((coordinates) => ({ name: f.properties.name ?? '', coordinates })),
  ),
  boundaries: states.data.features
    .filter((f) => f.properties.admin === 'India')
    .flatMap((f) =>
      lines(f.geometry)
        .flatMap(crop)
        .map((coordinates) => ({ name: f.properties.name, coordinates })),
    ),
  places: places.data.features
    .filter((f) => inside(f.geometry.coordinates))
    .map((f) => ({
      name: f.properties.NAME,
      coordinates: round(f.geometry.coordinates),
      rank: f.properties.SCALERANK,
    }))
    .sort((a, b) => a.rank - b.rank)
    .slice(0, 18),
};
await writeJson('geography.json', geography);
const quakeUrl =
  'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=1900-01-01&endtime=2026-10-01&minlatitude=24&maxlatitude=28.5&minlongitude=89.5&maxlongitude=96.5&minmagnitude=5&orderby=time-asc';
const quakes = await fetchJson(quakeUrl, 'comcat-history.json');
const history = {
  retrieved: historyFetched ? today : (previousHistory.retrieved ?? today),
  cutoff: '2026-10-01',
  start: '1900-01-01',
  minMagnitude: 5,
  bbox,
  source: { url: quakeUrl, sha256: quakes.sha256 },
  events: quakes.data.features.map((f) => ({
    id: f.id,
    time: new Date(f.properties.time).toISOString(),
    latitude: f.geometry.coordinates[1],
    longitude: f.geometry.coordinates[0],
    depthKm: f.geometry.coordinates[2],
    magnitude: f.properties.mag,
    magnitudeType: f.properties.magType,
    url: f.properties.url,
  })),
};
await writeJson('earthquakes.json', history);
console.log(
  JSON.stringify(
    {
      revision,
      rivers: geography.rivers.length,
      boundaries: geography.boundaries.length,
      places: geography.places,
      earthquakes: history.events.length,
      largest: [...history.events].sort((a, b) => b.magnitude - a.magnitude).slice(0, 5),
    },
    null,
    2,
  ),
);
