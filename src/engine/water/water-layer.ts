/**
 * The GPU water layer: ping-pong virtual-pipes sim plus the visible sheet.
 *
 * Owns four float render targets (state RG32F x2, flux RGBA32F x2), the
 * fullscreen pass materials, and one water-surface mesh added to the
 * terrain scene. The engine-side contract only:
 *
 * - `probeFloatTargets` answers "can this device render to float" with a
 *   real framebuffer-completeness check, never a version sniff. A null
 *   answer means terrain-only mode with an explanatory message.
 * - stepping runs on a fixed CFL-safe dt under an accumulator, capped per
 *   frame so a backgrounded tab can never spiral.
 * - stats (wet area, max depth) come from an occasional readback of the
 *   texture the GPU actually wrote, throttled to stay off the hot path.
 */

import * as THREE from 'three';
import type { RiverSection } from '../../shared/atlas.js';
import { readRiverSection } from './section.js';

import { stableDt, REFERENCE_MAX_DEPTH_M, type SimGrid } from './index.js';
import type { ChannelCells } from './channel.js';
import {
  WATER_QUAD_VERTEX,
  WATER_FLUX_FRAGMENT,
  WATER_DEPTH_FRAGMENT,
  WATER_INIT_FRAGMENT,
  WATER_SURFACE_VERTEX,
  WATER_SURFACE_FRAGMENT,
} from './shaders.js';

/** Sim-seconds advanced per real second. Floods are slow; honesty prefers labelled speed. */
export const WATER_SPEEDS = [1, 10, 60, 300] as const;
export const DEFAULT_WATER_SPEED = 60;

/** Illustrative scenario discharge in m3/s. A user setting, never observed. */
export const MIN_DISCHARGE_M3S = 0;
export const MAX_DISCHARGE_M3S = 20000;
export const DISCHARGE_STEP_M3S = 250;
export const DEFAULT_DISCHARGE_M3S = 0;

/** Depth above which a cell counts as wet for the area readout. */
export const WET_THRESHOLD_M = 0.02;

/** Depth that renders as the deep end of the ramp. A display scale, not data. */
export const DEEP_DEPTH_M = 8;

/**
 * Alpha floor for a wet cell.
 *
 * Without it a 5 cm sheet over a 60 m cell is transparent enough to vanish
 * against the terrain, which is what made the river invisible on the reaches.
 */
export const MIN_WATER_ALPHA = 0.42;

const MAX_SUBSTEPS_PER_FRAME = 8;
const STATS_EVERY_FRAMES = 20;
const SURFACE_SEGMENTS = 256;

/** Same north-west bearing as the terrain light: one sun, not two. */
const LIGHT_DIRECTION = new THREE.Vector3(-1, 0.55, -1).normalize();

export interface WaterStats {
  readonly wetAreaKm2: number | null;
  readonly maxDepthM: number | null;
  readonly simTimeS: number;
}

export interface WaterLayerOptions {
  readonly reducedMotion?: boolean;
  /** Visible DEM texture, borrowed and never disposed here. */
  readonly displayTerrain?: {
    texture: THREE.Texture;
    width: number;
    height: number;
    segments: number;
  };
  /** Optional user-chosen starting depth. Omitting this starts dry. */
  readonly initialDepth?: Float32Array;
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly sim: SimGrid;
  readonly channel: ChannelCells;
  readonly extentWM: number;
  readonly extentHM: number;
  readonly exaggeration: number;
  /** Hex colour strings from the UI tokens; the engine holds no palette. */
  readonly shallowColor: string;
  readonly deepColor: string;
  /** Bright band along the waterline, --water-shoreline. */
  readonly shorelineColor: string;
}

export interface WaterLayer {
  setDepthView(on: boolean): void;
  getSection(
    bbox: { west: number; east: number; north: number; south: number },
    position: number,
  ): RiverSection | null;
  setPlaying(playing: boolean): void;
  isPlaying(): boolean;
  setSpeed(mult: number): void;
  setDischargeM3s(q: number): void;
  setExaggeration(x: number): void;
  reset(): void;
  /** Advance the sim and refresh the surface. Called only while playing. */
  stepFrame(realDtS: number): void;
  getStats(): WaterStats;
  /** Bumps whenever stats are reread; the view emits on change only. */
  statsVersion(): number;
  /** True when the depth field stopped being physically plausible. */
  hasDiverged(): boolean;
  readonly simWidth: number;
  readonly simHeight: number;
  readonly inflowCell: number;
  readonly outletCell: number;
  dispose(): void;
}

interface FloatTargets {
  stateA: THREE.WebGLRenderTarget;
  stateB: THREE.WebGLRenderTarget;
  fluxA: THREE.WebGLRenderTarget;
  fluxB: THREE.WebGLRenderTarget;
}

