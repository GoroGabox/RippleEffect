import { useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { WaterOverlay, WaterItem, Float } from '../components/WaterOverlay';
import type {
  WaterOverlayHandle, WaterLightPreset, WaterMode, WaterLightDirection,
} from '../components/WaterOverlay';
import { LIGHT_PRESETS, rgbToHex } from '../components/WaterOverlay/presets';

// ─── Design tokens ────────────────────────────────────────────────────────────

const C = {
  bg:          '#020c1a',
  panelBg:     'rgba(3, 14, 30, 0.91)',
  panelBorder: 'rgba(45, 120, 210, 0.20)',
  sectionLine: 'rgba(45, 120, 210, 0.12)',
  accent:      '#38c9b8',
  accentFaint: 'rgba(56,201,184,0.18)',
  hi:          'rgba(205,232,255,0.93)',
  mid:         'rgba(135,188,240,0.62)',
  lo:          'rgba(85,135,205,0.38)',
  code:        'rgba(56,201,184,0.82)',
  sans:        'Segoe UI, system-ui, sans-serif',
  mono:        'Consolas, monospace',
  PANEL_W:     400,
} as const;

// ─── Panel primitives ─────────────────────────────────────────────────────────

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ borderTop: `1px solid ${C.sectionLine}`, paddingTop: '0.75rem', marginTop: '0.75rem' }}>
      <div style={{ fontFamily: C.sans, fontSize: '0.52rem', letterSpacing: '0.18em',
        textTransform: 'uppercase', color: C.accent, opacity: 0.8, marginBottom: '0.55rem' }}>
        {label}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
        {children}
      </div>
    </div>
  );
}

function Row({ label, prop, children }: { label: string; prop: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <span style={{ fontFamily: C.sans, fontSize: '0.66rem', color: C.mid }}>{label}</span>
        <code style={{ fontFamily: C.mono, fontSize: '0.54rem', color: C.lo }}>{prop}</code>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
        {children}
      </div>
    </div>
  );
}

function SliderRow({
  label, prop, min, max, step = 0.01, value, onChange, fmt,
}: {
  label: string; prop: string; min: number; max: number; step?: number;
  value: number; onChange: (v: number) => void; fmt?: (v: number) => string;
}) {
  return (
    <Row label={label} prop={prop}>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{ width: 100, accentColor: C.accent, cursor: 'pointer' }} />
      <code style={{ fontFamily: C.mono, fontSize: '0.64rem', color: C.hi, minWidth: 34, textAlign: 'right' }}>
        {fmt ? fmt(value) : value.toFixed(2)}
      </code>
    </Row>
  );
}

function Pills<T extends string>({
  label, prop, options, value, onChange,
}: {
  label: string; prop: string; options: readonly T[]; value: T;
  onChange: (v: T) => void;
}) {
  return (
    <Row label={label} prop={prop}>
      <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        {options.map(o => {
          const active = o === value;
          return (
            <button key={o} onClick={() => onChange(o)}
              style={{
                fontFamily: C.sans, fontSize: '0.55rem', letterSpacing: '0.06em',
                textTransform: 'uppercase',
                background: active ? C.accent : 'rgba(0,15,40,0.6)',
                color: active ? C.bg : C.mid,
                border: `1px solid ${active ? C.accent : 'rgba(50,120,210,0.22)'}`,
                borderRadius: 20, padding: '3px 9px', cursor: 'pointer',
                transition: 'all 0.15s',
              }}>
              {o}
            </button>
          );
        })}
      </div>
    </Row>
  );
}

function Toggler({ label, prop, value, onChange }: {
  label: string; prop: string; value: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <Row label={label} prop={prop}>
      <button onClick={() => onChange(!value)}
        style={{
          fontFamily: C.mono, fontSize: '0.64rem',
          background: value ? C.accentFaint : 'rgba(0,15,40,0.6)',
          color: value ? C.accent : C.lo,
          border: `1px solid ${value ? C.accent : 'rgba(50,120,210,0.22)'}`,
          borderRadius: 20, padding: '3px 16px', cursor: 'pointer', transition: 'all 0.15s',
        }}>
        {value ? 'on' : 'off'}
      </button>
    </Row>
  );
}

// ─── Effect button ────────────────────────────────────────────────────────────

