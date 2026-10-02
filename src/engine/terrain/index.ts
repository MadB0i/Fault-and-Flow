/**
 * The engine's public surface.
 *
 * The UI imports from here and never from a module inside the folder, so the
 * internal file layout stays free to change without touching components. See
 * docs/ARCHITECTURE.md section 2 for the typed-API rule this barrel exists to
 * serve.
 *
 * Nothing in here imports React, and nothing in `src/engine/` does at all -
 * eslint.config.js enforces it.
 */

export {
  AREA_IDS,
  AREA_DEFINITIONS,
  MAX_EXAGGERATION,
  MIN_EXAGGERATION,
  areaDefinition,
  areaDefinitionOrFirst,
  clampExaggeration,
  isAreaId,
  type AreaDefinition,
  type AreaId,
  type AreaTitleKey,
} from './area-registry.js';

export {
  parseSidecar,
  type Bbox,
  type EncodingInfo,
  type TerrainSidecar,
} from './sidecar.js';

export {
  DEFAULT_TICK_TARGET,
  MAX_CONTOUR_BANDS,
  MIN_INTERVAL_PIXELS,
  NICE_CONTOUR_INTERVALS,
  NICE_TICK_STEPS,
  contourIntervalFor,
  containsLonLat,
  extentMeters,
  gridToLonLat,
  gridToWorld,
  legendTicks,
  legendTicksFor,
  lonLatToGrid,
  percentileOf,
  pickContourInterval,
  pickTickStep,
  rampRangeFor,
  rampTickStepFor,
  rampTicks,
  reliefMeters,
  RAMP_PERCENTILES,
  type ExtentM,
  type GridPoint,
  type RampRange,
} from './metrics.js';

export { sampleBilinear, sampleNearest, type SampleResult } from './sampling.js';

export {
  CAMERA_FOV_DEG,
  DEFAULT_DAMPING_RATE,
  DEG,
  MAX_POLAR_DEG,
  MIN_POLAR_DEG,
  clampDistance,
  clampPolar,
  clampSpherical,
  dampingFactor,
  hasSettled,
  sphericalToCartesian,
  wrapAzimuth,
  type Spherical,
  type Vec3,
} from './camera-math.js';

export {
  NO_DATA_HEIGHT,
  decodePng,
  decodeTerrainRgba,
  isNoDataHeight,
  type DecodedTerrain,
  type TerrainGridMeta,
} from './decode-terrain.js';

export {
  createTerrainView,
  MAX_MESH_SEGMENTS,
  MAX_PIXEL_RATIO,
  DEFAULT_SIM_WIDTH,
  TerrainViewError,
  type AreaSources,
  type ProbeTarget,
  type TerrainErrorCode,
  type TerrainPalette,
  type TerrainProbe,
  type TerrainStatus,
  type TerrainView,
  type TerrainViewOptions,
  type TerrainViewState,
  type WaterLayerState,
} from './terrain-view.js';
