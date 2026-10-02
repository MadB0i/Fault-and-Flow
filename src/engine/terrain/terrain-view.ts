/**
 * The terrain renderer: the one module in the engine that touches the DOM.
 *
 * Everything testable lives in the sibling pure modules - metrics, sampling,
 * camera-math, area-registry, sidecar. This file is the adapter that binds them
 * to a canvas, and it is allowed to reach for the document because there is no
 * way to present a 3D scene without one. The boundary is deliberate and the rest
 * of the engine stays runnable in a bare Node process.
 *
 * ## Render on demand
 *
 * There is no continuous requestAnimationFrame loop. A frame is requested only
 * when something has actually changed: a camera drag, a damping step still in
 * flight, a resize, a parameter change, or a newly loaded area. An idle viewer
 * costs zero frames and therefore zero battery, which matters when the primary
 * audience is on a phone.
 *
 * Damping is the one thing that looks like it wants a loop. It does not: each
 * step requests the next frame itself, and the loop stops the moment the camera
 * settles. `dampingFactor` reports "arrived" once the remaining step falls below
 * float32 resolution, which is what guarantees the chain terminates instead of
 * decaying forever.
 *
 * ## Float32 heights
 *
 * The height texture is R32F. An 8-bit or half-float height texture would
 * quantise the terrain into terraces, and on the 0.1 m-step reaches a 16-bit
 * encoding across their range already has a 6.5 m step - larger than the entire
 * relief of the floodplain the product is about. Capability is probed for real
 * rather than assumed, and a device without it gets a clear error state instead
 * of a blank canvas. See DECISIONS.md section 9.
 */

import * as THREE from 'three';

import {
  AREA_IDS,
  areaDefinitionOrFirst,
  clampExaggeration,
  type AreaId,
} from './area-registry.js';
import { parseSidecar, type TerrainSidecar } from './sidecar.js';
import {
  clampDistance,
  clampPolar,
  clampSpherical,
  dampingFactor,
  hasSettled,
  sphericalToCartesian,
  wrapAzimuth,
  CAMERA_FOV_DEG,
  DEFAULT_DAMPING_RATE,
  type Spherical,
} from './camera-math.js';
import {
  contourIntervalFor,
  extentMeters,
  gridToLonLat,
  lonLatToGrid,
  rampRangeFor,
  type RampRange,
} from './metrics.js';
import { sampleBilinear } from './sampling.js';
import { decodeTerrainRgba, NO_DATA_HEIGHT } from './decode-terrain.js';
import { TERRAIN_FRAGMENT_SHADER, TERRAIN_VERTEX_SHADER } from './shaders.js';
import {
  buildSimGrid,
  deriveChannel,
  createWaterLayer,
  DEFAULT_WATER_SPEED,
  DEFAULT_DISCHARGE_M3S,
  type WaterLayer,
} from '../water/index.js';

/** Hard cap on mesh subdivision, per the renderer budget. */
export const MAX_MESH_SEGMENTS = 512;

/** Device pixel ratio ceiling. DESIGN.md 6 allows 2; 1.5 is the mobile-safe cut. */
export const MAX_PIXEL_RATIO = 1.5;

export type TerrainPalette = {
  readonly bg: string;
  readonly terrain1: string;
  readonly terrain2: string;
  readonly terrain3: string;
  readonly terrain4: string;
  readonly noData: string;
  readonly contour: string;
  /** Shallow water tint, read from --water-shallow. */
  readonly waterShallow: string;
  /** Deep water fill, read from --water-deep. */
  readonly waterDeep: string;
  /** Shoreline highlight on the water surface; --water-shoreline. */
  readonly waterShoreline: string;
  /** Horizon haze the edge fade dissolves into; one step above --bg. */
  readonly skyLow: string;
  /** Zenith of the background gradient; slightly lighter than skyLow. */
  readonly skyHigh: string;
};

export type AreaSources = Readonly<
  Record<AreaId, { readonly sidecarUrl: string; readonly pngUrl: string }>
>;

export type TerrainErrorCode =
  'webgl2-unavailable' | 'float-texture-unsupported' | 'load-failed' | 'decode-failed';

export type TerrainStatus =
  | { readonly phase: 'idle' }
  | { readonly phase: 'loading'; readonly areaId: AreaId }
  | { readonly phase: 'ready'; readonly areaId: AreaId; readonly sidecar: TerrainSidecar }
  | {
      readonly phase: 'error';
      readonly areaId: AreaId | null;
      readonly code: TerrainErrorCode;
      readonly message: string;
    };

/** Where a probe was taken. Null elevation means "no data here", never 0. */
export type TerrainProbe = {
  readonly elevationM: number | null;
  readonly lon: number;
  readonly lat: number;
};

export type ProbeTarget =
  | { readonly kind: 'lonlat'; readonly lon: number; readonly lat: number }
  | { readonly kind: 'ndc'; readonly x: number; readonly y: number };

export type TerrainViewState = {
  readonly status: TerrainStatus;
  readonly verticalExaggeration: number;
  readonly contours: boolean;
  /** Null until an area has loaded. */
  readonly contourIntervalM: number | null;
  /**
   * Elevation range the colour ramp displays (2nd..98th percentile of the
   * loaded area), and whether real terrain is clipped at either end. The
   * legend must show this rather than the sidecar's bbox extremes.
   */
  readonly ramp: RampRange | null;
  readonly probe: TerrainProbe | null;
  /** Null until the water layer is enabled; terrain works either way. */
  readonly water: WaterLayerState | null;
};

