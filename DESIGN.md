# DESIGN.md

The design system for Fault & Flow. **This file is the source of truth.** If a colour,
type size, spacing value, or duration appears anywhere in `src/ui/` that is not derived
from a token defined here, that is a defect — not a local preference.

Two hard rules, from `AGENTS.md` §8:

1. **Colour comes from CSS variables only.** No raw hex in any component.
2. **Contrast ratios are computed, never estimated.** Every number in §4 came out of
   `npm run contrast`. Do not type one by hand.

---

## 1. The brief

Written before any file was created, per the design workflow. Eight lines, kept here so
the direction stays checkable against what actually shipped.

```
Purpose:    Foundation page proving the design system for a 3D sandbox of Assam's earth and water
Audience:   Students in Assam, plus developers browsing GitHub. Desktop 1440 and phone 390.
Tone:       Instrument panel — seismograph meets night-time satellite imagery
Reference:   Geological survey instrument panels; ESA night-lights imagery; Braun measuring devices
Palette:    Near-black blue-green base, two accents only: water cyan and seismic amber
Type:       Fraunces display / Instrument Sans UI / JetBrains Mono data / Noto Sans Bengali Assamese
Memorable:  The mode rail reading as an instrument channel selector — channel codes set in mono
Restraint:  No cards, no gradients, no shadows, no glassmorphism, no decorative motion
```

**The restraint line is the load-bearing one.** A direction without a stated restraint
becomes every effect applied at once. Ours: the chrome is quiet and the data glows. Nothing
in the UI is allowed to compete with the terrain or the river.

---

## 2. Tokens

The single source of truth lives in `src/ui/styles/tokens.css`. Everything below is
copied from there verbatim.

```css
:root {
  /* ---- COLOUR ---------------------------------------------------------- */
  --bg:            #0A0F14;  /* the void behind the scene */
  --surface:       #111A22;  /* HUD panels */
  --surface-raised:#172430;  /* nested controls inside a panel */
  --hairline:      #22323F;  /* 1px decorative borders ONLY */
  --text:          #E6EDF3;
  --text-muted:    #8CA0B0;

  --water:         #3FD0E0;  /* accent 1 — the river, water, interactive focus */
  --water-deep:    #0E5A73;  /* deep channel fill */

  --seismic-amber: #FFB547;  /* accent 2 — seismicity, active state */
  --seismic-hot:   #FF5A3C;  /* magnitude 6+ / peak intensity only */

  --plate-line:    #9AA7B4;  /* inactive plate boundary */

  /* terrain ramp, low to high elevation */
  --terrain-1: #1C3B35;
  --terrain-2: #3E5B45;
  --terrain-3: #8B7E5A;
  --terrain-4: #D8D2C4;

  /* ---- TYPE ------------------------------------------------------------
     Noto Sans Bengali appears in EVERY stack, not only --font-assamese.
     Fraunces and JetBrains Mono carry no Assamese glyphs, so without it an
     Assamese heading would fall through to the generic `serif` keyword and be
     resolved by the OS - which renders, but differently on every platform.
     Latin glyphs still come from the Latin face; only Assamese falls through. */
  --font-display: "Fraunces", "Noto Sans Bengali", Georgia, serif;
  --font-ui:      "Instrument Sans", "Noto Sans Bengali", sans-serif;
  --font-data:    "JetBrains Mono", "Noto Sans Bengali", ui-monospace, monospace;
  --font-assamese:"Noto Sans Bengali", "Instrument Sans", sans-serif;

  /* One ratio for the whole page: 1.250 (major third). */
  --step--2: 0.64rem;
  --step--1: 0.8rem;
  --step-0:  1rem;
  --step-1:  1.25rem;
  --step-2:  1.563rem;
  --step-3:  1.953rem;
  --step-4:  2.441rem;
  --step-5:  3.052rem;
  --step-6:  3.815rem;

  /* ---- SPACE — 8px grid, no exceptions --------------------------------- */
  --space-2xs: 0.25rem;  /*  4px */
  --space-xs:  0.5rem;   /*  8px */
  --space-s:   1rem;     /* 16px */
  --space-m:   1.5rem;   /* 24px */
  --space-l:   2rem;     /* 32px */
  --space-xl:  3rem;     /* 48px */
  --space-2xl: 4rem;     /* 64px */

  /* ---- FORM ------------------------------------------------------------ */
  --radius:    10px;
  --radius-sm: 6px;
  --border:    1px solid var(--hairline);
  --blur-panel: blur(14px);

  /* ---- MOTION ---------------------------------------------------------- */
  --ease: cubic-bezier(0.22, 1, 0.36, 1);
  --dur-fast: 150ms;
  --dur:      300ms;
  --dur-slow: 600ms;
  --dur-pulse:1.2s;   /* seismic expanding ring, ease-out */
}
```

