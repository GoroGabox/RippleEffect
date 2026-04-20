import type { WaterLightPreset, WaterLightDirection } from './types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function norm3(v: [number, number, number]): [number, number, number] {
  const len = Math.sqrt(v[0] ** 2 + v[1] ** 2 + v[2] ** 2);
  return [v[0] / len, v[1] / len, v[2] / len];
}

// ─── Light presets ────────────────────────────────────────────────────────────

export interface LightParams {
  lightDir:          [number, number, number]; // normalized
  lightColor:        [number, number, number]; // RGB 0–1
  specularIntensity: number;
  glowIntensity:     number;
}

export const LIGHT_PRESETS: Record<Exclude<WaterLightPreset, 'custom'>, LightParams> = {
  dawn:        { lightDir: norm3([0.70, 0.20, 0.80]), lightColor: [1.00, 0.72, 0.45], specularIntensity: 2.2, glowIntensity: 0.25 },
  noon:        { lightDir: norm3([0.35, 0.55, 1.00]), lightColor: [0.75, 0.88, 1.00], specularIntensity: 3.5, glowIntensity: 0.00 },
  neon:        { lightDir: norm3([0.40, 0.40, 1.00]), lightColor: [0.20, 1.00, 0.82], specularIntensity: 5.5, glowIntensity: 0.90 },
  fluorescent: { lightDir: norm3([0.05, 0.90, 1.00]), lightColor: [0.62, 0.82, 0.96], specularIntensity: 1.8, glowIntensity: 0.15 },
};

export const DEFAULT_LIGHT: LightParams = LIGHT_PRESETS.noon;

// ─── Quality params ───────────────────────────────────────────────────────────

export interface QualityParams {
  simResolution: number;
  dispRes:       number;
  dispFreq:      number; // update displacement texture every N frames
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

// ─── Parse helpers ────────────────────────────────────────────────────────────

/**
 * Convert WaterLevel (0–1 number or "45%" string) to a normalized 0–1 float.
 * 0 = bottom, 1 = top (same convention as V5).
 */
export function parseLevel(level: number | `${number}%` | undefined, fallback = 0.5): number {
  if (level === undefined) return fallback;
  if (typeof level === 'number') return Math.max(0, Math.min(1, level));
  const pct = parseFloat(level as string);
  if (Number.isNaN(pct)) return fallback;
  // percentage = distance from top (CSS), so normalized = 1 - pct/100
  return Math.max(0, Math.min(1, 1 - pct / 100));
}

/**
 * Convert WaterLightDirection to a normalized [x,y,z] triple.
 */
export function lightDirToVec(dir: WaterLightDirection | undefined): [number, number, number] {
  if (!dir) return DEFAULT_LIGHT.lightDir;
  if (typeof dir === 'object' && 'x' in dir) {
    return norm3([dir.x, dir.y, dir.z ?? 1]);
  }
  const presetMap: Record<string, [number, number, number]> = {
    'top':          norm3([ 0.00,  1.00, 0.80]),
    'bottom':       norm3([ 0.00, -1.00, 0.80]),
    'left':         norm3([-1.00,  0.00, 0.80]),
    'right':        norm3([ 1.00,  0.00, 0.80]),
    'top-left':     norm3([-0.70,  0.70, 0.80]),
    'top-right':    norm3([ 0.70,  0.70, 0.80]),
    'bottom-left':  norm3([-0.70, -0.70, 0.80]),
    'bottom-right': norm3([ 0.70, -0.70, 0.80]),
  };
  return presetMap[dir as string] ?? DEFAULT_LIGHT.lightDir;
}

/**
 * Parse a CSS colour string into an RGB [0–1] triple.
 * Falls back to [0, 0.04, 0.12] (deep ocean tint) on failure.
 */
export function parseTint(color: string | undefined): [number, number, number] {
  if (!color) return [0, 0.04, 0.12];
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext('2d');
  if (!ctx) return [0, 0.04, 0.12];
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return [r / 255, g / 255, b / 255];
}
