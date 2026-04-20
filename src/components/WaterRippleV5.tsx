import {
  forwardRef, useEffect, useId, useImperativeHandle, useRef,
  type ReactNode,
} from 'react';
import * as THREE from 'three';

// ─── Public API ───────────────────────────────────────────────────────────────

export interface WaterRippleV5Handle {
  /** Inject a programmatic splash at screen (x, y). Defaults to viewport center. */
  splash: (x?: number, y?: number, strength?: number) => void;
}

export interface WaterRippleV5Props {
  /** Wave simulation grid resolution. Higher = more detail, more GPU cost. Default: 512. */
  simResolution?: number;
  /**
   * Content rendered ABOVE the water — sits on top of the canvas overlay, zero distortion.
   * Useful for UI chrome, labels, or anything that must remain crisp.
   */
  surface?: ReactNode;
  /**
   * Content rendered BELOW the water — wrapped in an SVG feDisplacementMap filter
   * driven by the live wave simulation. Interaction (click / drag / touch) creates ripples.
   */
  children?: ReactNode;
}

// ─── Shared vertex ────────────────────────────────────────────────────────────

const VERT = /* glsl */`
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
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

  gl_FragColor = vec4(hNew, hCurr, 0.0, 1.0);
}`;

// ─── Displacement map: surface normals → RG channels for SVG feDisplacementMap ─

const DISP_FRAG = /* glsl */`
uniform sampler2D tSim;
uniform vec2 texelSize;
varying vec2 vUv;

void main() {
  // Flip Y: OpenGL UV (y=0 bottom) → CSS coordinate space (y=0 top)
  vec2 uv = vec2(vUv.x, 1.0 - vUv.y);
  float hL = texture2D(tSim, uv - vec2(texelSize.x, 0.0)).r;
  float hR = texture2D(tSim, uv + vec2(texelSize.x, 0.0)).r;
  float hU = texture2D(tSim, uv + vec2(0.0, texelSize.y)).r;
  float hD = texture2D(tSim, uv - vec2(0.0, texelSize.y)).r;
  vec3 normal = normalize(vec3((hL - hR) * 6.0, (hD - hU) * 6.0, 1.0));
  // R = X offset, G = Y offset; 0.5 = no displacement
  gl_FragColor = vec4(normal.x * 0.5 + 0.5, normal.y * 0.5 + 0.5, 0.5, 1.0);
}`;

