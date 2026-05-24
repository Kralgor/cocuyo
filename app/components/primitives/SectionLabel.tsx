import React from 'react';
import { Theme } from '../../lib/theme';

interface Props {
  theme: Theme;
  label: string;
  action?: React.ReactNode;
}

export default function SectionLabel({ theme: t, label, action }: Props) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      paddingBottom: 6,
      borderBottom: `0.5px solid ${t.line}`,
      marginBottom: 12,
    }}>
      <span style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 9,
        textTransform: 'uppercase',
        letterSpacing: '0.10em',
        color: t.inkFaint,
      }}>
        {label}
      </span>
      {action}
    </div>
  );
}
