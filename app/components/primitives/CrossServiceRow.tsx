import React from 'react';
import { Theme } from '../../lib/theme';
import { Lang } from '../../lib/i18n';

export type ServiceStatus = 'ok' | 'degraded' | 'down' | 'pending';

export interface ServiceItem {
  label: string;
  status: ServiceStatus;
  detail?: string;
}

interface Props {
  theme: Theme;
  lang?: Lang;
  items: ServiceItem[];
}

const STATUS_LABEL: Record<ServiceStatus, { es: string; en: string }> = {
  ok:       { es: 'normal',    en: 'normal' },
  degraded: { es: 'degradado', en: 'degraded' },
  down:     { es: 'caído',     en: 'down' },
  pending:  { es: 'monitor',   en: 'monitor' },
};

export default function CrossServiceRow({ theme: t, lang = 'es', items }: Props) {
  function statusColor(s: ServiceStatus): string {
    if (s === 'down')     return t.danger;
    if (s === 'degraded') return t.warn;
    if (s === 'pending')  return t.accent;
    return t.ok;
  }

  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {items.map((it, i) => {
        const color = statusColor(it.status);
        const lbl   = STATUS_LABEL[it.status][lang];
        return (
          <div key={i} style={{
            flex: 1,
            background: t.panel2,
            border: `0.5px solid ${t.line}`,
            borderRadius: `${t.radius + 4}px`,
            padding: '8px 10px',
            display: 'flex', flexDirection: 'column', gap: 4,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{
                width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0,
              }} />
              <span style={{
                fontSize: 10, color: t.inkDim,
                textTransform: 'uppercase', letterSpacing: '0.06em',
                fontFamily: 'var(--font-mono)',
              }}>
                {it.label}
              </span>
            </div>
            <div style={{ fontSize: 11, color: t.ink, fontWeight: 500 }}>{lbl}</div>
            {it.detail && (
              <div style={{ fontSize: 9.5, color: t.inkFaint, fontFamily: 'var(--font-mono)' }}>
                {it.detail}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
