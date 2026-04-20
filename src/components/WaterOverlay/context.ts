import { createContext, useContext } from 'react';
import type { WaterMode, WaterLightPreset, WaterZone } from './types';

// ─── Internal context shape ────────────────────────────────────────────────────

export interface WaterContextValue {
  /** Normalized water level: 0 = bottom, 1 = top. */
  level:         number;
  mode:          WaterMode;
  lightPreset:   WaterLightPreset;
  isInteractive: boolean;
  /** Returns the zone for a given normalized Y position (0 = bottom, 1 = top). */
  zoneAt: (normalizedY: number) => WaterZone;
  /** DOM element used as portal target for above-water (float/fixed) content. */
  surfaceSlot: HTMLDivElement | null;
  /** DOM element used as portal target for below-water (submerge) content when explicit. */
  submergedSlot: HTMLDivElement | null;
}

// ─── Context ──────────────────────────────────────────────────────────────────

export const WaterContext = createContext<WaterContextValue | null>(null);
WaterContext.displayName = 'WaterContext';

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useWaterContext(): WaterContextValue {
  const ctx = useContext(WaterContext);
  if (!ctx) {
    throw new Error(
      '<WaterItem>, <Float>, <Submerged>, useWaterOverlay, and useWaterItem ' +
      'must be used inside <WaterOverlay>.',
    );
  }
  return ctx;
}
