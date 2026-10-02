/**
 * Areas of interest for the DEM pipeline.
 *
 * Every landmark coordinate here is CITED and traceable. If you cannot find a
 * source for a coordinate, it does not belong in this file — per AGENTS.md §6, an
 * uncited coordinate is a fabricated one.
 *
 * The bboxes are not guesses. They were computed from the landmark extents below
 * plus a safety margin, so that every cited landmark sits at least
 * `MIN_LANDMARK_MARGIN_M` inside the box. `npm run data:dem` asserts that
 * invariant and fails the build if it is ever broken.
 */

/** Minimum distance a cited landmark must sit inside its area's bbox. */
export const MIN_LANDMARK_MARGIN_M = 5_000;

export type Bbox = {
  /** West edge, degrees. */
  readonly west: number;
  /** South edge, degrees. */
  readonly south: number;
  /** East edge, degrees. */
  readonly east: number;
  /** North edge, degrees. */
  readonly north: number;
};

export type Landmark = {
  readonly name: string;
  readonly lon: number;
  readonly lat: number;
  /** Where the coordinate comes from, verbatim enough to re-check. */
  readonly source: string;
  /**
   * True when this landmark defines an extent (a corner or edge of an area)
   * rather than a single point. Edge landmarks only need to be inside the bbox,
   * not to clear the margin, because the margin exists to keep a *point* off
   * the boundary.
   */
  readonly isExtentEdge?: boolean;
};

/**
 * Approximate metres per degree, for the margin arithmetic. Longitude is scaled
 * by cos(latitude); the boxes here span <1 degree of latitude so a single
 * mid-latitude factor is accurate to well under a percent.
 */
const M_PER_DEG = 111_320;

function mPerDegLon(lat: number): number {
  return M_PER_DEG * Math.cos((lat * Math.PI) / 180);
}

/** Distance in metres from a point to the nearest edge of `bbox`. */
export function marginMetres(bbox: Bbox, lon: number, lat: number): number {
  const midLat = (bbox.south + bbox.north) / 2;
  const lonScale = mPerDegLon(midLat);
  const latScale = M_PER_DEG;
  const west = (lon - bbox.west) * lonScale;
  const east = (bbox.east - lon) * lonScale;
  const south = (lat - bbox.south) * latScale;
  const north = (bbox.north - lat) * latScale;
  return Math.min(west, east, south, north);
}

export function containsPoint(bbox: Bbox, lon: number, lat: number): boolean {
  return lon >= bbox.west && lon <= bbox.east && lat >= bbox.south && lat <= bbox.north;
}

/**
 * Majuli island extent, from the Majuli District Administration's own "About
 * District" page, which publishes the extreme points of the island core area to
 * the nearest second. Quoted format is "94° 10' 25" N 27° 06' 11" E" — the first
 * pair is LONGITUDE, the second is LATITUDE, despite the stray N/E letters.
 *
 * Source: https://majuli.assam.gov.in/about-us/about-district
 *   "The co-ordinate qualifying the extreme points of the core area in the
 *    North, South, East & West are as follows: Core area end points-
 *    N: 94° 10' 25" N 27° 06' 11" E
 *    S: 94° 09' 33" N 26° 49' 29" E
 *    E: 94° 31' 10" N 27° 05' 09" E
 *    W: 93° 44' 47"N 26° 47' 01" E"
 *
 * Converted to decimal degrees:
 *   N core  94°10'25"E = 94.173611,  27°06'11"N = 27.103056
 *   S core  94°09'33"E = 94.159167,  26°49'29"N = 26.824722
 *   E core  94°31'10"E = 94.519444,  27°05'09"N = 27.085833
 *   W core  93°44'47"E = 93.746389,  26°47'01"N = 26.783611
 *
 * The buffer area on the same page extends further: north to 27°21'26"N
 * (27.357222) and west to 93°35'03"E (93.584167).
 */
const MAJULI_SOURCE = 'https://majuli.assam.gov.in/about-us/about-district';

export const MAJULI_EXTENT: readonly Landmark[] = [
  {
    name: 'Majuli core north',
    lon: 94.173611,
    lat: 27.103056,
    source: `${MAJULI_SOURCE} — core area end point N, 94°10'25"E 27°06'11"N`,
    isExtentEdge: true,
  },
  {
    name: 'Majuli core south',
    lon: 94.159167,
    lat: 26.824722,
    source: `${MAJULI_SOURCE} — core area end point S, 94°09'33"E 26°49'29"N`,
    isExtentEdge: true,
  },
  {
    name: 'Majuli core east',
    lon: 94.519444,
    lat: 27.085833,
    source: `${MAJULI_SOURCE} — core area end point E, 94°31'10"E 27°05'09"N`,
    isExtentEdge: true,
  },
  {
    name: 'Majuli core west',
    lon: 93.746389,
    lat: 26.783611,
    source: `${MAJULI_SOURCE} — core area end point W, 93°44'47"E 26°47'01"N`,
    isExtentEdge: true,
  },
];

/**
 * Sadiya, the eastern head of the Brahmaputra in Arunachal Pradesh.
 * Source: https://en.wikipedia.org/wiki/Sadiya — "Coordinates: 27°50′N 95°40′E /
 * 27.83°N 95.67°E".
 *
 * NOTE: the owner's recollection was 95.64E; the cited value is 95.67E. The
 * owner was right to the nearest ~3 km and wrong by 0.03 degrees, which matters
 * only because it changes which tiles the box spans.
 */
