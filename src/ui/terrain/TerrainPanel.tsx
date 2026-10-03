/**
 * Area picker, vertical-exaggeration slider, contour toggle, reset.
 *
 * Native elements throughout. The area picker is a real radio group inside a
 * fieldset so screen readers announce "2 of 3"; the slider is a real range input
 * so it gets keyboard stepping, touch dragging and a value announcement for
 * free; the contour toggle is a checkbox, which reports its own state.
 *
 * Every control has a visible label. DESIGN.md section 8 forbids communicating
 * state by colour alone, so the selected area is marked by `aria-checked` and by
 * the radio's own semantics rather than by a highlight the eye has to notice.
 */

import { RotateCcw } from 'lucide-react';

import { AREA_IDS, areaDefinition, type AreaId } from '@engine/terrain';
import { useUiStore } from '../state/useUiStore.js';
import { MAX_EXAGGERATION, MIN_EXAGGERATION } from './useTerrainView.js';

type Props = {
  areaId: AreaId;
  onArea: (id: AreaId) => void;
  exaggeration: number;
  onExaggeration: (value: number) => void;
  contours: boolean;
  onContours: (on: boolean) => void;
  onReset: () => void;
  disabled?: boolean;
  overviewOnly?: boolean;
};

const TITLE_KEYS = {
  'assam-overview': 'areaOverviewTitle',
  majuli: 'areaMajuliTitle',
  'sadiya-dibrugarh': 'areaSadiyaTitle',
} as const satisfies Record<
  AreaId,
  'areaOverviewTitle' | 'areaMajuliTitle' | 'areaSadiyaTitle'
>;

export default function TerrainPanel({
  areaId,
  onArea,
  exaggeration,
  onExaggeration,
  contours,
  onContours,
  onReset,
  disabled = false,
  overviewOnly = false,
}: Props) {
  const strings = useUiStore((s) => s.strings());

  return (
    <section
      aria-label={strings.areaPickerLabel}
      className="rounded-[var(--radius)] border-[length:1px] border-[color:var(--hairline)]
                 bg-[color:var(--surface)] p-[var(--space-s)] backdrop-blur-[var(--blur-panel)]"
      data-testid="terrain-panel"
    >
      {/*
        A fieldset with a legend, not a div with a role. The legend is what tells
        a screen-reader user what the three radios are radios OF.
      */}
      {!overviewOnly && (
        <fieldset className="border-0 p-0" disabled={disabled}>
          <legend
            className="mb-[var(--space-2xs)] font-data text-[length:var(--step--2)]
                     uppercase tracking-[0.14em] text-[color:var(--text-muted)]"
          >
            {strings.areaPickerLabel}
          </legend>

          <div className="flex flex-col gap-[var(--space-2xs)]" role="none">
            {AREA_IDS.map((id) => {
              const def = areaDefinition(id);
              if (!def) return null;
              const selected = id === areaId;
              return (
                <label
                  key={id}
                  className="flex min-h-[44px] cursor-pointer items-center gap-[var(--space-xs)]
                           rounded-[var(--radius-sm)] px-[var(--space-xs)]
                           transition-colors duration-150
                           ease-[cubic-bezier(0.22,1,0.36,1)]
                           hover:bg-[color:var(--surface-raised)]
                           has-[:focus-visible]:bg-[color:var(--surface-raised)]"
                >
                  <input
                    type="radio"
                    name="terrain-area"
                    value={id}
                    checked={selected}
                    onChange={() => onArea(id)}
                    className="size-[16px] shrink-0 accent-[color:var(--water)]"
                    data-testid={`area-${id}`}
                  />
                  <span className="text-[length:var(--step--1)]">
                    {strings[TITLE_KEYS[id]]}
                  </span>
                  {/*
                  The default exaggeration is shown next to the area rather than
                  only in the slider, because it changes with the area and a
                  user who did not touch the slider still needs to know the
                  heights on screen are not true scale.
                */}
                  <span
                    className="ml-auto font-data text-[length:var(--step--2)]
                             text-[color:var(--text-muted)]"
                    aria-hidden="true"
                  >
                    {def.defaultVerticalExaggeration}
                    {strings.exaggerationValueSuffix}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      )}

      <div className="mt-[var(--space-s)] border-t-[length:1px] border-[color:var(--hairline)] pt-[var(--space-s)]">
        <label
          htmlFor="terrain-exaggeration"
          className="flex items-baseline justify-between gap-[var(--space-xs)]"
        >
          <span className="text-[length:var(--step--1)]">
            {strings.exaggerationLabel}
          </span>
          <output
            htmlFor="terrain-exaggeration"
            className="font-data text-[length:var(--step--1)] text-[color:var(--water)]"
            data-testid="exaggeration-value"
          >
            {exaggeration}
            {strings.exaggerationValueSuffix}
          </output>
        </label>

        <input
          id="terrain-exaggeration"
          type="range"
          min={MIN_EXAGGERATION}
          max={MAX_EXAGGERATION}
          step={1}
          value={exaggeration}
          disabled={disabled}
          onChange={(event) => onExaggeration(Number(event.target.value))}
          aria-describedby="terrain-exaggeration-hint"
          className="mt-[var(--space-2xs)] w-full accent-[color:var(--water)]"
          data-testid="exaggeration-slider"
        />

        <p
          id="terrain-exaggeration-hint"
          className="mt-[var(--space-2xs)] text-[length:var(--step--2)] text-[color:var(--text-muted)]"
        >
          {strings.exaggerationHint}
        </p>
      </div>

      <div className="mt-[var(--space-s)] flex items-center justify-between gap-[var(--space-xs)]">
        <label
          htmlFor="terrain-contours"
          className="flex min-h-[44px] cursor-pointer items-center gap-[var(--space-xs)]"
        >
          <input
            id="terrain-contours"
            type="checkbox"
            checked={contours}
            disabled={disabled}
            onChange={(event) => onContours(event.target.checked)}
            aria-describedby="terrain-contours-hint"
            className="size-[16px] shrink-0 accent-[color:var(--water)]"
            data-testid="contours-toggle"
          />
          <span className="text-[length:var(--step--1)]">{strings.contoursLabel}</span>
        </label>

        <button
          type="button"
          onClick={onReset}
          disabled={disabled}
          className="flex min-h-[44px] items-center gap-[var(--space-2xs)] rounded-[var(--radius-sm)]
                     px-[var(--space-xs)] text-[length:var(--step--1)]
                     transition-colors duration-150 ease-[cubic-bezier(0.22,1,0.36,1)]
                     hover:bg-[color:var(--surface-raised)]
                     focus-visible:bg-[color:var(--surface-raised)]
                     disabled:cursor-not-allowed disabled:opacity-45"
          data-testid="reset-view"
        >
          <RotateCcw size={16} strokeWidth={1.5} aria-hidden="true" />
          {strings.resetViewLabel}
        </button>
      </div>

      <p
        id="terrain-contours-hint"
        className="mt-[var(--space-2xs)] text-[length:var(--step--2)] text-[color:var(--text-muted)]"
      >
        {strings.contoursHint}
      </p>
    </section>
  );
}
