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

// ─── Scenario config ──────────────────────────────────────────────────────────

interface ScenarioConfig {
  id: string; name: string; emoji: string; description: string;
  accentColor: string; highlightHex: string; waterHex: string;
  direction: WaterLightDirection; specular: number; glow: number;
  level: number; tintOpacity: number; distortionScale: number;
  rippleStrength: number; rippleRadius: number;
  bgGradient: string; gridColor: string;
  autoStart?: 'sea' | 'rain'; autoIntensity?: number;
}

const SCENARIOS: ScenarioConfig[] = [
  {
    id: 'pool', name: 'Piscina', emoji: '🏊', description: 'bright · shallow · clear',
    accentColor: '#6ee3ff', highlightHex: '#6ee3ff', waterHex: '#0087c8',
    direction: 'top', specular: 2.5, glow: 0.8,
    level: 0.45, tintOpacity: 0.14, distortionScale: 1.4, rippleStrength: 1.0, rippleRadius: 0.025,
    bgGradient: 'linear-gradient(175deg, #041e3c 0%, #012240 100%)',
    gridColor: 'rgba(80,200,255,0.07)',
  },
  {
    id: 'tropical', name: 'Tropical', emoji: '🌴', description: 'warm · turquoise · sunny',
    accentColor: '#00c88a', highlightHex: '#ffe078', waterHex: '#00a87a',
    direction: 'top-right', specular: 3.5, glow: 0.6,
    level: 0.50, tintOpacity: 0.18, distortionScale: 1.0, rippleStrength: 0.8, rippleRadius: 0.030,
    bgGradient: 'linear-gradient(175deg, #051a18 0%, #031410 100%)',
    gridColor: 'rgba(80,220,160,0.065)',
  },
  {
    id: 'deep', name: 'Mar Profundo', emoji: '🌊', description: 'dark · vast · bioluminescent',
    accentColor: '#2060ff', highlightHex: '#2060ff', waterHex: '#00030f',
    direction: 'top', specular: 1.8, glow: 2.0,
    level: 0.95, tintOpacity: 0.30, distortionScale: 2.0, rippleStrength: 1.2, rippleRadius: 0.040,
    bgGradient: 'linear-gradient(175deg, #000008 0%, #00000f 100%)',
    gridColor: 'rgba(20,60,200,0.04)',
    autoStart: 'sea', autoIntensity: 0.3,
  },
  {
    id: 'toxic', name: 'Toxic Waste', emoji: '☢️', description: 'viscous · neon · corrosive',
    accentColor: '#80ff00', highlightHex: '#c8ff00', waterHex: '#0a1f00',
    direction: 'top', specular: 5.0, glow: 1.6,
    level: 0.80, tintOpacity: 0.38, distortionScale: 0.5, rippleStrength: 0.35, rippleRadius: 0.045,
    bgGradient: 'linear-gradient(175deg, #060d00 0%, #0a1200 100%)',
    gridColor: 'rgba(100,255,0,0.05)',
  },
  {
    id: 'blood', name: 'Blood', emoji: '🩸', description: 'thick · viscous · crimson',
    accentColor: '#cc2000', highlightHex: '#ff3000', waterHex: '#280000',
    direction: 'top-right', specular: 1.5, glow: 0.4,
    level: 0.88, tintOpacity: 0.48, distortionScale: 0.3, rippleStrength: 0.25, rippleRadius: 0.050,
    bgGradient: 'linear-gradient(175deg, #0c0000 0%, #100000 100%)',
    gridColor: 'rgba(200,20,0,0.04)',
  },
  {
    id: 'pond', name: 'Pond', emoji: '🐸', description: 'murky · still · algae',
    accentColor: '#668833', highlightHex: '#88c050', waterHex: '#080f02',
    direction: 'top-left', specular: 1.2, glow: 0.25,
    level: 0.72, tintOpacity: 0.28, distortionScale: 0.9, rippleStrength: 0.6, rippleRadius: 0.035,
    bgGradient: 'linear-gradient(175deg, #060e02 0%, #040a01 100%)',
    gridColor: 'rgba(80,140,20,0.05)',
  },
  {
    id: 'aquarium', name: 'Aquarium', emoji: '🐠', description: 'bright · precise · curated',
    accentColor: '#50c8e8', highlightHex: '#a0eeff', waterHex: '#001833',
    direction: 'top', specular: 3.2, glow: 1.0,
    level: 0.60, tintOpacity: 0.20, distortionScale: 1.6, rippleStrength: 0.7, rippleRadius: 0.018,
    bgGradient: 'linear-gradient(175deg, #040f1e 0%, #050d1a 100%)',
    gridColor: 'rgba(80,200,255,0.06)',
  },
];

// ─── Scene asset primitives ───────────────────────────────────────────────────

/** Top-down fish silhouette – body oval, forked tail, dorsal fin, eye. */
function Fish({
  x, y, size = 60, color, tailColor, angle = 0, depth = 0.35,
}: {
  x: string; y: string; size?: number; color: string; tailColor?: string;
  angle?: number; depth?: number;
}) {
  const tc = tailColor ?? color;
  return (
    <WaterItem depth={depth} style={{ position: 'absolute', left: x, top: y, pointerEvents: 'none' }}>
      <svg width={size} height={size * 0.5} viewBox="0 0 80 40"
        style={{ transform: `rotate(${angle}deg)`, display: 'block', overflow: 'visible' }}>
        {/* Tail */}
        <path d="M10,20 L0,7 L5,20 L0,33 Z" fill={tc} />
        {/* Body */}
        <ellipse cx="44" cy="20" rx="27" ry="14" fill={color} />
        {/* Dorsal fin */}
        <ellipse cx="44" cy="7" rx="9" ry="3.5" fill={color} opacity={0.65} />
        {/* Eye */}
        <circle cx="65" cy="16" r="3.5" fill="rgba(0,0,0,0.6)" />
        <circle cx="66" cy="15" r="1.3" fill="rgba(255,255,255,0.75)" />
      </svg>
    </WaterItem>
  );
}

/** Striped clownfish (Nemo) – orange with white bars. */
function Clownfish({ x, y, size = 52, angle = 0, depth = 0.3 }: {
  x: string; y: string; size?: number; angle?: number; depth?: number;
}) {
  return (
    <WaterItem depth={depth} style={{ position: 'absolute', left: x, top: y, pointerEvents: 'none' }}>
      <svg width={size} height={size * 0.55} viewBox="0 0 80 44"
        style={{ transform: `rotate(${angle}deg)`, display: 'block', overflow: 'visible' }}>
        <path d="M10,22 L0,9 L5,22 L0,35 Z" fill="#e05800" />
        <ellipse cx="44" cy="22" rx="26" ry="15" fill="#f07010" />
        {/* White bars */}
        <rect x="32" y="8" width="9" height="28" rx="4" fill="rgba(255,255,255,0.85)" />
        <rect x="50" y="10" width="7" height="24" rx="3" fill="rgba(255,255,255,0.7)" />
        <ellipse cx="44" cy="8" rx="8" ry="3" fill="#f07010" opacity={0.7} />
        <circle cx="64" cy="18" r="3.5" fill="rgba(0,0,0,0.55)" />
        <circle cx="65" cy="17" r="1.3" fill="rgba(255,255,255,0.8)" />
      </svg>
    </WaterItem>
  );
}

/** Lily pad – green circle with V-notch and vein lines. */
function LilyPad({ x, y, size = 70, rot = 0, depth = 0.06 }: {
  x: string; y: string; size?: number; rot?: number; depth?: number;
}) {
  return (
    <WaterItem depth={depth} style={{ position: 'absolute', left: x, top: y, pointerEvents: 'none' }}>
      <svg width={size} height={size} viewBox="0 0 100 100"
        style={{ transform: `rotate(${rot}deg)`, display: 'block' }}>
        {/* Pad with notch */}
        <path d="M50,50 L63,3 A49,49 0 1,0 37,3 Z"
          fill="#2e7d00" stroke="#1a5200" strokeWidth="1.5" opacity={0.92} />
        {/* Veins */}
        {[0, 45, 90, 135, 200, 250, 300].map((a, i) => {
          const r = (a * Math.PI) / 180;
          return <line key={i} x1="50" y1="50"
            x2={50 + Math.cos(r) * 46} y2={50 + Math.sin(r) * 46}
            stroke="rgba(0,80,0,0.4)" strokeWidth="1" />;
        })}
        {/* Flower */}
        <circle cx="50" cy="50" r="5" fill="#ff6080" opacity={0.7} />
        <circle cx="50" cy="50" r="3" fill="#ffd060" opacity={0.9} />
      </svg>
    </WaterItem>
  );
}

