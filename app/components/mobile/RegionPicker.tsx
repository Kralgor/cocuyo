import React, { useState } from 'react';
import { Theme } from '../../lib/theme';
import { tt, Lang } from '../../lib/i18n';

export interface RegionDef {
  key: string;
  name: string;         // short city name for display
  state: string;
  displayName: string;  // "City (State)" — matches pipeline
}

const REGION_GROUPS: { label: string; labelEn: string; regions: RegionDef[] }[] = [
  {
    label: 'Occidente', labelEn: 'West',
    regions: [
      { key: 'maracaibo',      name: 'Maracaibo',        state: 'Zulia',            displayName: 'Maracaibo (Zulia)' },
      { key: 'san_cristobal',  name: 'San Cristóbal',    state: 'Táchira',          displayName: 'San Cristóbal (Táchira)' },
      { key: 'merida',         name: 'Mérida',           state: 'Mérida',           displayName: 'Mérida (Mérida)' },
      { key: 'valera',         name: 'Valera',           state: 'Trujillo',         displayName: 'Valera (Trujillo)' },
      { key: 'barquisimeto',   name: 'Barquisimeto',     state: 'Lara',             displayName: 'Barquisimeto (Lara)' },
      { key: 'punto_fijo',     name: 'Punto Fijo',       state: 'Falcón',           displayName: 'Punto Fijo (Falcón)' },
      { key: 'barinas',        name: 'Barinas',          state: 'Barinas',          displayName: 'Barinas (Barinas)' },
    ],
  },
  {
    label: 'Centro', labelEn: 'Central',
    regions: [
      { key: 'valencia',       name: 'Valencia',         state: 'Carabobo',         displayName: 'Valencia (Carabobo)' },
      { key: 'maracay',        name: 'Maracay',          state: 'Aragua',           displayName: 'Maracay (Aragua)' },
      { key: 'caracas',        name: 'Caracas',          state: 'Distrito Capital', displayName: 'Caracas (Distrito Capital)' },
      { key: 'los_teques',     name: 'Los Teques',       state: 'Miranda',          displayName: 'Los Teques (Miranda)' },
      { key: 'guarenas_guatire',name:'Guarenas-Guatire', state: 'Miranda',          displayName: 'Guarenas-Guatire (Miranda)' },
    ],
  },
  {
    label: 'Oriente', labelEn: 'East',
    regions: [
      { key: 'maturin',        name: 'Maturín',          state: 'Monagas',          displayName: 'Maturín (Monagas)' },
      { key: 'barcelona',      name: 'Barcelona',        state: 'Anzoátegui',       displayName: 'Barcelona (Anzoátegui)' },
      { key: 'cumana',         name: 'Cumaná',           state: 'Sucre',            displayName: 'Cumaná (Sucre)' },
      { key: 'porlamar',       name: 'Porlamar',         state: 'Nueva Esparta',    displayName: 'Porlamar (Nueva Esparta)' },
      { key: 'ciudad_guayana', name: 'Ciudad Guayana',   state: 'Bolívar',          displayName: 'Ciudad Guayana (Bolívar)' },
    ],
  },
];

export const ALL_REGIONS: RegionDef[] = REGION_GROUPS.flatMap(g => g.regions);

export function getRegion(key: string): RegionDef | undefined {
  return ALL_REGIONS.find(r => r.key === key);
}

interface Props {
  theme: Theme;
  lang: Lang;
  onSelect: (key: string) => void;
}

export default function RegionPicker({ theme: t, lang, onSelect }: Props) {
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: t.bg,
      display: 'flex', flexDirection: 'column',
      fontFamily: 'var(--font-inter)',
    }}>
      {/* Header */}
      <div style={{
        padding: '28px 24px 16px',
        borderBottom: `0.5px solid ${t.line}`,
        flexShrink: 0,
      }}>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 9,
          textTransform: 'uppercase', letterSpacing: '0.18em',
          color: t.inkFaint, marginBottom: 6,
        }}>
          cocuyo
        </div>
        <div style={{
          fontFamily: 'var(--font-serif)', fontSize: 26,
          fontWeight: 500, letterSpacing: '-0.02em', lineHeight: 1.1,
          color: t.ink,
        }}>
          {tt('pick_region', lang)}
        </div>
        <div style={{
          marginTop: 6, fontSize: 12,
          color: t.inkDim, lineHeight: 1.4,
        }}>
          {tt('pick_prompt', lang)}
        </div>
      </div>

      {/* Scrollable list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0 24px' }}>
        {REGION_GROUPS.map(group => (
          <div key={group.label}>
            {/* Group label */}
            <div style={{
              padding: '14px 24px 6px',
              fontFamily: 'var(--font-mono)', fontSize: 9,
              textTransform: 'uppercase', letterSpacing: '0.10em',
              color: t.inkFaint,
            }}>
              {lang === 'es' ? group.label : group.labelEn}
            </div>

            {/* City rows */}
            {group.regions.map(region => {
              const isHovered = hovered === region.key;
              return (
                <button
                  key={region.key}
                  onClick={() => onSelect(region.key)}
                  onMouseEnter={() => setHovered(region.key)}
                  onMouseLeave={() => setHovered(null)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    width: '100%', padding: '13px 24px',
                    background: isHovered ? t.panel : 'transparent',
                    border: 'none', borderBottom: `0.5px solid ${t.line}`,
                    cursor: 'pointer', textAlign: 'left',
                    WebkitTapHighlightColor: 'transparent',
                    transition: 'background 0.1s',
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <span style={{ fontSize: 15, color: t.ink, fontWeight: 400 }}>
                      {region.name}
                    </span>
                    <span style={{
                      fontSize: 10, color: t.inkFaint,
                      fontFamily: 'var(--font-mono)', letterSpacing: '0.02em',
                    }}>
                      {region.state}
                    </span>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M5 3l4 4-4 4" stroke={t.inkFaint} strokeWidth="1.2" strokeLinecap="round" />
                  </svg>
                </button>
              );
            })}
          </div>
        ))}

        {/* Unlisted option */}
        <div style={{ padding: '14px 24px 6px' }}>
          <button
            onClick={() => onSelect('unlisted')}
            onMouseEnter={() => setHovered('unlisted')}
            onMouseLeave={() => setHovered(null)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '12px 16px', width: '100%',
              background: hovered === 'unlisted' ? t.panel : 'transparent',
              border: `0.5px solid ${t.line}`,
              borderRadius: `${t.radius + 4}px`,
              cursor: 'pointer', textAlign: 'left',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <span style={{ fontSize: 14, color: t.inkDim }}>{tt('city_not_listed', lang)}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
