import {
  forwardRef, useEffect, useId, useImperativeHandle, useRef,
  type ReactNode,
} from 'react';
import * as THREE from 'three';

// ─── Public API ───────────────────────────────────────────────────────────────

export type TransitionType = 'deepwave' | 'surface' | 'raindrop';

export interface WaterHandle {
  /**
   * Page-transition effect: captures prev/post DOM screenshots and morphs
   * between them using live water physics. Content swaps at peak distortion.
   *
   * @param onPeak  Called at peak distortion — change your page/content state here.
   * @param x       Screen X of the drop origin (defaults to viewport center).
   * @param y       Screen Y of the drop origin (defaults to viewport center).
   */
  transition: (onPeak: () => void, x?: number, y?: number) => void;
}

export interface WaterRippleV4Props {
  simResolution?: number;
  /**
   * When true: canvas becomes a transparent overlay and an SVG feDisplacementMap
   * distorts the HTML children below using the live water normals.
   * When false (default): canvas is the opaque background (ocean-floor scene).
   */
  distortBelow?: boolean;
  /**
   * Simulation pattern used during page transitions.
   * - 'deepwave'  Single strong Gaussian drop  (1 400 ms)
   * - 'surface'   Ring of 8 interfering drops  (1 200 ms)
   * - 'raindrop'  30 random drops over 600 ms  (1 800 ms)
   */
  transitionType?: TransitionType;
  children?: ReactNode;
}

// ─── Vertex (shared) ──────────────────────────────────────────────────────────

const VERT = /* glsl */`
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

// ─── Ocean floor background (background mode only) ────────────────────────────

const BG_FRAG = /* glsl */`
uniform float time;
varying vec2 vUv;
void main() {
  vec2 uv = vUv;
  float vig = clamp(1.0 - length(uv - 0.5) * 1.6, 0.0, 1.0);
  vec3 c = mix(vec3(0.003, 0.012, 0.05), vec3(0.012, 0.055, 0.18), vig * 0.85);
  float t = time * 0.22;
  float ca = sin(uv.x * 22.0 + t) * sin(uv.y * 26.0 + t * 0.85);
  float cb = sin((uv.x - uv.y) * 18.0 - t * 0.75) * sin((uv.x + uv.y) * 20.0 + t * 1.1);
  c += vec3(0.04, 0.22, 0.65) * smoothstep(0.3, 1.0, max(ca, cb)) * 0.14 * vig;
  float gx = step(0.95, fract(uv.x * 52.0));
  float gy = step(0.95, fract(uv.y * 52.0));
  c += vec3(0.05, 0.2, 0.5) * max(gx, gy) * 0.14;
  gl_FragColor = vec4(c, 1.0);
}`;

// ─── Wave simulation (ping-pong) ──────────────────────────────────────────────

const SIM_FRAG = /* glsl */`
uniform sampler2D tSim;
uniform vec2  texelSize;
uniform float aspectRatio;
uniform vec2  splashPos;
uniform float splashStrength;
uniform float splashRadius;
uniform vec2  triggerPos;
uniform float triggerStr;
varying vec2 vUv;