### 2.1 Colour rationale

The base is not neutral grey — it is a very dark desaturated blue-green (`#0A0F14`). This
is deliberate: the entire product is one river and one tectonic zone, so the chrome adopts
their hues at the lowest possible chroma. A neutral grey would make the scene look pasted
onto the page; a blue-green base makes the water look like it belongs there.

| Token | Role | Why this value |
| --- | --- | --- |
| `--bg` | Page and scene void | Darkest value. The terrain must be the brightest thing on screen. |
| `--surface` | HUD panel fill | One step up from bg — enough separation to read as a plane, not so much it reads as a card. |
| `--surface-raised` | Controls inside a panel | A second step for nested depth. Three steps is the limit; a fourth means hierarchy is unclear. |
| `--hairline` | Decorative 1px borders | Deliberately below 3:1. See §4.2 — it is decoration only. |
| `--text` | Primary text | Near-white, faintly cool to sit with the blue-green base. |
| `--text-muted` | Metadata, labels, units | Desaturated to the base hue. Never drops below 4.5:1 (verified §4.1). |
| `--water` | **Accent 1** — river, water data, focus ring | Cyan against a blue-green base reads as *light on water*, not as a UI colour. |
| `--seismic-amber` | **Accent 2** — seismicity, active mode, warnings | Warm complement. Amber is the colour of instrument caution lamps. |
| `--seismic-hot` | Peak intensity only | Reserved. If it appears often it stops meaning anything — budget it to magnitude 6+ and nothing else. |
| `--plate-line` | Inactive plate boundary | Grey-blue, deliberately undesaturated so amber can replace it on activation. |
| terrain ramp | Elevation, low → high | Green → olive → khaki → bone. A hypsometric ramp read from a distance, not a decorative gradient. |

**Elevation and water depth are never encoded by colour alone.** The `--terrain-*` and
`--water-deep` ramp values carry meaning, so wherever they represent a value the UI must also
show a **numeric readout or a legend**. This is what makes the documented contrast exception
in §4.3 defensible rather than a waiver: colour is redundant there, never the sole carrier.

### 2.2 The two-accent rule

`--water` and `--seismic-amber` are the **only** accents. `--seismic-hot` is a state
extension of amber, not a third accent.

The accents carry **meaning**, never decoration:

| Meaning | Token |
| --- | --- |
| This is water / river data | `--water` |
| This is seismicity | `--seismic-amber` |
| This is intense seismicity (M 6+) | `--seismic-hot` |
| This is the focused / active element | `--water` (focus ring) |
| This is anything else | `--text` / `--text-muted` |

Accent surface area stays **under 10% of the visible screen**. If a screenshot shows more
than a sliver of cyan or amber, something is wrong.

### 2.3 Type

Four faces, each with exactly one job. They do not substitute for one another.

| Face | Job | Weight | Never used for |
| --- | --- | --- | --- |
| **Fraunces** | Display — the wordmark, mode titles, big numbers | 400–600 | Body text, UI labels. It is a display face and it shows at small sizes. |
| **Instrument Sans** | All UI text — labels, buttons, prose | 400–600 | Display. |
| **JetBrains Mono** | Data and numerals — coordinates, magnitudes, discharge, dates | 400–500 | Prose. Also set with `font-variant-numeric: tabular-nums` so digits don't jitter while animating. |
| **Noto Sans Bengali** | **Every Assamese string** | 400–600 | English. |

All four are self-hosted via `@fontsource/*`. **Never a CDN.** No Google Fonts link, ever.

**Banned as a display face:** Inter, Roboto, Arial, `system-ui`. If a face isn't in the
table above, it doesn't ship.

