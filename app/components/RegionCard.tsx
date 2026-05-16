/**
 * RegionCard — detail panel for a single region.
 *
 * Shows: status header, outage type, elapsed time, progress bar,
 * ETA + confidence, nearby areas restoring, crowd report count.
 * Gracefully handles missing outage/crowd data (Phase 2 has neither).
 */
import type { RegionEntry } from '../lib/api';

// ── helpers ───────────────────────────────────────────────────────────────────

const OUTAGE_TYPE_LABELS: Record<string, string> = {
  rationing:         'Racionamiento programado',
  feeder_fault:      'Falla de alimentador',
  substation_fault:  'Falla de subestación',
  transmission_fault:'Falla de transmisión',
  national_blackout: 'Apagón nacional',
  weather_damage:    'Daño por tormenta',
  unknown:           'Causa desconocida',
};

const STATUS_LABELS: Record<string, string> = {
  no_data:            'Sin datos',
  unverified_reports: 'Reportes sin verificar',
  normal:             'Normal',
  at_risk:            'En riesgo',
  likely_outage:      'Posible apagón',
  confirmed_outage:   'Apagón confirmado',
};

const STATUS_COLORS: Record<string, string> = {
  no_data:            '#9e9e9e',
  unverified_reports: '#1976d2',
  normal:             '#43a047',
  at_risk:            '#fdd835',
  likely_outage:      '#fb8c00',
  confirmed_outage:   '#e53935',
};

const CONFIDENCE_LABELS: Record<string, string> = {
  high:   'ALTA',
  medium: 'MEDIA',
  low:    'BAJA',
};

function isOutageActive(status: string): boolean {
  return status === 'likely_outage' || status === 'confirmed_outage';
}

// ── types ─────────────────────────────────────────────────────────────────────

interface RegionCardProps {
  regionKey:   string;
  region:      RegionEntry;
  onReport?:   (status: 'no_power' | 'power_back') => void;
}

// ── sub-components ────────────────────────────────────────────────────────────

function ProgressBar({ pct }: { pct: number }) {
  const clamped = Math.min(100, Math.max(0, pct));
  return (
    <div style={{ background: '#e0e0e0', borderRadius: 4, height: 10, margin: '8px 0' }}>
      <div
        style={{
          width:        `${clamped}%`,
          height:       '100%',
          background:   '#fb8c00',
          borderRadius: 4,
          transition:   'width 0.3s ease',
        }}
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
      />
    </div>
  );
}

function SignalBadge({ label, value }: { label: string; value: number | null }) {
  if (value === null) return null;
  const pct = Math.round(value * 100);
  return (
    <span style={{ fontSize: 11, color: '#666', marginRight: 8 }}>
      {label}: {pct}%
    </span>
  );
}

// ── main component ────────────────────────────────────────────────────────────

