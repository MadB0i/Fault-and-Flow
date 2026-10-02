/**
 * Headless Terrain-RGB PNG decoder.
 *
 * No DOM, no React, no Node-only API. Takes PNG bytes and returns a Float32Array
 * of elevations plus the grid metadata needed to place them on the globe.
 *
 * Two things this module exists to guarantee:
 *
 *  1. **No-data is explicit.** The encoded no-data code is 0, and it is returned
 *     as NaN in the height array with a companion boolean mask. A caller cannot
 *     accidentally read a no-data cell as an elevation, because there is no
 *     number there to read.
 *
 *  2. **Values are not altered in transit.** Terrain-RGB is a *measurement*
 *     encoding. Any browser-side path must decode with `premultiplyAlpha: 'none'`
 *     and `colorSpaceConversion: 'none'` (see `decodePngBrowser` in
 *     docs/ARCHITECTURE.md and in the UI adapter), because alpha premultiplication
 *     would multiply RGB by alpha and silently corrupt every elevation.
 *
 * The PNG itself is parsed here rather than by an image library so that this
 * module stays runnable in a bare Node process — the ARCHITECTURE.md §1 rule that
 * simulations must be unit-testable without a browser.
 */

import { decodeElevation } from './terrain-rgb.ts';

export type TerrainGridMeta = {
  /** West edge in degrees. */
  readonly west: number;
  /** South edge in degrees. */
  readonly south: number;
  /** East edge in degrees. */
  readonly east: number;
  /** North edge in degrees. */
  readonly north: number;
  readonly width: number;
  readonly height: number;
  /** Pixel size east–west, metres. GLO-30 pixels are NOT square; see DATA.md §1. */
  readonly pixelSizeMx: number;
  /** Pixel size north–south, metres. */
  readonly pixelSizeMy: number;
  /** Elevation offset recorded in the sidecar. */
  readonly offset: number;
  /** Vertical step, metres. */
  readonly step: number;
  /** Source no-data code, i.e. the Terrain-RGB code reserved for no data. */
  readonly noDataCode: number;
};

export type DecodedTerrain = {
  /** Row-major, row 0 is the NORTH edge. Length = width * height. */
  readonly heights: Float32Array;
  /** True where the pixel is no-data. Same indexing as `heights`. */
  readonly noData: Uint8Array;
  readonly meta: TerrainGridMeta;
};

/** Value written into `heights` for a no-data cell. */
export const NO_DATA_HEIGHT = Number.NaN;

export function isNoDataHeight(h: number): boolean {
  return Number.isNaN(h);
}

/**
 * Decode Terrain-RGB pixels to elevations.
 *
 * `rgba` is row-major RGBA8, as produced by any PNG decoder. Terrain-RGB uses no
 * alpha, so the alpha channel is ignored on the way in — but it must be 255 for
 * the browser path not to have premultiplied the data already (see the module
 * comment).
 */
export function decodeTerrainRgba(
  rgba: Uint8Array | Uint8ClampedArray,
  meta: TerrainGridMeta,
): DecodedTerrain {
  const { width, height, offset, step, noDataCode } = meta;
  const expected = width * height * 4;
  if (rgba.length !== expected) {
    throw new RangeError(
      `expected ${expected} bytes of RGBA for a ${width}x${height} grid, got ${rgba.length}`,
    );
  }
  const heights = new Float32Array(width * height);
  const noData = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const o = i * 4;
    const code = (rgba[o]! << 16) | (rgba[o + 1]! << 8) | rgba[o + 2]!;
    if (code === noDataCode) {
      heights[i] = NO_DATA_HEIGHT;
      noData[i] = 1;
    } else {
      heights[i] = decodeElevation(code, offset, step);
    }
  }
  return { heights, noData, meta };
}

/**
 * Encode elevations to Terrain-RGB RGBA bytes. The inverse of
 * {@link decodeTerrainRgba}, and the single definition both sides share.
 */
