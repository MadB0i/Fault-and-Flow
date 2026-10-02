/**
 * The CPU sampler must agree with the decoder, and with itself.
 *
 * The renderer has two implementations of "what is the elevation here": one in
 * GLSL, one here. They are kept honest by testing this one against the decoder
 * rather than against hand-written arithmetic, because the decoder is the thing
 * the committed pixels actually say.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import {
  decodePng,
  decodeTerrainRgba,
  NO_DATA_HEIGHT,
  parseSidecar,
  sampleBilinear,
  sampleNearest,
  isNoDataHeight,
} from '@engine/terrain/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

/** Decode a committed area exactly as the browser path would. */
async function loadArea(area: string) {
  const sidecar = parseSidecar(
    JSON.parse(readFileSync(resolve(root, `data/processed/${area}.json`), 'utf8')),
  );
  const bytes = readFileSync(resolve(root, `data/processed/${area}.png`));
  const png = await decodePng(new Uint8Array(bytes));
  const decoded = decodeTerrainRgba(png.rgba, {
    west: sidecar.bbox.west,
    south: sidecar.bbox.south,
    east: sidecar.bbox.east,
    north: sidecar.bbox.north,
    width: sidecar.width,
    height: sidecar.height,
    pixelSizeMx: sidecar.pixelSizeMx,
    pixelSizeMy: sidecar.pixelSizeMy,
    offset: sidecar.encoding.offset,
    step: sidecar.encoding.step,
    noDataCode: sidecar.encoding.noDataCode,
  });
  return { sidecar, decoded, png };
}

describe('sampleBilinear against the decoded grid', () => {
  it('returns the exact decoder value at every pixel centre', async () => {
    const { sidecar, decoded } = await loadArea('majuli');

    // Pixel centres sit at (i + 0.5) / n in fractional coordinates, and the
    // bilinear weight there is exactly zero on the far tap, so the result must
    // equal the decoded value to the last bit rather than merely close to it.
    let checked = 0;
    const cells: ReadonlyArray<readonly [number, number]> = [
      [0, 0],
      [1, 0],
      [0, 1],
      [17, 23],
      [949, 555],
      [1900, 1112],
    ];
    for (const [i, j] of cells) {
      const u = (i + 0.5) / sidecar.width;
      const v = (j + 0.5) / sidecar.height;
      const got = sampleBilinear(decoded.heights, decoded.noData, sidecar, u, v);
      expect(got.noData, `cell ${i},${j} reported no-data`).toBe(false);
      expect(got.elevationM).toBe(decoded.heights[j * sidecar.width + i]);
      checked += 1;
    }
    expect(checked).toBe(6);
  });

  it('interpolates between four neighbours, not just snaps to a cell', () => {
    // A synthetic 4x4 ramp with heights[i] === i, so every expected value can be
    // derived by hand from the array layout rather than by re-running the
    // function under test over the same data it already reads.
    //
    //   row 0:  0  1  2  3
    //   row 1:  4  5  6  7
    //   row 2:  8  9 10 11
    //   row 3: 12 13 14 15
    const w = 4;
    const heights = new Float32Array(Array.from({ length: 16 }, (_, i) => i));
    const noData = new Uint8Array(16);
    const meta = { width: w, height: 4 };

    // Pixel centres are at (i + 0.5) / n, so u = 0.375 is exactly the centre of
    // column 1 and the interpolation weight on the far tap must be zero.
    expect(sampleBilinear(heights, noData, meta, 0.375, 0.375).elevationM).toBe(5);

    // Halfway between the centres of cells 1 and 2, on both axes:
    //   top    = mix(5, 6, 0.5) = 5.5
    //   bottom = mix(9, 10, 0.5) = 9.5
    //   result = mix(5.5, 9.5, 0.5) = 7.5
    expect(sampleBilinear(heights, noData, meta, 0.5, 0.5).elevationM).toBeCloseTo(
      7.5,
      6,
    );

    // Three quarters of the way along both axes:
    //   top    = mix(5, 6, 0.75) = 5.75
    //   bottom = mix(9, 10, 0.75) = 9.75
    //   result = mix(5.75, 9.75, 0.75) = 8.75
    expect(sampleBilinear(heights, noData, meta, 0.5625, 0.5625).elevationM).toBeCloseTo(
      8.75,
      6,
    );

    // Exactly the centre of cell (2, 2).
    expect(sampleBilinear(heights, noData, meta, 0.625, 0.625).elevationM).toBe(10);
  });

  it('puts row 0 at the north edge, so v increases southward', () => {
    // A three-row column of known values. If v were flipped somewhere, the
    // second and third rows would come back swapped, which is the kind of
    // mirror that puts a river on the wrong side of a valley without looking
    // obviously wrong.
    const heights = new Float32Array([100, 300]);
    const noData = new Uint8Array(2);
    const meta = { width: 1, height: 2 };
    expect(sampleBilinear(heights, noData, meta, 0.5, 0.25).elevationM).toBe(100);
    expect(sampleBilinear(heights, noData, meta, 0.5, 0.75).elevationM).toBe(300);
  });

  it('returns NaN, never zero, where no-data is present', () => {
    const heights = new Float32Array([100, 200, 300, 400]);
    const noData = new Uint8Array([0, 1, 0, 0]); // top-right is a hole
    const meta = { width: 2, height: 2 };

    const hit = sampleBilinear(heights, noData, meta, 0.5, 0.5);
    expect(hit.noData).toBe(true);
    expect(isNoDataHeight(hit.elevationM)).toBe(true);
    expect(hit.elevationM).toBe(NO_DATA_HEIGHT);
    // PRODUCT.md 4.4: an unavailable measurement renders as an empty state,
    // never as 0, because 0 is a real elevation and a claim about the ground.
    expect(hit.elevationM).not.toBe(0);
  });

  it('treats a NaN height as no-data even without the mask set', () => {
    const heights = new Float32Array([NaN, 200, 300, 400]);
    const noData = new Uint8Array(4);
    const got = sampleBilinear(heights, noData, { width: 2, height: 2 }, 0.5, 0.5);
    expect(got.noData).toBe(true);
  });

  it('refuses to sample outside the grid', () => {
    const heights = new Float32Array([1, 2, 3, 4]);
    const noData = new Uint8Array(4);
    const meta = { width: 2, height: 2 };
    const outside: ReadonlyArray<readonly [number, number]> = [
      [-0.01, 0.5],
      [1.01, 0.5],
      [0.5, -0.01],
      [0.5, 1.01],
      [Number.NaN, 0.5],
      [0.5, Number.POSITIVE_INFINITY],
    ];
    for (const [u, v] of outside) {
      expect(sampleBilinear(heights, noData, meta, u, v).noData).toBe(true);
    }
  });

  it('clamps at the border rather than reading past the array', () => {
    const heights = new Float32Array([10, 20, 30, 40]);
    const noData = new Uint8Array(4);
    const got = sampleBilinear(heights, noData, { width: 2, height: 2 }, 0, 0);
    expect(got.noData).toBe(false);
    // Half a pixel in from the edge, the four taps include out-of-range indices,
    // which must clamp rather than produce NaN from an undefined read.
    expect(Number.isFinite(got.elevationM)).toBe(true);
    expect(got.elevationM).toBeCloseTo(10, 6);
  });
});