/**
 * Host-visible water state for the HUD. `supported: false` is not an error
 * in the terrain — it means this device cannot render to float textures, so
 * the UI explains that and the terrain view carries on alone.
 */
export type WaterLayerState = {
  readonly supported: boolean;
  /** Machine-readable reason when unsupported: no-terrain | float-render-unsupported | channel-failed. */
  readonly reason: string | null;
  readonly playing: boolean;
  readonly speed: number;
  readonly dischargeM3s: number;
  readonly wetAreaKm2: number;
  readonly maxDepthM: number;
  readonly inflowLon: number;
  readonly inflowLat: number;
  readonly outletLon: number;
  readonly outletLat: number;
  readonly simWidth: number;
  readonly simHeight: number;
};

/**
 * Sim grid width. Benched on this machine's software renderer: running fps
 * is 3.6 at width 256 and 3.2 at 1024, so size is not the bottleneck here —
 * fixed rasterization cost is. 512 is the largest grid with negligible
 * marginal cost and modest memory (~10 MB on the overview) that still
 * resolves the channel (inflow 90 m, outlet 7 m on the real DEM). Re-bench
 * on real hardware before raising it; `?sim=` overrides it for measurement.
 */
export const DEFAULT_SIM_WIDTH = 512;
const MIN_SIM_WIDTH = 64;
const MAX_SIM_WIDTH = 1024;

export type TerrainViewOptions = {
  readonly palette: TerrainPalette;
  readonly sources: AreaSources;
  /** Honour the OS reduced-motion setting. The UI reads it and passes it in. */
  readonly reducedMotion?: boolean;
  /** Starting area. Defaults to the first in the registry. */
  readonly initialArea?: AreaId;
  /** Notified whenever host-visible state changes, including on error. */
  readonly onStatus?: (status: TerrainStatus) => void;
};

export type TerrainView = {
  loadArea(id: AreaId): Promise<void>;
  setVerticalExaggeration(x: number): void;
  setContours(on: boolean): void;
  probe(target: ProbeTarget): TerrainProbe | null;
  /** Current state, for a component that mounts after the view already exists. */
  getState(): TerrainViewState;
  subscribe(listener: (state: TerrainViewState) => void): () => void;
  /** Reset the camera to the area's opening view. */
  resetCamera(): void;
  /**
   * Build the water layer for the loaded area. False when the device cannot
   * render to float (see state.water.reason); the terrain is unaffected.
   * The layer rebuilds per area, so every view runs the same model on its
   * own DEM: zoomed views of the same flow.
   */
  enableWater(opts?: { simWidth?: number }): boolean;
  disableWater(): void;
  setWaterPlaying(playing: boolean): void;
  setWaterSpeed(mult: number): void;
  setWaterDischarge(qM3s: number): void;
  resetWater(): void;
  dispose(): void;
};

/** Light direction: from the surface toward the light. North-west, low. */
const LIGHT_DIRECTION = new THREE.Vector3(-1, 0.55, -1).normalize();

/**
 * Camera state the view mutates every frame.
 *
 * `Spherical` from camera-math is deliberately readonly - it is the shape of a
 * value handed across a boundary. Damping writes to these fields sixty times a
 * second, so the working copy has to be mutable.
 */
type MutableSpherical = { -readonly [K in keyof Spherical]: Spherical[K] };

type Loaded = {
  readonly sidecar: TerrainSidecar;
  readonly heights: Float32Array;
  readonly noData: Uint8Array;
};

