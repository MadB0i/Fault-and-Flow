/**
 * WCAG 2.x contrast checker for the Fault & Flow palette.
 *
 * Contrast is COMPUTED, never estimated. Run this any time a colour token
 * changes and paste the output table into DESIGN.md.
 *
 *   node scripts/check-contrast.mjs            # human-readable table
 *   node scripts/check-contrast.mjs --json     # machine-readable, for CI
 *   node scripts/check-contrast.mjs --check    # exit 1 if any pair fails AA
 *
 * Ratios are rounded to 2dp for display but the pass/fail decision uses the
 * unrounded value, so a pair at 4.499:1 correctly FAILS.
 */

const TOKENS = {
  bg: '#0A0F14',
  surface: '#111A22',
  'surface-raised': '#172430',
  hairline: '#22323F',
  text: '#E6EDF3',
  'text-muted': '#8CA0B0',
  water: '#3FD0E0',
  'water-deep': '#0E5A73',
  'seismic-amber': '#FFB547',
  'seismic-hot': '#FF5A3C',
  'seismic-light': '#ff968a',
  'seismic-red': '#ff4f64',
  'plate-line': '#9AA7B4',
  'terrain-1': '#1C3B35',
  'terrain-2': '#3E5B45',
  'terrain-3': '#8B7E5A',
  'terrain-4': '#D8D2C4',
};

/** WCAG 2.1 normal-text minimum. */
const AA_TEXT = 4.5;
/** WCAG 2.1 large-text minimum (>=24px, or >=18.66px bold). */
const AA_LARGE = 3.0;
/** WCAG 2.2 SC 1.4.11 — non-text UI boundaries and focus indicators. */
const AA_NON_TEXT = 3.0;
/**
 * Decorative: no minimum. A purely ornamental hairline separator is out of
 * scope for SC 1.4.11, which covers boundaries "required to identify a
 * component", "states", and "parts of graphics required to understand the
 * content". It is NOT exempt when the boundary is the only thing telling a
 * keyboard or low-vision user where a control begins and ends — that needs
 * --border-strong, not --hairline. See DESIGN.md.
 */
const DECORATIVE = 0;

/**
 * Pairs actually used by the interface.
 * kind: 'text' | 'large' | 'non-text'
 */
