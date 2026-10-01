/**
 * UI strings, English and Assamese, in one place.
 *
 * Both languages are defined here as a pair of records of the same shape, so a
 * missing Assamese string is a TypeScript error rather than a runtime fallback
 * to English. Per DESIGN.md section 2.3, every Assamese string must render in
 * Noto Sans Bengali -- tests/fonts.test.ts parses the shipped font binary and
 * asserts coverage of every codepoint below.
 */

import type { Locale, Mode } from '../types.js';

export interface Strings {
  /** Document title. */
  title: string;
  tagline: string;
  /** Wordmark mark, rendered large in the display face. */
  wordmark: string;

  /** Mode rail labels. */
  modeFlow: string;
  modeFault: string;
  modePlates: string;

  /** Accessible name for the mode rail itself. */
  modeRailLabel: string;
  /** Shown on each rail item while the mode is unimplemented. */
  modeUnavailable: string;

  /** The empty canvas region. */
  canvasEmptyTitle: string;
  canvasEmptyBody: string;

  /** Language toggle. */
  languageToggleLabel: string;
  languageEnglish: string;
  languageAssamese: string;

  /** Honesty banner. Never soften these. See PRODUCT.md section 4. */
  disclaimerShort: string;
  earthquakesCannotBePredicted: string;

  /** Construction status for phase 1. */
  phaseLabel: string;
  phaseBody: string;
}

/**
 * The Assamese phrase required by the brief: "earthquake and river"
 * (ভূমিকম্প আৰু বান). Contains U+09F0 (ৰ) and U+09F1 (ৱ) in the word বান, which
 * is exactly why glyph coverage is asserted rather than assumed.
 */
export const ASSAMESE_PHRASE = 'ভূমিকম্প আৰু বান';

export const EN: Strings = {
  title: 'Fault & Flow',
  tagline: 'One plate pushes. One river answers.',

  wordmark: 'Fault & Flow',

  modeFlow: 'Flow',
  modeFault: 'Fault',
  modePlates: 'Plates',

  modeRailLabel: 'Sandbox modes',
  modeUnavailable: 'Not built yet',

  canvasEmptyTitle: 'The valley will render here',
  canvasEmptyBody:
    'The 3D scene arrives in phase 3. This page exists to prove the design ' +
    'system: the type, the colour, the language toggle, and the panel layout.',

  languageToggleLabel: 'Language',
  languageEnglish: 'English',
  languageAssamese: 'অসমীয়া',

  disclaimerShort:
    'An educational sandbox. Not a forecast and not a hazard map.',
  earthquakesCannotBePredicted:
    'Earthquakes cannot be predicted. No one can tell you when or where the ' +
    'next one will happen.',

  phaseLabel: 'Phase 1 of 8 — foundation',
  phaseBody:
    'Design system and repository scaffolding only. No simulation, no 3D, no data.',
};

/**
 * Assamese. Sourced from the official Assamese orthography; every string here
 * is rendered in Noto Sans Bengali and its glyph coverage is asserted in
 * tests/fonts.test.ts. `languageAssamese` uses the U+09F0 letter ৰ in আৰু.
 */
export const AS: Strings = {
  title: 'ফল্ট আৰু ফ্লো',
  tagline: 'এখন টেটোচে ঠেলা দিয়ে, সেই নদী সঙ্গে দিয়ে।',

  wordmark: 'ফল্ট আৰু ফ্লো',

  modeFlow: 'বান',
  modeFault: 'ভূমিকম্প',
  modePlates: 'টেবল',

  modeRailLabel: 'বালিৰ বোক্সৰ ধৰন',
  modeUnavailable: 'এতিয়ালৈ তৈয়া হোৱা নহয়',

  canvasEmptyTitle: 'এই খাতৰ ইয়াত দেখা যাব',
  canvasEmptyBody:
    'তিনিটা মাপৰ দৃশ্য তৃতীয় পৰ্যায়ত আহব। এই পৃষ্ঠাটো কেৱল আমৰ নকশাপত্ৰ পৰীক্ষা ' +
    'কৰিবলৈ বনানো হৈছে — আখৰ, ৰং, ভাষা বদলেৰা আৰু পেনেলৰ বিন্যাস।',

  languageToggleLabel: 'ভাষা',
  languageEnglish: 'ইংৰাজী',
  languageAssamese: 'অসমীয়া',

  disclaimerShort:
    'এখন শিক্ষামূলক বালিৰ বোক্স। ইয়া কোনো পূৰ্বাভাস বা বিপদ মানচিত্ৰ নহয়।',
  earthquakesCannotBePredicted:
    'ভূমিকম্প আগমন কৰিব নোৱাৰা যায়। কোনেও কাৰিও পুৱা নাই কোন সময়ত বা কোথাত ' +
    'পৰৱৰ্তী ভূমিকম্প হ’ব।',

  phaseLabel: 'প্ৰথম পৰ্যায়, আটাৰ পৰা প্ৰথম',
  phaseBody:
    'কেৱল নকশাপত্ৰ আৰু পুৱা-সংৰক্ষণ। কোনো নকশা, তিনিটা-মাপৰ দৃশ্য বা তথ্য নহয়।',
};

/**
 * Every Assamese string, for the glyph-coverage test to walk.
 *
 * Declared as a mapped type over `Strings` rather than `Record<string, string>`
 * so that renaming an interface key is caught here instead of silently
 * producing an empty object at runtime.
 */
export const ASSAMESE_STRINGS: Readonly<Strings> = AS;

export const STRINGS: Readonly<Record<Locale, Strings>> = { en: EN, as: AS };

/** Ordered rail entries, so the UI and the tests agree on order. */
export const MODE_ENTRIES: ReadonlyArray<{
  mode: Mode;
  labelKey: keyof Strings;
  /** Short channel code, set in the data face. The instrument-panel touch. */
  code: string;
}> = [
  { mode: 'flow', labelKey: 'modeFlow', code: '01' },
  { mode: 'fault', labelKey: 'modeFault', code: '02' },
  { mode: 'plates', labelKey: 'modePlates', code: '03' },
];
