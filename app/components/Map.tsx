'use client';

// Stub — full Leaflet implementation in T-007.
// Importing Leaflet CSS here ensures it lands in this lazy-loaded chunk,
// not the initial bundle.
import 'leaflet/dist/leaflet.css';

export default function Map() {
  return (
    <div
      id="map"
      style={{ height: '400px', background: '#e8edf0', borderRadius: '8px' }}
      aria-label="Mapa de Venezuela"
    />
  );
}
