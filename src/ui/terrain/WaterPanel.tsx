/**
 * FLOW phase 1 controls: enable the water layer, run/pause it, and read it.
 *
 * Native elements throughout, following TerrainPanel: the enable is a
 * checkbox, play is a button with an announced pressed state, speed is a
 * select, discharge is a range input with a value readout. Every number the
 * panel shows is labelled illustrative where it matters — the discharge is a
 * scenario the user set and the wet area is modelled, never measured.
 */

import {
  WATER_SPEEDS,
  MIN_DISCHARGE_M3S,
  MAX_DISCHARGE_M3S,
  DISCHARGE_STEP_M3S,
} from '@engine/water';
import type { WaterLayerState } from '@engine/terrain';
import { useUiStore } from '../state/useUiStore.js';

type Props = {
  waterOn: boolean;
  onWaterOn: (on: boolean) => void;
  water: WaterLayerState | null;
  onPlaying: (playing: boolean) => void;
  onSpeed: (mult: number) => void;
  onDischarge: (qM3s: number) => void;
  onReset: () => void;
  disabled?: boolean;
};

function formatLat(value: number): string {
  return `${value.toFixed(4)}° N`;
}

function formatLon(value: number): string {
  return `${value.toFixed(4)}° E`;
}

export default function WaterPanel({
  waterOn,
  onWaterOn,
  water,
  onPlaying,
  onSpeed,
  onDischarge,
  onReset,
  disabled = false,
}: Props) {
  const strings = useUiStore((s) => s.strings());
  const supported = water?.supported ?? false;
  const playing = water?.playing ?? false;

  return (
    <section
      aria-label={strings.waterTitle}
      className="rounded-[var(--radius)] border-[length:1px] border-[color:var(--hairline)]
                 bg-[color:var(--surface)] p-[var(--space-s)] backdrop-blur-[var(--blur-panel)]"
      data-testid="water-panel"
    >
      <label
        htmlFor="water-toggle"
        className="flex min-h-[44px] cursor-pointer items-center gap-[var(--space-xs)]"
      >
        <input
          id="water-toggle"
          type="checkbox"
          checked={waterOn}
          disabled={disabled}
          onChange={(event) => onWaterOn(event.target.checked)}
          className="size-[16px] shrink-0 accent-[color:var(--water)]"
          data-testid="water-toggle"
        />
        <span className="text-[length:var(--step--1)]">{strings.waterToggleLabel}</span>
      </label>

      {waterOn && water && !supported && (
        <p
          role="status"
          className="mt-[var(--space-2xs)] text-[length:var(--step--2)] text-[color:var(--text-muted)]"
          data-testid="water-unsupported"
        >
          {water.reason === 'float-render-unsupported'
            ? strings.waterUnsupportedFloat
            : strings.waterUnsupportedChannel}
        </p>
      )}

      {waterOn && supported && water && (
        <div className="mt-[var(--space-xs)] border-t-[length:1px] border-[color:var(--hairline)] pt-[var(--space-s)]">
          <p
            className="text-[length:var(--step--2)] text-[color:var(--seismic-amber)]"
            data-testid="water-honesty"
          >
            {strings.waterIllustrativeNote}
          </p>

          <div className="mt-[var(--space-s)] flex items-center gap-[var(--space-xs)]">
            <button
              type="button"
              onClick={() => onPlaying(!playing)}
              disabled={disabled}
              aria-pressed={playing}
              className="flex min-h-[44px] items-center rounded-[var(--radius-sm)]
                         border-[length:1px] border-[color:var(--hairline)] px-[var(--space-s)]
                         text-[length:var(--step--1)]
                         transition-colors duration-150 ease-[cubic-bezier(0.22,1,0.36,1)]
                         hover:bg-[color:var(--surface-raised)]
                         focus-visible:bg-[color:var(--surface-raised)]
                         disabled:cursor-not-allowed disabled:opacity-45"
              data-testid="water-play"
            >
              {playing ? strings.waterPause : strings.waterPlay}
            </button>

            <button
              type="button"
              onClick={onReset}
              disabled={disabled}
              className="flex min-h-[44px] items-center rounded-[var(--radius-sm)]
                         px-[var(--space-xs)] text-[length:var(--step--1)] text-[color:var(--text-muted)]
                         transition-colors duration-150 ease-[cubic-bezier(0.22,1,0.36,1)]
                         hover:bg-[color:var(--surface-raised)]
                         focus-visible:bg-[color:var(--surface-raised)]
                         disabled:cursor-not-allowed disabled:opacity-45"
              data-testid="water-reset"
            >
              {strings.waterReset}
            </button>
          </div>

          <div className="mt-[var(--space-s)]">
            <label htmlFor="water-speed" className="text-[length:var(--step--1)]">
              {strings.waterSpeedLabel}
            </label>
            <select
              id="water-speed"
              value={water.speed}
              disabled={disabled}
              onChange={(event) => onSpeed(Number(event.target.value))}
              aria-describedby="water-speed-hint"
              className="mt-[var(--space-2xs)] flex min-h-[44px] w-full items-center
                         rounded-[var(--radius-sm)] border-[length:1px] border-[color:var(--hairline)]
                         bg-[color:var(--surface-raised)] px-[var(--space-xs)]
                         text-[length:var(--step--1)]"
              data-testid="water-speed"
            >
              {WATER_SPEEDS.map((s) => (
                <option key={s} value={s}>
                  {s}×
                </option>
              ))}
            </select>
            <p
              id="water-speed-hint"
              className="mt-[var(--space-2xs)] text-[length:var(--step--2)] text-[color:var(--text-muted)]"
            >
              {strings.waterSpeedHint}
            </p>
          </div>

          <div className="mt-[var(--space-s)]">
            <label
              htmlFor="water-discharge"
              className="flex items-baseline justify-between gap-[var(--space-xs)]"
            >
              <span className="text-[length:var(--step--1)]">
                {strings.waterDischargeLabel}
              </span>
              <output
                htmlFor="water-discharge"
                className="font-data text-[length:var(--step--1)] text-[color:var(--water)]"
                data-testid="water-discharge-value"
              >
                {water.dischargeM3s} m3/s
              </output>
            </label>
            <input
              id="water-discharge"
              type="range"
              min={MIN_DISCHARGE_M3S}
              max={MAX_DISCHARGE_M3S}
              step={DISCHARGE_STEP_M3S}
              value={water.dischargeM3s}
              disabled={disabled}
              onChange={(event) => onDischarge(Number(event.target.value))}
              aria-describedby="water-discharge-hint"
              className="mt-[var(--space-2xs)] w-full accent-[color:var(--water)]"
              data-testid="water-discharge"
            />
            <p
              id="water-discharge-hint"
              className="mt-[var(--space-2xs)] text-[length:var(--step--2)] text-[color:var(--text-muted)]"
            >
              {strings.waterDischargeHint}
            </p>
          </div>

          <div className="mt-[var(--space-s)] border-t-[length:1px] border-[color:var(--hairline)] pt-[var(--space-xs)]">
            <p
              aria-live="polite"
              aria-atomic="true"
              className="font-data text-[length:var(--step--1)] tabular-nums"
              data-testid="water-stats"
            >
              {strings.waterWetArea}: {water.wetAreaKm2.toFixed(2)} km2
              <span className="ml-[var(--space-s)]">
                {strings.waterMaxDepth}: {water.maxDepthM.toFixed(1)} m
              </span>
            </p>
            <p
              className="mt-[var(--space-2xs)] font-data text-[length:var(--step--2)]
                         tabular-nums text-[color:var(--text-muted)]"
              data-testid="water-channel"
            >
              {strings.waterInflowLabel}: {formatLon(water.inflowLon)},{' '}
              {formatLat(water.inflowLat)}
              <br />
              {strings.waterOutletLabel}: {formatLon(water.outletLon)},{' '}
              {formatLat(water.outletLat)}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
