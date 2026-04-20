import {
  forwardRef, useEffect, useId, useImperativeHandle, useRef,
  type ReactNode,
} from 'react';
import * as THREE from 'three';

// ─── Public API ───────────────────────────────────────────────────────────────

export interface WaterHandle {
  /**
   * Spawns an interactive splash at (x, y). Used internally for mouse/touch;
   * also available for programmatic impulses.
   */
  trigger: (x?: number, y?: number, strength?: number) => void;

  /**
   * Page-transition effect: soft single drop → distortion peak → onPeak callback
   * → distortion recedes. Use to swap content without a browser route change.
   *
   * @param onPeak  Called at peak distortion — change your page/content state here.
   * @param x       Screen X of the drop origin (defaults to viewport center).
   * @param y       Screen Y of the drop origin (defaults to viewport center).
   */
  transition: (onPeak: () => void, x?: number, y?: number) => void;
}

export interface WaterRippleV3Props {
  simResolution?: number;
  /**
   * When true: canvas becomes a transparent overlay and an SVG feDisplacementMap
   * distorts the HTML children below using the live water normals.
   * When false (default): canvas is the opaque background (ocean-floor scene).
   */
  distortBelow?: boolean;
  children?: ReactNode;
}

// ─── Shared vertex ────────────────────────────────────────────────────────────

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
// r = current height, g = previous height

const SIM_FRAG = /* glsl */`
uniform sampler2D tSim;
uniform vec2  texelSize;
uniform float aspectRatio;
uniform vec2  splashPos;
uniform float splashStrength;
uniform float splashRadius;
uniform vec2  triggerPos;    // UV position of event trigger (-10,-10 when inactive)
uniform float triggerStr;    // strength of event trigger (0 when inactive)
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

  // Mouse/touch splash
  vec2 sd = (vUv - splashPos) * vec2(1.0, 1.0 / aspectRatio);
  hNew = clamp(hNew + splashStrength * max(0.0, 1.0 - length(sd) / splashRadius), -1.0, 1.0);

  // Event trigger — Gaussian point source, high strength
  vec2 td = (vUv - triggerPos) * vec2(1.0, 1.0 / aspectRatio);
  hNew = clamp(hNew + triggerStr * exp(-dot(td, td) * 160.0), -1.0, 1.0);

  gl_FragColor = vec4(hNew, hCurr, 0.0, 1.0);
}`;

// ─── Display: background mode (opaque, refracts ocean floor) ─────────────────

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

