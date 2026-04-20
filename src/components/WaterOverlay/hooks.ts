import { useMemo } from 'react';
import type { UseWaterOverlayReturn, UseWaterItemReturn } from './types';
import { useWaterContext } from './context';
import { darknessToBrightness } from './presets';

// ─── useWaterOverlay ──────────────────────────────────────────────────────────

/**
 * Returns runtime information about the containing WaterOverlay.
 * Must be called inside a `<WaterOverlay>` tree.
 */
export function useWaterOverlay(): UseWaterOverlayReturn {
  const { depthScale, mode, lightPreset, isInteractive } = useWaterContext();
  return { depthScale, mode, lightPreset, isInteractive };
}

// ─── useWaterItem ─────────────────────────────────────────────────────────────

/**
 * Returns darkness / brightness for a given depth within the current WaterOverlay.
 *
 * @param depth  0 = surface (bright), 1 = deep (dark). Default: 0.
 *
 * ```tsx
 * const { darkness, brightness } = useWaterItem(0.6);
 * ```
 */
export function useWaterItem(depth = 0): UseWaterItemReturn {
  const { darknessFor } = useWaterContext();
  return useMemo(() => {
    const darkness = darknessFor(depth);
    return { darkness, brightness: darknessToBrightness(darkness) };
  }, [darknessFor, depth]);
}
