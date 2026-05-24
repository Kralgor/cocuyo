import React, { useState, useEffect } from 'react';
import { Theme } from '../lib/theme';
import { Lang } from '../lib/i18n';

interface Props {
  theme:          Theme;
  lang:           Lang;
  outageStartedAt: Date | null;
  ambientTempC:   number | null;
}

interface FoodItem {
  labelEs:    string;
  labelEn:    string;
  baseMinutes: number;
  warningAt:  number; // fraction 0-1 to trigger warn color
}

const FOOD_ITEMS: FoodItem[] = [
  { labelEs: 'Refrigerador',      labelEn: 'Refrigerator',     baseMinutes: 240,  warningAt: 0.75 },
  { labelEs: 'Congelador lleno',  labelEn: 'Full freezer',     baseMinutes: 2880, warningAt: 0.80 },
  { labelEs: 'Congelador medio',  labelEn: 'Half freezer',     baseMinutes: 1440, warningAt: 0.80 },
];

interface MedItem {
  labelEs:  string;
  labelEn:  string;
  noteEs:   string;
  noteEn:   string;
  safeHours: number | null; // null = indefinite at room temp
}

const MED_ITEMS: MedItem[] = [
  {
    labelEs:   'Insulina (abierta)',
    labelEn:   'Insulin (opened)',
    noteEs:    'Segura hasta 28 días a temperatura ambiente',
    noteEn:    'Safe up to 28 days at room temp',
    safeHours: 672,
  },
  {
    labelEs:   'Insulina (sin abrir)',
    labelEn:   'Insulin (unopened)',
    noteEs:    'Reemplazar en 24h si no refrigerada',
    noteEn:    'Replace within 24h if not refrigerated',
    safeHours: 24,
  },
  {
    labelEs:   'Antibióticos líquidos',
    labelEn:   'Liquid antibiotics',
    noteEs:    'Descartar después de 24h sin refrigeración',
    noteEn:    'Discard after 24h without refrigeration',
    safeHours: 24,
  },
];

function tempMultiplier(tempC: number | null): number {
  if (tempC == null) return 1.0;
  if (tempC >= 35) return 0.60;
  if (tempC >= 30) return 0.70;
  if (tempC >= 25) return 0.85;
  return 1.0;
}