export const SADIYA: Landmark = {
  name: 'Sadiya',
  lon: 95.67,
  lat: 27.83,
  source:
    'https://en.wikipedia.org/wiki/Sadiya — "Coordinates: 27°50′N 95°40′E / 27.83°N 95.67°E"',
};

/**
 * Dibrugarh, the reference city for the upper Brahmaputra reach.
 * Source: https://www.geonames.org/1272648/dibrugarh.html — GeoNames entry
 * 1272648, "27.47989, 94.90837". Cross-checked against Wikipedia's Dibrugarh
 * article (27°28′N 94°55′E) and the district gazetteer figure quoted by
 * Wikipedia (27° 5' 38" N to 27° 42' 30" N, 94°33'46"E to 95°29'8"E).
 *
 * NOTE: the owner's recollection was ~94.91E, which matches GeoNames to 0.002
 * degrees. The owner's other figure, Dibrugarh's published elevation of 108 m,
 * is NOT used as an accuracy check anywhere in this repo — see the plausibility
 * test, which is deliberately labelled as such.
 */
export const DIBRUGARH: Landmark = {
  name: 'Dibrugarh',
  lon: 94.90837,
  lat: 27.47989,
  source:
    'https://www.geonames.org/1272648/dibrugarh.html — GeoNames entry 1272648, 27.47989 N 94.90837 E',
};

export type Area = {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly bbox: Bbox;
  /**
   * Target pixel size in metres for the OUTPUT grid. Chosen against the PNG size
   * budget: Terrain-RGB is 3 bytes/px before deflate, and measured deflate on
   * this terrain runs 0.04-1.0 bytes/px depending on roughness. We budget at
   * 1.2 bytes/px so the worst case still fits.
   */
  readonly targetPixelSizeM: number;
  /** Landmarks that must lie inside `bbox`. */
  readonly landmarks: readonly Landmark[];
  /** Which COG overview level to read. 0 = full res. See docs/DATA.md §1. */
  readonly overviewLevel: number;
  /**
   * Vertical step of the Terrain-RGB encoding, metres. Recorded in the sidecar.
   *
   * 0.1 m is the project's default and is right for both river reaches, whose
   * elevation spans are ~2,000 m and comfortably inside the 16-bit budget of
   * 6553.5 m.
   *
   * The overview area is the exception, and the reason is measured rather than
   * assumed: its bbox reaches into the Mishmi Hills, whose summit inside the box
   * is 7446.5 m, giving a span of 7447 m. At 0.1 m that needs 74,470 codes and
   * 16-bit Terrain-RGB holds 65,535, so the area simply cannot be encoded at
   * 0.1 m. At 0.15 m the budget is 9830 m and the area fits with room to spare.
   * Coarsening the step here costs nothing real: one step is 0.15 m on a pixel
   * 530 m across, which is far below the source's own 1.472 m LE90 vertical error.
   */
  readonly step: number;
};

export const AREAS: readonly Area[] = [
  {
    id: 'assam-overview',
    title: 'Assam valley overview',
    description:
      'The whole Brahmaputra valley in Assam, coarse. The basin-level view: where the river runs, where the hills close in, and how little vertical relief there is to work with.',
    bbox: { west: 89.5, south: 24.0, east: 96.5, north: 28.5 },
    // Coarse: 40 source tiles at full res is ~1.7 GB, so this reads overview 3
    // (~450 px/degree, ~220 m ground) and downsamples from there.
    targetPixelSizeM: 530,
    landmarks: [SADIYA, DIBRUGARH],
    overviewLevel: 3,
    // Measured span of this bbox is 7447 m (-0.4 to 7446.5), which does not fit
    // 16-bit Terrain-RGB at 0.1 m. See the `step` field doc.
    step: 0.15,
  },
  {
    id: 'majuli',
    title: 'Majuli island and the surrounding Brahmaputra',
    description:
      'Majuli, the largest river island, with the main Brahmaputra channel on the south and the Subansiri-fed channel on the north. Tighter than first proposed: the island runs 93.75-94.52E, so the eastern half of the old box was Sivasagar mainland.',
    bbox: { west: 93.55, south: 26.7, east: 94.7, north: 27.3 },
    targetPixelSizeM: 60,
    landmarks: MAJULI_EXTENT,
    // Full resolution: the island is the smallest of the three areas, and its
    // channels are the subject. Measured span 2031 m, so 0.1 m fits.
    overviewLevel: 0,
    step: 0.1,
  },
  {
    id: 'sadiya-dibrugarh',
    title: 'Sadiya to Dibrugarh braided reach',
    description:
      'The upper Brahmaputra from the Sadiya headwaters down to Dibrugarh. The most strongly braided section in Assam, which is why it is the reach for FLOW. Extended north and east from the first proposal to take in the Dibang/Lohit confluence near Sadiya.',
    bbox: { west: 94.6, south: 27.1, east: 96.0, north: 28.0 },
    targetPixelSizeM: 65,
    landmarks: [SADIYA, DIBRUGARH],
    overviewLevel: 0,
    // Measured span 1745 m, so 0.1 m fits.
    step: 0.1,
  },
];
