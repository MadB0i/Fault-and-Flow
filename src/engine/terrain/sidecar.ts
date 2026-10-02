/**
 * Typed view of a committed terrain sidecar (`data/processed/<area>.json`).
 *
 * The sidecar is written by `scripts/build-dem.ts` and documented in
 * docs/DATA.md section 13. It is the only source of truth for how to place a
 * grid in the world: the renderer must not guess a pixel size, a datum or an
 * attribution, because every one of those is a measurement with a citation
 * attached.
 *
 * Parsing is deliberately strict. A missing field throws rather than defaulting,
 * because a renderer that silently substitutes a plausible number for a missing
 * measurement is the exact failure AGENTS.md section 6 exists to catch, and it
 * would do it silently inside a 3D scene where nobody reads the console.
 */

import type { AreaId } from './area-registry.js';

export type Bbox = {
  readonly west: number;
  readonly south: number;
  readonly east: number;
  readonly north: number;
};

export type EncodingInfo = {
  readonly format: string;
  /** Vertical step in metres; one code is this many metres. */
  readonly step: number;
  /** Elevation in metres of code 0. */
  readonly offset: number;
  /** Terrain-RGB code reserved for no-data. */
  readonly noDataCode: number;
  /** The source product's no-data sentinel, -32767, which is NOT this. */
  readonly sourceNoDataSentinel: number;
  readonly colourType: number;
};

export type TerrainSidecar = {
  readonly area: AreaId;
  readonly title: string;
  readonly description: string;
  readonly bbox: Bbox;
  readonly crs: string;
  readonly width: number;
  readonly height: number;
  /**
   * Pixel footprint east-west in metres. A PAIR, not a scalar, and deliberately
   * not assumed square: GLO-30 is a 1 arcsecond angular grid, so the ground size
   * of a pixel shrinks with the cosine of latitude. See docs/DATA.md section 1.
   */
  readonly pixelSizeMx: number;
  readonly pixelSizeMy: number;
  readonly minElevation: number;
  readonly maxElevation: number;
  readonly meanElevation: number;
  readonly noDataPixels: number;
  readonly encoding: EncodingInfo;
  /** Mandatory Article 6(b) credit. Rendered verbatim; never retyped. */
  readonly attribution: string;
  readonly attributionRedistribution: string;
  readonly licence: string;
  readonly licenceUrl: string;
  readonly citation: string;
  readonly generated: string;
  /** What this terrain is NOT. Rendered in the HUD. */
  readonly limitations: readonly string[];
};

function fail(what: string, path: string): never {
  throw new Error(`terrain sidecar: ${what} is missing or wrong (${path})`);
}

function num(raw: unknown, path: string): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) fail('a number', path);
  return raw;
}

function str(raw: unknown, path: string): string {
  if (typeof raw !== 'string' || raw.length === 0) fail('a non-empty string', path);
  return raw;
}

function strings(raw: unknown, path: string): readonly string[] {
  if (!Array.isArray(raw) || raw.some((s) => typeof s !== 'string')) {
    fail('an array of strings', path);
  }
  return raw as readonly string[];
}

/**
 * Validate an unknown parsed-JSON value into a {@link TerrainSidecar}.
 *
 * Throws with the failing path. Every field the renderer depends on is checked,
 * including the ones it only passes through to the HUD, because a missing
 * attribution string is a licence problem rather than a cosmetic one and this is
 * the only place that would notice.
 */
export function parseSidecar(raw: unknown): TerrainSidecar {
  if (typeof raw !== 'object' || raw === null) fail('an object', '<root>');
  const r = raw as Record<string, unknown>;

  const bboxRaw = r['bbox'];
  if (typeof bboxRaw !== 'object' || bboxRaw === null) fail('a bbox object', 'bbox');
  const b = bboxRaw as Record<string, unknown>;
  const bbox: Bbox = {
    west: num(b['west'], 'bbox.west'),
    south: num(b['south'], 'bbox.south'),
    east: num(b['east'], 'bbox.east'),
    north: num(b['north'], 'bbox.north'),
  };

  const encRaw = r['encoding'];
  if (typeof encRaw !== 'object' || encRaw === null)
    fail('an encoding object', 'encoding');
  const e = encRaw as Record<string, unknown>;
  const encoding: EncodingInfo = {
    format: str(e['format'], 'encoding.format'),
    step: num(e['step'], 'encoding.step'),
    offset: num(e['offset'], 'encoding.offset'),
    noDataCode: num(e['noDataCode'], 'encoding.noDataCode'),
    sourceNoDataSentinel: num(e['sourceNoDataSentinel'], 'encoding.sourceNoDataSentinel'),
    colourType: num(e['colourType'], 'encoding.colourType'),
  };

  const width = num(r['width'], 'width');
  const height = num(r['height'], 'height');
  if (!Number.isInteger(width) || width < 2) fail('an integer >= 2', 'width');
  if (!Number.isInteger(height) || height < 2) fail('an integer >= 2', 'height');

  const pixelSizeMx = num(r['pixelSizeMx'], 'pixelSizeMx');
  const pixelSizeMy = num(r['pixelSizeMy'], 'pixelSizeMy');
  if (pixelSizeMx <= 0 || pixelSizeMy <= 0)
    fail('a positive number', 'pixelSizeMx/pixelSizeMy');
  if (encoding.step <= 0) fail('a positive step', 'encoding.step');

  const maxElevation = num(r['maxElevation'], 'maxElevation');
  const minElevation = num(r['minElevation'], 'minElevation');
  if (maxElevation <= minElevation)
    fail('maxElevation above minElevation', 'maxElevation');

  if (bbox.east <= bbox.west || bbox.north <= bbox.south) {
    fail('a non-degenerate bbox', 'bbox');
  }

  return {
    area: str(r['area'], 'area') as AreaId,
    title: str(r['title'], 'title'),
    description: str(r['description'], 'description'),
    bbox,
    crs: str(r['crs'], 'crs'),
    width,
    height,
    pixelSizeMx,
    pixelSizeMy,
    minElevation,
    maxElevation,
    meanElevation: num(r['meanElevation'], 'meanElevation'),
    noDataPixels: num(r['noDataPixels'], 'noDataPixels'),
    encoding,
    attribution: str(r['attribution'], 'attribution'),
    attributionRedistribution: str(
      r['attributionRedistribution'],
      'attributionRedistribution',
    ),
    licence: str(r['licence'], 'licence'),
    licenceUrl: str(r['licenceUrl'], 'licenceUrl'),
    citation: str(r['citation'], 'citation'),
    generated: str(r['generated'], 'generated'),
    limitations: strings(r['limitations'], 'limitations'),
  };
}
