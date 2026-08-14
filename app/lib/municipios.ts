import type { MunicipioEntry } from './api';

// ── municipio helpers ─────────────────────────────────────────────────────────
// The pipeline appends a "municipios" section to status.json: per state, a
// list of municipios with their own status entries (own VIIRS satellite
// sample + state region attribution).

// Statuses that read as "lights out" on the map (drives pulse + state circles).
const OUTAGE_STATUSES = new Set([
  'no_power',
  'confirmed_outage',
  'likely_outage',
  'unverified_reports',
]);

export function isOutageStatus(status: string): boolean {
  return OUTAGE_STATUSES.has(status);
}

// Worst-status ordering — higher wins when aggregating a state's circle.
const STATUS_RANK: Record<string, number> = {
  no_data: 0,
  normal: 1,
  power_back: 2,
  at_risk: 3,
  unstable: 4,
  degraded: 5,
  likely_outage: 6,
  unverified_reports: 7,
  confirmed_outage: 8,
  no_power: 9,
};

export function worstStatus(statuses: string[]): string {
  let worst = 'no_data';
  let worstRank = STATUS_RANK[worst] ?? 0;
  for (const s of statuses) {
    const r = STATUS_RANK[s] ?? 0;
    if (r > worstRank) {
      worstRank = r;
      worst = s;
    }
  }
  return worst;
}

export function stateCentroid(entries: MunicipioEntry[]): [number, number] {
  const n = Math.max(entries.length, 1);
  const lat = entries.reduce((a, e) => a + e.lat, 0) / n;
  const lon = entries.reduce((a, e) => a + e.lon, 0) / n;
  return [lat, lon];
}

export interface StateAggregate {
  state: string;
  centroid: [number, number];
  status: string;
  municipioCount: number;
}

export function aggregateStates(
  municipios: Record<string, MunicipioEntry[]>,
): StateAggregate[] {
  return Object.entries(municipios).map(([state, entries]) => ({
    state,
    centroid: stateCentroid(entries),
    status: worstStatus(entries.map(e => e.status)),
    municipioCount: entries.length,
  }));
}
