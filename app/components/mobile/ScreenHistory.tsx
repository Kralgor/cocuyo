import React from 'react';
import { Theme } from '../../lib/theme';
import { tt, Lang } from '../../lib/i18n';
import { RegionHistory, HistoryDay } from '../../lib/history';
import HistoryStrip from '../primitives/HistoryStrip';
import MiniStat from '../primitives/MiniStat';
import SectionLabel from '../primitives/SectionLabel';

interface Props {
  theme: Theme;
  lang:  Lang;
  history: RegionHistory | null;
  loading: boolean;
}

function toStripDays(days: HistoryDay[]): { date: Date; outages: { start: number; dur: number }[] }[] {
  const last30 = days.slice(-30);
  return last30.map(d => ({
    date: new Date(d.date + 'T12:00:00'),
    outages: d.outages.map(o => ({ start: o.start_hour, dur: o.duration_h })),
  }));
}

export default function ScreenHistory({ theme: t, lang, history, loading }: Props) {
  if (loading || !history) {
    return (
      <div style={{ padding: '24px 22px', color: t.inkDim, fontFamily: 'var(--font-mono)', fontSize: 11 }}>
        {loading ? (lang === 'es' ? 'Cargando historial…' : 'Loading history…') : tt('no_data', lang)}
      </div>
    );
  }

  const stats = history.stats_30d;
  const stripDays = toStripDays(history.days);
  const pattern = history.pattern;

  return (
    <div style={{ padding: '18px 22px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* 30-day strip */}
      <div>
        <SectionLabel theme={t} label={tt('history_30d', lang)} />
        <div style={{
          marginTop: 8,
          padding: '14px 10px 6px',
          background: t.panel,
          border: `0.5px solid ${t.line}`,
          overflowX: 'auto',
        }}>
          <HistoryStrip theme={t} days={stripDays} width={340} height={96} />
        </div>
      </div>

      {/* Summary stats */}
      <div>
        <SectionLabel theme={t} label={lang === 'es' ? 'Resumen del mes' : 'Monthly summary'} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          <div style={{ padding: '12px 14px', background: t.panel, border: `0.5px solid ${t.line}` }}>
            <MiniStat
              theme={t}
              label={tt('total_hours', lang)}
              value={stats.total_hours}
              unit="h"
            />
          </div>
          <div style={{ padding: '12px 14px', background: t.panel, border: `0.5px solid ${t.line}` }}>
            <MiniStat
              theme={t}
              label={tt('outages', lang)}
              value={stats.count}
              unit={lang === 'es' ? 'cortes' : 'cuts'}
            />
          </div>
          <div style={{ padding: '12px 14px', background: t.panel, border: `0.5px solid ${t.line}` }}>
            <MiniStat
              theme={t}
              label={tt('longest', lang)}
              value={stats.longest_h}
              unit="h"
            />
          </div>
        </div>
      </div>

      {/* Detected pattern */}
      {pattern.detected && (
        <div>
          <SectionLabel theme={t} label={tt('pattern', lang)} />
          <div style={{
            padding: '12px 14px',
            background: t.panel,
            border: `0.5px solid ${t.line}`,
            borderLeft: `2px solid ${t.accent}`,
          }}>
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 9,
              color: t.accent, textTransform: 'uppercase',
              letterSpacing: '0.08em', marginBottom: 6,
            }}>
              {tt('pattern', lang)}
            </div>
            <div style={{ fontSize: 12, color: t.ink, lineHeight: 1.5 }}>
              {pattern.description}
            </div>
            <div style={{
              marginTop: 8, display: 'flex', gap: 14,
              fontFamily: 'var(--font-mono)', fontSize: 9,
              color: t.inkFaint,
            }}>
              <span>{lang === 'es' ? 'Confianza' : 'Confidence'}: {Math.round(pattern.confidence * 100)}%</span>
              <span>{lang === 'es' ? 'Duración típica' : 'Typical duration'}: {pattern.typical_duration_h}h</span>
            </div>
          </div>
        </div>
      )}

      {/* 90-day stats */}
      <div>
        <SectionLabel theme={t} label={lang === 'es' ? 'Últimos 90 días' : 'Last 90 days'} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div style={{ padding: '12px 14px', background: t.panel, border: `0.5px solid ${t.line}` }}>
            <MiniStat
              theme={t}
              label={tt('total_hours', lang)}
              value={history.stats_90d.total_hours}
              unit="h"
            />
          </div>
          <div style={{ padding: '12px 14px', background: t.panel, border: `0.5px solid ${t.line}` }}>
            <MiniStat
              theme={t}
              label={tt('avg_duration', lang)}
              value={history.stats_90d.avg_duration_h}
              unit="h"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
