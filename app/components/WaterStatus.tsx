import React, { useState, useEffect } from 'react';
import { Theme } from '../lib/theme';
import { Lang } from '../lib/i18n';

type TankLevel = 'full' | 'half' | 'low' | 'empty';
type WaterRisk = 'low' | 'medium' | 'high' | 'critical';

interface Props {
  theme:           Theme;
  lang:            Lang;
  regionKey:       string;
  outageHours:     number | null;
}

// Mirror of pipeline/water_predictor.py region profiles (frontend copy).
// Source of truth is Python; these are kept in sync manually.
const BASE_LOSS_HOURS: Record<string, number> = {
  maracaibo:         3.0,
  punto_fijo:        3.5,
  merida:            4.0,
  valera:            4.0,
  san_cristobal:     4.5,
  barquisimeto:      5.0,
  barinas:           5.0,
  cumana:            5.0,
  maturin:           5.0,
  barcelona:         5.5,
  porlamar:          5.5,
  ciudad_guayana:    5.5,
  caracas:           6.0,
  los_teques:        6.0,
  guarenas_guatire:  6.0,
  valencia:          6.0,
  maracay:           6.0,
};

const TANK_MULT: Record<TankLevel, number> = {
  full:  1.5,
  half:  1.0,
  low:   0.5,
  empty: 0.0,
};

const K = 1.30;

function lossProbability(outageHours: number, base: number): number {
  if (base <= 0) return 0.98;
  if (outageHours <= 0) return 0.05;
  const t = outageHours / base;
  return Math.min(0.98, 0.05 + 0.90 * (1.0 - Math.exp(-K * t)));
}

function riskLevel(prob: number): WaterRisk {
  if (prob >= 0.85) return 'critical';
  if (prob >= 0.70) return 'high';
  if (prob >= 0.40) return 'medium';
  return 'low';
}

function hoursUntilLoss(outageHours: number, base: number): number | null {
  const current = lossProbability(outageHours, base);
  if (current >= 0.70) return null;
  const tTarget = -Math.log(1.0 - 0.65 / 0.90) / K;
  const targetOutageHours = tTarget * base;
  const remaining = targetOutageHours - outageHours;
  return remaining < 0.02 ? null : remaining;
}

function fmtHours(h: number, lang: Lang): string {
  const hrs = Math.floor(h);
  const min = Math.round((h - hrs) * 60);
  if (hrs === 0) return lang === 'es' ? `${min} min` : `${min} min`;
  if (min === 0) return lang === 'es' ? `${hrs} h` : `${hrs}h`;
  return lang === 'es' ? `${hrs} h ${min} min` : `${hrs}h ${min}m`;
}

const RISK_LABELS: Record<WaterRisk, { es: string; en: string }> = {
  low:      { es: 'Bajo riesgo',    en: 'Low risk' },
  medium:   { es: 'Riesgo medio',   en: 'Medium risk' },
  high:     { es: 'RIESGO ALTO',    en: 'HIGH RISK' },
  critical: { es: 'CRÍTICO',        en: 'CRITICAL' },
};

const STORAGE_TANK = 'cocuyo_water_tank';