export function createTerrainView(
  canvas: HTMLCanvasElement,
  options: TerrainViewOptions,
): TerrainView {
  const doc = canvas.ownerDocument;
  const reducedMotion = options.reducedMotion ?? false;

  // --- Mutable view state --------------------------------------------------
  // Declared before the capability checks below, because a device that cannot
  // run the renderer still needs somewhere to report the failure. Reading these
  // before their initialisers would throw a ReferenceError from inside the
  // error path, replacing a clear message with a stack trace.
  let status: TerrainStatus = { phase: 'idle' };
  let loaded: Loaded | null = null;
  let heightTexture: THREE.DataTexture | null = null;
  let contoursOn = false;
  let exaggeration = 1;
  let contourIntervalM: number | null = null;
  /** Elevation range the ramp actually displays; null until an area loads. */
  let rampRange: RampRange | null = null;
  let lastProbe: TerrainProbe | null = null;
  let disposed = false;
  let minDistanceM = 1;
  let maxDistanceM = 1e6;

  // --- Water layer (FLOW phase 1) ------------------------------------------
  // Wanted persists across area loads: every area rebuilds the same model on
  // its own DEM. The layer is null until enabled, or when this device failed
  // the float-render probe (terrain keeps working; see WaterLayerState).
  let waterWanted = false;
  let waterLayer: WaterLayer | null = null;
  let waterState: WaterLayerState | null = null;
  let waterSpeed = DEFAULT_WATER_SPEED;
  let waterDischarge = DEFAULT_DISCHARGE_M3S;
  let currentSimWidth = DEFAULT_SIM_WIDTH;

  const listeners = new Set<(s: TerrainViewState) => void>();

  function snapshot(): TerrainViewState {
    return {
      status,
      verticalExaggeration: exaggeration,
      contours: contoursOn,
      contourIntervalM,
      ramp: rampRange,
      probe: lastProbe,
      water: waterState,
    };
  }

  function emit(): void {
    const s = snapshot();
    for (const l of listeners) l(s);
  }

  function setStatus(next: TerrainStatus): void {
    status = next;
    options.onStatus?.(next);
    emit();
  }

  function fail(
    code: TerrainErrorCode,
    message: string,
    areaId: AreaId | null = null,
  ): never {
    setStatus({ phase: 'error', areaId, code, message });
    // Thrown so the caller can tell "this device cannot run it" apart from
    // "this load failed", and so it gets a plain object it can render an error
    // state from rather than a silently blank canvas.
    throw new TerrainViewError(code, message);
  }

  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'low-power',
    });
  } catch {
    fail('webgl2-unavailable', 'This browser could not create a WebGL2 context.');
  }

  const gl = renderer.getContext();
  const isWebGL2 =
    typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext;
  if (!isWebGL2) {
    fail('webgl2-unavailable', 'This browser could not create a WebGL2 context.');
  }
  if (!supportsFloatSampling(gl)) {
    fail(
      'float-texture-unsupported',
      'This device cannot sample 32-bit float textures, which this terrain needs to ' +
        'avoid quantising elevation into visible steps.',
    );
  }

  // --- Scene ---------------------------------------------------------------
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(CAMERA_FOV_DEG, 1, 1, 1e7);
  camera.up.set(0, 1, 0);

  // A graded sky rather than a flat clear colour: the horizon sits one step
  // above --bg and the zenith a little lighter, both passed in from the tokens
  // so the engine still holds no colour of its own.
  const skyLow = new THREE.Color(options.palette.skyLow);
  const skyHigh = new THREE.Color(options.palette.skyHigh);

  const material = new THREE.ShaderMaterial({
    vertexShader: TERRAIN_VERTEX_SHADER,
    fragmentShader: TERRAIN_FRAGMENT_SHADER,
    uniforms: {
      uHeightTex: { value: null },
      uTexSize: { value: new THREE.Vector2(1, 1) },
      uPixelSizeM: { value: new THREE.Vector2(1, 1) },
      uExaggeration: { value: 1 },
      uNoDataLevel: { value: 0 },
      uWorldSizeM: { value: new THREE.Vector2(1, 1) },
      uElevationRange: { value: new THREE.Vector2(0, 1) },
      uRampLow: { value: new THREE.Color(options.palette.terrain1) },
      uRampLowMid: { value: new THREE.Color(options.palette.terrain2) },
      uRampHighMid: { value: new THREE.Color(options.palette.terrain3) },
      uRampHigh: { value: new THREE.Color(options.palette.terrain4) },
      uBackground: { value: new THREE.Color(options.palette.bg) },
      uNoDataColour: { value: new THREE.Color(options.palette.noData) },
      uContourColour: { value: new THREE.Color(options.palette.contour) },
      uLightDirection: { value: LIGHT_DIRECTION.clone() },
      uContourInterval: { value: 0 },
      uContourStrength: { value: 0.55 },
      uEdgeFade: { value: 0.06 },
      uFogRange: { value: new THREE.Vector2(1, 1) },
      uFogStrength: { value: 0.35 },
      // Ambient floor. 0.45 left steep faces facing away from the light at a fifth
      // of the ramp colour, which on the floodplain read as near-black; 0.62 keeps
      // the hillshade legible while slopes away from the light still separate.
      uAmbient: { value: 0.62 },
      uSkyLow: { value: skyLow.clone() },
      uSkyHigh: { value: skyHigh.clone() },
      uScreenHeight: { value: 1 },
    },
  });

  // Unit plane in XZ. The real extent is applied in the vertex shader from the
  // sidecar, so one geometry serves all three areas.
  const geometry = new THREE.PlaneGeometry(1, 1, MAX_MESH_SEGMENTS, MAX_MESH_SEGMENTS);
  geometry.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false; // displacement happens in the shader
  scene.add(mesh);

  scene.background = skyLow.clone();

  // --- Camera state -------------------------------------------------------
  const current: MutableSpherical = { polarDeg: 40, azimuthDeg: 0, distanceM: 1e5 };
  const target: MutableSpherical = { ...current };

  // --- Render on demand ----------------------------------------------------
  let frameHandle: number | null = null;
  let lastFrameMs = 0;

  const raf: (cb: (t: number) => void) => number =
    doc.defaultView?.requestAnimationFrame.bind(doc.defaultView) ??
    ((cb) => setTimeout(() => cb(performanceNow()), 16) as unknown as number);
  const cancelRaf: (h: number) => void =
    doc.defaultView?.cancelAnimationFrame.bind(doc.defaultView) ??
    ((h) => clearTimeout(h));

  function performanceNow(): number {
    return typeof performance !== 'undefined' ? performance.now() : Date.now();
  }

  function scheduleFrame(): void {
    if (disposed || frameHandle !== null) return;
    if (doc.visibilityState === 'hidden') return;
    frameHandle = raf(onFrame);
  }

  function onFrame(nowMs: number): void {
    frameHandle = null;
    if (disposed) return;

    // A very long gap between frames - a backgrounded tab, a breakpoint - would
    // otherwise make damping jump straight to the target, which looks like a
    // teleport. Clamp the step so the motion stays continuous.
    const deltaSeconds =
      lastFrameMs === 0 ? 1 / 60 : Math.min(0.1, (nowMs - lastFrameMs) / 1000);
    lastFrameMs = nowMs;

    const settled = advanceCamera(deltaSeconds);

    // The water layer drives continuous frames while it plays and costs
    // nothing when paused: the loop below is what keeps 0fps idle honest.
    let waterRunning = false;
    if (waterLayer && waterLayer.isPlaying()) {
      const before = waterLayer.statsVersion();
      waterLayer.stepFrame(deltaSeconds);
      waterRunning = true;
      if (waterLayer.statsVersion() !== before) refreshWaterSnapshot();
    }

    render();
    if (!settled || waterRunning) scheduleFrame();
  }

  function invalidateCamera(): void {
    lastFrameMs = 0;
    scheduleFrame();
  }

  function render(): void {
    const pos = sphericalToCartesian(current);
    camera.position.set(pos.x, pos.y, pos.z);
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
  }

  /**
   * Step the camera toward its target. Returns false while it still needs
   * frames, true once it has arrived.
   *
   * Under reduced motion the camera lands on its target immediately and stops,
   * which is the "cut instead of a move" rule from DESIGN.md section 3 rather
   * than a faster animation.
   */
  function advanceCamera(deltaSeconds: number): boolean {
    if (reducedMotion) {
      current.polarDeg = target.polarDeg;
      current.azimuthDeg = target.azimuthDeg;
      current.distanceM = target.distanceM;
      return true;
    }

    const f = dampingFactor(DEFAULT_DAMPING_RATE, deltaSeconds);
    current.polarDeg += (target.polarDeg - current.polarDeg) * f;
    // Azimuth is angular, so a fixed fraction of a degree is the right step
    // regardless of zoom.
    let dAz = (target.azimuthDeg - current.azimuthDeg) * f;
    if (dAz > 180) dAz -= 360;
    if (dAz < -180) dAz += 360;
    current.azimuthDeg = wrapAzimuth(current.azimuthDeg + dAz);
    current.distanceM += (target.distanceM - current.distanceM) * f;

    const settled =
      hasSettled(current.polarDeg, target.polarDeg) &&
      hasSettled(current.azimuthDeg, target.azimuthDeg) &&
      hasSettled(current.distanceM, target.distanceM);

    if (settled) {
      current.polarDeg = target.polarDeg;
      current.azimuthDeg = target.azimuthDeg;
      current.distanceM = target.distanceM;
    }
    return settled;
  }

  // --- Camera interaction --------------------------------------------------
  function setCamera(polarDeg: number, azimuthDeg: number, distanceM: number): void {
    const clamped = clampSpherical(
      { polarDeg, azimuthDeg, distanceM },
      minDistanceM,
      maxDistanceM,
    );
    target.polarDeg = clamped.polarDeg;
    target.azimuthDeg = clamped.azimuthDeg;
    target.distanceM = clamped.distanceM;
    invalidateCamera();
  }

  /** Move the orbit target. Not exposed: the target is always the origin. */
  function nudge(dPolar: number, dAzimuth: number): void {
    setCamera(target.polarDeg + dPolar, target.azimuthDeg + dAzimuth, target.distanceM);
  }

  function zoom(factor: number): void {
    setCamera(target.polarDeg, target.azimuthDeg, target.distanceM * factor);
  }

  const KEY_ORBIT: Record<string, [number, number]> = {
    ArrowUp: [-3, 0],
    ArrowDown: [3, 0],
    ArrowLeft: [0, -3],
    ArrowRight: [0, 3],
  };

  function onKeyDown(event: KeyboardEvent): void {
    const orbit = KEY_ORBIT[event.key];
    if (orbit) {
      event.preventDefault();
      nudge(orbit[0], orbit[1]);
      return;
    }
    if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      zoom(0.9);
      return;
    }
    if (event.key === '-' || event.key === '_') {
      event.preventDefault();
      zoom(1 / 0.9);
      return;
    }
    if (event.key === 'Home') {
      event.preventDefault();
      resetCamera();
    }
  }

  // Pointer, covering mouse, pen and touch through one path.
  const pointers = new Map<number, { x: number; y: number }>();
  let lastPinchDistance = 0;

  function localPoint(event: PointerEvent): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function onPointerDown(event: PointerEvent): void {
    canvas.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, localPoint(event));
    if (pointers.size === 2) lastPinchDistance = pinchDistance();
  }

  function onPointerMove(event: PointerEvent): void {
    const prev = pointers.get(event.pointerId);
    if (!prev) {
      // Not a drag: this is a hover, which is what drives the readout.
      publishProbeFromPointer(localPoint(event));
      return;
    }
    const now = localPoint(event);
    pointers.set(event.pointerId, now);

    if (pointers.size === 1) {
      // A fixed pixels-per-degree orbit, so a drag feels the same on any
      // viewport size rather than scaling with it.
      const dx = now.x - prev.x;
      const dy = now.y - prev.y;
      const perDeg = 0.4;
      nudge(dy * perDeg, -dx * perDeg);
    } else if (pointers.size === 2) {
      const d = pinchDistance();
      if (lastPinchDistance > 0 && d > 0) {
        zoom(lastPinchDistance / d);
      }
      lastPinchDistance = d;
    }
  }

  function onPointerUp(event: PointerEvent): void {
    pointers.delete(event.pointerId);
    if (pointers.size < 2) lastPinchDistance = 0;
    if (canvas.hasPointerCapture(event.pointerId))
      canvas.releasePointerCapture(event.pointerId);
  }

  function pinchDistance(): number {
    const pts = [...pointers.values()];
    const a = pts[0];
    const b = pts[1];
    if (!a || !b) return 0;
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function onWheel(event: WheelEvent): void {
    event.preventDefault();
    zoom(Math.exp(event.deltaY * 0.0012));
  }

  function onVisibilityChange(): void {
    // Stop entirely while hidden; drop the stale timestamp so the first frame
    // back does not take one enormous damping step.
    if (doc.visibilityState === 'hidden') {
      if (frameHandle !== null) {
        cancelRaf(frameHandle);
        frameHandle = null;
      }
    } else {
      lastFrameMs = 0;
      scheduleFrame();
    }
  }

  function onResize(): void {
    applySize();
    scheduleFrame();
  }

  canvas.addEventListener('keydown', onKeyDown);
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  doc.addEventListener('visibilitychange', onVisibilityChange);
  doc.defaultView?.addEventListener('resize', onResize);

  // --- Sizing --------------------------------------------------------------
  let observers: ResizeObserver | null = null;

  function applySize(): void {
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));
    const dpr = Math.min(
      MAX_PIXEL_RATIO,
      typeof devicePixelRatio === 'number' && devicePixelRatio > 0 ? devicePixelRatio : 1,
    );
    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    // The background gradient is sized off the drawing buffer, so it has to
    // follow both the CSS size and the DPR.
    material.uniforms['uScreenHeight']!.value = Math.max(1, height * dpr);
  }

  if (typeof ResizeObserver !== 'undefined') {
    observers = new ResizeObserver(onResize);
    observers.observe(canvas);
  }
  applySize();

  // --- Probing -------------------------------------------------------------
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const planeXZ = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const hit = new THREE.Vector3();

  /**
   * Screen point to a grid point, then to a real elevation.
   *
   * Displacement is vertical only, so the ray meets the x/z of the surface
   * exactly. One refinement pass is enough: intersect the flat plane, read the
   * elevation there, re-intersect at that height. Without the refinement a
   * pointer over a hilltop reads the ground behind it, which on the reaches is
   * tens of metres of visible error.
   */
  function gridFromNdc(x: number, y: number): { u: number; v: number } | null {
    if (!loaded) return null;
    ndc.set(x, y);
    raycaster.setFromCamera(ndc, camera);
    if (!raycaster.ray.intersectPlane(planeXZ, hit)) return null;

    const extent = extentMeters(loaded.sidecar);
    const u = hit.x / extent.widthM + 0.5;
    const v = hit.z / extent.heightM + 0.5;
    if (u < 0 || u > 1 || v < 0 || v > 1) return null;

    // Refine: raise the plane to the sampled height and intersect again.
    const first = sampleBilinear(loaded.heights, loaded.noData, loaded.sidecar, u, v);
    if (!first.noData) {
      planeXZ.constant = -first.elevationM * exaggeration;
      if (raycaster.ray.intersectPlane(planeXZ, hit)) {
        const u2 = hit.x / extent.widthM + 0.5;
        const v2 = hit.z / extent.heightM + 0.5;
        if (u2 >= 0 && u2 <= 1 && v2 >= 0 && v2 <= 1) return { u: u2, v: v2 };
      }
      planeXZ.constant = 0;
    }

    return { u, v };
  }

  function publishProbeFromPointer(point: { x: number; y: number }): void {
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const x = (point.x / rect.width) * 2 - 1;
    const y = -(point.y / rect.height) * 2 + 1;
    const grid = gridFromNdc(x, y);
    if (!grid || !loaded) {
      if (lastProbe !== null) {
        lastProbe = null;
        emit();
      }
      return;
    }
    const { lon, lat } = gridToLonLat(loaded.sidecar.bbox, grid.u, grid.v);
    const s = sampleBilinear(
      loaded.heights,
      loaded.noData,
      loaded.sidecar,
      grid.u,
      grid.v,
    );
    lastProbe = {
      elevationM: s.noData ? null : s.elevationM,
      lon,
      lat,
    };
    emit();
  }

  function setLastProbeFromLonLat(lon: number, lat: number): void {
    if (!loaded) return;
    const grid = lonLatToGrid(loaded.sidecar.bbox, lon, lat);
    const s = sampleBilinear(
      loaded.heights,
      loaded.noData,
      loaded.sidecar,
      grid.u,
      grid.v,
    );
    lastProbe = { elevationM: s.noData ? null : s.elevationM, lon, lat };
    emit();
  }

  // --- Loading -------------------------------------------------------------
  let loadToken = 0;

  async function loadArea(id: AreaId): Promise<void> {
    const token = ++loadToken;
    const sources = options.sources[id];
    if (!sources) {
      fail('load-failed', `No source registered for area "${id}".`, id);
    }

    setStatus({ phase: 'loading', areaId: id });

    try {
      const sidecar = parseSidecar(await fetchJson(sources.sidecarUrl));
      if (token !== loadToken) return;

      const image = await fetchTerrainRgba(sources.pngUrl);
      if (token !== loadToken) return;

      if (image.width !== sidecar.width || image.height !== sidecar.height) {
        // A sidecar that disagrees with its own PNG is a pipeline fault, not a
        // rendering problem, and must not be papered over by resampling. The
        // whole point of decoding in the browser rather than trusting the
        // browser's own resampling is that a mismatch is visible.
        throw new Error(
          `sidecar grid ${sidecar.width}x${sidecar.height} does not match the image ` +
            `${image.width}x${image.height}`,
        );
      }

      const decoded = decodeTerrainRgba(image.data, {
        west: sidecar.bbox.west,
        south: sidecar.bbox.south,
        east: sidecar.bbox.east,
        north: sidecar.bbox.north,
        width: sidecar.width,
        height: sidecar.height,
        pixelSizeMx: sidecar.pixelSizeMx,
        pixelSizeMy: sidecar.pixelSizeMy,
        offset: sidecar.encoding.offset,
        step: sidecar.encoding.step,
        noDataCode: sidecar.encoding.noDataCode,
      });

      if (token !== loadToken) return;

      applyArea(id, { sidecar, heights: decoded.heights, noData: decoded.noData });
      setStatus({ phase: 'ready', areaId: id, sidecar });
    } catch (error) {
      if (token !== loadToken) return;
      if (error instanceof TerrainViewError) throw error;
      const message = error instanceof Error ? error.message : String(error);
      setStatus({ phase: 'error', areaId: id, code: 'decode-failed', message });
      throw error;
    }
  }

  function applyArea(id: AreaId, next: Loaded): void {
    loaded = next;
    const sidecar = next.sidecar;
    const extent = extentMeters(sidecar);

    heightTexture?.dispose();
    // R32F, NEAREST, no mipmaps. The shader does the bilinear interpolation by
    // hand so this never depends on OES_texture_float_linear being present.
    const tex = new THREE.DataTexture(
      // The decoded heights are already Float32Array with NaN in the no-data
      // cells. Re-uploading the array as-is keeps those NaNs intact, which is
      // the contract the shader's `h != h` test relies on.
      next.heights as unknown as Float32Array<ArrayBuffer>,
      sidecar.width,
      sidecar.height,
      THREE.RedFormat,
      THREE.FloatType,
    );
    tex.minFilter = THREE.NearestFilter;
    tex.magFilter = THREE.NearestFilter;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.generateMipmaps = false;
    tex.needsUpdate = true;
    heightTexture = tex;

    const u = material.uniforms;
    u['uHeightTex']!.value = tex;
    (u['uTexSize']!.value as THREE.Vector2).set(sidecar.width, sidecar.height);
    (u['uPixelSizeM']!.value as THREE.Vector2).set(
      sidecar.pixelSizeMx,
      sidecar.pixelSizeMy,
    );
    (u['uWorldSizeM']!.value as THREE.Vector2).set(extent.widthM, extent.heightM);
    u['uNoDataLevel']!.value = sidecar.minElevation;

    // The ramp shows this area's own 2nd..98th percentile, not its bbox extremes.
    const range = rampRangeFor(next.heights, sidecar.minElevation, sidecar.maxElevation);
    rampRange = range;
    (u['uElevationRange']!.value as THREE.Vector2).set(range.min, range.max);

    // Fog and the fade are proportional to the area's own size, so the overview
    // does not fade across 700 km while Majuli does not fade at all.
    (u['uFogRange']!.value as THREE.Vector2).set(
      extent.diagonalM * 0.55,
      extent.diagonalM * 1.6,
    );

    contourIntervalM = contourIntervalFor(sidecar);

    const def = areaDefinitionOrFirst(id);
    minDistanceM = extent.diagonalM * def.minZoomFactor;
    maxDistanceM = extent.diagonalM * def.maxZoomFactor;

    exaggeration = clampExaggeration(def.defaultVerticalExaggeration);
    u['uExaggeration']!.value = exaggeration;
    u['uContourInterval']!.value = contoursOn ? contourIntervalM : 0;

    // Keep the camera above the terrain's own vertical span so the "never under
    // the surface" clamp is not the only thing stopping it.
    camera.near = Math.max(1, extent.diagonalM * 0.002);
    camera.far = extent.diagonalM * 8;
    camera.updateProjectionMatrix();

    resetCamera();
    lastProbe = null;

    // A new DEM means a new river: rebuild the same model on this area's own
    // grid when water is wanted, so the reaches read as zoomed views of the
    // same flow rather than a stale sheet from elsewhere.
    if (waterWanted) refreshWaterLayer();
  }

  function resetCamera(): void {
    if (!loaded) {
      invalidateCamera();
      return;
    }
    const def = areaDefinitionOrFirst(loaded.sidecar.area);
    const extent = extentMeters(loaded.sidecar);
    target.polarDeg = clampPolar(def.defaultPolarDeg);
    target.azimuthDeg = wrapAzimuth(def.defaultAzimuthDeg);
    target.distanceM = clampDistance(extent.diagonalM * 0.95, minDistanceM, maxDistanceM);

    if (reducedMotion) {
      current.polarDeg = target.polarDeg;
      current.azimuthDeg = target.azimuthDeg;
      current.distanceM = target.distanceM;
    }
    invalidateCamera();
  }

  // --- Public surface ------------------------------------------------------
  function setVerticalExaggeration(value: number): void {
    const next = clampExaggeration(value);
    if (next === exaggeration) return;
    exaggeration = next;
    material.uniforms['uExaggeration']!.value = next;
    waterLayer?.setExaggeration(next);
    emit();
    // No geometry to rebuild, but the hillshade depends on the exaggeration, so
    // the pixels are stale until the next frame.
    scheduleFrame();
  }

  // --- Water layer -----------------------------------------------------------
  function clampSimWidth(value: number | undefined): number {
    if (value === undefined || !Number.isFinite(value)) return currentSimWidth;
    return Math.min(MAX_SIM_WIDTH, Math.max(MIN_SIM_WIDTH, Math.floor(value)));
  }

  function unsupportedWater(reason: string): false {
    waterLayer = null;
    waterState = {
      supported: false,
      reason,
      playing: false,
      speed: waterSpeed,
      dischargeM3s: waterDischarge,
      wetAreaKm2: 0,
      maxDepthM: 0,
      inflowLon: 0,
      inflowLat: 0,
      outletLon: 0,
      outletLat: 0,
      simWidth: 0,
      simHeight: 0,
    };
    emit();
    return false;
  }

  function refreshWaterSnapshot(): void {
    if (!waterLayer || !waterState?.supported) return;
    const stats = waterLayer.getStats();
    waterState = {
      ...waterState,
      wetAreaKm2: stats.wetAreaKm2,
      maxDepthM: stats.maxDepthM,
    };
    emit();
  }

  function refreshWaterLayer(simWidthOpt?: number): boolean {
    waterLayer?.dispose();
    waterLayer = null;
    if (!loaded) return unsupportedWater('no-terrain');
    currentSimWidth = clampSimWidth(simWidthOpt);
    let channel: { inflow: number; outlet: number; path: readonly number[] };
    let sim: {
      width: number;
      height: number;
      dxM: number;
      dyM: number;
      heights: Float32Array;
      noData: Uint8Array;
    };
    try {
      const extent = extentMeters(loaded.sidecar);
      sim = buildSimGrid(
        loaded.heights,
        loaded.noData,
        loaded.sidecar.width,
        loaded.sidecar.height,
        extent.widthM,
        extent.heightM,
        currentSimWidth,
      );
      channel = deriveChannel(sim.heights, sim.noData, sim.width, sim.height);
    } catch {
      return unsupportedWater('channel-failed');
    }
    const extent = extentMeters(loaded.sidecar);
    const layer = createWaterLayer({
      renderer,
      scene,
      sim,
      channel,
      extentWM: extent.widthM,
      extentHM: extent.heightM,
      exaggeration,
      shallowColor: options.palette.waterShallow,
      deepColor: options.palette.waterDeep,
    });
    if (!layer) return unsupportedWater('float-render-unsupported');
    layer.setSpeed(waterSpeed);
    layer.setDischargeM3s(waterDischarge);
    const inflow = gridToLonLat(
      loaded.sidecar.bbox,
      ((channel.inflow % sim.width) + 0.5) / sim.width,
      (Math.floor(channel.inflow / sim.width) + 0.5) / sim.height,
    );
    const outlet = gridToLonLat(
      loaded.sidecar.bbox,
      ((channel.outlet % sim.width) + 0.5) / sim.width,
      (Math.floor(channel.outlet / sim.width) + 0.5) / sim.height,
    );
    waterLayer = layer;
    waterState = {
      supported: true,
      reason: null,
      playing: layer.isPlaying(),
      speed: waterSpeed,
      dischargeM3s: waterDischarge,
      wetAreaKm2: 0,
      maxDepthM: 0,
      inflowLon: inflow.lon,
      inflowLat: inflow.lat,
      outletLon: outlet.lon,
      outletLat: outlet.lat,
      simWidth: sim.width,
      simHeight: sim.height,
    };
    emit();
    scheduleFrame();
    return true;
  }

  function enableWater(opts?: { simWidth?: number }): boolean {
    waterWanted = true;
    return refreshWaterLayer(opts?.simWidth);
  }

  function disableWater(): void {
    waterWanted = false;
    waterLayer?.dispose();
    waterLayer = null;
    waterState = null;
    emit();
  }

  function setWaterPlaying(playing: boolean): void {
    waterLayer?.setPlaying(playing);
    if (waterState?.supported) {
      waterState = { ...waterState, playing };
      emit();
    }
    // Kicks the render loop while playing; silence resumes when paused.
    if (playing) scheduleFrame();
  }

  function setWaterSpeed(mult: number): void {
    if (!Number.isFinite(mult) || mult <= 0) return;
    waterSpeed = mult;
    waterLayer?.setSpeed(mult);
    if (waterState?.supported) {
      waterState = { ...waterState, speed: mult };
      emit();
    }
  }

  function setWaterDischarge(qM3s: number): void {
    if (!Number.isFinite(qM3s) || qM3s < 0) return;
    waterDischarge = qM3s;
    waterLayer?.setDischargeM3s(qM3s);
    if (waterState?.supported) {
      waterState = { ...waterState, dischargeM3s: qM3s };
      emit();
    }
  }

  function resetWater(): void {
    waterLayer?.reset();
    refreshWaterSnapshot();
    scheduleFrame();
  }

  function setContours(on: boolean): void {
    if (on === contoursOn) return;
    contoursOn = on;
    material.uniforms['uContourInterval']!.value = on ? (contourIntervalM ?? 0) : 0;
    emit();
    scheduleFrame();
  }

  function probe(target: ProbeTarget): TerrainProbe | null {
    if (!loaded) return null;
    if (target.kind === 'lonlat') {
      const grid = lonLatToGrid(loaded.sidecar.bbox, target.lon, target.lat);
      const s = sampleBilinear(
        loaded.heights,
        loaded.noData,
        loaded.sidecar,
        grid.u,
        grid.v,
      );
      setLastProbeFromLonLat(target.lon, target.lat);
      return {
        elevationM: s.noData ? null : s.elevationM,
        lon: target.lon,
        lat: target.lat,
      };
    }
    const grid = gridFromNdc(target.x, target.y);
    if (!grid) return null;
    const { lon, lat } = gridToLonLat(loaded.sidecar.bbox, grid.u, grid.v);
    const s = sampleBilinear(
      loaded.heights,
      loaded.noData,
      loaded.sidecar,
      grid.u,
      grid.v,
    );
    const result: TerrainProbe = { elevationM: s.noData ? null : s.elevationM, lon, lat };
    lastProbe = result;
    emit();
    return result;
  }

  function dispose(): void {
    if (disposed) return;
    disposed = true;
    if (frameHandle !== null) {
      cancelRaf(frameHandle);
      frameHandle = null;
    }
    canvas.removeEventListener('keydown', onKeyDown);
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerup', onPointerUp);
    canvas.removeEventListener('pointercancel', onPointerUp);
    canvas.removeEventListener('wheel', onWheel);
    doc.removeEventListener('visibilitychange', onVisibilityChange);
    doc.defaultView?.removeEventListener('resize', onResize);
    observers?.disconnect();
    observers = null;
    heightTexture?.dispose();
    waterLayer?.dispose();
    waterLayer = null;
    geometry.dispose();
    material.dispose();
    renderer.dispose();
    listeners.clear();
  }

  // Kick off the first area. A rejection here is reported through onStatus and
  // the status subscription; the caller does not have to await construction.
  void loadArea(options.initialArea ?? AREA_IDS[0] ?? 'majuli').catch(() => {
    /* surfaced through status; see the catch in loadArea */
  });

  return {
    loadArea,
    setVerticalExaggeration,
    setContours,
    probe,
    getState: snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    resetCamera,
    enableWater,
    disableWater,
    setWaterPlaying,
    setWaterSpeed,
    setWaterDischarge,
    resetWater,
    dispose,
  };
}