**Assamese specificity.** Assamese uses U+09F0 (ৰ) and U+09F1 (ৱ), which many
"Bengali-capable" fonts silently lack. `--font-assamese` is set as a *distinct* variable
rather than a fallback inside `--font-ui`, because a fallback chain will happily render
Assamese with the English UI face at whatever coverage it happens to have. A unit test
(`tests/fonts.test.ts`) parses the shipped font file and asserts coverage of every codepoint
in every shipped string. Do not remove it.

### 2.4 Layout

- **Full-bleed canvas.** The 3D scene is the page. It is never inside a container with
  margins.
- **HUD floats above it.** Panels are absolutely positioned over the canvas, never in a
  stacking scroll.
- **Regions** — top-left wordmark, left mode rail, bottom timeline scrubber (FLOW and
  FAULT), right readout panel. Reading order: mode rail → wordmark → readouts → scrubber.
- **8px grid.** Every margin, padding, and gap is a `--space-*` token. No `13px`. No
  `0.85rem`.
- **Radius 10px**, with a 6px inner variant for small controls. Mixed ad-hoc radii are the
  single loudest signal of an unbuilt system.
- **Blur on HUD panels only** (`--blur-panel`). Never on buttons, inputs, cards, or the
  page. Glassmorphism-everywhere is an explicit anti-pattern (§5).

---

## 3. Motion

| Token | Value | Use |
| --- | --- | --- |
| `--ease` | `cubic-bezier(0.22, 1, 0.36, 1)` | The only easing curve in the project. |
| `--dur-fast` | `150ms` | Hover, focus, small state changes. |
| `--dur` | `300ms` | Panel enter/exit, disclosure, mode switch. |
| `--dur-slow` | `600ms` | Camera moves, large layout changes. |
| `--dur-pulse` | `1.2s` ease-out | The seismic expanding ring. |

- **No bounce. No spring overshoot.** Springs read as playful; this product is an
  instrument.
- **Camera moves are slow and cinematic** — 600ms or longer, never snapping.
- **The seismic pulse** is an expanding ring, 1.2s ease-out, triggered by a real
  magnitude-6+ event in FAULT mode. It is the product's one memorable moment, and it marks
  something that actually happened.
- **Only animate `transform`, `opacity`, and `filter`.** Animating `width`, `height`, `top`,
  or `left` forces layout and will drop frames on a mid-range phone.
- **`prefers-reduced-motion` is mandatory.** A global block reduces all durations to ~0.
  Camera moves become cuts; the seismic ring becomes a static marker. Motion is never the
  only carrier of information.

---

## 4. Contrast

**Computed, not estimated.** Reproduce with `npm run contrast`; the script is
`scripts/check-contrast.mjs` and self-tests against the WCAG reference values before
reporting.

> Generated by `scripts/check-contrast.mjs` on the palette above. 24 pairs checked:
> **22 pass, 2 informational failures** — both documented exceptions in §4.3, not open
> issues.

### 4.1 Text — all pass AA (4.5:1)

| Foreground | Background | Ratio | Needs | Result |
| --- | --- | ---: | ---: | --- |
| `#E6EDF3` text | `#0A0F14` bg | **16.29:1** | 4.5:1 | PASS |
| `#E6EDF3` text | `#111A22` surface | **14.88:1** | 4.5:1 | PASS |
| `#E6EDF3` text | `#172430` surface-raised | **13.35:1** | 4.5:1 | PASS |
| `#8CA0B0` text-muted | `#0A0F14` bg | **7.12:1** | 4.5:1 | PASS |
| `#8CA0B0` text-muted | `#111A22` surface | **6.50:1** | 4.5:1 | PASS |
| `#8CA0B0` text-muted | `#172430` surface-raised | **5.84:1** | 4.5:1 | PASS |
| `#3FD0E0` water | `#0A0F14` bg | **10.36:1** | 4.5:1 | PASS |
| `#3FD0E0` water | `#111A22` surface | **9.47:1** | 4.5:1 | PASS |
| `#3FD0E0` water | `#172430` surface-raised | **8.49:1** | 4.5:1 | PASS |
| `#FFB547` seismic-amber | `#0A0F14` bg | **10.95:1** | 4.5:1 | PASS |
| `#FFB547` seismic-amber | `#111A22` surface | **10.00:1** | 4.5:1 | PASS |
| `#FFB547` seismic-amber | `#172430` surface-raised | **8.98:1** | 4.5:1 | PASS |
| `#FF5A3C` seismic-hot | `#0A0F14` bg | **6.21:1** | 4.5:1 | PASS |
| `#FF5A3C` seismic-hot | `#111A22` surface | **5.67:1** | 4.5:1 | PASS |

