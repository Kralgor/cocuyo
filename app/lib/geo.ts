// ── Venezuela bounding box (mirrors pipeline/regions.py VE_LAT_MIN/MAX etc.) ──
// Used to reject submissions with coordinates outside the country — the
// same bbox enforced by the outage_reports CHECK constraint and the
// pipeline's geo validator.

export const VE_BBOX = {
  latMin: 0.5,
  latMax: 12.5,
  lonMin: -73.5,
  lonMax: -59.5,
};

export function isInVenezuela(lat: number, lon: number): boolean {
  return (
    lat >= VE_BBOX.latMin && lat <= VE_BBOX.latMax &&
    lon >= VE_BBOX.lonMin && lon <= VE_BBOX.lonMax
  );
}
