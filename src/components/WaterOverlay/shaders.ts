// ─── Shared vertex ────────────────────────────────────────────────────────────

export const VERT = /* glsl */`
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

// ─── Wave simulation (ping-pong) ──────────────────────────────────────────────
// r = current height,  g = previous height

export const SIM_FRAG = /* glsl */`
uniform sampler2D tSim;
uniform vec2  texelSize;
uniform float aspectRatio;
uniform vec2  splashPos;
uniform float splashStrength;
uniform float splashRadius;
varying vec2 vUv;

void main() {
  vec4  data  = texture2D(tSim, vUv);
  float hCurr = data.r;
  float hPrev = data.g;

  vec2  ts = texelSize * vec2(1.0, aspectRatio);
  float hL = texture2D(tSim, vUv - vec2(ts.x, 0.0)).r;
  float hR = texture2D(tSim, vUv + vec2(ts.x, 0.0)).r;
  float hU = texture2D(tSim, vUv + vec2(0.0,  ts.y)).r;
  float hD = texture2D(tSim, vUv - vec2(0.0,  ts.y)).r;

  float hNew = (hL + hR + hU + hD) * 0.5 - hPrev;
  hNew *= 0.984; // damping

  vec2 sd = (vUv - splashPos) * vec2(1.0, 1.0 / aspectRatio);
  hNew = clamp(hNew + splashStrength * max(0.0, 1.0 - length(sd) / splashRadius), -1.0, 1.0);

  gl_FragColor = vec4(hNew, hCurr, 0.0, 1.0);
}`;

// ─── Displacement map ─────────────────────────────────────────────────────────
// Encodes surface normals as RG channels for SVG feDisplacementMap.
// Above waterLevelUV (CSS space): neutral 0.5,0.5 → zero offset.
// Below: actual normal gradient.

export const DISP_FRAG = /* glsl */`
uniform sampler2D tSim;
uniform vec2  texelSize;
uniform float waterLevelUV;   // 0=top, 1=bottom (CSS space)
uniform float distortionMult; // 1.0 = normal, 0 = off
varying vec2 vUv;

void main() {
  // Flip Y: OpenGL UV (0=bottom) → CSS space (0=top)
  vec2 uv = vec2(vUv.x, 1.0 - vUv.y);

  if (uv.y < waterLevelUV) {
    // Above water — neutral displacement
    gl_FragColor = vec4(0.5, 0.5, 0.5, 1.0);
    return;
  }

  float hL = texture2D(tSim, uv - vec2(texelSize.x, 0.0)).r;
  float hR = texture2D(tSim, uv + vec2(texelSize.x, 0.0)).r;
  float hU = texture2D(tSim, uv + vec2(0.0, texelSize.y)).r;
  float hD = texture2D(tSim, uv - vec2(0.0, texelSize.y)).r;

  vec3 normal = normalize(vec3((hL - hR) * 6.0 * distortionMult,
                               (hD - hU) * 6.0 * distortionMult, 1.0));
  gl_FragColor = vec4(normal.x * 0.5 + 0.5, normal.y * 0.5 + 0.5, 0.5, 1.0);
}`;

// ─── Overlay: specular highlights + caustics + surface shimmer ────────────────
// Premultiplied alpha.  Above waterLineGL: fully transparent.
// Surface band: exponential glow.
// Below: depth tint + specular + caustics.

export const OVERLAY_FRAG = /* glsl */`
uniform sampler2D tSim;
uniform vec2  texelSize;
uniform float waterLineGL;       // OpenGL UV of surface (= 1.0 - waterLevelUV)
uniform float surfaceBandGL;     // width in UV of the shimmer band
uniform vec3  lightDir;          // normalized light direction
uniform vec3  lightColor;        // RGB
uniform float specularIntensity;
uniform float glowIntensity;
uniform vec3  tintColor;         // water depth tint
uniform float tintOpacity;       // base alpha for tint layer
uniform float edgeHighlight;     // 0–1 rim-light strength
varying vec2 vUv;

void main() {
  // Above water — invisible
  if (vUv.y > waterLineGL) {
    gl_FragColor = vec4(0.0);
    return;
  }

  float hL = texture2D(tSim, vUv - vec2(texelSize.x, 0.0)).r;
  float hR = texture2D(tSim, vUv + vec2(texelSize.x, 0.0)).r;
  float hU = texture2D(tSim, vUv + vec2(0.0, texelSize.y)).r;
  float hD = texture2D(tSim, vUv - vec2(0.0, texelSize.y)).r;

  vec3  normal  = normalize(vec3((hL - hR) * 7.0, (hD - hU) * 7.0, 1.0));
  vec3  V       = vec3(0.0, 0.0, 1.0);
  vec3  L       = lightDir;
  vec3  H       = normalize(L + V);
  float ndotH   = max(dot(normal, H), 0.0);
  float spec    = pow(ndotH, 140.0) * specularIntensity;
  float fresnel = pow(1.0 - max(dot(normal, V), 0.0), 4.0);
  float h       = texture2D(tSim, vUv).r;
  float activity = abs(h);

  // Surface band glow
  float surfDist = waterLineGL - vUv.y;
  float surfGlow = (surfaceBandGL > 0.0)
    ? exp(-surfDist / max(surfaceBandGL, 0.0001)) * glowIntensity
    : 0.0;

  // Depth gradient (stronger towards bottom)
  float depth = 1.0 - vUv.y / max(waterLineGL, 0.001);
  float depthAlpha = tintOpacity * (0.6 + 0.4 * depth);

  vec3  color = tintColor * depthAlpha;
  float alpha = depthAlpha;

  color += lightColor * spec;
  color += lightColor * max(0.0, h * 7.0) * 0.18; // caustics
  color += lightColor * fresnel * activity * (0.3 + edgeHighlight * 0.7);
  alpha  = clamp(alpha + spec * 2.2 + max(0.0, h * 7.0) * 0.4 + fresnel * activity * 0.35, 0.0, 0.92);

  // Surface shimmer on top
  color += vec3(0.5, 0.82, 1.0) * surfGlow;
  alpha  = max(alpha, surfGlow * 0.75);

  gl_FragColor = vec4(color * alpha, alpha); // premultiplied
}`;
