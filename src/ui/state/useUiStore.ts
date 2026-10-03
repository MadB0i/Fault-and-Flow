/**
 * UI state only. The engine owns everything about the 3D scene; this store owns
 * what the HUD needs to render. See docs/ARCHITECTURE.md section 2.
 */

import { create } from 'zustand';

import type { Locale } from '../../shared/types.js';
import { type AtlasPresentation } from '../../shared/atlas.js';
import { parseViewLink } from '../../shared/view-link.js';
import { STRINGS, type Strings } from '../../shared/i18n/strings.js';

interface UiState {
  locale: Locale;
  /** Locales the user has explicitly chosen, most recent last. */
  setLocale: (locale: Locale) => void;
  atlas: AtlasPresentation;
  setAtlas: (
    next: AtlasPresentation | ((previous: AtlasPresentation) => AtlasPresentation),
  ) => void;
  /** Resolved strings for the current locale. */
  strings: () => Strings;
}

export const useUiStore = create<UiState>((set, get) => ({
  locale: initialPresentation().locale,
  setLocale: (locale) => set({ locale }),
  atlas: initialPresentation(),
  setAtlas: (next) =>
    set((state) => ({ atlas: typeof next === 'function' ? next(state.atlas) : next })),
  strings: () => STRINGS[get().locale],
}));

export function initialPresentation(): AtlasPresentation {
  return parseViewLink(typeof location === 'undefined' ? '' : location.search);
}
