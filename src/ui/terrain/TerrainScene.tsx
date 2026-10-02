/**
 * The canvas, its states, and the HUD that surrounds it.
 *
 * The whole of phase 3's UI surface: a full-bleed terrain canvas with the
 * controls, legend, readout and attribution laid over it on wide viewports and
 * stacked under it on narrow ones.
 *
 * ## States
 *
 * DESIGN.md section 5 asks for a state matrix, and there are five that matter
 * here. Loading is a skeleton that matches this layout rather than a spinner,
 * because the panel geometry is already known and a spinner would make the HUD
 * jump when the data lands. The two capability errors - no WebGL2, and no
 * float-texture support - are stated separately with different remedies,
 * because they have different causes and a reader who is told the wrong one
 * cannot act. A load failure offers a retry. None of them shows a blank canvas,
 * because a blank canvas reads as a bug rather than as a message.
 *
 * ## Why the canvas is focusable
 *
 * The canvas carries tabIndex and a keyboard handler inside the engine, so it is
 * a real interactive surface and needs an accessible name and visible focus.
 * Without that, the terrain is a picture and the pointer readout is the only way
 * to learn anything about it.
 */

import { useCallback, useEffect, useRef } from 'react';

import { useUiStore } from '../state/useUiStore.js';
import TerrainPanel from './TerrainPanel.js';
import TerrainLegend from './TerrainLegend.js';
import TerrainReadout from './TerrainReadout.js';
import TerrainAttribution from './TerrainAttribution.js';
import WaterPanel from './WaterPanel.js';
import { useTerrainView } from './useTerrainView.js';