/**
 * Real capability probe for float rendering: the extension must exist AND a
 * framebuffer in each format we use must report complete. Sampling float
 * (which the terrain already probes) says nothing about writing it.
 */
export function probeFloatTargets(
  renderer: THREE.WebGLRenderer,
  w: number,
  h: number,
): FloatTargets | null {
  const gl = renderer.getContext();
  if (!gl.getExtension('EXT_color_buffer_float')) return null;
  const make = (format: THREE.PixelFormat): THREE.WebGLRenderTarget =>
    new THREE.WebGLRenderTarget(w, h, {
      type: THREE.FloatType,
      format,
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      depthBuffer: false,
      stencilBuffer: false,
    });
  // RGBA, not RG, for the state. RG32F is renderable with
  // EXT_color_buffer_float but readPixels from it is not guaranteed to be
  // supported, and the stats readback silently returned garbage (depths of
  // 1e19 m) that the HUD reported as real. RGBA32F is both renderable and
  // readable everywhere the extension exists. Terrain stays in .r and depth in
  // .g; the extra channels are unused.
  const targets: FloatTargets = {
    stateA: make(THREE.RGBAFormat),
    stateB: make(THREE.RGBAFormat),
    fluxA: make(THREE.RGBAFormat),
    fluxB: make(THREE.RGBAFormat),
  };
  try {
    for (const rt of [targets.stateA, targets.fluxA]) {
      renderer.setRenderTarget(rt);
      const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
      if (status !== gl.FRAMEBUFFER_COMPLETE) {
        renderer.setRenderTarget(null);
        disposeTargets(targets);
        return null;
      }
    }
    renderer.setRenderTarget(null);
    return targets;
  } catch {
    renderer.setRenderTarget(null);
    disposeTargets(targets);
    return null;
  }
}

function disposeTargets(t: FloatTargets): void {
  t.stateA.dispose();
  t.stateB.dispose();
  t.fluxA.dispose();
  t.fluxB.dispose();
}

