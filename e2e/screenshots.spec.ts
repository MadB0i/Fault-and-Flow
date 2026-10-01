/**
 * Deterministic screenshots into docs/screenshots/.
 *
 * Run with `npm run shots`. Both widths are captured because most layout
 * defects only appear at 390px, and both are captured with animations disabled
 * so repeat runs produce identical bytes.
 */

import { test, expect, type Page } from '@playwright/test';
import { mkdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, '../docs/screenshots');

/** 1440px and 390px are the two widths AGENTS.md section 11 requires. */
const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
] as const;

async function capture(page: Page, width: number, height: number, name: string) {
  await page.setViewportSize({ width, height });
  // Wait on the condition, not a timeout: web fonts must be settled or the
  // capture shows a fallback face.
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready);

  const path = resolve(outDir, `${name}.png`);
  await page.screenshot({
    path,
    fullPage: true,
    animations: 'disabled',
    caret: 'hide',
  });

  return path;
}

test.describe('screenshots', () => {
  test.beforeAll(() => {
    mkdirSync(outDir, { recursive: true });
  });

  for (const vp of VIEWPORTS) {
    test(`${vp.name} — ${vp.width}px, English`, async ({ page }) => {
      await page.goto('/');
      const path = await capture(page, vp.width, vp.height, `placeholder-${vp.name}-en`);

      // A capture written to a tiny or empty file means the paint never
      // happened, which an assertion on the path alone would not catch.
      expect(statSync(path).size).toBeGreaterThan(5_000);
    });

    test(`${vp.name} — ${vp.width}px, Assamese`, async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await page.getByRole('radio', { name: 'অসমীয়া' }).check();
      await expect(page.getByTestId('app')).toHaveAttribute('data-locale', 'as');

      const path = await capture(
        page,
        vp.width,
        vp.height,
        `placeholder-${vp.name}-as`,
      );
      expect(statSync(path).size).toBeGreaterThan(5_000);
    });
  }
});
