import React from 'react';
import { Dimensions } from 'react-native';
import Svg, { Defs, G, Line, LinearGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';

import { LIGHT_THEME, type MobileTheme } from '@/constants/colors';
import type { ForecastPoint } from '@/lib/history';

interface Props {
  forecast_48h: ForecastPoint[];
  theme?: MobileTheme;
  width?: number;
  height?: number;
  accentColor?: string;
}

// Port of app/components/primitives/ForecastCurve.tsx (web SVG) to react-native-svg.
// forecast_48h is 96 half-hour points (2 per hour); web version consumed the
// risk values directly — mapping happens here. Coordinate math identical.
export default function ForecastCurve({
  forecast_48h, theme = LIGHT_THEME, width, height = 96, accentColor,
}: Props) {
  const chartW = width ?? Math.floor(Dimensions.get('window').width - 32);
  const data   = forecast_48h.map(p => p.risk);
  const N      = data.length;
  const ax     = accentColor ?? theme.accent;
  const stepX  = chartW / Math.max(N - 1, 1);
  const ys     = data.map(v => height - height * 0.92 * v - height * 0.04);

  let area = `M 0 ${height} `;
  for (let i = 0; i < N; i++) area += `L ${(i * stepX).toFixed(1)} ${ys[i].toFixed(1)} `;
  area += `L ${chartW} ${height} Z`;

  let line = `M 0 ${ys[0]?.toFixed(1) ?? height} `;
  for (let i = 1; i < N; i++) line += `L ${(i * stepX).toFixed(1)} ${ys[i].toFixed(1)} `;

  const startH = new Date().getHours();
  const ticks = [0, 6, 12, 18, 24].map(h => ({
    x: ((h * 2) / Math.max(N - 1, 1)) * chartW,
    h: (startH + h) % 24,
  }));

  const gradId = `fc-grad-${ax.replace('#', '')}`;

  return (
    <Svg width={chartW} height={height + 12}>
      <Defs>
        <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%"   stopColor={ax} stopOpacity={0.55} />
          <Stop offset="100%" stopColor={ax} stopOpacity={0} />
        </LinearGradient>
      </Defs>

      {/* high-risk band */}
      <Rect x={0} y={height * 0.05} width={chartW} height={height * 0.25}
        fill={theme.danger} opacity={0.04} />

      {/* gridlines */}
      {[0.25, 0.5, 0.75].map(f => (
        <Line key={f} x1={0} y1={height * (1 - f)} x2={chartW} y2={height * (1 - f)}
          stroke={theme.line} strokeDasharray="1 4" />
      ))}

      {/* area fill */}
      <Path d={area} fill={`url(#${gradId})`} />

      {/* forecast line */}
      <Path d={line} fill="none" stroke={ax} strokeWidth={1.5} />

      {/* hour ticks */}
      {ticks.map((tk, i) => (
        <G key={i}>
          <Line x1={tk.x} y1={height - 2} x2={tk.x} y2={height - 6} stroke={theme.lineStrong} />
          <SvgText x={tk.x} y={height + 10} fontSize={8} textAnchor="middle"
            fill={theme.inkFaint}>
            {String(tk.h).padStart(2, '0')}h
          </SvgText>
        </G>
      ))}
    </Svg>
  );
}
