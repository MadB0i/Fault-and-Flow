/**
 * The three committed terrain areas, and the per-area viewing defaults.
 *
 * Pure module: no Three.js, no DOM, no data loading. Everything here is a
 * decision recorded rather than a value measured, which is why it lives in one
 * readable table instead of being derived at three call sites.
 *
 * The area ids are the same strings used by `data/processed/manifest.json`.
 * tests/terrain-areas.test.ts asserts that against the manifest, so adding an
 * artefact without adding it here fails the build rather than producing a picker
 * that silently omits it.
 */

/** Ids of the areas in `data/processed/`. */
export type AreaId = 'assam-overview' | 'majuli' | 'sadiya-dibrugarh';

/** Canonical order. Broadest basin view first: it is the orientation shot. */
export const AREA_IDS: readonly AreaId[] = [
  'assam-overview',
  'majuli',
  'sadiya-dibrugarh',
] as const;

/**
 * Vertical exaggeration bounds, in multiples of true scale.
 *
 * 1x is honest and unreadable: the Brahmaputra floodplain's relief is a few
 * metres across tens of kilometres, so at 1x it is a flat sheet. 30x is the
 * ceiling because beyond roughly that the hills stop looking like terrain and
 * start looking like spikes, and because the slider has to have a top.
 */
export const MIN_EXAGGERATION = 1;
export const MAX_EXAGGERATION = 30;

export type AreaDefinition = {
  readonly id: AreaId;
  /**
   * Default vertical exaggeration.
   *
   * Chosen by a single rule rather than by eye per area: pick the factor that
   * makes the area's own relief about a tenth of its east-west extent. Below
   * roughly that the relief does not read as relief; much above it the vertical
   * axis stops being a distortion of something recognisable and becomes the
   * subject. Measured against the committed sidecars:
   *
   * | area             | relief  | E-W extent | default | ratio |
   * | ---------------- | ------: | ---------: | ------: | ----: |
   * | assam-overview   |  7,331 m |    699 km  |      8x |  8.4% |
   * | majuli           |  2,021 m |    114 km  |      6x | 10.6% |
   * | sadiya-dibrugarh |  1,742 m |    138 km  |      8x | 10.1% |
   *
   * The overview is the outlier because its bbox reaches into the Mishmi Hills:
   * 7.3 km of relief in a 699 km box is 1% at true scale, so it needs more
   * exaggeration than the reaches to show anything, and still shows the
   * floodplain as what it is - nearly flat.
   */
  readonly defaultVerticalExaggeration: number;
  /** Key into the string table for the area's title. */
  readonly titleKey: AreaTitleKey;
  /**
   * Opening camera polar angle, degrees from straight down.
   *
   * 0 is a plan view, 90 is edge-on. 38-44 degrees reads as a landscape
   * without flattening the relief into a profile.
   */
  readonly defaultPolarDeg: number;
  /** Opening azimuth in degrees, 0 = looking from the south, clockwise. */
  readonly defaultAzimuthDeg: number;
  /** Nearest orbit distance, as a fraction of the area's diagonal. */
  readonly minZoomFactor: number;
  /** Furthest orbit distance, as a fraction of the area's diagonal. */
  readonly maxZoomFactor: number;
};

/**
 * Title keys. The titles themselves live in the string table so they can be
 * translated; the engine only ever holds the key. See DECISIONS.md section 5 -
 * the Assamese side of this table is DRAFT.
 */
export type AreaTitleKey = 'areaOverviewTitle' | 'areaMajuliTitle' | 'areaSadiyaTitle';

export const AREA_DEFINITIONS: readonly AreaDefinition[] = [
  {
    id: 'assam-overview',
    defaultVerticalExaggeration: 8,
    titleKey: 'areaOverviewTitle',
    // 50 degrees from straight down: inside the 45..55 band where the relief
    // reads as a landscape without flattening into a profile. The old 40 sat
    // nearly overhead, which hid the hills behind the floodplain.
    defaultPolarDeg: 50,
    defaultAzimuthDeg: 0,
    minZoomFactor: 0.35,
    maxZoomFactor: 2.2,
  },
  {
    id: 'majuli',
    defaultVerticalExaggeration: 6,
    titleKey: 'areaMajuliTitle',
    defaultPolarDeg: 48,
    defaultAzimuthDeg: 20,
    minZoomFactor: 0.3,
    maxZoomFactor: 2.4,
  },
  {
    id: 'sadiya-dibrugarh',
    defaultVerticalExaggeration: 8,
    titleKey: 'areaSadiyaTitle',
    defaultPolarDeg: 50,
    defaultAzimuthDeg: 10,
    minZoomFactor: 0.3,
    maxZoomFactor: 2.4,
  },
] as const;

/**
 * Look up one area. Returns undefined for an unknown id rather than throwing,
 * so a bad id from a URL or a stale store degrades to "nothing selected"
 * instead of taking the renderer down.
 */
export function areaDefinition(id: AreaId): AreaDefinition | undefined {
  return AREA_DEFINITIONS.find((a) => a.id === id);
}

/** The definition for `id`, or the first area as a documented fallback. */
export function areaDefinitionOrFirst(id: AreaId | null): AreaDefinition {
  if (id !== null) {
    const found = areaDefinition(id);
    if (found) return found;
  }
  const first = AREA_DEFINITIONS[0];
  if (!first) throw new Error('AREA_DEFINITIONS is empty');
  return first;
}

/** True when `value` is one of the three known ids. */
export function isAreaId(value: string): value is AreaId {
  return (AREA_IDS as readonly string[]).includes(value);
}

/** Clamp an exaggeration to the slider's range. Always finite, always in range. */
export function clampExaggeration(value: number): number {
  // NaN is handled separately: it is the one non-finite input that does not
  // have a meaningful end of the range to clamp towards, and letting it through
  // Math.min/Math.max would produce NaN, which then reaches the shader and
  // silently blanks the terrain.
  if (Number.isNaN(value)) return MIN_EXAGGERATION;
  return Math.min(MAX_EXAGGERATION, Math.max(MIN_EXAGGERATION, value));
}
