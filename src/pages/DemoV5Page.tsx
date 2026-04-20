import { useRef } from 'react';
import { WaterRippleV5, type WaterRippleV5Handle } from '../components/WaterRippleV5';

// ─── Design tokens ────────────────────────────────────────────────────────────

const navy   = '#050e1f';
const textHi = 'rgba(190,225,255,0.92)';
const textMid= 'rgba(140,190,240,0.60)';
const textLo = 'rgba(100,150,210,0.35)';
const accent = 'rgba(80,200,200,0.85)';
const font   = 'Segoe UI, system-ui, sans-serif';

// ─── Card data ────────────────────────────────────────────────────────────────

const CARDS = [
  {
    id: 'solid',
    label: 'Solid',
    heading: 'Wave Equation',
    body: 'Discrete propagation over a 512 × 512 height field. Each cell exchanges energy with its four neighbours every frame.',
    meta: 'h_new = (Σ neighbours / 2) − h_prev',
    style: {
      background: 'rgba(0, 75, 140, 0.88)',
      border: '1px solid rgba(40,130,220,0.30)',
      backdropFilter: 'none',
    },
  },
  {
    id: 'glass',
    label: 'Glassmorphism',
    heading: 'Surface Normals',
    body: 'Per-pixel normal vectors are derived from the height gradient and encoded into an RG displacement map at 128 × 128.',
    meta: 'n = normalize(∇h)',
    style: {
      background: 'rgba(255,255,255,0.042)',
      border: '1px solid rgba(255,255,255,0.11)',
      backdropFilter: 'blur(18px)',
      WebkitBackdropFilter: 'blur(18px)',
    },
  },
  {
    id: 'bare',
    label: 'No Background',
    heading: 'feDisplacementMap',
    body: 'An SVG filter reads the normal map and offsets source pixels in real time, warping any HTML content placed inside the water layer.',
    meta: 'scale = 35 px · 30 fps update',
    style: {
      background: 'transparent',
      border: '1px solid rgba(100,180,255,0.20)',
      backdropFilter: 'none',
    },
  },
] as const;

// ─── Card component ───────────────────────────────────────────────────────────

function Card({ label, heading, body, meta, style }: (typeof CARDS)[number]) {
  return (
    <div style={{
      ...style,
      borderRadius: '14px',
      padding: '1.5rem 1.4rem',
      display: 'flex', flexDirection: 'column', gap: '0.75rem',
      flex: '1 1 220px', minWidth: '200px', maxWidth: '320px',
    }}>
      <span style={{ fontFamily: font, fontSize: '0.58rem', letterSpacing: '0.16em',
        textTransform: 'uppercase', color: accent, opacity: 0.75 }}>
        {label}
      </span>

      <h3 style={{ fontFamily: font, fontSize: '1.05rem', fontWeight: 300,
        letterSpacing: '0.04em', color: textHi, margin: 0 }}>
        {heading}
      </h3>

      <p style={{ fontFamily: font, fontSize: '0.76rem', lineHeight: 1.75,
        color: textMid, margin: 0 }}>
        {body}
      </p>

      <code style={{ fontFamily: 'Consolas, monospace', fontSize: '0.68rem',
        color: accent, opacity: 0.7, marginTop: 'auto', letterSpacing: '0.02em' }}>
        {meta}
      </code>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DemoV5Page() {
  const ripple = useRef<WaterRippleV5Handle>(null);

  // ── Surface content (above water — crisp, no distortion) ─────────────────
  const surfaceContent = (
    <div style={{
      position: 'absolute',
      inset: 0,
      pointerEvents: 'none',
    }}>
      {/* Header arriba */}
      <div style={{
        position: 'absolute',
        top: '2.2rem',
        left: '2.5rem',
        right: '2.5rem',
      }}>
        <p style={{ fontFamily: font, fontSize: '0.62rem', letterSpacing: '0.18em',
          textTransform: 'uppercase', color: textLo, margin: '0 0 0.55rem' }}>
          ripple / v5
        </p>

        <h1 style={{ fontFamily: font, fontSize: 'clamp(1.7rem, 4vw, 2.9rem)',
          fontWeight: 200, letterSpacing: '0.06em', color: textHi,
          margin: '0 0 0.45rem',
          textShadow: '0 0 70px rgba(60,180,255,0.28)' }}>
          Water Overlay
        </h1>

        <p style={{ fontFamily: font, fontSize: '0.82rem', color: textMid,
          margin: 0, maxWidth: '420px', lineHeight: 1.65 }}>
          HTML below the surface is distorted by a live wave simulation.
          Click or drag anywhere to create ripples.
        </p>
      </div>

      {/* Cards más abajo, cerca del centro */}
      <div style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: '33%',
        transform: 'translateY(-50%)',
        display: 'flex',
        justifyContent: 'center',
        padding: '0 2.5rem',
        boxSizing: 'border-box',
      }}>
        <div style={{
          display: 'flex',
          gap: '1.1rem',
          flexWrap: 'wrap',
          justifyContent: 'center',
          width: '100%',
          maxWidth: '980px',
          position: 'relative',
        }}>
          {CARDS.map(c => <Card key={c.id} {...c} />)}
        </div>
      </div>
    </div>
  );

  // ── Underwater content (children — wrapped in feDisplacementMap filter) ───
  const underwaterContent = (
    <div style={{
      position: 'absolute', inset: 0,
      background: `linear-gradient(175deg, ${navy} 0%, #020810 100%)`,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '2rem 2.5rem',
      boxSizing: 'border-box',
      gap: '2.5rem',
    }}>

      {/* Ambient fine grid — displacement is very visible on it */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: `
          linear-gradient(rgba(100,160,255,0.045) 1px, transparent 1px),
          linear-gradient(90deg, rgba(100,160,255,0.045) 1px, transparent 1px)
        `,
        backgroundSize: '32px 32px',
      }} />

      {/* Card row */}
      <div style={{
        display: 'flex', gap: '1.1rem', flexWrap: 'wrap',
        justifyContent: 'center', width: '100%', maxWidth: '980px',
        position: 'relative', 
        top: '33%',
      }}>
        {CARDS.map(c => <Card key={c.id} {...c} />)}
      </div>

      {/* Bottom label */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem',
        position: 'relative' }}>
        <div style={{ width: '5px', height: '5px', borderRadius: '50%',
          background: accent, boxShadow: `0 0 6px ${accent}` }} />
        <p style={{ fontFamily: font, fontSize: '0.64rem', letterSpacing: '0.12em',
          textTransform: 'uppercase', color: textLo, margin: 0 }}>
          underwater · feDisplacementMap · 512 × 512 sim
        </p>
      </div>

      {/* Subtle caustic overlay — distortion is most visible against the grid */}
      <div style={{
        position: 'absolute', bottom: '1.5rem', right: '2rem',
        fontFamily: font, fontSize: '0.6rem', letterSpacing: '0.1em',
        color: textLo, pointerEvents: 'none', userSelect: 'none',
      }}>
        click · drag · touch
      </div>
    </div>
  );

  return (
    <WaterRippleV5
      ref={ripple}
      simResolution={512}
      surface={surfaceContent}
    >
      {underwaterContent}
    </WaterRippleV5>
  );
}