/** Thrown for the capability failures that have no scene to render into. */
export class TerrainViewError extends Error {
  readonly code: TerrainErrorCode;
  constructor(code: TerrainErrorCode, message: string) {
    super(message);
    this.name = 'TerrainViewError';
    this.code = code;
  }
}

/**
 * Real capability probe for sampling a 32-bit float texture.
 *
 * Not inferred from a version string or an extension list: a 1x1 R32F texture
 * is created and uploaded, and the GL error state is read. A device that cannot
 * do it says so here rather than rendering a black plane.
 */
function supportsFloatSampling(gl: WebGL2RenderingContext): boolean {
  const tex = gl.createTexture();
  if (!tex) return false;
  try {
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.R32F,
      1,
      1,
      0,
      gl.RED,
      gl.FLOAT,
      new Float32Array([0]),
    );
    return gl.getError() === gl.NO_ERROR;
  } catch {
    return false;
  } finally {
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.deleteTexture(tex);
  }
}

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${url} failed with HTTP ${res.status}`);
  return (await res.json()) as unknown;
}

/**
 * The documented browser decode path.
 *
 * `createImageBitmap` is called with `premultiplyAlpha: 'none'` and
 * `colorSpaceConversion: 'none'`, both of which are load-bearing rather than
 * performance tweaks. Alpha premultiplication would multiply the elevation bytes
 * by alpha; a colour-profile transform would push every value through a
 * transfer curve. Either one corrupts the data silently, and neither is obvious
 * because the result still looks like terrain. The 2D context is created as sRGB
 * so that drawing the bitmap back out applies no further conversion.
 */
async function fetchTerrainRgba(
  url: string,
): Promise<{ data: Uint8ClampedArray; width: number; height: number }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${url} failed with HTTP ${res.status}`);
  const blob = await res.blob();

  const bitmap = await createImageBitmap(blob, {
    premultiplyAlpha: 'none',
    colorSpaceConversion: 'none',
  });

  // Read the dimensions before closing: a closed ImageBitmap reports zero.
  const width = bitmap.width;
  const height = bitmap.height;
  const surface = makeReadbackSurface(width, height);
  const ctx = surface.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('could not get a 2D context to read the terrain image back');
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  const image = ctx.getImageData(0, 0, width, height);

  return { data: image.data, width: image.width, height: image.height };
}

type ReadbackSurface = HTMLCanvasElement | OffscreenCanvas;

function makeReadbackSurface(width: number, height: number): ReadbackSurface {
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(width, height);
  }
  const c = globalThis.document.createElement('canvas');
  c.width = width;
  c.height = height;
  return c;
}

/** Re-exported so the UI does not have to reach past the engine's entry point. */
export { NO_DATA_HEIGHT };