Display title on a panel (`text` on `surface`, large-text threshold 3:1): **14.88:1** PASS.

### 4.2 Non-text — boundaries, focus rings, scene fills

| Pair | Ratio | Needs | Result | Note |
| --- | ---: | ---: | --- | --- |
| `#3FD0E0` water focus ring on bg | **10.36:1** | 3:1 | PASS | Clears SC 2.4.11 with room to spare |
| `#3FD0E0` water focus ring on surface | **9.47:1** | 3:1 | PASS | |
| `#9AA7B4` plate-line on bg | **7.84:1** | 3:1 | PASS | |
| `#9AA7B4` plate-line on surface | **7.17:1** | 3:1 | PASS | |
| `#D8D2C4` terrain-4 on bg | **12.77:1** | 3:1 | PASS | Ridge lines read clearly |
| `#22323F` hairline on bg | 1.46:1 | — | exempt | Decorative only — see below |
| `#22323F` hairline on surface | 1.34:1 | — | exempt | Decorative only — see below |
| `#1C3B35` terrain-1 on bg | 1.58:1 | 3:1 | exception | 3D render data — §4.3 |
| `#0E5A73` water-deep on bg | 2.50:1 | 3:1 | exception | 3D render data — §4.3 |

**Why hairline is exempt.** WCAG 2.2 SC 1.4.11 applies to boundaries *required to identify a
component or its state*. A hairline divider between HUD sections carries no information —
the spacing already groups them — so it is out of scope. **This exemption is conditional
and must be respected in code:** any border that is the only thing indicating where an
interactive control begins and ends must **not** use `--hairline`. Such a border needs a
token that clears 3:1 against its surface, and one does not exist in the palette yet.
Adding it requires a contrast run and an entry in this table. Silently reusing hairline for
a control boundary is a WCAG 1.4.11 failure.

### 4.3 Documented exception — terrain-1 and water-deep keep their values

> **Settled 2026-10-01** — see [`docs/DECISIONS.md` §1](docs/DECISIONS.md). Not an open
> question.

`--terrain-1` and `--water-deep` **keep their current values.** The computed alternatives
below were produced, recorded, and **not applied**, because both are **non-text 3D render
data** — fills inside a WebGL scene, not UI components or boundaries — so SC 1.4.11 is
recorded here as a **reviewed exception** rather than silently satisfied.

| Pair | Ratio | Needs | Decision |
| --- | ---: | ---: | --- |
| `#1C3B35` terrain-1 on bg | 1.58:1 | 3:1 | **Exception accepted.** Stays. |
| `#0E5A73` water-deep on bg | 2.50:1 | 3:1 | **Exception accepted.** Stays. |

The adjustment that was computed and declined, for the record:

| Token | Current | Same-hue alternative | Ratio | Why declined |
| --- | --- | --- | ---: | --- |
| `--terrain-1` | `#1C3B35` | `#4B645F` | 3.01:1 | Lifts the ramp's dark end; the ramp loses depth it needs to read as terrain |
| `--water-deep` | `#0E5A73` | `#21677E` | 3.03:1 | Flattens the shallow/deep distinction, which is a *data* property here |

#### The rule that makes the exception defensible

> **Elevation and water depth are never conveyed by colour alone.** Wherever these shades
> encode a value, a **numeric readout or a legend** must be present.

This is the load-bearing condition. The exception is only defensible because colour is
redundant — never the sole carrier — which is the same principle as `AGENTS.md` §9 (never
communicate state by colour alone) extended to the 3D scene. **A render of these shades
without a readout or legend is not covered by this exception and is a defect.**

**Legend swatches use the adjusted shades**, `#4B645F` for terrain and `#21677E` for water.
A legend swatch sits on the HUD surface and is read as a UI element, so it must be legible as
one — and it can be, because it is detached from the ramp it describes.

#### Re-check

This decision was made from flat swatches. **Re-check it against real 3D renders in phase 7**
(`docs/ROADMAP.md`), with hillshade, lighting and slope shading applied — a judgement that
holds in isolation may not hold in situ. Re-run `npm run contrast` and update this table with
real output. Do not delete these rows until they pass or the exception is withdrawn.

