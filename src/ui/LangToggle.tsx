/**
 * Language toggle. A two-option radio group, which is what it is - so it is
 * built from native radio inputs rather than styled divs. Native semantics give
 * arrow-key navigation, a group name announcement, and correct form behaviour
 * for free.
 *
 * Assamese is a first-class rendering path: the selected label switches to the
 * Noto Sans Bengali face so the script renders in its own typeface.
 */

import { useUiStore } from './state/useUiStore.js';
import { LOCALES } from '../shared/types.js';

export default function LangToggle() {
  const locale = useUiStore((s) => s.locale);
  const setLocale = useUiStore((s) => s.setLocale);
  const strings = useUiStore((s) => s.strings());

  return (
    <fieldset
      className="rounded-[var(--radius)] border-[length:1px] border-[color:var(--hairline)] bg-[color:var(--surface)] p-[var(--space-2xs)] backdrop-blur-[14px]"
      data-testid="lang-toggle"
    >
      <legend className="sr-only">{strings.languageToggleLabel}</legend>

      <div className="flex gap-[var(--space-2xs)]">
        {LOCALES.map((code) => {
          const checked = locale === code;
          const label =
            code === 'en' ? strings.languageEnglish : strings.languageAssamese;

          return (
            <label
              key={code}
              className="flex min-h-[32px] cursor-pointer items-center gap-[var(--space-2xs)] rounded-[var(--radius-sm)] px-[var(--space-xs)] text-[length:var(--step--1)] transition-colors duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-[color:var(--surface-raised)] has-[:focus-visible]:bg-[color:var(--surface-raised)]"
            >
              <input
                type="radio"
                name="locale"
                value={code}
                checked={checked}
                onChange={() => setLocale(code)}
                className="h-[14px] w-[14px] accent-[color:var(--water)]"
                // The visible label is already in the correct script for its
                // own language; the accessible name must match it, not
                // override it, or voice control breaks.
              />
              <span
                lang={code}
                className={
                  code === 'as'
                    ? 'font-assamese'
                    : 'font-ui text-[color:var(--text-muted)]'
                }
              >
                {label}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
