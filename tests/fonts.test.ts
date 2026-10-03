/**
 * Assamese glyph coverage, verified against the font file we actually ship.
 *
 * This test exists because Assamese is easy to break silently. Assamese uses
 * U+09F0 (RA, ৰ) and U+09F1 (RHA, ৱ), which many fonts that claim "Bengali"
 * support do not actually contain. A missing glyph renders as a tofu box and
 * nothing else fails -- no type error, no build error, no console warning.
 *
 * So: read the binary, read its cmap, and assert coverage of every codepoint
 * in every string we ship. See AGENTS.md section 9 and DESIGN.md section 2.3.
 */

import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { codePointsInFontFile, codePointsInString } from './helpers/woff2.js';
import { ASSAMESE_STRINGS, ASSAMESE_COPY_STATUS } from '@shared/i18n/strings.js';
import { ATLAS_COPY } from '@shared/i18n/atlas.js';

const here = dirname(fileURLToPath(import.meta.url));
const fontRoot = resolve(here, '../node_modules/@fontsource/noto-sans-bengali/files');

/** The weight the UI actually loads. Change it here and in tokens.css together. */
const SHIPPED_WEIGHTS = [400, 500, 600] as const;

/** Path of a subset file for a weight. */
const subsetPath = (weight: number, subset: 'bengali' | 'latin'): string =>
  resolve(fontRoot, `noto-sans-bengali-${subset}-${weight}-normal.woff2`);

/**
 * Coverage the browser actually has for Noto Sans Bengali at a given weight.
 *
 * The stylesheet loads the `bengali` and `latin` subsets as separate
 * @font-face rules, so a codepoint is rendered if EITHER file contains it.
 * Checking only the bengali subset would produce a false failure for every
 * comma, apostrophe and em-dash in an Assamese sentence.
 */
const shippedCoverage = (weight: number): Set<number> => {
  const bengali = codePointsInFontFile(subsetPath(weight, 'bengali'));
  const latin = codePointsInFontFile(subsetPath(weight, 'latin'));
  return new Set([...bengali, ...latin]);
};

/**
 * The two codepoints called out in the brief, because they are the ones a
 * Bengali-subset font is most likely to be missing.
 */
const RA = 0x09f0; // ৰ
const RHA = 0x09f1; // ৱ

