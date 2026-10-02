/**
 * Minimal WOFF2 reader that extracts the cmap (character map) from a `.woff2`
 * file, so tests can assert real glyph coverage of the font we ship.
 *
 * No font-parsing dependency. WOFF2 stores its table directory in a packed
 * variable-length format and Brotli-compresses the concatenated table data as
 * one stream. `cmap` is one of the tables WOFF2 does *not* transform, so after
 * Brotli decompression it is plain sfnt bytes and can be read directly.
 *
 * Reference: W3C WOFF2 File Format, https://www.w3.org/TR/WOFF2/
 */

import { readFileSync } from 'node:fs';
import { brotliDecompressSync } from 'node:zlib';

/**
 * Known-table tag array. WOFF2 stores most tags as an index into this list
 * rather than as four literal bytes; index 63 means the tag is inline.
 */
const KNOWN_TAGS = [
  'cmap',
  'head',
  'hhea',
  'hmtx',
  'maxp',
  'name',
  'OS/2',
  'post',
  'cvt ',
  'fpgm',
  'glyf',
  'loca',
  'prep',
  'CFF ',
  'VORG',
  'EBDT',
  'EBLC',
  'gasp',
  'hdmx',
  'kern',
  'LTSH',
  'PCLT',
  'VDMX',
  'vhea',
  'vmtx',
  'BASE',
  'GDEF',
  'GPOS',
  'GSUB',
  'EBSC',
  'JSTF',
  'MATH',
  'CBDT',
  'CBLC',
  'COLR',
  'CPAL',
  'SVG ',
  'sbix',
  'acnt',
  'avar',
  'bdat',
  'bloc',
  'bsln',
  'cvar',
  'fdsc',
  'feat',
  'fmtx',
  'fvar',
  'gvar',
  'hsty',
  'just',
  'lcar',
  'mort',
  'morx',
  'opbd',
  'prop',
  'trak',
  'Zapf',
  'Silf',
  'Glat',
  'Gloc',
  'Feat',
  'Sill',
] as const;

/** 4-byte tag as bytes -> ASCII string, e.g. 'cmap'. */
const readTag = (buf: Buffer, at: number): string => buf.toString('latin1', at, at + 4);

interface TableEntry {
  tag: string;
  /** Length of the table after any WOFF2 transform is undone. */
  length: number;
  offset: number;
}

/** UIntBase128: 1-5 bytes, 7 bits each, high bit signals continuation. */
function readBase128(buf: Buffer, cursor: { at: number }): number {
  let value = 0;
  for (let i = 0; i < 5; i += 1) {
    const byte = buf.readUInt8(cursor.at);
    cursor.at += 1;
    // No leading zeroes allowed: a zero high-bit byte is a malformed stream.
    if (i === 0 && byte === 0x80) {
      throw new Error('WOFF2: UIntBase128 has a leading zero');
    }
    if (value & 0xfe000000) {
      throw new Error('WOFF2: UIntBase128 overflow');
    }
    value = (value << 7) | (byte & 0x7f);
    if ((byte & 0x80) === 0) return value >>> 0;
  }
  throw new Error('WOFF2: UIntBase128 longer than 5 bytes');
}

/**
 * Parse the WOFF2 header and table directory, then locate `cmap` within the
 * decompressed table data.
 */
function findCmap(buf: Buffer): Buffer {
  if (readTag(buf, 0) !== 'wOF2') {
    throw new Error('Not a WOFF2 file: missing "wOF2" signature');
  }

  const numTables = buf.readUInt16BE(12);
  const totalCompressedSize = buf.readUInt32BE(20);

  // The WOFF2 header is exactly 48 bytes: signature, flavor, length,
  // numTables(2), reserved(2), totalSfntSize, totalCompressedSize,
  // majorVersion(2), minorVersion(2), metaOffset, metaLength,
  // metaOrigLength, privOffset, privLength. The table directory follows.
  const cursor = { at: 48 };

  const entries: TableEntry[] = [];
  for (let i = 0; i < numTables; i += 1) {
    const flags = buf.readUInt8(cursor.at);
    cursor.at += 1;

    const tagIndex = flags & 0x3f;
    const transformVersion = (flags >> 6) & 0x03;

    let tag: string;
    if (tagIndex === 0x3f) {
      tag = readTag(buf, cursor.at);
      cursor.at += 4;
    } else {
      const known = KNOWN_TAGS[tagIndex];
      if (known === undefined) {
        throw new Error(`WOFF2: unknown table tag index ${tagIndex}`);
      }
      tag = known;
    }

    const origLength = readBase128(buf, cursor);

    // Whether `transformLength` follows depends on the table, and for glyf/loca
    // the meaning of the version field is INVERTED relative to every other
    // table. Per the WOFF2 spec:
    //   - any table except glyf/loca: transformVersion != 0 means transformed
    //   - glyf and loca:             transformVersion == 0 means transformed
    //     (0x0003 means explicitly untransformed)
    // Reading the extra length under the wrong rule desynchronises every
    // subsequent offset, so this distinction has to be exact.
    const isGlyfOrLoca = tag === 'glyf' || tag === 'loca';
    const isTransformed = isGlyfOrLoca ? transformVersion === 0 : transformVersion !== 0;

    // `transformLength` is the size the transformed form occupies in the
    // decompressed stream; `origLength` is the size it decompresses to.
    let storedLength = origLength;
    if (isTransformed) {
      storedLength = readBase128(buf, cursor);
    }

    // cmap is never transformed by WOFF2, so we can read it as plain sfnt.
    if (tag === 'cmap' && isTransformed) {
      throw new Error('WOFF2: cmap table is unexpectedly transformed');
    }

    entries.push({ tag, length: storedLength, offset: 0 });
  }

  const compressed = buf.subarray(cursor.at, cursor.at + totalCompressedSize);
  const tableData = brotliDecompressSync(compressed);

  // Tables are stored back-to-back in directory order.
  let offset = 0;
  for (const entry of entries) {
    entry.offset = offset;
    offset += entry.length;
  }

  if (offset > tableData.length) {
    throw new Error(
      `WOFF2: table directory claims ${offset} bytes but only ` +
        `${tableData.length} were decompressed`,
    );
  }

  const cmap = entries.find((e) => e.tag === 'cmap');
  if (!cmap) {
    throw new Error('WOFF2: font has no cmap table');
  }
  return tableData.subarray(cmap.offset, cmap.offset + cmap.length);
}

