import { useState, useEffect, useCallback, useRef } from 'react';

// ── types ─────────────────────────────────────────────────────────────────────
export interface RegionSignals {
  internet:    number | null;
  satellite:   number | null;
  crowdsource: number | null;
  weather:     number | null;
}

export interface RationingPattern {
  description:            string;
  frequency:              string;
  typical_start_hour:     number;
  typical_duration_hours: string;
}

export interface OutageEstimatedRemaining {
  optimistic:  string;
  likely:      string;
  pessimistic: string;
}

export interface OutageInfo {
  type:                  string;
  started_at:            string;
  elapsed_minutes:       number;
  estimated_remaining:   OutageEstimatedRemaining;
  estimated_restoration: string;
  confidence:            'high' | 'medium' | 'low';
  based_on:              string;
  message:               string;
  progress_pct:          number;
}

export interface CrowdInfo {
  no_power_reports_30min:   number;
  power_back_reports_30min: number;
  power_back_areas:         string[];
}

export interface RegionEntry {
  display_name:         string;
  current_score:        number | null;
  prediction_score:     number | null;
  status:               string;
  signals:              RegionSignals;
  crowd_reports_30min:  number;
  prediction_text:      string | null;
  rationing_pattern:    RationingPattern | null;
  outage?:              OutageInfo;
  crowd?:               CrowdInfo;
  bajones_15min?:       number | null;
  wave_detected?:       boolean | null;
  wave_severity?:       'mild' | 'moderate' | 'severe' | null;
}

export interface StatusJson {
  updated_at:          string;
  phase:               number;
  scheduler:           string;
  next_update_approx:  string;
  collector_errors:    number;
  regions:             Record<string, RegionEntry>;
}

// ── constants ─────────────────────────────────────────────────────────────────
const STATUS_URL      = process.env.NEXT_PUBLIC_STATUS_URL      ?? '/status.json';
const SUPABASE_URL    = process.env.NEXT_PUBLIC_SUPABASE_URL    ?? '';
const SUPABASE_KEY    = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
const DEFAULT_REFRESH_MS = 10 * 60 * 1000;
const MIN_REFRESH_MS     =      60 * 1000;

const HEADERS = {
  'Content-Type':  'application/json',
  'apikey':        SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Prefer':        'return=minimal',
};

// ── fetchStatus ───────────────────────────────────────────────────────────────
export async function fetchStatus(): Promise<{ data: StatusJson | null; offline: boolean }> {
  try {
    const res = await fetch(STATUS_URL, { cache: 'no-store' });
    if (!res.ok) return { data: null, offline: false };
    const data = await res.json() as StatusJson;
    return { data, offline: false };
  } catch {
    return { data: null, offline: true };
  }
}

// ── submitReport ──────────────────────────────────────────────────────────────
export async function submitReport(payload: {
  region:        string;
  status:        string;
  lat:           number | null;
  lon:           number | null;
  city_freetext: string | null;
}): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/outage_reports`, {
    method:  'POST',
    headers: HEADERS,
    body:    JSON.stringify({
      ...payload,
      onset_type:         null,   // Phase 2+
      symptom:            null,   // Phase 2+
      device_fingerprint: null,   // ADR-005 deferred to Phase 4
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

// ── getRecentCount ────────────────────────────────────────────────────────────
export async function getRecentCount(region: string): Promise<number | null> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_recent_count`, {
    method:  'POST',
    headers: { ...HEADERS, Prefer: '' },
    body:    JSON.stringify({ p_region: region, p_minutes: 30 }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return typeof data === 'number' ? data : null;
}

// ── useAutoRefresh ────────────────────────────────────────────────────────────
export function useAutoRefresh(): {
  status:  StatusJson | null;
  offline: boolean;
  refresh: () => void;
} {
  const [status, setStatus]   = useState<StatusJson | null>(null);
  const [offline, setOffline] = useState(false);
  const timerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshRef = useRef<() => void>(() => {});

  useEffect(() => {
    let cancelled = false;

    async function doFetch() {
      const { data, offline: isOffline } = await fetchStatus();
      if (cancelled) return;
      setOffline(isOffline);
      if (data) setStatus(data);

      let delayMs = DEFAULT_REFRESH_MS;
      if (data?.next_update_approx) {
        const diff = new Date(data.next_update_approx).getTime() - Date.now();
        delayMs = Math.max(MIN_REFRESH_MS, diff);
      }
      timerRef.current = setTimeout(doFetch, delayMs);
    }

    refreshRef.current = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      doFetch();
    };

    doFetch();
    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const refresh = useCallback(() => refreshRef.current(), []);

  return { status, offline, refresh };
}
