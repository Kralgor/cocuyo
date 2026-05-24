import React from 'react';
import { Theme } from '../../lib/theme';

interface Props {
  theme: Theme;
  label: string;
  value: string | number;
  unit?: string;
  sub?: string;
}

export default function MiniStat({ theme: t, label, value, unit, sub }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <div style={{
        fontSize: 9, color: t.inkFaint,
        textTransform: 'uppercase', letterSpacing: '0.08em',
        fontFamily: 'var(--font-mono)',
      }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span style={{
          fontSize: 22, color: t.ink, fontWeight: 500,
          fontFamily: 'var(--font-serif)', letterSpacing: '-0.02em',
        }}>
          {value}
        </span>
        {unit && (
          <span style={{ fontSize: 10, color: t.inkFaint, fontFamily: 'var(--font-mono)' }}>
            {unit}
          </span>
        )}
      </div>
      {sub && (
        <div style={{ fontSize: 9.5, color: t.inkDim, fontFamily: 'var(--font-mono)' }}>
          {sub}
        </div>
      )}
    </div>
  );
}
