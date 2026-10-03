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

import {
  rampTickStepFor,
  rampTicks,
  type RampRange,
  type TerrainSidecar,
} from '@engine/terrain';
import { useUiStore } from '../state/useUiStore.js';

type Props = {
  sidecar: TerrainSidecar | null;
  /** Range the ramp actually displays; drives the elevation axis. */
  ramp: RampRange | null;
  exaggeration: number;
  contourIntervalM: number | null;
  contoursOn: boolean;
  /** Water depth section; shown only while the layer runs on a device that can. */
  waterOn: boolean;
  waterMaxDepthM: number | null;
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
  ramp,
  exaggeration,
  contourIntervalM,
  contoursOn,
  waterOn,
  waterMaxDepthM,
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

  // The axis spans what the ramp DISPLAYS, which is the 2nd..98th percentile
  // of this area's elevations - not the sidecar's bbox extremes. On the
  // overview those extremes are 0..7330 m (the bbox clips the Mishmi Hills),
  // which squeezed the entire floodplain into the bottom 2% of the ramp.
  const axis = ramp ?? {
    min: sidecar.minElevation,
    max: sidecar.maxElevation,
    clippedLow: false,
    clippedHigh: false,
    degenerate: false,
  };
  // 46px is the narrowest gap four mono digits plus a decimal point need at
  // --step--2, so this is what stops neighbouring tick labels colliding.
  const candidates = rampTicks(axis, rampTickStepFor(axis, 240, 60));
  const ticks = candidates.filter(
    (v, i) =>
      i === 0 ||
      i === candidates.length - 1 ||
      (v - axis.min > (axis.max - axis.min) * 0.18 &&
        axis.max - v > (axis.max - axis.min) * 0.18),
  );
  const span = axis.max - axis.min || 1;
  const positionOf = (value: number): number => ((value - axis.min) / span) * 100;

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
          backgroundImage: `linear-gradient(to right, ${RAMP_STOPS.join(', ')})`,
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
          // End labels are pushed inward so they cannot overflow the panel;
          // interior ones centre on their tick. Clamping the offset rather
          // than dropping the label keeps both ends of the axis readable.
          const atEdge = index === 0 || index === ticks.length - 1;
          const translate = atEdge
            ? index === 0
              ? 'translate-x-0'
              : '-translate-x-full'
            : '-translate-x-1/2';
          return (
            <li
              key={value}
              className={`absolute whitespace-nowrap ${translate}`}
              style={{ left: `${positionOf(value)}%`, top: 0 }}
              data-testid={`legend-tick-${value}`}
            >
              {Math.round(value * 10) / 10}
            </li>
          );
        })}
      </ul>

      <p
        className="mt-[var(--space-2xs)] font-data text-[length:var(--step--2)] text-[color:var(--text-muted)]"
        data-testid="legend-ramp-note"
      >
        {strings.legendRampNote}
      </p>

      {/*
        Clipped ends, stated rather than hidden. Where the ramp is a
        percentile stretch, real terrain exists outside it, and a legend that
        silently stops at the 98th percentile invites the reader to believe
        nothing on screen is higher.
      */}
      {(axis.clippedLow || axis.clippedHigh) && (
        <p
          className="mt-[var(--space-2xs)] font-data text-[length:var(--step--2)] text-[color:var(--text-muted)]"
          data-testid="legend-clipped"
        >
          {axis.clippedLow && axis.clippedHigh
            ? `${strings.legendClippedBoth} ${Math.round(sidecar.minElevation)}–${Math.round(sidecar.maxElevation)} m`
            : axis.clippedLow
              ? `${strings.legendClippedLow} ${Math.round(sidecar.minElevation)} m`
              : `${strings.legendClippedHigh} ${Math.round(sidecar.maxElevation)} m`}
        </p>
      )}

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
        {waterOn && (
          <div className="flex justify-between gap-[var(--space-xs)]">
            <dt className="text-[color:var(--text-muted)]">{strings.legendWaterLabel}</dt>
            <dd className="text-[color:var(--water)]" data-testid="legend-water-max">
              {waterMaxDepthM === null ? '—' : `${waterMaxDepthM.toFixed(1)} m`}
            </dd>
          </div>
        )}
      </dl>
      {waterOn && (
        <div
          aria-hidden="true"
          className="mt-[var(--space-2xs)] h-[var(--space-xs)] w-full rounded-[2px] border-[length:1px]
                     border-[color:var(--hairline)]"
          style={{
            backgroundImage: 'linear-gradient(to right, var(--water), var(--water-deep))',
          }}
          data-testid="legend-water-ramp"
        />
      )}
    </section>
  );
}
