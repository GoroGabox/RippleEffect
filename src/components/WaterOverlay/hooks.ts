import { useRef, useLayoutEffect, useState } from 'react';
import type { UseWaterOverlayReturn, UseWaterItemReturn, WaterZone } from './types';
import { useWaterContext } from './context';

// ─── useWaterOverlay ──────────────────────────────────────────────────────────

/**
 * Returns runtime information about the containing WaterOverlay.
 * Must be called inside a `<WaterOverlay>` tree.
 */
export function useWaterOverlay(): UseWaterOverlayReturn {
  const { level, zoneAt, mode, lightPreset, isInteractive } = useWaterContext();
  return { level, zoneAt, mode, lightPreset, isInteractive };
}

// ─── useWaterItem ─────────────────────────────────────────────────────────────

/**
 * Returns zone / immersion information for the element passed as `ref`.
 * Measures the element position against the current water level.
 *
 * Usage:
 * ```tsx
 * const ref = useRef<HTMLDivElement>(null);
 * const { zone, immersion, isSubmerged } = useWaterItem(ref);
 * return <div ref={ref}>...</div>;
 * ```
 */
export function useWaterItem(
  ref: React.RefObject<Element | null>,
): UseWaterItemReturn {
  const { level, zoneAt } = useWaterContext();

  const [result, setResult] = useState<UseWaterItemReturn>({
    zone:           'above',
    immersion:      0,
    isSubmerged:    false,
    isIntersecting: false,
  });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const compute = () => {
      const rect     = el.getBoundingClientRect();
      const vH       = window.innerHeight;
      // Normalize element vertical center to 0=bottom, 1=top
      const centerNorm = 1 - (rect.top + rect.height / 2) / vH;
      const topNorm    = 1 - rect.top / vH;
      const botNorm    = 1 - rect.bottom / vH;

      const zone:WaterZone = zoneAt(centerNorm);

      // immersion: 0 = fully above, 1 = fully below
      let immersion = 0;
      if (botNorm > level) {
        immersion = 0; // element top is above level
      } else if (topNorm < level) {
        immersion = 1; // fully submerged
      } else {
        immersion = (level - botNorm) / (topNorm - botNorm);
      }

      const isIntersecting = rect.bottom > 0 && rect.top < vH;

      setResult({ zone, immersion, isSubmerged: zone === 'below', isIntersecting });
    };

    compute();

    const ro = new ResizeObserver(compute);
    ro.observe(el);
    window.addEventListener('scroll', compute, { passive: true });
    window.addEventListener('resize', compute);

    return () => {
      ro.disconnect();
      window.removeEventListener('scroll', compute);
      window.removeEventListener('resize', compute);
    };
  }, [ref, level, zoneAt]);

  return result;
}
