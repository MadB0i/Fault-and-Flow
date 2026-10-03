/**
 * UI state only. The engine owns everything about the 3D scene; this store owns
 * what the HUD needs to render. See docs/ARCHITECTURE.md section 2.
 */

import { create } from 'zustand';

import type { Locale } from '../../shared/types.js';
import { INITIAL_ATLAS, type AtlasPresentation } from '../../shared/atlas.js';
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
  locale: 'en',
  setLocale: (locale) => set({ locale }),
  atlas: initialPresentation(),
  setAtlas: (next) =>
    set((state) => ({ atlas: typeof next === 'function' ? next(state.atlas) : next })),
  strings: () => STRINGS[get().locale],
}));

export function initialPresentation(): AtlasPresentation {
  const mode =
    typeof location === 'undefined'
      ? null
      : new URLSearchParams(location.search).get('mode');
  return {
    ...INITIAL_ATLAS,
    mode: mode === 'fault' || mode === 'plates' ? mode : 'flow',
  };
}
