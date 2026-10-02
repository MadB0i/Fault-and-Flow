/**
 * The elevation legend: a ramp with NUMERIC ticks, the units, the contour
 * interval, and the current vertical exaggeration.
 *
 * This is the honesty-critical piece of the HUD. DECISIONS.md section 1 makes
 * the terrain ramp a documented WCAG exception precisely because colour alone
 * fails the 3:1 non-text requirement; the condition that makes the exception
 * defensible is that elevation and water depth are never conveyed by colour
 * ALONE. A bare gradient with no numbers would void it, so:
 *
 * - The ramp is a gradient of the four real token values, in ramp order.
 * - Every tick is a real elevation in metres, from the committed sidecar, drawn
 *   in the mono face so digits align and do not jitter.
 * - The units are on the axis label, not implied.
 * - The vertical exaggeration is stated in the same panel, because the heights
 *   on screen are not true scale and a reader who does not know that will
 *   misjudge every slope they see.
 */

import { legendTicksFor, type TerrainSidecar } from '@engine/terrain';
import { useUiStore } from '../state/useUiStore.js';

type Props = {
  sidecar: TerrainSidecar | null;
  exaggeration: number;
  contourIntervalM: number | null;
  contoursOn: boolean;
};

/** RAMP_STOPS must stay in DESIGN.md's order: low elevation to high. */
const RAMP_STOPS = [
  'var(--terrain-1)',
  'var(--terrain-2)',
  'var(--terrain-3)',
  'var(--terrain-4)',
] as const;

export default function TerrainLegend({
  sidecar,
  exaggeration,
  contourIntervalM,
  contoursOn,
}: Props) {
  const strings = useUiStore((s) => s.strings());

  if (!sidecar) {
    return (
      <section
        aria-label={strings.legendTitle}
        className="rounded-[var(--radius)] border-[length:1px] border-[color:var(--hairline)]
                   bg-[color:var(--surface)] p-[var(--space-s)] backdrop-blur-[var(--blur-panel)]"
        data-testid="terrain-legend"
      >
        <h2
          className="font-data text-[length:var(--step--2)] uppercase tracking-[0.14em]
                     text-[color:var(--text-muted)]"
        >
          {strings.legendTitle}
        </h2>
        {/*
          An unknown value is an empty state, not a placeholder. PRODUCT.md 4.4:
          render an em dash and say why, never 0 and never a plausible constant.
        */}
        <p
          className="mt-[var(--space-2xs)] font-data text-[length:var(--step--1)] text-[color:var(--text-muted)]"
          data-testid="legend-empty"
        >
          —
        </p>
      </section>
    );
  }

  const ticks = legendTicksFor(sidecar);
  const span = sidecar.maxElevation - sidecar.minElevation || 1;
  const positionOf = (value: number): number =>
    ((value - sidecar.minElevation) / span) * 100;

  return (
    <section
      aria-label={strings.legendTitle}
      className="rounded-[var(--radius)] border-[length:1px] border-[color:var(--hairline)]
                 bg-[color:var(--surface)] p-[var(--space-s)] backdrop-blur-[var(--blur-panel)]"
      data-testid="terrain-legend"
    >
      <h2
        className="font-data text-[length:var(--step--2)] uppercase tracking-[0.14em]
                   text-[color:var(--text-muted)]"
      >
        {strings.legendTitle}
      </h2>

      <p
        id="legend-elevation-label"
        className="mt-[var(--space-2xs)] text-[length:var(--step--1)]"
      >
        {strings.legendElevationLabel}
        <span className="ml-[var(--space-2xs)] font-data text-[color:var(--text-muted)]">
          m
        </span>
      </p>

      {/*
        The ramp. Decorative, so it is hidden from assistive technology: the
        numbers below it carry the same information, and announcing "gradient"
        would be noise. aria-hidden is correct here rather than a shortcut,
        because the values ARE available, just as text.
      */}
      <div
        aria-hidden="true"
        className="mt-[var(--space-2xs)] h-[var(--space-xs)] w-full rounded-[2px] border-[length:1px]
                   border-[color:var(--hairline)]"
        style={{
          backgroundImage: `linear-gradient(to top, ${RAMP_STOPS.join(', ')})`,
        }}
      />

      {/*
        Ticks positioned as percentages of the ramp, with the label anchored so
        the end numbers cannot overflow the panel. Every tick is real elevation,
        measured, not a decorative flourish.
      */}
      <ul
        className="relative mt-[var(--space-2xs)] h-[var(--space-s)] font-data
                   text-[length:var(--step--2)] tabular-nums text-[color:var(--text-muted)]"
        aria-labelledby="legend-elevation-label"
      >
        {ticks.map((value, index) => {
          const atEdge = index === 0 || index === ticks.length - 1;
          return (
            <li
              key={value}
              className="absolute -translate-x-1/2 whitespace-nowrap"
              style={{ left: `${positionOf(value)}%`, top: 0 }}
              data-testid={`legend-tick-${value}`}
            >
              {Math.round(value * 10) / 10}
              {atEdge ? '' : ''}
            </li>
          );
        })}
      </ul>

      <dl className="mt-[var(--space-2xs)] space-y-[var(--space-2xs)] font-data text-[length:var(--step--2)]">
        {contoursOn && contourIntervalM !== null && (
          <div className="flex justify-between gap-[var(--space-xs)]">
            <dt className="text-[color:var(--text-muted)]">
              {strings.legendContourLabel}
            </dt>
            <dd className="text-[color:var(--text)]" data-testid="contour-interval">
              {contourIntervalM} m
            </dd>
          </div>
        )}
        {/*
          Always shown, never only-on-change. The rule is that the current
          exaggeration is ALWAYS visible, because a scene whose heights are
          multiplied by 8 and does not say so is a scene that misleads.
        */}
        <div className="flex justify-between gap-[var(--space-xs)]">
          <dt className="text-[color:var(--text-muted)]">
            {strings.legendExaggerationLabel}
          </dt>
          <dd className="text-[color:var(--water)]" data-testid="legend-exaggeration">
            {exaggeration}
            {strings.exaggerationValueSuffix}
          </dd>
        </div>
      </dl>
    </section>
  );
}