export default function TerrainScene() {
  const strings = useUiStore((s) => s.strings());
  const view = useTerrainView();

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const setCanvas = useCallback(
    (node: HTMLCanvasElement | null) => {
      canvasRef.current = node;
      view.attachCanvas(node);
    },
    [view],
  );

  const { status } = view.state;
  const loading = status.phase === 'loading' || status.phase === 'idle';
  const ready = status.phase === 'ready';
  const sidecar = ready ? status.sidecar : null;
  const errorCode = status.phase === 'error' ? status.code : null;
  const fatal = view.fatal;

  // Keep the keyboard-equivalent readout current after an orbit. Called on a
  // short delay rather than per frame, because the camera is damped and the
  // target elevation barely moves while it settles.
  useEffect(() => {
    if (!ready) return;
    const id = setTimeout(() => view.refreshCameraTarget(), 700);
    return () => clearTimeout(id);
  }, [ready, view.refreshCameraTarget, view.state.probe]);

  const errorText = ((): string | null => {
    if (!errorCode && !fatal) return null;
    const code = fatal?.code ?? errorCode;
    switch (code) {
      case 'webgl2-unavailable':
        return strings.terrainErrorWebgl;
      case 'float-texture-unsupported':
        return strings.terrainErrorFloat;
      default:
        return strings.terrainErrorLoad;
    }
  })();

  return (
    // The <main> landmark the phase-1 skip link points at. It has to exist and
    // hold the focusable content, or the skip link becomes a link to nowhere and
    // keyboard users have no way past the mode rail - WCAG 2.4.1, Level A.
    <main
      id="main"
      tabIndex={-1}
      className="relative flex min-h-[100dvh] flex-col"
      data-testid="terrain-scene"
    >
      {/*
        The canvas fills the viewport and the HUD floats over it from md up. On
        mobile the HUD is in normal flow above the canvas instead, so it can
        never cover the terrain a phone-sized screen barely has room for.
      */}
      <canvas
        ref={setCanvas}
        tabIndex={0}
        role="img"
        aria-label={strings.terrainCanvasLabel}
        className="fixed inset-0 z-0 h-full w-full bg-[color:var(--bg)] focus-visible:outline-2"
        data-testid="terrain-canvas"
      />

      {/* The keyboard hint, only while the canvas has focus. */}
      <p className="sr-only" aria-live="polite" data-testid="terrain-canvas-hint">
        {strings.terrainCanvasHint}
      </p>

      {/*
        Loading skeleton. Matches the real panel geometry - same width, same
        stacked rhythm - so the HUD does not reflow when the terrain lands, and
        the canvas background stays visible so there is never a white flash
        (DESIGN.md section 5).
      */}
      {loading && (
        <div
          className="pointer-events-none fixed inset-0 z-10 flex items-center justify-center"
          aria-hidden="true"
          data-testid="terrain-loading"
        >
          <div
            className="w-[min(100%,420px)] rounded-[var(--radius)] border-[length:1px]
                       border-[color:var(--hairline)] bg-[color:var(--surface)] p-[var(--space-s)]"
          >
            <div className="h-[var(--space-xs)] w-1/3 rounded-[2px] bg-[color:var(--surface-raised)]" />
            <div className="mt-[var(--space-s)] space-y-[var(--space-2xs)]">
              <div className="h-[var(--space-s)] w-full rounded-[2px] bg-[color:var(--surface-raised)]" />
              <div className="h-[var(--space-s)] w-full rounded-[2px] bg-[color:var(--surface-raised)]" />
              <div className="h-[var(--space-s)] w-4/5 rounded-[2px] bg-[color:var(--surface-raised)]" />
            </div>
          </div>
        </div>
      )}

      {/* Announced to assistive technology, hidden from the eye. */}
      <p className="sr-only" role="status" aria-live="polite">
        {loading ? strings.terrainLoading : ''}
      </p>

      {errorText && (
        <div
          className="fixed inset-x-0 top-1/2 z-20 mx-auto w-[min(100%,520px)]
                     px-[var(--space-s)]"
          role="alert"
          data-testid="terrain-error"
        >
          <div
            className="rounded-[var(--radius)] border-[length:1px] border-[color:var(--hairline)]
                       bg-[color:var(--surface)] p-[var(--space-s)] backdrop-blur-[var(--blur-panel)]"
          >
            <p
              className="text-[length:var(--step--1)] text-[color:var(--seismic-amber)]"
              data-testid="terrain-error-text"
            >
              {errorText}
            </p>
            <p className="mt-[var(--space-2xs)] text-[length:var(--step--2)] text-[color:var(--text-muted)]">
              {strings.disclaimerShort}
            </p>
            <button
              type="button"
              onClick={view.retry}
              className="mt-[var(--space-s)] min-h-[44px] rounded-[var(--radius-sm)]
                         border-[length:1px] border-[color:var(--hairline)] px-[var(--space-s)]
                         text-[length:var(--step--1)] transition-colors duration-150
                         ease-[cubic-bezier(0.22,1,0.36,1)]
                         hover:bg-[color:var(--surface-raised)]
                         focus-visible:bg-[color:var(--surface-raised)]"
              data-testid="terrain-retry"
            >
              {strings.terrainRetry}
            </button>
          </div>
        </div>
      )}

      {/* --- HUD ----------------------------------------------------------- */}
      <div
        className="z-20 flex flex-1 flex-col gap-[var(--space-s)] p-[var(--space-s)]
                   md:pointer-events-none md:absolute md:inset-0 md:block md:p-0"
      >
        <div
          className="flex flex-col gap-[var(--space-s)]
                     md:absolute md:bottom-[var(--space-s)] md:left-[var(--space-s)]
                     md:w-[320px] md:p-0"
        >
          <TerrainPanel
            areaId={view.areaId}
            onArea={view.setArea}
            exaggeration={view.exaggeration}
            onExaggeration={view.setExaggeration}
            contours={view.contours}
            onContours={view.setContours}
            onReset={view.resetCamera}
            disabled={!ready}
          />
          <WaterPanel
            waterOn={view.waterOn}
            onWaterOn={view.setWaterOn}
            water={view.water}
            onPlaying={view.setWaterPlaying}
            onSpeed={view.setWaterSpeed}
            onDischarge={view.setWaterDischarge}
            onReset={view.resetWater}
            disabled={!ready}
          />
          <TerrainLegend
            sidecar={sidecar}
            exaggeration={view.exaggeration}
            contourIntervalM={view.state.contourIntervalM}
            contoursOn={view.contours}
            waterOn={view.waterOn && (view.water?.supported ?? false)}
            waterMaxDepthM={view.water?.maxDepthM ?? null}
          />
        </div>

        <div
          className="flex flex-col gap-[var(--space-s)]
                     md:absolute md:bottom-[var(--space-s)] md:right-[var(--space-s)]
                     md:w-[320px] md:p-0"
        >
          <TerrainReadout
            pointer={view.state.probe}
            cameraTarget={view.cameraTargetProbe}
            ready={ready}
          />
          {sidecar && <TerrainAttribution sidecar={sidecar} />}
        </div>
      </div>
    </main>
  );
}
