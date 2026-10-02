/**
 * Elevation and coordinates under the pointer, plus the keyboard equivalent.
 *
 * Two readouts, deliberately. The pointer readout is what a mouse or finger user
 * sees. The camera-target readout is what a keyboard user gets, because the
 * canvas readout is otherwise unreachable without a pointing device - and a
 * number only a mouse can reach is not a number the interface actually offers.
 *
 * An unknown elevation renders as an em dash with a stated reason, never as 0.
 * Zero is a real elevation and the Brahmaputra floodplain genuinely sits near it,
 * so a 0 there would be a claim about the ground. PRODUCT.md section 4.4.
 */

import type { TerrainProbe } from '@engine/terrain';
import { useUiStore } from '../state/useUiStore.js';

type Props = {
  pointer: TerrainProbe | null;
  cameraTarget: TerrainProbe | null;
  ready: boolean;
};

/** Metres, to the resolution the source data actually carries. */
function formatElevation(value: number | null): string {
  if (value === null) return '—';
  // One decimal: the reaches encode 0.1 m, and more digits than the step would
  // be false precision on a DEM with a measured LE90 of 1.472 m.
  return value.toFixed(1);
}

function formatLat(value: number): string {
  return `${value.toFixed(4)}° N`;
}

function formatLon(value: number): string {
  return `${value.toFixed(4)}° E`;
}

export default function TerrainReadout({ pointer, cameraTarget, ready }: Props) {
  const strings = useUiStore((s) => s.strings());

  return (
    <section
      aria-label={strings.readoutLabel}
      className="rounded-[var(--radius)] border-[length:1px] border-[color:var(--hairline)]
                 bg-[color:var(--surface)] p-[var(--space-s)] backdrop-blur-[var(--blur-panel)]"
      data-testid="terrain-readout"
    >
      <h2
        className="font-data text-[length:var(--step--2)] uppercase tracking-[0.14em]
                   text-[color:var(--text-muted)]"
      >
        {strings.readoutElevationPrefix}
      </h2>

      {!ready ? (
        <p
          className="mt-[var(--space-2xs)] font-data text-[length:var(--step--1)] text-[color:var(--text-muted)]"
          data-testid="readout-empty"
        >
          —
        </p>
      ) : (
        <>
          {/*
            aria-live="polite" so a screen-reader user hears the elevation change
            as they orbit, but only when they stop: the region is polite rather
            than assertive precisely because the value changes continuously
            during a drag and an assertive region would interrupt on every frame.
          */}
          <p
            aria-live="polite"
            aria-atomic="true"
            className="mt-[var(--space-2xs)] font-data text-[length:var(--step-1)] tabular-nums"
            data-testid="readout-pointer"
          >
            {formatElevation(pointer?.elevationM ?? null)}
            <span className="ml-[var(--space-2xs)] text-[length:var(--step--1)] text-[color:var(--text-muted)]">
              m
            </span>
            {pointer === null && (
              <span className="ml-[var(--space-xs)] text-[length:var(--step--1)] text-[color:var(--text-muted)]">
                {strings.readoutNoData}
              </span>
            )}
          </p>

          {pointer !== null && (
            <p
              className="mt-[var(--space-2xs)] font-data text-[length:var(--step--2)]
                         tabular-nums text-[color:var(--text-muted)]"
              data-testid="readout-coords"
            >
              {formatLat(pointer.lat)}, {formatLon(pointer.lon)}
            </p>
          )}

          {/*
            The keyboard equivalent. Labelled as such rather than presented as a
            second cursor reading, so nobody mistakes it for a second pointer.
          */}
          <div className="mt-[var(--space-s)] border-t-[length:1px] border-[color:var(--hairline)] pt-[var(--space-xs)]">
            <p className="text-[length:var(--step--2)] text-[color:var(--text-muted)]">
              {strings.readoutCameraTarget}
            </p>
            <p
              className="mt-[var(--space-2xs)] font-data text-[length:var(--step-1)] tabular-nums"
              data-testid="readout-target"
            >
              {formatElevation(cameraTarget?.elevationM ?? null)}
              <span className="ml-[var(--space-2xs)] text-[length:var(--step--1)] text-[color:var(--text-muted)]">
                m
              </span>
            </p>
          </div>
        </>
      )}
    </section>
  );
}
