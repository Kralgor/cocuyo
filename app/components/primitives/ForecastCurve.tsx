import React from 'react';
import { Theme } from '../../lib/theme';
import { Lang } from '../../lib/i18n';

interface Props {
  theme: Theme;
  data: number[];
  width?: number;
  height?: number;
  lang?: Lang;
  accentColor?: string;
}

export default function ForecastCurve({
  theme: t, data, width = 320, height = 96, lang = 'es', accentColor,
}: Props) {
  const N    = data.length;
  const ax   = accentColor ?? t.accent;
  const stepX = width / Math.max(N - 1, 1);
  const ys   = data.map(v => height - height * 0.92 * v - height * 0.04);

  let area = `M 0 ${height} `;
  for (let i = 0; i < N; i++) area += `L ${(i * stepX).toFixed(1)} ${ys[i].toFixed(1)} `;
  area += `L ${width} ${height} Z`;

  let line = `M 0 ${ys[0].toFixed(1)} `;
  for (let i = 1; i < N; i++) line += `L ${(i * stepX).toFixed(1)} ${ys[i].toFixed(1)} `;

  const startH = new Date().getHours();
  const ticks = [0, 6, 12, 18, 24].map(h => ({
    x: ((h * 2) / Math.max(N - 1, 1)) * width,
    h: (startH + h) % 24,
  }));

  const gradId = `fc-grad-${ax.replace('#', '')}`;

  return (
    <svg width="100%" height={height + 12} viewBox={`0 0 ${width} ${height + 12}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={ax} stopOpacity={0.55} />
          <stop offset="100%" stopColor={ax} stopOpacity={0} />
        </linearGradient>
      </defs>

      {/* high-risk band */}
      <rect x={0} y={height * 0.05} width={width} height={height * 0.25}
        fill={t.danger} opacity={0.04} />

      {/* gridlines */}
      {[0.25, 0.5, 0.75].map(f => (
        <line key={f} x1={0} y1={height * (1 - f)} x2={width} y2={height * (1 - f)}
          stroke={t.line} strokeDasharray="1 4" />
      ))}

      {/* area fill */}
      <path d={area} fill={`url(#${gradId})`} />

      {/* forecast line */}
      <path d={line} fill="none" stroke={ax} strokeWidth={1.5} />

      {/* hour ticks */}
      {ticks.map((tk, i) => (
        <g key={i}>
          <line x1={tk.x} y1={height - 2} x2={tk.x} y2={height - 6} stroke={t.lineStrong} />
          <text x={tk.x} y={height + 10} fontSize="8" textAnchor="middle"
            fill={t.inkFaint} fontFamily="var(--font-mono)" style={{ letterSpacing: '0.06em' }}>
            {String(tk.h).padStart(2, '0')}h
          </text>
        </g>
      ))}
    </svg>
  );
}
