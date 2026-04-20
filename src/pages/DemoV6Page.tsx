import { useRef, useState } from 'react';
import { WaterOverlay, WaterItem, Float } from '../components/WaterOverlay';
import type { WaterOverlayHandle, WaterLightPreset } from '../components/WaterOverlay';

// ─── Tokens ───────────────────────────────────────────────────────────────────

const navy   = '#030c1a';
const textHi = 'rgba(190,225,255,0.93)';
const textMid= 'rgba(130,185,240,0.65)';
const textLo = 'rgba(90,140,210,0.38)';
const accent = 'rgba(70,210,200,0.90)';
const mono   = 'Consolas, monospace';
const sans   = 'Segoe UI, system-ui, sans-serif';

// ─── Presets ──────────────────────────────────────────────────────────────────

const PRESETS: WaterLightPreset[] = ['dawn', 'noon', 'neon', 'fluorescent'];
const PRESET_COLOR: Record<WaterLightPreset, string> = {
  dawn:        'rgba(255,155,60,0.90)',
  noon:        'rgba(110,200,255,0.90)',
  neon:        'rgba(0,255,195,0.90)',
  fluorescent: 'rgba(155,210,245,0.90)',
  custom:      accent,
};

// ─── Depth columns ────────────────────────────────────────────────────────────

const COLUMNS = [
  {
    depth: 0,
    label: 'Superficie',
    depthLabel: 'depth = 0',
    color: 'rgba(0,80,160,0.78)',
    border: 'rgba(60,160,255,0.35)',
    items: ['Plena luz', 'Sin oscurecimiento', 'Caústicas visibles'],
  },
  {
    depth: 0.45,
    label: 'Media Agua',
    depthLabel: 'depth = 0.45',
    color: 'rgba(0,30,75,0.82)',
    border: 'rgba(40,100,200,0.28)',
    items: ['Luz atenuada', 'Tinte azul sutil', 'Ondas presentes'],
  },
  {
    depth: 0.85,
    label: 'Fondo',
    depthLabel: 'depth = 0.85',
    color: 'rgba(0,10,30,0.88)',
    border: 'rgba(20,60,150,0.22)',
    items: ['Casi sin luz', 'Tinte profundo', 'Presión extrema'],
  },
] as const;

// ─── Card ─────────────────────────────────────────────────────────────────────

