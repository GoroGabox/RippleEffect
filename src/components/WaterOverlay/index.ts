// ─── Components ───────────────────────────────────────────────────────────────
export { WaterOverlay }              from './WaterOverlay';
export { WaterItem, Float, Submerged } from './WaterItem';

// ─── Hooks ────────────────────────────────────────────────────────────────────
export { useWaterOverlay, useWaterItem } from './hooks';

// ─── Types ────────────────────────────────────────────────────────────────────
export type {
  WaterOverlayProps,
  WaterOverlayHandle,
  WaterItemProps,
  FloatProps,
  SubmergedProps,
  WaterLevel,
  WaterMode,
  WaterLightPreset,
  WaterLightDirection,
  WaterItemBehavior,
  WaterBuoyancy,
  WaterDistortionLevel,
  WaterOcclusionMode,
  WaterZone,
  WaterLightConfig,
  WaterMaterialConfig,
  WaterInteractionConfig,
  WaterPerformanceConfig,
  WaterLayoutConfig,
  UseWaterOverlayReturn,
  UseWaterItemReturn,
} from './types';
