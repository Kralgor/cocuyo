import React from 'react';
import { Theme } from '../../lib/theme';

interface Props {
  theme: Theme;
  label: string;
  value: number;
  sub?: string;
  color?: string;
}

export default function SignalBar({ theme: t, label, value, sub, color }: Props) {
  const c = color ?? t.accent;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        fontSize: 10, color: t.inkDim,
        fontFamily: 'var(--font-mono)', letterSpacing: '0.04em',
      }}>
        <span style={{ textTransform: 'uppercase' }}>{label}</span>
        <span style={{ color: t.ink, fontVariantNumeric: 'tabular-nums' }}>
          {Math.round(value * 100)}
        </span>
      </div>
      <div style={{
        height: 4, background: t.panel2, overflow: 'hidden', position: 'relative',
        borderRadius: `${t.radius}px`,
      }}>
        <div style={{ height: '100%', width: `${Math.min(1, Math.max(0, value)) * 100}%`, background: c }} />
      </div>
      {sub && (
        <div style={{ fontSize: 9, color: t.inkFaint, fontFamily: 'var(--font-mono)' }}>{sub}</div>
      )}
    </div>
  );
}
