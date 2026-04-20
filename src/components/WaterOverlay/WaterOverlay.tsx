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

// ─── Uniform bag (mutable ref, read cada frame) ───────────────────────────────

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
    uRef.current = { distortionMult: distortMult, lightDir, lightColor, specularIntensity, glowIntensity, depthScale };

    // ── Refs ──────────────────────────────────────────────────────────────────
    const canvasRef     = useRef<HTMLCanvasElement>(null);
    const dispCanvasRef = useRef<HTMLCanvasElement>(null);
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
      pointerDown.current = true;
      splashPending.current = {
        x: e.clientX / window.innerWidth,
        y: 1 - e.clientY / window.innerHeight,
        strength: rippleStrength,
      };
    }, [rippleEnabled, rippleStrength]);

    const handlePointerMove = useCallback((e: React.PointerEvent) => {
      if (!rippleEnabled || !pointerDown.current) return;
      splashPending.current = {
        x: e.clientX / window.innerWidth,
        y: 1 - e.clientY / window.innerHeight,
        strength: rippleStrength * 0.45,
      };
    }, [rippleEnabled, rippleStrength]);

    const handlePointerUp = useCallback(() => { pointerDown.current = false; }, []);

    // ── WebGL setup ───────────────────────────────────────────────────────────
    useEffect(() => {
      const canvas    = canvasRef.current;
      const dispCanvas = dispCanvasRef.current;
      const feImgNode  = feImgNodeRef.current;
      if (!canvas || !dispCanvas || !feImgNode) return;

      forceUpdate(); // populate surfaceSlot ref for portals

      const renderer = new THREE.WebGLRenderer({
        canvas, antialias: false, alpha: true, premultipliedAlpha: true,
      });
      renderer.setPixelRatio(1);
      renderer.setSize(window.innerWidth, window.innerHeight);

      const texelSim  = new THREE.Vector2(1 / simResolution, 1 / simResolution);
      const texelDisp = new THREE.Vector2(1 / dispRes, 1 / dispRes);

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

      // ── Materiales ─────────────────────────────────────────────────────────
      const simMat = new THREE.ShaderMaterial({
        vertexShader: VERT, fragmentShader: SIM_FRAG,
        uniforms: {
          tSim:           { value: null },
          texelSize:      { value: texelSim },
          aspectRatio:    { value: window.innerWidth / window.innerHeight },
          splashPos:      { value: new THREE.Vector2(-10, -10) },
          splashStrength: { value: 0 },
          splashRadius:   { value: rippleRadius },
        },
        depthTest: false, depthWrite: false,
      });

      const dispMat = new THREE.ShaderMaterial({
        vertexShader: VERT, fragmentShader: DISP_FRAG,
        uniforms: {
          tSim:          { value: null },
          texelSize:     { value: texelDisp },
          distortionMult:{ value: uRef.current.distortionMult },
        },
        depthTest: false, depthWrite: false,
      });

      const u = uRef.current;
      const overlayMat = new THREE.ShaderMaterial({
        vertexShader: VERT, fragmentShader: OVERLAY_FRAG,
        uniforms: {
          tSim:              { value: null },
          texelSize:         { value: texelSim },
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

      // ── Resize ─────────────────────────────────────────────────────────────
      const onResize = () => {
        const w = window.innerWidth, h = window.innerHeight;
        renderer.setSize(w, h);
        simMat.uniforms.aspectRatio.value = w / h;
        rtA.dispose(); rtB.dispose();
        rtA = new THREE.WebGLRenderTarget(simResolution, simResolution, simOpts);
        rtB = new THREE.WebGLRenderTarget(simResolution, simResolution, simOpts);
      };
      window.addEventListener('resize', onResize);

      // ── Loop ───────────────────────────────────────────────────────────────
      let frameId = 0;
      let frameCount = 0;

      const animate = () => {
        frameId = requestAnimationFrame(animate);
        frameCount++;
        const cur = uRef.current;

        // Splash
        if (splashPending.current) {
          const sp = splashPending.current;
          splashPending.current = null;
          simMat.uniforms.splashPos.value.set(sp.x, sp.y);
          simMat.uniforms.splashStrength.value = sp.strength;
        } else {
          simMat.uniforms.splashStrength.value = 0;
        }

        // Sim pass
        simMat.uniforms.tSim.value = rtA.texture;
        quad.material = simMat;
        renderer.setRenderTarget(rtB);
        renderer.render(scene, cam);
        [rtA, rtB] = [rtB, rtA];

        // Disp pass (cada dispFreq frames)
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
          feImgNode.setAttribute('href', dispCanvas.toDataURL('image/png'));
        }

        // Overlay pass
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
    const darknessFor = useCallback((depth: number) => computeDarkness(depth, depthScale), [depthScale]);

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

          {/* Capa 2 — canvas WebGL (caústicas + especular) */}
          <canvas
            ref={canvasRef}
            data-ripple-ignore="true"
            style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 9999 }}
          />

          {/* Capa 3 — surface slot para float/fixed items */}
          <div
            ref={surfSlotRef}
            style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 10000 }}
          />

          {/* Canvas 2D oculto para readback de displacement */}
          <canvas
            ref={dispCanvasRef}
            width={dispRes}
            height={dispRes}
            data-ripple-ignore="true"
            style={{ display: 'none' }}
          />

          {/* Definición SVG del filtro */}
          <svg
            width={0} height={0}
            data-ripple-ignore="true"
            style={{ position: 'absolute' }}
          >
            <defs>
              <filter
                id={filterId}
                x="0%" y="0%" width="100%" height="100%"
                colorInterpolationFilters="sRGB"
              >
                <feImage
                  ref={feImgNodeRef}
                  result="disp"
                  width="100%"
                  height="100%"
                  preserveAspectRatio="none"
                />
                <feDisplacementMap
                  in="SourceGraphic"
                  in2="disp"
                  scale={35}
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
