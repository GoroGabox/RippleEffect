import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export interface WaterRippleV2Props {
  simResolution?: number;
}

// ─── Vertex (shared by all passes) ───────────────────────────────────────────
const VERT = /* glsl */`
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

// ─── Ocean floor background ───────────────────────────────────────────────────
const BG_FRAG = /* glsl */`
uniform float time;
varying vec2 vUv;

void main() {
  vec2 uv = vUv;
  float vig = 1.0 - length(uv - 0.5) * 1.6;
  vig = clamp(vig, 0.0, 1.0);

  vec3 deep   = vec3(0.003, 0.012, 0.05);
  vec3 shallow = vec3(0.012, 0.055, 0.18);
  vec3 c = mix(deep, shallow, vig * 0.85);

  // Animated caustic interference
  float t = time * 0.22;
  float ca = sin(uv.x * 22.0 + t) * sin(uv.y * 26.0 + t * 0.85);
  float cb = sin((uv.x - uv.y) * 18.0 - t * 0.75) * sin((uv.x + uv.y) * 20.0 + t * 1.1);
  float caustic = smoothstep(0.3, 1.0, max(ca, cb)) * 0.14;
  c += vec3(0.04, 0.22, 0.65) * caustic * vig;

  // Fine grid — distortion is very visible on it
  float gx = step(0.95, fract(uv.x * 52.0));
  float gy = step(0.95, fract(uv.y * 52.0));
  c += vec3(0.05, 0.2, 0.5) * max(gx, gy) * 0.14;

  gl_FragColor = vec4(c, 1.0);
}`;

// ─── Wave propagation (ping-pong) ─────────────────────────────────────────────
// Stores: r = current height, g = previous height
const SIM_FRAG = /* glsl */`
uniform sampler2D tSim;
uniform vec2 texelSize;
uniform float aspectRatio;
uniform vec2  splashPos;
uniform float splashStrength;
uniform float splashRadius;
varying vec2 vUv;

void main() {
  vec4  data  = texture2D(tSim, vUv);
  float hCurr = data.r;
  float hPrev = data.g;

  // Scale texel by aspect so wave speed is isotropic
  vec2 ts = texelSize * vec2(1.0, aspectRatio);

  float hL = texture2D(tSim, vUv - vec2(ts.x, 0.0)).r;
  float hR = texture2D(tSim, vUv + vec2(ts.x, 0.0)).r;
  float hU = texture2D(tSim, vUv + vec2(0.0,  ts.y)).r;
  float hD = texture2D(tSim, vUv - vec2(0.0,  ts.y)).r;

  // Discrete wave equation  h_new = (sum_neighbors)/2 - h_prev
  float hNew = (hL + hR + hU + hD) * 0.5 - hPrev;
  hNew *= 0.984; // damping

  // Add splash (aspect-corrected distance)
  vec2  d    = (vUv - splashPos) * vec2(1.0, 1.0 / aspectRatio);
  float dist = length(d);
  hNew = clamp(hNew + splashStrength * max(0.0, 1.0 - dist / splashRadius), -1.0, 1.0);

  gl_FragColor = vec4(hNew, hCurr, 0.0, 1.0);
}`;

// ─── Final display: refraction + specular + caustics ─────────────────────────
const DISPLAY_FRAG = /* glsl */`
uniform sampler2D tSim;
uniform sampler2D tBackground;
uniform vec2 texelSize;
varying vec2 vUv;

