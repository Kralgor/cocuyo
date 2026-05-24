import React from 'react';
import { Theme } from '../../lib/theme';
import { tt, Lang } from '../../lib/i18n';
import { RegionHistory } from '../../lib/history';
import ForecastCurve from '../primitives/ForecastCurve';
import MiniStat from '../primitives/MiniStat';
import SectionLabel from '../primitives/SectionLabel';

interface Props {
  theme: Theme;
  lang:  Lang;
  history: RegionHistory | null;
  loading: boolean;
}

export default function ScreenForecast({ theme: t, lang, history, loading }: Props) {
  if (loading || !history) {
    return (
      <div style={{ padding: '24px 22px', color: t.inkDim, fontFamily: 'var(--font-mono)', fontSize: 11 }}>
        {loading ? (lang === 'es' ? 'Cargando pronóstico…' : 'Loading forecast…') : tt('no_data', lang)}
      </div>
    );
  }

  const riskData = history.forecast_48h.map(p => p.risk);
  const pattern = history.pattern;
  const peakRisk = Math.max(...riskData);
  const peakHour = history.forecast_48h[riskData.indexOf(peakRisk)]?.hour ?? 0;
  const avgRisk = riskData.reduce((a, b) => a + b, 0) / riskData.length;

  const guriM    = history.guri_m;
  const guriTrend = history.guri_trend;
  const supplyRisk = history.supply_risk ?? 0;
  const cfPct    = history.cf_confirmed_pct;

  const trendArrow = guriTrend === 'rising' ? '↑' : guriTrend === 'falling' ? '↓' : '→';
  const guriColor  = supplyRisk > 0.5 ? t.danger : supplyRisk > 0.2 ? t.warn : t.accent;

  return (
    <div style={{ padding: '18px 22px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Forecast curve */}
      <div>
        <SectionLabel theme={t} label={tt('forecast24', lang)} />
        <div style={{
          marginTop: 8,
          padding: '14px 14px 20px',
          background: t.panel,
          border: `0.5px solid ${t.line}`,
        }}>
          <ForecastCurve
            theme={t}
            data={riskData}
            width={340}
            height={96}
            lang={lang}
          />
        </div>
      </div>

      {/* Peak risk callout */}
      {peakRisk > 0.3 && (
        <div style={{
          padding: '12px 14px',
          background: t.panel,
          border: `0.5px solid ${t.line}`,
          borderLeft: `2px solid ${peakRisk > 0.6 ? t.danger : t.warn}`,
        }}>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 9,
            textTransform: 'uppercase', letterSpacing: '0.08em',
            color: peakRisk > 0.6 ? t.danger : t.warn, marginBottom: 4,
          }}>
            {lang === 'es' ? 'Pico de riesgo' : 'Peak risk'}
          </div>
          <div style={{ fontSize: 13, color: t.ink, fontWeight: 500 }}>
            {Math.round(peakRisk * 100)}% — ~{Math.floor(peakHour)}:{String(Math.round((peakHour % 1) * 60)).padStart(2, '0')} VET
          </div>
        </div>
      )}

      {/* Driver stats */}
      <div>
        <SectionLabel theme={t} label={tt('why_forecast', lang)} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ padding: '12px 14px', background: t.panel, border: `0.5px solid ${t.line}` }}>
            <MiniStat
              theme={t}
              label={lang === 'es' ? 'Riesgo promedio' : 'Avg risk'}
              value={Math.round(avgRisk * 100)}
              unit="%"
            />
          </div>
          <div style={{ padding: '12px 14px', background: t.panel, border: `0.5px solid ${t.line}` }}>
            <MiniStat
              theme={t}
              label={lang === 'es' ? 'Cortes / 30 días' : 'Outages / 30 days'}
              value={history.stats_30d.count}
            />
          </div>
          <div style={{ padding: '12px 14px', background: t.panel, border: `0.5px solid ${t.line}` }}>
            <MiniStat
              theme={t}
              label={lang === 'es' ? 'Hora típica' : 'Typical hour'}
              value={pattern.detected ? `${Math.floor(pattern.typical_start_hour)}:00` : '—'}
              unit="VET"
            />
          </div>
          <div style={{ padding: '12px 14px', background: t.panel, border: `0.5px solid ${t.line}` }}>
            <MiniStat
              theme={t}
              label={lang === 'es' ? 'Confianza' : 'Confidence'}
              value={pattern.detected ? Math.round(pattern.confidence * 100) : 0}
              unit="%"
            />
          </div>
        </div>
      </div>

      {/* Guri dam supply context */}
      {guriM !== undefined && (
        <div>
          <SectionLabel theme={t} label={lang === 'es' ? 'Embalse Guri' : 'Guri Reservoir'} />
          <div style={{
            padding: '12px 14px',
            background: t.panel,
            border: `0.5px solid ${t.line}`,
            borderLeft: `2px solid ${guriColor}`,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div>
                <div style={{
                  fontFamily: 'var(--font-mono)', fontSize: 9,
                  color: guriColor, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2,
                }}>
                  {lang === 'es' ? 'Nivel actual' : 'Current level'}
                </div>
                <div style={{ fontSize: 18, color: t.ink, fontWeight: 500 }}>
                  {guriM.toFixed(1)}m{' '}
                  <span style={{ fontSize: 13, color: guriColor }}>{trendArrow}</span>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{
                  fontFamily: 'var(--font-mono)', fontSize: 9,
                  color: t.inkFaint, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2,
                }}>
                  {lang === 'es' ? 'Riesgo oferta' : 'Supply risk'}
                </div>
                <div style={{ fontSize: 18, color: guriColor, fontWeight: 500 }}>
                  {Math.round(supplyRisk * 100)}%
                </div>
              </div>
            </div>
            {/* Level bar */}
            <div style={{ height: 4, background: t.line, borderRadius: 2, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${Math.max(2, Math.min(100, ((guriM + 8) / 30) * 100))}%`,
                background: guriColor,
                borderRadius: 2,
              }} />
            </div>
            <div style={{
              marginTop: 6, display: 'flex', justifyContent: 'space-between',
              fontFamily: 'var(--font-mono)', fontSize: 8, color: t.inkFaint,
            }}>
              <span>{lang === 'es' ? 'Crítico' : 'Crisis'} −8m</span>
              <span style={{ color: t.inkDim }}>{lang === 'es' ? 'percentil' : 'pct'} {history.guri_percentile?.toFixed(0)}%</span>
              <span>{lang === 'es' ? 'Lleno' : 'Full'} ~22m</span>
            </div>
          </div>

          {/* Temp + validation row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
            {history.avg_temp_c !== undefined && (
              <div style={{ padding: '10px 12px', background: t.panel, border: `0.5px solid ${t.line}` }}>
                <MiniStat
                  theme={t}
                  label={lang === 'es' ? 'Temp media 30d' : 'Avg temp 30d'}
                  value={history.avg_temp_c.toFixed(1)}
                  unit="°C"
                />
              </div>
            )}
            {cfPct !== undefined && (
              <div style={{ padding: '10px 12px', background: t.panel, border: `0.5px solid ${t.line}` }}>
                <MiniStat
                  theme={t}
                  label={lang === 'es' ? 'Confirmados CF' : 'CF confirmed'}
                  value={cfPct.toFixed(0)}
                  unit="%"
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