export default function RegionCard({ regionKey, region, onReport }: RegionCardProps) {
  const statusColor = STATUS_COLORS[region.status] ?? '#9e9e9e';
  const statusLabel = STATUS_LABELS[region.status]  ?? region.status;
  const active      = isOutageActive(region.status);

  return (
    <div
      data-testid={`region-card-${regionKey}`}
      style={{
        border:       `2px solid ${statusColor}`,
        borderRadius: 8,
        padding:      16,
        marginBottom: 12,
        background:   '#fff',
        fontFamily:   'system-ui, sans-serif',
      }}
    >
      {/* ── header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: 16 }}>{region.display_name}</h3>
        <span
          style={{
            background:   statusColor,
            color:        '#fff',
            borderRadius: 4,
            padding:      '2px 8px',
            fontSize:     12,
            fontWeight:   700,
          }}
        >
          {statusLabel}
        </span>
      </div>

      {/* ── active outage panel ── */}
      {active && region.outage && (
        <div style={{ marginTop: 12 }}>
          {/* type + elapsed */}
          <div style={{ fontSize: 13, color: '#444', marginBottom: 4 }}>
            <strong>Tipo:</strong>{' '}
            {OUTAGE_TYPE_LABELS[region.outage.type] ?? region.outage.type}
          </div>
          <div style={{ fontSize: 13, color: '#444', marginBottom: 4 }}>
            <strong>Iniciado:</strong>{' '}
            {region.outage.elapsed_minutes} min atrás
          </div>

          {/* progress bar */}
          <ProgressBar pct={region.outage.progress_pct} />
          <div style={{ fontSize: 11, color: '#888', textAlign: 'right' }}>
            {region.outage.progress_pct}% del tiempo típico
          </div>

          {/* ETA */}
          <div style={{ marginTop: 8, fontSize: 13 }}>
            <strong>Estimado regreso:</strong>{' '}
            {region.outage.estimated_restoration}
            {' '}({region.outage.estimated_remaining.likely})
          </div>
          <div style={{ fontSize: 12, color: '#666' }}>
            Rango: {region.outage.estimated_remaining.optimistic}
            {' '}–{' '}
            {region.outage.estimated_remaining.pessimistic}
          </div>

          {/* confidence */}
          <div style={{ marginTop: 4, fontSize: 12, color: '#555' }}>
            Confianza: <strong>{CONFIDENCE_LABELS[region.outage.confidence] ?? region.outage.confidence}</strong>
            {region.outage.based_on ? ` (${region.outage.based_on})` : ''}
          </div>

          {/* message */}
          {region.outage.message && (
            <div style={{ marginTop: 6, fontSize: 12, color: '#555', fontStyle: 'italic' }}>
              {region.outage.message}
            </div>
          )}

          {/* nearby areas restoring */}
          {region.crowd && region.crowd.power_back_areas.length > 0 && (
            <div style={{ marginTop: 8, fontSize: 12, color: '#43a047' }}>
              <strong>Sectores recuperados:</strong>{' '}
              {region.crowd.power_back_areas.join(', ')}
            </div>
          )}
        </div>
      )}

      {/* ── no outage detail: show basic signals ── */}
      {(!active || !region.outage) && (
        <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
          <div>Reportes (30 min): {region.crowd_reports_30min}</div>
          {region.current_score !== null && (
            <div>Índice de riesgo: {Math.round(region.current_score * 100)}%</div>
          )}
          <div style={{ marginTop: 4 }}>
            <SignalBadge label="Internet"  value={region.signals.internet}    />
            <SignalBadge label="Satélite"  value={region.signals.satellite}   />
            <SignalBadge label="Multitud"  value={region.signals.crowdsource} />
            <SignalBadge label="Clima"     value={region.signals.weather}     />
          </div>
        </div>
      )}

      {/* ── report buttons (active outage only) ── */}
      {active && onReport && (
        <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
          <button
            onClick={() => onReport('power_back')}
            style={{
              flex:          1,
              padding:       '8px 0',
              background:    '#43a047',
              color:         '#fff',
              border:        'none',
              borderRadius:  4,
              cursor:        'pointer',
              fontWeight:    700,
              fontSize:      13,
            }}
          >
            ✓ Tengo luz
          </button>
          <button
            onClick={() => onReport('no_power')}
            style={{
              flex:          1,
              padding:       '8px 0',
              background:    '#e53935',
              color:         '#fff',
              border:        'none',
              borderRadius:  4,
              cursor:        'pointer',
              fontWeight:    700,
              fontSize:      13,
            }}
          >
            ✗ Sin luz aún
          </button>
        </div>
      )}

      {/* ── rationing pattern hint ── */}
      {region.rationing_pattern && !active && (
        <div style={{ marginTop: 8, fontSize: 11, color: '#888', borderTop: '1px solid #eee', paddingTop: 6 }}>
          Patrón: {region.rationing_pattern.description}
        </div>
      )}
    </div>
  );
}
