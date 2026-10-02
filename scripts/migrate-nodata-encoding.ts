/**
 * One-off: migrate the committed Terrain-RGB artefacts to the fixed no-data encoding.
 *
 * Run once, on 2026-10-02. Never needs to run again — and this file is kept, not
 * deleted, because a migration nobody can inspect is indistinguishable from a
 * fabricated dataset.
 *
 *   npm run data:dem:migrate
 *
 * ## Why this exists rather than a rebuild
 *
 * The encoding had a collision. Code 0 was reserved for no-data while `offset`
 * was the minimum elevation, so a real pixel sitting at that minimum encoded to
 * the same code the decoder reads as "hole" — 1,938 cells on Majuli and 49 on
 * the overview (`DECISIONS.md` §9). `offsetFor` now returns
 * `floor(minElevation) - step`, which keeps code 0 out of reach of real data.
 *
 * Fixing it properly means re-running `npm run data:dem`, which reads 46
 * Copernicus COG tiles over HTTP. **That was not done.** Instead this script
 * transforms the committed bytes, and does so losslessly:
 *
 *     every code      += 1
 *     sidecar offset  -= step
 *
 * which is exactly invertible, because decoding is `code * step + offset`:
 *
 *     old: c*step + O            new: (c+1)*step + (O-step) = c*step + O
 *
 * So no pixel's elevation moves by even one floating-point ULP. What does change
 * is what code 0 *means*: previously it was ambiguous between "no data" and
 * "exactly at the minimum elevation", and it now means only "no data".
 *
 * ## Why the holes become code 1
 *
 * Those 1,987 pixels were real measurements that the old decoder was discarding.
 * Their elevation was `oldOffset` — that is precisely what code 0 decoded to.
 * Migrating them to code 1 under the new offset decodes them back to
 * `1*step + (O-step) = O`, the same value. The terrain comes back; only the
 * ambiguity goes away. A pixel with a genuinely unknown elevation is still
 * written as code 0 by the pipeline and still decodes to `NaN`.
 *
 * ## The one precondition that can invalidate this
 *
 * The migration is only lossless if **every code-0 pixel in the committed file
 * was a real measurement at the minimum elevation**, i.e. if the source tiles
 * contributed no genuine no-data. The sidecars record `noDataPixels` (output
 * coverage gaps) and `sourceNoDataPixels` (source sentinel hits); both must be 0.
 *
 * If either is non-zero, this script **stops and reports** rather than guessing.
 * A genuine hole would be indistinguishable from the collision after the fact,
 * and silently promoting it to code 1 would invent terrain out of nothing — the
 * exact failure `AGENTS.md` §6 exists to prevent.
 *
 * ## What is NOT verified
 *
 * Byte-identical reproducibility. `npm run data:dem` was **not** re-run against
 * the fixed encoding, so it is unverified that rebuilding from source produces
 * these exact bytes. The PNG writer here is the same `PNG.sync.write` call the
 * pipeline makes with the same options, which is the strongest claim available
 * without network access. Recorded in `docs/DATA.md` §13 and tracked as an
 * unchecked item in `docs/ROADMAP.md` phase 2.
 */

import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { PNG } from 'pngjs';

import { decodePng } from '../src/engine/terrain/decode-terrain.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'data', 'processed');

const AREAS = ['assam-overview', 'majuli', 'sadiya-dibrugarh'] as const;

/** The date this migration ran. Recorded in the artefacts, not left implicit. */
const MIGRATION_DATE = '2026-10-02';

const sha256 = (bytes: Uint8Array): string =>
  createHash('sha256').update(bytes).digest('hex');

type Sidecar = {
  encoding: { step: number; offset: number; noDataCode: number; note: string };
  noDataPixels: number;
  sourceNoDataPixels: number;
  [key: string]: unknown;
};

type Manifest = {
  areas: { id: string; outputs: { file: string; bytes: number; sha256: string }[] }[];
  [key: string]: unknown;
};

/**
 * Write Terrain-RGB as a colour-type-2 PNG.
 *
 * Byte-for-byte the same call and options as `encodePng` in `scripts/build-dem.ts`.
 * Kept duplicated rather than imported for two reasons: `build-dem.ts` runs
 * `main()` on import, and a byte-differing encoder would silently break the
 * reproducibility claim this migration rests on. `tests/dem-artifacts.test.ts`
 * asserts the committed files decode as colour type 2, which is the property that
 * actually matters.
 */
function encodePng(rgb: Uint8Array, width: number, height: number): Buffer {
  if (rgb.length !== width * height * 3) {
    throw new RangeError(`expected ${width * height * 3} RGB bytes, got ${rgb.length}`);
  }
  const png = new PNG({ width, height, colorType: 2, inputHasAlpha: false });
  png.data.set(rgb);
  return PNG.sync.write(png, { colorType: 2, inputHasAlpha: false });
}

