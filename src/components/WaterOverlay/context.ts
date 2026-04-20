import { createContext, useContext } from 'react';
import type { WaterMode, WaterLightPreset } from './types';

// ─── Internal context shape ────────────────────────────────────────────────────

export interface WaterContextValue {
  /** Escala global de profundidad (0=cristalino, 1=muy profundo). */
  depthScale:    number;
  mode:          WaterMode;
  lightPreset:   WaterLightPreset;
  isInteractive: boolean;
  /** Computa oscurecimiento final para un item con depth dado. */
  darknessFor:   (depth: number) => number;
  /** Portal target para contenido que flota sobre el agua (float/fixed). */
  surfaceSlot:   HTMLDivElement | null;
}

// ─── Context ──────────────────────────────────────────────────────────────────

export const WaterContext = createContext<WaterContextValue | null>(null);
WaterContext.displayName = 'WaterContext';

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useWaterContext(): WaterContextValue {
  const ctx = useContext(WaterContext);
  if (!ctx) {
    throw new Error(
      '<WaterItem>, <Float>, <Submerged>, useWaterOverlay y useWaterItem ' +
      'deben usarse dentro de <WaterOverlay>.',
    );
  }
  return ctx;
}
