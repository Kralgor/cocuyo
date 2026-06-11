import { useState, useEffect } from 'react';

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

const cache: Record<string, RegionHistory> = {};

// Base URL for history JSON files.
// Defaults to the R2 CDN prefix, refreshed weekly by the retrain CI job —
// the bundled /history/ snapshots in app/public/ go stale between deploys.
// NEXT_PUBLIC_HISTORY_BASE overrides; set it to "/history" to force the
// bundled static files (offline/dev).
const DEFAULT_HISTORY_BASE = 'https://cocuyo.kralgor.com/history';

function _historyUrl(regionKey: string): string {
  const base = process.env.NEXT_PUBLIC_HISTORY_BASE || DEFAULT_HISTORY_BASE;
  const trimmed = base.replace(/\/$/, '');
  return `${trimmed}/${regionKey}.json`;
}

export async function fetchRegionHistory(regionKey: string): Promise<RegionHistory | null> {
  if (cache[regionKey]) return cache[regionKey];
  try {
    const res = await fetch(_historyUrl(regionKey));
    if (!res.ok) return null;
    const data = await res.json() as RegionHistory;
    cache[regionKey] = data;
    return data;
  } catch {
    return null;
  }
}

export function useRegionHistory(regionKey: string | null): {
  history: RegionHistory | null;
  loading: boolean;
} {
  const [history, setHistory] = useState<RegionHistory | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!regionKey) { setHistory(null); return; }

    let cancelled = false;
    setLoading(true);

    fetchRegionHistory(regionKey).then(data => {
      if (cancelled) return;
      setHistory(data);
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [regionKey]);

  return { history, loading };
}