// ─── Overlay: specular highlights + caustic glow + subtle depth tint ──────────
// Applied as a transparent canvas sitting above children (z 9999).
// surface content at z 10000 is completely unaffected.

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
  float spec    = pow(max(dot(normal, normalize(L + V)), 0.0), 140.0) * 3.5;
  float fresnel = pow(1.0 - dot(normal, V), 4.0);
  float h       = texture2D(tSim, vUv).r;
  float activity = abs(h);

  // Subtle depth tint — makes children read as submerged even at rest
  vec3  color = vec3(0.0, 0.04, 0.12) * 0.30;
  float alpha = 0.08;

  color += vec3(0.65, 0.88, 1.0) * spec;
  color += vec3(0.22, 0.52, 0.95) * max(0.0, h * 7.0) * 0.25;
  color += vec3(0.40, 0.70, 1.00) * fresnel * activity * 0.4;
  alpha  = clamp(alpha + spec * 2.5 + max(0.0, h * 7.0) * 0.45 + fresnel * activity * 0.4, 0.0, 0.92);

  gl_FragColor = vec4(color * alpha, alpha); // premultiplied
}`;

// ─────────────────────────────────────────────────────────────────────────────

const DISP_RES = 128;

// ─────────────────────────────────────────────────────────────────────────────

export const WaterRippleV5 = forwardRef<WaterRippleV5Handle, WaterRippleV5Props>(
  function WaterRippleV5({ simResolution = 512, surface, children }, ref) {
    const canvasRef     = useRef<HTMLCanvasElement>(null);
    const dispCanvasRef = useRef<HTMLCanvasElement>(null);
    const filterRef     = useRef<SVGFilterElement>(null);
    const feImgNodeRef  = useRef<SVGFEImageElement>(null);
    const feDispRef     = useRef<SVGFEDisplacementMapElement>(null);

    const splashPending = useRef<{ x: number; y: number; strength: number } | null>(null);

    const rawId    = useId();
    const filterId = `wv5-${rawId.replace(/:/g, '')}`;

    // ── Imperative handle ──────────────────────────────────────────────────────
    useImperativeHandle(ref, () => ({
      splash(x = window.innerWidth / 2, y = window.innerHeight / 2, strength = 0.9) {
        splashPending.current = {
          x: x / window.innerWidth,
          y: 1 - y / window.innerHeight,
          strength,
        };
      },
    }), []);

    // ── Three.js setup ─────────────────────────────────────────────────────────
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const renderer = new THREE.WebGLRenderer({
        canvas, antialias: false, alpha: true, premultipliedAlpha: true,
      });
      renderer.setPixelRatio(1);
      renderer.setSize(window.innerWidth, window.innerHeight);

      const texelSize = new THREE.Vector2(1 / simResolution, 1 / simResolution);

      const simOpts = {
        minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
        format: THREE.RGBAFormat, type: THREE.HalfFloatType,
      } as const;

      let rtA = new THREE.WebGLRenderTarget(simResolution, simResolution, simOpts);
      let rtB = new THREE.WebGLRenderTarget(simResolution, simResolution, simOpts);

      const dispRT     = new THREE.WebGLRenderTarget(DISP_RES, DISP_RES, {
        minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
        format: THREE.RGBAFormat, type: THREE.UnsignedByteType,
      });
      const dispPixels = new Uint8Array(DISP_RES * DISP_RES * 4);

      const geo   = new THREE.PlaneGeometry(2, 2);
      const cam   = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      const scene = new THREE.Scene();
      const quad  = new THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>(geo, null!);
      scene.add(quad);

      const simMat = new THREE.ShaderMaterial({
        vertexShader: VERT, fragmentShader: SIM_FRAG,
        uniforms: {
          tSim:           { value: null },
          texelSize:      { value: texelSize },
          aspectRatio:    { value: window.innerWidth / window.innerHeight },
          splashPos:      { value: new THREE.Vector2(-10, -10) },
          splashStrength: { value: 0 },
          splashRadius:   { value: 0.028 },
        },
        depthTest: false, depthWrite: false,
      });

      const dispMat = new THREE.ShaderMaterial({
        vertexShader: VERT, fragmentShader: DISP_FRAG,
        uniforms: { tSim: { value: null }, texelSize: { value: texelSize } },
        depthTest: false, depthWrite: false,
      });

      const overlayMat = new THREE.ShaderMaterial({
        vertexShader: VERT, fragmentShader: OVERLAY_FRAG,
        uniforms: { tSim: { value: null }, texelSize: { value: texelSize } },
        transparent: true, depthTest: false, depthWrite: false,
      });

      const dispCtx = dispCanvasRef.current?.getContext('2d') ?? null;

      const setFilterSize = () => {
        filterRef.current?.setAttribute('width',  String(window.innerWidth));
        filterRef.current?.setAttribute('height', String(window.innerHeight));
        feImgNodeRef.current?.setAttribute('width',  String(window.innerWidth));
        feImgNodeRef.current?.setAttribute('height', String(window.innerHeight));
      };
      setFilterSize();

      // ── Input ────────────────────────────────────────────────────────────────
      let mouseDown  = false;
      let lastSplash = 0;

      const queueSplash = (cx: number, cy: number) => {
        splashPending.current = {
          x: cx / window.innerWidth,
          y: 1 - cy / window.innerHeight,
          strength: 0.9,
        };
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
        simMat.uniforms.aspectRatio.value = window.innerWidth / window.innerHeight;
        setFilterSize();
      };
      window.addEventListener('resize', onResize);

      // ── Render loop ───────────────────────────────────────────────────────────
      let rafId: number;
      let frameCount = 0;

      const animate = () => {
        frameCount++;

        // Pass 1: wave simulation
        quad.material = simMat;
        simMat.uniforms.tSim.value = rtA.texture;

        const sp = splashPending.current;
        if (sp) {
          simMat.uniforms.splashPos.value.set(sp.x, sp.y);
          simMat.uniforms.splashStrength.value = sp.strength;
          splashPending.current = null;
        } else {
          simMat.uniforms.splashStrength.value = 0;
        }

        renderer.setRenderTarget(rtB);
        renderer.render(scene, cam);
        const tmp = rtA; rtA = rtB; rtB = tmp;

        // Pass 2: displacement map → 2D canvas → SVG feImage (every 2nd frame = 30fps)
        if (dispCtx && frameCount % 2 === 0) {
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

        // Pass 3: overlay canvas → screen
        quad.material = overlayMat;
        overlayMat.uniforms.tSim.value = rtA.texture;
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
        rtA.dispose(); rtB.dispose(); dispRT.dispose();
        geo.dispose(); simMat.dispose(); dispMat.dispose(); overlayMat.dispose();
      };
    }, [simResolution]);

    // ── Render ────────────────────────────────────────────────────────────────
    return (
      <div style={{ position: 'fixed', inset: 0, overflow: 'hidden' }}>

        {/* Layer 1 — underwater content: full SVG displacement filter */}
        <div style={{ filter: `url(#${filterId})`, position: 'absolute', inset: 0, zIndex: 1 }}>
          {children}
        </div>

        {/* Layer 2 — WebGL canvas: specular + caustics + depth tint overlay */}
        <canvas
          ref={canvasRef}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%',
            zIndex: 9999, pointerEvents: 'none', display: 'block' }}
          data-ripple-ignore
        />

        {/* Layer 3 — surface content: above canvas, zero distortion */}
        <div style={{ position: 'absolute', inset: 0, zIndex: 10000, pointerEvents: 'none' }}>
          <div style={{ pointerEvents: 'auto', width: '100%', height: '100%' }}>
            {surface}
          </div>
        </div>

        {/* SVG filter definition */}
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
                scale="35"
                xChannelSelector="R"
                yChannelSelector="G"
              />
            </filter>
          </defs>
        </svg>

        {/* Hidden 2D canvas: displacement source, updated each frame */}
        <canvas
          ref={dispCanvasRef}
          width={DISP_RES} height={DISP_RES}
          style={{ display: 'none' }}
          data-ripple-ignore
        />
      </div>
    );
  },
);
