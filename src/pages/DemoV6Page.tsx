import { useRef, useState } from 'react';
import { WaterOverlay, Float } from '../components/WaterOverlay';
import type { WaterOverlayHandle, WaterLightPreset } from '../components/WaterOverlay';

// ─── Design tokens ────────────────────────────────────────────────────────────

const navy    = '#050e1f';
const textHi  = 'rgba(190,225,255,0.92)';
const textMid = 'rgba(140,190,240,0.60)';
const textLo  = 'rgba(100,150,210,0.35)';
const accent  = 'rgba(80,200,200,0.85)';
const font    = 'Segoe UI, system-ui, sans-serif';

// ─── Preset badge ─────────────────────────────────────────────────────────────

const PRESETS: WaterLightPreset[] = ['dawn', 'noon', 'neon', 'fluorescent'];

const PRESET_COLORS: Record<WaterLightPreset, string> = {
  dawn:        'rgba(255,160,60,0.85)',
  noon:        'rgba(120,200,255,0.85)',
  neon:        'rgba(0,255,200,0.85)',
  fluorescent: 'rgba(160,210,240,0.85)',
  custom:      accent,
};

// ─── Metric cards (submerged) ─────────────────────────────────────────────────

const METRICS = [
  { value: '512²', unit: 'grid',    label: 'Wave simulation' },
  { value: '1.49', unit: 'km/s',    label: 'Sound in water'  },
  { value: '98.4', unit: '%/frame', label: 'Damping factor'  },
  { value: '128²', unit: 'disp',    label: 'Normal map res'  },
];