function fmtDuration(minutes: number, lang: Lang): string {
  if (minutes <= 0) return lang === 'es' ? '0 min' : '0 min';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m} min`;
  return lang === 'es' ? `${h} h ${m} min` : `${h}h ${m}m`;
}

function elapsed(since: Date, now: Date): number {
  return (now.getTime() - since.getTime()) / 60000;
}

interface StatusBand {
  label:  string;
  color:  string;
}

function getStatus(elapsedMin: number, limitMin: number, theme: Theme, lang: Lang): StatusBand {
  const ratio = elapsedMin / limitMin;
  const remaining = limitMin - elapsedMin;

  if (ratio >= 1.0) {
    return {
      label: lang === 'es' ? 'NO CONSUMIR' : 'DO NOT EAT',
      color: theme.danger,
    };
  }
  if (ratio >= 0.85) {
    return {
      label: lang === 'es'
        ? `${fmtDuration(remaining, lang)} — REVISAR`
        : `${fmtDuration(remaining, lang)} — CHECK`,
      color: theme.warn,
    };
  }
  if (ratio >= 0.60) {
    return {
      label: lang === 'es'
        ? `~${fmtDuration(remaining, lang)} restantes`
        : `~${fmtDuration(remaining, lang)} left`,
      color: theme.risk,
    };
  }
  return {
    label: lang === 'es'
      ? `SEGURO (~${fmtDuration(remaining, lang)} restantes)`
      : `SAFE (~${fmtDuration(remaining, lang)} remaining)`,
    color: theme.ok,
  };
}

export default function FoodSafetyTimer({ theme: t, lang, outageStartedAt, ambientTempC }: Props) {
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const mult    = tempMultiplier(ambientTempC);
  const adjusted = ambientTempC != null && ambientTempC >= 30;

  const elapsedMin = outageStartedAt ? elapsed(outageStartedAt, now) : 0;

  const label = (es: string, en: string) => lang === 'es' ? es : en;

  return (
    <div style={{
      background: t.panel,
      border:     `0.5px solid ${t.line}`,
      padding:    '16px',
    }}>

      {/* header */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 14 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.14em', color: t.inkFaint, textTransform: 'uppercase' }}>
          {label('Seguridad alimentaria', 'Food safety')}
        </span>
        {outageStartedAt && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: t.inkDim }}>
            {label('Apagón', 'Outage')}: {fmtDuration(elapsedMin, lang)}
          </span>
        )}
      </div>

      {/* temp warning */}
      {adjusted && (
        <div style={{
          background: `${t.warn}18`,
          border:     `0.5px solid ${t.warn}55`,
          padding:    '7px 10px',
          marginBottom: 12,
          fontFamily: 'var(--font-mono)',
          fontSize:   11,
          color:      t.warn,
        }}>
          {ambientTempC}°C — {label(
            `Ventanas reducidas ~${Math.round((1 - mult) * 100)}% por calor`,
            `Windows shortened ~${Math.round((1 - mult) * 100)}% by heat`
          )}
        </div>
      )}

      {!outageStartedAt && (
        <div style={{ color: t.inkFaint, fontSize: 13, marginBottom: 12 }}>
          {label('Inicia cuando se detecte un apagón.', 'Starts when an outage is detected.')}
        </div>
      )}

      {/* food rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
        {FOOD_ITEMS.map((item) => {
          const limit  = item.baseMinutes * mult;
          const status = outageStartedAt
            ? getStatus(elapsedMin, limit, t, lang)
            : { label: label('En espera', 'Waiting'), color: t.inkFaint };
          const progress = outageStartedAt ? Math.min(1, elapsedMin / limit) : 0;

          return (
            <div key={item.labelEn} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: 13, color: t.ink }}>
                  {lang === 'es' ? item.labelEs : item.labelEn}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: status.color }}>
                  {status.label}
                </span>
              </div>
              {/* progress bar */}
              <div style={{ height: 3, background: t.line, position: 'relative' }}>
                <div style={{
                  position:   'absolute',
                  left:       0,
                  top:        0,
                  height:     '100%',
                  width:      `${progress * 100}%`,
                  background: status.color,
                  transition: 'width 0.4s ease',
                }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* divider */}
      <div style={{ height: '0.5px', background: t.line, margin: '12px 0' }} />

      {/* medications */}
      <div style={{
        fontFamily: 'var(--font-mono)',
        fontSize:   10,
        letterSpacing: '0.12em',
        color:      t.inkFaint,
        textTransform: 'uppercase',
        marginBottom: 8,
      }}>
        {label('Medicamentos', 'Medications')}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {MED_ITEMS.map((med) => {
          const limitMin   = med.safeHours != null ? med.safeHours * 60 * mult : null;
          const isExpired  = limitMin != null && outageStartedAt && elapsedMin >= limitMin;
          const remaining  = limitMin != null ? limitMin - elapsedMin : null;
          const statusCol  = isExpired ? t.danger : (remaining != null && remaining < 120) ? t.warn : t.inkDim;

          return (
            <div key={med.labelEn} style={{ borderLeft: `2px solid ${statusCol}44`, paddingLeft: 10 }}>
              <div style={{ fontSize: 13, color: t.ink, marginBottom: 2 }}>
                {lang === 'es' ? med.labelEs : med.labelEn}
              </div>
              <div style={{ fontSize: 11, color: statusCol, fontFamily: 'var(--font-mono)' }}>
                {isExpired
                  ? label('REVISAR / DESCARTAR', 'CHECK / DISCARD')
                  : (lang === 'es' ? med.noteEs : med.noteEn)
                }
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
}
