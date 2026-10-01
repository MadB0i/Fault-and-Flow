# AGENTS.md — rules for coding agents

This file is binding on any human or automated agent working in this repository.
Read it before you change anything. It is short on purpose.

If a rule here conflicts with your own default habits, this file wins.

---

## 1. What this project is

**Fault & Flow** — an interactive 3D sandbox of Assam's earth and water, running
entirely in the browser. Three modes: **FLOW** (Brahmaputra flood + bank erosion on
real terrain), **FAULT** (NE India earthquake history as a timelapse), and **PLATES**
(a cinematic intro from the India–Eurasia collision down to Assam).

It is an **educational sandbox**. It is not a forecast, not a hazard map, and not a
prediction tool. Read `PRODUCT.md` before making product decisions.

---

## 2. Stack — do not substitute

| Concern | Choice |
| --- | --- |
| Build tool | Vite |
| Language | TypeScript, `strict: true` |
| UI layer | React — **HUD only** (panels, rails, readouts) |
| 3D layer | Three.js, imperative engine under `src/engine/` |
| UI state | Zustand |
| Styling | Tailwind + CSS-variable design tokens |
| Animation | motion (Framer Motion) |
| Unit tests | Vitest |
| Browser tests | Playwright |
| Lint / format | ESLint (flat config) + Prettier |
| Package manager | npm only |
| Runtime | Node 20+ |

Self-host fonts via `@fontsource/*` packages. **Never load fonts from a CDN.**

Do not add another framework, state library, 3D wrapper, or icon set without
raising it in an issue first. Fewer dependencies is the point.

---

## 3. The architecture rule — non-negotiable

> **The engine must be framework-agnostic and runnable headless. The UI talks to it
> through a small typed API.**

Concretely:

- **`src/engine/`** — Three.js, scene graph, simulations, data loading. **No React
  imports here, ever.** Not in a component, not in a type, not transitively. There
  is a lint rule enforcing this.
- The engine must import **nothing** from `src/ui/`.
- The engine must run in a plain Node process (no DOM) for the parts that can —
  which is why simulations have to be testable headlessly.
- **`src/ui/`** — React. Owns HUD rendering, focus, and language state. React never
  reaches into Three.js internals; it calls the typed engine API and renders state.
- **`src/shared/`** — types shared by both sides (the API contract). No DOM types,
  no Three.js types unless genuinely unavoidable.

If a task seems to require React inside the engine, the design is wrong. Change the
design.

### The typed API contract

The UI↔engine boundary is one explicit interface (see `docs/ARCHITECTURE.md`). Treat
it as the public surface of the engine. Changing it is a breaking change requiring a
commit message that says so.

---

## 4. Commands

```bash
npm install

npm run dev         # dev server
npm run build       # production build to dist/
npm run preview     # serve the built output

npm run lint        # ESLint
npm run format      # Prettier, write
npm run format:check
npm run typecheck   # tsc --noEmit
npm test            # Vitest (unit)
npm run test:watch
npm run e2e         # Playwright
npm run shots       # screenshots -> docs/screenshots/
npm run verify      # lint + typecheck + test + build  ← run before finishing
npm run contrast    # recompute WCAG contrast for the palette
```

**`npm run verify` must pass before you finish any task.** If it fails, the task is
not done. If it fails for a reason unrelated to your change, say so explicitly in
your report rather than reverting someone else's work.

---

## 5. Git and commit style