function EffectBtn({
  children, onClick, active, danger, style: extraStyle,
}: {
  children: ReactNode;
  onClick: () => void;
  active?: boolean;
  danger?: boolean;
  style?: CSSProperties;
}) {
  const col = danger ? 'rgba(255,90,90,0.85)' : C.accent;
  const bg  = active
    ? (danger ? 'rgba(255,60,60,0.18)' : C.accentFaint)
    : 'rgba(0,15,40,0.6)';
  return (
    <button
      onClick={onClick}
      style={{
        fontFamily: C.mono, fontSize: '0.60rem', letterSpacing: '0.04em',
        background: bg, color: active ? col : (danger ? col : C.mid),
        border: `1px solid ${active ? col : (danger ? 'rgba(255,90,90,0.35)' : 'rgba(50,120,210,0.28)')}`,
        borderRadius: 20, padding: '4px 12px', cursor: 'pointer',
        transition: 'all 0.15s', whiteSpace: 'nowrap',
        ...extraStyle,
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = danger ? 'rgba(255,60,60,0.28)' : 'rgba(56,201,184,0.25)';
        e.currentTarget.style.color = col;
        e.currentTarget.style.borderColor = col;
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = bg;
        e.currentTarget.style.color = active ? col : (danger ? col : C.mid);
        e.currentTarget.style.borderColor = active ? col : (danger ? 'rgba(255,90,90,0.35)' : 'rgba(50,120,210,0.28)');
      }}
    >
      {children}
    </button>
  );
}

// ─── Compass direction grid ───────────────────────────────────────────────────

type DirCell = [WaterLightDirection, string] | null;
const DIR_CELLS: DirCell[] = [
  ['top-left',    '↖'], ['top',    '↑'], ['top-right',    '↗'],
  ['left',        '←'], null,            ['right',        '→'],
  ['bottom-left', '↙'], ['bottom', '↓'], ['bottom-right', '↘'],
];

function DirGrid({ value, onChange }: { value: WaterLightDirection; onChange: (d: WaterLightDirection) => void }) {
  return (
    <Row label="direction" prop="light.direction">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 24px)', gap: 2 }}>
        {DIR_CELLS.map((cell, i) => {
          if (!cell) {
            return (
              <div key={i} style={{ width: 24, height: 24, display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                color: C.lo, fontSize: '0.5rem' }}>·</div>
            );
          }
          const [dir, symbol] = cell;
          const isActive = dir === value;
          return (
            <button key={i} onClick={() => onChange(dir)}
              style={{
                width: 24, height: 24, padding: 0, cursor: 'pointer',
                background: isActive ? C.accentFaint : 'rgba(0,15,40,0.55)',
                border: `1px solid ${isActive ? C.accent : 'rgba(50,120,210,0.20)'}`,
                borderRadius: 4, color: isActive ? C.accent : C.mid,
                fontFamily: C.mono, fontSize: '0.75rem', lineHeight: 1,
                transition: 'all 0.12s',
              }}>
              {symbol}
            </button>
          );
        })}
      </div>
    </Row>
  );
}

// ─── Light preset list with color swatches ────────────────────────────────────

type KnownPreset = Exclude<WaterLightPreset, 'custom'>;

const PRESET_META: Record<KnownPreset, string> = {
  dawn:        'warm · golden hour',
  noon:        'cool · daylight',
  neon:        'cyberpunk · vivid',
  fluorescent: 'clinical · pale',
};

const KNOWN_PRESETS: KnownPreset[] = ['dawn', 'noon', 'neon', 'fluorescent'];

function Swatch({ color, size = 14 }: { color: string; size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: 3,
      background: color, border: '1px solid rgba(255,255,255,0.13)',
      flexShrink: 0,
    }} />
  );
}

