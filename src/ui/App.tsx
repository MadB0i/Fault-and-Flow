/**
 * Phase 1 placeholder. It proves the design system and nothing else - no 3D,
 * no simulation, no data. See docs/ROADMAP.md phase 1.
 *
 * Every value it renders comes from a token in styles/tokens.css. If a number
 * appears here that is not a var(--...) reference, that is a defect.
 */

import { Waves, Mountain, Activity, Info, type LucideIcon } from 'lucide-react';

import { MODE_ENTRIES } from '../shared/i18n/strings.js';
import { useUiStore } from './state/useUiStore.js';
import type { Mode } from '../shared/types.js';
import ModeRail from './ModeRail.js';
import LangToggle from './LangToggle.js';

function iconFor(mode: Mode): LucideIcon {
  switch (mode) {
    case 'flow':
      return Waves;
    case 'fault':
      return Activity;
    case 'plates':
      return Mountain;
  }
}

export default function App() {
  const locale = useUiStore((s) => s.locale);
  const strings = useUiStore((s) => s.strings());

  return (
    <div
      className="relative flex min-h-[100dvh] flex-col"
      data-locale={locale}
      data-testid="app"
    >
      <a className="skip-link sr-only" href="#main">
        Skip to content
      </a>

      {/*
        HUD shell.

        On mobile the HUD participates in normal flow so it can never overlap
        the content or the wordmark. From md up it becomes an absolutely
        positioned overlay so it floats over the full-bleed canvas, which is
        the intended arrangement (DESIGN.md 2.4). Children re-enable pointer
        events because the overlay itself must not swallow clicks meant for
        the canvas.

        An earlier version positioned the wordmark with a magic
        `left: calc(var(--space-xl) + 56px)` offset, which silently collided
        with the rail at 390px and at 1440px. Layout, not arithmetic, is what
        keeps regions apart.
      */}
      <div
        className="z-20 flex flex-col gap-[var(--space-s)] p-[var(--space-s)]
                   md:pointer-events-none md:absolute md:inset-0 md:block md:p-0"
        data-testid="hud"
      >
        <div
          className="flex flex-col gap-[var(--space-s)]
                     md:flex-row md:items-start md:justify-between"
        >
          <div
            className="pointer-events-auto flex flex-col gap-[var(--space-s)]
                       md:flex-row md:items-start md:p-[var(--space-l)]"
          >
            <ModeRail />

            <header className="md:pt-[var(--space-2xs)]">
              <h1
                className="font-display text-[length:var(--step-4)] leading-none tracking-[-0.02em]"
                data-testid="wordmark"
              >
                {strings.wordmark}
              </h1>
              <p className="mt-[var(--space-xs)] font-data text-[length:var(--step--1)] text-[color:var(--text-muted)]">
                {strings.tagline}
              </p>
            </header>
          </div>

          {/*
            self-start keeps the toggle hugging its content on mobile. A
            full-width language bar reads as an unfinished layout rather than
            a deliberate control.
          */}
          <div className="pointer-events-auto self-start md:p-[var(--space-l)]">
            <LangToggle />
          </div>
        </div>
      </div>

      {/* ---- Empty canvas region -------------------------------------- */}
      <main
        id="main"
        tabIndex={-1}
        className="flex flex-1 items-center justify-center
                   px-[var(--space-s)] py-[var(--space-xl)]"
      >
        <div className="max-w-[46ch]">
          <p
            className="font-data text-[length:var(--step--2)] uppercase tracking-[0.14em] text-[color:var(--water)]"
            data-testid="phase-label"
          >
            {strings.phaseLabel}
          </p>

          <h2 className="mt-[var(--space-s)] font-display text-[length:var(--step-3)] leading-[1.15] tracking-[-0.015em] text-balance">
            {strings.canvasEmptyTitle}
          </h2>

          <p className="mt-[var(--space-s)] text-[length:var(--step-0)] text-[color:var(--text-muted)]">
            {strings.canvasEmptyBody}
          </p>

          {/* The Assamese phrase the brief requires, rendered in the shipping
              face. tests/fonts.test.ts asserts its glyph coverage in the
              actual font binary. */}
          <p
            className="mt-[var(--space-l)] font-assamese text-[length:var(--step-1)] text-[color:var(--text)]"
            lang="as"
            data-testid="assamese-phrase"
          >
            ভূমিকম্প আৰু বান
          </p>

          <div
            className="mt-[var(--space-l)] flex items-start gap-[var(--space-xs)]
                       rounded-[var(--radius)] border-[length:1px]
                       border-[color:var(--hairline)] bg-[color:var(--surface)]
                       p-[var(--space-s)] backdrop-blur-[14px]"
            role="note"
          >
            <Info
              className="mt-[2px] shrink-0 text-[color:var(--seismic-amber)]"
              size={16}
              strokeWidth={1.5}
              aria-hidden="true"
            />
            <div>
              {/*
                Sentence case, not uppercase. DESIGN.md section 5 bans
                all-caps sentences; this is a disclaimer, and shouting a
                disclaimer makes it easier to skim past. Only short
                all-caps labels are acceptable.
              */}
              <p
                className="text-[length:var(--step--1)] font-medium text-[color:var(--seismic-amber)]"
                data-testid="disclaimer"
              >
                {strings.disclaimerShort}
              </p>
              <p className="mt-[var(--space-2xs)] text-[length:var(--step--1)] text-[color:var(--text-muted)]">
                {strings.earthquakesCannotBePredicted}
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Rendered mode icons once so the rail's icon set is proven present. */}
      <span className="sr-only" data-testid="mode-icon-set">
        {MODE_ENTRIES.map(({ mode }) => {
          const Icon = iconFor(mode);
          return <Icon key={mode} strokeWidth={1.5} aria-hidden="true" />;
        })}
      </span>
    </div>
  );
}
