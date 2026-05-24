import React from 'react';
import { useApp } from '../../contexts/AppContext';
import { tt } from '../../lib/i18n';
import { Theme } from '../../lib/theme';
import { Lang } from '../../lib/i18n';

interface Props {
  theme:   Theme;
  lang:    Lang;
  onClose: () => void;
}

function Row({ children, theme: t }: { children: React.ReactNode; theme: Theme }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '16px 0',
      borderBottom: `0.5px solid ${t.line}`,
    }}>
      {children}
    </div>
  );
}

function Label({ label, sub, theme: t }: { label: string; sub?: string; theme: Theme }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 14, color: t.ink }}>{label}</span>
      {sub && (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: t.inkFaint, letterSpacing: '0.04em' }}>
          {sub}
        </span>
      )}
    </div>
  );
}

function SegmentedControl({
  options, value, onChange, theme: t,
}: {
  options: { key: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  theme: Theme;
}) {
  return (
    <div style={{
      display: 'flex',
      border: `0.5px solid ${t.line}`,
      borderRadius: `${t.radius + 4}px`,
      overflow: 'hidden',
    }}>
      {options.map((opt, i) => {
        const active = opt.key === value;
        return (
          <button
            key={opt.key}
            onClick={() => onChange(opt.key)}
            style={{
              flex: 1,
              padding: '7px 14px',
              background: active ? t.accent : 'transparent',
              color: active ? t.bg : t.inkDim,
              border: 'none',
              borderLeft: i > 0 ? `0.5px solid ${t.line}` : 'none',
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              WebkitTapHighlightColor: 'transparent',
              transition: 'background 0.15s, color 0.15s',
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export default function Settings({ theme: t, lang, onClose }: Props) {
  const { themeName, setTheme, setLang } = useApp();

  const themeOptions = [
    { key: 'tinta',   label: 'Tinta'   },
    { key: 'estudio', label: 'Estudio' },
  ];

  const langOptions = [
    { key: 'es', label: 'ES' },
    { key: 'en', label: 'EN' },
  ];

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: t.bg,
      display: 'flex', flexDirection: 'column',
      fontFamily: 'var(--font-inter)',
    }}>
      {/* Header */}
      <div style={{
        padding: '20px 24px 16px',
        borderBottom: `0.5px solid ${t.line}`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexShrink: 0,
      }}>
        <div style={{
          fontFamily: 'var(--font-serif)', fontSize: 22,
          fontWeight: 500, letterSpacing: '-0.02em', color: t.ink,
        }}>
          {tt('nav_settings', lang)}
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none', border: `0.5px solid ${t.line}`,
            borderRadius: `${t.radius + 3}px`,
            width: 32, height: 32,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: t.inkDim, cursor: 'pointer',
            WebkitTapHighlightColor: 'transparent',
          }}
          aria-label="Cerrar"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 2l8 8M10 2L2 10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      {/* Settings rows */}
      <div style={{ padding: '0 24px', flex: 1, overflowY: 'auto' }}>

        {/* Theme */}
        <Row theme={t}>
          <Label
            theme={t}
            label={lang === 'es' ? 'Tema' : 'Theme'}
            sub={themeName === 'tinta'
              ? (lang === 'es' ? 'Oscuro · papel de tinta' : 'Dark · ink paper')
              : (lang === 'es' ? 'Claro · papel estudio' : 'Light · studio paper')}
          />
          <SegmentedControl
            theme={t}
            options={themeOptions}
            value={themeName}
            onChange={v => setTheme(v as 'tinta' | 'estudio')}
          />
        </Row>

        {/* Language */}
        <Row theme={t}>
          <Label
            theme={t}
            label={lang === 'es' ? 'Idioma' : 'Language'}
            sub={lang === 'es' ? 'Español' : 'English'}
          />
          <SegmentedControl
            theme={t}
            options={langOptions}
            value={lang}
            onChange={v => setLang(v as 'es' | 'en')}
          />
        </Row>

        {/* App info */}
        <div style={{ marginTop: 32, padding: '16px 0' }}>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 9,
            textTransform: 'uppercase', letterSpacing: '0.10em',
            color: t.inkFaint, marginBottom: 12,
          }}>
            {lang === 'es' ? 'Acerca de' : 'About'}
          </div>
          <div style={{ fontSize: 12, color: t.inkDim, lineHeight: 1.6 }}>
            {tt('tagline', lang)}
          </div>
          <div style={{
            marginTop: 10,
            fontFamily: 'var(--font-mono)', fontSize: 9,
            color: t.inkFaint, letterSpacing: '0.04em',
          }}>
            {lang === 'es' ? 'Fase 1 · Solo datos de comunidad' : 'Phase 1 · Crowd data only'}
          </div>
        </div>
      </div>
    </div>
  );
}
