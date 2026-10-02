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
} from '@engine/terrain';

import { AREA_SOURCES, prefersReducedMotion, readDocumentPalette } from './assets.js';

const IDLE: TerrainViewState = {
  status: { phase: 'idle' },
  verticalExaggeration: 1,
  contours: false,
  contourIntervalM: null,
  probe: null,
};

export type TerrainViewController = {
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
  retry: () => void;
  /** Elevation at the orbit target, the keyboard equivalent of the pointer. */
  cameraTargetProbe: TerrainViewState['probe'];
  /** Re-read the camera target; called after a keyboard orbit. */
  refreshCameraTarget: () => void;
  /** Fatal construction error, if the device cannot run the renderer at all. */
  fatal: TerrainViewError | null;
};

export function useTerrainView(): TerrainViewController {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const viewRef = useRef<TerrainView | null>(null);

  const [state, setState] = useState<TerrainViewState>(IDLE);
  const [areaId, setAreaId] = useState<AreaId>('majuli');
  const [exaggeration, setExaggerationState] = useState<number>(
    areaDefinitionOrFirst('majuli').defaultVerticalExaggeration,
  );
  const [contours, setContoursState] = useState(false);
  const [fatal, setFatal] = useState<TerrainViewError | null>(null);
  const [targetProbe, setTargetProbe] = useState<TerrainViewState['probe']>(null);

  // --- Create / destroy the view -----------------------------------------
  // Runs once. The view's lifetime is the canvas's lifetime, and re-creating it
  // would drop the WebGL context and re-download the terrain, so depending on
  // anything else here would be a bug rather than a fix.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || viewRef.current) return;

    let view: TerrainView;
    try {
      view = createTerrainView(canvas, {
        palette: readDocumentPalette(),
        sources: AREA_SOURCES,
        reducedMotion: prefersReducedMotion(),
        initialArea: 'majuli',
      });
    } catch (error) {
      // A device that cannot run the renderer at all. Recorded as state so the
      // HUD can render an explanation rather than leaving a blank canvas.
      if (error instanceof TerrainViewError) setFatal(error);
      else setFatal(new TerrainViewError('webgl2-unavailable', String(error)));
      return;
    }

    viewRef.current = view;
    setState(view.getState());
    const unsubscribe = view.subscribe(setState);

    return () => {
      unsubscribe();
      view.dispose();
      viewRef.current = null;
    };
  }, []);

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
    loadArea(areaId);
  }, [areaId, loadArea]);

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
    const lon = (sidecar.bbox.west + sidecar.bbox.east) / 2;
    const lat = (sidecar.bbox.south + sidecar.bbox.north) / 2;
    setTargetProbe(view.probe({ kind: 'lonlat', lon, lat }));
  }, [state.status]);

  const controls = useMemo<TerrainViewController>(
    () => ({
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
    }),
    [
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
    ],
  );

  return controls;
}

export { MAX_EXAGGERATION, MIN_EXAGGERATION, isAreaId };
export type { AreaId, TerrainStatus };
