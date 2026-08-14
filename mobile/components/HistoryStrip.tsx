import React from 'react';
import { Dimensions } from 'react-native';
import Svg, { G, Line, Rect, Text as SvgText } from 'react-native-svg';

import { LIGHT_THEME, type MobileTheme } from '@/constants/colors';
import type { HistoryDay } from '@/lib/history';

interface Props {
  days: HistoryDay[];
  theme?: MobileTheme;
  width?: number;
  height?: number;
}

// Port of app/components/primitives/HistoryStrip.tsx (web SVG) to react-native-svg.
// Coordinate math is identical to the web version — only imports and numeric
// width/height changed (RESEARCH.md Pitfall 3: no percentage widths).
export default function HistoryStrip({ days, theme = LIGHT_THEME, width, height = 96 }: Props) {
  const chartW = width ?? Math.floor(Dimensions.get('window').width - 32);
  const N    = days.length;
  const colW = chartW / Math.max(N, 1);
  const rowH = height / 24;
  const ax   = theme.accent;

  const today = new Date();

  return (
    <Svg width={chartW} height={height + 16}>
      {/* hour gridlines */}
      {[6, 12, 18].map(h => (
        <Line key={h} x1={0} y1={h * rowH} x2={chartW} y2={h * rowH}
          stroke={theme.line} strokeDasharray="1 3" />
      ))}

      {/* outage rectangles per day */}
      {days.map((d, i) => (
        <G key={i}>
          {d.outages.map((o, j) => (
            <Rect key={j}
              x={i * colW + colW * 0.12}
              y={o.start_hour * rowH}
              width={colW * 0.76}
              height={o.duration_h * rowH}
              rx={1}
              fill={ax}
              opacity={0.85}
            />
          ))}
          {/* day column frame */}
          <Rect x={i * colW + 0.5} y={0} width={colW - 1} height={height}
            fill="none" stroke={theme.line} strokeWidth={0.5} />
        </G>
      ))}

      {/* hour labels */}
      <SvgText x={2} y={6 * rowH + 3}  fontSize={7} fill={theme.inkFaint}>06</SvgText>
      <SvgText x={2} y={12 * rowH + 3} fontSize={7} fill={theme.inkFaint}>12</SvgText>
      <SvgText x={2} y={18 * rowH + 3} fontSize={7} fill={theme.inkFaint}>18</SvgText>

      {/* week date markers */}
      {[6, 13, 20, 27].map(i => {
        const dd = new Date(today);
        dd.setDate(today.getDate() - (29 - i));
        return (
          <SvgText key={i} x={i * colW + colW / 2} y={height + 10}
            fontSize={7} textAnchor="middle"
            fill={theme.inkFaint}>
            {dd.getDate()}
          </SvgText>
        );
      })}
    </Svg>
  );
}
