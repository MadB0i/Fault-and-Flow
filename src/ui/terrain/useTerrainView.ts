/**
 * React binding for the terrain view.
 *
 * The engine owns the canvas, the camera and the loaded grid. This hook owns
 * only what React needs to re-render: the current status, the chosen area, and
 * the two view parameters. React never reaches into Three.js - it calls the
 * typed API and renders whatever state comes back, which is the whole point of
 * the boundary in AGENTS.md section 3.
 *
 * The view is created once and torn down on unmount. Recreating it on every
 * render would drop the WebGL context and re-download the terrain.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  MAX_EXAGGERATION,
  MIN_EXAGGERATION,
  TerrainViewError,
  areaDefinitionOrFirst,
  clampExaggeration,
  createTerrainView,
  isAreaId,
  type AreaId,
  type TerrainStatus,
  type TerrainView,
  type TerrainViewState,
  type WaterLayerState,
} from '@engine/terrain';

import { AREA_SOURCES, prefersReducedMotion, readDocumentPalette } from './assets.js';
import type { AtlasPresentation } from '../../shared/atlas.js';

const IDLE: TerrainViewState = {
  status: { phase: 'idle' },
  verticalExaggeration: 1,
  contours: false,
  contourIntervalM: null,
  ramp: null,
  probe: null,
  water: null,
};

export type TerrainViewController = {
  captureImage: () => string | null;
  setAtlas: (presentation: AtlasPresentation) => void;
  setWaterLevel: (depthM: number) => void;
  /** Attach the canvas. The view is created on the first non-null canvas. */
  attachCanvas: (canvas: HTMLCanvasElement | null) => void;
  state: TerrainViewState;
  areaId: AreaId;
  setArea: (id: AreaId) => void;
  exaggeration: number;
  setExaggeration: (value: number) => void;
  contours: boolean;
  setContours: (on: boolean) => void;
  resetCamera: () => void;
  zoomView: (factor: number) => void;
  focusLocation: (lon: number, lat: number) => void;
  retry: () => void;
  /** Elevation at the orbit target, the keyboard equivalent of the pointer. */
  cameraTargetProbe: TerrainViewState['probe'];
  /** Re-read the camera target; called after a keyboard orbit. */
  refreshCameraTarget: () => void;
  /** Fatal construction error, if the device cannot run the renderer at all. */
  fatal: TerrainViewError | null;
  /** FLOW water layer (engine-owned; this is only the React binding). */
  water: WaterLayerState | null;
  waterOn: boolean;
  setWaterOn: (on: boolean) => void;
  setWaterPlaying: (playing: boolean) => void;
  setWaterSpeed: (mult: number) => void;
  setWaterDischarge: (qM3s: number) => void;
  resetWater: () => void;
};

/**
 * Bench/debug hook: `?sim=256` forces the water sim grid width (clamped by
 * the engine). Absent in production use; present so grid sizes can be
 * compared on real hardware without a rebuild.
 */
function simWidthOverride(): number | undefined {
  if (typeof window === 'undefined' || typeof window.location === 'undefined')
    return undefined;
  const raw = new URLSearchParams(window.location.search).get('sim');
  if (raw === null) return undefined;
  const n = Math.floor(Number(raw));
  return Number.isFinite(n) ? n : undefined;
}