function DepthCard({
  depth, label, depthLabel, color, border, items,
}: (typeof COLUMNS)[number]) {
  return (
    <WaterItem depth={depth} style={{ flex: '1 1 220px', maxWidth: 300 }}>
      <div style={{
        background: color,
        border: `1px solid ${border}`,
        borderRadius: 14,
        padding: '1.5rem 1.4rem',
        display: 'flex', flexDirection: 'column', gap: '0.9rem',
        height: '100%', boxSizing: 'border-box',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Depth badge */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontFamily: sans, fontSize: '0.60rem', letterSpacing: '0.16em',
            textTransform: 'uppercase', color: accent, opacity: 0.9 }}>
            {label}
          </span>
          <code style={{ fontFamily: mono, fontSize: '0.58rem', color: textMid,
            background: 'rgba(0,0,0,0.3)', padding: '2px 7px', borderRadius: 20 }}>
            {depthLabel}
          </code>
        </div>

        {/* Depth meter */}
        <div style={{
          width: '100%', height: 3, background: 'rgba(255,255,255,0.07)',
          borderRadius: 2, overflow: 'hidden',
        }}>
          <div style={{
            width: `${depth * 100}%`, height: '100%',
            background: `rgba(70,210,200,${0.3 + depth * 0.6})`,
            transition: 'width 0.4s',
          }} />
        </div>

        {/* Items */}
        <ul style={{ margin: 0, padding: 0, listStyle: 'none',
          display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
          {items.map(it => (
            <li key={it} style={{ fontFamily: sans, fontSize: '0.73rem',
              color: textMid, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ width: 4, height: 4, borderRadius: '50%',
                background: accent, opacity: 0.6, flexShrink: 0 }} />
              {it}
            </li>
          ))}
        </ul>

        {/* Depth number (big) */}
        <div style={{ marginTop: 'auto', fontFamily: mono,
          fontSize: '2.2rem', fontWeight: 700, letterSpacing: '-0.02em',
          color: `rgba(190,225,255,${0.12 + (1 - depth) * 0.25})`,
          textAlign: 'right', lineHeight: 1, userSelect: 'none' }}>
          {depth.toFixed(2)}
        </div>
      </div>
    </WaterItem>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DemoV6Page() {
  const overlayRef = useRef<WaterOverlayHandle>(null);
  const [depthScale, setDepthScale] = useState(0.70);
  const [preset, setPreset]         = useState<WaterLightPreset>('noon');

  return (
    <WaterOverlay
      ref={overlayRef}
      level={depthScale}
      mode="interactive"
      light={{ preset }}
      material={{ distortionScale: 1 }}
      interaction={{ ripples: true, rippleStrength: 0.9, rippleRadius: 0.028 }}
      performance={{ quality: 'high' }}
    >
      {/* ── Fondo subacuático ── */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `linear-gradient(180deg, #071428 0%, ${navy} 100%)`,
      }}>
        {/* Grid fino para hacer visible el desplazamiento */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          backgroundImage: `
            linear-gradient(rgba(100,165,255,0.055) 1px, transparent 1px),
            linear-gradient(90deg, rgba(100,165,255,0.055) 1px, transparent 1px)
          `,
          backgroundSize: '36px 36px',
        }} />
      </div>

      {/* ── Columnas a distinta profundidad Z ── */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '7rem 2.5rem 5rem',
        boxSizing: 'border-box',
        gap: '1.1rem',
        flexWrap: 'wrap',
      }}>
        {COLUMNS.map(col => (
          <DepthCard key={col.depthLabel} {...col} />
        ))}
      </div>

      {/* ── Etiqueta inferior ── */}
      <div style={{
        position: 'absolute', bottom: '1.4rem', left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex', alignItems: 'center', gap: '0.7rem',
        pointerEvents: 'none',
      }}>
        <div style={{ width: 5, height: 5, borderRadius: '50%',
          background: accent, boxShadow: `0 0 8px ${accent}` }} />
        <p style={{ fontFamily: sans, fontSize: '0.60rem', letterSpacing: '0.14em',
          textTransform: 'uppercase', color: textLo, margin: 0 }}>
          eje Z · feDisplacementMap · WebGL 512² sim
        </p>
      </div>

      {/* ── Hint arrastre ── */}
      <div style={{
        position: 'absolute', bottom: '1.4rem', right: '2rem',
        fontFamily: sans, fontSize: '0.58rem', letterSpacing: '0.1em',
        color: textLo, userSelect: 'none',
      }}>
        click · drag · touch
      </div>

      {/* ── Float: UI chrome sobre el agua (sin distorsión, sin oscurecer) ── */}
      <Float>
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>

          {/* Header */}
          <div style={{
            position: 'absolute', top: '2rem', left: '2.5rem',
          }}>
            <p style={{ fontFamily: sans, fontSize: '0.58rem', letterSpacing: '0.18em',
              textTransform: 'uppercase', color: textLo, margin: '0 0 0.45rem' }}>
              ripple / v6
            </p>
            <h1 style={{
              fontFamily: sans, fontSize: 'clamp(1.5rem,3.5vw,2.6rem)',
              fontWeight: 200, letterSpacing: '0.06em', color: textHi,
              margin: '0 0 0.35rem',
              textShadow: '0 0 55px rgba(50,175,255,0.30)',
            }}>
              Water Overlay
            </h1>
            <p style={{ fontFamily: sans, fontSize: '0.78rem', color: textMid,
              margin: 0, maxWidth: 360, lineHeight: 1.65 }}>
              Profundidad en eje Z — cada elemento tiene su propio{' '}
              <code style={{ fontFamily: mono, color: accent, fontSize: '0.73rem' }}>depth</code>.
              Más oscuro = más al fondo.
            </p>
          </div>

          {/* Controls */}
          <div style={{
            position: 'absolute', top: '2rem', right: '2.5rem',
            display: 'flex', flexDirection: 'column', gap: '1.1rem',
            alignItems: 'flex-end',
            pointerEvents: 'auto',
          }}>
            {/* Depth scale */}
            <label style={{ display: 'flex', flexDirection: 'column',
              alignItems: 'flex-end', gap: '0.30rem' }}>
              <span style={{ fontFamily: sans, fontSize: '0.56rem', letterSpacing: '0.14em',
                textTransform: 'uppercase', color: textLo }}>
                depth scale
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <input
                  type="range" min={0} max={1} step={0.01}
                  value={depthScale}
                  onChange={e => setDepthScale(parseFloat(e.target.value))}
                  style={{ width: 120, accentColor: accent, cursor: 'pointer' }}
                />
                <code style={{ fontFamily: mono, fontSize: '0.72rem', color: textHi,
                  minWidth: 36, textAlign: 'right' }}>
                  {depthScale.toFixed(2)}
                </code>
              </div>
            </label>

            {/* Preset switcher */}
            <div style={{ display: 'flex', flexDirection: 'column',
              alignItems: 'flex-end', gap: '0.30rem' }}>
              <span style={{ fontFamily: sans, fontSize: '0.56rem', letterSpacing: '0.14em',
                textTransform: 'uppercase', color: textLo }}>
                light
              </span>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                {PRESETS.map(p => (
                  <button
                    key={p}
                    onClick={() => setPreset(p)}
                    style={{
                      fontFamily: sans, fontSize: '0.58rem', letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      background: preset === p ? PRESET_COLOR[p] : 'rgba(0,15,40,0.60)',
                      color: preset === p ? navy : textMid,
                      border: `1px solid ${preset === p ? PRESET_COLOR[p] : 'rgba(60,130,220,0.22)'}`,
                      borderRadius: 20, padding: '4px 11px',
                      cursor: 'pointer', transition: 'all 0.18s',
                    }}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Splash */}
            <button
              onClick={() => overlayRef.current?.splash()}
              style={{
                fontFamily: sans, fontSize: '0.60rem', letterSpacing: '0.12em',
                textTransform: 'uppercase',
                background: 'rgba(70,210,200,0.12)',
                color: accent,
                border: `1px solid ${accent}`,
                borderRadius: 20, padding: '5px 16px',
                cursor: 'pointer', transition: 'background 0.18s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(70,210,200,0.26)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(70,210,200,0.12)')}
            >
              splash ⌁
            </button>
          </div>

          {/* Leyenda de profundidades */}
          <div style={{
            position: 'absolute', bottom: '3.2rem', left: '2.5rem',
            display: 'flex', flexDirection: 'column', gap: '0.45rem',
          }}>
            <span style={{ fontFamily: sans, fontSize: '0.55rem', letterSpacing: '0.14em',
              textTransform: 'uppercase', color: textLo }}>
              profundidad
            </span>
            {[0, 0.25, 0.5, 0.75, 1].map(d => (
              <div key={d} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{
                  width: 28, height: 4, borderRadius: 2,
                  background: `rgba(${Math.round(d * 190)}, ${Math.round(d * 190)}, ${Math.round(d * 190)}, ${1 - d * 0.85})`,
                  border: '1px solid rgba(70,130,220,0.25)',
                }} />
                <code style={{ fontFamily: mono, fontSize: '0.60rem',
                  color: textLo }}>{d.toFixed(2)}</code>
              </div>
            ))}
          </div>
        </div>
      </Float>
    </WaterOverlay>
  );
}
