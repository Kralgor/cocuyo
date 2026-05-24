import React from 'react';
import { Theme } from '../lib/theme';
import { Lang } from '../lib/i18n';
import { RegionEntry } from '../lib/api';
import { ServiceStatus } from './primitives/CrossServiceRow';

interface Props {
  theme:       Theme;
  lang:        Lang;
  regionEntry: RegionEntry | null;
  regionName:  string;
  waterRisk:   'low' | 'medium' | 'high' | 'critical' | null;
  outageHours: number | null;
}

interface ServiceRow {
  id:     string;
  labelEs: string;
  labelEn: string;
  status:  ServiceStatus;
  detailEs?: string;
  detailEn?: string;
}

function elecStatus(entry: RegionEntry | null): { status: ServiceStatus; detailEs?: string; detailEn?: string } {
  if (!entry) return { status: 'pending' };
  switch (entry.status) {
    case 'confirmed_outage':
    case 'likely_outage': {
      const since = entry.outage?.started_at
        ? new Date(entry.outage.started_at).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', hour12: false })
        : null;
      return {
        status:   'down',
        detailEs: since ? `Desde las ${since}` : 'Apagón activo',
        detailEn: since ? `Since ${since}` : 'Active outage',
      };
    }
    case 'at_risk':
      return { status: 'degraded', detailEs: 'En riesgo', detailEn: 'At risk' };
    case 'unverified_reports':
      return { status: 'pending', detailEs: 'Reportes sin confirmar', detailEn: 'Unconfirmed reports' };
    case 'no_data':
      return { status: 'pending' };
    default:
      return { status: 'ok' };
  }
}

function inetStatus(score: number | null): { status: ServiceStatus; detailEs?: string; detailEn?: string } {
  if (score == null) return { status: 'pending' };
  if (score >= 0.75) return { status: 'ok' };
  if (score >= 0.40) return {
    status:   'degraded',
    detailEs: `CANTV al ${Math.round(score * 100)}%`,
    detailEn: `CANTV at ${Math.round(score * 100)}%`,
  };
  return {
    status:   'down',
    detailEs: `CANTV al ${Math.round(score * 100)}%`,
    detailEn: `CANTV at ${Math.round(score * 100)}%`,
  };
}

function waterStatus(risk: Props['waterRisk'], outageHours: number | null): { status: ServiceStatus; detailEs?: string; detailEn?: string } {
  if (risk == null) return { status: 'pending' };
  switch (risk) {
    case 'critical':
      return { status: 'down',     detailEs: 'Tanque agotado',          detailEn: 'Tank depleted' };
    case 'high':
      return { status: 'down',     detailEs: 'Presión baja / agotando', detailEn: 'Low pressure / depleting' };
    case 'medium':
      return { status: 'degraded', detailEs: 'Tanque agotando',         detailEn: 'Tank depleting' };
    default:
      return { status: 'ok',       detailEs: 'Presión normal',          detailEn: 'Normal pressure' };
  }
}

function cellStatus(inetSt: ServiceStatus, outageHours: number | null): { status: ServiceStatus; detailEs?: string; detailEn?: string } {
  // Cell towers switch to battery backup during outages; deplete after ~4-8h.
  if (outageHours != null && outageHours >= 6) {
    return { status: 'down',     detailEs: 'Batería de torre agotada', detailEn: 'Tower battery depleted' };
  }
  if (outageHours != null && outageHours >= 2) {
    return { status: 'degraded', detailEs: 'Torres en batería de respaldo', detailEn: 'Towers on battery backup' };
  }
  if (inetSt === 'down')     return { status: 'degraded', detailEs: 'Degradado (red caída)', detailEn: 'Degraded (network down)' };
  if (inetSt === 'degraded') return { status: 'degraded' };
  if (inetSt === 'pending')  return { status: 'pending' };
  return { status: 'ok' };
}

const STATUS_LABEL: Record<ServiceStatus, { es: string; en: string }> = {
  ok:       { es: 'Normal',    en: 'Normal' },
  degraded: { es: 'Degradado', en: 'Degraded' },
  down:     { es: 'Caído',     en: 'Down' },
  pending:  { es: 'Sin datos', en: 'No data' },
};

