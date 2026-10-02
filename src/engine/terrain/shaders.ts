/**
 * Terrain shaders.
 *
 * Written in GLSL ES 1.00 rather than `#version 300 es`, on purpose. Everything
 * this shader needs from WebGL2 works in ESSL1 on a WebGL2 context: derivatives
 * are core there, so `fwidth` for anti-aliased contours needs no extension
 * pragma, and exact texel fetches are done by sampling at texel centres with a
 * NEAREST-filtered texture. The only WebGL2 requirement that actually matters is
 * the float texture format itself, which is a texture-format question rather
 * than a shader-language one.
 *
 * Declaring an explicit `out` variable would be the GLSL3 route, but Three.js
 * also emits a fragment output declaration for GLSL3 ShaderMaterials, and
 * getting that to agree by hand is a link error waiting to happen on a driver
 * nobody tested against.
 *
 * ## The height texture is float32, deliberately
 *
 * Elevations go into an R32F texture with NEAREST filtering, and the bilinear
 * interpolation is done here by hand. A UNSIGNED_BYTE or half-float height
 * texture would quantise the terrain into visible terraces: at 16 bits over the
 * overview area's 7.3 km range that is fine, but the same encoding applied to
 * a 0.1 m step reach gives a step of 6.5 m, which is larger than the floodplain's
 * entire relief. Half float is worse - 11 bits of mantissa, so it loses metres
 * at any plausible range. See DECISIONS.md section 9.
 *
 * No-data is NaN in that texture. `isnan` does not exist in ESSL1, so the test
 * is `h != h`, which is exactly equivalent for a quiet NaN and costs nothing.
 */

/**
 * Shared height-fetching helpers, injected into both stages.
 *
 * They must agree exactly: the vertex stage displaces the mesh with one and the
 * fragment stage recomputes normals with the other, and if the two ever
 * disagreed the hillshade would not match the silhouette.
 */
const HEIGHT_SAMPLER_GLSL = /* glsl */ `
uniform highp sampler2D uHeightTex;
uniform vec2 uTexSize;        // (width, height) of the height texture, texels
uniform vec2 uPixelSizeM;     // ground size of one texel: (east-west, north-south)

float fetchHeightTexel(ivec2 c) {
  // NEAREST filtering means sampling the texel centre addresses that texel
  // exactly, which is what makes this an integer fetch rather than a sample that
  // might land on a boundary.
  vec2 uv = (vec2(c) + 0.5) / uTexSize;
  return texture2D(uHeightTex, uv).r;
}

ivec2 clampTexel(ivec2 c) {
  return clamp(c, ivec2(0), ivec2(uTexSize) - ivec2(1));
}

/**
 * Bilinear height at fractional grid coordinates, v with 0 at the NORTH edge.
 *
 * Returns false and writes 0.0 when any of the four taps is no-data, rather than
 * blending a data gap into a plausible number.
 */
bool sampleHeightBilinear(vec2 grid, out float outH) {
  vec2 p = grid * uTexSize - 0.5;
  vec2 f = fract(p);
  ivec2 i = ivec2(floor(p));

  float h00 = fetchHeightTexel(clampTexel(i));
  float h10 = fetchHeightTexel(clampTexel(i + ivec2(1, 0)));
  float h01 = fetchHeightTexel(clampTexel(i + ivec2(0, 1)));
  float h11 = fetchHeightTexel(clampTexel(i + ivec2(1, 1)));

  if (h00 != h00 || h10 != h10 || h01 != h01 || h11 != h11) {
    outH = 0.0;
    return false;
  }

  float top = mix(h00, h10, f.x);
  float bottom = mix(h01, h11, f.x);
  outH = mix(top, bottom, f.y);
  return true;
}
`;

