// Lazy-loaded via next/dynamic (ssr: false) — never import directly.
// Prefetched via requestIdleCallback in pages/index.tsx after initial paint.

import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { RegionEntry } from '../lib/api';
import type { Theme } from '../lib/theme';
import { statusColor } from '../lib/theme';

// ── Region coordinates (mirrors pipeline/regions.py) ─────────────────────────
const REGION_COORDS: Record<string, [number, number]> = {
  maracaibo:         [10.6427, -71.6125],
  san_cristobal:     [ 7.7669, -72.2311],
  merida:            [ 8.5897, -71.1440],
  valera:            [ 9.3197, -70.6068],
  barquisimeto:      [10.0647, -69.3571],
  punto_fijo:        [11.7069, -70.2153],
  valencia:          [10.1579, -68.0075],
  maracay:           [10.2469, -67.5958],
  caracas:           [10.4806, -66.9036],
  los_teques:        [10.3432, -67.0448],
  guarenas_guatire:  [10.4667, -66.5333],
  barinas:           [ 8.6226, -70.2075],
  maturin:           [ 9.7458, -63.1833],
  barcelona:         [10.1337, -64.6864],
  cumana:            [10.4631, -64.1731],
  porlamar:          [10.9578, -63.8497],
  ciudad_guayana:    [ 8.3667, -62.6500],
};

const MOCK_REGIONS: Record<string, RegionEntry> = Object.fromEntries(
  Object.keys(REGION_COORDS).map(key => [key, {
    display_name:        key.replace(/_/g, ' '),
    current_score:       null,
    prediction_score:    null,
    status:              'no_data',
    signals:             { internet: null, satellite: null, crowdsource: null, weather: null },
    crowd_reports_30min: 0,
    prediction_text:     null,
    rationing_pattern:   null,
  }])
);

// ── Firefly DivIcon ───────────────────────────────────────────────────────────
function fireflyIcon(color: string, pulse: boolean): L.DivIcon {
  const size = 18;
  const dot  = size - 6;
  const ring = `
    <div class="lf-pulse-ring" style="
      position:absolute;inset:0;border-radius:50%;
      border:2px solid ${color};opacity:0.65;
    "></div>
  `;
  const html = `
    <div style="position:relative;width:${size}px;height:${size}px;cursor:pointer;">
      ${pulse ? ring : ''}
      <div style="
        position:absolute;
        top:${(size - dot) / 2}px;left:${(size - dot) / 2}px;
        width:${dot}px;height:${dot}px;
        border-radius:50%;background:${color};opacity:0.9;
      "></div>
    </div>
  `;
  return L.divIcon({
    html,
    className: '',
    iconSize:   [size, size],
    iconAnchor: [size / 2, size / 2],
    tooltipAnchor: [size / 2, -size / 2],
  });
}

// ── TileLayer updater — swaps tile URL when theme changes ─────────────────────
function TileLayerUpdater({ url, attribution }: { url: string; attribution: string }) {
  return <TileLayer key={url} url={url} attribution={attribution} />;
}

// ── Map props ─────────────────────────────────────────────────────────────────
interface MapProps {
  regions?:      Record<string, RegionEntry>;
  theme:         Theme;
  onMarkerTap?:  (regionKey: string) => void;
}

export default function Map({ regions = MOCK_REGIONS, theme: t, onMarkerTap }: MapProps) {
  const hasOutage = (status: string) =>
    status === 'unverified_reports' ||
    status === 'likely_outage'      ||
    status === 'confirmed_outage';

  return (
    <MapContainer
      center={[8.5, -66.0]}
      zoom={6}
      style={{ height: '440px', width: '100%', background: t.bg }}
      scrollWheelZoom={false}
      zoomControl={true}
    >
      <TileLayerUpdater url={t.tileUrl} attribution={t.tileAttr} />

      {Object.entries(regions).map(([key, data]) => {
        const coords = REGION_COORDS[key];
        if (!coords) return null;

        const color  = statusColor(data.status, t);
        const pulse  = hasOutage(data.status);

        return (
          <Marker
            key={key}
            position={coords}
            icon={fireflyIcon(color, pulse)}
            eventHandlers={onMarkerTap ? { click: () => onMarkerTap(key) } : {}}
          >
            <Tooltip direction="top" offset={[0, -6]}>
              <span style={{ fontFamily: 'system-ui', fontSize: 12 }}>
                <strong>{data.display_name}</strong>
                {data.crowd_reports_30min > 0 && (
                  <> · {data.crowd_reports_30min} rep</>
                )}
              </span>
            </Tooltip>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
