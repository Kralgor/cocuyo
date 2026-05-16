/**
 * StatusBar — top bar with national summary.
 * Shows: regions out count, worst status, last update time.
 */
import type { StatusJson, RegionEntry } from '../lib/api';

// ── constants ─────────────────────────────────────────────────────────────────

const STATUS_PRIORITY: Record<string, number> = {
  confirmed_outage:   6,
  likely_outage:      5,
  at_risk:            4,
  unverified_reports: 3,
  normal:             2,
  no_data:            1,
};

const STATUS_LABELS: Record<string, string> = {
  confirmed_outage:   'Apagón confirmado',
  likely_outage:      'Posible apagón',
  at_risk:            'En riesgo',
  unverified_reports: 'Reportes sin verificar',
  normal:             'Normal',
  no_data:            'Sin datos',
};

const STATUS_COLORS: Record<string, string> = {
  confirmed_outage:   '#e53935',
  likely_outage:      '#fb8c00',
  at_risk:            '#fdd835',
  unverified_reports: '#1976d2',
  normal:             '#43a047',
  no_data:            '#9e9e9e',
};

const OUTAGE_STATUSES = new Set(['likely_outage', 'confirmed_outage']);

// ── helpers ───────────────────────────────────────────────────────────────────

function worstStatus(regions: Record<string, RegionEntry>): string {
  let worst = 'no_data';
  for (const entry of Object.values(regions)) {
    const p = STATUS_PRIORITY[entry.status] ?? 0;
    if (p > (STATUS_PRIORITY[worst] ?? 0)) worst = entry.status;
  }
  return worst;
}

function countOutages(regions: Record<string, RegionEntry>): number {
  return Object.values(regions).filter(r => OUTAGE_STATUSES.has(r.status)).length;
}

function countByStatus(
  regions: Record<string, RegionEntry>,
  status: string,
): number {
  return Object.values(regions).filter(r => r.status === status).length;
}

// ── types ─────────────────────────────────────────────────────────────────────

interface StatusBarProps {
  status:  StatusJson | null;
  offline: boolean;
}

// ── component ─────────────────────────────────────────────────────────────────

export default function StatusBar({ status, offline }: StatusBarProps) {
  const regions      = status?.regions ?? {};
  const total        = Object.keys(regions).length;
  const outageCount  = countOutages(regions);
  const worst        = total > 0 ? worstStatus(regions) : 'no_data';
  const worstColor   = STATUS_COLORS[worst]  ?? '#9e9e9e';
  const worstLabel   = STATUS_LABELS[worst]  ?? worst;
  const confirmed    = countByStatus(regions, 'confirmed_outage');
  const likely       = countByStatus(regions, 'likely_outage');
  const updatedAt    = status?.updated_at
    ? new Date(status.updated_at).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div
      data-testid="status-bar"
      style={{
        background:   '#1a1a2e',
        color:        '#fff',
        padding:      '10px 16px',
        display:      'flex',
        alignItems:   'center',
        justifyContent: 'space-between',
        flexWrap:     'wrap',
        gap:          8,
        fontFamily:   'system-ui, sans-serif',
        fontSize:     14,
      }}
    >
      {/* ── left: brand ── */}
      <div style={{ fontWeight: 700, fontSize: 18, letterSpacing: 1 }}>
        🌟 Cocuyo
      </div>

      {/* ── center: national summary ── */}
      {total > 0 ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {/* worst-status pill */}
          <span
            data-testid="worst-status-pill"
            style={{
              background:   worstColor,
              color:        worst === 'at_risk' ? '#333' : '#fff',
              borderRadius: 12,
              padding:      '3px 10px',
              fontWeight:   700,
              fontSize:     12,
            }}
          >
            {worstLabel}
          </span>

          {/* region counts */}
          {outageCount > 0 ? (
            <span data-testid="outage-summary">
              <strong>{outageCount}</strong> de {total} regiones con apagón
              {confirmed > 0 && ` (${confirmed} confirmado${confirmed !== 1 ? 's' : ''})`}
              {likely > 0 && confirmed > 0 && ', '}
              {likely > 0 && `${likely} posible${likely !== 1 ? 's' : ''}`}
            </span>
          ) : (
            <span data-testid="outage-summary">
              Sin apagones detectados en las {total} regiones
            </span>
          )}
        </div>
      ) : (
        <span style={{ color: '#aaa', fontSize: 13 }}>Cargando datos…</span>
      )}

      {/* ── right: update time + offline badge ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
        {offline && (
          <span
            data-testid="offline-badge"
            style={{
              background:   '#c62828',
              color:        '#fff',
              borderRadius: 4,
              padding:      '2px 6px',
              fontWeight:   600,
            }}
          >
            Sin conexión
          </span>
        )}
        {updatedAt && (
          <span style={{ color: '#aaa' }} data-testid="updated-at">
            Actualizado: {updatedAt}
          </span>
        )}
        {status?.collector_errors !== undefined && status.collector_errors > 0 && (
          <span
            style={{ color: '#ffcc80', fontSize: 11 }}
            data-testid="collector-errors"
          >
            ⚠ {status.collector_errors} error{status.collector_errors !== 1 ? 'es' : ''}
          </span>
        )}
      </div>
    </div>
  );
}
