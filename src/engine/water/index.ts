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