export function encodeTerrainRgba(
  heights: ArrayLike<number>,
  noData: ArrayLike<number>,
  meta: TerrainGridMeta,
): Uint8Array {
  const { width, height, offset, step, noDataCode } = meta;
  const out = new Uint8Array(width * height * 4);
  const max = Math.round((65535 - 0) / step);
  for (let i = 0; i < width * height; i++) {
    const o = i * 4;
    let code: number;
    if (noData[i]) {
      code = noDataCode;
    } else {
      const v = Math.round((heights[i]! - offset) / step);
      if (!Number.isFinite(v) || v < 0 || v > max) {
        throw new RangeError(
          `elevation ${heights[i]} m is outside the Terrain-RGB range for offset ${offset} m`,
        );
      }
      code = v;
    }
    out[o] = (code >> 16) & 0xff;
    out[o + 1] = (code >> 8) & 0xff;
    out[o + 2] = code & 0xff;
    out[o + 3] = 255;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Minimal PNG reader
// ---------------------------------------------------------------------------

/**
 * Decode a non-interlaced 8-bit PNG to RGBA bytes.
 *
 * Terrain-RGB is written by this pipeline as colour type 2 (truecolour, 8-bit,
 * no alpha) precisely so this reader stays small and so no alpha channel exists
 * to be premultiplied. Interlaced and palette images are rejected rather than
 * half-supported.
 *
 * Async because inflation goes through `DecompressionStream`, which is present in
 * browsers and in Node 18+. Using it rather than `node:zlib` is what lets this
 * module run in both places without a conditional import.
 */
export async function decodePng(bytes: Uint8Array): Promise<{
  width: number;
  height: number;
  rgba: Uint8Array;
}> {
  const SIG = [137, 80, 78, 71, 13, 10, 26, 10];
  for (let i = 0; i < SIG.length; i++) {
    if (bytes[i] !== SIG[i]) throw new Error('not a PNG: bad signature');
  }
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let pos = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colourType = 0;
  let interlace = 0;
  const idat: Uint8Array[] = [];
  let palette: Uint8Array | null = null;
  let trns: Uint8Array | null = null;

  while (pos < bytes.length) {
    const len = dv.getUint32(pos);
    const type = String.fromCharCode(
      bytes[pos + 4]!,
      bytes[pos + 5]!,
      bytes[pos + 6]!,
      bytes[pos + 7]!,
    );
    const dataStart = pos + 8;
    if (type === 'IHDR') {
      width = dv.getUint32(dataStart);
      height = dv.getUint32(dataStart + 4);
      bitDepth = bytes[dataStart + 8]!;
      colourType = bytes[dataStart + 9]!;
      interlace = bytes[dataStart + 12]!;
    } else if (type === 'PLTE') {
      palette = bytes.subarray(dataStart, dataStart + len);
    } else if (type === 'tRNS') {
      trns = bytes.subarray(dataStart, dataStart + len);
    } else if (type === 'IDAT') {
      idat.push(bytes.subarray(dataStart, dataStart + len));
    } else if (type === 'IEND') {
      break;
    }
    pos = dataStart + len + 4;
  }

  if (bitDepth !== 8) throw new Error(`unsupported bit depth ${bitDepth}`);
  if (interlace !== 0) throw new Error('interlaced PNG is not supported');
  if (colourType !== 2 && colourType !== 3 && colourType !== 6) {
    throw new Error(`unsupported colour type ${colourType}`);
  }

  const channels = colourType === 2 ? 3 : colourType === 6 ? 4 : 1;
  const raw = await inflate(concat(idat));
  const stride = width * channels;
  if (raw.length < (stride + 1) * height) {
    throw new Error('PNG data is truncated');
  }

  // Undo per-scanline filtering.
  const unfiltered = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]!;
    const src = y * (stride + 1) + 1;
    const dst = y * stride;
    const up = dst - stride;
    for (let x = 0; x < stride; x++) {
      const rawByte = raw[src + x]!;
      const a = x >= channels ? unfiltered[dst + x - channels]! : 0;
      const b = y > 0 ? unfiltered[up + x]! : 0;
      const c = x >= channels && y > 0 ? unfiltered[up + x - channels]! : 0;
      let v: number;
      switch (filter) {
        case 0:
          v = rawByte;
          break;
        case 1:
          v = rawByte + a;
          break;
        case 2:
          v = rawByte + b;
          break;
        case 3:
          v = rawByte + ((a + b) >> 1);
          break;
        case 4:
          v = rawByte + paeth(a, b, c);
          break;
        default:
          throw new Error(`unknown PNG filter ${filter}`);
      }
      unfiltered[dst + x] = v & 0xff;
    }
  }

  // Expand to RGBA.
  const rgba = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const s = i * channels;
    const o = i * 4;
    if (colourType === 2) {
      rgba[o] = unfiltered[s]!;
      rgba[o + 1] = unfiltered[s + 1]!;
      rgba[o + 2] = unfiltered[s + 2]!;
      rgba[o + 3] = 255;
    } else if (colourType === 6) {
      rgba[o] = unfiltered[s]!;
      rgba[o + 1] = unfiltered[s + 1]!;
      rgba[o + 2] = unfiltered[s + 2]!;
      rgba[o + 3] = unfiltered[s + 3]!;
    } else {
      const p = unfiltered[s]! * 3;
      rgba[o] = palette ? palette[p]! : 0;
      rgba[o + 1] = palette ? palette[p + 1]! : 0;
      rgba[o + 2] = palette ? palette[p + 2]! : 0;
      rgba[o + 3] = trns && unfiltered[s]! < trns.length ? trns[unfiltered[s]!]! : 255;
    }
  }
  return { width, height, rgba };
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

function concat(parts: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const p of parts) total += p.length;
  const out = new Uint8Array(total);
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

/**
 * zlib inflate via `DecompressionStream`, which is a platform primitive in both
 * browsers and Node 18+. Deliberately not `node:zlib`: a static import of that
 * would drag a Node builtin into the browser bundle, and the engine has to be
 * runnable in a bare Node process *and* in a page.
 */
async function inflate(data: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream('deflate');
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(ds);
  const chunks: Uint8Array[] = [];
  let total = 0;
  const reader = stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.length;
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}