const PAIRS = [
  ...['seismic-light', 'seismic-red'].flatMap((fg) =>
    ['bg', 'surface', 'surface-raised'].map((bg) => ({
      fg,
      bg,
      kind: 'text',
      use: 'Recorded magnitude band label',
    })),
  ),
  // Body and primary text on every surface it can appear on.
  { fg: 'text', bg: 'bg', kind: 'text', use: 'Body text on page background' },
  { fg: 'text', bg: 'surface', kind: 'text', use: 'Body text on HUD panel' },
  { fg: 'text', bg: 'surface-raised', kind: 'text', use: 'Body text on raised HUD' },
  { fg: 'text-muted', bg: 'bg', kind: 'text', use: 'Muted/meta text on background' },
  { fg: 'text-muted', bg: 'surface', kind: 'text', use: 'Muted/meta text on HUD panel' },
  {
    fg: 'text-muted',
    bg: 'surface-raised',
    kind: 'text',
    use: 'Muted/meta text on raised HUD',
  },

  // Wordmark / display type.
  { fg: 'text', bg: 'surface', kind: 'large', use: 'Display title on HUD panel' },

  // Accents as text and as focus rings.
  { fg: 'water', bg: 'bg', kind: 'text', use: 'Water label / readout' },
  { fg: 'water', bg: 'surface', kind: 'text', use: 'Water label on HUD panel' },
  { fg: 'water', bg: 'surface-raised', kind: 'text', use: 'Water label on raised HUD' },
  { fg: 'seismic-amber', bg: 'bg', kind: 'text', use: 'Seismic label / readout' },
  { fg: 'seismic-amber', bg: 'surface', kind: 'text', use: 'Seismic label on HUD panel' },
  {
    fg: 'seismic-amber',
    bg: 'surface-raised',
    kind: 'text',
    use: 'Seismic label on raised HUD',
  },
  { fg: 'seismic-hot', bg: 'bg', kind: 'text', use: 'Hot-seismicity label' },
  { fg: 'seismic-hot', bg: 'surface', kind: 'text', use: 'Hot-seismicity label on HUD' },

  // Focus indicator: the ring must clear 3:1 against BOTH surfaces it sits on.
  { fg: 'water', bg: 'surface', kind: 'non-text', use: 'Focus ring on HUD panel' },
  { fg: 'water', bg: 'bg', kind: 'non-text', use: 'Focus ring on background' },

  // Non-text UI boundaries (WCAG 2.2 SC 1.4.11). A decorative divider carries
  // no information, so it is exempt; the meaningful boundaries below are not.
  {
    fg: 'hairline',
    bg: 'bg',
    kind: 'decorative',
    use: 'Decorative divider on background',
  },
  {
    fg: 'hairline',
    bg: 'surface',
    kind: 'decorative',
    use: 'Decorative divider on HUD panel',
  },
  { fg: 'plate-line', bg: 'bg', kind: 'non-text', use: 'Plate boundary line (3D scene)' },
  {
    fg: 'plate-line',
    bg: 'surface',
    kind: 'non-text',
    use: 'Plate boundary line over HUD',
  },

  // Terrain ramp — 3D fills, checked against the page only for legibility.
  { fg: 'terrain-4', bg: 'bg', kind: 'non-text', use: 'Terrain high-elevation vs bg' },
  { fg: 'terrain-1', bg: 'bg', kind: 'non-text', use: 'Terrain low-elevation vs bg' },
  { fg: 'water-deep', bg: 'bg', kind: 'non-text', use: 'Deep-water fill vs bg' },
];

const thresholdFor = (kind) =>
  kind === 'text'
    ? AA_TEXT
    : kind === 'large'
      ? AA_LARGE
      : kind === 'non-text'
        ? AA_NON_TEXT
        : DECORATIVE;

/** sRGB hex -> linear-light channel. */
function linearise(channel8) {
  const c = channel8 / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** '#RRGGBB' -> [r,g,b] in 0..255. Throws on malformed input. */
function parseHex(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim());
  if (!m) throw new Error(`Not a 6-digit hex colour: ${hex}`);
  const int = parseInt(m[1], 16);
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
}

/**
 * WCAG relative luminance.
 * https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 */
function relativeLuminance(hex) {
  const [r, g, b] = parseHex(hex);
  return 0.2126 * linearise(r) + 0.7152 * linearise(g) + 0.0722 * linearise(b);
}

/**
 * WCAG 2.1 contrast ratio, 1..21.
 * Order-independent: (L1 + 0.05) / (L2 + 0.05) with L1 the lighter.
 */
