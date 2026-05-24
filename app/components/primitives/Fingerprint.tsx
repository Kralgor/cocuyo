import React from 'react';
import { Theme } from '../../lib/theme';
import { tt, Lang } from '../../lib/i18n';

export interface Signals {
  inet: number | null;
  sat: number | null;
  crowd: number | null;
  weather: number | null;
}

interface Props {
  signals: Signals;
  theme: Theme;
  size?: number;
  labels?: boolean;
  lang?: Lang;
}

const AXES = [
  { k: 'inet'    as const, angle: -90, sym: 'I', labelKey: 'signal_int'   },
  { k: 'sat'     as const, angle:   0, sym: 'S', labelKey: 'signal_sat'   },
  { k: 'crowd'   as const, angle:  90, sym: 'C', labelKey: 'signal_crowd' },
  { k: 'weather' as const, angle: 180, sym: 'W', labelKey: 'signal_wx'    },
] as const;

const HALF_BASE = 8;
const HALF_TIP  = 22;

function wedgePath(c: number, r0: number, rmax: number, angleDeg: number, len: number): string {
  const a1b = (angleDeg - HALF_BASE) * Math.PI / 180;
  const a2b = (angleDeg + HALF_BASE) * Math.PI / 180;
  const a1t = (angleDeg - HALF_TIP)  * Math.PI / 180;
  const a2t = (angleDeg + HALF_TIP)  * Math.PI / 180;
  const x1 = c + r0  * Math.cos(a1b), y1 = c + r0  * Math.sin(a1b);
  const x2 = c + len * Math.cos(a1t), y2 = c + len * Math.sin(a1t);
  const x3 = c + len * Math.cos(a2t), y3 = c + len * Math.sin(a2t);
  const x4 = c + r0  * Math.cos(a2b), y4 = c + r0  * Math.sin(a2b);
  return `M ${x1} ${y1} L ${x2} ${y2} A ${len} ${len} 0 0 1 ${x3} ${y3} L ${x4} ${y4} A ${r0} ${r0} 0 0 0 ${x1} ${y1} Z`;
}

export default function Fingerprint({ signals, theme: t, size = 120, labels = false, lang = 'es' }: Props) {
  const c    = size / 2;
  const r0   = size * 0.08;
  const rmax = size * 0.46;

  const availValues = AXES
    .map(ax => signals[ax.k])
    .filter((v): v is number => v !== null);
  const total = availValues.length > 0
    ? availValues.reduce((a, b) => a + b, 0) / availValues.length
    : 0;

  return (
    <div style={{ position: 'relative', width: size, height: labels ? size + 28 : size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block' }}>
        {/* outer reference rings */}
        {[0.25, 0.5, 0.75, 1].map(f => (
          <circle key={f} cx={c} cy={c} r={r0 + (rmax - r0) * f}
            fill="none" stroke={t.line} strokeWidth={0.5} strokeDasharray="1 3" />
        ))}

        {/* wedges */}
        {AXES.map(ax => {
          const v = signals[ax.k];
          const isNull = v === null;
          const value  = v ?? 0;
          const len    = r0 + (rmax - r0) * value;

          return (
            <g key={ax.k}>
              {/* ghost track (always shown) */}
              <path d={wedgePath(c, r0, rmax, ax.angle, rmax)}
                fill={t.line} opacity={isNull ? 0.15 : 0.4} />
              {/* live wedge (only when signal available) */}
              {!isNull && (
                <path d={wedgePath(c, r0, rmax, ax.angle, len)}
                  fill={t.accent} opacity={0.25 + value * 0.75} />
              )}
            </g>
          );
        })}

        {/* spokes */}
        {AXES.map(ax => {
          const a = ax.angle * Math.PI / 180;
          return (
            <line key={`sp-${ax.k}`}
              x1={c + r0   * Math.cos(a)} y1={c + r0   * Math.sin(a)}
              x2={c + rmax * Math.cos(a)} y2={c + rmax * Math.sin(a)}
              stroke={t.line} strokeWidth={0.5} strokeDasharray="1 2" />
          );
        })}

        {/* core */}
        <circle cx={c} cy={c} r={r0 * 1.1} fill={t.bg} stroke={t.accent} strokeWidth={0.7} opacity={0.5 + total * 0.5} />
        <circle cx={c} cy={c} r={r0 * 0.4} fill={t.accent} opacity={0.4 + total * 0.6} />

        {/* axis symbols */}
        {AXES.map(ax => {
          const a  = ax.angle * Math.PI / 180;
          const lx = c + (rmax + 8) * Math.cos(a);
          const ly = c + (rmax + 8) * Math.sin(a);
          return (
            <text key={ax.k} x={lx} y={ly + 3} fontSize={size * 0.07}
              textAnchor="middle" fill={t.inkFaint}
              fontFamily="var(--font-mono)" style={{ fontWeight: 600, letterSpacing: '0.08em' }}>
              {ax.sym}
            </text>
          );
        })}
      </svg>

      {labels && (
        <div style={{
          marginTop: 6,
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 12px',
          fontFamily: 'var(--font-mono)', fontSize: 9,
          color: t.inkDim, letterSpacing: '0.04em',
        }}>
          {AXES.map(ax => {
            const v = signals[ax.k];
            return (
              <div key={ax.k} style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ textTransform: 'uppercase' }}>{tt(ax.labelKey, lang)}</span>
                <span style={{ color: t.ink, fontVariantNumeric: 'tabular-nums' }}>
                  {v !== null ? Math.round(v * 100) : '—'}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
