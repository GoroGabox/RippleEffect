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
// Pantalla completa — sin división de eje Y.
// Encodes surface normals como RG para SVG feDisplacementMap.

export const DISP_FRAG = /* glsl */`
uniform sampler2D tSim;
uniform vec2  texelSize;
uniform float distortionMult;
varying vec2 vUv;

void main() {
  // Flip Y: OpenGL UV (0=bottom) → CSS space (0=top)
  vec2 uv = vec2(vUv.x, 1.0 - vUv.y);

  float hL = texture2D(tSim, uv - vec2(texelSize.x, 0.0)).r;
  float hR = texture2D(tSim, uv + vec2(texelSize.x, 0.0)).r;
  float hU = texture2D(tSim, uv + vec2(0.0, texelSize.y)).r;
  float hD = texture2D(tSim, uv - vec2(0.0, texelSize.y)).r;

  vec3 normal = normalize(vec3((hL - hR) * 6.0 * distortionMult,
                               (hD - hU) * 6.0 * distortionMult, 1.0));
  // R = X offset, G = Y offset; 0.5 = sin desplazamiento
  gl_FragColor = vec4(normal.x * 0.5 + 0.5, normal.y * 0.5 + 0.5, 0.5, 1.0);
}`;

// ─── Overlay: caústicas + especular + gradiente de luz vertical ───────────────
//
// Modelo Z-axis:
//   vUv.y = 1 (arriba)  → cerca de la superficie → más luz, caústicas fuertes
//   vUv.y = 0 (abajo)   → fondo / más profundo   → menos luz, caústicas tenues
//
// El canvas es transparente (premultiplied alpha) y se superpone sobre el
// contenido HTML filtrado. El oscurecimiento per-elemento lo aplica WaterItem
// en CSS (depth prop), no este shader.

export const OVERLAY_FRAG = /* glsl */`
uniform sampler2D tSim;
uniform vec2  texelSize;
uniform vec3  lightDir;
uniform vec3  lightColor;
uniform float specularIntensity;
uniform float glowIntensity;
uniform float depthScale;      // escala global de profundidad 0–1
varying vec2 vUv;

void main() {
  float hL = texture2D(tSim, vUv - vec2(texelSize.x, 0.0)).r;
  float hR = texture2D(tSim, vUv + vec2(texelSize.x, 0.0)).r;
  float hU = texture2D(tSim, vUv + vec2(0.0, texelSize.y)).r;
  float hD = texture2D(tSim, vUv - vec2(0.0, texelSize.y)).r;

  vec3  normal   = normalize(vec3((hL - hR) * 7.0, (hD - hU) * 7.0, 1.0));
  vec3  V        = vec3(0.0, 0.0, 1.0);
  vec3  H        = normalize(lightDir + V);
  float spec     = pow(max(dot(normal, H), 0.0), 140.0) * specularIntensity;
  float fresnel  = pow(1.0 - max(dot(normal, V), 0.0), 4.0);
  float h        = texture2D(tSim, vUv).r;
  float activity = abs(h);

  // Atenuación vertical: la luz viene de arriba (vUv.y=1=superficie).
  // Con depthScale=0 no hay atenuación; depthScale=1 atenúa 80% en el fondo.
  float vertAtten = 1.0 - (1.0 - vUv.y) * depthScale * 0.80;
  vertAtten = clamp(vertAtten, 0.0, 1.0);

  // Shimmer / glow de superficie: más intenso en la parte superior
  float surfGlow = glowIntensity * vUv.y * max(0.0, h * 4.0 + activity * 2.0);

  vec3  color = vec3(0.0);
  float alpha = 0.0;

  // Especular
  color += lightColor * spec * vertAtten;
  // Caústicas (ondas positivas dispersan luz)
  color += lightColor * max(0.0, h * 6.0) * 0.20 * vertAtten;
  // Fresnel / rim
  color += lightColor * fresnel * activity * 0.30 * vertAtten;
  // Shimmer de superficie
  color += vec3(0.55, 0.85, 1.0) * surfGlow;

  alpha = clamp(
    spec * 2.5 * vertAtten
    + max(0.0, h * 6.0) * 0.40 * vertAtten
    + fresnel * activity * 0.30 * vertAtten
    + surfGlow * 0.70,
    0.0, 0.92
  );

  gl_FragColor = vec4(color * alpha, alpha); // premultiplied
}`;
