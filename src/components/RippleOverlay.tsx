import { useEffect, useRef } from 'react';

export interface RippleOverlayProps {
  color?: string;
  maxRadius?: number;
  speed?: number;
  lineWidth?: number;
  waveCount?: number;
}

interface Ripple {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  opacity: number;
}

export function RippleOverlay({
  color = 'rgba(255,255,255,0.5)',
  maxRadius = 200,
  speed = 4,
  lineWidth = 1.5,
  waveCount = 3,
}: RippleOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ripplesRef = useRef<Ripple[]>([]);
  const isMouseDownRef = useRef(false);
  const lastThrottleRef = useRef(0);
  const rafIdRef = useRef<number>(0);

  // Sync props to refs so the RAF loop always reads current values
  const colorRef = useRef(color);
  const maxRadiusRef = useRef(maxRadius);
  const speedRef = useRef(speed);
  const lineWidthRef = useRef(lineWidth);
  const waveCountRef = useRef(waveCount);

  useEffect(() => { colorRef.current = color; }, [color]);
  useEffect(() => { maxRadiusRef.current = maxRadius; }, [maxRadius]);
  useEffect(() => { speedRef.current = speed; }, [speed]);
  useEffect(() => { lineWidthRef.current = lineWidth; }, [lineWidth]);
  useEffect(() => { waveCountRef.current = waveCount; }, [waveCount]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;

    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.scale(dpr, dpr);
    };
    resize();
    window.addEventListener('resize', resize);

    const spawnRipple = (x: number, y: number) => {
      ripplesRef.current.push({ x, y, radius: 0, maxRadius: maxRadiusRef.current, opacity: 1 });
    };

    const handleMouseDown = (e: MouseEvent) => {
      isMouseDownRef.current = true;
      spawnRipple(e.clientX, e.clientY);
    };

    const handleMouseUp = () => {
      isMouseDownRef.current = false;
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isMouseDownRef.current) return;
      const now = performance.now();
      if (now - lastThrottleRef.current < 30) return;
      lastThrottleRef.current = now;
      spawnRipple(e.clientX, e.clientY);
    };

    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('mousemove', handleMouseMove);

    const animate = () => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

      const s = speedRef.current;
      const lw = lineWidthRef.current;
      const wc = waveCountRef.current;
      const col = colorRef.current;

      ripplesRef.current = ripplesRef.current.filter(ripple => {
        ripple.radius += s;
        ripple.opacity = 1 - ripple.radius / ripple.maxRadius;

        if (ripple.opacity <= 0) return false;

        for (let i = 0; i < wc; i++) {
          const ringRadius = ripple.radius - i * 22;
          if (ringRadius <= 0) continue;

          const ringOpacity = ripple.opacity * (1 - i * 0.28);
          ctx.beginPath();
          ctx.arc(ripple.x, ripple.y, ringRadius, 0, Math.PI * 2);
          ctx.globalAlpha = Math.max(0, ringOpacity);
          ctx.strokeStyle = col;
          ctx.lineWidth = lw;
          ctx.stroke();
        }

        return true;
      });

      ctx.globalAlpha = 1;
      rafIdRef.current = requestAnimationFrame(animate);
    };

    rafIdRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafIdRef.current);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 9999,
      }}
    />
  );
}
