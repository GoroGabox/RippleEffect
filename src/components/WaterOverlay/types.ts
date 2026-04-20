import type { ReactNode, CSSProperties } from 'react';

// ─── Primitives ───────────────────────────────────────────────────────────────

export type WaterLevel = number | `${number}%`;

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

export type WaterZone = 'above' | 'surface' | 'below';

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
  ripples?:       boolean;
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
  strategy?:    'contained' | 'viewport';
  numberUnit?:  'normalized' | 'pixels';
  resize?:      'observer' | 'window';
  overflowClip?: boolean;
}

// ─── Component props ──────────────────────────────────────────────────────────

export interface WaterOverlayProps {
  children?:    ReactNode;
  level?:       WaterLevel;
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
  children?:  ReactNode;
  behavior?:  WaterItemBehavior;
  buoyancy?:  WaterBuoyancy;
  distortion?: WaterDistortionLevel;
  occlusion?: WaterOcclusionMode;
  priority?:  number;
  id?:        string;
  className?: string;
  style?:     CSSProperties;
}

export type FloatProps    = Omit<WaterItemProps, 'behavior'>;
export type SubmergedProps = Omit<WaterItemProps, 'behavior'>;

// ─── Hook return types ────────────────────────────────────────────────────────

export interface UseWaterOverlayReturn {
  level:         number;           // normalized 0–1 (0 = bottom, 1 = top)
  zoneAt:        (y: number) => WaterZone;
  mode:          WaterMode;
  lightPreset:   WaterLightPreset;
  isInteractive: boolean;
}

export interface UseWaterItemReturn {
  zone:           WaterZone;
  immersion:      number;           // 0 = fully above, 1 = fully below
  isSubmerged:    boolean;
  isIntersecting: boolean;
}

// ─── Imperative handle ────────────────────────────────────────────────────────

export interface WaterOverlayHandle {
  /** Programmatic ripple at screen (x, y). */
  splash: (x?: number, y?: number, strength?: number) => void;
}
