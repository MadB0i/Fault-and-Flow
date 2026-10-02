/**
 * FLOW water shaders: virtual-pipes passes plus the visible surface.
 *
 * ESSL1 (no version directive, no raw hex, no preprocessor of our own —
 * Three.js injects its prefix). The two sim passes implement exactly the
 * equations in `step.ts`, with the same ghost rules, so the headless tests
 * assert on the behaviour the GPU executes:
 *
 * - texel (i, j): i east, j south from the north edge. Memory row 0 is the
 *   north edge and uploads unflipped, so texture v = (j + 0.5) / H.
 * - state texture RG32F: r = terrain metres (NaN = no-data wall), g = depth.
 * - flux texture RGBA32F: W, E, N, S outflow pipes in m3/s, always >= 0.
 * - the CPU mirror is double-buffered; the GPU is ping-pong by construction.
 */

export const WATER_QUAD_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

/**
 * Flux pass. Reads state + old flux, writes new flux.
 * uOpen: W, E, N, S edge behaviour, 1 = open ghost, 0 = wall.
 */
export const WATER_FLUX_FRAGMENT = /* glsl */ `
varying vec2 vUv;
uniform sampler2D uState;
uniform sampler2D uFlux;
uniform vec2 uTexSize;
uniform vec2 uCell;
uniform float uDt;
uniform float uGravity;
uniform float uCellArea;
uniform vec4 uOpen;
void main() {
  vec2 texel = 1.0 / uTexSize;
  vec2 fcoord = floor(gl_FragCoord.xy);
  vec4 state = texture2D(uState, vUv);
  float h = state.r;
  float d = max(state.g, 0.0);
  vec4 oldFlux = texture2D(uFlux, vUv);
  if (h != h) {
    gl_FragColor = vec4(0.0);
    return;
  }
  float w = h + d;
  vec4 f;
  // W(-x)
  {
    vec4 n = texture2D(uState, vUv + vec2(-texel.x, 0.0));
    bool outside = fcoord.x < 0.5;
    bool wall = outside ? (uOpen.x < 0.5) : (n.r != n.r);
    float wN = outside ? h : n.r + max(n.g, 0.0);
    f.x = wall ? 0.0 : max(0.0, oldFlux.x + uDt * uCellArea * uGravity * (w - wN) / uCell.x);
  }
  // E(+x)
  {
    vec4 n = texture2D(uState, vUv + vec2(texel.x, 0.0));
    bool outside = fcoord.x > uTexSize.x - 1.5;
    bool wall = outside ? (uOpen.y < 0.5) : (n.r != n.r);
    float wN = outside ? h : n.r + max(n.g, 0.0);
    f.y = wall ? 0.0 : max(0.0, oldFlux.y + uDt * uCellArea * uGravity * (w - wN) / uCell.x);
  }
  // N(-y, north)
  {
    vec4 n = texture2D(uState, vUv + vec2(0.0, -texel.y));
    bool outside = fcoord.y < 0.5;
    bool wall = outside ? (uOpen.z < 0.5) : (n.r != n.r);
    float wN = outside ? h : n.r + max(n.g, 0.0);
    f.z = wall ? 0.0 : max(0.0, oldFlux.z + uDt * uCellArea * uGravity * (w - wN) / uCell.y);
  }
  // S(+y, south)
  {
    vec4 n = texture2D(uState, vUv + vec2(0.0, texel.y));
    bool outside = fcoord.y > uTexSize.y - 1.5;
    bool wall = outside ? (uOpen.w < 0.5) : (n.r != n.r);
    float wN = outside ? h : n.r + max(n.g, 0.0);
    f.w = wall ? 0.0 : max(0.0, oldFlux.w + uDt * uCellArea * uGravity * (w - wN) / uCell.y);
  }
  // Overshoot guard, same as the CPU mirror.
  float outSum = f.x + f.y + f.z + f.w;
  if (d > 0.0 && outSum * uDt > d * uCellArea) {
    f *= (d * uCellArea) / (outSum * uDt);
  } else if (d <= 0.0) {
    f = vec4(0.0);
  }
  gl_FragColor = vec4(f.x, f.y, f.z, f.w);
}
`;

/**
 * Depth pass. Reads the NEW flux field plus old state, writes new state.
 * uInflow: (cellX, cellY, rateM3s) — the DEM-derived upstream cell.
 */
export const WATER_DEPTH_FRAGMENT = /* glsl */ `
varying vec2 vUv;
uniform sampler2D uState;
uniform sampler2D uFluxNew;
uniform vec2 uTexSize;
uniform float uDt;
uniform float uCellArea;
uniform vec3 uInflow;
void main() {
  vec2 texel = 1.0 / uTexSize;
  vec2 fcoord = floor(gl_FragCoord.xy);
  vec4 state = texture2D(uState, vUv);
  float h = state.r;
  if (h != h) {
    gl_FragColor = vec4(h, 0.0);
    return;
  }
  float d = max(state.g, 0.0);
  vec4 f = texture2D(uFluxNew, vUv);
  float outSum = f.x + f.y + f.z + f.w;
  float inSum = 0.0;
  inSum += texture2D(uFluxNew, vUv + vec2(texel.x, 0.0)).x;
  inSum += texture2D(uFluxNew, vUv + vec2(-texel.x, 0.0)).y;
  inSum += texture2D(uFluxNew, vUv + vec2(0.0, texel.y)).z;
  inSum += texture2D(uFluxNew, vUv + vec2(0.0, -texel.y)).w;
  float nd = d + uDt * (inSum - outSum) / uCellArea;
  if (fcoord.x == uInflow.x && fcoord.y == uInflow.y && uInflow.z > 0.0) {
    nd += uInflow.z * uDt / uCellArea;
  }
  gl_FragColor = vec4(h, max(nd, 0.0));
}
`;

