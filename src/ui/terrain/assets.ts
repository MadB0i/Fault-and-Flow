/**
 * Asset URLs for the committed terrain artefacts, and the palette read out of
 * the CSS custom properties.
 *
 * Two rules live here.
 *
 * **Colours come from tokens, read at runtime.** The engine is handed hex
 * strings and holds no colour of its own, so a palette change in tokens.css
 * reaches the render with no code edit and no duplicated hex to drift. The
 * engine-architecture test asserts that no hex literal exists under
 * src/engine/, which is what stops this being quietly undone.
 *
 * **Data is imported with `?url`, not copied.** Vite emits each artefact as a
 * hashed asset and gives us its URL, so there is no build step that can forget
 * to copy a file, and the URL already carries Vite's configured `base`. That is
 * what makes a GitHub Pages deployment a one-line config change rather than a
 * path bug - see docs/ARCHITECTURE.md.
 */

import type { AreaId } from '@engine/terrain';
import type { AreaSources, TerrainPalette } from '@engine/terrain';

import assamOverviewPng from '../../../data/processed/assam-overview.png?url';
import assamOverviewSidecar from '../../../data/processed/assam-overview.json?url';
import majuliPng from '../../../data/processed/majuli.png?url';
import majuliSidecar from '../../../data/processed/majuli.json?url';
import sadiyaPng from '../../../data/processed/sadiya-dibrugarh.png?url';
import sadiyaSidecar from '../../../data/processed/sadiya-dibrugarh.json?url';

export const AREA_SOURCES: AreaSources = {
  'assam-overview': { pngUrl: assamOverviewPng, sidecarUrl: assamOverviewSidecar },
  majuli: { pngUrl: majuliPng, sidecarUrl: majuliSidecar },
  'sadiya-dibrugarh': { pngUrl: sadiyaPng, sidecarUrl: sadiyaSidecar },
};

/**
 * Read the terrain palette out of the document's custom properties.
 *
 * Called against the root element rather than the canvas so the values exist
 * before the canvas is laid out, and re-read on mount so a theme change would be
 * picked up without a rebuild.
 *
 * The two derived entries have reasons rather than being arbitrary:
 *
 * - Contours use `--text-muted` because it is the only neutral in the palette
 *   with any contrast against BOTH ends of the terrain ramp. `--text` vanishes
 *   against `--terrain-4` and `--bg` vanishes against `--terrain-1`, and a
 *   contour line that cannot be seen on the highest ground is worse than none.
 * - No-data uses `--surface-raised`, one step above the background, so a hole in
 *   the data reads as flat rather than as terrain.
 */
export function readPalette(element: Element): TerrainPalette {
  const style = getComputedStyle(element);
  const token = (name: string): string => style.getPropertyValue(name).trim();

  return {
    bg: token('--bg'),
    terrain1: token('--terrain-1'),
    terrain2: token('--terrain-2'),
    terrain3: token('--terrain-3'),
    terrain4: token('--terrain-4'),
    contour: token('--text-muted'),
    noData: token('--surface-raised'),
  };
}

/**
 * Whether the OS asks for reduced motion.
 *
 * Read once here rather than inside the engine, because the engine is not
 * allowed to touch the DOM outside the canvas it was handed. The hook also
 * listens for changes, so toggling the setting at runtime takes effect.
 */
export function prefersReducedMotion(): boolean {
  if (typeof globalThis.matchMedia !== 'function') return false;
  return globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Convenience for the hook: the palette for the document root. */
export function readDocumentPalette(): TerrainPalette {
  return readPalette(document.documentElement);
}

/** Which areas have assets wired up, for the picker. */
export function availableAreas(): AreaId[] {
  return Object.keys(AREA_SOURCES) as AreaId[];
}
