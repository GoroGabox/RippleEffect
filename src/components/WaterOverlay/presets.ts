import type { WaterLightPreset, WaterLightDirection } from './types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function norm3(v: [number, number, number]): [number, number, number] {
  const len = Math.sqrt(v[0] ** 2 + v[1] ** 2 + v[2] ** 2);
  return [v[0] / len, v[1] / len, v[2] / len];
}

// ─── Light presets ────────────────────────────────────────────────────────────

export interface LightParams {
  lightDir:          [number, number, number];
  lightColor:        [number, number, number];
  specularIntensity: number;
  glowIntensity:     number;
}

export const LIGHT_PRESETS: Record<Exclude<WaterLightPreset, 'custom'>, LightParams> = {
  dawn:        { lightDir: norm3([0.70, 0.20, 0.80]), lightColor: [1.00, 0.72, 0.45], specularIntensity: 2.2, glowIntensity: 0.40 },
  noon:        { lightDir: norm3([0.35, 0.55, 1.00]), lightColor: [0.75, 0.88, 1.00], specularIntensity: 3.5, glowIntensity: 0.20 },
  neon:        { lightDir: norm3([0.40, 0.40, 1.00]), lightColor: [0.20, 1.00, 0.82], specularIntensity: 5.5, glowIntensity: 0.90 },
  fluorescent: { lightDir: norm3([0.05, 0.90, 1.00]), lightColor: [0.62, 0.82, 0.96], specularIntensity: 1.8, glowIntensity: 0.15 },
};

export const DEFAULT_LIGHT: LightParams = LIGHT_PRESETS.noon;

// ─── Quality params ───────────────────────────────────────────────────────────

export interface QualityParams {
  simResolution: number;
  dispRes:       number;
  dispFreq:      number;
}

export const QUALITY_PARAMS: Record<'low' | 'medium' | 'high', QualityParams> = {
  low:    { simResolution: 256, dispRes:  64, dispFreq: 4 },
  medium: { simResolution: 384, dispRes:  96, dispFreq: 3 },
  high:   { simResolution: 512, dispRes: 128, dispFreq: 2 },
};

export function autoQuality(): 'low' | 'medium' | 'high' {
  const cores = navigator.hardwareConcurrency ?? 4;
  if (cores <= 2) return 'low';
  if (cores <= 4) return 'medium';
  return 'high';
}

// ─── Light direction helper ───────────────────────────────────────────────────

export function lightDirToVec(dir: WaterLightDirection | undefined): [number, number, number] {
  if (!dir) return DEFAULT_LIGHT.lightDir;
  if (typeof dir === 'object' && 'x' in dir) {
    return norm3([dir.x, dir.y, dir.z ?? 1]);
  }
  const map: Record<string, [number, number, number]> = {
    'top':          norm3([ 0.00,  1.00, 0.80]),
    'bottom':       norm3([ 0.00, -1.00, 0.80]),
    'left':         norm3([-1.00,  0.00, 0.80]),
    'right':        norm3([ 1.00,  0.00, 0.80]),
    'top-left':     norm3([-0.70,  0.70, 0.80]),
    'top-right':    norm3([ 0.70,  0.70, 0.80]),
    'bottom-left':  norm3([-0.70, -0.70, 0.80]),
    'bottom-right': norm3([ 0.70, -0.70, 0.80]),
  };
  return map[dir as string] ?? DEFAULT_LIGHT.lightDir;
}

// ─── Depth darkening helpers ──────────────────────────────────────────────────

/**
 * Oscurecimiento final para un elemento con `depth` (0-1) y escala global `scale` (0-1).
 * 0 = sin oscurecimiento (superficie), 1 = máximo oscurecimiento (fondo).
 */
export function computeDarkness(depth: number, scale: number): number {
  return Math.max(0, Math.min(1, depth * scale));
}

/**
 * CSS brightness multiplier dado un nivel de oscurecimiento (0-1).
 * darkness=0 → brightness=1.0 (sin efecto)
 * darkness=1 → brightness=0.12 (casi negro)
 */
export function darknessToBrightness(darkness: number): number {
  return 1 - darkness * 0.88;
}

/**
 * Opacidad del tinte azul-oscuro superpuesto (0-1).
 * darkness=0 → 0 (invisible), darkness=1 → 0.72 (fuerte tinte)
 */
export function darknessToTintOpacity(darkness: number): number {
  return darkness * 0.72;
}
