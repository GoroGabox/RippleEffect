import type { ReactNode, CSSProperties } from 'react';

// ─── Primitives ───────────────────────────────────────────────────────────────

/**
 * Global water depth scale.
 * 0 = agua cristalina (elementos igualmente iluminados sin importar profundidad)
 * 1 = muy profundo (elementos en depth=1 casi negros)
 * Default: 0.7
 */
export type WaterDepthScale = number;

export type WaterMode = 'static' | 'interactive' | 'scroll-linked';

export type WaterLightPreset = 'dawn' | 'noon' | 'neon' | 'fluorescent' | 'custom';

export type WaterLightDirection =
  | 'top' | 'bottom' | 'left' | 'right'
  | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  | { x: number; y: number; z?: number };

export type WaterItemBehavior = 'auto' | 'float' | 'submerge' | 'fixed';

export type WaterBuoyancy = 'none' | 'low' | 'medium' | 'high' | number;

export type WaterDistortionLevel = 'none' | 'low' | 'medium' | 'high';

export type WaterOcclusionMode = 'auto' | 'clip' | 'mask' | 'none';

// ─── Config objects ───────────────────────────────────────────────────────────

export interface WaterLightConfig {
  preset?:    WaterLightPreset;
  direction?: WaterLightDirection;
  intensity?: number;
  specular?:  number;
  glow?:      number;
  color?:     string;
}

export interface WaterMaterialConfig {
  opacity?:          number;
  refraction?:       number;
  reflectivity?:     number;
  tint?:             string;
  blurBelowSurface?: number;
  distortionScale?:  number;
  surfaceBand?:      number;
  edgeHighlight?:    number;
}

export interface WaterInteractionConfig {
  ripples?:        boolean;
  rippleStrength?: number;
  rippleRadius?:   number;
  followPointer?:  boolean;
  touch?:          boolean;
}

export interface WaterPerformanceConfig {
  quality?:              'auto' | 'low' | 'medium' | 'high';
  reduceMotionFallback?: boolean;
  disableOnLowPower?:    boolean;
  staticFallbackTint?:   string;
}

export interface WaterLayoutConfig {
  strategy?:     'contained' | 'viewport';
  numberUnit?:   'normalized' | 'pixels';
  resize?:       'observer' | 'window';
  overflowClip?: boolean;
}

// ─── Component props ──────────────────────────────────────────────────────────

export interface WaterOverlayProps {
  children?:    ReactNode;
  /**
   * Escala global de profundidad del agua (eje Z).
   * 0 = cristalino / sin oscurecimiento
   * 1 = muy profundo / elementos oscuros
   * Default: 0.7
   */
  level?:       WaterDepthScale;
  mode?:        WaterMode;
  light?:       WaterLightConfig;
  material?:    WaterMaterialConfig;
  interaction?: WaterInteractionConfig;
  performance?: WaterPerformanceConfig;
  layout?:      WaterLayoutConfig;
  debug?:       boolean;
  className?:   string;
  style?:       CSSProperties;
}

export interface WaterItemProps {
  children?:   ReactNode;
  behavior?:   WaterItemBehavior;
  /**
   * Profundidad en el eje Z (0–1).
   * 0 = superficie (plena iluminación, sin oscurecer)
   * 1 = fondo (máximo oscurecimiento según la escala global)
   * Default: 0
   */
  depth?:      number;
  buoyancy?:   WaterBuoyancy;
  distortion?: WaterDistortionLevel;
  occlusion?:  WaterOcclusionMode;
  priority?:   number;
  id?:         string;
  className?:  string;
  style?:      CSSProperties;
}

export type FloatProps    = Omit<WaterItemProps, 'behavior'>;
export type SubmergedProps = Omit<WaterItemProps, 'behavior'>;

// ─── Hook return types ────────────────────────────────────────────────────────

export interface UseWaterOverlayReturn {
  /** Escala global de profundidad (0–1). */
  depthScale:    number;
  mode:          WaterMode;
  lightPreset:   WaterLightPreset;
  isInteractive: boolean;
}

export interface UseWaterItemReturn {
  /** Oscurecimiento real aplicado (0=ninguno, 1=máximo). */
  darkness:    number;
  /** Brillo resultante (1 - darkness). */
  brightness:  number;
}

// ─── Imperative handle ────────────────────────────────────────────────────────

export interface WaterOverlayHandle {
  /**
   * Single ripple at screen (x, y).
   * strength 0–2, default 0.9.
   */
  splash(x?: number, y?: number, strength?: number): void;

  /**
   * Rainfall — random drops scattered continuously over the surface.
   * intensity 0–1 (default 0.5). Returns a cancel function.
   * Call cancel() or stopEffects() to stop.
   */
  rain(intensity?: number): () => void;

  /**
   * Trail ripple at screen coordinates.
   * Call repeatedly on pointer / touch move for a wake trail.
   * strength 0–2, default 0.4.
   */
  trail(x: number, y: number, strength?: number): void;

  /**
   * Vibration — rapid scattered micro-pulses across the surface.
   * strength 0–2, default 1. duration in ms, default 1000.
   */
  vibration(strength?: number, duration?: number): void;

  /**
   * Ambient ocean / sea state — continuous gentle chop across the whole surface.
   * intensity 0–1 (default 0.5). Returns a cancel function.
   * Produces a softer, larger-radius pattern than rain.
   */
  sea(intensity?: number): () => void;

  /**
   * Single coherent wavefront originating from outside the viewport.
   * The front sweeps from edge to edge with overlapping large-radius drops
   * forming a continuous wall of water.
   * direction: 'left'|'right'|'top'|'bottom', default 'right'.
   * strength 0–2, default 1.
   */
  wave(direction?: 'left' | 'right' | 'top' | 'bottom', strength?: number): void;

  /** Cancel all active programmatic effects (rain, sea, vibration, wave). */
  stopEffects(): void;
}
