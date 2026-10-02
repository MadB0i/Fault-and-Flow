/**
 * UI strings, English and Assamese, in one place.
 *
 * Both languages are defined here as a pair of records of the same shape, so a
 * missing Assamese string is a TypeScript error rather than a runtime fallback
 * to English. Per DESIGN.md section 2.3, every Assamese string must render in
 * Noto Sans Bengali -- tests/fonts.test.ts parses the shipped font binary and
 * asserts coverage of every codepoint below.
 *
 * ## The Assamese block below is DRAFT
 *
 * @see ../../docs/DECISIONS.md section 5 -- 2026-10-01
 *
 * All Assamese copy is an unreviewed first draft written from standard
 * orthography by a non-native speaker. It has been verified for GLYPH COVERAGE
 * ONLY -- that the shipped font contains ৰ (U+09F0), ৱ (U+09F1) and every other
 * codepoint used. Coverage proves the characters render; it says nothing about
 * whether the words are right.
 *
 * DO NOT ship this as reviewed copy. The owner, a native speaker, reviews it
 * before phase 7 (docs/ROADMAP.md). Until then the English below is
 * authoritative and the Assamese is not a translation of record.
 *
 * When a string is reviewed, strike the DRAFT marker on that line rather than
 * deleting this notice, so the remaining unreviewed strings stay visible.
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
  /**
   * The terrain-specific honesty line, shown over the scene.
   *
   * Separate from `disclaimerShort` because it is a statement about the
   * RENDER, and a reader looking at a 3D landscape needs that specific
   * reassurance rather than the general one. "Illustrative" is the operative
   * word: PRODUCT.md section 4.1 forbids any framing that implies prediction.
   */
  terrainIllustrativeNote: string;

  /** Construction status for phase 1. */
  phaseLabel: string;
  phaseBody: string;

  // --- Phase 3: the terrain viewer ---------------------------------------
  /** Accessible name for the canvas that shows the terrain. */
  terrainCanvasLabel: string;
  /** Hint for keyboard orbit and zoom, shown under the canvas. */
  terrainCanvasHint: string;
  /** The three committed areas. */
  areaOverviewTitle: string;
  areaMajuliTitle: string;
  areaSadiyaTitle: string;
  areaPickerLabel: string;

  /** Vertical exaggeration control. */
  exaggerationLabel: string;
  /** Unit-suffix for the exaggeration readout: "x" for multiples. */
  exaggerationValueSuffix: string;
  exaggerationHint: string;

  /** Contour toggle. */
  contoursLabel: string;
  contoursHint: string;

  /** Legend. */
  legendTitle: string;
  legendElevationLabel: string;
  legendContourLabel: string;
  legendExaggerationLabel: string;

  /** Pointer / camera-target readout. */
  readoutLabel: string;
  readoutUnderCursor: string;
  readoutCameraTarget: string;
  readoutElevationPrefix: string;
  readoutNoData: string;

  /** Attribution block, rendered from the sidecar. */
  attributionLabel: string;
  attributionLimitationsLabel: string;

  /** Reset the camera. */
  resetViewLabel: string;

  /** Loading and error states. */
  terrainLoading: string;
  terrainErrorWebgl: string;
  terrainErrorFloat: string;
  terrainErrorLoad: string;
  terrainRetry: string;
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

  disclaimerShort: 'An educational sandbox. Not a forecast and not a hazard map.',
  earthquakesCannotBePredicted:
    'Earthquakes cannot be predicted. No one can tell you when or where the ' +
    'next one will happen.',
  terrainIllustrativeNote:
    'Illustrative terrain model, not a hazard map or forecast. Heights on ' +
    'screen are exaggerated; the ground area is not.',

  phaseLabel: 'Phase 1 of 8 — foundation',
  phaseBody:
    'Design system and repository scaffolding only. No simulation, no 3D, no data.',

  // --- Phase 3 -----------------------------------------------------------
  terrainCanvasLabel:
    'Three-dimensional terrain view. Use the arrow keys to orbit, plus and ' +
    'minus to zoom, Home to reset.',
  terrainCanvasHint: 'Arrow keys orbit · + and − zoom · Home resets',

  areaOverviewTitle: 'Assam valley, whole',
  areaMajuliTitle: 'Majuli island',
  areaSadiyaTitle: 'Sadiya to Dibrugarh',
  areaPickerLabel: 'Area to view',

  exaggerationLabel: 'Vertical exaggeration',
  exaggerationValueSuffix: '×',
  exaggerationHint:
    'True scale is flat. This multiplies height only; the ground area is unchanged.',

  contoursLabel: 'Contour lines',
  contoursHint: 'Equal-height lines. The interval is shown in the legend.',

  legendTitle: 'Elevation',
  legendElevationLabel: 'Elevation above sea level',
  legendContourLabel: 'Contour interval',
  legendExaggerationLabel: 'Height shown at',

  readoutLabel: 'Elevation under the pointer',
  readoutUnderCursor: 'Pointer',
  readoutCameraTarget: 'Camera target (keyboard equivalent)',
  readoutElevationPrefix: 'Elevation',
  readoutNoData: 'No data here',

  attributionLabel: 'Terrain data',
  attributionLimitationsLabel: 'What this terrain is not',

  resetViewLabel: 'Reset the view',

  terrainLoading: 'Loading terrain…',
  terrainErrorWebgl: 'This browser cannot run the 3D terrain view. WebGL2 is required.',
  terrainErrorFloat:
    'This device cannot read 32-bit float textures, which the terrain needs to ' +
    'avoid quantising elevation into visible steps.',
  terrainErrorLoad: 'The terrain could not be loaded.',
  terrainRetry: 'Try again',
};