export default function WaterStatus({ theme: t, lang, regionKey, outageHours }: Props) {
  const [tankLevel, setTankLevelState] = useState<TankLevel | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_TANK) as TankLevel | null;
    if (stored && stored in TANK_MULT) setTankLevelState(stored);
  }, []);

  function setTank(level: TankLevel) {
    setTankLevelState(level);
    localStorage.setItem(STORAGE_TANK, level);
  }

  const base0   = BASE_LOSS_HOURS[regionKey] ?? 6.0;
  const mult    = tankLevel != null ? TANK_MULT[tankLevel] : 1.0;
  const base    = base0 * mult;
  const hours   = outageHours ?? 0;
  const prob    = outageHours != null ? lossProbability(hours, base) : 0.05;
  const risk    = riskLevel(prob);
  const eta     = outageHours != null ? hoursUntilLoss(hours, base) : null;
  const riskCol = risk === 'critical' ? t.danger
                : risk === 'high'     ? t.warn
                : risk === 'medium'   ? t.risk
                : t.ok;

  const lbl = (es: string, en: string) => lang === 'es' ? es : en;
  const TANK_OPTIONS: { level: TankLevel; es: string; en: string }[] = [
    { level: 'full',  es: 'Lleno',   en: 'Full' },
    { level: 'half',  es: 'Medio',   en: 'Half' },
    { level: 'low',   es: 'Bajo',    en: 'Low' },
    { level: 'empty', es: 'Vacío',   en: 'Empty' },
  ];

  return (
    <div style={{
      background: t.panel,
      border:     `0.5px solid ${t.line}`,
      padding:    '16px',
    }}>

      {/* header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize:   10,
          letterSpacing: '0.14em',
          color:      t.inkFaint,
          textTransform: 'uppercase',
        }}>
          {lbl('Suministro de agua', 'Water supply')}
        </span>
        {outageHours != null && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: riskCol, fontWeight: 600 }}>
            {RISK_LABELS[risk][lang]}
          </span>
        )}
      </div>

      {/* no outage state */}
      {outageHours == null && (
        <div style={{ color: t.inkFaint, fontSize: 13, marginBottom: 12 }}>
          {lbl('Activo durante apagones.', 'Active during outages.')}
        </div>
      )}

      {/* risk bar */}
      {outageHours != null && (
        <>
          <div style={{ height: 4, background: t.line, marginBottom: 10 }}>
            <div style={{
              height:     '100%',
              width:      `${Math.min(1, prob) * 100}%`,
              background: riskCol,
              transition: 'width 0.4s ease',
            }} />
          </div>

          {/* ETA or loss message */}
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize:   12,
            color:      riskCol,
            marginBottom: 12,
          }}>
            {eta != null
              ? lbl(
                  `Pérdida esperada en ~${fmtHours(eta, lang)}`,
                  `Expected loss in ~${fmtHours(eta, lang)}`
                )
              : risk === 'critical' || risk === 'high'
                ? lbl('Alta probabilidad de pérdida de agua', 'High probability of water loss')
                : lbl('Monitorear nivel del tanque', 'Monitor tank level')
            }
          </div>

          {/* context note from spec */}
          {hours >= base0 * 0.8 && (
            <div style={{
              background: `${riskCol}12`,
              border:     `0.5px solid ${riskCol}44`,
              padding:    '7px 10px',
              marginBottom: 12,
              fontSize:   11,
              color:      t.inkDim,
              fontFamily: 'var(--font-mono)',
            }}>
              {lbl(
                `En zonas similares, 70% pierde agua al superar ${fmtHours(base0, lang)} de apagón.`,
                `In similar zones, 70% lose water after ${fmtHours(base0, lang)} of outage.`
              )}
            </div>
          )}
        </>
      )}

      {/* tank level selector */}
      <div>
        <div style={{
          fontSize:   11,
          color:      t.inkFaint,
          marginBottom: 7,
          fontFamily: 'var(--font-mono)',
          letterSpacing: '0.10em',
          textTransform: 'uppercase',
        }}>
          {lbl('Nivel de tu tanque', 'Your tank level')}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {TANK_OPTIONS.map(({ level, es, en }) => {
            const active = tankLevel === level;
            return (
              <button
                key={level}
                onClick={() => setTank(level)}
                style={{
                  flex:       1,
                  padding:    '6px 0',
                  fontSize:   12,
                  fontFamily: 'var(--font-mono)',
                  background: active ? `${t.accent}22` : 'transparent',
                  color:      active ? t.accent : t.inkDim,
                  border:     `0.5px solid ${active ? t.accent : t.lineStrong}`,
                  cursor:     'pointer',
                }}
              >
                {lang === 'es' ? es : en}
              </button>
            );
          })}
        </div>
        {tankLevel && (
          <div style={{ fontSize: 11, color: t.inkFaint, marginTop: 6, fontFamily: 'var(--font-mono)' }}>
            {tankLevel === 'full' && lbl('Tanque lleno — ventana extendida', 'Full tank — extended window')}
            {tankLevel === 'half' && lbl('Tanque medio — ventana estándar', 'Half tank — standard window')}
            {tankLevel === 'low'  && lbl('Tanque bajo — ventana reducida', 'Low tank — reduced window')}
            {tankLevel === 'empty' && lbl('Sin agua — buscar alternativas', 'No water — seek alternatives')}
          </div>
        )}
      </div>

    </div>
  );
}
