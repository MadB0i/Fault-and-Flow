/**
 * Shared types. This module is the framework-free contract both the engine and
 * the UI depend on, so it must not import Three.js or React.
 * See docs/ARCHITECTURE.md section 2.
 */

/** The three modes of the sandbox. */
export type Mode = 'plates' | 'fault' | 'flow';

/** UI languages. Assamese is a first-class rendering path, not a translation. */
export type Locale = 'en' | 'as';

export const MODES: readonly Mode[] = ['plates', 'fault', 'flow'] as const;
export const LOCALES: readonly Locale[] = ['en', 'as'] as const;

/**
 * Where a value came from. The UI must render these differently and must never
 * flatten them: a modelled number is one refactor away from being presented as
 * a measurement, which is the failure PRODUCT.md section 4 exists to prevent.
 */
export type Provenance =
  | { kind: 'measured'; source: string; url: string; retrieved: string }
  | { kind: 'modelled'; note: string }
  | { kind: 'illustrative' }
  | { kind: 'unknown' };

/** A terrain sample the HUD can read. */
export interface TerrainSample {
  /** Metres above sea level, or null when unknown. Never a placeholder 0. */
  elevationM: number | null;
  /**
   * Cubic metres per second at this location, or null when unknown.
   *
   * This is the water engine's **scenario-derived** flux — a consequence of the
   * inflow the user set, not a reading of the river. It can never be
   * `kind: 'measured'` provenance. Do not render it as an observation.
   * See docs/DECISIONS.md sections 3 and 7.
   */
  dischargeM3s: number | null;
  provenance: Provenance;
}

/** A serialisable snapshot of engine state, for HUD render and share cards. */
export interface EngineSnapshot {
  mode: Mode;
  /** Seconds on the mode's own clock. */
  time: number;
  playing: boolean;
  /** Progress 0..1 through the mode's timeline. */
  progress: number;
  sample: TerrainSample | null;
  /** True while a dataset is still loading. */
  loading: boolean;
}

/** One recorded earthquake. All fields trace to a cited catalogue record. */
export interface QuakeEvent {
  id: string;
  /** ISO 8601 UTC. */
  time: string;
  latitude: number;
  longitude: number;
  /** Moment magnitude, or null when the catalogue does not record one. */
  magnitude: number | null;
  /** Metres, or null when the catalogue does not record one. */
  depthM: number | null;
  place: string;
  source: string;
  url: string;
}

/** Parameters of the (illustrative) flood model. */
export interface FlowParams {
  /**
   * User-chosen scenario value in m3/s; NOT an observed discharge.
   *
   * Renamed from `dischargeM3s` because the old name implied an instrument
   * reading. There is no gauge, no station and no observation behind this
   * number — the user sets it, and the water engine responds. Any UI surface
   * that renders it must label it as a scenario the user chose.
   * See docs/DECISIONS.md sections 3 and 7.
   */
  scenarioInflowM3s: number;
  /** Manning's n. Chosen for legibility and documented in ARCHITECTURE.md. */
  manningN: number;
  /** Simulation steps per second, independent of frame rate. */
  stepsPerSecond: number;
}

/**
 * Starting scenario. The inflow is an arbitrary starting point chosen for
 * legibility, deliberately not tuned to match any real gauged event — see
 * AGENTS.md section 6 on never standing a plausible-looking constant in for a
 * measurement.
 */
export const DEFAULT_FLOW_PARAMS: FlowParams = {
  scenarioInflowM3s: 8000,
  manningN: 0.03,
  stepsPerSecond: 20,
};