#### Raw output, unchanged

The checker still reports these two as failures, deliberately, so the exception cannot be
forgotten:

```
  - terrain-1 #1C3B35 on bg #0A0F14: 1.58:1 (needs 3:1) — Terrain low-elevation vs bg
      smallest adjustment: #1C3B35 -> #4B645F (3.01:1, same hue)
  - water-deep #0E5A73 on bg #0A0F14: 2.50:1 (needs 3:1) — Deep-water fill vs bg
      smallest adjustment: #0E5A73 -> #21677E (3.03:1, same hue)
```

`--terrain-1` and `--water-deep` are **exempt from the §6 "no raw hex" rule only as declared
tokens** — they still live in `tokens.css` and are referenced by name everywhere else.

---

## 5. Anti-patterns — banned

Each of these is a specific, recognisable failure. If a screenshot shows one, the build is
wrong regardless of how it looks otherwise.

| Banned | Why |
| --- | --- |
| **Purple/violet → blue gradient backgrounds** | The default AI-generated surface. Zero relation to rivers or tectonics. |
| **Emoji as icons** | Renders differently per platform, breaks the Lucide `strokeWidth={1.5}` system, is announced inconsistently by screen readers. Lucide only. |
| **Generic card grids** (three equal feature cards under a hero) | A SaaS landing page wearing a geography costume. The content here is a full-bleed 3D scene. |
| **Default Tailwind blue buttons** | Shipping the framework's defaults is shipping everyone else's design. |
| **Gradient buttons / gradient text** | Loud, and they compete with the terrain ramp, which is the only gradient that means anything. |
| **"AI sparkle" icons** (✨, four-pointed stars) | Means nothing and looks like a template. |
| **Lorem ipsum or fake statistics** | A fabricated discharge figure or magnitude is a **data-honesty defect**, not a placeholder. Use "—". |
| **Glassmorphism on everything** | `--blur-panel` is scoped to HUD panels only. Blurred buttons and inputs destroy legibility and read as decoration. |
| **Centered-hero SaaS layout** | A centred `max-w-4xl` column is the opposite of a full-bleed canvas. Break the grid; the scene is the page. |
| **Heavy shadows** | Depth comes from surface value steps and hairlines. One soft ambient shadow on floating HUD panels, nothing else. |
| **Excessive radii / mixed radii** | One radius (10px), one inner variant (6px). |
| **Unstyled disabled state** | Disabled mode-rail items in the placeholder are visibly inert *and* still readable. |

---

## 6. Component states

Every interactive element gets all five. This is the checklist, not optional polish.

```css
.rest            /* the token values above */
:hover           /* pointer only — never the sole affordance */
:active          /* a real transform, not just a colour shift */
:focus-visible   /* 2px solid var(--water), 2px offset — never outline:none */
:disabled        /* visibly inert, still readable, and focusable-adjacent */
[aria-busy]      /* reserve the space; never collapse layout */
```

Focus is **always** visible. The ring is `--water` at 2px with a 2px offset, which clears
3:1 on both `--bg` and `--surface` (verified §4.2). Touch targets are ≥ 44×44 CSS px.

State is **never** communicated by colour alone — pair every colour signal with an icon, a
label, or a shape change. A disabled mode rail item shows reduced opacity *and* a label;
an active plate line turns amber *and* thickens.

---

## 7. Checks before shipping

Run these in order. All four are `npm run verify` or already wired into it.

```bash
npm run contrast   # 1. palette still passes; paste real numbers into §4
npm run verify     # 2. lint + typecheck + test + build
npm run shots      # 3. docs/screenshots/ at 1440px and 390px — then LOOK at them
npm run e2e        # 4. axe scan + keyboard walk in the real browser
```

- [ ] No raw hex in `src/ui/` — grep for `#[0-9A-Fa-f]{6}` outside `tokens.css`.
- [ ] No raw px spacing outside the 8px grid.
- [ ] Every new string exists in **both** English and Assamese.
- [ ] Assamese renders in Noto Sans Bengali with no fallback boxes (screenshot).
- [ ] Focus visible on every control; no `outline: none` without a replacement.
- [ ] Verified at 1440px and 390px by looking at the actual pixels, not by trusting the
      assertions.