export function contrastRatio(fgHex, bgHex) {
  const l1 = relativeLuminance(fgHex);
  const l2 = relativeLuminance(bgHex);
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

const toHex = ([r, g, b]) =>
  '#' +
  [r, g, b]
    .map((v) =>
      Math.max(0, Math.min(255, Math.round(v)))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')
    .toUpperCase();

/**
 * Smallest change to the foreground that reaches `target`, or null if it
 * already passes. Scales the colour toward white or black — whichever needs
 * fewer steps — so the recommendation preserves the token's hue rather than
 * substituting a different colour. Returns the new hex plus the ratio.
 */
function smallestAdjustment(fgHex, bgHex, target) {
  const start = parseHex(fgHex);
  // To increase contrast, push the foreground AWAY from the background's
  // luminance: a foreground already lighter than the background must get
  // brighter (toward white), one already darker must get darker (toward black).
  const towardWhite = relativeLuminance(fgHex) > relativeLuminance(bgHex);
  const end = towardWhite ? [255, 255, 255] : [0, 0, 0];

  for (let step = 1; step <= 255; step += 1) {
    const t = step / 255;
    const candidate = toHex(start.map((c, i) => c + (end[i] - c) * t));
    if (contrastRatio(candidate, bgHex) >= target) {
      return { hex: candidate, ratio: contrastRatio(candidate, bgHex) };
    }
  }
  return null;
}

function evaluate() {
  return PAIRS.map(({ fg, bg, kind, use }) => {
    const ratio = contrastRatio(TOKENS[fg], TOKENS[bg]);
    const required = thresholdFor(kind);
    const pass = ratio >= required;
    return {
      fg,
      bg,
      fgHex: TOKENS[fg],
      bgHex: TOKENS[bg],
      kind,
      use,
      ratio: Math.round(ratio * 100) / 100,
      required,
      pass,
      // Only meaningful for informational failures — the palette is NOT
      // modified automatically. See DESIGN.md "Contrast".
      fix:
        pass || required === DECORATIVE
          ? null
          : smallestAdjustment(TOKENS[fg], TOKENS[bg], required),
    };
  });
}

const pad = (s, n) => String(s).padEnd(n);
const rpad = (s, n) => String(s).padStart(n);

function printTable(results) {
  const console_ = console;
  console_.log('');
  console_.log('WCAG 2.1 contrast — Fault & Flow palette (computed, not estimated)');
  console_.log(
    `Thresholds: text ${AA_TEXT}:1 | large text ${AA_LARGE}:1 | non-text ${AA_NON_TEXT}:1`,
  );
  console_.log('');
  console_.log(
    pad('FOREGROUND', 16) +
      pad('BACKGROUND', 16) +
      rpad('RATIO', 7) +
      rpad('NEED', 7) +
      '  KIND       RESULT',
  );
  console_.log('-'.repeat(78));

  for (const r of results) {
    console_.log(
      pad(`${r.fg} ${r.fgHex}`, 16) +
        pad(`${r.bg} ${r.bgHex}`, 16) +
        rpad(`${r.ratio.toFixed(2)}:1`, 7) +
        rpad(`${r.required}:1`, 7) +
        `  ${pad(r.kind, 10)} ${r.pass ? 'PASS' : '** FAIL **'}`,
    );
  }

  const failures = results.filter((r) => !r.pass);
  console_.log('');
  if (failures.length === 0) {
    console_.log(`All ${results.length} pairs pass WCAG AA.`);
  } else {
    console_.log(`${failures.length} of ${results.length} pairs FAIL:`);
    for (const f of failures) {
      console_.log(
        `  - ${f.fg} ${f.fgHex} on ${f.bg} ${f.bgHex}: ${f.ratio.toFixed(2)}:1 ` +
          `(needs ${f.required}:1) — ${f.use}`,
      );
      if (f.fix) {
        console_.log(
          `      smallest adjustment: ${f.fgHex} -> ${f.fix.hex} ` +
            `(${f.fix.ratio.toFixed(2)}:1, same hue)`,
        );
      }
    }
    console_.log('');
    console_.log(
      'The palette is deliberately NOT auto-modified. Decide each change, then\n' +
        'update the TOKENS block above and re-run this script.',
    );
  }
  console_.log('');
  return failures;
}

// Self-test the formula against WCAG's published reference values.
function selfTest() {
  const cases = [
    ['#000000', '#ffffff', 21],
    ['#ffffff', '#ffffff', 1],
    ['#777777', '#ffffff', 4.48],
    ['#0A0F14', '#0A0F14', 1],
  ];
  for (const [a, b, expected] of cases) {
    const got = contrastRatio(a, b);
    const ok = Math.abs(got - expected) < 0.01;
    if (!ok) {
      console.error(
        `contrast self-test failed: ${a} on ${b} => ${got.toFixed(2)}, expected ~${expected}`,
      );
      process.exit(1);
    }
  }
}

selfTest();

const results = evaluate();
const failures = printTable(results);

const asJson = process.argv.includes('--json');
if (asJson) {
  console.log(JSON.stringify({ tokens: TOKENS, results, failures }, null, 2));
}

if (process.argv.includes('--check') && failures.length > 0) {
  process.exit(1);
}
