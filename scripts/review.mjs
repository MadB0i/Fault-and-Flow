/**
 * Design-system audit harness. Runs the consistency passes from the
 * reviewing-interface-quality workflow and prints the distinct-value counts
 * that reveal where the system broke.
 *
 * Not part of `npm run verify` - it is a review tool, not a gate. Run it with a
 * dev server up:  node scripts/review.mjs
 */

import { chromium } from 'playwright-core';

const URL = process.env.REVIEW_URL ?? 'http://localhost:5173/';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(`uncaught: ${e.message}`));
page.on('requestfailed', (r) => errors.push(`requestfailed: ${r.url()}`));

await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);

// --- Pass 4: system consistency -----------------------------------------
const PROPS = [
  'fontSize',
  'fontFamily',
  'borderRadius',
  'boxShadow',
  'padding',
  'color',
  'transitionDuration',
  'letterSpacing',
];

for (const width of [1440, 390]) {
  await page.setViewportSize({ width, height: 900 });
  await page.waitForTimeout(150);

  const counts = await page.evaluate((props) => {
    const out = {};
    for (const p of props) {
      out[p] = [
        ...new Set(
          [...document.querySelectorAll('body *')]
            .map((e) => getComputedStyle(e)[p])
            .filter((v) => v && v !== 'none' && v !== '0px' && v !== 'normal'),
        ),
      ];
    }
    return out;
  }, PROPS);

  console.log(`\n=== ${width}px ===`);
  for (const [prop, values] of Object.entries(counts)) {
    console.log(`${prop}: ${values.length} distinct`);
    for (const v of values.slice(0, 12)) console.log(`   ${v}`);
  }
}

// --- Off-grid spacing ---------------------------------------------------
// Exclude `normal` (a keyword, not a length) and the sr-only technique's
// deliberate -1px margins, which is how an element is hidden from sight while
// remaining available to screen readers. Counting either as an off-grid value
// makes this check cry wolf and get ignored.
await page.setViewportSize({ width: 1440, height: 900 });
const offGrid = await page.evaluate(() => {
  const exempt = /sr-only|skip-link/;
  const bad = [];
  for (const el of document.querySelectorAll('body *')) {
    const cls = String(el.className ?? '');
    if (exempt.test(cls)) continue;
    const s = getComputedStyle(el);
    for (const prop of ['paddingTop', 'paddingLeft', 'marginTop', 'marginLeft', 'gap']) {
      const raw = s[prop];
      // 'normal' is a keyword for gap, not a length.
      if (!raw || raw === 'auto' || raw === 'normal' || raw === '0px') continue;
      const px = parseFloat(raw);
      if (Number.isNaN(px)) continue;
      // 8px grid, allowing the documented 4px half-step token.
      if (px % 8 !== 0 && px % 4 !== 0)
        bad.push(`${el.tagName}.${cls.slice(0, 40)} ${prop}=${raw}`);
    }
  }
  return [...new Set(bad)].slice(0, 15);
});
console.log('\n=== off-grid spacing ===');
console.log(offGrid.length ? offGrid : 'none - all spacing on the 4/8px grid');

// --- Motion + reduced motion --------------------------------------------
const motion = await page.evaluate(() => {
  const durations = new Set();
  const transitions = new Set();
  for (const el of document.querySelectorAll('body *')) {
    const s = getComputedStyle(el);
    if (s.transitionDuration !== '0s') transitions.add(s.transitionProperty);
    if (s.animationDuration !== '0s') durations.add(s.animationDuration);
  }
  return { transitions: [...transitions], animations: [...durations] };
});
console.log('\n=== motion ===');
console.log('transition properties:', motion.transitions);
console.log('animations:', motion.animations.length ? motion.animations : 'none');

// --- Touch targets ------------------------------------------------------
// A control inside a <label> is activated by clicking the label, so the label
// is the real target. Measure the effective hit area, not just the input box,
// or every correctly-built radio reports as too small.
const small = await page.evaluate(() => {
  const bad = [];
  for (const el of document.querySelectorAll('button, a[href], input, [role="button"]')) {
    // Effective target = the input, grown by any wrapping label.
    const label = el.closest('label');
    const target = label ?? el;
    const r = target.getBoundingClientRect();

    // sr-only elements are intentionally 1x1 until focused; the skip link is
    // the documented exception.
    if (r.width <= 1 && r.height <= 1) continue;
    if (/sr-only|skip-link/.test(String(el.className ?? ''))) continue;

    if (r.width < 24 || r.height < 24) {
      bad.push(
        `${el.tagName}[${el.getAttribute('type') ?? ''}] ` +
          `${Math.round(r.width)}x${Math.round(r.height)}` +
          (label ? ' (label target)' : ''),
      );
    }
  }
  return bad;
});
console.log('\n=== touch targets under 24px (WCAG 2.2 SC 2.5.8) ===');
console.log(small.length ? small : 'none');

console.log('\n=== console errors ===');
console.log(errors.length ? errors : 'none');

await browser.close();
