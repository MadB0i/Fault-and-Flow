/** Small ODbL extract: relation names and their actual OSM admin_centre nodes. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { format, resolveConfig } from 'prettier';
const root = resolve(import.meta.dirname, '..');
const cache = resolve(root, '.cache/atlas');
await mkdir(cache, { recursive: true });
// Relation IDs discovered in the OSM community index; the data comes from OSM API.
const ids = [
  16701825, 16701845, 16702229, 16704179, 1789229, 1791154, 1791158, 1791238, 1791255,
  1791256, 2025887, 2025888, 2025921, 2025924, 2025931, 2025971, 2025972, 2026004,
  2026005, 2026041, 2026354, 2026355, 2026356, 2026407, 2026439, 2026441, 2026443,
  9521247, 9521299, 9521466, 9521711, 9521712, 9521812, 9521878, 9522272,
].sort((a, b) => String(a).localeCompare(String(b)));
const sources = [];
const previous = JSON.parse(
  await readFile(resolve(root, 'src/data/districts.json'), 'utf8').catch(() => '{}'),
);
const today = new Date().toISOString().slice(0, 10);
async function source(url, file) {
  const path = resolve(cache, file);
  let raw = await readFile(path, 'utf8').catch(() => null);
  const cached = raw !== null;
  if (!raw) {
    const response = await fetch(url, { signal: AbortSignal.timeout(45000) });
    if (!response.ok) throw new Error(`OSM extraction failed: ${response.status}`);
    raw = await response.text();
    JSON.parse(raw);
    await writeFile(path, raw);
  }
  sources.push({
    url,
    retrieved: cached
      ? (previous.sources?.find((s) => s.url === url)?.retrieved ??
        previous.retrieved ??
        today)
      : today,
    sha256: createHash('sha256').update(raw).digest('hex'),
  });
  return JSON.parse(raw).elements;
}
const relations = await source(
  `https://api.openstreetmap.org/api/0.6/relations.json?relations=${ids.join(',')}`,
  'osm-district-relations.json',
);
const centres = relations.map(
  (r) => r.members.find((m) => m.type === 'node' && m.role === 'admin_centre')?.ref,
);
if (relations.length !== 35 || centres.some((n) => !n))
  throw new Error('Expected all 35 sourced districts and admin centres.');
const nodeIds = [...new Set(centres)].sort((a, b) => a - b);
const nodes = await source(
  `https://api.openstreetmap.org/api/0.6/nodes.json?nodes=${nodeIds.join(',')}`,
  'osm-district-centres.json',
);
const districts = relations
  .map((r) => {
    const node = nodes.find(
      (n) =>
        n.id ===
        r.members.find((m) => m.type === 'node' && m.role === 'admin_centre').ref,
    );
    if (
      !node ||
      !Number.isFinite(node.lon) ||
      !Number.isFinite(node.lat) ||
      r.tags.admin_level !== '5'
    )
      throw new Error('Invalid district anchor.');
    // Official names checked against Assam government, including the Sribhumi rename.
    const name =
      r.id === 2026005
        ? 'Sribhumi'
        : r.id === 2025921
          ? 'Morigaon'
          : r.tags.name.replace(/ district$/i, '');
    return {
      id: r.id,
      version: r.version,
      name,
      sourceName: r.tags.name,
      nameAs: r.id === 2026005 ? '' : (r.tags['name:as'] ?? ''),
      longitude: node.lon,
      latitude: node.lat,
      anchor: 'OSM admin_centre',
      nodeId: node.id,
      nodeVersion: node.version,
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name, 'en'));
const extract = {
  retrieved: sources
    .map((s) => s.retrieved)
    .sort()
    .at(-1),
  attribution: '© OpenStreetMap contributors',
  license: 'https://opendatacommons.org/licenses/odbl/1-0/',
  licenseStatement:
    'OpenStreetMap is open data, licensed under the Open Data Commons Open Database License (ODbL) by the OpenStreetMap Foundation (OSMF).',
  licenseSource: 'https://www.openstreetmap.org/copyright',
  nameReferences: [
    'https://hojai.assam.gov.in/information-and-services/districts-assam',
    'https://sribhumi.assam.gov.in/about-district/district-glance',
  ],
  indexReference: 'https://wiki.openstreetmap.org/wiki/Districts_in_Assam',
  sources,
  districts,
};
await writeFile(
  resolve(root, 'src/data/districts.json'),
  await format(JSON.stringify(extract), {
    ...(await resolveConfig(root)),
    parser: 'json',
  }),
);
console.log(
  `Extracted ${districts.length} district names at sourced administration centres.`,
);