function PresetList({
  value, highlightHex, waterHex,
  onSelect,
}: {
  value: WaterLightPreset;
  highlightHex: string;
  waterHex: string;
  onSelect: (p: KnownPreset) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {KNOWN_PRESETS.map(p => {
        const isActive = p === value;
        const lp = LIGHT_PRESETS[p];
        const hl = rgbToHex(lp.lightColor);
        const wt = rgbToHex(lp.waterColor);
        return (
          <button key={p} onClick={() => onSelect(p)}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.45rem',
              background: isActive ? 'rgba(56,201,184,0.09)' : 'rgba(0,12,32,0.55)',
              border: `1px solid ${isActive ? 'rgba(56,201,184,0.40)' : 'rgba(50,120,210,0.16)'}`,
              borderRadius: 6, padding: '5px 8px', cursor: 'pointer',
              transition: 'all 0.12s', textAlign: 'left', width: '100%',
            }}>
            {/* Active dot */}
            <div style={{
              width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
              background: isActive ? C.accent : 'rgba(85,135,205,0.25)',
              transition: 'background 0.12s',
            }} />
            {/* Name */}
            <span style={{
              fontFamily: C.mono, fontSize: '0.60rem', flexShrink: 0, width: 76,
              color: isActive ? C.accent : C.mid,
            }}>{p}</span>
            {/* Desc */}
            <span style={{
              fontFamily: C.sans, fontSize: '0.50rem', color: C.lo, flex: 1,
              overflow: 'hidden', whiteSpace: 'nowrap',
            }}>{PRESET_META[p]}</span>
            {/* Color swatches: highlight + water */}
            <div style={{ display: 'flex', gap: 3, alignItems: 'center', flexShrink: 0 }}>
              <Swatch color={hl} />
              <Swatch color={wt} />
            </div>
          </button>
        );
      })}

      {/* Custom indicator (shown when user edited colors) */}
      {value === 'custom' && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.45rem',
          background: 'rgba(56,201,184,0.07)',
          border: `1px dashed rgba(56,201,184,0.35)`,
          borderRadius: 6, padding: '5px 8px',
        }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: C.accent, flexShrink: 0 }} />
          <span style={{ fontFamily: C.mono, fontSize: '0.60rem', color: C.accent, flexShrink: 0, width: 76 }}>custom</span>
          <span style={{ fontFamily: C.sans, fontSize: '0.50rem', color: C.lo, flex: 1 }}>modified</span>
          <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
            <Swatch color={highlightHex} />
            <Swatch color={waterHex} />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Color picker row ─────────────────────────────────────────────────────────

function ColorRow({
  label, prop, value, onChange,
}: {
  label: string; prop: string; value: string; onChange: (hex: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <Row label={label} prop={prop}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', cursor: 'pointer' }}
        onClick={() => inputRef.current?.click()}>
        {/* Swatch */}
        <div style={{
          width: 20, height: 20, borderRadius: 4,
          background: value,
          border: '2px solid rgba(255,255,255,0.18)',
          flexShrink: 0,
          boxShadow: `0 0 6px ${value}55`,
          transition: 'box-shadow 0.15s',
        }} />
        <code style={{ fontFamily: C.mono, fontSize: '0.60rem', color: C.hi, userSelect: 'none' }}>
          {value}
        </code>
        {/* Hidden native color input */}
        <input
          ref={inputRef}
          type="color"
          value={value}
          onChange={e => onChange(e.target.value)}
          style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }}
        />
      </div>
    </Row>
  );
}

// ─── Current color set display ────────────────────────────────────────────────

function ColorSetDisplay({ highlightHex, waterHex }: { highlightHex: string; waterHex: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0.5rem',
      background: 'rgba(0,8,22,0.55)',
      border: `1px solid rgba(50,120,210,0.14)`,
      borderRadius: 6, padding: '6px 8px',
    }}>
      <span style={{ fontFamily: C.sans, fontSize: '0.52rem', color: C.lo, flexShrink: 0 }}>current set</span>
      <div style={{ flex: 1 }} />
      {/* Highlight swatch + label */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <Swatch color={highlightHex} size={16} />
        <span style={{ fontFamily: C.sans, fontSize: '0.48rem', color: C.lo }}>hi</span>
      </div>
      {/* Water swatch + label */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <Swatch color={waterHex} size={16} />
        <span style={{ fontFamily: C.sans, fontSize: '0.48rem', color: C.lo }}>water</span>
      </div>
    </div>
  );
}

// ─── Live code preview ────────────────────────────────────────────────────────