describe('Noto Sans Bengali — shipped font files', () => {
  it('ships the subset files we reference', () => {
    for (const weight of SHIPPED_WEIGHTS) {
      for (const subset of ['bengali', 'latin'] as const) {
        const path = subsetPath(weight, subset);
        expect(existsSync(path), `missing font file: ${path}`).toBe(true);
      }
    }
  });

  it.each(SHIPPED_WEIGHTS)(
    'the bengali subset contains ৰ (U+09F0) and ৱ (U+09F1)',
    (weight) => {
      // Checked against the bengali subset specifically: these are the two
      // glyphs a "Bengali-capable" font is most likely to be missing, and
      // they must come from the script subset, not be rescued by latin.
      const covered = codePointsInFontFile(subsetPath(weight, 'bengali'));
      expect(covered.has(RA), `ৰ U+09F0 missing at weight ${weight}`).toBe(true);
      expect(covered.has(RHA), `ৱ U+09F1 missing at weight ${weight}`).toBe(true);
    },
  );

  it.each(SHIPPED_WEIGHTS)(
    'weight %i covers every codepoint in every shipped Assamese string',
    (weight) => {
      const covered = shippedCoverage(weight);
      const missing: string[] = [];

      for (const [key, value] of Object.entries({
        ...ASSAMESE_STRINGS,
        ...ATLAS_COPY.as,
      })) {
        for (const codePoint of codePointsInString(value)) {
          if (!covered.has(codePoint)) {
            const glyph = String.fromCodePoint(codePoint);
            missing.push(
              `${key}: ${JSON.stringify(glyph)} ` +
                `(U+${codePoint.toString(16).toUpperCase().padStart(4, '0')})`,
            );
          }
        }
      }

      expect(missing, `Assamese glyphs missing at weight ${weight}`).toEqual([]);
    },
  );

  it('the required Assamese phrase is fully covered', () => {
    // The exact string from the brief, asserted independently of the strings
    // table so that editing a translation cannot quietly remove this check.
    const covered = shippedCoverage(400);
    const phrase = 'ভূমিকম্প আৰু বান';

    // আৰু carries U+09F0 (ৰ). Note U+09F1 (ৱ) does not occur in this phrase -
    // বান is ব + া + ন - so it is covered by the font assertions above rather
    // than by this string. Both glyphs are still required of the shipped font.
    expect(phrase).toContain('ৰ');
    expect(phrase).not.toContain('ৱ');

    for (const codePoint of codePointsInString(phrase)) {
      expect(
        covered.has(codePoint),
        `"${String.fromCodePoint(codePoint)}" ` +
          `(U+${codePoint.toString(16).toUpperCase()}) missing`,
      ).toBe(true);
    }
  });

  it('every font stack includes the shipped Assamese face', () => {
    // Fraunces and JetBrains Mono contain no Assamese glyphs. If they are not
    // followed by Noto Sans Bengali, an Assamese heading or data label falls
    // through to the generic `serif`/`monospace` keyword and the OS picks the
    // font - which renders, but differently on every platform.
    const tokens = readFileSync(resolve(here, '../src/ui/styles/tokens.css'), 'utf8');

    for (const variable of [
      '--font-display',
      '--font-ui',
      '--font-data',
      '--font-assamese',
    ]) {
      const match = new RegExp(`${variable}:\\s*([^;]+);`).exec(tokens);
      expect(match, `${variable} is not defined in tokens.css`).not.toBeNull();
      expect(
        match?.[1],
        `${variable} must list "Noto Sans Bengali" in its fallback stack`,
      ).toContain("'Noto Sans Bengali'");
    }
  });

  it('the bengali subset covers the Assamese block', () => {
    // Sanity check on the parser itself: the bengali subset should cover most
    // of the Assamese block U+0980-09FE. If this fails wholesale, the cmap
    // reader is wrong and the assertions above are meaningless.
    const covered = codePointsInFontFile(subsetPath(400, 'bengali'));
    const gaps: number[] = [];

    for (let cp = 0x0980; cp <= 0x09fe; cp += 1) {
      if (!covered.has(cp)) gaps.push(cp);
    }

    // A handful of unassigned codepoints in the block is normal for a font;
    // a wholesale failure would indicate a broken reader.
    expect(gaps.length).toBeLessThan(40);
  });
});

describe('Assamese copy review status', () => {
  it('is still marked DRAFT, pending native-speaker review', () => {
    // docs/DECISIONS.md section 5, 2026-10-01: glyph coverage is verified, the
    // words are not. This assertion exists so that dropping the marker - and
    // with it the signal that the copy is unreviewed - fails a test rather
    // than passing silently.
    expect(ASSAMESE_COPY_STATUS).toBe('DRAFT');
  });

  it('keeps the DRAFT marker in the source file itself', () => {
    // The exported constant is convenient; the comment is what a human reads
    // before editing a string. Losing either is a regression.
    const source = readFileSync(resolve(here, '../src/shared/i18n/strings.ts'), 'utf8');
    expect(source).toContain('DRAFT');
    expect(source).toContain('DECISIONS.md');
  });
});

describe('Noto Sans Bengali — latin subset', () => {
  it('covers the ASCII range the UI needs', () => {
    const covered = codePointsInFontFile(subsetPath(400, 'latin'));

    for (const ch of 'Fault & Flow0123456789') {
      expect(
        covered.has(ch.codePointAt(0)!),
        `latin subset missing ${JSON.stringify(ch)}`,
      ).toBe(true);
    }
  });
});