/**
 * Initialiser: copies an (terrain, 0) texture, or writes zeros for flux.
 */
export const WATER_INIT_FRAGMENT = /* glsl */ `
varying vec2 vUv;
uniform sampler2D uInit;
uniform float uZero;
void main() {
  if (uZero > 0.5) {
    gl_FragColor = vec4(0.0);
  } else {
    gl_FragColor = texture2D(uInit, vUv);
  }
}
`;

/**
 * Visible water surface. Displaced by (terrain + depth) from the sim state,
 * so the sheet sits exactly on the rendered terrain, exaggerated alike.
 */
export const WATER_SURFACE_VERTEX = /* glsl */ `
varying vec2 vUv;
varying float vDepth;
varying float vNoData;
varying vec3 vWorld;
uniform sampler2D uState;
uniform vec2 uTexSize;
uniform vec2 uWorldSize;
uniform float uExaggeration;
float sampleDepth(vec2 uv, out float terrain) {
  vec2 g = uv * uTexSize - 0.5;
  vec2 i0 = floor(g);
  vec2 fr = fract(g);
  vec2 b0 = max(i0, vec2(0.0));
  vec2 b1 = min(i0 + 1.0, uTexSize - 1.0);
  vec2 t00 = (b0 + 0.5) / uTexSize;
  vec2 t10 = (vec2(b1.x, b0.y) + 0.5) / uTexSize;
  vec2 t01 = (vec2(b0.x, b1.y) + 0.5) / uTexSize;
  vec2 t11 = (b1 + 0.5) / uTexSize;
  vec4 s00 = texture2D(uState, t00);
  vec4 s10 = texture2D(uState, t10);
  vec4 s01 = texture2D(uState, t01);
  vec4 s11 = texture2D(uState, t11);
  float top = mix(s00.r, s10.r, fr.x);
  float bot = mix(s01.r, s11.r, fr.x);
  terrain = mix(top, bot, fr.y);
  float dtop = mix(max(s00.g, 0.0), max(s10.g, 0.0), fr.x);
  float dbot = mix(max(s01.g, 0.0), max(s11.g, 0.0), fr.x);
  return mix(dtop, dbot, fr.y);
}
void main() {
  vUv = uv;
  float terrain = 0.0;
  float depth = sampleDepth(uv, terrain);
  vNoData = terrain != terrain ? 1.0 : 0.0;
  vDepth = depth;
  float y = (terrain + depth) * uExaggeration;
  vec3 world = vec3((uv.x - 0.5) * uWorldSize.x, y, (uv.y - 0.5) * uWorldSize.y);
  vWorld = world;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(world, 1.0);
}
`;

export const WATER_SURFACE_FRAGMENT = /* glsl */ `
varying vec2 vUv;
varying float vDepth;
varying float vNoData;
varying vec3 vWorld;
uniform sampler2D uFlux;
uniform vec2 uTexSize;
uniform vec3 uShallow;
uniform vec3 uDeep;
uniform float uDeepDepth;
uniform vec3 uLightDirection;
uniform float uSimTime;
uniform float uOpacity;
void main() {
  if (vNoData > 0.5 || vDepth <= 0.0) {
    discard;
  }
  // Shoreline: fade the sheet out over the first 25 cm so the waterline
  // reads as a soft edge rather than a hard cut against the terrain.
  float shore = smoothstep(0.0, 0.25, vDepth);
  float depthMix = clamp(vDepth / uDeepDepth, 0.0, 1.0);
  vec3 colour = mix(uShallow, uDeep, depthMix);
  // Advected streaks: brightness bands drift along the local flow direction
  // read from the flux field. Procedural and visibly synthetic — it suggests
  // motion, it does not track particles.
  vec4 f = texture2D(uFlux, vUv);
  vec2 flow = vec2(f.y - f.x, f.w - f.z);
  float speed = length(flow);
  vec2 dir = speed > 0.0001 ? flow / speed : vec2(1.0, 0.0);
  vec2 perp = vec2(-dir.y, dir.x);
  float streak = sin(dot(vUv * uTexSize, perp) * 0.9 - uSimTime * (0.6 + min(speed * 4.0, 3.0)));
  colour *= 0.94 + 0.06 * streak;
  // Subtle specular from the same north-west light as the terrain.
  vec3 n = normalize(cross(dFdx(vWorld), dFdy(vWorld)));
  if (n.y < 0.0) n = -n;
  vec3 v = vec3(0.0, 0.0, 1.0);
  float spec = pow(max(dot(reflect(-uLightDirection, n), v), 0.0), 24.0);
  colour += spec * 0.25;
  float alpha = mix(0.55, uOpacity, depthMix) * shore;
  gl_FragColor = vec4(colour, alpha);
}
`;