/**
 * Collect the code points covered by every Unicode (3,10) or Windows (3,1)
 * cmap subtable. A font may store several formats; all are merged.
 */
export function coveredCodePoints(buf: Buffer): Set<number> {
  const cmap = findCmap(buf);
  const points = new Set<number>();

  const version = cmap.readUInt16BE(0);
  if (version !== 0) throw new Error(`cmap: unexpected version ${version}`);
  const numSubtables = cmap.readUInt16BE(2);

  for (let i = 0; i < numSubtables; i += 1) {
    const at = 4 + i * 8;
    const platformId = cmap.readUInt16BE(at);
    const encodingId = cmap.readUInt16BE(at + 2);
    const subtableAt = cmap.readUInt32BE(at + 4);

    // Unicode BMP (3,1), full repertoire (3,10), and Windows Unicode (0,x).
    const isUnicode =
      (platformId === 3 && (encodingId === 1 || encodingId === 10)) || platformId === 0;

    if (!isUnicode) continue;

    const format = cmap.readUInt16BE(subtableAt);
    if (format === 4) {
      readFormat4(cmap, subtableAt, points);
    } else if (format === 12) {
      readFormat12(cmap, subtableAt, points);
    }
    // Formats 0 and 6 are legacy; a modern UI font will not rely on them.
  }

  return points;
}

/** cmap format 4: segmented mapping, the BMP workhorse. */
function readFormat4(cmap: Buffer, at: number, out: Set<number>): void {
  const segCountX2 = cmap.readUInt16BE(at + 6);
  const segCount = segCountX2 / 2;

  const endCodeAt = at + 14;
  const startCodeAt = endCodeAt + segCountX2 + 2; // + reservedPad
  const idDeltaAt = startCodeAt + segCountX2;
  const idRangeOffsetAt = idDeltaAt + segCountX2;

  for (let seg = 0; seg < segCount; seg += 1) {
    const end = cmap.readUInt16BE(endCodeAt + seg * 2);
    const start = cmap.readUInt16BE(startCodeAt + seg * 2);
    if (start === 0xffff) continue;

    const idDelta = cmap.readInt16BE(idDeltaAt + seg * 2);
    const idRangeOffset = cmap.readUInt16BE(idRangeOffsetAt + seg * 2);

    for (let code = start; code <= end; code += 1) {
      let glyph: number;
      if (idRangeOffset === 0) {
        glyph = (code + idDelta) & 0xffff;
      } else {
        // idRangeOffset is a byte offset from its own slot into glyphIdArray.
        const glyphAt = idRangeOffsetAt + seg * 2 + idRangeOffset + (code - start) * 2;
        if (glyphAt + 1 >= cmap.length) continue;
        glyph = cmap.readUInt16BE(glyphAt);
        if (glyph !== 0) glyph = (glyph + idDelta) & 0xffff;
      }
      if (glyph !== 0) out.add(code);
    }
  }
}

/** cmap format 12: segmented coverage to full 32-bit range. */
function readFormat12(cmap: Buffer, at: number, out: Set<number>): void {
  const nGroups = cmap.readUInt32BE(at + 12);
  for (let g = 0; g < nGroups; g += 1) {
    const groupAt = at + 16 + g * 12;
    const start = cmap.readUInt32BE(groupAt);
    const end = cmap.readUInt32BE(groupAt + 4);
    const startGlyph = cmap.readUInt32BE(groupAt + 8);
    // Skip the sentinel 0xFFFFFFFF group.
    if (start === 0xffffffff) continue;
    for (let code = start; code <= end; code += 1) {
      if (startGlyph + (code - start) !== 0) out.add(code);
    }
  }
}

/** Convenience: read a `.woff2` from disk and return its coverage. */
export function codePointsInFontFile(path: string): Set<number> {
  return coveredCodePoints(readFileSync(path));
}

/** Every distinct code point in a string, ignoring nothing (spaces included). */
export function codePointsInString(text: string): Set<number> {
  return new Set(Array.from(text, (ch) => ch.codePointAt(0)!));
}