export function createWaterLayer(options: WaterLayerOptions): WaterLayer | null {
  const { renderer, scene, sim, channel } = options;
  const targets = probeFloatTargets(renderer, sim.width, sim.height);
  if (!targets) return null;

  const cellArea = sim.dxM * sim.dyM;
  const dt = stableDt(sim.dxM, sim.dyM, REFERENCE_MAX_DEPTH_M);
  const inflowX = channel.inflow % sim.width;
  const inflowY = Math.floor(channel.inflow / sim.width);

  // Initial state texture: terrain plus a dry sheet, uploaded once and kept
  // for reset(). Row 0 is the north edge, unflipped, matching the shaders.
  // RGBA: .r terrain metres, .g depth. NaN in .r marks a wall.
  const initialData = new Float32Array(sim.width * sim.height * 4);
  for (let i = 0; i < sim.width * sim.height; i += 1) {
    initialData[i * 4] = sim.heights[i] ?? Number.NaN;
    initialData[i * 4 + 1] = options.initialDepth?.[i] ?? 0;
  }
  const initialTex = new THREE.DataTexture(
    initialData,
    sim.width,
    sim.height,
    THREE.RGBAFormat,
    THREE.FloatType,
  );
  initialTex.minFilter = THREE.NearestFilter;
  initialTex.magFilter = THREE.NearestFilter;
  initialTex.needsUpdate = true;

  const quadScene = new THREE.Scene();
  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quadGeo = new THREE.PlaneGeometry(2, 2);

  function passMaterial(
    fragment: string,
    uniforms: Record<string, THREE.IUniform>,
  ): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      vertexShader: WATER_QUAD_VERTEX,
      fragmentShader: fragment,
      uniforms,
      depthTest: false,
      depthWrite: false,
    });
  }

  const texSize = new THREE.Vector2(sim.width, sim.height);
  const cell = new THREE.Vector2(sim.dxM, sim.dyM);

  const fluxMat = passMaterial(WATER_FLUX_FRAGMENT, {
    uState: { value: null },
    uFlux: { value: null },
    uTexSize: { value: texSize },
    uCell: { value: cell },
    uDt: { value: dt },
    uGravity: { value: 9.81 },
    uCellArea: { value: cellArea },
    // West open (the outflow), walls elsewhere: the Assam contract.
    uOpen: { value: new THREE.Vector4(1, 0, 0, 0) },
  });
  const depthMat = passMaterial(WATER_DEPTH_FRAGMENT, {
    uState: { value: null },
    uFluxNew: { value: null },
    uTexSize: { value: texSize },
    uDt: { value: dt },
    uCellArea: { value: cellArea },
    uInflow: { value: new THREE.Vector3(inflowX, inflowY, DEFAULT_DISCHARGE_M3S) },
  });
  const initMat = passMaterial(WATER_INIT_FRAGMENT, {
    uInit: { value: initialTex },
    uZero: { value: 0 },
  });
  const quad = new THREE.Mesh(quadGeo, initMat);
  quad.frustumCulled = false;
  quadScene.add(quad);

  function runPass(mat: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget): void {
    quad.material = mat;
    renderer.setRenderTarget(target);
    renderer.render(quadScene, quadCam);
    renderer.setRenderTarget(null);
  }

  // state/flux read+write ends. stateRead is what the surface samples.
  let stateRead = targets.stateA;
  let stateWrite = targets.stateB;
  let fluxRead = targets.fluxA;
  let fluxWrite = targets.fluxB;

  runPass(initMat, stateRead);
  initMat.uniforms['uZero']!.value = 1;
  runPass(initMat, fluxRead);
  initMat.uniforms['uZero']!.value = 0;

  // --- Visible surface ----------------------------------------------------
  const surfaceGeo = new THREE.PlaneGeometry(
    1,
    1,
    options.displayTerrain?.segments ?? SURFACE_SEGMENTS,
    options.displayTerrain?.segments ?? SURFACE_SEGMENTS,
  );
  surfaceGeo.rotateX(-Math.PI / 2);
  const surfaceMat = new THREE.ShaderMaterial({
    vertexShader: WATER_SURFACE_VERTEX,
    fragmentShader: WATER_SURFACE_FRAGMENT,
    uniforms: {
      uState: { value: stateRead.texture },
      uFlux: { value: fluxRead.texture },
      uTexSize: { value: texSize },
      uWorldSize: { value: new THREE.Vector2(options.extentWM, options.extentHM) },
      uGround: { value: options.displayTerrain?.texture ?? initialTex },
      uGroundSize: {
        value: new THREE.Vector2(
          options.displayTerrain?.width ?? sim.width,
          options.displayTerrain?.height ?? sim.height,
        ),
      },
      uExaggeration: { value: options.exaggeration },
      uShallow: { value: new THREE.Color(options.shallowColor) },
      uDeep: { value: new THREE.Color(options.deepColor) },
      uShoreline: { value: new THREE.Color(options.shorelineColor) },
      uDeepDepth: { value: DEEP_DEPTH_M },
      uLightDirection: { value: LIGHT_DIRECTION.clone() },
      uVisualTime: { value: 0 },
      uDepthView: { value: 0 },
      uMotion: { value: options.reducedMotion ? 0 : 1 },
      uOpacity: { value: 0.92 },
      uMinOpacity: { value: MIN_WATER_ALPHA },
    },
    transparent: true,
    depthWrite: false,
  });
  const surface = new THREE.Mesh(surfaceGeo, surfaceMat);
  surface.frustumCulled = false;
  surface.renderOrder = 1;
  scene.add(surface);

  // --- Control state --------------------------------------------------------
  let playing = false;
  let speed = DEFAULT_WATER_SPEED;
  let discharge = DEFAULT_DISCHARGE_M3S;
  let simTime = 0;
  let acc = 0;
  let framesSinceStats = STATS_EVERY_FRAMES; // read on the first stepped frame
  let version = 0;
  let disposed = false;
  /** True when the depth field is not physically plausible; see refreshStats. */
  let diverged = false;
  const stats: { wetAreaKm2: number | null; maxDepthM: number | null; simTimeS: number } =
    {
      wetAreaKm2: 0,
      maxDepthM: 0,
      simTimeS: 0,
    };
  const readback = new Float32Array(sim.width * sim.height * 4);

  function refreshStats(): void {
    try {
      renderer.readRenderTargetPixels(stateRead, 0, 0, sim.width, sim.height, readback);
    } catch {
      stats.wetAreaKm2 = null;
      stats.maxDepthM = null;
      diverged = true;
      playing = false;
      version += 1;
      return;
    }
    let wet = 0;
    let max = 0;
    let suspect = 0;
    for (let i = 0; i < sim.width * sim.height; i += 1) {
      const d = readback[i * 4 + 1] ?? 0;
      if (sim.noData[i]) continue;
      if (!Number.isFinite(d) || d < 0) {
        suspect += 1;
        continue;
      }
      if (d < WET_THRESHOLD_M) continue;
      // A depth past a few tens of metres means the sim diverged or the
      // readback came back garbage. Report it as unknown rather than printing
      // 5e19 m as if it were a measurement.
      if (d > 1e4) {
        suspect += 1;
        continue;
      }
      wet += 1;
      if (d > max) max = d;
    }
    if (suspect > 0) {
      // Diverged or unreadable: say so rather than print a number. A readout
      // of 5e19 m is worse than no readout, because it looks like a measurement.
      stats.wetAreaKm2 = null;
      stats.maxDepthM = null;
      stats.simTimeS = simTime;
      diverged = true;
      playing = false;
      version += 1;
      return;
    }
    diverged = false;
    stats.wetAreaKm2 = (wet * cellArea) / 1e6;
    stats.maxDepthM = max;
    stats.simTimeS = simTime;
    version += 1;
  }

  function stepOnce(): void {
    fluxMat.uniforms['uState']!.value = stateRead.texture;
    fluxMat.uniforms['uFlux']!.value = fluxRead.texture;
    runPass(fluxMat, fluxWrite);

    depthMat.uniforms['uState']!.value = stateRead.texture;
    depthMat.uniforms['uFluxNew']!.value = fluxWrite.texture;
    (depthMat.uniforms['uInflow']!.value as THREE.Vector3).set(
      inflowX,
      inflowY,
      discharge,
    );
    runPass(depthMat, stateWrite);

    const s = stateRead;
    stateRead = stateWrite;
    stateWrite = s;
    const f = fluxRead;
    fluxRead = fluxWrite;
    fluxWrite = f;
    simTime += dt;
  }

  const layer: WaterLayer = {
    setDepthView(on) {
      surfaceMat.uniforms['uDepthView']!.value = on ? 1 : 0;
    },
    getSection(bbox, position) {
      return diverged
        ? null
        : readRiverSection(sim, readback, bbox, position, stats.simTimeS);
    },
    simWidth: sim.width,
    simHeight: sim.height,
    inflowCell: channel.inflow,
    outletCell: channel.outlet,

    setPlaying(p: boolean): void {
      if (p && diverged) return;
      playing = p;
      if (p) acc = 0; // never repay wall-clock debt earned while paused
    },
    isPlaying: () => playing,
    setSpeed(mult: number): void {
      if (Number.isFinite(mult) && mult > 0) speed = mult;
    },
    setDischargeM3s(q: number): void {
      if (Number.isFinite(q) && q >= 0) discharge = q;
    },
    setExaggeration(x: number): void {
      surfaceMat.uniforms['uExaggeration']!.value = x;
    },
    reset(): void {
      runPass(initMat, stateRead);
      runPass(initMat, stateWrite);
      // Use a numerical zero pass, not the scene's non-zero clear colour.
      initMat.uniforms['uZero']!.value = 1;
      runPass(initMat, fluxRead);
      runPass(initMat, fluxWrite);
      initMat.uniforms['uZero']!.value = 0;
      simTime = 0;
      acc = 0;
      stats.wetAreaKm2 = 0;
      stats.maxDepthM = 0;
      stats.simTimeS = 0;
      diverged = false;
      refreshStats();
      surfaceMat.uniforms['uState']!.value = stateRead.texture;
      surfaceMat.uniforms['uFlux']!.value = fluxRead.texture;
      surfaceMat.uniforms['uVisualTime']!.value = 0;
      version += 1;
    },
    stepFrame(realDtS: number): void {
      if (disposed || !playing) return;
      const clamped = Math.min(Math.max(realDtS, 0), 0.25);
      acc += clamped * speed;
      let n = 0;
      while (acc >= dt && n < MAX_SUBSTEPS_PER_FRAME) {
        stepOnce();
        acc -= dt;
        n += 1;
      }
      // Excess beyond the cap is dropped, never repaid: a backgrounded tab
      // resumes at the present instead of sprinting through the past.
      if (acc >= dt) acc = 0;
      surfaceMat.uniforms['uState']!.value = stateRead.texture;
      surfaceMat.uniforms['uFlux']!.value = fluxRead.texture;
      surfaceMat.uniforms['uVisualTime']!.value += clamped;
      framesSinceStats += 1;
      if (framesSinceStats >= STATS_EVERY_FRAMES) {
        framesSinceStats = 0;
        refreshStats();
      }
    },
    getStats(): WaterStats {
      return {
        wetAreaKm2: stats.wetAreaKm2,
        maxDepthM: stats.maxDepthM,
        simTimeS: stats.simTimeS,
      };
    },
    statsVersion(): number {
      return version;
    },
    hasDiverged(): boolean {
      return diverged;
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      scene.remove(surface);
      surfaceGeo.dispose();
      surfaceMat.dispose();
      quadGeo.dispose();
      fluxMat.dispose();
      depthMat.dispose();
      initMat.dispose();
      initialTex.dispose();
      disposeTargets(targets);
    },
  };

  refreshStats();
  return layer;
}
