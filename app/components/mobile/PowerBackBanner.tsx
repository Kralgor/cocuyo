import React, { useState, useEffect } from 'react';
import { Theme } from '../../lib/theme';
import { tt, Lang } from '../../lib/i18n';
import { submitReport } from '../../lib/api';
import { loadLastReport, saveLastReport } from './ReportButtons';
import { getRegion } from './RegionPicker';

const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;

interface Props {
  theme: Theme;
  lang:  Lang;
}

type BannerState = 'visible' | 'submitting' | 'dismissed';

export default function PowerBackBanner({ theme: t, lang }: Props) {
  const [state, setState] = useState<BannerState>('dismissed');
  const [regionName, setRegionName] = useState('');
  const [regionKey,  setRegionKey]  = useState('');

  useEffect(() => {
    const last = loadLastReport();
    if (!last) return;
    if (last.status !== 'no_power') return;
    if (Date.now() - last.timestamp > TWELVE_HOURS_MS) return;

    const region = getRegion(last.region);
    setRegionKey(last.region);
    setRegionName(region?.name ?? last.region);
    setState('visible');
  }, []);

  async function handleConfirm() {
    setState('submitting');
    try {
      await submitReport({
        region:        regionKey,
        status:        'power_back',
        lat:           null,
        lon:           null,
        city_freetext: null,
      });
      saveLastReport({ region: regionKey, status: 'power_back', timestamp: Date.now() });
    } catch {
      // Dismiss even on error — don't keep pestering user
    }
    setState('dismissed');
  }

  function handleDismiss() {
    setState('dismissed');
  }

  if (state === 'dismissed') return null;

  return (
    <div style={{
      margin: '0 0 0 0',
      padding: '12px 16px',
      background: `${t.ok}18`,
      borderBottom: `0.5px solid ${t.ok}44`,
      display: 'flex', alignItems: 'center', gap: 12,
    }}>
      {/* Pulsing dot */}
      <span style={{
        width: 8, height: 8, borderRadius: '50%',
        background: t.ok, flexShrink: 0,
        animation: 'firefly-float 2s ease-in-out infinite',
      }} />

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 10,
          color: t.inkFaint, textTransform: 'uppercase',
          letterSpacing: '0.06em', marginBottom: 2,
        }}>
          {regionName}
        </div>
        <div style={{ fontSize: 13, color: t.ink, fontWeight: 500 }}>
          {tt('power_back_q', lang)}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        <button
          onClick={handleDismiss}
          style={{
            background: 'none', border: 'none',
            fontFamily: 'var(--font-mono)', fontSize: 10,
            color: t.inkFaint, cursor: 'pointer', padding: '4px 6px',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          ✕
        </button>
        <button
          onClick={handleConfirm}
          disabled={state === 'submitting'}
          style={{
            padding: '6px 12px',
            border: `0.5px solid ${t.ok}`,
            background: `${t.ok}22`,
            color: t.ok,
            fontFamily: 'var(--font-mono)', fontSize: 10,
            letterSpacing: '0.06em', textTransform: 'uppercase',
            cursor: state === 'submitting' ? 'default' : 'pointer',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          {state === 'submitting'
            ? '…'
            : tt('tap_to_confirm', lang)}
        </button>
      </div>
    </div>
  );
}