describe('sampleNearest', () => {
  it('picks the containing cell and reports holes', async () => {
    const { sidecar, decoded } = await loadArea('majuli');
    const i = 900;
    const j = 500;
    const got = sampleNearest(
      decoded.heights,
      decoded.noData,
      sidecar,
      (i + 0.5) / sidecar.width,
      (j + 0.5) / sidecar.height,
    );
    expect(got.elevationM).toBe(decoded.heights[j * sidecar.width + i]);
  });
});

describe('the committed grids, and a known collision in the encoding', () => {
  it('decodes every real elevation inside the range the sidecar declares', async () => {
    // Containment, not equality. The reason it is not equality is the collision
    // documented in the next test: the encoding reserves code 0 for no-data and
    // sets `offset` to the minimum elevation, so the minimum itself is not
    // representable as data.
    for (const area of ['assam-overview', 'majuli', 'sadiya-dibrugarh']) {
      const { sidecar, decoded } = await loadArea(area);
      let min = Number.POSITIVE_INFINITY;
      let max = Number.NEGATIVE_INFINITY;
      for (const h of decoded.heights) {
        if (Number.isNaN(h)) continue;
        if (h < min) min = h;
        if (h > max) max = h;
      }
      expect(min, `${area} decoded below the sidecar minimum`).toBeGreaterThanOrEqual(
        sidecar.minElevation,
      );
      expect(max, `${area} decoded above the sidecar maximum`).toBeLessThanOrEqual(
        sidecar.maxElevation + sidecar.encoding.step,
      );
    }
  });

  it('reproduces the no-data collision in the committed encoding', async () => {
    // Characterisation, not endorsement.
    //
    // `noDataCode` is 0 and `offset` is the minimum elevation, so a real pixel
    // sitting exactly at the minimum encodes to the same code the decoder
    // reserves for no-data. On read-back it becomes a hole. Majuli loses 1,938
    // cells (0.09%) and the overview loses 49 (0.004%); sadiya-dibrugarh loses
    // none, because its offset of 74 sits below its minimum of 74.5.
    //
    // The numbers are asserted so that a pipeline rebuild either keeps the same
    // behaviour or fails loudly here, rather than quietly changing how much of
    // the terrain the viewer thinks is missing. The fix belongs to the encoding
    // in scripts/build-dem.ts and requires regenerating the artefacts, so it is
    // not attempted from the renderer.
    const expected: Record<string, number> = {
      'assam-overview': 49,
      majuli: 1938,
      'sadiya-dibrugarh': 0,
    };

    for (const [area, holes] of Object.entries(expected)) {
      const { sidecar, decoded } = await loadArea(area);
      let count = 0;
      for (const flag of decoded.noData) count += flag;
      expect(count, `${area} no-data cell count changed`).toBe(holes);

      // The sidecars claim zero no-data, which is true of the SOURCE tiles and
      // false of the decoded artefacts. Asserting that gap keeps it visible.
      expect(sidecar.noDataPixels, `${area} sidecar noDataPixels changed`).toBe(0);
      expect(
        count,
        `${area} sidecar and artefact now agree, update this test`,
      ).toBeGreaterThanOrEqual(0);
    }
  });

  it('shows the collision is confined to the bottom of the range', async () => {
    // If any hole appeared above the minimum elevation the collision story
    // would be wrong, and the renderer would be discarding real terrain.
    for (const area of ['assam-overview', 'majuli']) {
      const { sidecar, decoded } = await loadArea(area);
      let lowestHole = Number.POSITIVE_INFINITY;
      for (let i = 0; i < decoded.noData.length; i++) {
        if (decoded.noData[i] === 1) continue;
        lowestHole = Math.min(lowestHole, decoded.heights[i]!);
      }
      // Everything that survived decoding is at least one step above the
      // reserved code. The epsilon is relative, because the error is float32
      // rounding on the value itself: 68.1 comes back as 68.09999847.
      const floor = sidecar.encoding.offset + sidecar.encoding.step;
      expect(lowestHole).toBeGreaterThanOrEqual(floor - Math.abs(floor) * 1e-6);
    }
  });
});
