import React from 'react';
import { Theme } from '../../lib/theme';
import { tt, Lang } from '../../lib/i18n';
import TabIcon from './TabIcon';

export type TabId = 'zone' | 'map' | 'forecast' | 'bajones' | 'history';

interface TabDef {
  id: TabId;
  labelKey: string;
  icon: 'zone' | 'map' | 'forecast' | 'wave' | 'hist';
}

const TABS: TabDef[] = [
  { id: 'zone',     labelKey: 'nav_zone',    icon: 'zone'     },
  { id: 'map',      labelKey: 'nav_map',     icon: 'map'      },
  { id: 'forecast', labelKey: 'forecast',    icon: 'forecast' },
  { id: 'bajones',  labelKey: 'nav_bajones', icon: 'wave'     },
  { id: 'history',  labelKey: 'nav_history', icon: 'hist'     },
];

interface Props {
  theme: Theme;
  lang: Lang;
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

export default function TabBar({ theme: t, lang, activeTab, onTabChange }: Props) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${TABS.length}, 1fr)`,
      borderTop: `0.5px solid ${t.line}`,
      background: t.panel,
      padding: '8px 4px 4px',
    }}>
      {TABS.map(tab => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
              color: isActive ? t.accent : t.inkFaint,
              padding: '4px 0',
              background: 'none', border: 'none', cursor: 'pointer',
              WebkitTapHighlightColor: 'transparent',
            }}
            aria-label={tt(tab.labelKey, lang)}
            aria-current={isActive ? 'page' : undefined}
          >
            <TabIcon name={tab.icon} color="currentColor" />
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 8.5,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}>
              {tt(tab.labelKey, lang)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
