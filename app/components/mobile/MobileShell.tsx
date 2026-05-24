import React, { ReactNode } from 'react';
import { Theme } from '../../lib/theme';
import { Lang } from '../../lib/i18n';
import TabBar, { TabId } from './TabBar';
import FireflyDot from '../primitives/FireflyDot';

interface Props {
  theme: Theme;
  lang: Lang;
  title?: string;
  subtitle?: string;
  titleAction?: ReactNode;
  accentColor?: string;
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  onSettingsOpen?: () => void;
  noTabBar?: boolean;
  children: ReactNode;
}

export default function MobileShell({
  theme: t, lang, title, subtitle, titleAction, accentColor,
  activeTab, onTabChange, onSettingsOpen, noTabBar = false, children,
}: Props) {
  const ac = accentColor ?? t.accent;

  return (
    <div style={{
      width: '100%',
      height: '100%',
      background: t.bg,
      color: t.ink,
      fontFamily: 'var(--font-inter)',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Title bar */}
      {(title || subtitle) && (
        <div style={{
          padding: '14px 22px 14px',
          borderBottom: `0.5px solid ${t.line}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {subtitle && (
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 9,
                color: t.inkFaint,
                textTransform: 'uppercase',
                letterSpacing: '0.18em',
              }}>
                {subtitle}
              </span>
            )}
            {title && (
              <span style={{
                fontFamily: 'var(--font-serif)',
                fontSize: 26,
                color: t.ink,
                fontWeight: 500,
                letterSpacing: '-0.02em',
                lineHeight: 1.05,
              }}>
                {title}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {titleAction}
            {onSettingsOpen ? (
              <button
                onClick={onSettingsOpen}
                aria-label="Settings"
                style={{
                  background: 'none',
                  border: `0.5px solid ${t.line}`,
                  borderRadius: `${t.radius + 3}px`,
                  width: 32, height: 32,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: t.inkDim, cursor: 'pointer',
                  WebkitTapHighlightColor: 'transparent',
                  flexShrink: 0,
                }}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <circle cx="7" cy="7" r="2" stroke="currentColor" strokeWidth="1.2"/>
                  <path d="M7 1v1.5M7 11.5V13M1 7h1.5M11.5 7H13M2.93 2.93l1.06 1.06M10.01 10.01l1.06 1.06M11.07 2.93l-1.06 1.06M3.99 10.01l-1.06 1.06" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
              </button>
            ) : !titleAction ? (
              <FireflyDot color={ac} size={10} pulse />
            ) : null}
          </div>
        </div>
      )}

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', minHeight: 0 }}>
        {children}
      </div>

      {/* Tab bar */}
      {!noTabBar && (
        <TabBar theme={t} lang={lang} activeTab={activeTab} onTabChange={onTabChange} />
      )}

      {/* iOS home indicator */}
      <div style={{
        height: 30,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-end',
        paddingBottom: 8,
        background: t.bg,
        flexShrink: 0,
      }}>
        <div style={{
          width: 134, height: 5,
          borderRadius: 99,
          background: t.ink,
          opacity: 0.4,
        }} />
      </div>
    </div>
  );
}