/** Starfish – 5-pointed with texture. */
function Starfish({ x, y, size = 44, rot = 0, color = '#e8720a', depth = 0.75 }: {
  x: string; y: string; size?: number; rot?: number; color?: string; depth?: number;
}) {
  // 5-point star clip-path
  const pts = Array.from({ length: 10 }, (_, i) => {
    const a = (i * 36 - 90) * Math.PI / 180;
    const r = i % 2 === 0 ? 48 : 20;
    return `${50 + r * Math.cos(a)}% ${50 + r * Math.sin(a)}%`;
  }).join(', ');
  return (
    <WaterItem depth={depth} style={{
      position: 'absolute', left: x, top: y, width: size, height: size,
      pointerEvents: 'none', transform: `rotate(${rot}deg)`,
      background: color,
      clipPath: `polygon(${pts})`,
      boxShadow: `inset 0 0 8px rgba(0,0,0,0.3)`,
    }} />
  );
}

/** Rounded rock/stone. */
function Rock({ x, y, w = 36, h = 26, rot = 0, color = 'rgba(110,105,100,0.8)', depth = 0.80 }: {
  x: string; y: string; w?: number; h?: number; rot?: number; color?: string; depth?: number;
}) {
  return (
    <WaterItem depth={depth} style={{
      position: 'absolute', left: x, top: y, pointerEvents: 'none',
    }}>
      <div style={{
        width: w, height: h, borderRadius: '50%',
        background: `radial-gradient(ellipse at 35% 35%, ${color}, rgba(60,55,50,0.9))`,
        transform: `rotate(${rot}deg)`,
        boxShadow: '2px 3px 8px rgba(0,0,0,0.5)',
      }} />
    </WaterItem>
  );
}

/** Glowing bioluminescent particle. */
function BioDot({ x, y, size = 5, color = '#00ffcc', depth = 0.45 }: {
  x: string; y: string; size?: number; color?: string; depth?: number;
}) {
  return (
    <WaterItem depth={depth} style={{ position: 'absolute', left: x, top: y, pointerEvents: 'none' }}>
      <div style={{
        width: size, height: size, borderRadius: '50%',
        background: color,
        boxShadow: `0 0 ${size * 2}px ${size}px ${color}60, 0 0 ${size * 5}px ${color}30`,
      }} />
    </WaterItem>
  );
}

// ─── Scene: Piscina (pool) ────────────────────────────────────────────────────
// View from above: tiled bottom, lane dividers, pool drain.

