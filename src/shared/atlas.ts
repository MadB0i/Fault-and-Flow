/** Serialisable atlas controls. No rendering or framework types cross this boundary. */
import type { Mode, Locale } from './types.js';

export interface AtlasPresentation {
  mode: Mode;
  locale: Locale;
  rivers: boolean;
  boundaries: boolean;
  places: boolean;
  /** Display only: the simulation is identical in both views. */
  flowView: 'surface' | 'depth';
  sectionOpen: boolean;
  /** West-to-east column of the simulation grid, normalised to 0..1. */
  sectionPosition: number;
  quakeYear: number;
  selectedQuake: string | null;
  /** Replay counter for synthetic ground motion, not a recorded shaking field. */
  motionIllustration: number;
  /** Normalised, explicitly schematic collision progress; not a geological date. */
  collision: number;
}

export const INITIAL_ATLAS: AtlasPresentation = {
  mode: 'flow',
  locale: 'en',
  rivers: true,
  boundaries: true,
  places: true,
  flowView: 'surface',
  sectionOpen: false,
  sectionPosition: 0.5,
  quakeYear: 2026,
  selectedQuake: null,
  motionIllustration: 0,
  collision: 0.65,
};

export interface RiverSection {
  longitude: number;
  northLatitude: number;
  southLatitude: number;
  simTimeS: number;
  samples: readonly {
    distanceM: number;
    terrainM: number | null;
    depthM: number | null;
  }[];
}
