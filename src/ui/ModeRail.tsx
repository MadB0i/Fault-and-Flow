/**
 * Left mode rail. Reads as an instrument channel selector: channel code in the
 * data face, label beside it, all three channels present but not yet built.
 *
 * Each item is a real <button>. A <div onClick> would need role, tabindex,
 * Enter/Space handlers, and a disabled state bolted on by hand - and would
 * still be wrong. See building-accessible-interfaces.
 */

import { Waves, Mountain, Activity, type LucideIcon } from 'lucide-react';

import { MODE_ENTRIES } from '../shared/i18n/strings.js';
import { useUiStore } from './state/useUiStore.js';
import type { Mode } from '../shared/types.js';

/**
 * Exhaustive switch rather than an indexed lookup: under
 * noUncheckedIndexedAccess a Record index reads as possibly-undefined, which
 * TS cannot verify away. Adding a fourth mode here is a compile error, which is
 * the behaviour we want.
 */
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

export default function ModeRail() {
  const strings = useUiStore((s) => s.strings());

  return (
    <nav
      aria-label={strings.modeRailLabel}
      // Horizontal on mobile, vertical from md up. Changing direction rather
      // than squeezing a 200px column into 390px is what keeps the three
      // channels legible on a phone.
      className="w-full rounded-[var(--radius)] border-[length:1px] border-[color:var(--hairline)]
                 bg-[color:var(--surface)] p-[var(--space-xs)] backdrop-blur-[14px]
                 md:w-[200px]"
      data-testid="mode-rail"
    >
      <ul
        className="flex flex-row gap-[var(--space-2xs)] md:flex-col"
        data-testid="mode-rail-list"
      >
        {MODE_ENTRIES.map(({ mode, labelKey, code }) => {
          const Icon = iconFor(mode);

          return (
            <li key={mode} className="flex-1 md:flex-none">
              <button
                type="button"
                // Genuinely disabled: the mode is not built. Never `disabled`
                // on a submit as a validation gate, and never a control that
                // looks live but does nothing.
                disabled
                aria-disabled="true"
                data-testid={`mode-${mode}`}
                data-mode={mode}
                className="group flex min-h-[44px] w-full cursor-not-allowed items-center gap-[var(--space-xs)]
                           rounded-[var(--radius-sm)] px-[var(--space-xs)] text-left
                           opacity-45 transition-[background-color,opacity] duration-150
                           ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-[color:var(--surface-raised)]
                           focus-visible:bg-[color:var(--surface-raised)]"
              >
                <span
                  className="font-data text-[length:var(--step--2)] tabular-nums text-[color:var(--text-muted)]"
                  aria-hidden="true"
                >
                  {code}
                </span>
                <Icon
                  size={16}
                  strokeWidth={1.5}
                  className="shrink-0 text-[color:var(--text-muted)]"
                  aria-hidden="true"
                />
                <span className="truncate text-[length:var(--step-0)]">
                  {strings[labelKey]}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <p
        className="mt-[var(--space-xs)] border-t-[length:1px] border-[color:var(--hairline)]
                   px-[var(--space-xs)] pt-[var(--space-xs)] font-data
                   text-[length:var(--step--2)] text-[color:var(--text-muted)]"
      >
        {strings.modeUnavailable}
      </p>
    </nav>
  );
}
