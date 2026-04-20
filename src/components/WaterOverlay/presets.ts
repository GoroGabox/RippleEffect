import type { WaterLightPreset, WaterLightDirection } from './types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function norm3(v: [number, number, number]): [number, number, number] {
  const len = Math.sqrt(v[0] ** 2 + v[1] ** 2 + v[2] ** 2);
  return [v[0] / len, v[1] / len, v[2] / len];
}

// ─── Color conversion ─────────────────────────────────────────────────────────

/** RGB [0–1] tuple → 6-digit hex string (#RRGGBB). */
export function rgbToHex([r, g, b]: [number, number, number]): string {
  const h = (v: number) =>
    Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

/** 6-digit hex string → RGB [0–1] tuple. */
export function hexToRgb(hex: string): [number, number, number] {
  const s = hex.replace('#', '').padEnd(6, '0');
  const n = parseInt(s, 16);
  return [(n >> 16 & 0xff) / 255, (n >> 8 & 0xff) / 255, (n & 0xff) / 255];
}

/**
 * Parse any CSS color string to RGB [0–1].
 * Uses hexToRgb for hex strings (fast, no DOM); falls back to canvas for others.
 */
export function parseCssColor(color: string | undefined): [number, number, number] | null {
  if (!color) return null;
  if (/^#[0-9a-fA-F]{3,8}$/.test(color)) {
    const full = color.length <= 4
      ? '#' + [...color.slice(1)].map(c => c + c).join('')
      : color;
    return hexToRgb(full);
  }
  // Fallback: canvas
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return [r / 255, g / 255, b / 255];
}

// ─── Light presets ────────────────────────────────────────────────────────────

export interface LightParams {
  lightDir:          [number, number, number]; // normalized direction
  lightColor:        [number, number, number]; // specular / highlight color
  waterColor:        [number, number, number]; // water body tint color
  specularIntensity: number;
  glowIntensity:     number;
}

export const LIGHT_PRESETS: Record<Exclude<WaterLightPreset, 'custom'>, LightParams> = {
  dawn: {
    lightDir:          norm3([0.70, 0.20, 0.80]),
    lightColor:        [1.00, 0.72, 0.45],   // warm orange specular
    waterColor:        [0.18, 0.04, 0.10],   // deep crimson water
    specularIntensity: 2.2,
    glowIntensity:     0.40,
  },
  noon: {
    lightDir:          norm3([0.35, 0.55, 1.00]),
    lightColor:        [0.75, 0.88, 1.00],   // cool blue-white specular
    waterColor:        [0.00, 0.04, 0.12],   // deep navy water
    specularIntensity: 3.5,
    glowIntensity:     0.20,
  },
  neon: {
    lightDir:          norm3([0.40, 0.40, 1.00]),
    lightColor:        [0.20, 1.00, 0.82],   // cyan-green specular
    waterColor:        [0.00, 0.12, 0.08],   // dark teal water
    specularIntensity: 5.5,
    glowIntensity:     0.90,
  },
  fluorescent: {
    lightDir:          norm3([0.05, 0.90, 1.00]),
    lightColor:        [0.62, 0.82, 0.96],   // pale blue specular
    waterColor:        [0.01, 0.04, 0.16],   // cold indigo water
    specularIntensity: 1.8,
    glowIntensity:     0.15,
  },
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
  if (typeof dir === 'object' && 'x' in dir) return norm3([dir.x, dir.y, dir.z ?? 1]);
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

export function computeDarkness(depth: number, scale: number): number {
  return Math.max(0, Math.min(1, depth * scale));
}

export function darknessToBrightness(darkness: number): number {
  return 1 - darkness * 0.88;
}

export function darknessToTintOpacity(darkness: number): number {
  return darkness * 0.72;
}