// ─── Display: overlay mode (transparent canvas, only specular + caustics) ─────

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
  gl_FragColor = vec4(color * alpha, alpha); // premultiplied
}`;

// ─── Displacement map: encodes surface normals as RG for SVG feDisplacementMap ─

const DISP_FRAG = /* glsl */`
uniform sampler2D tSim;
uniform vec2 texelSize;
varying vec2 vUv;
void main() {
  // Flip Y: OpenGL UV (bottom-up) → SVG/CSS coordinate space (top-down)
  vec2 uv = vec2(vUv.x, 1.0 - vUv.y);
  float hL = texture2D(tSim, uv - vec2(texelSize.x, 0.0)).r;
  float hR = texture2D(tSim, uv + vec2(texelSize.x, 0.0)).r;
  float hU = texture2D(tSim, uv + vec2(0.0, texelSize.y)).r;
  float hD = texture2D(tSim, uv - vec2(0.0, texelSize.y)).r;
  vec3 normal = normalize(vec3((hL - hR) * 6.0, (hD - hU) * 6.0, 1.0));
  // feDisplacementMap: R controls X offset, G controls Y offset.
  // 0.5 = no displacement, 0 = negative, 1 = positive.
  gl_FragColor = vec4(normal.x * 0.5 + 0.5, normal.y * 0.5 + 0.5, 0.5, 1.0);
}`;

// ─────────────────────────────────────────────────────────────────────────────

const DISP_RES = 128; // displacement map readback resolution

interface TriggerItem {
  x: number; y: number;
  strength: number;
  framesLeft: number;
}

export const WaterRippleV3 = forwardRef<WaterHandle, WaterRippleV3Props>(
  function WaterRippleV3({ simResolution = 512, distortBelow = false, children }, ref) {
    const canvasRef    = useRef<HTMLCanvasElement>(null);
    const dispCanvasRef = useRef<HTMLCanvasElement>(null);
    const filterRef    = useRef<SVGFilterElement>(null);
    const feImgNodeRef = useRef<SVGFEImageElement>(null);
    const feDispRef    = useRef<SVGFEDisplacementMapElement>(null);
    const triggerQueue = useRef<TriggerItem[]>([]);

    const rawId  = useId();
    const uid    = rawId.replace(/:/g, '');
    const filterId = `wv3-${uid}`;

    // ── Imperative API ────────────────────────────────────────────────────────
    useImperativeHandle(ref, () => ({
      trigger(
        x = window.innerWidth  / 2,
        y = window.innerHeight / 2,
        strength = 4.0,
      ) {
        triggerQueue.current.push({
          x: x / window.innerWidth,
          y: 1 - y / window.innerHeight,
          strength,
          framesLeft: 5,
        });
      },

      transition(
        onPeak: () => void,
        x = window.innerWidth  / 2,
        y = window.innerHeight / 2,
      ) {
        // Soft single drop — low strength, sustained so concentric rings form naturally
        triggerQueue.current.push({
          x: x / window.innerWidth,
          y: 1 - y / window.innerHeight,
          strength: 1.3,
          framesLeft: 10,
        });

        const dispEl = feDispRef.current;
        const BASE   = 30;
        const PEAK   = 110;
        const HALF   = 750; // ms per phase
        const ease   = (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
        const t0     = performance.now();
        let peaked   = false;

        const tick = (now: number) => {
          const progress = (now - t0) / HALF; // 0 → 2 over full duration

          if (progress <= 1) {
            // Rise: distortion builds
            const s = BASE + (PEAK - BASE) * ease(progress);
            dispEl?.setAttribute('scale', s.toFixed(1));
          } else {
            // Peak fires once, then distortion recedes
            if (!peaked) { peaked = true; onPeak(); }
            const s = PEAK - (PEAK - BASE) * ease(progress - 1);
            dispEl?.setAttribute('scale', Math.max(BASE, s).toFixed(1));
          }

          if (progress < 2) {
            requestAnimationFrame(tick);
          } else {
            dispEl?.setAttribute('scale', String(BASE));
          }
        };

        requestAnimationFrame(tick);
      },
    }), [distortBelow]);

    // ── Three.js setup ─────────────────────────────────────────────────────
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: false,
        alpha: distortBelow,
      });
      renderer.setPixelRatio(1);
      renderer.setSize(window.innerWidth, window.innerHeight);

      const W  = window.innerWidth;
      const H  = window.innerHeight;
      const AR = W / H;
      const simRes    = simResolution;
      const texelSize = new THREE.Vector2(1 / simRes, 1 / simRes);

      const simOpts = {
        minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
        format: THREE.RGBAFormat, type: THREE.HalfFloatType,
      } as const;

      let rtA = new THREE.WebGLRenderTarget(simRes, simRes, simOpts);
      let rtB = new THREE.WebGLRenderTarget(simRes, simRes, simOpts);

      // Background RT (background mode only — opaque, 8-bit fine)
      const bgRT = distortBelow ? null : new THREE.WebGLRenderTarget(W, H, {
        minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
        format: THREE.RGBAFormat, type: THREE.UnsignedByteType,
      });

      // Displacement map RT (distortBelow mode — UnsignedByte for CPU readback)
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

      // 2D canvas for displacement map (distortBelow mode)
      let dispCtx: CanvasRenderingContext2D | null = null;
      if (distortBelow && dispCanvasRef.current) {
        dispCtx = dispCanvasRef.current.getContext('2d');
      }

      // Update SVG filter dimensions on mount
      const setFilterSize = () => {
        const fEl = filterRef.current;
        const iEl = feImgNodeRef.current;
        if (!fEl || !iEl) return;
        const w = window.innerWidth;
        const h = window.innerHeight;
        fEl.setAttribute('width',  String(w));
        fEl.setAttribute('height', String(h));
        iEl.setAttribute('width',  String(w));
        iEl.setAttribute('height', String(h));
      };
      if (distortBelow) setFilterSize();

      // ── Input ─────────────────────────────────────────────────────────
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

      const onDown  = (e: MouseEvent)  => { mouseDown = true;  queueSplash(e.clientX, e.clientY); };
      const onUp    = ()               => { mouseDown = false; };
      const onMove  = (e: MouseEvent)  => {
        if (!mouseDown) return;
        const now = performance.now();
        if (now - lastSplash < 22) return;
        lastSplash = now; queueSplash(e.clientX, e.clientY);
      };
      const onTouchStart = (e: TouchEvent) => {
        mouseDown = true; queueSplash(e.touches[0].clientX, e.touches[0].clientY);
      };
      const onTouchEnd  = () => { mouseDown = false; };
      const onTouchMove = (e: TouchEvent) => {
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

      // ── Render loop ───────────────────────────────────────────────────
      let rafId: number;
      let frameCount = 0;
      const t0 = performance.now();

      const animate = () => {
        const elapsed = (performance.now() - t0) / 1000;
        frameCount++;

        // Pass 1: background → bgRT (background mode only)
        if (!distortBelow && bgRT) {
          quad.material = bgMat;
          bgMat.uniforms.time.value = elapsed;
          renderer.setRenderTarget(bgRT);
          renderer.render(scene, cam);
        }

        // Pass 2: wave simulation → rtB (reads rtA)
        quad.material = simMat;
        simMat.uniforms.tSim.value = rtA.texture;

        // Mouse/touch splash
        if (splashNext) {
          simMat.uniforms.splashPos.value.copy(mouseUV);
          simMat.uniforms.splashStrength.value = 0.9;
          splashNext = false;
        } else {
          simMat.uniforms.splashStrength.value = 0;
        }

        // Event trigger from queue
        const tq = triggerQueue.current;
        if (tq.length > 0) {
          const t = tq[0];
          simMat.uniforms.triggerPos.value.set(t.x, t.y);
          simMat.uniforms.triggerStr.value = t.strength;
          t.framesLeft--;
          if (t.framesLeft <= 0) tq.shift();
        } else {
          simMat.uniforms.triggerPos.value.set(-10, -10);
          simMat.uniforms.triggerStr.value = 0;
        }

        renderer.setRenderTarget(rtB);
        renderer.render(scene, cam);
        const tmp = rtA; rtA = rtB; rtB = tmp;

        // Pass 3a: displacement map → dispRT (distortBelow mode, every 2 frames = 30fps)
        if (distortBelow && dispMat && dispRT && dispPixels && dispCtx && frameCount % 2 === 0) {
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
        quad.material = displayMat;
        displayMat.uniforms.tSim.value = rtA.texture;
        if (!distortBelow && bgRT) {
          (displayMat.uniforms as Record<string, THREE.IUniform>).tBackground.value = bgRT.texture;
        }
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
        rtA.dispose(); rtB.dispose();
        bgRT?.dispose(); dispRT?.dispose();
        geo.dispose(); bgMat.dispose(); simMat.dispose();
        displayMat.dispose(); dispMat?.dispose();
      };
    }, [simResolution, distortBelow]);

    // ── Render ────────────────────────────────────────────────────────────────
    const canvasStyle: React.CSSProperties = distortBelow
      ? { position: 'fixed', inset: 0, width: '100%', height: '100%', zIndex: 9999, pointerEvents: 'none', display: 'block' }
      : { position: 'fixed', inset: 0, width: '100%', height: '100%', zIndex: 0, display: 'block' };

    if (distortBelow) {
      return (
        <>
          {/* Content wrapper — SVG displacement filter applied here */}
          <div style={{ filter: `url(#${filterId})`, position: 'relative', zIndex: 1 }}>
            {children}
          </div>

          {/* Transparent WebGL overlay: only specular highlights + caustic glow */}
          <canvas ref={canvasRef} style={canvasStyle} />

          {/* SVG filter definition */}
          <svg
            width="0" height="0"
            style={{ position: 'fixed', top: 0, left: 0, overflow: 'hidden', pointerEvents: 'none' }}
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

          {/* Hidden 2D canvas — displacement map source updated each frame */}
          <canvas
            ref={dispCanvasRef}
            width={DISP_RES}
            height={DISP_RES}
            style={{ display: 'none' }}
          />
        </>
      );
    }

    return (
      <>
        <canvas ref={canvasRef} style={canvasStyle} />
        {children}
      </>
    );
  },
);