function MetricCard({ value, unit, label }: (typeof METRICS)[0]) {
  return (
    <div style={{
      background: 'rgba(0,40,90,0.55)',
      border: '1px solid rgba(80,160,255,0.20)',
      borderRadius: 12,
      padding: '1.1rem 1.3rem',
      display: 'flex', flexDirection: 'column', gap: '0.4rem',
      minWidth: 140, flex: '1 1 140px',
      backdropFilter: 'blur(6px)',
      WebkitBackdropFilter: 'blur(6px)',
    }}>
      <div style={{ fontFamily: font, fontSize: '1.5rem', fontWeight: 300,
        color: textHi, letterSpacing: '0.02em', lineHeight: 1 }}>
        {value}
        <span style={{ fontSize: '0.65rem', color: accent, marginLeft: 4,
          letterSpacing: '0.1em', textTransform: 'uppercase' }}>{unit}</span>
      </div>
      <div style={{ fontFamily: font, fontSize: '0.68rem', color: textMid,
        letterSpacing: '0.08em', textTransform: 'uppercase' }}>
        {label}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DemoV6Page() {
  const overlayRef = useRef<WaterOverlayHandle>(null);
  const [preset, setPreset]     = useState<WaterLightPreset>('noon');
  const [level, setLevel]       = useState(50); // 0=top, 100=bottom (CSS %)

  // ── Submerged content (children — inside displacement filter) ─────────────
  const underwaterContent = (
    <div style={{
      position: 'absolute', inset: 0,
      background: `linear-gradient(175deg, ${navy} 0%, #020810 100%)`,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: '2rem',
      padding: '2rem 2.5rem',
      boxSizing: 'border-box',
    }}>
      {/* Fine grid — makes displacement extremely visible */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: `
          linear-gradient(rgba(100,160,255,0.05) 1px, transparent 1px),
          linear-gradient(90deg, rgba(100,160,255,0.05) 1px, transparent 1px)
        `,
        backgroundSize: '32px 32px',
      }} />

      {/* Metric card row */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: '0.85rem',
        justifyContent: 'center', width: '100%', maxWidth: 700,
        position: 'relative',
      }}>
        {METRICS.map(m => <MetricCard key={m.label} {...m} />)}
      </div>

      {/* Label bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.75rem',
        position: 'relative',
      }}>
        <div style={{
          width: 6, height: 6, borderRadius: '50%',
          background: accent, boxShadow: `0 0 8px ${accent}`,
        }} />
        <p style={{
          fontFamily: font, fontSize: '0.62rem', letterSpacing: '0.14em',
          textTransform: 'uppercase', color: textLo, margin: 0,
        }}>
          underwater · feDisplacementMap · WebGL wave sim
        </p>
      </div>

      {/* Bottom-right hint */}
      <div style={{
        position: 'absolute', bottom: '1.2rem', right: '2rem',
        fontFamily: font, fontSize: '0.58rem', letterSpacing: '0.1em',
        color: textLo, userSelect: 'none',
      }}>
        click · drag · touch
      </div>
    </div>
  );

  return (
    <WaterOverlay
      ref={overlayRef}
      level={`${level}%`}
      mode="interactive"
      light={{ preset }}
      material={{ opacity: 0.10, distortionScale: 1, surfaceBand: 0.018, edgeHighlight: 0.4 }}
      interaction={{ ripples: true, rippleStrength: 0.9, rippleRadius: 0.028 }}
      performance={{ quality: 'high' }}
      debug={false}
    >
      {underwaterContent}

      {/* Float — surface content escapes the filter */}
      <Float behavior="fixed">
        <div style={{
          position: 'absolute', inset: 0,
          pointerEvents: 'none',
        }}>
          {/* ── Header ── */}
          <div style={{
            position: 'absolute',
            top: '2.2rem', left: '2.5rem', right: '2.5rem',
          }}>
            <p style={{
              fontFamily: font, fontSize: '0.60rem', letterSpacing: '0.18em',
              textTransform: 'uppercase', color: textLo, margin: '0 0 0.5rem',
            }}>
              ripple / v6
            </p>
            <h1 style={{
              fontFamily: font, fontSize: 'clamp(1.6rem, 3.8vw, 2.8rem)',
              fontWeight: 200, letterSpacing: '0.06em', color: textHi,
              margin: '0 0 0.4rem',
              textShadow: '0 0 60px rgba(60,180,255,0.30)',
            }}>
              Water Overlay
            </h1>
            <p style={{
              fontFamily: font, fontSize: '0.80rem', color: textMid,
              margin: 0, maxWidth: 400, lineHeight: 1.65,
            }}>
              HTML below the surface is distorted by a live wave simulation.
              Click or drag to create ripples.
            </p>
          </div>

          {/* ── Controls (pointer-events auto) ── */}
          <div style={{
            position: 'absolute',
            top: '2.2rem', right: '2.5rem',
            display: 'flex', flexDirection: 'column', gap: '1.2rem',
            alignItems: 'flex-end',
            pointerEvents: 'auto',
          }}>
            {/* Water level */}
            <label style={{
              display: 'flex', flexDirection: 'column', alignItems: 'flex-end',
              gap: '0.35rem',
            }}>
              <span style={{ fontFamily: font, fontSize: '0.58rem', letterSpacing: '0.14em',
                textTransform: 'uppercase', color: textLo }}>
                water level
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <input
                  type="range" min={0} max={100} value={level}
                  onChange={e => setLevel(Number(e.target.value))}
                  style={{ width: 130, accentColor: accent, cursor: 'pointer' }}
                />
                <input
                  type="number" min={0} max={100} value={level}
                  onChange={e => setLevel(Math.max(0, Math.min(100, Number(e.target.value))))}
                  style={{
                    width: 50, background: 'rgba(0,20,50,0.7)',
                    border: '1px solid rgba(80,160,255,0.25)',
                    borderRadius: 6, padding: '3px 6px',
                    fontFamily: 'monospace', fontSize: '0.75rem',
                    color: textHi, textAlign: 'center',
                  }}
                />
              </div>
            </label>

            {/* Light preset switcher */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.35rem' }}>
              <span style={{ fontFamily: font, fontSize: '0.58rem', letterSpacing: '0.14em',
                textTransform: 'uppercase', color: textLo }}>
                light preset
              </span>
              <div style={{ display: 'flex', gap: '0.45rem' }}>
                {PRESETS.map(p => (
                  <button
                    key={p}
                    onClick={() => setPreset(p)}
                    style={{
                      fontFamily: font, fontSize: '0.60rem', letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      background: preset === p ? PRESET_COLORS[p] : 'rgba(0,20,50,0.55)',
                      color: preset === p ? navy : textMid,
                      border: `1px solid ${preset === p ? PRESET_COLORS[p] : 'rgba(80,160,255,0.20)'}`,
                      borderRadius: 20, padding: '4px 12px',
                      cursor: 'pointer', transition: 'all 0.2s',
                    }}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Splash button */}
            <button
              onClick={() => overlayRef.current?.splash()}
              style={{
                fontFamily: font, fontSize: '0.62rem', letterSpacing: '0.12em',
                textTransform: 'uppercase',
                background: 'rgba(80,200,200,0.15)',
                color: accent,
                border: `1px solid ${accent}`,
                borderRadius: 20, padding: '5px 16px',
                cursor: 'pointer', transition: 'background 0.2s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(80,200,200,0.28)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(80,200,200,0.15)')}
            >
              splash ⌁
            </button>
          </div>
        </div>
      </Float>
    </WaterOverlay>
  );
}