function CodePreview({ level, mode, preset, lightDir, specular, glow, highlightHex, waterHex,
  distortionScale, ripples, rippleStrength, rippleRadius, quality, debug, itemDepth }: {
  level: number; mode: WaterMode; preset: WaterLightPreset;
  lightDir: WaterLightDirection; specular: number; glow: number;
  highlightHex: string; waterHex: string;
  distortionScale: number; ripples: boolean; rippleStrength: number;
  rippleRadius: number; quality: string; debug: boolean; itemDepth: number;
}) {
  const dir = typeof lightDir === 'string' ? `"${lightDir}"` : `{x:${(lightDir as {x:number}).x}}`;
  const lines = [
    `<WaterOverlay`,
    `  level={${level.toFixed(2)}}`,
    `  mode="${mode}"`,
    `  debug={${debug}}`,
    `  light={{`,
    `    preset: "${preset}",`,
    `    direction: ${dir},`,
    `    specular: ${specular.toFixed(2)},`,
    `    glow: ${glow.toFixed(2)},`,
    `    color: "${highlightHex}",`,
    `  }}`,
    `  material={{`,
    `    distortionScale: ${distortionScale.toFixed(2)},`,
    `    tint: "${waterHex}",`,
    `  }}`,
    `  interaction={{`,
    `    ripples: ${ripples},`,
    `    rippleStrength: ${rippleStrength.toFixed(2)},`,
    `    rippleRadius: ${rippleRadius.toFixed(3)},`,
    `  }}`,
    `  performance={{ quality: "${quality}" }}`,
    `>`,
    `  <WaterItem depth={${itemDepth.toFixed(2)}}>`,
    `    {/* submerged content */}`,
    `  </WaterItem>`,
    `  <Float>{/* surface UI */}</Float>`,
    `</WaterOverlay>`,
  ];
  return (
    <div style={{ borderTop: `1px solid ${C.sectionLine}`, paddingTop: '0.75rem', marginTop: '0.75rem' }}>
      <div style={{ fontFamily: C.sans, fontSize: '0.52rem', letterSpacing: '0.18em',
        textTransform: 'uppercase', color: C.accent, opacity: 0.8, marginBottom: '0.5rem' }}>
        live code
      </div>
      <pre style={{
        fontFamily: C.mono, fontSize: '0.57rem', lineHeight: 1.6,
        color: C.mid, background: 'rgba(0,8,20,0.6)',
        border: `1px solid ${C.sectionLine}`,
        borderRadius: 6, padding: '0.6rem 0.7rem',
        overflowX: 'auto', margin: 0,
        whiteSpace: 'pre',
      }}>
        {lines.map((l, i) => (
          <span key={i} style={{ display: 'block' }}>
            {l.split(/(["'][^"']*["']|{[^}]*}|\d+\.\d+|true|false)/g).map((part, j) => {
              const isStr = /^["']/.test(part);
              const isNum = /^\d+\.\d+$/.test(part) || part === 'true' || part === 'false';
              return (
                <span key={j} style={{
                  color: isStr ? 'rgba(200,160,100,0.85)' : isNum ? 'rgba(130,210,180,0.85)' : C.mid,
                }}>{part}</span>
              );
            })}
          </span>
        ))}
      </pre>
    </div>
  );
}

// ─── Depth showcase card ──────────────────────────────────────────────────────