void main() {
  vec4  data  = texture2D(tSim, vUv);
  float hCurr = data.r;
  float hPrev = data.g;

  vec2 ts = texelSize * vec2(1.0, aspectRatio);
  float hL = texture2D(tSim, vUv - vec2(ts.x, 0.0)).r;
  float hR = texture2D(tSim, vUv + vec2(ts.x, 0.0)).r;
  float hU = texture2D(tSim, vUv + vec2(0.0,  ts.y)).r;
  float hD = texture2D(tSim, vUv - vec2(0.0,  ts.y)).r;

  float hNew = (hL + hR + hU + hD) * 0.5 - hPrev;
  hNew *= 0.984;

  vec2 sd = (vUv - splashPos) * vec2(1.0, 1.0 / aspectRatio);
  hNew = clamp(hNew + splashStrength * max(0.0, 1.0 - length(sd) / splashRadius), -1.0, 1.0);

  vec2 td = (vUv - triggerPos) * vec2(1.0, 1.0 / aspectRatio);
  hNew = clamp(hNew + triggerStr * exp(-dot(td, td) * 160.0), -1.0, 1.0);

  gl_FragColor = vec4(hNew, hCurr, 0.0, 1.0);
}`;

// ─── Display: background mode ─────────────────────────────────────────────────

const DISPLAY_FRAG = /* glsl */`
uniform sampler2D tSim;
uniform sampler2D tBackground;
uniform vec2 texelSize;
varying vec2 vUv;
void main() {
  float hL = texture2D(tSim, vUv - vec2(texelSize.x, 0.0)).r;
  float hR = texture2D(tSim, vUv + vec2(texelSize.x, 0.0)).r;
  float hU = texture2D(tSim, vUv + vec2(0.0, texelSize.y)).r;
  float hD = texture2D(tSim, vUv - vec2(0.0, texelSize.y)).r;
  vec3 normal = normalize(vec3((hL - hR) * 7.0, (hD - hU) * 7.0, 1.0));
  vec2 distUV = clamp(vUv + normal.xy * 0.055, 0.001, 0.999);
  vec3 bg = texture2D(tBackground, distUV).rgb;
  vec3 L = normalize(vec3(0.35, 0.55, 1.0));
  vec3 V = vec3(0.0, 0.0, 1.0);
  float spec = pow(max(dot(normal, normalize(L + V)), 0.0), 140.0) * 3.5;
  float fresnel = pow(1.0 - dot(normal, V), 4.0);
  float h = texture2D(tSim, vUv).r;
  vec3 color = bg;
  color = mix(color, vec3(0.006, 0.04, 0.15), fresnel * 0.45);
  color += vec3(0.65, 0.88, 1.0) * spec;
  color += vec3(0.22, 0.52, 0.95) * max(0.0, h * 7.0) * 0.2;
  gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
}`;

// ─── Display: overlay mode (transparent, specular + caustics only) ────────────

const OVERLAY_FRAG = /* glsl */`
uniform sampler2D tSim;
uniform vec2 texelSize;
varying vec2 vUv;
void main() {
  float hL = texture2D(tSim, vUv - vec2(texelSize.x, 0.0)).r;
  float hR = texture2D(tSim, vUv + vec2(texelSize.x, 0.0)).r;
  float hU = texture2D(tSim, vUv + vec2(0.0, texelSize.y)).r;
  float hD = texture2D(tSim, vUv - vec2(0.0, texelSize.y)).r;
  vec3 normal = normalize(vec3((hL - hR) * 7.0, (hD - hU) * 7.0, 1.0));
  vec3 L = normalize(vec3(0.35, 0.55, 1.0));
  vec3 V = vec3(0.0, 0.0, 1.0);
  float spec = pow(max(dot(normal, normalize(L + V)), 0.0), 140.0) * 3.5;
  float fresnel = pow(1.0 - dot(normal, V), 4.0);
  float h = texture2D(tSim, vUv).r;
  float activity = abs(h);
  vec3 color = vec3(0.65, 0.88, 1.0) * spec;
  color += vec3(0.22, 0.52, 0.95) * max(0.0, h * 7.0) * 0.25;
  color += vec3(0.4, 0.7, 1.0) * fresnel * activity * 0.4;
  float alpha = clamp(spec * 2.5 + max(0.0, h * 7.0) * 0.45 + fresnel * activity * 0.4, 0.0, 0.92);
  gl_FragColor = vec4(color * alpha, alpha);
}`;

// ─── Displacement map for SVG feDisplacementMap ───────────────────────────────

const DISP_FRAG = /* glsl */`
uniform sampler2D tSim;
uniform vec2 texelSize;
varying vec2 vUv;
void main() {
  vec2 uv = vec2(vUv.x, 1.0 - vUv.y);
  float hL = texture2D(tSim, uv - vec2(texelSize.x, 0.0)).r;
  float hR = texture2D(tSim, uv + vec2(texelSize.x, 0.0)).r;
  float hU = texture2D(tSim, uv + vec2(0.0, texelSize.y)).r;
  float hD = texture2D(tSim, uv - vec2(0.0, texelSize.y)).r;
  vec3 normal = normalize(vec3((hL - hR) * 6.0, (hD - hU) * 6.0, 1.0));
  gl_FragColor = vec4(normal.x * 0.5 + 0.5, normal.y * 0.5 + 0.5, 0.5, 1.0);
}`;

// ─── Transition shader: morphs prev→post screenshots via water physics ─────────

const TRANSITION_FRAG = /* glsl */`
uniform sampler2D tPrev;
uniform sampler2D tPost;
uniform sampler2D tSim;
uniform vec2  texelSize;
uniform float progress;
varying vec2 vUv;

