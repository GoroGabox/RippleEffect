import { createPortal } from 'react-dom';
import type { CSSProperties } from 'react';
import type { WaterItemProps, FloatProps, SubmergedProps } from './types';
import { useWaterContext } from './context';
import { darknessToBrightness, darknessToTintOpacity } from './presets';

// ─── Depth darkening style ────────────────────────────────────────────────────
//
// Modelo Z-axis:
//   depth=0  → superficie → sin oscurecimiento, color original
//   depth=1  → fondo      → casi negro, fuerte tinte azul
//
// Se combina CSS filter(brightness + saturate) con un overlay semitransparente
// de tinte azul oscuro, imitando la absorción de luz a mayor profundidad.

function depthWrapperStyle(darkness: number): CSSProperties {
  if (darkness <= 0.01) return {};
  const brightness = darknessToBrightness(darkness);
  const saturate   = 1 - darkness * 0.50;
  return {
    filter: `brightness(${brightness.toFixed(3)}) saturate(${saturate.toFixed(3)})`,
  };
}

function DepthOverlay({ darkness }: { darkness: number }) {
  if (darkness <= 0.02) return null;
  const opacity = darknessToTintOpacity(darkness);
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute', inset: 0,
        // Tinte azul-oscuro: simula absorción cromática a mayor profundidad
        background: `rgba(0, 8, 28, ${opacity.toFixed(3)})`,
        pointerEvents: 'none',
        borderRadius: 'inherit',
        zIndex: 1,
      }}
    />
  );
}

// ─── WaterItem ────────────────────────────────────────────────────────────────

/**
 * Envuelve contenido y aplica el efecto de profundidad Z del agua.
 *
 * - `depth` (0–1): posición en eje Z.
 *     0 = superficie (brillante, sin oscurecer)
 *     1 = fondo (oscuro, tintado azul)
 *
 * - `behavior`:
 *     'float' / 'fixed' → portal al surface slot (z:10000, sin filtro de distorsión)
 *     'submerge' / 'auto' → dentro del filtro SVG (distorsionado por ondas)
 */
export function WaterItem({
  children,
  behavior = 'auto',
  depth = 0,
  className,
  style,
}: WaterItemProps) {
  const { darknessFor, surfaceSlot } = useWaterContext();
  const darkness = darknessFor(depth);

  // ── float / fixed → portal fuera del filtro SVG ───────────────────────────
  if (behavior === 'float' || behavior === 'fixed') {
    if (!surfaceSlot) return null;
    return createPortal(
      // data-water-surface marca este nodo como "sobre el agua":
      // el WaterOverlay usa closest('[data-water-surface]') para ignorar
      // los eventos que vienen desde aquí y no generar ondas.
      // pointer-events: none en el contenedor — los hijos interactivos
      // (botones, inputs) siguen funcionando por su valor default del browser.
      <div
        data-water-surface="true"
        className={className}
        style={{
          position: 'absolute', inset: 0,
          pointerEvents: 'none',
          ...depthWrapperStyle(darkness),
          ...style,
        }}
      >
        {children}
        <DepthOverlay darkness={darkness} />
      </div>,
      surfaceSlot,
    );
  }

  // ── submerge / auto → dentro del filtro (default) ─────────────────────────
  return (
    <div
      className={className}
      style={{
        position: 'relative',
        ...depthWrapperStyle(darkness),
        ...style,
      }}
    >
      {children}
      <DepthOverlay darkness={darkness} />
    </div>
  );
}

// ─── Convenience wrappers ─────────────────────────────────────────────────────

/**
 * Flotando en la superficie — sin distorsión, sin oscurecimiento por defecto.
 * Útil para UI chrome, labels, controles.
 */
export function Float(props: FloatProps) {
  return <WaterItem {...props} behavior="fixed" />;
}

/**
 * Explícitamente sumergido — dentro del filtro de ondas.
 * El prop `depth` controla el oscurecimiento.
 */
export function Submerged(props: SubmergedProps) {
  return <WaterItem {...props} behavior="submerge" />;
}
