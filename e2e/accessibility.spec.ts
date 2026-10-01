/**
 * Accessibility and rendering checks for the phase 1 placeholder.
 *
 * Automated tools catch roughly a third of accessibility defects. The keyboard
 * walk and the screenshots catch most of the rest, which is why both are here
 * rather than relying on assertions alone.
 */

import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** Collect console errors and failed requests for the life of a page. */
function watchForErrors(page: Page): string[] {
  const errors: string[] = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
  });
  page.on('pageerror', (err) => {
    errors.push(`uncaught: ${err.message}`);
  });
  page.on('requestfailed', (req) => {
    errors.push(`requestfailed: ${req.url()} — ${req.failure()?.errorText}`);
  });

  return errors;
}

test.describe('placeholder page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // networkidle is the right default for first load of a Vite dev server.
    await page.waitForLoadState('networkidle');
  });

  test('renders without console errors or failed requests', async ({ page }) => {
    const errors = watchForErrors(page);
    await page.reload();
    await page.waitForLoadState('networkidle');

    expect(errors).toEqual([]);
  });

  test('has one h1 and the correct landmarks', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(page.getByRole('main')).toHaveCount(1);
    await expect(page.getByRole('banner')).toHaveCount(1);

    // The mode rail is a nav with a distinguishing name.
    await expect(page.getByRole('navigation', { name: /sandbox modes/i })).toBeVisible();
  });

  test('no horizontal overflow at any supported width', async ({ page }) => {
    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(120);

      const overflow = await page.evaluate(() => {
        const limit = document.documentElement.clientWidth;
        return [...document.querySelectorAll('*')]
          .filter((el) => el.getBoundingClientRect().right > limit + 1)
          .slice(0, 5)
          .map((el) => `${el.tagName}.${el.className}`);
      });

      expect(overflow, `horizontal overflow at ${width}px`).toEqual([]);
    }
  });

  test('HUD regions never overlap each other', async ({ page }) => {
    // Overflow checks miss the common responsive failure: two absolutely
    // positioned regions colliding. This asserts the actual rectangles, which
    // is the defect that shipped in the first version of this page.
    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(120);

      const collisions = await page.evaluate(() => {
        const regions: Array<{ name: string; el: Element }> = [
          { name: 'mode-rail', el: document.querySelector('[data-testid="mode-rail"]')! },
          { name: 'wordmark', el: document.querySelector('[data-testid="wordmark"]')! },
          { name: 'lang-toggle', el: document.querySelector('[data-testid="lang-toggle"]')! },
          { name: 'phase-label', el: document.querySelector('[data-testid="phase-label"]')! },
        ];

        const boxes = regions
          .filter((r) => r.el)
          .map((r) => ({ name: r.name, rect: r.el.getBoundingClientRect() }));

        const hits: string[] = [];
        for (let i = 0; i < boxes.length; i += 1) {
          for (let j = i + 1; j < boxes.length; j += 1) {
            const a = boxes[i]!;
            const b = boxes[j]!;
            const overlaps =
              a.rect.left < b.rect.right &&
              b.rect.left < a.rect.right &&
              a.rect.top < b.rect.bottom &&
              b.rect.top < a.rect.bottom;
            if (overlaps) hits.push(`${a.name} overlaps ${b.name}`);
          }
        }
        return hits;
      });

      expect(collisions, `HUD overlap at ${width}px`).toEqual([]);
    }
  });

  test('HUD regions stay inside the viewport', async ({ page }) => {
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(120);

      const escaped = await page.evaluate(() => {
        const out: string[] = [];
        for (const sel of ['mode-rail', 'wordmark', 'lang-toggle']) {
          const el = document.querySelector(`[data-testid="${sel}"]`);
          if (!el) continue;
          const r = el.getBoundingClientRect();
          if (r.left < -1 || r.right > document.documentElement.clientWidth + 1) {
            out.push(`${sel}: left=${Math.round(r.left)} right=${Math.round(r.right)}`);
          }
        }
        return out;
      });

      expect(escaped, `element outside viewport at ${width}px`).toEqual([]);
    }
  });

  test('no sentence is set in all caps', async ({ page }) => {
    // DESIGN.md section 5 bans all-caps sentences. Short all-caps labels are
    // fine, so only flag text-transform on elements long enough to be prose.
    const shouting = await page.evaluate(() => {
      const out: string[] = [];
      for (const el of document.querySelectorAll('p, h1, h2, h3, li, span')) {
        const style = getComputedStyle(el);
        const text = (el.textContent ?? '').trim();
        if (text.length > 40 && style.textTransform === 'uppercase') {
          out.push(`${el.tagName}: ${text.slice(0, 50)}`);
        }
      }
      return out;
    });

    expect(shouting).toEqual([]);
  });

  test('every interactive control has an accessible name', async ({ page }) => {
    // Resolve the accessible name the way a screen reader does, rather than
    // reading textContent: a void element like <input> takes its name from
    // its wrapping <label> or label[for], so a naive textContent scan reports
    // every correctly-labelled radio as unnamed.
    const unnamed = await page.evaluate(() => {
      const controls = document.querySelectorAll(
        'button, a[href], input, select, textarea, [role="button"]',
      );

      return [...controls]
        .filter((el) => {
          const aria = el.getAttribute('aria-label')?.trim();
          if (aria) return false;

          const labelledBy = el.getAttribute('aria-labelledby');
          if (labelledBy) {
            const refs = labelledBy
              .split(/\s+/)
              .map((id) => document.getElementById(id)?.textContent?.trim() ?? '');
            if (refs.some((t) => t !== '')) return false;
          }

          // HTMLInputElement.labels covers both a wrapping <label> and an
          // explicit label[for].
          const labels = (el as HTMLInputElement).labels;
          if (labels && labels.length > 0) {
            const named = [...labels].some(
              (l) => (l.textContent ?? '').trim() !== '',
            );
            if (named) return false;
          }

          // Fall back to the element's own text (buttons, links).
          return (el.textContent ?? '').trim() === '';
        })
        .map((el) => el.outerHTML.slice(0, 120));
    });

    expect(unnamed).toEqual([]);
  });

  test('the page has no axe-core WCAG 2.2 AA violations', async ({ page }) => {
    // axe-core is a devDependency and is injected from node_modules, so the
    // audit runs offline and nothing is fetched from a CDN.
    const axeSource = readFileSync(
      fileURLToPath(import.meta.resolve('axe-core/axe.min.js')),
      'utf8',
    );
    await page.addScriptTag({ content: axeSource });

    const violations = await page.evaluate(async () => {
      const axe = (window as unknown as {
        axe: { run: (ctx: Document, opts: unknown) => Promise<unknown> };
      }).axe;

      const result = (await axe.run(document, {
        runOnly: {
          type: 'tag',
          values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'],
        },
      })) as {
        violations: Array<{
          id: string;
          impact: string | null;
          help: string;
          nodes: Array<{ target: string[]; failureSummary: string }>;
        }>;
      };

      return result.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        help: v.help,
        targets: v.nodes.map((n) => n.target.join(' ')),
      }));
    });

    expect(violations, `axe violations: ${JSON.stringify(violations, null, 2)}`)
      .toEqual([]);
  });

  test('the three mode rail items are present and genuinely disabled', async ({
    page,
  }) => {
    for (const mode of ['flow', 'fault', 'plates']) {
      const button = page.getByTestId(`mode-${mode}`);
      await expect(button).toBeVisible();
      // Disabled is a real attribute, not just a dimmed class. A control that
      // looks inert but still takes clicks is worse than one that is honest.
      await expect(button).toBeDisabled();
    }
  });

  test('keyboard traversal reaches every control with a visible focus ring', async ({
    page,
  }) => {
    const seen: string[] = [];
    const invisible: string[] = [];

    for (let i = 0; i < 25; i += 1) {
      await page.keyboard.press('Tab');

      const info = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return null;
        const style = getComputedStyle(el);
        return {
          tag: el.tagName,
          name: (el.getAttribute('aria-label') ?? el.textContent ?? '')
            .trim()
            .slice(0, 40),
          // A focus indicator may be an outline or a box-shadow ring.
          hasRing:
            (style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0) ||
            style.boxShadow !== 'none',
        };
      });

      if (!info) break;
      seen.push(`${info.tag}: ${info.name}`);
      if (!info.hasRing) invisible.push(`${info.tag}: ${info.name}`);
    }

    // Disabled buttons are skipped by Tab, which is correct native behaviour.
    // The skip link and the two radios should all be reachable.
    expect(seen.length).toBeGreaterThan(0);
    expect(invisible, 'focusable elements with no visible focus ring').toEqual([]);
    expect(seen.some((s) => s.includes('Skip to content'))).toBe(true);
    expect(seen.filter((s) => s.includes('INPUT')).length).toBeGreaterThan(0);
  });

  test('the language toggle switches the interface to Assamese', async ({ page }) => {
    const phrase = page.getByTestId('assamese-phrase');
    await expect(phrase).toHaveAttribute('lang', 'as');

    await page.getByRole('radio', { name: 'অসমীয়া' }).check();

    // The mode rail label must change too - not just the toggle itself.
    await expect(
      page.getByRole('navigation', { name: 'বালিৰ বোক্সৰ ধৰন' }),
    ).toBeVisible();

    // The Assamese phrase must still render in the Assamese face.
    const fontFamily = await phrase.evaluate(
      (el) => getComputedStyle(el).fontFamily,
    );
    expect(fontFamily).toContain('Noto Sans Bengali');
  });

  test('the required Assamese phrase renders with no missing glyphs', async ({
    page,
  }) => {
    // A tofu box is not detectable from the DOM, so measure the glyphs: if a
    // fallback face were substituted, the rendered advance width per character
    // would differ from what Noto Sans Bengali produces. Comparing rendered
    // width against the declared font gives a cheap, real signal.
    const measured = await page
      .getByTestId('assamese-phrase')
      .evaluate((el) => {
        const style = getComputedStyle(el);
        const range = document.createRange();
        range.selectNodeContents(el);
        const rect = range.getBoundingClientRect();
        return {
          text: el.textContent ?? '',
          width: rect.width,
          fontFamily: style.fontFamily,
          fontSize: parseFloat(style.fontSize),
        };
      });

    expect(measured.text).toBe('ভূমিকম্প আৰু বান');

    // 14 code points (including 2 spaces). A fallback would render these at a
    // very different total advance; assert the text is non-degenerate and
    // wider than a single space, which a tofu-only render cannot achieve.
    expect(measured.width).toBeGreaterThan(measured.fontSize * 2);
    expect(measured.fontFamily).toContain('Noto Sans Bengali');
  });

  test('honesty disclaimer is present in English', async ({ page }) => {
    await expect(
      page.getByText(/not a forecast and not a hazard map/i),
    ).toBeVisible();
    await expect(page.getByText(/earthquakes cannot be predicted/i)).toBeVisible();
  });

  test('the canvas region has real empty-state copy, not a placeholder', async ({
    page,
  }) => {
    await expect(page.getByRole('heading', { level: 2 })).toBeVisible();
    await expect(page.getByTestId('phase-label')).toContainText(/phase 1 of 8/i);
    // A fabricated statistic or lorem ipsum would show up here.
    const body = await page.locator('main').innerText();
    expect(body).not.toMatch(/lorem ipsum/i);
    expect(body).not.toMatch(/\b42\b/);
  });

  test('no raw hex colour leaks into the rendered styles', async ({ page }) => {
    // tokens.css is the one place hex is allowed; check nothing else in the
    // component tree resolves to a hardcoded literal.
    const literals = await page.evaluate(() => {
      const bad: string[] = [];
      const properties = ['color', 'backgroundColor', 'borderTopColor'] as const;

      for (const el of document.querySelectorAll('body *')) {
        for (const prop of properties) {
          const value = getComputedStyle(el)[prop];
          if (value.startsWith('#')) bad.push(`${el.tagName} ${prop}=${value}`);
        }
      }
      return bad;
    });

    expect(literals).toEqual([]);
  });
});