function DepthCard({ depth, label }: { depth: number; label: string }) {
  return (
    <WaterItem depth={depth} style={{ flex: '1 1 140px', maxWidth: 200 }}>
      <div style={{
        background: 'rgba(0,30,70,0.65)',
        border: '1px solid rgba(60,140,255,0.22)',
        borderRadius: 12, padding: '1rem 1.1rem',
        display: 'flex', flexDirection: 'column', gap: '0.5rem',
      }}>
        <span style={{ fontFamily: C.sans, fontSize: '0.56rem', letterSpacing: '0.14em',
          textTransform: 'uppercase', color: C.accent, opacity: 0.75 }}>{label}</span>
        <div style={{ fontFamily: C.mono, fontSize: '1.8rem', fontWeight: 700,
          color: `rgba(200,230,255,${0.15 + (1 - depth) * 0.7})`, lineHeight: 1 }}>
          {depth.toFixed(2)}
        </div>
        <div style={{ fontFamily: C.sans, fontSize: '0.62rem', color: C.mid }}>
          depth = {depth.toFixed(2)}
        </div>
        <div style={{ width: '100%', height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
          <div style={{ width: `${depth * 100}%`, height: '100%', borderRadius: 2,
            background: `rgba(56,201,184,${0.25 + depth * 0.6})` }} />
        </div>
      </div>
    </WaterItem>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DemoV6Page() {
  const overlayRef = useRef<WaterOverlayHandle>(null);

  // Global
  const [level, setLevel]   = useState(0.70);
  const [mode, setMode]     = useState<WaterMode>('interactive');
  const [debug, setDebug]   = useState(false);

  // Light — preset + per-channel colors
  const [preset, setPreset]       = useState<WaterLightPreset>('noon');
  const [lightDir, setLightDir]   = useState<WaterLightDirection>('top');
  const [specular, setSpecular]   = useState(1.0);
  const [glow, setGlow]           = useState(1.0);
  const [highlightHex, setHighlightHex] = useState(() => rgbToHex(LIGHT_PRESETS.noon.lightColor));
  const [waterHex, setWaterHex]         = useState(() => rgbToHex(LIGHT_PRESETS.noon.waterColor));

  // Preset selection — loads both colors
  const selectPreset = (p: KnownPreset) => {
    setPreset(p);
    setHighlightHex(rgbToHex(LIGHT_PRESETS[p].lightColor));
    setWaterHex(rgbToHex(LIGHT_PRESETS[p].waterColor));
  };

  // Color edits — switch to custom set
  const onHighlightChange = (hex: string) => { setHighlightHex(hex); setPreset('custom'); };
  const onWaterChange     = (hex: string) => { setWaterHex(hex);     setPreset('custom'); };

  // Material
  const [distortionScale, setDistortionScale] = useState(1.0);

  // Interaction
  const [ripples, setRipples]               = useState(true);
  const [rippleStrength, setRippleStrength] = useState(0.9);
  const [rippleRadius, setRippleRadius]     = useState(0.028);

  // Performance
  const [quality, setQuality] = useState<'auto' | 'low' | 'medium' | 'high'>('high');

  // WaterItem demo depth
  const [itemDepth, setItemDepth] = useState(0.5);

  // Handle — programmatic effects
  const [rainActive, setRainActive]     = useState(false);
  const [rainIntensity, setRainIntensity] = useState(0.5);
  const rainCancelRef = useRef<(() => void) | null>(null);

  const [vibStrength, setVibStrength]   = useState(1.0);
  const [vibDuration, setVibDuration]   = useState(1000);

  const [waveDir, setWaveDir]           = useState<'left'|'right'|'top'|'bottom'>('right');
  const [waveStrength, setWaveStrength] = useState(1.0);

  const [trailMode, setTrailMode]       = useState(false);

  // Rain toggle
  const toggleRain = () => {
    if (rainActive) {
      rainCancelRef.current?.();
      rainCancelRef.current = null;
      setRainActive(false);
    } else {
      rainCancelRef.current = overlayRef.current?.rain(rainIntensity) ?? null;
      setRainActive(true);
    }
  };
  // Sync intensity when slider changes while rain is running
  const onRainIntensityChange = (v: number) => {
    setRainIntensity(v);
    if (rainActive) {
      rainCancelRef.current?.();
      rainCancelRef.current = overlayRef.current?.rain(v) ?? null;
    }
  };

  const panelStyle: CSSProperties = {
    position: 'absolute', top: 0, right: 0,
    width: C.PANEL_W, height: '100%',
    background: C.panelBg,
    backdropFilter: 'blur(22px)', WebkitBackdropFilter: 'blur(22px)',
    borderLeft: `1px solid ${C.panelBorder}`,
    overflowY: 'auto', overflowX: 'hidden',
    boxSizing: 'border-box',
    padding: '1rem 1rem 2rem',
    pointerEvents: 'auto',
  };

  return (
    <WaterOverlay
      ref={overlayRef}
      level={level}
      mode={mode}
      debug={debug}
      light={{ preset, direction: lightDir, specular, glow, color: highlightHex }}
      material={{ distortionScale, tint: waterHex }}
      interaction={{ ripples, rippleStrength, rippleRadius }}
      performance={{ quality }}
    >

      {/* ── Underwater scene (distorted by waves) ─────────────────────────── */}
      <div
        style={{ position: 'absolute', inset: 0,
          background: `linear-gradient(175deg, #071428 0%, ${C.bg} 100%)`,
          cursor: trailMode ? 'crosshair' : 'default',
        }}
        onPointerMove={trailMode ? e => overlayRef.current?.trail(e.clientX, e.clientY) : undefined}
      >

        {/* Grid texture */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          backgroundImage: `
            linear-gradient(rgba(100,165,255,0.055) 1px, transparent 1px),
            linear-gradient(90deg, rgba(100,165,255,0.055) 1px, transparent 1px)
          `,
          backgroundSize: '36px 36px',
        }} />

        {/* Depth showcase cards — positioned to the left of the panel */}
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          paddingRight: C.PANEL_W + 16, paddingLeft: 24,
          boxSizing: 'border-box',
          flexDirection: 'column', gap: '1.5rem',
        }}>
          {/* Fixed depth cards */}
          <div style={{ display: 'flex', gap: '0.85rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            <DepthCard depth={0}    label="Surface"   />
            <DepthCard depth={0.45} label="Mid"       />
            <DepthCard depth={0.90} label="Deep"      />
          </div>

          {/* Interactive depth card */}
          <WaterItem depth={itemDepth} style={{ width: '100%', maxWidth: 430 }}>
            <div style={{
              background: 'rgba(0,20,55,0.72)',
              border: '1px solid rgba(56,201,184,0.20)',
              borderRadius: 12, padding: '1.1rem 1.3rem',
              display: 'flex', flexDirection: 'column', gap: '0.6rem',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: C.sans, fontSize: '0.56rem', letterSpacing: '0.14em',
                  textTransform: 'uppercase', color: C.accent, opacity: 0.75 }}>
                  interactive depth
                </span>
                <code style={{ fontFamily: C.mono, fontSize: '0.62rem', color: C.hi }}>
                  depth={itemDepth.toFixed(2)}
                </code>
              </div>
              <p style={{ fontFamily: C.sans, fontSize: '0.70rem', color: C.mid,
                margin: 0, lineHeight: 1.6 }}>
                Este elemento usa el prop <code style={{ color: C.code, fontFamily: C.mono }}>depth</code> de{' '}
                <code style={{ color: C.code, fontFamily: C.mono }}>&lt;WaterItem&gt;</code>.
                Controla su oscurecimiento en el eje Z del agua.
              </p>
              <div style={{ width: '100%', height: 3, background: 'rgba(255,255,255,0.06)',
                borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ width: `${itemDepth * 100}%`, height: '100%',
                  background: `rgba(56,201,184,${0.4 + itemDepth * 0.55})`,
                  transition: 'width 0.05s', borderRadius: 2 }} />
              </div>
            </div>
          </WaterItem>
        </div>

        {/* Bottom hint */}
        <div style={{ position: 'absolute', bottom: '1.2rem', left: '50%',
          transform: `translateX(calc(-50% - ${C.PANEL_W / 2}px))`,
          fontFamily: C.sans, fontSize: '0.58rem', letterSpacing: '0.12em',
          color: C.lo, userSelect: 'none', textTransform: 'uppercase' }}>
          click · drag · touch to create ripples
        </div>
      </div>

      {/* ── Float: API control panel above the water (no distortion) ──────── */}
      <Float>
        {/* Page title — top-left */}
        <div style={{ position: 'absolute', top: '1.6rem', left: '1.6rem',
          pointerEvents: 'none' }}>
          <p style={{ fontFamily: C.sans, fontSize: '0.55rem', letterSpacing: '0.18em',
            textTransform: 'uppercase', color: C.lo, margin: '0 0 0.3rem' }}>
            ripple / v6
          </p>
          <h1 style={{ fontFamily: C.sans, fontSize: 'clamp(1.2rem,2.5vw,2rem)',
            fontWeight: 200, letterSpacing: '0.06em', color: C.hi, margin: 0,
            textShadow: '0 0 40px rgba(50,175,255,0.30)' }}>
            WaterOverlay
          </h1>
        </div>

        {/* API Panel — right sidebar */}
        <div style={panelStyle}>
          {/* Panel header */}
          <div style={{ marginBottom: '0.5rem' }}>
            <p style={{ fontFamily: C.sans, fontSize: '0.50rem', letterSpacing: '0.18em',
              textTransform: 'uppercase', color: C.lo, margin: '0 0 0.2rem' }}>
              api explorer
            </p>
            <p style={{ fontFamily: C.mono, fontSize: '0.70rem', color: C.accent,
              margin: 0 }}>
              WaterOverlay v6
            </p>
          </div>

          {/* ── Global ───────────────────────────────────────────────────── */}
          <Section label="Global">
            <SliderRow label="depth scale" prop="level" min={0} max={1} value={level}
              onChange={setLevel} />
            <Pills label="mode" prop="mode"
              options={['interactive', 'static'] as const}
              value={mode} onChange={setMode} />
            <Toggler label="debug HUD" prop="debug" value={debug} onChange={setDebug} />
          </Section>

          {/* ── Light ────────────────────────────────────────────────────── */}
          <Section label="Light">
            {/* Current color set summary */}
            <ColorSetDisplay highlightHex={highlightHex} waterHex={waterHex} />

            {/* Preset list */}
            <div style={{ fontFamily: C.sans, fontSize: '0.50rem', color: C.lo,
              letterSpacing: '0.10em', marginTop: '0.15rem', marginBottom: '0.1rem' }}>
              presets
            </div>
            <PresetList
              value={preset}
              highlightHex={highlightHex}
              waterHex={waterHex}
              onSelect={selectPreset}
            />

            {/* Per-channel color inputs */}
            <div style={{ fontFamily: C.sans, fontSize: '0.50rem', color: C.lo,
              letterSpacing: '0.10em', marginTop: '0.35rem', marginBottom: '0.1rem' }}>
              custom colors
            </div>
            <ColorRow label="highlight" prop="light.color"
              value={highlightHex} onChange={onHighlightChange} />
            <ColorRow label="water body" prop="material.tint"
              value={waterHex} onChange={onWaterChange} />

            {/* Light direction & multipliers */}
            <div style={{ fontFamily: C.sans, fontSize: '0.50rem', color: C.lo,
              letterSpacing: '0.10em', marginTop: '0.35rem', marginBottom: '0.1rem' }}>
              direction & intensity
            </div>
            <DirGrid value={lightDir} onChange={setLightDir} />
            <SliderRow label="specular" prop="light.specular" min={0} max={3} value={specular}
              onChange={setSpecular} />
            <SliderRow label="glow" prop="light.glow" min={0} max={3} value={glow}
              onChange={setGlow} />
          </Section>

          {/* ── Material ─────────────────────────────────────────────────── */}
          <Section label="Material">
            <SliderRow label="distortion" prop="material.distortionScale"
              min={0} max={3} value={distortionScale} onChange={setDistortionScale} />
          </Section>

          {/* ── Interaction ──────────────────────────────────────────────── */}
          <Section label="Interaction">
            <Toggler label="ripples" prop="interaction.ripples"
              value={ripples} onChange={setRipples} />
            <SliderRow label="strength" prop="interaction.rippleStrength"
              min={0} max={2} value={rippleStrength} onChange={setRippleStrength} />
            <SliderRow label="radius" prop="interaction.rippleRadius"
              min={0.005} max={0.08} step={0.001} value={rippleRadius}
              onChange={setRippleRadius}
              fmt={v => v.toFixed(3)} />
          </Section>

          {/* ── Performance ──────────────────────────────────────────────── */}
          <Section label="Performance">
            <Pills label="quality" prop="performance.quality"
              options={['auto', 'low', 'medium', 'high'] as const}
              value={quality} onChange={setQuality} />
          </Section>

          {/* ── WaterItem ────────────────────────────────────────────────── */}
          <Section label="WaterItem">
            <SliderRow label="depth" prop="<WaterItem depth>"
              min={0} max={1} value={itemDepth} onChange={setItemDepth} />
          </Section>

          {/* ── Handle ───────────────────────────────────────────────────── */}
          <Section label="Handle">

            {/* splash() */}
            <Row label="single ripple" prop="ref.splash()">
              <EffectBtn onClick={() => overlayRef.current?.splash()}>
                ◎ splash
              </EffectBtn>
            </Row>

            {/* rain() */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <SliderRow label="rain intensity" prop="ref.rain(intensity)"
                min={0.05} max={1} step={0.01} value={rainIntensity}
                onChange={onRainIntensityChange} />
              <Row label="" prop="">
                <EffectBtn
                  active={rainActive}
                  onClick={toggleRain}
                  style={{ minWidth: 96 }}
                >
                  {rainActive ? '■ stop rain' : '▼ start rain'}
                </EffectBtn>
              </Row>
            </div>

            {/* vibration() */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <SliderRow label="vib strength" prop="ref.vibration(strength)"
                min={0} max={2} value={vibStrength} onChange={setVibStrength} />
              <SliderRow label="vib duration" prop="ref.vibration(_, ms)"
                min={200} max={4000} step={100} value={vibDuration}
                onChange={setVibDuration}
                fmt={v => `${Math.round(v)}ms`} />
              <Row label="" prop="">
                <EffectBtn onClick={() => overlayRef.current?.vibration(vibStrength, vibDuration)}>
                  ⚡ vibrate
                </EffectBtn>
              </Row>
            </div>

            {/* wave() */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <SliderRow label="wave strength" prop="ref.wave(dir, strength)"
                min={0} max={2} value={waveStrength} onChange={setWaveStrength} />
              <Row label="wave dir" prop="ref.wave(direction)">
                <div style={{ display: 'flex', gap: 3 }}>
                  {(['left','right','top','bottom'] as const).map(d => {
                    const sym = d === 'left' ? '←' : d === 'right' ? '→' : d === 'top' ? '↑' : '↓';
                    return (
                      <button key={d} onClick={() => setWaveDir(d)} style={{
                        width: 24, height: 24, padding: 0, cursor: 'pointer',
                        background: waveDir === d ? C.accentFaint : 'rgba(0,15,40,0.55)',
                        border: `1px solid ${waveDir === d ? C.accent : 'rgba(50,120,210,0.20)'}`,
                        borderRadius: 4, color: waveDir === d ? C.accent : C.mid,
                        fontFamily: C.mono, fontSize: '0.75rem', lineHeight: 1,
                        transition: 'all 0.12s',
                      }}>{sym}</button>
                    );
                  })}
                </div>
              </Row>
              <Row label="" prop="">
                <EffectBtn onClick={() => overlayRef.current?.wave(waveDir, waveStrength)}>
                  〰 launch wave
                </EffectBtn>
              </Row>
            </div>

            {/* trail() */}
            <Row label="hover trail" prop="ref.trail(x, y)">
              <button onClick={() => setTrailMode(m => !m)}
                style={{
                  fontFamily: C.mono, fontSize: '0.64rem',
                  background: trailMode ? C.accentFaint : 'rgba(0,15,40,0.6)',
                  color: trailMode ? C.accent : C.lo,
                  border: `1px solid ${trailMode ? C.accent : 'rgba(50,120,210,0.22)'}`,
                  borderRadius: 20, padding: '3px 16px', cursor: 'pointer', transition: 'all 0.15s',
                }}>
                {trailMode ? '● on' : '○ off'}
              </button>
            </Row>
            {trailMode && (
              <div style={{ fontFamily: C.sans, fontSize: '0.52rem', color: C.lo,
                fontStyle: 'italic', paddingLeft: '0.5rem' }}>
                move cursor over the scene to draw
              </div>
            )}

            {/* stopEffects() */}
            <Row label="stop all" prop="ref.stopEffects()">
              <EffectBtn
                onClick={() => {
                  overlayRef.current?.stopEffects();
                  if (rainActive) {
                    rainCancelRef.current = null;
                    setRainActive(false);
                  }
                }}
                danger
              >
                ✕ stop all
              </EffectBtn>
            </Row>

          </Section>

          {/* ── Live code preview ─────────────────────────────────────────── */}
          <CodePreview
            level={level} mode={mode} preset={preset} lightDir={lightDir}
            specular={specular} glow={glow} highlightHex={highlightHex} waterHex={waterHex}
            distortionScale={distortionScale}
            ripples={ripples} rippleStrength={rippleStrength} rippleRadius={rippleRadius}
            quality={quality} debug={debug} itemDepth={itemDepth}
          />
        </div>
      </Float>
    </WaterOverlay>
  );
}