interface AreaResult {
  id: string;
  /** Pixels that were code 0 in the committed file: real terrain, not holes. */
  recovered: number;
  /** Pixels still code 0 after migration. Must be 0 — there was nothing genuine to keep. */
  stillNoData: number;
  pixels: number;
  oldOffset: number;
  newOffset: number;
  step: number;
  /**
   * Pixels whose DELIVERED (float32) elevation moved. Must be 0.
   *
   * Not the same question as "did the float64 expression change": the decoder
   * stores into a Float32Array, so a float64 ULP that vanishes on narrowing is
   * not a change to any value the project reads.
   */
  drifted: number;
  /** Worst relative float64 deviation between the two algebraically equal forms. */
  maxRelativeDeviation: number;
  maxCodeBefore: number;
  maxCodeAfter: number;
}

async function migrateArea(id: string): Promise<AreaResult> {
  const pngPath = path.join(OUT_DIR, `${id}.png`);
  const jsonPath = path.join(OUT_DIR, `${id}.json`);

  const originalPng = await readFile(pngPath);
  const decoded = await decodePng(new Uint8Array(originalPng));
  const sidecar = JSON.parse(await readFile(jsonPath, 'utf8')) as Sidecar;
  const { step, offset: oldOffset, noDataCode } = sidecar.encoding;

  // --- Precondition: the source contributed no genuine no-data ---------------
  // Without this the migration cannot tell a discarded measurement from a real
  // hole, and would be inventing terrain. Stop rather than guess.
  if (sidecar.noDataPixels !== 0 || sidecar.sourceNoDataPixels !== 0) {
    throw new Error(
      `${id}: cannot migrate — sidecar reports noDataPixels=${sidecar.noDataPixels} ` +
        `sourceNoDataPixels=${sidecar.sourceNoDataPixels}. A code-0 pixel might be a genuine ` +
        `hole, and promoting it to code 1 would invent terrain. Rebuild from source instead.`,
    );
  }
  if (noDataCode !== 0) {
    throw new Error(
      `${id}: expected the reserved no-data code to be 0, sidecar says ${noDataCode}`,
    );
  }

  const newOffset = oldOffset - step;
  const { width, height } = decoded;
  const pixels = width * height;

  const rgb = new Uint8Array(pixels * 3);
  let recovered = 0;
  let drifted = 0;
  let maxRelativeDeviation = 0;
  let maxCodeBefore = 0;

  for (let i = 0; i < pixels; i++) {
    const o = i * 4;
    const code =
      (decoded.rgba[o]! << 16) | (decoded.rgba[o + 1]! << 8) | decoded.rgba[o + 2]!;
    if (code > maxCodeBefore) maxCodeBefore = code;
    if (code === 0) recovered++;

    // Losslessness, checked per pixel rather than argued in a comment.
    //
    // Old decode: code*step + oldOffset. New decode: (code+1)*step + newOffset.
    // Algebraically identical, but floating-point multiplication is not
    // associative, so the two float64 expressions can differ by an ULP. What
    // matters is the value the DECODER delivers, and it is stored into a
    // Float32Array — so the comparison that matters is at float32, where the
    // arithmetic is exact. The float64 deviation is measured and reported rather
    // than assumed, because "no pixel changed elevation" should be a number.
    //
    // Measured: 0 pixels differ at float32; the worst float64 deviation is ~2.2e-16
    // relative, one ULP, on codes where (code+1)*step rounds down and the
    // subtraction rounds differently.
    const before = code * step + oldOffset;
    const after = (code + 1) * step + newOffset;
    if (Math.fround(after) !== Math.fround(before)) drifted++;
    const relative = Math.abs(after - before) / Math.max(1, Math.abs(before));
    if (relative > maxRelativeDeviation) maxRelativeDeviation = relative;

    // Adding 1 must not overflow 16 bits. It cannot here, but "cannot" is only
    // true for these files, and the check is the point.
    const next = code + 1;
    if (next > 0xffff) {
      throw new RangeError(
        `${id}: code ${code} at pixel ${i} would overflow 16 bits when incremented.`,
      );
    }

    const p = i * 3;
    rgb[p] = (next >> 16) & 0xff;
    rgb[p + 1] = (next >> 8) & 0xff;
    rgb[p + 2] = next & 0xff;
  }

  if (recovered === 0 && pixels > 0) {
    // Not an error: sadiya-dibrugarh never collided. Logged so the asymmetry is
    // visible in the output rather than looking like a missed migration.
    console.log(`  ${id}: no code-0 pixels; encoding shifted but no terrain recovered`);
  }

  const pngBytes = encodePng(rgb, width, height);

  // --- Sidecar ---------------------------------------------------------------
  const migrated: Sidecar = {
    ...sidecar,
    encoding: {
      ...sidecar.encoding,
      offset: newOffset,
      note:
        'code = round((elevation - offset) / step); no-data is code 0, and offset is one ' +
        'step below the lowest elevation so no real measurement can reach code 0',
    },
    migration: {
      date: MIGRATION_DATE,
      script: 'scripts/migrate-nodata-encoding.ts',
      change:
        'every Terrain-RGB code incremented by 1 and encoding.offset reduced by one step, ' +
        'which is exactly invertible: (c+1)*step + (O-step) === c*step + O',
      reason:
        'the previous offset was the minimum elevation, so cells at that minimum encoded to ' +
        'code 0 and read back as no-data',
      pixelsRecoveredAsTerrain: recovered,
      maxCode: maxCodeBefore + 1,
      pipelineRebuilt: false,
      reproducibilityVerified: false,
      note:
        'npm run data:dem was NOT re-run against this encoding. Byte-identical rebuild from ' +
        'source is therefore unverified; see docs/DATA.md section 13 and docs/ROADMAP.md phase 2.',
    },
  };
  const jsonBytes = Buffer.from(`${JSON.stringify(migrated, null, 2)}\n`, 'utf8');

  await writeFile(pngPath, pngBytes);
  await writeFile(jsonPath, jsonBytes);

  return {
    id,
    recovered,
    stillNoData: 0,
    pixels,
    oldOffset,
    newOffset,
    step,
    drifted,
    maxRelativeDeviation,
    maxCodeBefore,
    maxCodeAfter: maxCodeBefore + 1,
  };
}

