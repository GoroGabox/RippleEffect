import {
  forwardRef, useCallback, useEffect, useId, useImperativeHandle,
  useReducer, useRef,
} from 'react';
import * as THREE from 'three';

import type { WaterOverlayProps, WaterOverlayHandle, WaterMode, WaterLightPreset } from './types';
import { WaterContext } from './context';
import { VERT, SIM_FRAG, DISP_FRAG, OVERLAY_FRAG } from './shaders';
import {
  LIGHT_PRESETS, QUALITY_PARAMS, DEFAULT_LIGHT,
  autoQuality, lightDirToVec, computeDarkness,
} from './presets';

// ─── Uniform bag (mutable ref, read each frame) ───────────────────────────────

interface URefs {
  distortionMult:    number;
  lightDir:          [number, number, number];
  lightColor:        [number, number, number];
  specularIntensity: number;
  glowIntensity:     number;
  depthScale:        number;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const WaterOverlay = forwardRef<WaterOverlayHandle, WaterOverlayProps>(
  function WaterOverlay(props, ref) {
    const {
      children,
      level = 0.7,
      mode = 'interactive',
      light,
      material,
      interaction,
      performance: perf,
      layout,
      debug = false,
      className,
      style,
    } = props;

    // ── Profundidad global ────────────────────────────────────────────────────
    const depthScale = Math.max(0, Math.min(1, level));

    // ── Quality ───────────────────────────────────────────────────────────────
    const qualityKey = (() => {
      const q = perf?.quality ?? 'auto';
      return q === 'auto' ? autoQuality() : q;
    })();
    const { simResolution, dispRes, dispFreq } = QUALITY_PARAMS[qualityKey];

    // ── Light ─────────────────────────────────────────────────────────────────
    const lightPreset: WaterLightPreset = light?.preset ?? 'noon';
    const baseLight = lightPreset !== 'custom' ? LIGHT_PRESETS[lightPreset] : DEFAULT_LIGHT;
    const lightDir          = light?.direction != null ? lightDirToVec(light.direction) : baseLight.lightDir;
    const lightColor        = baseLight.lightColor;
    const specularIntensity = (light?.specular ?? 1) * baseLight.specularIntensity;
    const glowIntensity     = (light?.glow ?? 1) * baseLight.glowIntensity;
    const distortMult       = material?.distortionScale ?? 1;

    const rippleEnabled  = interaction?.ripples !== false;
    const rippleStrength = interaction?.rippleStrength ?? 0.9;
    const rippleRadius   = interaction?.rippleRadius   ?? 0.028;

    // ── Mutable ref bag ───────────────────────────────────────────────────────
    const uRef = useRef<URefs>({
      distortionMult: distortMult,
      lightDir, lightColor, specularIntensity, glowIntensity, depthScale,
    });
    uRef.current = {
      distortionMult: distortMult,
      lightDir, lightColor, specularIntensity, glowIntensity, depthScale,
    };

    // ── DOM refs ──────────────────────────────────────────────────────────────
    const canvasRef     = useRef<HTMLCanvasElement>(null);
    const dispCanvasRef = useRef<HTMLCanvasElement>(null);
    const filterRef     = useRef<SVGFilterElement>(null);
    const feImgNodeRef  = useRef<SVGFEImageElement>(null);
    const surfSlotRef   = useRef<HTMLDivElement>(null);
    const splashPending = useRef<{ x: number; y: number; strength: number } | null>(null);
    const [, forceUpdate] = useReducer((n: number) => n + 1, 0);

    const rawId    = useId();
    const filterId = `wo6-${rawId.replace(/:/g, '')}`;

    // ── Handle ────────────────────────────────────────────────────────────────
    useImperativeHandle(ref, () => ({
      splash(x = window.innerWidth / 2, y = window.innerHeight / 2, strength = 0.9) {
        splashPending.current = {
          x: x / window.innerWidth,
          y: 1 - y / window.innerHeight,
          strength,
        };
      },
    }), []);

    // ── Pointer events ────────────────────────────────────────────────────────
    const pointerDown = useRef(false);

    const handlePointerDown = useCallback((e: React.PointerEvent) => {
      if (!rippleEnabled) return;
      // Si el click viene de un elemento Float/fixed, su ancestro tiene
      // data-water-surface="true". closest() sube por el DOM real (no virtual)
      // y lo detecta sin importar qué z-index o pointer-events tenga el contenedor.
      if ((e.target as Element).closest?.('[data-water-surface]')) return;
      pointerDown.current = true;
      splashPending.current = {
        x: e.clientX / window.innerWidth,
        y: 1 - e.clientY / window.innerHeight,
        strength: rippleStrength,
      };
    }, [rippleEnabled, rippleStrength]);

    const handlePointerMove = useCallback((e: React.PointerEvent) => {
      if (!rippleEnabled || !pointerDown.current) return;
      if ((e.target as Element).closest?.('[data-water-surface]')) return;
      splashPending.current = {
        x: e.clientX / window.innerWidth,
        y: 1 - e.clientY / window.innerHeight,
        strength: rippleStrength * 0.45,
      };
    }, [rippleEnabled, rippleStrength]);

    const handlePointerUp = useCallback(() => { pointerDown.current = false; }, []);

    // ── WebGL setup ───────────────────────────────────────────────────────────
    useEffect(() => {
      const canvas     = canvasRef.current;
      const dispCanvas = dispCanvasRef.current;
      const feImgNode  = feImgNodeRef.current;
      const filterEl   = filterRef.current;
      if (!canvas || !dispCanvas || !feImgNode || !filterEl) return;

      forceUpdate(); // populate surfaceSlot ref for portals

      // ── Filter dimensions helper ─────────────────────────────────────────
      // Must use filterUnits="userSpaceOnUse" with explicit pixel sizes so
      // the displacement map aligns 1:1 with the viewport.
      const applyFilterSize = (w: number, h: number) => {
        filterEl.setAttribute('x', '0');
        filterEl.setAttribute('y', '0');
        filterEl.setAttribute('width',  String(w));
        filterEl.setAttribute('height', String(h));
        feImgNode.setAttribute('x', '0');
        feImgNode.setAttribute('y', '0');
        feImgNode.setAttribute('width',  String(w));
        feImgNode.setAttribute('height', String(h));
      };
      applyFilterSize(window.innerWidth, window.innerHeight);

      // ── WebGL renderer ───────────────────────────────────────────────────
      const renderer = new THREE.WebGLRenderer({
        canvas, antialias: false, alpha: true, premultipliedAlpha: true,
      });
      renderer.setPixelRatio(1);
      renderer.setSize(window.innerWidth, window.innerHeight);

      // Use simResolution's texel for ALL shader sampling — dispMat samples tSim too
      const texelSize = new THREE.Vector2(1 / simResolution, 1 / simResolution);

      const simOpts = {
        minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
        format: THREE.RGBAFormat, type: THREE.HalfFloatType,
      } as const;
      let rtA = new THREE.WebGLRenderTarget(simResolution, simResolution, simOpts);
      let rtB = new THREE.WebGLRenderTarget(simResolution, simResolution, simOpts);
      const dispRT     = new THREE.WebGLRenderTarget(dispRes, dispRes, {
        minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
        format: THREE.RGBAFormat, type: THREE.UnsignedByteType,
      });
      const dispPixels = new Uint8Array(dispRes * dispRes * 4);

      const geo   = new THREE.PlaneGeometry(2, 2);
      const cam   = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      const scene = new THREE.Scene();
      const quad  = new THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>(geo, null!);
      scene.add(quad);

      // ── Sim material ─────────────────────────────────────────────────────
      const simMat = new THREE.ShaderMaterial({
        vertexShader: VERT, fragmentShader: SIM_FRAG,
        uniforms: {
          tSim:           { value: null },
          texelSize:      { value: texelSize },
          aspectRatio:    { value: window.innerWidth / window.innerHeight },
          splashPos:      { value: new THREE.Vector2(-10, -10) },
          splashStrength: { value: 0 },
          splashRadius:   { value: rippleRadius },
        },
        depthTest: false, depthWrite: false,
      });

      // ── Displacement material — texelSize = 1/simResolution (same as V5) ─
      const dispMat = new THREE.ShaderMaterial({
        vertexShader: VERT, fragmentShader: DISP_FRAG,
        uniforms: {
          tSim:          { value: null },
          texelSize:     { value: texelSize },      // same texel as simMat
          distortionMult:{ value: uRef.current.distortionMult },
        },
        depthTest: false, depthWrite: false,
      });

      // ── Overlay material ─────────────────────────────────────────────────
      const u = uRef.current;
      const overlayMat = new THREE.ShaderMaterial({
        vertexShader: VERT, fragmentShader: OVERLAY_FRAG,
        uniforms: {
          tSim:              { value: null },
          texelSize:         { value: texelSize },
          lightDir:          { value: new THREE.Vector3(...u.lightDir) },
          lightColor:        { value: new THREE.Vector3(...u.lightColor) },
          specularIntensity: { value: u.specularIntensity },
          glowIntensity:     { value: u.glowIntensity },
          depthScale:        { value: u.depthScale },
        },
        transparent: true, depthTest: false, depthWrite: false,
        blending: THREE.CustomBlending,
        blendEquation: THREE.AddEquation,
        blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
      });

      const dispCtx = dispCanvas.getContext('2d')!;

      // ── Resize ───────────────────────────────────────────────────────────
      const onResize = () => {
        const w = window.innerWidth, h = window.innerHeight;
        renderer.setSize(w, h);
        simMat.uniforms.aspectRatio.value = w / h;
        applyFilterSize(w, h);
        rtA.dispose(); rtB.dispose();
        rtA = new THREE.WebGLRenderTarget(simResolution, simResolution, simOpts);
        rtB = new THREE.WebGLRenderTarget(simResolution, simResolution, simOpts);
      };
      window.addEventListener('resize', onResize);

      // ── Render loop ──────────────────────────────────────────────────────
      let frameId    = 0;
      let frameCount = 0;

      const animate = () => {
        frameId = requestAnimationFrame(animate);
        frameCount++;
        const cur = uRef.current;

        // Splash injection
        if (splashPending.current) {
          const sp = splashPending.current;
          splashPending.current = null;
          simMat.uniforms.splashPos.value.set(sp.x, sp.y);
          simMat.uniforms.splashStrength.value = sp.strength;
        } else {
          simMat.uniforms.splashStrength.value = 0;
        }

        // Pass 1 — wave simulation
        simMat.uniforms.tSim.value = rtA.texture;
        quad.material = simMat;
        renderer.setRenderTarget(rtB);
        renderer.render(scene, cam);
        [rtA, rtB] = [rtB, rtA];

        // Pass 2 — displacement map → 2D canvas → SVG feImage
        if (frameCount % dispFreq === 0) {
          dispMat.uniforms.tSim.value = rtA.texture;
          dispMat.uniforms.distortionMult.value = cur.distortionMult;
          quad.material = dispMat;
          renderer.setRenderTarget(dispRT);
          renderer.render(scene, cam);

          renderer.readRenderTargetPixels(dispRT, 0, 0, dispRes, dispRes, dispPixels);
          const imgData = dispCtx.createImageData(dispRes, dispRes);
          imgData.data.set(dispPixels);
          dispCtx.putImageData(imgData, 0, 0);

          // ── Critical: xlink:href is required for SVG feImage in most browsers ──
          feImgNode.setAttributeNS(
            'http://www.w3.org/1999/xlink',
            'href',
            dispCanvas.toDataURL(),
          );
        }

        // Pass 3 — overlay canvas (caustics + specular)
        overlayMat.uniforms.tSim.value = rtA.texture;
        overlayMat.uniforms.lightDir.value.set(...cur.lightDir);
        overlayMat.uniforms.lightColor.value.set(...cur.lightColor);
        overlayMat.uniforms.specularIntensity.value = cur.specularIntensity;
        overlayMat.uniforms.glowIntensity.value     = cur.glowIntensity;
        overlayMat.uniforms.depthScale.value        = cur.depthScale;

        quad.material = overlayMat;
        renderer.setRenderTarget(null);
        renderer.render(scene, cam);
      };

      animate();

      return () => {
        cancelAnimationFrame(frameId);
        window.removeEventListener('resize', onResize);
        rtA.dispose(); rtB.dispose(); dispRT.dispose();
        simMat.dispose(); dispMat.dispose(); overlayMat.dispose();
        geo.dispose();
        renderer.dispose();
      };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [simResolution, dispRes, dispFreq, rippleRadius]);

    // ── Context ───────────────────────────────────────────────────────────────
    const darknessFor = useCallback(
      (depth: number) => computeDarkness(depth, depthScale),
      [depthScale],
    );

    const ctxValue = {
      depthScale,
      mode:          mode as WaterMode,
      lightPreset:   lightPreset as WaterLightPreset,
      isInteractive: mode === 'interactive',
      darknessFor,
      surfaceSlot:   surfSlotRef.current,
    };

    // ── Layout ────────────────────────────────────────────────────────────────
    const isViewport = layout?.strategy !== 'contained';
    const rootStyle: React.CSSProperties = isViewport
      ? { position: 'fixed', inset: 0, overflow: layout?.overflowClip !== false ? 'hidden' : 'visible', ...style }
      : { position: 'relative', width: '100%', height: '100%', overflow: 'hidden', ...style };

    return (
      <WaterContext.Provider value={ctxValue}>
        <div
          className={className}
          style={rootStyle}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        >
          {/* Capa 1 — contenido subacuático + feDisplacementMap */}
          <div
            style={{
              position: 'absolute', inset: 0,
              filter: `url(#${filterId})`,
              zIndex: 1,
            }}
          >
            {children}
          </div>

          {/* Capa 2 — WebGL overlay canvas (caústicas + especular) */}
          <canvas
            ref={canvasRef}
            data-ripple-ignore="true"
            style={{
              position: 'absolute', inset: 0,
              width: '100%', height: '100%',
              display: 'block',
              pointerEvents: 'none',
              zIndex: 9999,
            }}
          />

          {/* Capa 3 — surface slot para WaterItem float/fixed */}
          <div
            ref={surfSlotRef}
            style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 10000 }}
          />

          {/* Canvas 2D oculto — fuente del mapa de desplazamiento */}
          <canvas
            ref={dispCanvasRef}
            width={dispRes}
            height={dispRes}
            data-ripple-ignore="true"
            style={{ display: 'none' }}
          />

          {/* SVG con definición de filtro — position:fixed para que el espacio de
              coordenadas del filtro sea el viewport completo, no el contenedor */}
          <svg
            width="0"
            height="0"
            data-ripple-ignore="true"
            style={{ position: 'fixed', top: 0, left: 0, overflow: 'hidden', pointerEvents: 'none' }}
          >
            <defs>
              <filter
                ref={filterRef}
                id={filterId}
                x="0"
                y="0"
                width={window.innerWidth}
                height={window.innerHeight}
                filterUnits="userSpaceOnUse"
                colorInterpolationFilters="sRGB"
              >
                {/* feImage dimensions are set imperatively via applyFilterSize */}
                <feImage
                  ref={feImgNodeRef}
                  preserveAspectRatio="none"
                  result="disp"
                />
                <feDisplacementMap
                  in="SourceGraphic"
                  in2="disp"
                  scale="35"
                  xChannelSelector="R"
                  yChannelSelector="G"
                />
              </filter>
            </defs>
          </svg>

          {/* Debug HUD */}
          {debug && (
            <div style={{
              position: 'absolute', top: 8, left: 8, zIndex: 99999,
              fontFamily: 'monospace', fontSize: 11,
              color: 'rgba(0,255,128,0.9)',
              background: 'rgba(0,0,0,0.55)',
              padding: '4px 10px', borderRadius: 4,
              pointerEvents: 'none',
            }}>
              WaterOverlay v6 · depthScale={depthScale.toFixed(2)} · quality={qualityKey} · mode={mode}
            </div>
          )}
        </div>
      </WaterContext.Provider>
    );
  },
);

WaterOverlay.displayName = 'WaterOverlay';
