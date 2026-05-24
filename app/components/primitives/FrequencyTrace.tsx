import React, { useState, useEffect, useRef } from 'react';
import { Theme } from '../../lib/theme';

export interface BajonEvent {
  t_idx?: number;
  span?: number;
  depth?: number;
}

interface Props {
  theme: Theme;
  width?: number;
  height?: number;
  bajones?: BajonEvent[];
  live?: boolean;
}

export default function FrequencyTrace({
  theme: t, width = 320, height = 80, bajones = [], live = true,
}: Props) {
  const [phase, setPhase] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!live) return;
    const tick = (ts: number) => {
      setPhase(ts / 1000);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [live]);

  const N = 240;
  const mid = height / 2;
  const points: [number, number][] = [];

  for (let i = 0; i < N; i++) {
    const x = (i / (N - 1)) * width;
    let dev = Math.sin((i + phase * 30) * 0.18) * 0.04
            + Math.sin((i + phase * 11) * 0.51) * 0.025;

    for (const e of bajones) {
      const center = N - (e.t_idx ?? (N - 30));
      const span   = e.span  ?? 8;
      const depth  = e.depth ?? 0.4;
      const d      = (i - center) / span;
      if (Math.abs(d) < 1) dev -= depth * (1 - d * d);
    }

    const y = mid + dev * (height * 0.6);
    points.push([x, y]);
  }

  const path = 'M ' + points.map(p => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' L ');
  const ax   = t.accent;

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ display: 'block' }}>
      {/* normal band */}
      <rect x={0} y={mid - height * 0.05} width={width} height={height * 0.10}
        fill={t.ok} opacity={0.06} />
      {/* 60 Hz reference */}
      <line x1={0} y1={mid} x2={width} y2={mid} stroke={t.line} strokeDasharray="2 3" />
      {/* danger threshold */}
      <line x1={0} y1={mid + height * 0.30} x2={width} y2={mid + height * 0.30}
        stroke={t.danger} opacity={0.15} strokeDasharray="1 4" />
      {/* trace */}
      <path d={path} fill="none" stroke={ax} strokeWidth={1.4} />
      {/* now dot */}
      <circle cx={width - 2} cy={points[N - 1][1]} r={3} fill={ax} />
    </svg>
  );
}