/**
 * Vertex stage: displace a flat grid by the height texture.
 *
 * The grid is laid out in true metres from the sidecar rather than in degrees or
 * arbitrary units, so a slope on screen is a slope on the ground.
 *
 * The v flip is worth reading twice. PlaneGeometry puts uv.y = 1 at local +y;
 * rotating -90 degrees about X sends local +y to world -z, i.e. north. Row 0 of
 * the decoded grid is the north edge, and the height texture's first row is
 * therefore at uv.y = 1, not uv.y = 0. Forgetting this mirrors the terrain
 * north-south, which looks almost right until you put a river on it.
 */
export const TERRAIN_VERTEX_SHADER = /* glsl */ `
${HEIGHT_SAMPLER_GLSL}

uniform float uExaggeration;   // vertical exaggeration, multiple of true scale
uniform float uNoDataLevel;    // height in metres to draw where data is absent
uniform vec2 uWorldSizeM;      // (width, height) of the grid in metres

varying vec2 vGrid;            // (u, v); v = 0 at north
varying float vElevation;      // TRUE metres, never exaggerated
varying vec3 vViewPosition;

void main() {
  vGrid = vec2(uv.x, 1.0 - uv.y);

  float h;
  if (!sampleHeightBilinear(vGrid, h)) {
    h = uNoDataLevel;
  }
  vElevation = h;

  vec3 p;
  p.x = (vGrid.x - 0.5) * uWorldSizeM.x;
  p.y = h * uExaggeration;
  // z grows southward, matching gridToWorld in metrics.ts.
  p.z = (vGrid.y - 0.5) * uWorldSizeM.y;

  vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
  vViewPosition = mvPosition.xyz;
  gl_Position = projectionMatrix * mvPosition;
}
`;

/**
 * Fragment stage: hypsometric tint, hillshade from full-resolution heights,
 * optional contour lines, and an edge fade into the background.
 *
 * The normal is recomputed per fragment from the height texture's own texels
 * rather than interpolated from the mesh. That is the whole reason the mesh may
 * be as coarse as 512 segments while the hillshade stays sharp: the lighting
 * detail comes from the full-resolution data, not from the tessellation.
 */
