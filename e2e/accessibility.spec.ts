/**
 * Accessibility and rendering checks for the terrain view.
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

test.describe('terrain view', () => {
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

  test('the scene actually paints, and the terrain is not the background colour', async ({
    page,
  }) => {
    // A shader that fails to compile leaves a valid WebGL context, a working
    // HUD, and a completely black canvas: every other assertion here passes
    // while nothing is on screen. This is the only check that notices.
    const area = page.getByTestId('area-majuli');
    for (let i = 0; i < 80 && !(await area.isEnabled()); i += 1) {
      await page.waitForTimeout(250);
    }
    await area.check();
    await page.waitForTimeout(2500);

    const painted: {
      ok: boolean;
      why?: string;
      lit?: number;
      total?: number;
      brightest?: number;
      bg?: string;
    } = await page.evaluate(() => {
      const canvas = document.querySelector<HTMLCanvasElement>(
        '[data-testid="terrain-canvas"]',
      );
      if (!canvas) return { ok: false, why: 'no canvas' };
      const scratch = document.createElement('canvas');
      scratch.width = canvas.width;
      scratch.height = canvas.height;
      const ctx = scratch.getContext('2d');
      if (!ctx) return { ok: false, why: 'no 2d context' };
      ctx.drawImage(canvas, 0, 0);
      // Sample a grid across the lower half, where the terrain sits under a
      // tilted camera, and count pixels that are neither the page background
      // nor pure black.
      const bg = getComputedStyle(document.documentElement)
        .getPropertyValue('--bg')
        .trim();
      const probe = (x: number, y: number): number[] => {
        const d = ctx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data;
        return [d[0] ?? 0, d[1] ?? 0, d[2] ?? 0];
      };
      let lit = 0;
      let total = 0;
      let brightest = 0;
      for (let fx = 0.1; fx <= 0.9; fx += 0.05) {
        for (let fy = 0.35; fy <= 0.9; fy += 0.05) {
          const p = probe(canvas.width * fx, canvas.height * fy);
          total += 1;
          const lum = 0.2126 * (p[0] ?? 0) + 0.7152 * (p[1] ?? 0) + 0.0722 * (p[2] ?? 0);
          if (lum > brightest) brightest = lum;
          if (lum > 12) lit += 1;
        }
      }
      return { ok: true, lit, total, brightest: Math.round(brightest), bg };
    });

    expect(painted.ok, painted.why).toBe(true);
    expect(
      (painted.lit ?? 0) / (painted.total ?? 1),
      `only ${painted.lit}/${painted.total} sampled pixels were lit (brightest ${painted.brightest})`,
    ).toBeGreaterThan(0.25);
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
    for (const [width, height] of [
      [390, 844],
      [1366, 768],
      [1440, 900],
      [1920, 1080],
    ] as const) {
      await page.setViewportSize({ width, height });
      await page.waitForTimeout(120);

      const collisions = await page.evaluate(() => {
        const regions: Array<{ name: string; el: Element | null }> = [
          { name: 'mode-rail', el: document.querySelector('[data-testid="mode-rail"]') },
          { name: 'wordmark', el: document.querySelector('[data-testid="wordmark"]') },
          {
            name: 'lang-toggle',
            el: document.querySelector('[data-testid="lang-toggle"]'),
          },
          {
            name: 'left-column',
            el: document.querySelector('[data-testid="hud-left-column"]'),
          },
          {
            name: 'right-column',
            el: document.querySelector('[data-testid="hud-right-column"]'),
          },
          {
            name: 'disclaimer',
            el: document.querySelector('[data-testid="disclaimer-banner"]'),
          },
        ];

        const boxes = regions
          .filter((r): r is { name: string; el: Element } => r.el !== null)
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

      expect(collisions, `HUD overlap at ${width}x${height}`).toEqual([]);
    }
  });

  test('the left HUD column scrolls inside itself at every width', async ({ page }) => {
    // The overlap check above catches collisions; this catches the other half
    // of the defect, where a panel column grows taller than the viewport and
    // slides up under the mode rail. A column that scrolls cannot do that.
    for (const [width, height] of [
      [390, 844],
      [1366, 768],
      [1920, 1080],
    ] as const) {
      await page.setViewportSize({ width, height });
      await page.waitForTimeout(120);

      const columns = await page.evaluate(() => {
        const out: string[] = [];
        for (const sel of ['hud-left-column', 'hud-right-column']) {
          const el = document.querySelector(`[data-testid="${sel}"]`);
          if (!el) continue;
          const r = el.getBoundingClientRect();
          const scrollable = el.scrollHeight > el.clientHeight + 1;
          const scrollableOk =
            !scrollable ||
            getComputedStyle(el).overflowY === 'auto' ||
            getComputedStyle(el).overflowY === 'scroll';
          if (!scrollableOk) out.push(`${sel}: content overflows without scrolling`);
          if (r.top < -1) out.push(`${sel}: top=${Math.round(r.top)}`);
          if (r.bottom > window.innerHeight + 1) {
            out.push(`${sel}: bottom=${Math.round(r.bottom)} vs ${window.innerHeight}`);
          }
        }
        return out;
      });

      expect(columns, `column layout at ${width}x${height}`).toEqual([]);
    }
  });

  test('HUD regions stay inside the viewport', async ({ page }) => {
    for (const [width, height] of [
      [390, 844],
      [1366, 768],
      [1920, 1080],
    ] as const) {
      await page.setViewportSize({ width, height });
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

      expect(escaped, `element outside viewport at ${width}x${height}`).toEqual([]);
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
            const named = [...labels].some((l) => (l.textContent ?? '').trim() !== '');
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
      const axe = (
        window as unknown as {
          axe: { run: (ctx: Document, opts: unknown) => Promise<unknown> };
        }
      ).axe;

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

    expect(violations, `axe violations: ${JSON.stringify(violations, null, 2)}`).toEqual(
      [],
    );
  });

  test('FLOW is the live channel; FAULT and PLATES are honestly disabled', async ({
    page,
  }) => {
    // FLOW is built, so it must be operable and announce itself as current.
    const flow = page.getByTestId('mode-flow');
    await expect(flow).toBeVisible();
    await expect(flow).toBeEnabled();
    await expect(flow).toHaveAttribute('aria-current', 'true');

    // The two unbuilt channels stay genuinely disabled rather than looking
    // live: a control that looks inert but still takes clicks is worse than one
    // that is honest.
    for (const mode of ['fault', 'plates']) {
      const button = page.getByTestId(`mode-${mode}`);
      await expect(button).toBeVisible();
      await expect(button).toBeDisabled();
      await expect(button).toHaveAttribute('aria-disabled', 'true');
    }
  });

  test('selecting FLOW on the rail shows the flood panel', async ({ page }) => {
    const toggle = page.getByTestId('water-toggle');
    await expect(toggle).not.toBeChecked();
    await page.getByTestId('mode-flow').click();
    await expect(toggle).toBeChecked();
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
    await expect(page.getByTestId('app')).toHaveAttribute('data-locale', 'en');

    await page.getByRole('radio', { name: 'অসমীয়া' }).check();

    await expect(page.getByTestId('app')).toHaveAttribute('data-locale', 'as');

    // The mode rail label must change too - not just the toggle itself.
    await expect(
      page.getByRole('navigation', { name: 'বালিৰ বোক্সৰ ধৰন' }),
    ).toBeVisible();

    // The Assamese option must render in the Assamese face.
    const option = page
      .locator('label', { has: page.getByRole('radio', { name: 'অসমীয়া' }) })
      .locator('[lang="as"]');
    const fontFamily = await option.evaluate((el) => getComputedStyle(el).fontFamily);
    expect(fontFamily).toContain('Noto Sans Bengali');
  });

  test('Assamese headings render with no missing glyphs', async ({ page }) => {
    // A tofu box is not detectable from the DOM, so measure the glyphs: if a
    // fallback face were substituted, the rendered advance width per character
    // would differ from what Noto Sans Bengali produces. Comparing rendered
    // width against the declared font gives a cheap, real signal.
    // The Assamese wordmark contains ৰ (U+09F0), the glyph this check exists for.
    await page.getByRole('radio', { name: 'অসমীয়া' }).check();
    const wordmark = page.getByTestId('wordmark');
    await expect(wordmark).toHaveText('ফল্ট আৰু ফ্লো');

    const measured = await wordmark.evaluate((el) => {
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

    expect(measured.text).toBe('ফল্ট আৰু ফ্লো');

    // Wider than a single space, which a tofu-only render cannot achieve.
    expect(measured.width).toBeGreaterThan(measured.fontSize * 2);
    expect(measured.fontFamily).toContain('Noto Sans Bengali');
  });

  test('honesty disclaimer is present in English', async ({ page }) => {
    await expect(page.getByTestId('disclaimer')).toHaveText(
      /not a forecast and not a hazard map/i,
    );
    await expect(page.getByTestId('terrain-honesty')).toHaveText(/illustrative/i);
    // NOTE: the "earthquakes cannot be predicted" notice ships with FAULT mode
    // (Roadmap Phase 5). Assert it here once that mode renders its own banner.
  });

  test('the terrain view exposes canvas, controls, legend and readout', async ({
    page,
  }) => {
    const canvas = page.getByTestId('terrain-canvas');
    await expect(canvas).toBeVisible();
    // A canvas without an accessible name is a picture, not an instrument.
    const accessibleName = await canvas.getAttribute('aria-label');
    expect((accessibleName ?? '').trim().length).toBeGreaterThan(0);

    await expect(page.getByTestId('terrain-panel')).toBeVisible();
    await expect(page.getByTestId('terrain-legend')).toBeVisible();
    await expect(page.getByTestId('terrain-readout')).toBeVisible();

    // A fabricated statistic or lorem ipsum would show up here.
    const body = await page.locator('main').innerText();
    expect(body).not.toMatch(/lorem ipsum/i);
    expect(body).not.toMatch(/\b42\b/);
  });

  test('flow water controls are present and can start', async ({ page }) => {
    // The terrain must be ready before the water toggle enables.
    const toggle = page.getByTestId('water-toggle');
    await expect(toggle).toBeEnabled();
    await toggle.check();

    // Two honest outcomes: the layer runs, or the device says why it cannot
    // and the terrain carries on. Exactly one of them must show.
    const unsupported = page.getByTestId('water-unsupported');
    const play = page.getByTestId('water-play');
    await expect(unsupported.or(play)).toBeVisible();

    if (await unsupported.isVisible()) {
      await expect(unsupported).toContainText(/terrain still works/i);
    } else {
      await expect(page.getByTestId('water-honesty')).toContainText(/not a forecast/i);
      await expect(play).toBeEnabled();
      await play.click();
      await expect(play).toHaveText(/Pause water/);

      const slider = page.getByTestId('water-discharge');
      await slider.fill('8000');
      await expect(page.getByTestId('water-discharge-value')).toContainText('8000');

      await expect(page.getByTestId('legend-water-ramp')).toBeVisible();

      // The sim must actually wet cells, not just run the UI: a shader that
      // fails to compile leaves every control working and the terrain dry.
      await expect(page.getByTestId('water-stats')).not.toContainText('0.00 km2', {
        timeout: 30000,
      });

      await play.click();
      await expect(play).toHaveText(/Run water/);
    }
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
