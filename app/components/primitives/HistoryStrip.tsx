import React from 'react';
import { Theme } from '../../lib/theme';

export interface DayOutage {
  start: number;
  dur: number;
}

export interface DayRecord {
  date: Date;
  outages: DayOutage[];
}

interface Props {
  theme: Theme;
  days: DayRecord[];
  width?: number;
  height?: number;
}

export default function HistoryStrip({ theme: t, days, width = 320, height = 110 }: Props) {
  const N    = days.length;
  const colW = width / Math.max(N, 1);
  const rowH = height / 24;
  const ax   = t.accent;

  const today = new Date();

  return (
    <svg width="100%" height={height + 16} viewBox={`0 0 ${width} ${height + 16}`} preserveAspectRatio="none">
      {/* hour gridlines */}
      {[6, 12, 18].map(h => (
        <line key={h} x1={0} y1={h * rowH} x2={width} y2={h * rowH}
          stroke={t.line} strokeDasharray="1 3" />
      ))}

      {/* outage rectangles per day */}
      {days.map((d, i) => (
        <g key={i}>
          {d.outages.map((o, j) => (
            <rect key={j}
              x={i * colW + colW * 0.12}
              y={o.start * rowH}
              width={colW * 0.76}
              height={o.dur * rowH}
              rx={1}
              fill={ax}
              opacity={0.85}
            />
          ))}
          {/* day column frame */}
          <rect x={i * colW + 0.5} y={0} width={colW - 1} height={height}
            fill="none" stroke={t.line} strokeWidth={0.5} />
        </g>
      ))}

      {/* hour labels */}
      <text x={2} y={6 * rowH + 3}  fontSize="7" fill={t.inkFaint} fontFamily="var(--font-mono)">06</text>
      <text x={2} y={12 * rowH + 3} fontSize="7" fill={t.inkFaint} fontFamily="var(--font-mono)">12</text>
      <text x={2} y={18 * rowH + 3} fontSize="7" fill={t.inkFaint} fontFamily="var(--font-mono)">18</text>

      {/* week date markers */}
      {[6, 13, 20, 27].map(i => {
        const dd = new Date(today);
        dd.setDate(today.getDate() - (29 - i));
        return (
          <text key={i} x={i * colW + colW / 2} y={height + 10}
            fontSize="7" textAnchor="middle"
            fill={t.inkFaint} fontFamily="var(--font-mono)">
            {dd.getDate()}
          </text>
        );
      })}
    </svg>
  );
}