function PoolScene() {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      {/* Tiled pool floor */}
      <WaterItem depth={0.82} style={{ position: 'absolute', inset: 0 }}>
        <div style={{
          width: '100%', height: '100%',
          background: '#1878c0',
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.18) 1.5px, transparent 1.5px),
            linear-gradient(90deg, rgba(255,255,255,0.18) 1.5px, transparent 1.5px),
            linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)
          `,
          backgroundSize: '96px 96px, 96px 96px, 32px 32px, 32px 32px',
        }} />
      </WaterItem>

      {/* Black tile border around pool edge */}
      <WaterItem depth={0.78} style={{ position: 'absolute', inset: 0 }}>
        <div style={{
          width: '100%', height: '100%',
          boxShadow: 'inset 0 0 0 18px rgba(0,20,60,0.55)',
          borderRadius: 0,
          pointerEvents: 'none',
        }} />
      </WaterItem>

      {/* Lane ropes – 4 ropes running left–right */}
      {[22, 37, 54, 69].map((pct, i) => (
        <WaterItem key={i} depth={0.12} style={{
          position: 'absolute', top: `${pct}%`, left: '3%', right: '3%', height: 10,
          transform: 'translateY(-50%)',
        }}>
          <div style={{
            width: '100%', height: '100%', borderRadius: 5,
            backgroundImage: `repeating-linear-gradient(
              90deg,
              #e03010 0px, #e03010 14px,
              #ffffff 14px, #ffffff 28px
            )`,
          }} />
        </WaterItem>
      ))}

      {/* Pool drain — center */}
      <WaterItem depth={0.92} style={{
        position: 'absolute', left: '32%', top: '50%',
        transform: 'translate(-50%,-50%)', pointerEvents: 'none',
      }}>
        <svg width={56} height={56} viewBox="0 0 56 56">
          <circle cx="28" cy="28" r="27" fill="none" stroke="rgba(0,40,120,0.7)" strokeWidth="3" />
          <circle cx="28" cy="28" r="20" fill="none" stroke="rgba(0,40,120,0.5)" strokeWidth="2" />
          {/* Grate lines */}
          {[-8, -2, 4, 10].map(d => (
            <g key={d}>
              <line x1={28 + d} y1="10" x2={28 + d} y2="46"
                stroke="rgba(0,30,100,0.6)" strokeWidth="2" />
              <line x1="10" y1={28 + d} x2="46" y2={28 + d}
                stroke="rgba(0,30,100,0.6)" strokeWidth="2" />
            </g>
          ))}
          <circle cx="28" cy="28" r="27" fill="none" stroke="rgba(0,40,120,0.7)" strokeWidth="3" />
        </svg>
      </WaterItem>

      {/* Second drain */}
      <WaterItem depth={0.92} style={{
        position: 'absolute', left: '32%', top: '82%',
        transform: 'translate(-50%,-50%)', pointerEvents: 'none',
      }}>
        <svg width={40} height={40} viewBox="0 0 56 56">
          <circle cx="28" cy="28" r="27" fill="none" stroke="rgba(0,40,120,0.6)" strokeWidth="3" />
          {[-6, 0, 6].map(d => (
            <g key={d}>
              <line x1={28 + d} y1="8" x2={28 + d} y2="48" stroke="rgba(0,30,100,0.5)" strokeWidth="2.5" />
              <line x1="8" y1={28 + d} x2="48" y2={28 + d} stroke="rgba(0,30,100,0.5)" strokeWidth="2.5" />
            </g>
          ))}
        </svg>
      </WaterItem>

      {/* Lane numbers on floor */}
      {[11, 28, 44, 60, 78].map((pct, i) => (
        <WaterItem key={i} depth={0.88} style={{
          position: 'absolute', left: '4%', top: `${pct}%`,
          transform: 'translateY(-50%)', pointerEvents: 'none',
        }}>
          <div style={{
            fontFamily: C.mono, fontSize: '1.1rem', fontWeight: 700,
            color: 'rgba(255,255,255,0.25)', userSelect: 'none',
          }}>{i + 1}</div>
        </WaterItem>
      ))}
    </div>
  );
}

// ─── Scene: Tropical (top-down beach/reef) ────────────────────────────────────

function TropicalScene() {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      {/* Sandy reef floor */}
      <WaterItem depth={0.78} style={{ position: 'absolute', inset: 0 }}>
        <div style={{
          width: '100%', height: '100%',
          background: 'radial-gradient(ellipse at 30% 50%, #c4a86e 0%, #b09050 40%, #8a7038 100%)',
          backgroundImage: `repeating-linear-gradient(
            20deg, transparent 0px, transparent 12px,
            rgba(255,225,155,0.12) 12px, rgba(255,225,155,0.12) 13px
          )`,
        }} />
      </WaterItem>

      {/* Coral formations */}
      {[
        { x: '8%',  y: '18%', w: 28, h: 22, color: 'rgba(220,80,80,0.85)'  },
        { x: '14%', y: '60%', w: 22, h: 34, color: 'rgba(255,140,60,0.85)' },
        { x: '42%', y: '10%', w: 18, h: 28, color: 'rgba(240,80,120,0.80)' },
        { x: '38%', y: '75%', w: 24, h: 18, color: 'rgba(200,60,180,0.80)' },
        { x: '55%', y: '30%', w: 20, h: 30, color: 'rgba(220,100,50,0.80)' },
      ].map((c, i) => (
        <WaterItem key={i} depth={0.60} style={{
          position: 'absolute', left: c.x, top: c.y, pointerEvents: 'none',
        }}>
          <svg width={c.w + 20} height={c.h + 20} viewBox="0 0 60 70" style={{ display: 'block' }}>
            {/* Coral branches */}
            <line x1="30" y1="65" x2="30" y2="30" stroke={c.color} strokeWidth="5" strokeLinecap="round" />
            <line x1="30" y1="45" x2="10" y2="20" stroke={c.color} strokeWidth="4" strokeLinecap="round" />
            <line x1="30" y1="45" x2="50" y2="18" stroke={c.color} strokeWidth="4" strokeLinecap="round" />
            <line x1="30" y1="30" x2="18" y2="8"  stroke={c.color} strokeWidth="3" strokeLinecap="round" />
            <line x1="30" y1="30" x2="44" y2="10" stroke={c.color} strokeWidth="3" strokeLinecap="round" />
            {/* Tips */}
            {[[10,20],[50,18],[18,8],[44,10],[30,30]].map(([cx,cy],j) => (
              <circle key={j} cx={cx} cy={cy} r={4} fill={c.color} opacity={0.9} />
            ))}
          </svg>
        </WaterItem>
      ))}

      {/* Starfish on sand */}
      <Starfish x="22%" y="68%" rot={15}  color="#e07010" depth={0.78} />
      <Starfish x="47%" y="55%" rot={72}  color="#e85020" size={36} depth={0.80} />
      <Starfish x="10%" y="38%" rot={130} color="#d06820" size={30} depth={0.76} />

      {/* Rocks */}
      <Rock x="5%"  y="72%" w={44} h={32} rot={20} depth={0.82} color="rgba(120,100,80,0.85)" />
      <Rock x="50%" y="78%" w={36} h={24} rot={-15} depth={0.80} color="rgba(130,115,85,0.8)" />

      {/* Tropical fish (viewed from above) */}
      <Fish x="18%" y="28%" color="#ffd020" tailColor="#e0a000" angle={30}  depth={0.30} size={55} />
      <Fish x="30%" y="62%" color="#2090e0" tailColor="#1060a8" angle={-20} depth={0.28} size={48} />
      <Fish x="48%" y="40%" color="#e84040" tailColor="#b02020" angle={85}  depth={0.32} size={44} />
      <Fish x="8%"  y="48%" color="#40c860" tailColor="#209040" angle={160} depth={0.25} size={50} />

      {/* Palm canopy shadows (top-down: just a dark soft circle = shade) */}
      {[
        { x: '2%',  y: '2%'  },
        { x: '52%', y: '1%'  },
        { x: '1%',  y: '82%' },
        { x: '52%', y: '80%' },
      ].map((p, i) => (
        <WaterItem key={i} depth={0.05} style={{
          position: 'absolute', left: p.x, top: p.y, pointerEvents: 'none',
        }}>
          <div style={{
            width: 120, height: 120, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(0,40,0,0.50) 20%, rgba(10,60,10,0.30) 55%, transparent 75%)',
          }} />
        </WaterItem>
      ))}
    </div>
  );
}

// ─── Scene: Pond ──────────────────────────────────────────────────────────────

function PondScene() {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      {/* Murky silty bottom */}
      <WaterItem depth={0.80} style={{ position: 'absolute', inset: 0 }}>
        <div style={{
          width: '100%', height: '100%',
          background: 'radial-gradient(ellipse at 40% 55%, #2a3818 0%, #1a2410 50%, #0e1608 100%)',
        }} />
      </WaterItem>

      {/* Rocks on bottom */}
      <Rock x="5%"  y="12%"  w={55} h={38} rot={10}  color="rgba(90,85,75,0.85)" depth={0.82} />
      <Rock x="45%" y="8%"   w={40} h={28} rot={-20} color="rgba(80,75,65,0.80)" depth={0.84} />
      <Rock x="4%"  y="70%"  w={62} h={42} rot={5}   color="rgba(85,80,70,0.85)" depth={0.82} />
      <Rock x="46%" y="72%"  w={35} h={25} rot={30}  color="rgba(95,88,72,0.80)" depth={0.83} />

      {/* Reeds at edges (top-down: oval clusters) */}
      {[
        { x: '-1%', y: '30%' }, { x: '-1%', y: '50%' },
        { x: '53%', y: '20%' }, { x: '53%', y: '65%' },
      ].map((p, i) => (
        <WaterItem key={i} depth={0.10} style={{ position: 'absolute', left: p.x, top: p.y, pointerEvents: 'none' }}>
          <div style={{ display: 'flex', gap: 4, flexDirection: i > 1 ? 'row-reverse' : 'row' }}>
            {[20, 30, 22, 28, 18].map((h, j) => (
              <div key={j} style={{
                width: 5, height: h,
                background: `rgba(${50 + j * 10},${80 + j * 8},${20 + j * 5},0.85)`,
                borderRadius: 3,
                transform: `rotate(${(j - 2) * 8}deg)`,
              }} />
            ))}
          </div>
        </WaterItem>
      ))}

      {/* Lily pads */}
      <LilyPad x="15%"  y="18%"  size={80}  rot={20}   depth={0.05} />
      <LilyPad x="30%"  y="40%"  size={95}  rot={-35}  depth={0.04} />
      <LilyPad x="5%"   y="54%"  size={70}  rot={110}  depth={0.06} />
      <LilyPad x="40%"  y="60%"  size={85}  rot={60}   depth={0.05} />
      <LilyPad x="22%"  y="74%"  size={65}  rot={-80}  depth={0.07} />

      {/* Koi fish (top-down) */}
      <Fish x="22%" y="32%" color="#f06020" tailColor="#c04010" angle={45}   depth={0.28} size={65} />
      <Fish x="10%" y="44%" color="#f8f8f8" tailColor="#e0e0e0" angle={-60}  depth={0.30} size={55} />
      <Fish x="38%" y="25%" color="#282828" tailColor="#181818" angle={130}  depth={0.26} size={50} />
      <Fish x="32%" y="68%" color="#e85030" tailColor="#b02818" angle={-140} depth={0.32} size={58} />

      {/* Fallen leaves floating */}
      {[
        { x: '8%',  y: '25%', r: 20,  c: 'rgba(120,70,20,0.80)' },
        { x: '28%', y: '55%', r: -30, c: 'rgba(90,60,15,0.75)'  },
        { x: '44%', y: '36%', r: 55,  c: 'rgba(140,90,25,0.80)' },
        { x: '18%', y: '82%', r: -10, c: 'rgba(110,75,20,0.75)' },
      ].map((l, i) => (
        <WaterItem key={i} depth={0.08} style={{
          position: 'absolute', left: l.x, top: l.y, pointerEvents: 'none',
        }}>
          <div style={{
            width: 36, height: 18, borderRadius: '50% 50% 50% 50% / 60% 60% 40% 40%',
            background: l.c, transform: `rotate(${l.r}deg)`,
            boxShadow: '1px 2px 4px rgba(0,0,0,0.3)',
          }} />
        </WaterItem>
      ))}
    </div>
  );
}

// ─── Scene: Aquarium ──────────────────────────────────────────────────────────

function AquariumScene() {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      {/* Bright sandy bottom */}
      <WaterItem depth={0.75} style={{ position: 'absolute', inset: 0 }}>
        <div style={{
          width: '100%', height: '100%',
          background: 'linear-gradient(160deg, #e8dfc8 0%, #d4c8a4 40%, #c0b480 100%)',
        }} />
      </WaterItem>

      {/* Caustic light patterns */}
      {[
        { x: '10%', y: '20%', r: 80 }, { x: '35%', y: '10%', r: 60 },
        { x: '20%', y: '55%', r: 70 }, { x: '50%', y: '40%', r: 55 },
        { x: '5%',  y: '75%', r: 50 }, { x: '42%', y: '70%', r: 65 },
      ].map((c, i) => (
        <WaterItem key={i} depth={0.72} style={{
          position: 'absolute', left: c.x, top: c.y, pointerEvents: 'none',
        }}>
          <div style={{
            width: c.r, height: c.r, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(200,230,255,0.28) 0%, rgba(180,220,255,0.08) 60%, transparent 80%)',
          }} />
        </WaterItem>
      ))}

      {/* Glass walls at edges */}
      <WaterItem depth={0.05} style={{ position: 'absolute', inset: 0 }}>
        <div style={{
          width: '100%', height: '100%',
          boxShadow: 'inset 0 0 0 14px rgba(160,220,255,0.20)',
          pointerEvents: 'none',
        }} />
      </WaterItem>

      {/* Coral — right side and center */}
      {[
        { x: '50%', y: '5%',  color: '#ff6080' },
        { x: '6%',  y: '60%', color: '#ff8040' },
        { x: '44%', y: '62%', color: '#c040e0' },
      ].map((c, i) => (
        <WaterItem key={i} depth={0.55} style={{ position: 'absolute', left: c.x, top: c.y, pointerEvents: 'none' }}>
          <svg width={50} height={60} viewBox="0 0 60 75">
            <line x1="30" y1="72" x2="30" y2="35" stroke={c.color} strokeWidth="6" strokeLinecap="round" />
            <line x1="30" y1="50" x2="8"  y2="22" stroke={c.color} strokeWidth="5" strokeLinecap="round" />
            <line x1="30" y1="50" x2="52" y2="20" stroke={c.color} strokeWidth="5" strokeLinecap="round" />
            <line x1="30" y1="35" x2="14" y2="8"  stroke={c.color} strokeWidth="3.5" strokeLinecap="round" />
            <line x1="30" y1="35" x2="46" y2="6"  stroke={c.color} strokeWidth="3.5" strokeLinecap="round" />
            {[[8,22],[52,20],[14,8],[46,6],[30,35]].map(([cx,cy],j) => (
              <circle key={j} cx={cx} cy={cy} r={5} fill={c.color} />
            ))}
          </svg>
        </WaterItem>
      ))}

      {/* Sea anemone */}
      <WaterItem depth={0.50} style={{ position: 'absolute', left: '28%', top: '62%', pointerEvents: 'none' }}>
        <svg width={55} height={55} viewBox="0 0 60 60">
          <circle cx="30" cy="30" r="14" fill="#e040a0" opacity={0.9} />
          {Array.from({ length: 12 }, (_, i) => {
            const a = (i * 30) * Math.PI / 180;
            return <ellipse key={i} cx={30 + Math.cos(a) * 22} cy={30 + Math.sin(a) * 22}
              rx="5" ry="9" fill="#ff60c0" opacity={0.8}
              style={{ transform: `rotate(${i * 30}deg)`, transformOrigin: '30px 30px' }} />;
          })}
          <circle cx="30" cy="30" r="8" fill="#ffa0d0" opacity={0.9} />
        </svg>
      </WaterItem>

      {/* Clownfish / tropical fish */}
      <Clownfish x="15%" y="22%" angle={30}  depth={0.28} size={55} />
      <Clownfish x="36%" y="48%" angle={-50} depth={0.30} size={46} />
      <Fish x="8%"  y="40%" color="#3080ff" tailColor="#1050cc" angle={20}   depth={0.25} size={50} />
      <Fish x="40%" y="22%" color="#ffd040" tailColor="#e8a000" angle={-100} depth={0.27} size={44} />
      <Fish x="22%" y="72%" color="#60c840" tailColor="#3a9020" angle={70}   depth={0.33} size={40} />

      {/* Bubbles */}
      {[
        { x: '12%', y: '8%',  s: 10 }, { x: '13%', y: '18%', s: 7  },
        { x: '11%', y: '30%', s: 12 }, { x: '46%', y: '12%', s: 8  },
        { x: '47%', y: '22%', s: 6  }, { x: '22%', y: '5%',  s: 9  },
      ].map((b, i) => (
        <WaterItem key={i} depth={0.04} style={{
          position: 'absolute', left: b.x, top: b.y, pointerEvents: 'none',
        }}>
          <div style={{
            width: b.s, height: b.s, borderRadius: '50%',
            border: '1.5px solid rgba(160,220,255,0.65)',
            background: 'rgba(200,240,255,0.08)',
            boxShadow: 'inset 1px 1px 2px rgba(255,255,255,0.4)',
          }} />
        </WaterItem>
      ))}
    </div>
  );
}

// ─── Scene: Deep Sea ─────────────────────────────────────────────────────────

function DeepSeaScene() {
  // Kraken tentacles: 8 bezier curves radiating from center
  const tentacles = Array.from({ length: 8 }, (_, i) => {
    const angle  = (i * 45) * Math.PI / 180;
    const spread = 170;
    const ex = 200 + Math.cos(angle) * spread;
    const ey = 200 + Math.sin(angle) * spread;
    const cp1x = 200 + Math.cos(angle - 0.4) * 75;
    const cp1y = 200 + Math.sin(angle - 0.4) * 75;
    const cp2x = ex - Math.cos(angle) * 50 + Math.sin(angle) * 35;
    const cp2y = ey - Math.sin(angle) * 50 - Math.cos(angle) * 35;
    return { d: `M200,200 C${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${ex.toFixed(1)},${ey.toFixed(1)}`, angle };
  });

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      {/* Deep abyss texture */}
      <WaterItem depth={0.95} style={{ position: 'absolute', inset: 0 }}>
        <div style={{
          width: '100%', height: '100%',
          background: 'radial-gradient(ellipse at 28% 62%, #060010 0%, #020008 60%, #000004 100%)',
        }} />
      </WaterItem>

      {/* Bioluminescent particles scattered */}
      <BioDot x="5%"  y="22%" size={4} color="#00ffaa" depth={0.55} />
      <BioDot x="18%" y="10%" size={3} color="#4080ff" depth={0.60} />
      <BioDot x="8%"  y="62%" size={5} color="#00ccff" depth={0.50} />
      <BioDot x="44%" y="18%" size={3} color="#80ffcc" depth={0.58} />
      <BioDot x="40%" y="72%" size={4} color="#00aaff" depth={0.52} />
      <BioDot x="52%" y="45%" size={3} color="#40ff80" depth={0.56} />
      <BioDot x="14%" y="80%" size={4} color="#00ffcc" depth={0.54} />
      <BioDot x="50%" y="80%" size={3} color="#6080ff" depth={0.60} />

      {/* Ship — floating at surface, seen from above */}
      <WaterItem depth={0.04} style={{
        position: 'absolute', left: '16%', top: '4%',
        transform: 'translateX(-50%)', pointerEvents: 'none',
      }}>
        <svg width={200} height={80} viewBox="0 0 200 80" style={{ display: 'block' }}>
          {/* Hull */}
          <path d="M24,40 Q100,6 176,40 Q100,74 24,40 Z"
            fill="rgba(60,50,38,0.92)" stroke="rgba(80,70,50,0.6)" strokeWidth="1.5" />
          {/* Deck planks */}
          {[-12,-4,4,12].map(dy => (
            <line key={dy} x1="45" y1={40+dy} x2="155" y2={40+dy}
              stroke="rgba(100,85,60,0.5)" strokeWidth="1.5" />
          ))}
          {/* Cabin / bridge */}
          <rect x="80" y="30" width="40" height="20" rx="5"
            fill="rgba(80,65,45,0.90)" stroke="rgba(110,90,60,0.5)" strokeWidth="1" />
          <rect x="90" y="22" width="20" height="12" rx="3"
            fill="rgba(95,78,52,0.90)" />
          {/* Mast */}
          <circle cx="100" cy="40" r="3" fill="rgba(120,100,70,0.85)" />
          {/* Wake */}
          <path d="M24,40 Q10,36 4,40 Q10,44 24,40" fill="none"
            stroke="rgba(120,180,255,0.35)" strokeWidth="2" />
        </svg>
      </WaterItem>

      {/* Kraken body + tentacles */}
      <WaterItem depth={0.88} style={{
        position: 'absolute', left: '22%', top: '48%',
        transform: 'translate(-50%,-50%)', pointerEvents: 'none',
      }}>
        <svg width={400} height={400} viewBox="0 0 400 400" style={{ display: 'block', overflow: 'visible' }}>
          {/* Tentacle shadows / sucker details */}
          {tentacles.map((t, i) => (
            <path key={`sh${i}`} d={t.d}
              stroke="rgba(10,0,25,0.6)" strokeWidth={22} fill="none"
              strokeLinecap="round" />
          ))}
          {/* Main tentacles */}
          {tentacles.map((t, i) => (
            <path key={i} d={t.d}
              stroke={`rgba(${30 + i * 5},${5},${60 + i * 4},0.92)`}
              strokeWidth={16} fill="none" strokeLinecap="round" />
          ))}
          {/* Body */}
          <ellipse cx="200" cy="200" rx="55" ry="70"
            fill="rgba(15,3,40,0.97)" stroke="rgba(40,10,80,0.7)" strokeWidth="3" />
          {/* Body texture */}
          <ellipse cx="200" cy="200" rx="38" ry="50" fill="rgba(25,6,55,0.6)" />
        </svg>
      </WaterItem>

      {/* Kraken glowing eyes — separate WaterItem at near-zero depth → very bright */}
      <WaterItem depth={0.0} style={{
        position: 'absolute',
        left: 'calc(22% - 22px)',
        top: 'calc(48% - 18px)',
        pointerEvents: 'none',
      }}>
        <div style={{ display: 'flex', gap: 36 }}>
          {[0, 1].map(i => (
            <div key={i} style={{
              width: 20, height: 20, borderRadius: '50%',
              background: 'radial-gradient(circle, #ffffff 20%, #00ffcc 55%, #00cc88 100%)',
              boxShadow: '0 0 8px 4px #00ffcc, 0 0 24px 10px rgba(0,255,200,0.45), 0 0 50px 20px rgba(0,200,150,0.20)',
            }} />
          ))}
        </div>
      </WaterItem>

      {/* Anglerfish lurking bottom-right */}
      <WaterItem depth={0.92} style={{
        position: 'absolute', left: '46%', top: '66%',
        transform: 'translate(-50%,-50%)', pointerEvents: 'none',
      }}>
        <svg width={100} height={70} viewBox="0 0 100 70">
          <path d="M15,35 L0,20 L5,35 L0,50 Z" fill="rgba(15,5,30,0.9)" />
          <ellipse cx="52" cy="35" rx="36" ry="24" fill="rgba(18,6,35,0.95)" />
          <path d="M40,14 Q50,4 60,14" stroke="rgba(0,200,120,0.5)" strokeWidth="2" fill="none" />
          <circle cx="60" cy="6" r="5"
            fill="rgba(0,255,150,0.9)"
            style={{ filter: 'drop-shadow(0 0 4px #00ff96)' }} />
          <circle cx="72" cy="28" r="5" fill="rgba(0,0,0,0.7)" />
          <circle cx="73" cy="27" r="2" fill="rgba(255,255,255,0.6)" />
        </svg>
      </WaterItem>
    </div>
  );
}

// ─── Scene router ─────────────────────────────────────────────────────────────

function SceneContent({ id }: { id: string | null }) {
  switch (id) {
    case 'pool':     return <PoolScene />;
    case 'tropical': return <TropicalScene />;
    case 'pond':     return <PondScene />;
    case 'aquarium': return <AquariumScene />;
    case 'deep':     return <DeepSeaScene />;
    default:         return null;
  }
}

// ─── Scenario dropdown ────────────────────────────────────────────────────────

function ScenarioDropdown({ scenarios, activeId, onSelect }: {
  scenarios: ScenarioConfig[]; activeId: string | null;
  onSelect: (s: ScenarioConfig) => void;
}) {
  const [open, setOpen] = useState(false);
  const active = scenarios.find(s => s.id === activeId) ?? null;

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        onBlur={() => setTimeout(() => setOpen(false), 160)}
        style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          background: 'rgba(3,12,28,0.82)',
          backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
          border: `1px solid ${active ? active.accentColor + '55' : 'rgba(50,120,210,0.22)'}`,
          borderRadius: 8, padding: '6px 10px', cursor: 'pointer',
          fontFamily: C.sans, width: 220, transition: 'border-color 0.15s',
        }}
      >
        <div style={{
          width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
          background: active ? active.accentColor : C.lo,
          boxShadow: active ? `0 0 6px ${active.accentColor}` : 'none',
          transition: 'all 0.2s',
        }} />
        <span style={{
          flex: 1, textAlign: 'left', fontSize: '0.62rem',
          color: active ? active.accentColor : C.lo,
          fontWeight: active ? 500 : 400, transition: 'color 0.15s',
        }}>
          {active ? active.name : '· scenarios'}
        </span>
        {active && <span style={{ fontSize: '0.55rem', color: C.lo }}>{active.emoji}</span>}
        <span style={{
          fontSize: '0.55rem', color: C.lo, display: 'inline-block',
          transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s',
        }}>▾</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0,
          width: 260, zIndex: 2,
          background: 'rgba(3,12,28,0.96)',
          backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          border: `1px solid rgba(45,120,210,0.22)`,
          borderRadius: 10, overflow: 'hidden',
          boxShadow: '0 8px 40px rgba(0,0,0,0.55)',
        }}>
          {scenarios.map(s => {
            const isActive = s.id === activeId;
            return (
              <button key={s.id}
                onClick={() => { onSelect(s); setOpen(false); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.55rem',
                  width: '100%', padding: '8px 10px',
                  background: isActive ? `${s.accentColor}12` : 'transparent',
                  border: 'none', borderBottom: '1px solid rgba(45,120,210,0.10)',
                  cursor: 'pointer', textAlign: 'left',
                  transition: 'background 0.12s', position: 'relative', overflow: 'hidden',
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = `${s.accentColor}0e`; }}
                onMouseLeave={e => { e.currentTarget.style.background = isActive ? `${s.accentColor}12` : 'transparent'; }}
              >
                <div style={{
                  position: 'absolute', left: 0, top: 0, bottom: 0, width: 2,
                  background: isActive ? s.accentColor : 'transparent',
                }} />
                <span style={{ fontSize: '0.9rem', flexShrink: 0, marginLeft: 6 }}>{s.emoji}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontFamily: C.sans, fontSize: '0.62rem', fontWeight: 500,
                    color: isActive ? s.accentColor : C.hi,
                  }}>{s.name}</div>
                  <div style={{ fontFamily: C.mono, fontSize: '0.48rem', color: C.lo, marginTop: 1 }}>
                    {s.description}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
                  <div style={{ width: 12, height: 12, borderRadius: 3, background: s.highlightHex, border: '1px solid rgba(255,255,255,0.12)' }} />
                  <div style={{ width: 12, height: 12, borderRadius: 3, background: s.waterHex,    border: '1px solid rgba(255,255,255,0.12)' }} />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Panel primitives ─────────────────────────────────────────────────────────

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ borderTop: `1px solid ${C.sectionLine}`, paddingTop: '0.75rem', marginTop: '0.75rem' }}>
      <div style={{ fontFamily: C.sans, fontSize: '0.52rem', letterSpacing: '0.18em',
        textTransform: 'uppercase', color: C.accent, opacity: 0.8, marginBottom: '0.55rem' }}>
        {label}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>{children}</div>
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

function SliderRow({ label, prop, min, max, step = 0.01, value, onChange, fmt }: {
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

function Pills<T extends string>({ label, prop, options, value, onChange }: {
  label: string; prop: string; options: readonly T[]; value: T; onChange: (v: T) => void;
}) {
  return (
    <Row label={label} prop={prop}>
      <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        {options.map(o => {
          const active = o === value;
          return (
            <button key={o} onClick={() => onChange(o)} style={{
              fontFamily: C.sans, fontSize: '0.55rem', letterSpacing: '0.06em',
              textTransform: 'uppercase',
              background: active ? C.accent : 'rgba(0,15,40,0.6)',
              color: active ? C.bg : C.mid,
              border: `1px solid ${active ? C.accent : 'rgba(50,120,210,0.22)'}`,
              borderRadius: 20, padding: '3px 9px', cursor: 'pointer', transition: 'all 0.15s',
            }}>{o}</button>
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
      <button onClick={() => onChange(!value)} style={{
        fontFamily: C.mono, fontSize: '0.64rem',
        background: value ? C.accentFaint : 'rgba(0,15,40,0.6)',
        color: value ? C.accent : C.lo,
        border: `1px solid ${value ? C.accent : 'rgba(50,120,210,0.22)'}`,
        borderRadius: 20, padding: '3px 16px', cursor: 'pointer', transition: 'all 0.15s',
      }}>{value ? 'on' : 'off'}</button>
    </Row>
  );
}

function EffectBtn({ children, onClick, active, danger, style: extraStyle }: {
  children: ReactNode; onClick: () => void; active?: boolean; danger?: boolean; style?: CSSProperties;
}) {
  const col = danger ? 'rgba(255,90,90,0.85)' : C.accent;
  const bg  = active ? (danger ? 'rgba(255,60,60,0.18)' : C.accentFaint) : 'rgba(0,15,40,0.6)';
  return (
    <button onClick={onClick} style={{
      fontFamily: C.mono, fontSize: '0.60rem', letterSpacing: '0.04em',
      background: bg, color: active ? col : (danger ? col : C.mid),
      border: `1px solid ${active ? col : (danger ? 'rgba(255,90,90,0.35)' : 'rgba(50,120,210,0.28)')}`,
      borderRadius: 20, padding: '4px 12px', cursor: 'pointer',
      transition: 'all 0.15s', whiteSpace: 'nowrap', ...extraStyle,
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
    >{children}</button>
  );
}

// ─── Compass direction grid ───────────────────────────────────────────────────

type DirCell = [WaterLightDirection, string] | null;
const DIR_CELLS: DirCell[] = [
  ['top-left','↖'], ['top','↑'], ['top-right','↗'],
  ['left','←'], null, ['right','→'],
  ['bottom-left','↙'], ['bottom','↓'], ['bottom-right','↘'],
];

function DirGrid({ value, onChange }: { value: WaterLightDirection; onChange: (d: WaterLightDirection) => void }) {
  return (
    <Row label="direction" prop="light.direction">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 24px)', gap: 2 }}>
        {DIR_CELLS.map((cell, i) => {
          if (!cell) return (
            <div key={i} style={{ width: 24, height: 24, display: 'flex', alignItems: 'center',
              justifyContent: 'center', color: C.lo, fontSize: '0.5rem' }}>·</div>
          );
          const [dir, sym] = cell;
          const on = dir === value;
          return (
            <button key={i} onClick={() => onChange(dir)} style={{
              width: 24, height: 24, padding: 0, cursor: 'pointer',
              background: on ? C.accentFaint : 'rgba(0,15,40,0.55)',
              border: `1px solid ${on ? C.accent : 'rgba(50,120,210,0.20)'}`,
              borderRadius: 4, color: on ? C.accent : C.mid,
              fontFamily: C.mono, fontSize: '0.75rem', lineHeight: 1, transition: 'all 0.12s',
            }}>{sym}</button>
          );
        })}
      </div>
    </Row>
  );
}

// ─── Light preset list ────────────────────────────────────────────────────────

type KnownPreset = Exclude<WaterLightPreset, 'custom'>;
const PRESET_META: Record<KnownPreset, string> = {
  dawn: 'warm · golden hour', noon: 'cool · daylight',
  neon: 'cyberpunk · vivid',  fluorescent: 'clinical · pale',
};
const KNOWN_PRESETS: KnownPreset[] = ['dawn', 'noon', 'neon', 'fluorescent'];

function Swatch({ color, size = 14 }: { color: string; size?: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius: 3, background: color,
      border: '1px solid rgba(255,255,255,0.13)', flexShrink: 0 }} />
  );
}

function PresetList({ value, highlightHex, waterHex, onSelect }: {
  value: WaterLightPreset; highlightHex: string; waterHex: string;
  onSelect: (p: KnownPreset) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {KNOWN_PRESETS.map(p => {
        const on = p === value;
        const lp = LIGHT_PRESETS[p];
        return (
          <button key={p} onClick={() => onSelect(p)} style={{
            display: 'flex', alignItems: 'center', gap: '0.45rem',
            background: on ? 'rgba(56,201,184,0.09)' : 'rgba(0,12,32,0.55)',
            border: `1px solid ${on ? 'rgba(56,201,184,0.40)' : 'rgba(50,120,210,0.16)'}`,
            borderRadius: 6, padding: '5px 8px', cursor: 'pointer',
            transition: 'all 0.12s', textAlign: 'left', width: '100%',
          }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
              background: on ? C.accent : 'rgba(85,135,205,0.25)' }} />
            <span style={{ fontFamily: C.mono, fontSize: '0.60rem', flexShrink: 0, width: 76,
              color: on ? C.accent : C.mid }}>{p}</span>
            <span style={{ fontFamily: C.sans, fontSize: '0.50rem', color: C.lo, flex: 1,
              overflow: 'hidden', whiteSpace: 'nowrap' }}>{PRESET_META[p]}</span>
            <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
              <Swatch color={rgbToHex(lp.lightColor)} />
              <Swatch color={rgbToHex(lp.waterColor)} />
            </div>
          </button>
        );
      })}
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
            <Swatch color={highlightHex} /><Swatch color={waterHex} />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Color picker row ─────────────────────────────────────────────────────────

function ColorRow({ label, prop, value, onChange }: {
  label: string; prop: string; value: string; onChange: (hex: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <Row label={label} prop={prop}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', cursor: 'pointer' }}
        onClick={() => inputRef.current?.click()}>
        <div style={{
          width: 20, height: 20, borderRadius: 4, background: value,
          border: '2px solid rgba(255,255,255,0.18)', flexShrink: 0,
          boxShadow: `0 0 6px ${value}55`,
        }} />
        <code style={{ fontFamily: C.mono, fontSize: '0.60rem', color: C.hi, userSelect: 'none' }}>
          {value}
        </code>
        <input ref={inputRef} type="color" value={value}
          onChange={e => onChange(e.target.value)}
          style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }} />
      </div>
    </Row>
  );
}

// ─── Tint opacity preview strip ───────────────────────────────────────────────

function TintOpacityRow({ opacity, waterHex, onChange }: {
  opacity: number; waterHex: string; onChange: (v: number) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
      <Row label="tint opacity" prop="material.opacity">
        <input type="range" min={0} max={0.92} step={0.01} value={opacity}
          onChange={e => onChange(parseFloat(e.target.value))}
          style={{ width: 100, accentColor: C.accent, cursor: 'pointer' }} />
        <code style={{ fontFamily: C.mono, fontSize: '0.64rem', color: C.hi, minWidth: 34, textAlign: 'right' }}>
          {opacity.toFixed(2)}
        </code>
      </Row>
      {/* Gradient strip: transparent → solid tint color */}
      <div style={{
        height: 8, borderRadius: 4, marginTop: 2,
        background: `linear-gradient(90deg, transparent 0%, ${waterHex} 100%)`,
        border: '1px solid rgba(255,255,255,0.08)',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Cursor indicator */}
        <div style={{
          position: 'absolute', top: 0, bottom: 0, left: `${opacity / 0.92 * 100}%`,
          width: 2, background: 'rgba(255,255,255,0.85)',
          transform: 'translateX(-50%)',
          boxShadow: '0 0 4px rgba(255,255,255,0.5)',
        }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: C.sans, fontSize: '0.46rem', color: C.lo }}>transparent</span>
        <span style={{ fontFamily: C.sans, fontSize: '0.46rem', color: C.lo }}>solid</span>
      </div>
    </div>
  );
}

// ─── Color set display ────────────────────────────────────────────────────────

function ColorSetDisplay({ highlightHex, waterHex }: { highlightHex: string; waterHex: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0.5rem',
      background: 'rgba(0,8,22,0.55)', border: `1px solid rgba(50,120,210,0.14)`,
      borderRadius: 6, padding: '6px 8px',
    }}>
      <span style={{ fontFamily: C.sans, fontSize: '0.52rem', color: C.lo, flexShrink: 0 }}>current set</span>
      <div style={{ flex: 1 }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <Swatch color={highlightHex} size={16} />
        <span style={{ fontFamily: C.sans, fontSize: '0.48rem', color: C.lo }}>hi</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <Swatch color={waterHex} size={16} />
        <span style={{ fontFamily: C.sans, fontSize: '0.48rem', color: C.lo }}>water</span>
      </div>
    </div>
  );
}

// ─── Live code preview ────────────────────────────────────────────────────────

function CodePreview({ level, mode, preset, lightDir, specular, glow, highlightHex, waterHex,
  tintOpacity, distortionScale, ripples, rippleStrength, rippleRadius, quality, debug, itemDepth }: {
  level: number; mode: WaterMode; preset: WaterLightPreset;
  lightDir: WaterLightDirection; specular: number; glow: number;
  highlightHex: string; waterHex: string; tintOpacity: number;
  distortionScale: number; ripples: boolean; rippleStrength: number;
  rippleRadius: number; quality: string; debug: boolean; itemDepth: number;
}) {
  const dir = typeof lightDir === 'string' ? `"${lightDir}"` : `{x:${(lightDir as {x:number}).x}}`;
  const lines = [
    `<WaterOverlay`,
    `  level={${level.toFixed(2)}}  mode="${mode}"`,
    `  light={{`,
    `    preset:"${preset}", direction:${dir},`,
    `    specular:${specular.toFixed(2)}, glow:${glow.toFixed(2)},`,
    `    color:"${highlightHex}",`,
    `  }}`,
    `  material={{`,
    `    tint:"${waterHex}", opacity:${tintOpacity.toFixed(2)},`,
    `    distortionScale:${distortionScale.toFixed(2)},`,
    `  }}`,
    `  interaction={{`,
    `    ripples:${ripples}, rippleStrength:${rippleStrength.toFixed(2)},`,
    `    rippleRadius:${rippleRadius.toFixed(3)},`,
    `  }}`,
    `  performance={{ quality:"${quality}" }}`,
    `  debug={${debug}}`,
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
        fontFamily: C.mono, fontSize: '0.57rem', lineHeight: 1.6, color: C.mid,
        background: 'rgba(0,8,20,0.6)', border: `1px solid ${C.sectionLine}`,
        borderRadius: 6, padding: '0.6rem 0.7rem', overflowX: 'auto', margin: 0, whiteSpace: 'pre',
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

// ─── Depth showcase card (default scene) ──────────────────────────────────────

function DepthCard({ depth, label }: { depth: number; label: string }) {
  return (
    <WaterItem depth={depth} style={{ flex: '1 1 140px', maxWidth: 200 }}>
      <div style={{
        background: 'rgba(0,30,70,0.65)', border: '1px solid rgba(60,140,255,0.22)',
        borderRadius: 12, padding: '1rem 1.1rem',
        display: 'flex', flexDirection: 'column', gap: '0.5rem',
      }}>
        <span style={{ fontFamily: C.sans, fontSize: '0.56rem', letterSpacing: '0.14em',
          textTransform: 'uppercase', color: C.accent, opacity: 0.75 }}>{label}</span>
        <div style={{ fontFamily: C.mono, fontSize: '1.8rem', fontWeight: 700,
          color: `rgba(200,230,255,${0.15 + (1 - depth) * 0.7})`, lineHeight: 1 }}>
          {depth.toFixed(2)}
        </div>
        <div style={{ fontFamily: C.sans, fontSize: '0.62rem', color: C.mid }}>depth = {depth.toFixed(2)}</div>
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

  // Light
  const [preset, setPreset]             = useState<WaterLightPreset>('noon');
  const [lightDir, setLightDir]         = useState<WaterLightDirection>('top');
  const [specular, setSpecular]         = useState(1.0);
  const [glow, setGlow]                 = useState(1.0);
  const [highlightHex, setHighlightHex] = useState(() => rgbToHex(LIGHT_PRESETS.noon.lightColor));
  const [waterHex, setWaterHex]         = useState(() => rgbToHex(LIGHT_PRESETS.noon.waterColor));

  const selectPreset = (p: KnownPreset) => {
    setPreset(p); setHighlightHex(rgbToHex(LIGHT_PRESETS[p].lightColor));
    setWaterHex(rgbToHex(LIGHT_PRESETS[p].waterColor));
  };
  const onHighlightChange = (hex: string) => { setHighlightHex(hex); setPreset('custom'); };
  const onWaterChange     = (hex: string) => { setWaterHex(hex);     setPreset('custom'); };

  // Material
  const [tintOpacity, setTintOpacity]     = useState(0.10);
  const [distortionScale, setDistortionScale] = useState(1.0);

  // Interaction
  const [ripples, setRipples]               = useState(true);
  const [rippleStrength, setRippleStrength] = useState(0.9);
  const [rippleRadius, setRippleRadius]     = useState(0.028);

  // Performance
  const [quality, setQuality] = useState<'auto'|'low'|'medium'|'high'>('high');

  // WaterItem demo depth
  const [itemDepth, setItemDepth] = useState(0.5);

  // Handle effects
  const [rainActive, setRainActive]       = useState(false);
  const [rainIntensity, setRainIntensity] = useState(0.5);
  const rainCancelRef = useRef<(()=>void)|null>(null);
  const [seaActive, setSeaActive]         = useState(false);
  const [seaIntensity, setSeaIntensity]   = useState(0.5);
  const seaCancelRef = useRef<(()=>void)|null>(null);
  const [vibStrength, setVibStrength]     = useState(1.0);
  const [vibDuration, setVibDuration]     = useState(1000);
  const [waveDir, setWaveDir]             = useState<'left'|'right'|'top'|'bottom'>('right');
  const [waveStrength, setWaveStrength]   = useState(1.0);
  const [trailMode, setTrailMode]         = useState(false);

  const toggleRain = () => {
    if (rainActive) { rainCancelRef.current?.(); rainCancelRef.current=null; setRainActive(false); }
    else { rainCancelRef.current=overlayRef.current?.rain(rainIntensity)??null; setRainActive(true); }
  };
  const onRainIntensityChange = (v:number) => {
    setRainIntensity(v);
    if (rainActive) { rainCancelRef.current?.(); rainCancelRef.current=overlayRef.current?.rain(v)??null; }
  };
  const toggleSea = () => {
    if (seaActive) { seaCancelRef.current?.(); seaCancelRef.current=null; setSeaActive(false); }
    else { seaCancelRef.current=overlayRef.current?.sea(seaIntensity)??null; setSeaActive(true); }
  };
  const onSeaIntensityChange = (v:number) => {
    setSeaIntensity(v);
    if (seaActive) { seaCancelRef.current?.(); seaCancelRef.current=overlayRef.current?.sea(v)??null; }
  };

  // Scenario
  const [activeScenario, setActiveScenario] = useState<string|null>(null);
  const [scenarioBg,   setScenarioBg]   = useState(`linear-gradient(175deg,#071428 0%,${C.bg} 100%)`);
  const [scenarioGrid, setScenarioGrid] = useState('rgba(100,165,255,0.055)');

  const applyScenario = (s: ScenarioConfig) => {
    overlayRef.current?.stopEffects();
    rainCancelRef.current=null; seaCancelRef.current=null;
    setRainActive(false); setSeaActive(false);
    setHighlightHex(s.highlightHex); setWaterHex(s.waterHex);
    setPreset('custom'); setLightDir(s.direction);
    setSpecular(s.specular); setGlow(s.glow);
    setLevel(s.level); setTintOpacity(s.tintOpacity); setDistortionScale(s.distortionScale);
    setRippleStrength(s.rippleStrength); setRippleRadius(s.rippleRadius);
    setScenarioBg(s.bgGradient); setScenarioGrid(s.gridColor);
    setActiveScenario(s.id);
    if (s.autoStart) {
      setTimeout(() => {
        if (!overlayRef.current) return;
        if (s.autoStart === 'sea') {
          const cancel = overlayRef.current.sea(s.autoIntensity ?? 0.5);
          seaCancelRef.current = cancel;
          setSeaActive(true);
        } else if (s.autoStart === 'rain') {
          const cancel = overlayRef.current.rain(s.autoIntensity ?? 0.5);
          rainCancelRef.current = cancel;
          setRainActive(true);
        }
      }, 120);
    }
  };

  const panelStyle: CSSProperties = {
    position: 'absolute', top: 0, right: 0,
    width: C.PANEL_W, height: '100%',
    background: C.panelBg,
    backdropFilter: 'blur(22px)', WebkitBackdropFilter: 'blur(22px)',
    borderLeft: `1px solid ${C.panelBorder}`,
    overflowY: 'auto', overflowX: 'hidden',
    boxSizing: 'border-box', padding: '1rem 1rem 2rem',
    pointerEvents: 'auto',
  };

  return (
    <WaterOverlay
      ref={overlayRef} level={level} mode={mode} debug={debug}
      light={{ preset, direction: lightDir, specular, glow, color: highlightHex }}
      material={{ distortionScale, tint: waterHex, opacity: tintOpacity }}
      interaction={{ ripples, rippleStrength, rippleRadius }}
      performance={{ quality }}
    >
      {/* ── Underwater scene ────────────────────────────────────────────────── */}
      <div
        style={{
          position: 'absolute', inset: 0, background: scenarioBg,
          cursor: trailMode ? 'crosshair' : 'default', transition: 'background 0.6s ease',
        }}
        onPointerMove={trailMode ? e => overlayRef.current?.trail(e.clientX, e.clientY) : undefined}
      >
        {/* Adaptive grid */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          backgroundImage: `
            linear-gradient(${scenarioGrid} 1px, transparent 1px),
            linear-gradient(90deg, ${scenarioGrid} 1px, transparent 1px)
          `,
          backgroundSize: '36px 36px',
        }} />

        {/* Scenario-specific scene content */}
        <SceneContent id={activeScenario} />

        {/* Default depth cards — show when no scenario active */}
        {activeScenario === null && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            paddingRight: C.PANEL_W + 16, paddingLeft: 24,
            boxSizing: 'border-box', flexDirection: 'column', gap: '1.5rem',
          }}>
            <div style={{ display: 'flex', gap: '0.85rem', flexWrap: 'wrap', justifyContent: 'center' }}>
              <DepthCard depth={0}    label="Surface" />
              <DepthCard depth={0.45} label="Mid"     />
              <DepthCard depth={0.90} label="Deep"    />
            </div>
            <WaterItem depth={itemDepth} style={{ width: '100%', maxWidth: 430 }}>
              <div style={{
                background: 'rgba(0,20,55,0.72)', border: '1px solid rgba(56,201,184,0.20)',
                borderRadius: 12, padding: '1.1rem 1.3rem',
                display: 'flex', flexDirection: 'column', gap: '0.6rem',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: C.sans, fontSize: '0.56rem', letterSpacing: '0.14em',
                    textTransform: 'uppercase', color: C.accent, opacity: 0.75 }}>interactive depth</span>
                  <code style={{ fontFamily: C.mono, fontSize: '0.62rem', color: C.hi }}>
                    depth={itemDepth.toFixed(2)}
                  </code>
                </div>
                <p style={{ fontFamily: C.sans, fontSize: '0.70rem', color: C.mid, margin: 0, lineHeight: 1.6 }}>
                  Use <code style={{ color: C.code, fontFamily: C.mono }}>depth</code> on{' '}
                  <code style={{ color: C.code, fontFamily: C.mono }}>&lt;WaterItem&gt;</code>{' '}
                  to control Z-axis darkening. Select a scenario above to see real use cases.
                </p>
                <div style={{ width: '100%', height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
                  <div style={{ width: `${itemDepth * 100}%`, height: '100%',
                    background: `rgba(56,201,184,${0.4 + itemDepth * 0.55})`,
                    transition: 'width 0.05s', borderRadius: 2 }} />
                </div>
              </div>
            </WaterItem>
          </div>
        )}

        {/* Bottom hint */}
        <div style={{
          position: 'absolute', bottom: '1.2rem', left: '50%',
          transform: `translateX(calc(-50% - ${C.PANEL_W / 2}px))`,
          fontFamily: C.sans, fontSize: '0.58rem', letterSpacing: '0.12em',
          color: C.lo, userSelect: 'none', textTransform: 'uppercase',
        }}>
          click · drag · touch to create ripples
        </div>
      </div>

      {/* ── Float: title + scenario selector + panel ─────────────────────────── */}
      <Float>
        {/* Title */}
        <div style={{ position: 'absolute', top: '1.6rem', left: '1.6rem', pointerEvents: 'none' }}>
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

        {/* Scenario dropdown */}
        <div style={{ position: 'absolute', top: '5.6rem', left: '1.6rem', pointerEvents: 'auto', zIndex: 1 }}>
          <ScenarioDropdown scenarios={SCENARIOS} activeId={activeScenario} onSelect={applyScenario} />
        </div>

        {/* API Panel */}
        <div style={panelStyle}>
          <div style={{ marginBottom: '0.5rem' }}>
            <p style={{ fontFamily: C.sans, fontSize: '0.50rem', letterSpacing: '0.18em',
              textTransform: 'uppercase', color: C.lo, margin: '0 0 0.2rem' }}>api explorer</p>
            <p style={{ fontFamily: C.mono, fontSize: '0.70rem', color: C.accent, margin: 0 }}>
              WaterOverlay v6
            </p>
          </div>

          <Section label="Global">
            <SliderRow label="depth scale" prop="level" min={0} max={1} value={level} onChange={setLevel} />
            <Pills label="mode" prop="mode" options={['interactive','static'] as const}
              value={mode} onChange={setMode} />
            <Toggler label="debug HUD" prop="debug" value={debug} onChange={setDebug} />
          </Section>

          <Section label="Light">
            <ColorSetDisplay highlightHex={highlightHex} waterHex={waterHex} />
            <div style={{ fontFamily: C.sans, fontSize: '0.50rem', color: C.lo,
              letterSpacing: '0.10em', marginTop: '0.15rem', marginBottom: '0.1rem' }}>presets</div>
            <PresetList value={preset} highlightHex={highlightHex} waterHex={waterHex}
              onSelect={selectPreset} />
            <div style={{ fontFamily: C.sans, fontSize: '0.50rem', color: C.lo,
              letterSpacing: '0.10em', marginTop: '0.35rem', marginBottom: '0.1rem' }}>custom colors</div>
            <ColorRow label="highlight" prop="light.color" value={highlightHex} onChange={onHighlightChange} />
            <ColorRow label="water body" prop="material.tint" value={waterHex} onChange={onWaterChange} />
            <div style={{ fontFamily: C.sans, fontSize: '0.50rem', color: C.lo,
              letterSpacing: '0.10em', marginTop: '0.35rem', marginBottom: '0.1rem' }}>direction & intensity</div>
            <DirGrid value={lightDir} onChange={setLightDir} />
            <SliderRow label="specular" prop="light.specular" min={0} max={3} value={specular} onChange={setSpecular} />
            <SliderRow label="glow" prop="light.glow" min={0} max={3} value={glow} onChange={setGlow} />
          </Section>

          <Section label="Material">
            <TintOpacityRow opacity={tintOpacity} waterHex={waterHex} onChange={setTintOpacity} />
            <SliderRow label="distortion" prop="material.distortionScale"
              min={0} max={3} value={distortionScale} onChange={setDistortionScale} />
          </Section>

          <Section label="Interaction">
            <Toggler label="ripples" prop="interaction.ripples" value={ripples} onChange={setRipples} />
            <SliderRow label="strength" prop="interaction.rippleStrength"
              min={0} max={2} value={rippleStrength} onChange={setRippleStrength} />
            <SliderRow label="radius" prop="interaction.rippleRadius"
              min={0.005} max={0.08} step={0.001} value={rippleRadius}
              onChange={setRippleRadius} fmt={v => v.toFixed(3)} />
          </Section>

          <Section label="Performance">
            <Pills label="quality" prop="performance.quality"
              options={['auto','low','medium','high'] as const}
              value={quality} onChange={setQuality} />
          </Section>

          <Section label="WaterItem">
            <SliderRow label="depth" prop="<WaterItem depth>"
              min={0} max={1} value={itemDepth} onChange={setItemDepth} />
          </Section>

          <Section label="Handle">
            <Row label="single ripple" prop="ref.splash()">
              <EffectBtn onClick={() => overlayRef.current?.splash()}>◎ splash</EffectBtn>
            </Row>

            <div style={{ display:'flex', flexDirection:'column', gap:'0.35rem' }}>
              <SliderRow label="rain intensity" prop="ref.rain(intensity)"
                min={0.05} max={1} step={0.01} value={rainIntensity} onChange={onRainIntensityChange} />
              <Row label="" prop="">
                <EffectBtn active={rainActive} onClick={toggleRain} style={{ minWidth: 96 }}>
                  {rainActive ? '■ stop rain' : '▼ start rain'}
                </EffectBtn>
              </Row>
            </div>

            <div style={{ display:'flex', flexDirection:'column', gap:'0.35rem' }}>
              <SliderRow label="sea intensity" prop="ref.sea(intensity)"
                min={0.05} max={1} step={0.01} value={seaIntensity} onChange={onSeaIntensityChange} />
              <Row label="" prop="">
                <EffectBtn active={seaActive} onClick={toggleSea} style={{ minWidth: 96 }}>
                  {seaActive ? '■ calm sea' : '≋ start sea'}
                </EffectBtn>
              </Row>
            </div>

            <div style={{ display:'flex', flexDirection:'column', gap:'0.35rem' }}>
              <SliderRow label="vib strength" prop="ref.vibration(strength)"
                min={0} max={2} value={vibStrength} onChange={setVibStrength} />
              <SliderRow label="vib duration" prop="ref.vibration(_,ms)"
                min={200} max={4000} step={100} value={vibDuration}
                onChange={setVibDuration} fmt={v => `${Math.round(v)}ms`} />
              <Row label="" prop="">
                <EffectBtn onClick={() => overlayRef.current?.vibration(vibStrength, vibDuration)}>
                  ⚡ vibrate
                </EffectBtn>
              </Row>
            </div>

            <div style={{ display:'flex', flexDirection:'column', gap:'0.35rem' }}>
              <SliderRow label="wavefront" prop="ref.wave(dir,strength)"
                min={0} max={2} value={waveStrength} onChange={setWaveStrength} />
              <Row label="origin" prop="ref.wave(direction)">
                <div style={{ display:'flex', gap:3 }}>
                  {(['left','right','top','bottom'] as const).map(d => {
                    const sym = d==='left'?'←':d==='right'?'→':d==='top'?'↑':'↓';
                    return (
                      <button key={d} onClick={() => setWaveDir(d)} style={{
                        width:24, height:24, padding:0, cursor:'pointer',
                        background: waveDir===d ? C.accentFaint : 'rgba(0,15,40,0.55)',
                        border:`1px solid ${waveDir===d ? C.accent : 'rgba(50,120,210,0.20)'}`,
                        borderRadius:4, color: waveDir===d ? C.accent : C.mid,
                        fontFamily:C.mono, fontSize:'0.75rem', lineHeight:1, transition:'all 0.12s',
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

            <Row label="hover trail" prop="ref.trail(x,y)">
              <button onClick={() => setTrailMode(m => !m)} style={{
                fontFamily: C.mono, fontSize: '0.64rem',
                background: trailMode ? C.accentFaint : 'rgba(0,15,40,0.6)',
                color: trailMode ? C.accent : C.lo,
                border: `1px solid ${trailMode ? C.accent : 'rgba(50,120,210,0.22)'}`,
                borderRadius: 20, padding: '3px 16px', cursor: 'pointer', transition: 'all 0.15s',
              }}>{trailMode ? '● on' : '○ off'}</button>
            </Row>
            {trailMode && (
              <div style={{ fontFamily:C.sans, fontSize:'0.52rem', color:C.lo,
                fontStyle:'italic', paddingLeft:'0.5rem' }}>
                move cursor over the scene to draw
              </div>
            )}

            <Row label="stop all" prop="ref.stopEffects()">
              <EffectBtn
                onClick={() => {
                  overlayRef.current?.stopEffects();
                  rainCancelRef.current=null; seaCancelRef.current=null;
                  setRainActive(false); setSeaActive(false);
                }}
                danger
              >✕ stop all</EffectBtn>
            </Row>
          </Section>

          <CodePreview
            level={level} mode={mode} preset={preset} lightDir={lightDir}
            specular={specular} glow={glow} highlightHex={highlightHex} waterHex={waterHex}
            tintOpacity={tintOpacity} distortionScale={distortionScale}
            ripples={ripples} rippleStrength={rippleStrength} rippleRadius={rippleRadius}
            quality={quality} debug={debug} itemDepth={itemDepth}
          />
        </div>
      </Float>
    </WaterOverlay>
  );
}
