/** Serialisable atlas controls. No rendering or framework types cross this boundary. */
import type { Mode, Locale } from './types.js';

export interface AtlasPresentation {
  mode: Mode;
  locale: Locale;
  rivers: boolean;
  boundaries: boolean;
  places: boolean;
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
  quakeYear: 2026,
  selectedQuake: null,
  motionIllustration: 0,
  collision: 0.65,
};
