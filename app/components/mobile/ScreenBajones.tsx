import React from 'react';
import { Theme } from '../../lib/theme';
import { tt, Lang } from '../../lib/i18n';
import SectionLabel from '../primitives/SectionLabel';

interface Props {
  theme: Theme;
  lang:  Lang;
}

export default function ScreenBajones({ theme: t, lang }: Props) {
  return (
    <div style={{ padding: '18px 22px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Section header ── */}
      <SectionLabel theme={t} label={tt('bajones_title', lang)} />

      {/* ── Pending-feature state ── */}
      <div style={{
        padding: '28px 20px',
        background: t.panel,
        border: `0.5px solid ${t.line}`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 14,
        textAlign: 'center',
      }}>
        <span style={{
          fontFamily: 'var(--font-serif)',
          fontSize: 20,
          color: t.ink,
          fontWeight: 500,
          letterSpacing: '-0.01em',
        }}>
          {tt('bajones_pending_title', lang)}
        </span>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          color: t.inkFaint,
          letterSpacing: '0.02em',
          lineHeight: 1.6,
          maxWidth: 300,
        }}>
          {tt('bajones_pending_body', lang)}
        </span>
      </div>

    </div>
  );
}