export const TERRAIN_FRAGMENT_SHADER = /* glsl */ `
${HEIGHT_SAMPLER_GLSL}

uniform float uExaggeration;
uniform vec2 uElevationRange;   // (min, max) metres, from the sidecar
uniform vec3 uRampLow;          // --terrain-1
uniform vec3 uRampLowMid;       // --terrain-2
uniform vec3 uRampHighMid;      // --terrain-3
uniform vec3 uRampHigh;         // --terrain-4
uniform vec3 uBackground;       // --bg
uniform vec3 uNoDataColour;
uniform vec3 uContourColour;
uniform vec3 uLightDirection;   // unit vector from the surface TOWARD the light
uniform float uContourInterval; // metres; <= 0 disables contours
uniform float uContourStrength;
uniform float uEdgeFade;        // fraction of the half-extent used to fade out
uniform vec2 uFogRange;         // (near, far) view distance
uniform float uFogStrength;
uniform float uAmbient;
uniform float uScreenHeight;     // drawing-buffer height in pixels

varying vec2 vGrid;
varying float vElevation;
varying vec3 vViewPosition;
uniform vec3 uSkyLow;            // horizon haze, one step above --surface
uniform vec3 uSkyHigh;           // zenith, slightly lighter

/**
 * Vertical background gradient, evaluated from the fragment's own screen
 * position so it stays put while the camera orbits. Pure #bg behind a
 * 699 km scene read as a black void; a graded horizon gives the eye somewhere
 * for the terrain's edge fade to go.
 */
vec3 skyColour() {
  float h = clamp(gl_FragCoord.y / max(uScreenHeight, 1.0), 0.0, 1.0);
  vec3 sky = mix(uSkyLow, uSkyHigh, pow(h, 1.4));
  return sky;
}

/** Four-stop hypsometric ramp. Stops are the DESIGN.md terrain tokens. */
vec3 rampColour(float t) {
  float s = clamp(t, 0.0, 1.0) * 3.0;
  if (s < 1.0) return mix(uRampLow, uRampLowMid, s);
  if (s < 2.0) return mix(uRampLowMid, uRampHighMid, s - 1.0);
  return mix(uRampHighMid, uRampHigh, s - 2.0);
}

void main() {
  bool hasData = vElevation == vElevation;

  // --- Normal from full-resolution heights -------------------------------
  // The gradient is taken in TRUE metres and then multiplied by the
  // exaggeration, because the rendered surface is exaggerated and the
  // hillshade has to describe the surface that is actually on screen. Skipping
  // that multiply would make the lighting flatter than the terrain as the user
  // raises the exaggeration.
  ivec2 c = ivec2(floor(vGrid * uTexSize));
  float hL = fetchHeightTexel(clampTexel(c + ivec2(-1, 0)));
  float hR = fetchHeightTexel(clampTexel(c + ivec2(1, 0)));
  // Row index increases southward, so row + 1 is the larger z.
  float hUp = fetchHeightTexel(clampTexel(c + ivec2(0, -1)));
  float hDn = fetchHeightTexel(clampTexel(c + ivec2(0, 1)));

  vec3 normal = vec3(0.0, 1.0, 0.0);
  if (hL == hL && hR == hR && hUp == hUp && hDn == hDn) {
    float dx = ((hR - hL) / (2.0 * uPixelSizeM.x)) * uExaggeration;
    float dz = ((hDn - hUp) / (2.0 * uPixelSizeM.y)) * uExaggeration;
    normal = normalize(vec3(-dx, 1.0, -dz));
  }

  float lambert = max(dot(normal, uLightDirection), 0.0);
  float shade = uAmbient + (1.0 - uAmbient) * lambert;

  // --- Hypsometric tint ---------------------------------------------------
  float span = max(uElevationRange.y - uElevationRange.x, 1.0);
  float t = (vElevation - uElevationRange.x) / span;
  vec3 colour = rampColour(t) * shade;

  // --- Contours -----------------------------------------------------------
  if (uContourInterval > 0.0 && hasData) {
    // Lines are drawn at multiples of the interval in TRUE metres, so a contour
    // means the same altitude at every exaggeration. Scaling by the
    // exaggeration here would put the lines in the wrong places.
    float e = vElevation / uContourInterval;
    float d = abs(fract(e + 0.5) - 0.5);
    // Screen-space width: constant apparent thickness whether the hill is near
    // or far, and it thins the line to nothing when contours are denser than
    // the pixel grid can resolve rather than turning them into hatching.
    float w = fwidth(e);
    float line = 1.0 - smoothstep(0.0, max(w * 1.1, 1e-5), d);
    // Fade out rather than vanish when w approaches the interval, so a dense
    // contour set greys out instead of aliasing.
    float legible = 1.0 - smoothstep(0.35, 0.6, w);
    colour = mix(colour, uContourColour, line * uContourStrength * legible);
  }

  if (!hasData) {
    colour = uNoDataColour;
  }

  // --- Edge fade: no hard cut at the bbox border -------------------------
  // The fade goes to the SKY colour, not the flat page background, so the far
  // edge of a 699 km area dissolves into atmosphere instead of into a void.
  vec2 toEdge = min(vGrid, vec2(1.0) - vGrid);
  float edge = min(toEdge.x, toEdge.y);
  float edgeMix = smoothstep(0.0, max(uEdgeFade, 1e-4), edge);
  colour = mix(skyColour, colour, edgeMix);

  // --- Subtle depth haze --------------------------------------------------
  float viewDistance = length(vViewPosition);
  float fog = smoothstep(uFogRange.x, uFogRange.y, viewDistance);
  colour = mix(colour, skyColour, fog * uFogStrength);

  gl_FragColor = vec4(colour, 1.0);
}
`;
