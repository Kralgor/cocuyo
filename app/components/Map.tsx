// Lazy-loaded via next/dynamic (ssr: false) — never import directly.
// Prefetched via requestIdleCallback in pages/index.tsx after initial paint.

import { MapContainer, TileLayer, Marker, Circle, CircleMarker, Tooltip, useMap } from 'react-leaflet';
import { useEffect, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { RegionEntry, MunicipioEntry } from '../lib/api';
import type { Theme } from '../lib/theme';
import { statusColor } from '../lib/theme';
import { aggregateStates, isOutageStatus } from '../lib/municipios';
import { ALL_REGIONS } from './mobile/RegionPicker';

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

// state display name → region key (first region per state; mirrors pipeline)
const STATE_TO_REGION: Record<string, string> = {};
for (const r of ALL_REGIONS) {
  if (!(r.state in STATE_TO_REGION)) STATE_TO_REGION[r.state] = r.key;
}

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

// Zoom threshold: below it the map shows one aggregate circle per state;
// at or above it, the state breaks down into municipio markers.
const MUNICIPIO_ZOOM = 8;

// ── short status labels (ES — matches app copy) ──────────────────────────────
const STATUS_LABEL: Record<string, string> = {
  no_power:            'SIN LUZ',
  power_back:          'CON LUZ',
  unstable:            'INESTABLE',
  normal:              'NORMAL',
  no_data:             'SIN DATOS',
  confirmed_outage:    'APAGÓN',
  likely_outage:       'POSIBLE APAGÓN',
  at_risk:             'EN RIESGO',
  degraded:            'DEGRADADO',
  unverified_reports:  'REPORTES SIN VERIFICAR',
};

function statusLabel(status: string): string {
  return STATUS_LABEL[status] ?? status.replace(/_/g, ' ').toUpperCase();
}

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

// ── zoom watcher — switches between state circles and municipios ──────────────
function ZoomWatcher({ onZoomChange }: { onZoomChange: (zoom: number) => void }) {
  const map = useMap();
  useEffect(() => {
    const sync = () => onZoomChange(map.getZoom());
    sync();
    map.on('zoomend', sync);
    return () => { map.off('zoomend', sync); };
  }, [map, onZoomChange]);
  return null;
}

// ── Map props ─────────────────────────────────────────────────────────────────
interface MapProps {
  regions?:      Record<string, RegionEntry>;
  municipios?:   Record<string, MunicipioEntry[]>;
  theme:         Theme;
  onMarkerTap?:  (regionKey: string) => void;
  fillHeight?:   boolean;
}

export default function Map({
  regions = MOCK_REGIONS, municipios, theme: t, onMarkerTap, fillHeight = false,
}: MapProps) {
  const [zoom, setZoom] = useState(6);
  const showMunicipios = zoom >= MUNICIPIO_ZOOM;
  const states = municipios ? aggregateStates(municipios) : [];

  const selectState = (state: string) => {
    const regionKey = STATE_TO_REGION[state];
    if (regionKey && onMarkerTap) onMarkerTap(regionKey);
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: fillHeight ? '100%' : '440px' }}>
      <MapContainer
        center={[8.5, -66.0]}
        zoom={6}
        minZoom={5}
        maxZoom={12}
        style={{ height: '100%', width: '100%', background: t.bg }}
        scrollWheelZoom={true}
        zoomControl={true}
      >
        <TileLayerUpdater url={t.tileUrl} attribution={t.tileAttr} />
        <ZoomWatcher onZoomChange={setZoom} />

      {!showMunicipios && states.map((s) => {
        const color = statusColor(s.status, t);
        const selectable = Boolean(STATE_TO_REGION[s.state]);
        return (
          <Circle
            key={s.state}
            center={s.centroid}
            radius={55000}
            pathOptions={{
              color,
              weight: 2,
              fillColor: color,
              fillOpacity: 0.30,
            }}
            eventHandlers={selectable && onMarkerTap ? { click: () => selectState(s.state) } : {}}
          >
            <Tooltip direction="top" offset={[0, -8]}>
              <span style={{ fontFamily: 'system-ui', fontSize: 12 }}>
                <strong>{s.state}</strong> · {statusLabel(s.status)}
                <br />
                <span style={{ opacity: 0.7 }}>{s.municipioCount} municipios</span>
                <br />
                <span style={{ opacity: 0.55 }}>Haz zoom para ver municipios</span>
              </span>
            </Tooltip>
          </Circle>
        );
      })}

      {showMunicipios && municipios && Object.entries(municipios).map(([state, entries]) =>
        entries.map((m) => {
          const color = statusColor(m.status, t);
          const outage = isOutageStatus(m.status);
          const selectable = Boolean(STATE_TO_REGION[state]);
          return (
            <CircleMarker
              key={`${state}-${m.name}`}
              center={[m.lat, m.lon]}
              radius={outage ? 7 : 5}
              pathOptions={{
                color: t.bg,
                weight: 1.5,
                fillColor: color,
                fillOpacity: outage ? 0.95 : 0.75,
              }}
              eventHandlers={selectable && onMarkerTap ? { click: () => selectState(state) } : {}}
            >
              <Tooltip direction="top" offset={[0, -6]}>
                <span style={{ fontFamily: 'system-ui', fontSize: 12 }}>
                  <strong>{m.name}</strong> ({state}) · {statusLabel(m.status)}
                  {(m.crowd_reports_30min ?? 0) > 0 && (
                    <> · {m.crowd_reports_30min} rep</>
                  )}
                </span>
              </Tooltip>
            </CircleMarker>
          );
        })
      )}

      {/* region-city markers — fallback only, when municipio data is absent.
          With municipios present the map is clean: circles at low zoom,
          municipio dots at high zoom — never both at once. */}
      {!municipios && Object.entries(regions).map(([key, data]) => {
        const coords = REGION_COORDS[key];
        if (!coords) return null;
        const color  = statusColor(data.status, t);
        const pulse  = ['unverified_reports', 'likely_outage', 'confirmed_outage'].includes(data.status);
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

      {/* view-mode indicator */}
      {municipios && (
        <div
          data-testid="map-mode"
          style={{
            position: 'absolute', top: 10, right: 10, zIndex: 1000,
            background: t.panel, border: `0.5px solid ${t.line}`,
            borderRadius: 6, padding: '4px 10px',
            fontFamily: 'var(--font-mono)', fontSize: 10,
            letterSpacing: '0.06em', color: t.inkDim,
            pointerEvents: 'none',
          }}
        >
          {showMunicipios ? 'MUNICIPIOS · zoom ' + zoom : 'ESTADOS · zoom ' + zoom}
        </div>
      )}
    </div>
  );
}