export default function CrossServiceDashboard({ theme: t, lang, regionEntry, regionName, waterRisk, outageHours }: Props) {
  const lbl = (es: string, en: string) => lang === 'es' ? es : en;

  const elec = elecStatus(regionEntry);
  const inet = inetStatus(regionEntry?.signals?.internet ?? null);
  const water = waterStatus(waterRisk, outageHours);
  const cell  = cellStatus(inet.status, outageHours);

  const rows: ServiceRow[] = [
    {
      id:      'power',
      labelEs: 'Luz',
      labelEn: 'Power',
      status:  elec.status,
      detailEs: elec.detailEs,
      detailEn: elec.detailEn,
    },
    {
      id:      'water',
      labelEs: 'Agua',
      labelEn: 'Water',
      status:  water.status,
      detailEs: water.detailEs,
      detailEn: water.detailEn,
    },
    {
      id:      'internet',
      labelEs: 'Internet',
      labelEn: 'Internet',
      status:  inet.status,
      detailEs: inet.detailEs,
      detailEn: inet.detailEn,
    },
    {
      id:      'cell',
      labelEs: 'Celular',
      labelEn: 'Cell',
      status:  cell.status,
      detailEs: cell.detailEs,
      detailEn: cell.detailEn,
    },
  ];

  function dotColor(s: ServiceStatus): string {
    if (s === 'down')     return t.danger;
    if (s === 'degraded') return t.warn;
    if (s === 'pending')  return t.inkFaint;
    return t.ok;
  }

  const outageActive = elec.status === 'down';
  const anyDown = rows.some(r => r.status === 'down');

  // correlated restoration insight
  const etaText = regionEntry?.outage?.estimated_restoration
    ? new Date(regionEntry.outage.estimated_restoration).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', hour12: false })
    : null;

  return (
    <div style={{ background: t.panel, border: `0.5px solid ${t.line}`, padding: '14px 16px' }}>

      {/* header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 10,
          letterSpacing: '0.14em', color: t.inkFaint, textTransform: 'uppercase',
        }}>
          {lbl('Servicios', 'Services')}
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: t.inkDim }}>
          {regionName}
        </span>
      </div>

      {/* service rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {rows.map((row, i) => {
          const col = dotColor(row.status);
          const detail = lang === 'es' ? row.detailEs : row.detailEn;
          return (
            <div
              key={row.id}
              style={{
                display:        'flex',
                alignItems:     'center',
                gap:            10,
                padding:        '9px 0',
                borderBottom:   i < rows.length - 1 ? `0.5px solid ${t.line}` : 'none',
              }}
            >
              {/* status dot */}
              <div style={{
                width: 7, height: 7, borderRadius: '50%',
                background: col, flexShrink: 0,
              }} />

              {/* service name */}
              <span style={{ fontSize: 13, color: t.ink, width: 68, flexShrink: 0 }}>
                {lang === 'es' ? row.labelEs : row.labelEn}
              </span>

              {/* status badge */}
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 10,
                color: col, letterSpacing: '0.06em', textTransform: 'uppercase',
                flexShrink: 0,
              }}>
                {STATUS_LABEL[row.status][lang]}
              </span>

              {/* detail */}
              {detail && (
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 10,
                  color: t.inkFaint, marginLeft: 'auto', textAlign: 'right',
                }}>
                  {detail}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* correlated insight — only when outage active */}
      {outageActive && (
        <div style={{
          marginTop: 12,
          paddingTop: 10,
          borderTop: `0.5px solid ${t.line}`,
          display: 'flex', flexDirection: 'column', gap: 4,
        }}>
          {etaText && (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: t.inkDim }}>
              {lbl(`Restauración estimada: ~${etaText}`, `Estimated restoration: ~${etaText}`)}
            </div>
          )}
          {(waterRisk === 'high' || waterRisk === 'critical') && outageHours != null && etaText && (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: t.inkFaint }}>
              {lbl(
                'Agua: tanque puede agotarse antes de que vuelva la luz.',
                'Water: tank may run out before power returns.'
              )}
            </div>
          )}
          {outageHours != null && outageHours >= 2 && (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: t.inkFaint }}>
              {lbl(
                'Celular: torres en batería de respaldo (~6-8h capacidad).',
                'Cell: towers on battery backup (~6-8h capacity).'
              )}
            </div>
          )}
        </div>
      )}

      {/* all ok state */}
      {!anyDown && !outageActive && (
        <div style={{
          marginTop: 8, fontFamily: 'var(--font-mono)', fontSize: 11, color: t.ok,
        }}>
          {lbl('Todos los servicios normales', 'All services normal')}
        </div>
      )}

    </div>
  );
}
