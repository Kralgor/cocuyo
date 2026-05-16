// Lazy-loaded via next/dynamic (ssr: false) in pages/index.tsx.
// Never imported directly — always via the dynamic() wrapper.

import { MapContainer, TileLayer, CircleMarker, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

// ── colour mapping ────────────────────────────────────────────────────────────
// Phase 1: only no_data (grey) and unverified_reports (blue) ever appear.
// Phase 2+ statuses defined here so T-007 needn't be rewritten when phase changes.
const STATUS_COLORS: Record<string, string> = {
  no_data:            '#9e9e9e',  // grey  — Phase 1
  unverified_reports: '#1976d2',  // blue  — Phase 1
  normal:             '#43a047',  // green — Phase 2+
  at_risk:            '#fdd835',  // yellow
  likely_outage:      '#fb8c00',  // orange
  confirmed_outage:   '#e53935',  // red
};

const STATUS_LABELS: Record<string, string> = {
  no_data:            'Sin datos',
  unverified_reports: 'Reportes sin verificar',
  normal:             'Normal',
  at_risk:            'En riesgo',
  likely_outage:      'Posible apagón',
  confirmed_outage:   'Apagón confirmado',
};

function regionColor(status: string): string {
  return STATUS_COLORS[status] ?? '#9e9e9e';
}

// ── types ─────────────────────────────────────────────────────────────────────
export interface RegionEntry {
  display_name: string;
  status: string;
  crowd_reports_30min: number;
  signals: { crowdsource: number | null };
}

// ── region coordinates (mirrors pipeline/regions.py) ──────────────────────────
const REGION_COORDS: Record<string, [number, number]> = {
  maracaibo:        [10.6427, -71.6125],
  san_cristobal:    [ 7.7669, -72.2311],
  merida:           [ 8.5897, -71.1440],
  valera:           [ 9.3197, -70.6068],
  barquisimeto:     [10.0647, -69.3571],
  punto_fijo:       [11.7069, -70.2153],
  valencia:         [10.1579, -68.0075],
  maracay:          [10.2469, -67.5958],
  caracas:          [10.4806, -66.9036],
  los_teques:       [10.3432, -67.0448],
  guarenas_guatire: [10.4667, -66.5333],
  barinas:          [ 8.6226, -70.2075],
  maturin:          [ 9.7458, -63.1833],
  barcelona:        [10.1337, -64.6864],
  cumana:           [10.4631, -64.1731],
  porlamar:         [10.9578, -63.8497],
  ciudad_guayana:   [ 8.3667, -62.6500],
};

// ── hardcoded mock (replaced by live data from api.ts in T-009) ───────────────
const MOCK_REGIONS: Record<string, RegionEntry> = Object.fromEntries(
  Object.keys(REGION_COORDS).map((key) => [
    key,
    {
      display_name: key.replace(/_/g, ' '),
      status: 'no_data',
      crowd_reports_30min: 0,
      signals: { crowdsource: null },
    },
  ])
);

// ── component ─────────────────────────────────────────────────────────────────
interface MapProps {
  regions?: Record<string, RegionEntry>;
}

export default function Map({ regions = MOCK_REGIONS }: MapProps) {
  return (
    <MapContainer
      center={[8.5, -66.0]}
      zoom={6}
      style={{ height: '450px', width: '100%', borderRadius: '8px' }}
      scrollWheelZoom={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {Object.entries(regions).map(([key, data]) => {
        const coords = REGION_COORDS[key];
        if (!coords) return null;
        const color = regionColor(data.status);
        return (
          <CircleMarker
            key={key}
            center={coords}
            radius={10}
            pathOptions={{ color, fillColor: color, fillOpacity: 0.7, weight: 2 }}
          >
            <Tooltip>
              <strong>{data.display_name}</strong>
              <br />
              {STATUS_LABELS[data.status] ?? data.status}
              {data.crowd_reports_30min > 0 && (
                <>
                  <br />
                  {data.crowd_reports_30min} reporte
                  {data.crowd_reports_30min !== 1 ? 's' : ''} (30&nbsp;min)
                </>
              )}
            </Tooltip>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