async function main(): Promise<void> {
  console.log(
    'Migrating the committed Terrain-RGB artefacts to the fixed no-data encoding.\n' +
      'Lossless: code += 1, offset -= step. No source tiles are read.\n',
  );

  const results: AreaResult[] = [];
  for (const id of AREAS) {
    results.push(await migrateArea(id));
  }

  // --- Manifest ---------------------------------------------------------------
  const manifestPath = path.join(OUT_DIR, 'manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as Manifest;

  for (const area of manifest.areas) {
    const result = results.find((r) => r.id === area.id);
    if (!result) continue;
    for (const output of area.outputs) {
      const bytes = await readFile(path.join(OUT_DIR, output.file));
      output.bytes = bytes.byteLength;
      output.sha256 = sha256(bytes);
    }
  }

  const migrated = {
    date: MIGRATION_DATE,
    script: 'scripts/migrate-nodata-encoding.ts',
    change: 'encoding.offset lowered by one step per area; every code incremented by 1',
    lossless: true,
    pipelineRebuilt: false,
    reproducibilityVerified: false,
    note:
      'npm run data:dem was NOT re-run against this encoding, so byte-identical rebuild from ' +
      'source is unverified. See docs/DATA.md section 13.',
  };
  await writeFile(
    manifestPath,
    `${JSON.stringify({ ...manifest, migration: migrated }, null, 2)}\n`,
    'utf8',
  );

  // --- Report -----------------------------------------------------------------
  console.log('Per-area results:\n');
  console.log('  area                px        offset          recovered  moved');
  for (const r of results) {
    console.log(
      `  ${r.id.padEnd(18)} ${String(r.pixels).padStart(8)}  ` +
        `${String(r.oldOffset).padStart(5)} -> ${String(r.newOffset).padEnd(5)} ` +
        `${String(r.recovered).padStart(9)}  ${String(r.drifted).padStart(5)}`,
    );
  }

  const totalRecovered = results.reduce((a, r) => a + r.recovered, 0);
  const totalDrifted = results.reduce((a, r) => a + r.drifted, 0);
  const worstDeviation = Math.max(...results.map((r) => r.maxRelativeDeviation));

  console.log(`\nTerrain recovered from discarded code-0 pixels:  ${totalRecovered}`);
  console.log(`Pixels whose delivered elevation moved:          ${totalDrifted}`);
  console.log(
    `Worst float64 deviation between the two forms:    ${worstDeviation.toExponential(2)} rel`,
  );
  console.log(
    `  (one ULP, and it vanishes on narrowing to the float32 the decoder stores)`,
  );
  console.log(`Manifest hashes rewritten for ${results.length} area(s).`);

  if (totalDrifted > 0) {
    console.error(
      '\nFAIL: some pixels changed elevation. The migration is only valid if this is 0.',
    );
    process.exitCode = 1;
    return;
  }

  console.log(
    '\nEvery pixel decodes to the elevation it decoded to before, and code 0 now\n' +
      'means only no-data.\n\n' +
      'NOT verified: byte-identical rebuild from source. npm run data:dem was not re-run.',
  );
}

await main();
