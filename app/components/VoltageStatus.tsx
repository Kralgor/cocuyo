import React from 'react';
import { Theme } from '../lib/theme';
import { Lang } from '../lib/i18n';

type WaveSeverity = 'mild' | 'moderate' | 'severe' | null;

interface Props {
  theme:           Theme;
  lang:            Lang;
  bajones15min:    number | null;
  waveDetected:    boolean | null;
  waveSeverity:    WaveSeverity;
}

const SEV_COLOR: Record<NonNullable<WaveSeverity>, string> = {
  mild:     '#d8b13a',
  moderate: '#d96f30',
  severe:   '#c8412d',
};

const SEV_LABEL: Record<NonNullable<WaveSeverity>, { es: string; en: string }> = {
  mild:     { es: 'Leve',     en: 'Mild' },
  moderate: { es: 'Moderada', en: 'Moderate' },
  severe:   { es: 'SEVERA',   en: 'SEVERE' },
};

export default function VoltageStatus({ theme: t, lang, bajones15min, waveDetected, waveSeverity }: Props) {
  const lbl = (es: string, en: string) => lang === 'es' ? es : en;
  const noData = bajones15min == null && waveDetected == null;
  const wave   = waveDetected === true;
  const sevCol = waveSeverity ? SEV_COLOR[waveSeverity] : (wave ? t.warn : t.ok);

  return (
    <div style={{
      background: t.panel,
      border:     `0.5px solid ${wave ? `${sevCol}55` : t.line}`,
      padding:    '14px 16px',
    }}>

      {/* header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 10,
          letterSpacing: '0.14em', color: t.inkFaint, textTransform: 'uppercase',
        }}>
          {lbl('Calidad del voltaje', 'Voltage quality')}
        </span>

        {!noData && (
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600,
            color: sevCol,
          }}>
            {wave
              ? (waveSeverity
                  ? `${SEV_LABEL[waveSeverity][lang]} — ${lbl('OLA DETECTADA', 'WAVE DETECTED')}`
                  : lbl('OLA DETECTADA', 'WAVE DETECTED'))
              : lbl('Estable', 'Stable')}
          </span>
        )}
      </div>

      {/* wave alert */}
      {wave && (
        <div style={{
          background: `${sevCol}18`,
          border:     `0.5px solid ${sevCol}55`,
          padding:    '8px 12px',
          marginBottom: 10,
        }}>
          <div style={{ fontSize: 13, color: t.ink, marginBottom: 4 }}>
            {lbl('Inestabilidad detectada — desconecta electrodomésticos sensibles.', 'Instability detected — unplug sensitive appliances.')}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: t.inkDim }}>
            {lbl(
              'Los bajones preceden apagones 10-30 min. Riesgo de daño a equipos.',
              'Voltage dips precede outages by 10-30 min. Risk of appliance damage.'
            )}
          </div>
        </div>
      )}

      {/* count row */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 28, fontWeight: 700,
          color: wave ? sevCol : t.inkDim,
          lineHeight: 1,
        }}>
          {bajones15min ?? '—'}
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: t.inkFaint }}>
          {lbl('reportes inestables · 15 min', 'unstable reports · 15 min')}
        </span>
      </div>

      {/* threshold indicator */}
      {bajones15min != null && (
        <div style={{ marginTop: 8 }}>
          <div style={{ height: 3, background: t.line }}>
            <div style={{
              height:     '100%',
              width:      `${Math.min(1, bajones15min / 20) * 100}%`,
              background: sevCol,
              transition: 'width 0.4s ease',
            }} />
          </div>
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            fontFamily: 'var(--font-mono)', fontSize: 9,
            color: t.inkFaint, marginTop: 3,
          }}>
            <span>0</span>
            <span style={{ color: bajones15min > 5 ? sevCol : t.inkFaint }}>
              {lbl(`>5 → ola`, `>5 → wave`)}
            </span>
            <span>20+</span>
          </div>
        </div>
      )}

      {/* no data */}
      {noData && (
        <div style={{ color: t.inkFaint, fontSize: 13, marginTop: 4 }}>
          {lbl('Sin datos de bajones.', 'No voltage data.')}
        </div>
      )}

    </div>
  );
}
