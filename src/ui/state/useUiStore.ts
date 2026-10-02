/**
 * UI state only. The engine owns everything about the 3D scene; this store owns
 * what the HUD needs to render. See docs/ARCHITECTURE.md section 2.
 */

import { create } from 'zustand';

import type { Locale } from '../../shared/types.js';
import { STRINGS, type Strings } from '../../shared/i18n/strings.js';

interface UiState {
  locale: Locale;
  /** Locales the user has explicitly chosen, most recent last. */
  setLocale: (locale: Locale) => void;
  /** Resolved strings for the current locale. */
  strings: () => Strings;
}

export const useUiStore = create<UiState>((set, get) => ({
  locale: 'en',
  setLocale: (locale) => set({ locale }),
  strings: () => STRINGS[get().locale],
}));
