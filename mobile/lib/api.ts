import Constants from 'expo-constants';

// ── types ──────────────────────────────────────────────────────────────────────
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

// ── constants ──────────────────────────────────────────────────────────────────
// CDN URL read from app.json extra — set by EAS at build time.
// Falls back to the live production CDN URL (cocuyo.kralgor.com).
// Source: RESEARCH.md Open Question 3 (RESOLVED) — use Constants.expoConfig?.extra?.statusCdnUrl
const STATUS_CDN_URL: string =
  (Constants.expoConfig?.extra?.statusCdnUrl as string | undefined) ??
  'https://cocuyo.kralgor.com/status.json';

// ── fetchStatus ────────────────────────────────────────────────────────────────
// Returns { data: StatusJson, offline: false } on success.
// Returns { data: null, offline: true } when fetch throws (no network).
// Returns { data: null, offline: false } when server responds non-OK.
// Never throws — callers check the offline flag.
export async function fetchStatus(): Promise<{ data: StatusJson | null; offline: boolean }> {
  try {
    const res = await fetch(STATUS_CDN_URL, {
      headers: { 'Cache-Control': 'no-cache' },
      // Note: React Native fetch does not support the `cache` option (web-only).
      // Use Cache-Control header instead (equivalent to web cache: 'no-store').
    });
    if (!res.ok) return { data: null, offline: false };
    const data = await res.json() as StatusJson;
    return { data, offline: false };
  } catch {
    return { data: null, offline: true };
  }
}

// ── report submission ───────────────────────────────────────────────────────
// Unlike fetchStatus(), submitReport may throw. The offline queue owns retries.
const SUPABASE_URL = (Constants.expoConfig?.extra?.supabaseUrl as string) ?? '';
const SUPABASE_KEY = (Constants.expoConfig?.extra?.supabaseAnonKey as string) ?? '';

const REPORT_HEADERS = {
  'Content-Type': 'application/json',
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  Prefer: 'return=minimal',
};

export interface ReportPayload {
  region: string;
  status: 'no_power' | 'power_back';
  lat: number | null;
  lon: number | null;
  city_freetext: null;
  onset_type: null;
  symptom: null;
  device_fingerprint: null;
  parroquia: string | null;
}

export interface QueuedReport {
  id: string;
  payload: ReportPayload;
  queued_at: string;
  attempts: number;
}

export interface PushTokenPayload {
  expo_token: string;
  zone: string;
  platform: 'android' | 'ios';
  notify_outage: boolean;
  notify_restoration: boolean;
  notify_neighbor: boolean;
}

export async function registerToken(
  payload: PushTokenPayload
): Promise<{ ok: boolean; offline: boolean }> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/push_tokens`, {
      method: 'POST',
      headers: {
        ...REPORT_HEADERS,
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(payload),
    });

    return { ok: res.ok, offline: false };
  } catch {
    return { ok: false, offline: true };
  }
}

export async function submitReport(payload: ReportPayload): Promise<void> {
  // parroquia is only included when actually chosen: the column may not
  // exist yet in Supabase, and PostgREST 400s on unknown columns.
  const body: Record<string, unknown> = { ...payload };
  if (!payload.parroquia) delete body.parroquia;

  const res = await fetch(`${SUPABASE_URL}/rest/v1/outage_reports`, {
    method: 'POST',
    headers: REPORT_HEADERS,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
}