export function useTerrainView(
  initialArea: AreaId = 'assam-overview',
): TerrainViewController {
  const initialAreaRef = useRef(initialArea);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const viewRef = useRef<TerrainView | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const [state, setState] = useState<TerrainViewState>(IDLE);
  const [areaId, setAreaId] = useState<AreaId>(initialArea);
  const [exaggeration, setExaggerationState] = useState<number>(
    areaDefinitionOrFirst(initialArea).defaultVerticalExaggeration,
  );
  const [contours, setContoursState] = useState(false);
  const [fatal, setFatal] = useState<TerrainViewError | null>(null);
  const [targetProbe, setTargetProbe] = useState<TerrainViewState['probe']>(null);
  const [waterOn, setWaterOnState] = useState(false);

  // --- Create / destroy the view -----------------------------------------
  // Runs once. The view's lifetime is the canvas's lifetime, and re-creating it
  // would drop the WebGL context and re-download the terrain, so depending on
  // anything else here would be a bug rather than a fix.
  //
  // Shared with `retry`: when construction throws (no WebGL2, no float
  // textures), viewRef stays null and the next attempt must build the view
  // instead of calling into one that was never created.
  const createView = useCallback((): TerrainView | null => {
    const canvas = canvasRef.current;
    if (!canvas || viewRef.current) return viewRef.current;

    let view: TerrainView;
    try {
      view = createTerrainView(canvas, {
        palette: readDocumentPalette(),
        sources: AREA_SOURCES,
        reducedMotion: prefersReducedMotion(),
        initialArea: initialAreaRef.current,
      });
    } catch (error) {
      // A device that cannot run the renderer at all. Recorded as state so the
      // HUD can render an explanation rather than leaving a blank canvas.
      if (error instanceof TerrainViewError) setFatal(error);
      else setFatal(new TerrainViewError('webgl2-unavailable', String(error)));
      return null;
    }

    viewRef.current = view;
    setState(view.getState());
    unsubscribeRef.current = view.subscribe(setState);
    return view;
  }, []);

  useEffect(() => {
    const view = createView();

    return () => {
      unsubscribeRef.current?.();
      unsubscribeRef.current = null;
      view?.dispose();
      viewRef.current = null;
    };
  }, [createView]);

  // --- Reduced motion ------------------------------------------------------
  //
  // Read once, at construction, and deliberately not tracked after that. The
  // engine takes it as an option because it is not allowed to touch the DOM
  // outside the canvas it was handed, so honouring a mid-session change would
  // mean tearing down the WebGL context and re-downloading the terrain to
  // recreate one. CSS animation and transitions are already handled globally by
  // the media query in styles/base.css; this covers the 3D camera.
  const attachCanvas = useCallback((canvas: HTMLCanvasElement | null) => {
    canvasRef.current = canvas;
  }, []);

  const loadArea = useCallback((id: AreaId) => {
    const view = viewRef.current;
    setAreaId(id);
    setTargetProbe(null);
    const def = areaDefinitionOrFirst(id);
    setExaggerationState(def.defaultVerticalExaggeration);
    if (!view) return;
    view.loadArea(id).catch(() => {
      // Already reported through status; the HUD renders the error state.
    });
  }, []);

  const setExaggeration = useCallback((value: number) => {
    const next = clampExaggeration(value);
    setExaggerationState(next);
    viewRef.current?.setVerticalExaggeration(next);
  }, []);

  const setContours = useCallback((on: boolean) => {
    setContoursState(on);
    viewRef.current?.setContours(on);
  }, []);

  const resetCamera = useCallback(() => {
    viewRef.current?.resetCamera();
  }, []);

  const retry = useCallback(() => {
    setFatal(null);
    // A fatal construction left no view behind, so build one before loading.
    // Without this the retry button clears the error and then calls into
    // nothing, which is a button that cannot work.
    const view = createView();
    if (!view) return;
    loadArea(areaId);
  }, [areaId, loadArea, createView]);

  const setWaterOn = useCallback((on: boolean) => {
    setWaterOnState(on);
    const view = viewRef.current;
    if (!view) return;
    if (on) {
      const override = simWidthOverride();
      view.enableWater(override === undefined ? undefined : { simWidth: override });
    } else {
      view.disableWater();
    }
  }, []);

  const setWaterPlaying = useCallback((playing: boolean) => {
    viewRef.current?.setWaterPlaying(playing);
  }, []);

  const setWaterSpeed = useCallback((mult: number) => {
    viewRef.current?.setWaterSpeed(mult);
  }, []);

  const setWaterDischarge = useCallback((qM3s: number) => {
    viewRef.current?.setWaterDischarge(qM3s);
  }, []);

  const resetWater = useCallback(() => {
    viewRef.current?.resetWater();
  }, []);
  const setAtlas = useCallback((presentation: AtlasPresentation) => {
    viewRef.current?.setAtlas(presentation);
  }, []);
  const captureImage = useCallback(() => viewRef.current?.captureImage() ?? null, []);
  const zoomView = useCallback((factor: number) => viewRef.current?.zoomView(factor), []);
  const focusLocation = useCallback(
    (lon: number, lat: number) => viewRef.current?.focusLocation(lon, lat),
    [],
  );
  const setWaterLevel = useCallback((depthM: number) => {
    viewRef.current?.setWaterLevel(depthM);
  }, []);

  /**
   * The keyboard equivalent of the pointer readout.
   *
   * The orbit target is always the origin of the grid, so this probes the centre
   * of the loaded area. It is the one number a keyboard user can get that a
   * pointer user cannot, and it is what makes the readout reachable without a
   * mouse rather than merely visible.
   */
  const refreshCameraTarget = useCallback(() => {
    const view = viewRef.current;
    if (!view) return;
    const sidecar = state.status.phase === 'ready' ? state.status.sidecar : null;
    if (!sidecar) {
      setTargetProbe(null);
      return;
    }
    setTargetProbe(view.probe({ kind: 'ndc', x: 0, y: 0 }));
  }, [state.status]);

  useEffect(() => {
    refreshCameraTarget();
  }, [refreshCameraTarget]);

  const controls = useMemo<TerrainViewController>(
    () => ({
      captureImage,
      zoomView,
      focusLocation,
      setAtlas,
      setWaterLevel,
      attachCanvas,
      state,
      areaId,
      setArea: loadArea,
      exaggeration,
      setExaggeration,
      contours,
      setContours,
      resetCamera,
      retry,
      cameraTargetProbe: targetProbe,
      refreshCameraTarget,
      fatal,
      water: state.water,
      waterOn,
      setWaterOn,
      setWaterPlaying,
      setWaterSpeed,
      setWaterDischarge,
      resetWater,
    }),
    [
      captureImage,
      zoomView,
      focusLocation,
      setAtlas,
      setWaterLevel,
      attachCanvas,
      state,
      areaId,
      loadArea,
      exaggeration,
      setExaggeration,
      contours,
      setContours,
      resetCamera,
      retry,
      targetProbe,
      refreshCameraTarget,
      fatal,
      waterOn,
      setWaterOn,
      setWaterPlaying,
      setWaterSpeed,
      setWaterDischarge,
      resetWater,
    ],
  );

  return controls;
}

export { MAX_EXAGGERATION, MIN_EXAGGERATION, isAreaId };
export type { AreaId, TerrainStatus };
