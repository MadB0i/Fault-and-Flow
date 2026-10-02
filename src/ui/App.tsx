/**
 * Phase 3: the terrain viewer, inside the phase-1 shell.
 *
 * The HUD shell - mode rail, wordmark, language toggle - is unchanged from
 * phase 1, because the mode rail is still three disabled channels and pretending
 * otherwise would be a claim the product cannot make. What changed is the
 * canvas region: it now holds the real terrain viewer instead of a placeholder.
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
import TerrainScene from './terrain/TerrainScene.js';

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

      {/*
        The terrain viewer. It owns the canvas and its own HUD; the shell above
        stays exactly as phase 1 left it.
      */}
      <TerrainScene />

      {/*
        The honesty banner stays pinned and always visible over the scene. A
        disclaimer that has to be scrolled to, or that disappears behind a
        control panel, is a disclaimer most people never read.
      */}
      <div
        className="pointer-events-none fixed inset-x-0 top-[var(--space-xl)] z-30
                   mx-auto w-[min(100%,520px)] px-[var(--space-s)]
                   md:top-[var(--space-s)] md:right-[var(--space-s)] md:left-auto"
        role="note"
        data-testid="disclaimer-banner"
      >
        <div
          className="flex items-start gap-[var(--space-xs)]
                     rounded-[var(--radius)] border-[length:1px]
                     border-[color:var(--hairline)] bg-[color:var(--surface)]
                     p-[var(--space-s)] backdrop-blur-[var(--blur-panel)]"
        >
          <Info
            // Optical alignment with the first line's cap height, using a
            // space token rather than a raw 2px nudge.
            className="mt-[var(--space-2xs)] shrink-0 text-[color:var(--seismic-amber)]"
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
            {/*
              The terrain-specific line. PRODUCT.md 4.1 forbids any framing that
              suggests prediction; "illustrative" is the word that keeps a
              screenshot of this scene from being mistakable for a forecast.
            */}
            <p
              className="mt-[var(--space-2xs)] text-[length:var(--step--1)] text-[color:var(--text-muted)]"
              data-testid="terrain-honesty"
            >
              {strings.terrainIllustrativeNote}
            </p>
          </div>
        </div>
      </div>

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
