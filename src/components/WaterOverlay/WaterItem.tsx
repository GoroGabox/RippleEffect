import { createPortal } from 'react-dom';
import type { WaterItemProps, FloatProps, SubmergedProps } from './types';
import { useWaterContext } from './context';

// ─── WaterItem ────────────────────────────────────────────────────────────────

/**
 * Wraps a child element and places it in the correct water layer based on
 * the `behavior` prop.
 *
 * - `float`   → portals to the surface slot (z:10000, no filter)
 * - `fixed`   → same as float but pointer-events enabled
 * - `submerge`→ stays in the submerged slot (filtered)
 * - `auto`    → default; children render inline (submerged)
 */
export function WaterItem({
  children,
  behavior = 'auto',
  className,
  style,
}: WaterItemProps) {
  const { surfaceSlot, submergedSlot } = useWaterContext();

  // float / fixed → portal into surface layer
  if (behavior === 'float' || behavior === 'fixed') {
    if (!surfaceSlot) {
      // slot not yet mounted — render nothing on first pass
      return null;
    }
    return createPortal(
      <div
        className={className}
        style={{
          position: 'absolute', inset: 0,
          pointerEvents: behavior === 'fixed' ? 'auto' : 'none',
          ...style,
        }}
      >
        {children}
      </div>,
      surfaceSlot,
    );
  }

  // submerge → portal to submerged slot (just renders in place by default)
  if (behavior === 'submerge') {
    const target = submergedSlot;
    if (!target) return null;
    return createPortal(
      <div className={className} style={style}>
        {children}
      </div>,
      target,
    );
  }

  // auto — inline, no portal
  return (
    <div className={className} style={style}>
      {children}
    </div>
  );
}

// ─── Convenience wrappers ─────────────────────────────────────────────────────

/** Floats content above the water surface — no distortion, above the overlay canvas. */
export function Float(props: FloatProps) {
  return <WaterItem {...props} behavior="float" />;
}

/** Explicitly submerges content — rendered inside the SVG displacement filter. */
export function Submerged(props: SubmergedProps) {
  return <WaterItem {...props} behavior="submerge" />;
}
