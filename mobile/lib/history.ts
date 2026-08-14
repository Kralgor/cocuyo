import Constants from 'expo-constants';
import { useQuery } from '@tanstack/react-query';

// ── types ──────────────────────────────────────────────────────────────────────
// Ported verbatim from app/lib/history.ts (web source of truth).
export interface OutageBlock {
  start_hour: number;
  duration_h: number;
  type: string;
  confidence?: 'confirmed' | 'detected';
}

export interface HistoryDay {
  date: string;
  outages: OutageBlock[];
}

export interface HistoryStats {
  total_hours: number;
  count: number;
  avg_duration_h: number;
  longest_h: number;
}

export interface DetectedPattern {
  detected: boolean;
  description: string;
  frequency: string;
  typical_days: number[];
  typical_start_hour: number;
  typical_duration_h: number;
  confidence: number;
}

export interface ForecastPoint {
  half_hour: number;
  hour: number;
  risk: number;
}

export interface RegionHistory {
  region: string;
  display_name: string;
  generated_at: string;
  days_included: number;
  days: HistoryDay[];
  stats_30d: HistoryStats;
  stats_90d: HistoryStats;
  pattern: DetectedPattern;
  forecast_48h: ForecastPoint[];
  // enrichment fields — present when backfill_history.py has run
  guri_m?: number;
  guri_trend?: 'rising' | 'falling' | 'stable' | 'unknown';
  guri_percentile?: number;
  supply_risk?: number;
  guri_updated?: string;
  guri_rainfall_mm?: number;
  avg_temp_c?: number;
  max_temp_c?: number;
  avg_humidity?: number;
  cf_confirmed_pct?: number;
}

// ── constants ──────────────────────────────────────────────────────────────────
// CDN base URL read from app.json extra — same pattern as STATUS_CDN_URL in api.ts.
// Falls back to the live production CDN (weekly retrain job output).
const HISTORY_BASE: string =
  (Constants.expoConfig?.extra?.historyCdnUrl as string | undefined) ??
  'https://cocuyo.kralgor.com/history';

// ── fetchRegionHistory ─────────────────────────────────────────────────────────
// Returns typed RegionHistory on success, null on non-OK or network error.
// No module-level cache — React Query owns caching (query.ts persister).
export async function fetchRegionHistory(regionKey: string): Promise<RegionHistory | null> {
  try {
    const res = await fetch(`${HISTORY_BASE}/${regionKey}.json`);
    if (!res.ok) return null;
    return await res.json() as RegionHistory;
  } catch {
    return null;
  }
}

// ── useHistory ─────────────────────────────────────────────────────────────────
// React Query wrapper. History updates weekly (retrain job), so staleTime is 6h
// (not the 9min status default) — RESEARCH.md Pitfall 6.
// data is normalized to null (never undefined) so callers can check `!history`.
export function useHistory(regionKey: string | null) {
  const query = useQuery({
    queryKey: ['history', regionKey],
    queryFn: () => (regionKey ? fetchRegionHistory(regionKey) : null),
    enabled: !!regionKey,
    staleTime: 1000 * 60 * 60 * 6,   // 6h — history updates weekly
    gcTime:    1000 * 60 * 60 * 24,  // 24h — persist offline
    networkMode: 'offlineFirst',
  });
  return { ...query, data: query.data ?? null };
}