/**
 * Assamese. Sourced from the official Assamese orthography; every string here
 * is rendered in Noto Sans Bengali and its glyph coverage is asserted in
 * tests/fonts.test.ts. `languageAssamese` uses the U+09F0 letter ৰ in আৰু.
 *
 * DRAFT -- every string below is unreviewed. See docs/DECISIONS.md section 5.
 * Delete this marker only when the owner has reviewed the whole block.
 */
export const AS: Strings = {
  title: 'ফল্ট আৰু ফ্লো', // DRAFT
  tagline: 'এখন টেটোচে ঠেলা দিয়ে, সেই নদী সঙ্গে দিয়ে।', // DRAFT

  wordmark: 'ফল্ট আৰু ফ্লো', // DRAFT

  modeFlow: 'বান', // DRAFT
  modeFault: 'ভূমিকম্প', // DRAFT
  modePlates: 'টেবল', // DRAFT

  modeRailLabel: 'বালিৰ বোক্সৰ ধৰন', // DRAFT
  modeUnavailable: 'এতিয়ালৈ তৈয়া হোৱা নহয়', // DRAFT

  canvasEmptyTitle: 'এই খাতৰ ইয়াত দেখা যাব', // DRAFT
  canvasEmptyBody:
    // DRAFT
    'তিনিটা মাপৰ দৃশ্য তৃতীয় পৰ্যায়ত আহব। এই পৃষ্ঠাটো কেৱল আমৰ নকশাপত্ৰ পৰীক্ষা ' +
    'কৰিবলৈ বনানো হৈছে — আখৰ, ৰং, ভাষা বদলেৰা আৰু পেনেলৰ বিন্যাস।',

  languageToggleLabel: 'ভাষা', // DRAFT
  languageEnglish: 'ইংৰাজী', // DRAFT
  languageAssamese: 'অসমীয়া', // DRAFT

  disclaimerShort:
    // DRAFT
    'এখন শিক্ষামূলক বালিৰ বোক্স। ইয়া কোনো পূৰ্বাভাস বা বিপদ মানচিত্ৰ নহয়।',
  earthquakesCannotBePredicted:
    // DRAFT
    'ভূমিকম্প আগমন কৰিব নোৱাৰা যায়। কোনেও কাৰিও পুৱা নাই কোন সময়ত বা কোথাত ' +
    'পৰৱৰ্তী ভূমিকম্প হ’ব।',

  terrainIllustrativeNote:
    // DRAFT
    'এই ভূমিটো কেৱল ব্যাখ্যাৰ ছবি, কোনো বিপদ মানচিত্ৰ বা পূৰ্বাভাস নহয়। দেখুওৱা উচ্চতা বেছাই কৰা হৈছে, কিন্তু ভূমিৰ আকাৰ সেইকৈয়েই আছে।', // DRAFT

  phaseLabel: 'প্ৰথম পৰ্যায়, আটাৰ পৰা প্ৰথম', // DRAFT
  phaseBody:
    // DRAFT
    'কেৱল নকশাপত্ৰ আৰু পুৱা-সংৰক্ষণ। কোনো নকশা, তিনিটা-মাপৰ দৃশ্য বা তথ্য নহয়।',

  // --- Phase 3 -----------------------------------------------------------
  // Punctuation is kept to the ASCII range plus the Assamese block. The
  // shipping Noto Sans Bengali subsets are a bengali cut and a latin cut, and a
  // typographic minus or middot is not guaranteed to be in either; a tofu box in
  // the middle of a control hint is worse than an ASCII hyphen.
  terrainCanvasLabel:
    // DRAFT
    'তিনিটা মাপৰ ভূমিৰ দৃশ্য। বাঁৰী আৰু তীৰৰ বোতামেৰে ধাৰণ কৰক, আৰু প্ৰয়োজনীয় আৰু অপ্ৰয়োজনীয় বোতামেৰে ইমান-ঘমানি কৰক।', // DRAFT
  terrainCanvasHint: 'তীৰ বোতাম ধাৰণ, + আৰু - ইমান-ঘমানি, Home পুনৰ সেট', // DRAFT

  areaOverviewTitle: 'সমগ্ৰ অসম ঘাটি', // DRAFT
  areaMajuliTitle: 'মাজুলী দ্বীপ', // DRAFT
  areaSadiyaTitle: 'সদিয়াৰ পৰা ডিব্ৰুগড়', // DRAFT
  areaPickerLabel: 'কোন ঠাই দেখিব', // DRAFT

  exaggerationLabel: 'লম্বালম্ব দৃশ্য বেছলাশ', // DRAFT
  exaggerationValueSuffix: '×', // DRAFT
  exaggerationHint:
    // DRAFT
    'আসল ঠিক মাপে ভূমি সেহত। ইয়া কেৱল উচ্চতা বেছাই দিয়ে, ভূমিৰ আকাৰ একে থাকে।', // DRAFT

  contoursLabel: 'সমান উচ্চতাৰ ৰেখা', // DRAFT
  contoursHint: 'সমান উচ্চতাৰ ৰেখা, আৰু প্ৰতিটো ৰেখাৰ পৰ্যবেক্তা লিখা আছে।', // DRAFT

  legendTitle: 'উচ্চতা', // DRAFT
  legendElevationLabel: 'সমুদ্ৰৰ পৰা উচ্চতা', // DRAFT
  legendContourLabel: 'ৰেখাৰ মাপৰ পৰ্যবেক্তা', // DRAFT
  legendExaggerationLabel: 'যি মাপে দেখুওৱা হয়', // DRAFT

  readoutLabel: 'বোতামৰ তলত থকা উচ্চতা', // DRAFT
  readoutUnderCursor: 'বোতাম', // DRAFT
  readoutCameraTarget: 'কেমেৰাৰ লক্ষ্য, বোতামৰ সমান', // DRAFT
  readoutElevationPrefix: 'উচ্চতা', // DRAFT
  readoutNoData: 'এখানে তথ্য নাই', // DRAFT

  attributionLabel: 'ভূমিৰ তথ্য', // DRAFT
  attributionLimitationsLabel: 'এই ভূমি কি নহয়', // DRAFT

  resetViewLabel: 'দৃশ্যটো পুনৰ সজাই দিয়া', // DRAFT

  terrainLoading: 'ভূমি আনা হৈছে', // DRAFT
  terrainErrorWebgl:
    // DRAFT
    'এই ব্ৰাৱাৰে তিনিটা-মাপৰ ভূমি দেখাব নাযায়, কাৰণ WebGL2 প্ৰয়োজন।', // DRAFT
  terrainErrorFloat:
    // DRAFT
    'এই যন্ত্ৰই ৩২-বিট ফ্লোট ছবিপড় পঢ়া পুৰা নাযায়, আৰু উচ্চতাক স্পষ্ট স্তৰত টুকুৱাবলৈ ভূমিটোক এইটো লাগে।', // DRAFT
  terrainErrorLoad: "ভূমিটো আনা নহ'ল।", // DRAFT
  terrainRetry: 'পুনৰ চেষ্টা কৰা', // DRAFT
};

/**
 * Review status of the Assamese copy. `DRAFT` means no native-speaker review
 * has happened; nothing marked DRAFT may ship as final copy.
 *
 * Surfaced here rather than only in a comment so that a test or an about
 * screen can read it, and so deleting the comment block above cannot quietly
 * drop the signal.
 *
 * @see ../../docs/DECISIONS.md section 5
 */
export const ASSAMESE_COPY_STATUS = 'DRAFT' as const;
export type AssameseCopyStatus = typeof ASSAMESE_COPY_STATUS;

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