- One commit per task. Do not batch unrelated changes.
- Conventional Commits: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`,
  `perf:`, `build:`, `ci:`.
- Imperative mood, subject under ~72 characters, no trailing period.
- Scope out when it adds information: `feat(engine): ...`, `docs(data): ...`.
- Write the body for **why**, not **what**. The diff already says what.
- Never `git commit --amend` or force-push a shared branch.
- Never commit directly to `main` unless explicitly asked.
- **Never commit secrets.** No API keys, tokens, `.env` files, or credentials.

### File size limit

> **Never commit a file over 5 MB.**

Before staging, check what you're adding:

```bash
git diff --cached --name-only | while read f; do [ -f "$f" ] && du -k "$f"; done | sort -rn | head
```

If a file exceeds 5 MB, it does not belong in git — find a smaller committed
representation, a build-time fetch, or a procedural substitute. This limit exists
because git history is permanent: a 300 MB DEM committed once stays downloadable
from every clone forever.

---

## 6. Data honesty — the most important rule in this file

This is a scientific-education project about real geography. Fabricated data is a
defect, not a shortcut.

### Never invent data

- **Never fabricate a statistic, earthquake magnitude, river discharge, elevation,
  casualty figure, or historical date.** If a number is not in a cited source, it
  does not exist in this repo.
- No `Math.random()` standing in for a real measurement. If you need procedural
  variation for a visual effect, it must be visibly synthetic and named as such in
  code.
- No placeholder numbers in visible UI. If a value is unknown, show "—" or a proper
  empty state. Never `0`, never `42`, never "Lorem".

### Never invent license terms

- Every dataset's license must be **quoted verbatim from the source**, with the URL
  you retrieved it from and the date.
- If you cannot find an explicit license statement, write **`UNVERIFIED`** in
  `docs/DATA.md`. Do not guess, do not infer from convention, do not write
  "public domain" because that is probably what it is.
- Do not apply one project's license to another. Third-party conversions
  (e.g. a GitHub shapefile-to-GeoJSON repo) carry their **own** license that may
  differ from the upstream data. Attribute each layer to the license that actually
  governs it.
- Redistributing data is a separate question from *using* it. Check the terms for
  redistribution and modification, not just access.

### Always cite sources

- Every data file in `data/processed/` traces to a row in `docs/DATA.md`.
- Every row in `docs/DATA.md` has: source URL, retrieval date, verbatim license
  text or `UNVERIFIED`, and required attribution.
- Verify a URL resolves before you put it in a file. A dead link in a citation is a
  lie by omission.

---

## 7. Honesty rules — never soften these

`PRODUCT.md` states them; they are not negotiable in copy, code, or UI:

1. This is **not** a forecast and **not** a hazard map.
2. Earthquakes **cannot** be predicted. Never imply prediction, never use
   future-tense language about an upcoming earthquake.
3. Flood visuals are **illustrative**, not modelled forecasts.
4. Link official sources: ASDMA, National Center for Seismology, IMD.

Never write UI copy that implies authority the project does not have. "Estimated
discharge" is fine. "Expected flood level" is not.

---

## 8. Design rules

`DESIGN.md` is the source of truth. In short:

- Colours come from CSS-variable tokens only. No raw hex in components.
- Water and seismic-amber are the **only** accents.
- Fonts: Fraunces (display only), Instrument Sans (UI), JetBrains Mono (data),
  Noto Sans Bengali (Assamese). Never Inter, Roboto, Arial, or `system-ui` as a
  display face.
- Space on the 8px grid, radius 10px, 1px hairline borders, subtle blur on HUD
  panels only.
- Icons: Lucide, `strokeWidth={1.5}`.
- Animate with `cubic-bezier(0.22, 1, 0.36, 1)` at 150 / 300 / 600ms. No bounce,
  no spring overshoot. Honour `prefers-reduced-motion`.
- Run `npm run contrast` after touching any colour token and paste real numbers
  into `DESIGN.md`. Do not estimate contrast.

If a palette pair fails AA, **propose the adjustment to the user. Do not silently
change the palette.**

---

## 9. Accessibility

Target WCAG 2.2 AA.

- Native elements first. A `<div onClick>` must become a `<button>`. Never bolt
  ARIA onto a div to fake semantics.
- Every control has an accessible name. Every image has `alt`.
- Visible focus everywhere; `:focus-visible` with a 2px ring. Never
  `outline: none` without a replacement.
- Never communicate state by colour alone — pair it with an icon, label, or shape.
- Touch targets ≥ 44×44 CSS px.
- Both UI languages, English and Assamese. Assamese strings in the shipping
  `Noto Sans Bengali` — verify glyph coverage with a test, don't assume it.
- Errors say what happened and what to do next. No status codes, no stack traces.

---

## 10. Scope discipline

- Stick to the task you were given. Do not start the next phase unprompted.
- Do not refactor code you are not already touching.
- If you find an unrelated bug, report it; do not silently fix it.
- Do not add dependencies "while you're there".
- This is **foundation work** until `docs/ROADMAP.md` says otherwise. If you are
  unsure whether something belongs in the current phase, it probably doesn't.

---

## 11. Definition of done

- [ ] `npm run verify` passes (lint + typecheck + test + build)
- [ ] No React import anywhere in `src/engine/`
- [ ] No raw hex, raw px, or off-scale spacing in `src/ui/`
- [ ] Every new data artefact documented in `docs/DATA.md` with verbatim license
- [ ] Every new UI string exists in both English and Assamese
- [ ] Accessible name on every new control
- [ ] No file over 5 MB committed
- [ ] One conventional commit, message explaining why
- [ ] Screenshots updated if the UI changed
- [ ] Verified at 1440px and 390px by looking at the actual pixels

---

## 12. Things that will get a PR rejected

- A fabricated statistic, magnitude, or elevation.
- A licence term written from memory instead of quoted from the source.
- A "public domain" claim on a dataset you did not personally verify.
- A React import in `src/engine/`.
- An estimate of a contrast ratio typed by hand.
- A raw hex colour in a component.
- A font loaded from Google Fonts or any CDN.
- Language implying earthquake prediction or flood forecasting.
- A 40 MB DEM committed to git.
- Emoji used as an icon.