void main() {
  float hL = texture2D(tSim, vUv - vec2(texelSize.x, 0.0)).r;
  float hR = texture2D(tSim, vUv + vec2(texelSize.x, 0.0)).r;
  float hU = texture2D(tSim, vUv + vec2(0.0,  texelSize.y)).r;
  float hD = texture2D(tSim, vUv - vec2(0.0,  texelSize.y)).r;

  // Surface normal from height gradient
  vec3 normal = normalize(vec3((hL - hR) * 7.0, (hD - hU) * 7.0, 1.0));

  // Refraction: distort background UV along surface normal
  vec2 distUV = clamp(vUv + normal.xy * 0.055, 0.001, 0.999);
  vec3 bg = texture2D(tBackground, distUV).rgb;

  // Phong specular
  vec3 L = normalize(vec3(0.35, 0.55, 1.0));
  vec3 V = vec3(0.0, 0.0, 1.0);
  vec3 H = normalize(L + V);
  float spec = pow(max(dot(normal, H), 0.0), 140.0) * 3.5;

  // Fresnel rim
  float fresnel = pow(1.0 - dot(normal, V), 4.0);

  float h = texture2D(tSim, vUv).r;

  vec3 color = bg;
  color = mix(color, vec3(0.006, 0.04, 0.15), fresnel * 0.45); // water body
  color += vec3(0.65, 0.88, 1.0) * spec;                        // specular highlight
  color += vec3(0.22, 0.52, 0.95) * max(0.0, h * 7.0) * 0.2;   // crest caustic glow

  gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
}`;

// ─────────────────────────────────────────────────────────────────────────────

export function WaterRippleV2({ simResolution = 512 }: WaterRippleV2Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // ── Renderer ──────────────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
    renderer.setPixelRatio(1);
    renderer.setSize(window.innerWidth, window.innerHeight);

    const W  = window.innerWidth;
    const H  = window.innerHeight;
    const AR = W / H;
    const simRes   = simResolution;
    const texelSize = new THREE.Vector2(1 / simRes, 1 / simRes);

    const floatType = THREE.HalfFloatType;

    const simOpts = {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format:    THREE.RGBAFormat,
      type:      floatType,
    } as const;

    // Ping-pong simulation buffers
    let rtA = new THREE.WebGLRenderTarget(simRes, simRes, simOpts);
    let rtB = new THREE.WebGLRenderTarget(simRes, simRes, simOpts);

    // Background buffer (display resolution, 8-bit is fine)
    const bgRT = new THREE.WebGLRenderTarget(W, H, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format:    THREE.RGBAFormat,
      type:      THREE.UnsignedByteType,
    });

    // ── Full-screen quad setup ────────────────────────────────────────────────
    const geo   = new THREE.PlaneGeometry(2, 2);
    const cam   = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const scene = new THREE.Scene();
    const quad  = new THREE.Mesh(geo, null!);
    scene.add(quad);

    // ── Materials ─────────────────────────────────────────────────────────────
    const bgMat = new THREE.ShaderMaterial({
      vertexShader:   VERT,
      fragmentShader: BG_FRAG,
      uniforms: { time: { value: 0 } },
      depthTest: false, depthWrite: false,
    });

    const simMat = new THREE.ShaderMaterial({
      vertexShader:   VERT,
      fragmentShader: SIM_FRAG,
      uniforms: {
        tSim:           { value: null },
        texelSize:      { value: texelSize },
        aspectRatio:    { value: AR },
        splashPos:      { value: new THREE.Vector2(-10, -10) },
        splashStrength: { value: 0 },
        splashRadius:   { value: 0.028 },
      },
      depthTest: false, depthWrite: false,
    });

    const displayMat = new THREE.ShaderMaterial({
      vertexShader:   VERT,
      fragmentShader: DISPLAY_FRAG,
      uniforms: {
        tSim:       { value: null },
        tBackground:{ value: null },
        texelSize:  { value: texelSize },
      },
      depthTest: false, depthWrite: false,
    });

    // ── Input ─────────────────────────────────────────────────────────────────
    let mouseDown  = false;
    let splashNext = false;
    let lastSplash = 0;
    const mouseUV  = new THREE.Vector2(-10, -10);

    const toUV = (x: number, y: number) => ({
      x: x / window.innerWidth,
      y: 1 - y / window.innerHeight,
    });

    const queueSplash = (x: number, y: number) => {
      const uv = toUV(x, y);
      mouseUV.set(uv.x, uv.y);
      splashNext = true;
    };

    const onDown      = (e: MouseEvent)  => { mouseDown = true;  queueSplash(e.clientX, e.clientY); };
    const onUp        = ()               => { mouseDown = false; };
    const onMove      = (e: MouseEvent)  => {
      if (!mouseDown) return;
      const now = performance.now();
      if (now - lastSplash < 22) return;
      lastSplash = now;
      queueSplash(e.clientX, e.clientY);
    };
    const onTouchStart = (e: TouchEvent) => { mouseDown = true;  queueSplash(e.touches[0].clientX, e.touches[0].clientY); };
    const onTouchEnd   = ()              => { mouseDown = false; };
    const onTouchMove  = (e: TouchEvent) => {
      if (!mouseDown) return;
      const now = performance.now();
      if (now - lastSplash < 22) return;
      lastSplash = now;
      queueSplash(e.touches[0].clientX, e.touches[0].clientY);
    };

    window.addEventListener('mousedown',  onDown);
    window.addEventListener('mouseup',    onUp);
    window.addEventListener('mousemove',  onMove);
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchend',   onTouchEnd);
    window.addEventListener('touchmove',  onTouchMove,  { passive: true });

    const onResize = () => {
      renderer.setSize(window.innerWidth, window.innerHeight);
      bgRT.setSize(window.innerWidth, window.innerHeight);
      simMat.uniforms.aspectRatio.value = window.innerWidth / window.innerHeight;
    };
    window.addEventListener('resize', onResize);

    // ── Render loop ───────────────────────────────────────────────────────────
    let rafId: number;
    const t0 = performance.now();

    const animate = () => {
      const elapsed = (performance.now() - t0) / 1000;

      // Pass 1 — ocean floor background → bgRT
      (quad as any).material = bgMat;
      bgMat.uniforms.time.value = elapsed;
      renderer.setRenderTarget(bgRT);
      renderer.render(scene, cam);

      // Pass 2 — wave simulation → rtB (reads rtA)
      (quad as any).material = simMat;
      simMat.uniforms.tSim.value = rtA.texture;

      if (splashNext) {
        simMat.uniforms.splashPos.value.copy(mouseUV);
        simMat.uniforms.splashStrength.value = 0.95;
        splashNext = false;
      } else {
        simMat.uniforms.splashStrength.value = 0;
      }

      renderer.setRenderTarget(rtB);
      renderer.render(scene, cam);

      // Ping-pong swap
      const tmp = rtA; rtA = rtB; rtB = tmp;

      // Pass 3 — display: distort background by water normals → screen
      (quad as any).material = displayMat;
      displayMat.uniforms.tSim.value        = rtA.texture;
      displayMat.uniforms.tBackground.value = bgRT.texture;
      renderer.setRenderTarget(null);
      renderer.render(scene, cam);

      rafId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('mousedown',  onDown);
      window.removeEventListener('mouseup',    onUp);
      window.removeEventListener('mousemove',  onMove);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchend',   onTouchEnd);
      window.removeEventListener('touchmove',  onTouchMove);
      window.removeEventListener('resize',     onResize);
      renderer.dispose();
      rtA.dispose(); rtB.dispose(); bgRT.dispose();
      geo.dispose(); bgMat.dispose(); simMat.dispose(); displayMat.dispose();
    };
  }, [simResolution]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0, left: 0,
        width: '100%', height: '100%',
        zIndex: 0,
        display: 'block',
      }}
    />
  );
}
