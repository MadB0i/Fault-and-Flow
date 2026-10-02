/**
 * FLOW water engine, public surface.
 *
 * The UI imports from here and never from a module inside the folder.
 * Nothing in here imports React; `eslint.config.js` enforces it.
 */

export {
  GRAVITY_M_S2,
  CFL_NUMBER,
  REFERENCE_MAX_DEPTH_M,
  FLUX_W,
  FLUX_E,
  FLUX_N,
  FLUX_S,
  ASSAM_BOUNDARIES,
  createWaterGrid,
  stableDt,
  totalVolumeM3,
  stepWater,
  type BoundaryKind,
  type WaterBoundaries,
  type WaterGrid,
  type InflowSource,
} from './step.js';

export {
  buildSimGrid,
  deriveChannel,
  gridIndex,
  type SimGrid,
  type ChannelCells,
} from './channel.js';

export {
  WATER_SPEEDS,
  DEFAULT_WATER_SPEED,
  MIN_DISCHARGE_M3S,
  MAX_DISCHARGE_M3S,
  DISCHARGE_STEP_M3S,
  DEFAULT_DISCHARGE_M3S,
  WET_THRESHOLD_M,
  DEEP_DEPTH_M,
  probeFloatTargets,
  createWaterLayer,
  type WaterStats,
  type WaterLayerOptions,
  type WaterLayer,
} from './water-layer.js';
