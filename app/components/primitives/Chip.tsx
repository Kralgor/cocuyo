import React from 'react';
import { Theme } from '../../lib/theme';

interface Props {
  theme: Theme;
  label: string;
  color?: string;
  outlined?: boolean;
}

export default function Chip({ theme: t, label, color, outlined = false }: Props) {
  const c = color ?? t.accent;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 7px',
      fontSize: 9,
      fontFamily: 'var(--font-mono)',
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      color: outlined ? c : t.bg,
      background: outlined ? 'transparent' : c,
      border: `0.5px solid ${c}`,
      borderRadius: `${t.radius + 3}px`,
      lineHeight: 1.5,
    }}>
      {label}
    </span>
  );
}