void main() {
  float hL = texture2D(tSim, vUv - vec2(texelSize.x, 0.0)).r;
  float hR = texture2D(tSim, vUv + vec2(texelSize.x, 0.0)).r;
  float hU = texture2D(tSim, vUv + vec2(0.0, texelSize.y)).r;
  float hD = texture2D(tSim, vUv - vec2(0.0, texelSize.y)).r;
  vec3 normal = normalize(vec3((hL - hR) * 7.0, (hD - hU) * 7.0, 1.0));

  // Distortion peaks at midpoint of transition, zero at start and end
  float distAmp = sin(progress * 3.14159) * 0.065;
  vec2 distUV = clamp(vUv + normal.xy * distAmp, 0.001, 0.999);

  vec3 prevColor = texture2D(tPrev, distUV).rgb;
  vec3 postColor = texture2D(tPost, distUV).rgb;

  // Soft cross-fade in the second half of the transition
  float blend = smoothstep(0.38, 0.65, progress);
  vec3 color = mix(prevColor, postColor, blend);

  // Specular highlight visible only during transition
  vec3 L = normalize(vec3(0.35, 0.55, 1.0));
  vec3 V = vec3(0.0, 0.0, 1.0);
  float spec = pow(max(dot(normal, normalize(L + V)), 0.0), 140.0) * 3.5;
  color += vec3(0.65, 0.88, 1.0) * spec * sin(progress * 3.14159);

  // Caustic crest glow
  float h = texture2D(tSim, vUv).r;
  color += vec3(0.22, 0.52, 0.95) * max(0.0, h * 7.0) * 0.2 * sin(progress * 3.14159);

  gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
}`;

// ─────────────────────────────────────────────────────────────────────────────

const DISP_RES = 128;

interface TriggerItem {
  x: number; y: number;
  strength: number;
  framesLeft: number;
}

async function captureScreen(ignoreEl: HTMLElement): Promise<THREE.CanvasTexture> {
  const { default: html2canvas } = await import('html2canvas');
  const snap = await html2canvas(document.body, {
    useCORS: true,
    scale: 1,
    logging: false,
    ignoreElements: (el) => el === ignoreEl || el.hasAttribute('data-ripple-ignore'),
  });
  const tex = new THREE.CanvasTexture(snap);
  tex.needsUpdate = true;
  return tex;
}

function waitFrames(n: number): Promise<void> {
  return new Promise(resolve => {
    let count = 0;
    const tick = () => { if (++count >= n) resolve(); else requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });
}

// ─────────────────────────────────────────────────────────────────────────────

export const WaterRippleV4 = forwardRef<WaterHandle, WaterRippleV4Props>(
  function WaterRippleV4(
    { simResolution = 512, distortBelow = false, transitionType = 'surface', children },
    ref,
  ) {
    const canvasRef      = useRef<HTMLCanvasElement>(null);
    const dispCanvasRef  = useRef<HTMLCanvasElement>(null);
    const filterRef      = useRef<SVGFilterElement>(null);
    const feImgNodeRef   = useRef<SVGFEImageElement>(null);
    const feDispRef      = useRef<SVGFEDisplacementMapElement>(null);
    const contentRef     = useRef<HTMLDivElement>(null);

    const triggerQueue   = useRef<TriggerItem[]>([]);
    const rainTimeouts   = useRef<ReturnType<typeof setTimeout>[]>([]);

    // Transition state — all refs so RAF loop reads latest without re-render
    const txActive    = useRef(false);
    const txStart     = useRef(0);
    const txDuration  = useRef(1200);
    const prevTexRef  = useRef<THREE.CanvasTexture | null>(null);
    const postTexRef  = useRef<THREE.CanvasTexture | null>(null);
    const txTypeRef   = useRef<TransitionType>(transitionType);

    // Keep txTypeRef in sync with prop
    useEffect(() => { txTypeRef.current = transitionType; }, [transitionType]);

    const rawId   = useId();
    const uid     = rawId.replace(/:/g, '');
    const filterId = `wv4-${uid}`;

    // ── Imperative API ─────────────────────────────────────────────────────────
    useImperativeHandle(ref, () => ({
      transition(onPeak, x = window.innerWidth / 2, y = window.innerHeight / 2) {
        if (txActive.current) return;

        const type = txTypeRef.current;
        const HALF = type === 'deepwave' ? 700 : type === 'surface' ? 600 : 900;
        const FULL = HALF * 2;

        const uvX = x / window.innerWidth;
        const uvY = 1 - y / window.innerHeight;

        const firePattern = () => {
          if (type === 'deepwave') {
            triggerQueue.current.push({ x: uvX, y: uvY, strength: 3.5, framesLeft: 4 });
          } else if (type === 'surface') {
            for (let i = 0; i < 8; i++) {
              const angle = (i / 8) * Math.PI * 2;
              const ring  = 0.1;
              triggerQueue.current.push({
                x: Math.max(0.01, Math.min(0.99, uvX + Math.cos(angle) * ring)),
                y: Math.max(0.01, Math.min(0.99, uvY + Math.sin(angle) * ring)),
                strength: 1.2,
                framesLeft: 2,
              });
            }
          } else {
            for (let i = 0; i < 30; i++) {
              const delay = Math.random() * 600;
              const rx    = Math.random();
              const ry    = Math.random();
              const str   = 0.2 + Math.random() * 0.3;
              const tid   = setTimeout(() => {
                triggerQueue.current.push({ x: rx, y: ry, strength: str, framesLeft: 2 });
              }, delay);
              rainTimeouts.current.push(tid);
            }
          }
        };

        const cvs = canvasRef.current;
        if (!cvs) return;

        void (async () => {
          // 1. Capture before state
          const prevTex = await captureScreen(cvs);
          prevTexRef.current = prevTex;
          postTexRef.current = prevTex; // fallback until post ready

          // 2. Start simulation pattern + activate transition
          firePattern();
          txActive.current   = true;
          txStart.current    = performance.now();
          txDuration.current = FULL;

          // 3. Hide HTML content (canvas takes over visually)
          if (contentRef.current) contentRef.current.style.visibility = 'hidden';

          // 4. Wait for peak, then swap content
          await new Promise<void>(r => setTimeout(r, HALF));
          onPeak();

          // 5. Wait for React to re-render + paint, then capture after state
          await waitFrames(3);
          if (!cvs) return;
          const postTex = await captureScreen(cvs);
          postTexRef.current = postTex;

          // 6. Wait for remainder of transition
          const elapsed   = performance.now() - txStart.current;
          const remaining = Math.max(0, FULL - elapsed);
          await new Promise<void>(r => setTimeout(r, remaining));

          // 7. Restore
          txActive.current = false;
          if (contentRef.current) contentRef.current.style.visibility = 'visible';
          prevTex.dispose();
          if (postTex !== prevTex) postTex.dispose();
          prevTexRef.current = null;
          postTexRef.current = null;
        })();
      },
    }), []);

    // ── Three.js setup ─────────────────────────────────────────────────────────
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: false,
        alpha: distortBelow,
        premultipliedAlpha: distortBelow,
      });
      renderer.setPixelRatio(1);
      renderer.setSize(window.innerWidth, window.innerHeight);

      const W  = window.innerWidth;
      const H  = window.innerHeight;
      const AR = W / H;
      const texelSize = new THREE.Vector2(1 / simResolution, 1 / simResolution);

      const simOpts = {
        minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
        format: THREE.RGBAFormat, type: THREE.HalfFloatType,
      } as const;

      let rtA = new THREE.WebGLRenderTarget(simResolution, simResolution, simOpts);
      let rtB = new THREE.WebGLRenderTarget(simResolution, simResolution, simOpts);

      const bgRT = distortBelow ? null : new THREE.WebGLRenderTarget(W, H, {
        minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
        format: THREE.RGBAFormat, type: THREE.UnsignedByteType,
      });

      const dispRT = distortBelow ? new THREE.WebGLRenderTarget(DISP_RES, DISP_RES, {
        minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
        format: THREE.RGBAFormat, type: THREE.UnsignedByteType,
      }) : null;
      const dispPixels = distortBelow ? new Uint8Array(DISP_RES * DISP_RES * 4) : null;

      // Full-screen quad
      const geo   = new THREE.PlaneGeometry(2, 2);
      const cam   = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      const scene = new THREE.Scene();
      const quad  = new THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>(geo, null!);
      scene.add(quad);

      // Materials
      const bgMat = new THREE.ShaderMaterial({
        vertexShader: VERT, fragmentShader: BG_FRAG,
        uniforms: { time: { value: 0 } },
        depthTest: false, depthWrite: false,
      });

      const simMat = new THREE.ShaderMaterial({
        vertexShader: VERT, fragmentShader: SIM_FRAG,
        uniforms: {
          tSim:           { value: null },
          texelSize:      { value: texelSize },
          aspectRatio:    { value: AR },
          splashPos:      { value: new THREE.Vector2(-10, -10) },
          splashStrength: { value: 0 },
          splashRadius:   { value: 0.028 },
          triggerPos:     { value: new THREE.Vector2(-10, -10) },
          triggerStr:     { value: 0 },
        },
        depthTest: false, depthWrite: false,
      });

      const displayMat = new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: distortBelow ? OVERLAY_FRAG : DISPLAY_FRAG,
        uniforms: distortBelow
          ? { tSim: { value: null }, texelSize: { value: texelSize } }
          : { tSim: { value: null }, tBackground: { value: null }, texelSize: { value: texelSize } },
        transparent: distortBelow,
        depthTest: false, depthWrite: false,
      });

      const dispMat = distortBelow ? new THREE.ShaderMaterial({
        vertexShader: VERT, fragmentShader: DISP_FRAG,
        uniforms: { tSim: { value: null }, texelSize: { value: texelSize } },
        depthTest: false, depthWrite: false,
      }) : null;

      // Shared placeholder texture so TRANSITION_FRAG never gets null uniforms
      const placeholderTex = new THREE.DataTexture(
        new Uint8Array([20, 30, 50, 255]), 1, 1, THREE.RGBAFormat,
      );
      placeholderTex.needsUpdate = true;

      const transitionMat = new THREE.ShaderMaterial({
        vertexShader: VERT, fragmentShader: TRANSITION_FRAG,
        uniforms: {
          tPrev:    { value: placeholderTex },
          tPost:    { value: placeholderTex },
          tSim:     { value: null },
          texelSize:{ value: texelSize },
          progress: { value: 0 },
        },
        depthTest: false, depthWrite: false,
      });

      // Displacement 2D canvas
      let dispCtx: CanvasRenderingContext2D | null = null;
      if (distortBelow && dispCanvasRef.current) {
        dispCtx = dispCanvasRef.current.getContext('2d');
      }

      const setFilterSize = () => {
        const fEl = filterRef.current;
        const iEl = feImgNodeRef.current;
        if (!fEl || !iEl) return;
        fEl.setAttribute('width',  String(window.innerWidth));
        fEl.setAttribute('height', String(window.innerHeight));
        iEl.setAttribute('width',  String(window.innerWidth));
        iEl.setAttribute('height', String(window.innerHeight));
      };
      if (distortBelow) setFilterSize();

      // ── Input ────────────────────────────────────────────────────────────────
      let mouseDown  = false;
      let splashNext = false;
      let lastSplash = 0;
      const mouseUV  = new THREE.Vector2(-10, -10);

      const toUV = (x: number, y: number) => ({
        x: x / window.innerWidth,
        y: 1 - y / window.innerHeight,
      });
      const queueSplash = (x: number, y: number) => {
        const uv = toUV(x, y); mouseUV.set(uv.x, uv.y); splashNext = true;
      };

      const onDown       = (e: MouseEvent)  => { mouseDown = true;  queueSplash(e.clientX, e.clientY); };
      const onUp         = ()               => { mouseDown = false; };
      const onMove       = (e: MouseEvent)  => {
        if (!mouseDown) return;
        const now = performance.now();
        if (now - lastSplash < 22) return;
        lastSplash = now; queueSplash(e.clientX, e.clientY);
      };
      const onTouchStart = (e: TouchEvent)  => { mouseDown = true;  queueSplash(e.touches[0].clientX, e.touches[0].clientY); };
      const onTouchEnd   = ()               => { mouseDown = false; };
      const onTouchMove  = (e: TouchEvent)  => {
        if (!mouseDown) return;
        const now = performance.now();
        if (now - lastSplash < 22) return;
        lastSplash = now; queueSplash(e.touches[0].clientX, e.touches[0].clientY);
      };

      window.addEventListener('mousedown',  onDown);
      window.addEventListener('mouseup',    onUp);
      window.addEventListener('mousemove',  onMove);
      window.addEventListener('touchstart', onTouchStart, { passive: true });
      window.addEventListener('touchend',   onTouchEnd);
      window.addEventListener('touchmove',  onTouchMove,  { passive: true });

      const onResize = () => {
        renderer.setSize(window.innerWidth, window.innerHeight);
        bgRT?.setSize(window.innerWidth, window.innerHeight);
        simMat.uniforms.aspectRatio.value = window.innerWidth / window.innerHeight;
        if (distortBelow) setFilterSize();
      };
      window.addEventListener('resize', onResize);

      // ── Render loop ───────────────────────────────────────────────────────────
      let rafId: number;
      let frameCount = 0;
      const t0 = performance.now();

      const animate = () => {
        const elapsed = (performance.now() - t0) / 1000;
        frameCount++;

        // Pass 1: background → bgRT (background mode, idle only)
        if (!distortBelow && bgRT && !txActive.current) {
          quad.material = bgMat;
          bgMat.uniforms.time.value = elapsed;
          renderer.setRenderTarget(bgRT);
          renderer.render(scene, cam);
        }

        // Pass 2: wave simulation (always)
        quad.material = simMat;
        simMat.uniforms.tSim.value = rtA.texture;

        if (splashNext && !txActive.current) {
          simMat.uniforms.splashPos.value.copy(mouseUV);
          simMat.uniforms.splashStrength.value = 0.9;
          splashNext = false;
        } else {
          simMat.uniforms.splashStrength.value = 0;
        }

        const tq = triggerQueue.current;
        if (tq.length > 0) {
          const t = tq[0];
          simMat.uniforms.triggerPos.value.set(t.x, t.y);
          simMat.uniforms.triggerStr.value = t.strength;
          if (--t.framesLeft <= 0) tq.shift();
        } else {
          simMat.uniforms.triggerPos.value.set(-10, -10);
          simMat.uniforms.triggerStr.value = 0;
        }

        renderer.setRenderTarget(rtB);
        renderer.render(scene, cam);
        const tmp = rtA; rtA = rtB; rtB = tmp;

        // Pass 3a: displacement map (distortBelow, idle, every 2nd frame)
        if (distortBelow && dispMat && dispRT && dispPixels && dispCtx
            && !txActive.current && frameCount % 2 === 0) {
          quad.material = dispMat;
          dispMat.uniforms.tSim.value = rtA.texture;
          renderer.setRenderTarget(dispRT);
          renderer.render(scene, cam);

          renderer.readRenderTargetPixels(dispRT, 0, 0, DISP_RES, DISP_RES, dispPixels);
          const imgData = dispCtx.createImageData(DISP_RES, DISP_RES);
          imgData.data.set(dispPixels);
          dispCtx.putImageData(imgData, 0, 0);
          feImgNodeRef.current?.setAttributeNS(
            'http://www.w3.org/1999/xlink', 'href',
            dispCanvasRef.current!.toDataURL(),
          );
        }

        // Pass 3b: display → screen
        renderer.setRenderTarget(null);

        if (txActive.current) {
          // Transition: morph prev→post screenshots using water physics
          const progress = Math.min(
            (performance.now() - txStart.current) / txDuration.current,
            1.0,
          );
          quad.material = transitionMat;
          transitionMat.uniforms.tSim.value      = rtA.texture;
          transitionMat.uniforms.tPrev.value      = prevTexRef.current ?? placeholderTex;
          transitionMat.uniforms.tPost.value      = postTexRef.current ?? prevTexRef.current ?? placeholderTex;
          transitionMat.uniforms.progress.value   = progress;
        } else {
          quad.material = displayMat;
          displayMat.uniforms.tSim.value = rtA.texture;
          if (!distortBelow && bgRT) {
            (displayMat.uniforms as Record<string, THREE.IUniform>).tBackground.value = bgRT.texture;
          }
        }

        renderer.render(scene, cam);
        rafId = requestAnimationFrame(animate);
      };

      animate();

      return () => {
        cancelAnimationFrame(rafId);
        rainTimeouts.current.forEach(clearTimeout);
        rainTimeouts.current = [];
        window.removeEventListener('mousedown',  onDown);
        window.removeEventListener('mouseup',    onUp);
        window.removeEventListener('mousemove',  onMove);
        window.removeEventListener('touchstart', onTouchStart);
        window.removeEventListener('touchend',   onTouchEnd);
        window.removeEventListener('touchmove',  onTouchMove);
        window.removeEventListener('resize',     onResize);
        renderer.dispose();
        rtA.dispose(); rtB.dispose();
        bgRT?.dispose(); dispRT?.dispose();
        geo.dispose(); bgMat.dispose(); simMat.dispose();
        displayMat.dispose(); dispMat?.dispose(); transitionMat.dispose();
        placeholderTex.dispose();
      };
    }, [simResolution, distortBelow]);

    // ── Render ────────────────────────────────────────────────────────────────
    const canvasStyle: React.CSSProperties = distortBelow
      ? { position: 'fixed', inset: 0, width: '100%', height: '100%',
          zIndex: 9999, pointerEvents: 'none', display: 'block' }
      : { position: 'fixed', inset: 0, width: '100%', height: '100%',
          zIndex: 0, display: 'block' };

    if (distortBelow) {
      return (
        <>
          <div
            ref={contentRef}
            style={{ filter: `url(#${filterId})`, position: 'relative', zIndex: 1 }}
          >
            {children}
          </div>

          <canvas ref={canvasRef} style={canvasStyle} data-ripple-ignore />

          <svg
            width="0" height="0"
            style={{ position: 'fixed', top: 0, left: 0, overflow: 'hidden', pointerEvents: 'none' }}
            data-ripple-ignore
          >
            <defs>
              <filter
                ref={filterRef}
                id={filterId}
                x="0" y="0"
                width={window.innerWidth}
                height={window.innerHeight}
                filterUnits="userSpaceOnUse"
                colorInterpolationFilters="sRGB"
              >
                <feImage
                  ref={feImgNodeRef}
                  preserveAspectRatio="none"
                  result="dm"
                  x="0" y="0"
                  width={window.innerWidth}
                  height={window.innerHeight}
                />
                <feDisplacementMap
                  ref={feDispRef}
                  in="SourceGraphic" in2="dm"
                  scale="30"
                  xChannelSelector="R"
                  yChannelSelector="G"
                />
              </filter>
            </defs>
          </svg>

          <canvas
            ref={dispCanvasRef}
            width={DISP_RES}
            height={DISP_RES}
            style={{ display: 'none' }}
            data-ripple-ignore
          />
        </>
      );
    }

    return (
      <>
        <canvas ref={canvasRef} style={canvasStyle} data-ripple-ignore />
        <div ref={contentRef} style={{ position: 'relative', zIndex: 1 }}>
          {children}
        </div>
      </>
    );
  },
);
