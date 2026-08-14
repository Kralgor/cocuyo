# Phase 3: Push Notifications - Pattern Map

**Mapped:** 2026-06-13
**Files analyzed:** 9 new/modified files
**Analogs found:** 9 / 9

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `pipeline/notify.py` | service | request-response + CRUD | `pipeline/outage_lifecycle.py` | exact |
| `pipeline/main.py` | orchestrator | batch | `pipeline/main.py` (self — call site pattern) | self-ref |
| `pipeline/regions.py` | config/registry | lookup | `pipeline/regions.py` (self — extend REGIONS block) | self-ref |
| `docs/schema.sql` | migration | CRUD | `docs/schema.sql` (self — table+RLS block pattern) | self-ref |
| `mobile/lib/api.ts` | service | request-response | `mobile/lib/api.ts` (self — fetchStatus + submitReport) | self-ref |
| `mobile/lib/storage.ts` | utility | key-value | `mobile/lib/storage.ts` (self — STORAGE_KEYS block) | self-ref |
| `mobile/lib/regions.ts` | config/registry | lookup | `mobile/lib/regions.ts` (self — REGIONS + export pattern) | self-ref |
| `mobile/app/(tabs)/notify.tsx` | component/screen | event-driven | `mobile/app/(tabs)/report.tsx` | exact |
| `pipeline/tests/test_notify.py` | test | offline-mock | `tests/test_outage_lifecycle.py` | exact |

---

## Pattern Assignments

### `pipeline/notify.py` (service, request-response + CRUD)

**Analog:** `pipeline/outage_lifecycle.py`

**Module docstring + imports pattern** (`pipeline/outage_lifecycle.py` lines 1-14):
```python
"""
Outage lifecycle manager.

Runs each pipeline cycle to bridge region scores → outage events:
  - normal→outage: INSERT active_outages (shared event_id if multi-region)
  - outage→normal: INSERT outage_history, DELETE active_outages

Requires service_role client (RLS bypassed).
"""
import logging
import uuid
from datetime import datetime, timezone

logger = logging.getLogger(__name__)
```

For `notify.py`, replace `uuid` with `requests` and adapt docstring:
```python
"""
Push notification fan-out — Phase 3.

Reads confirmed lifecycle events (new_outages, restorations) from
process_lifecycle() return value, resolves subscriber push tokens from
Supabase, fires Expo Push HTTP API via requests.

Non-fatal: any failure is logged and suppressed; pipeline continues.
Requires service_role client for push_tokens reads.
"""
import logging
from datetime import datetime, timezone

import requests

from pipeline.regions import REGIONS, ADJACENCY_MAP

logger = logging.getLogger(__name__)
```

**Private DB helper pattern** (`pipeline/outage_lifecycle.py` lines 22-29):
```python
def _fetch_active_outages(client) -> dict[str, dict]:
    """Return active outage rows keyed by region."""
    try:
        result = client.table("active_outages").select("*").execute()
        return {row["region"]: row for row in (result.data or [])}
    except Exception as exc:
        logger.error("fetch active_outages failed: %s", exc)
        return {}
```

Copy this pattern for `_fetch_tokens(zones, event_type, client)` — replace table name, add `.in_("zone", zones).eq(toggle_col, True)` filter chain, return `list[str]` of expo tokens. Same try/except → log error → return `[]` on failure.

**Cooldown DB helper** — same pattern as above, querying `notification_log`:
```python
def _is_suppressed(zone: str, event_type: str, cooldown_hours: int, client) -> bool:
    try:
        result = (
            client.table("notification_log")
            .select("id")
            .eq("zone", zone)
            .eq("event_type", event_type)
            .gte("sent_at", ...)   # now - cooldown_hours
            .limit(1)
            .execute()
        )
        return len(result.data or []) > 0
    except Exception as exc:
        logger.warning("cooldown check failed: %s", exc)
        return False  # fail open — send rather than miss
```

**Batch chunker + HTTP send pattern** (RESEARCH.md lines 233-246):
```python
def _chunk(lst: list, size: int):
    for i in range(0, len(lst), size):
        yield lst[i : i + size]


def _send_expo_batch(messages: list[dict]) -> list[dict]:
    """POST one batch (≤100) to Expo Push API. Returns ticket list."""
    try:
        resp = requests.post(
            "https://exp.host/--/api/v2/push/send",
            json=messages,
            headers={"content-type": "application/json"},
            timeout=10,
        )
        resp.raise_for_status()
        return resp.json().get("data", [])
    except Exception as exc:
        logger.warning("expo push batch failed: %s", exc)
        return []
```

**Main entry point signature** — mirrors `process_lifecycle()` signature (`pipeline/outage_lifecycle.py` lines 89-99):
```python
def send_notifications(
    lifecycle_result: dict,
    regions_scored: dict[str, dict],
    client,
    now: datetime,
) -> dict:
    """
    Fan-out push notifications for confirmed outage transitions.
    Called once per pipeline cycle after process_lifecycle().

    Returns {
        "sent": int, "skipped_cooldown": int, "skipped_unstable": int
    }.
    Never raises — all errors are logged and suppressed.
    """
```

**Logging pattern** — copy the exact style from `pipeline/outage_lifecycle.py` lines 48, 82, 123-125:
```python
logger.info("active_outage created: region=%s event=%s", region, event_id)
logger.info("outage closed: region=%s duration=%dmin", region, duration_min)
logger.info("new outages: %s (shared=%s)", new_outage_regions, use_shared)
```
For notify.py: `logger.info("push sent: zone=%s event=%s tokens=%d", zone, event_type, len(tokens))`

---

### `pipeline/main.py` (modify — capture lifecycle return + call notify)

**Existing call site to modify** (`pipeline/main.py` lines 332-338):
```python
    if phase >= 2 and supabase_client is not None:
        try:
            process_lifecycle(region_output, now, supabase_client)
        except Exception as exc:
            logger.error("lifecycle failed: %s", exc)
```

Replace with Phase 3 pattern (capture return value, add notify call):
```python
    lifecycle_result: dict = {"new_outages": [], "restorations": []}
    if phase >= 2 and supabase_client is not None:
        try:
            lifecycle_result = process_lifecycle(region_output, now, supabase_client)
        except Exception as exc:
            logger.error("lifecycle failed: %s", exc)

    if phase >= 3 and supabase_client is not None:
        try:
            from pipeline.notify import send_notifications
            send_notifications(lifecycle_result, region_output, supabase_client, now)
        except Exception as exc:
            logger.error("notify failed: %s", exc)
```

Note the lazy import inside the if-block — this matches the existing RIPE corroboration pattern at `pipeline/collector_internet_unified.py` line 204:
```python
        try:
            from pipeline.collector_ripe import fetch_ripe_connectivity  # noqa: PLC0415
```

**Phase gate pattern** — copy the existing `phase >= 2` guard (`pipeline/main.py` line 311):
```python
    if phase >= 2:
        inet_score, viirs_data, weather_data, passive_errors = _fetch_passive_signals(now)
```

Use `phase >= 3` for the notify call.

---

### `pipeline/regions.py` (modify — add ADJACENCY_MAP)

**Existing REGIONS dict structure** (`pipeline/regions.py` lines 9-25):
```python
from typing import TypedDict

class RegionMeta(TypedDict):
    display_name: str
    state:        str
    lat:          float
    lon:          float

REGIONS: dict[str, RegionMeta] = {
    "maracaibo": {
        "display_name": "Maracaibo (Zulia)",
        "state":        "Zulia",
        "lat":          10.6427,
        "lon":          -71.6125,
    },
    # ... 16 more entries
}
```

**Add after REGIONS dict** — mirror the same aligned-dict style and section-divider comment convention:
```python
# ── adjacency map ─────────────────────────────────────────────────────────────
# Locked symmetric neighbor map for NOTF-04 early-warning push notifications.
# Source: Phase 3 CONTEXT.md D-07. If A lists B, B must list A.
# Changes here MUST be mirrored in mobile/lib/regions.ts ADJACENCY_MAP.
ADJACENCY_MAP: dict[str, list[str]] = {
    "maracaibo":        ["punto_fijo", "valera"],
    "punto_fijo":       ["maracaibo", "barquisimeto"],
    "san_cristobal":    ["merida", "barinas"],
    "merida":           ["san_cristobal", "valera", "barinas"],
    "valera":           ["merida", "barinas", "barquisimeto", "maracaibo"],
    "barinas":          ["san_cristobal", "merida", "valera", "barquisimeto"],
    "barquisimeto":     ["punto_fijo", "valera", "barinas", "valencia"],
    "valencia":         ["barquisimeto", "maracay"],
    "maracay":          ["valencia", "los_teques", "caracas"],
    "caracas":          ["los_teques", "guarenas_guatire", "maracay"],
    "los_teques":       ["caracas", "maracay", "guarenas_guatire"],
    "guarenas_guatire": ["caracas", "los_teques", "barcelona"],
    "barcelona":        ["guarenas_guatire", "cumana", "maturin"],
    "cumana":           ["barcelona", "porlamar", "maturin"],
    "maturin":          ["barcelona", "cumana", "ciudad_guayana"],
    "porlamar":         ["cumana"],
    "ciudad_guayana":   ["maturin"],
}
```

---

### `docs/schema.sql` (modify — add push_tokens + notification_log tables)

**Existing table block pattern** (`docs/schema.sql` lines 75-91):
```sql
CREATE TABLE IF NOT EXISTS active_outages (
    id            BIGSERIAL PRIMARY KEY,
    event_id      UUID NOT NULL,
    region        TEXT NOT NULL,
    started_at    TIMESTAMPTZ NOT NULL,
    outage_type   TEXT,
    last_score    REAL,
    last_updated  TIMESTAMPTZ DEFAULT NOW(),
    predicted_dur INTEGER
);

-- One active outage per region at most
CREATE UNIQUE INDEX IF NOT EXISTS idx_active_region
    ON active_outages (region);
CREATE INDEX IF NOT EXISTS idx_active_event
    ON active_outages (event_id);
```

**Existing RLS block pattern** (`docs/schema.sql` lines 98-133):
```sql
ALTER TABLE outage_reports   ENABLE ROW LEVEL SECURITY;

-- anon: INSERT only (column restriction enforced via GRANT below)
DROP POLICY IF EXISTS "anon_can_insert" ON outage_reports;
CREATE POLICY "anon_can_insert" ON outage_reports
    FOR INSERT TO anon
    WITH CHECK (true);

-- No SELECT policy for anon → returns 0 rows (RLS default-deny).
-- service_role reads freely (bypasses RLS).

-- Remove blanket INSERT from anon (may not exist yet, ignore error)
REVOKE INSERT ON outage_reports FROM anon;

-- Grant only the columns the client is allowed to provide
GRANT INSERT (
    region,
    lat,
    lon,
    status,
    ...
) ON outage_reports TO anon;
```

**New push_tokens block** — follows same CREATE TABLE → INDEX → RLS → REVOKE → GRANT sequence:
```sql
-- ============================================================
-- push_tokens — device push registrations (Phase 3)
-- anon INSERT/UPSERT (write token + prefs, update zone)
-- service_role SELECT/UPDATE/DELETE (pipeline fan-out + cleanup)
-- ============================================================

CREATE TABLE IF NOT EXISTS push_tokens (
    id                   BIGSERIAL PRIMARY KEY,
    expo_token           TEXT NOT NULL UNIQUE,
    zone                 TEXT NOT NULL,
    platform             TEXT CHECK (platform IN ('android', 'ios')),
    notify_outage        BOOLEAN NOT NULL DEFAULT TRUE,
    notify_restoration   BOOLEAN NOT NULL DEFAULT TRUE,
    notify_neighbor      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at           TIMESTAMPTZ DEFAULT NOW(),
    updated_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_push_tokens_expo_token
    ON push_tokens (expo_token);
CREATE INDEX IF NOT EXISTS idx_push_tokens_zone
    ON push_tokens (zone);

ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_can_upsert_own_token" ON push_tokens;
CREATE POLICY "anon_can_upsert_own_token" ON push_tokens
    FOR INSERT TO anon
    WITH CHECK (true);

REVOKE INSERT ON push_tokens FROM anon;
GRANT INSERT (expo_token, zone, platform, notify_outage, notify_restoration, notify_neighbor)
    ON push_tokens TO anon;
GRANT UPDATE (zone, notify_outage, notify_restoration, notify_neighbor, updated_at)
    ON push_tokens TO anon;
GRANT SELECT ON push_tokens TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON push_tokens TO service_role;
```

**New notification_log block** — service_role-only, no anon access:
```sql
-- ============================================================
-- notification_log — cooldown tracking + receipt IDs (Phase 3)
-- service_role only — anon has no access (RLS default-deny)
-- ============================================================

CREATE TABLE IF NOT EXISTS notification_log (
    id         BIGSERIAL PRIMARY KEY,
    zone       TEXT NOT NULL,
    event_type TEXT NOT NULL CHECK (event_type IN ('outage', 'restoration', 'neighbor_outage')),
    sent_at    TIMESTAMPTZ DEFAULT NOW(),
    ticket_id  TEXT
);

CREATE INDEX IF NOT EXISTS idx_notif_log_zone_type
    ON notification_log (zone, event_type, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_notif_log_ticket
    ON notification_log (ticket_id) WHERE ticket_id IS NOT NULL;

ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;
-- No anon policies — service_role only (RLS default-deny for anon)
GRANT SELECT, INSERT, UPDATE ON notification_log TO service_role;
```

---

### `mobile/lib/api.ts` (modify — add registerToken function)

**Existing never-throw fetchStatus pattern** (`mobile/lib/api.ts` lines 76-91):
```typescript
// Returns { data: StatusJson, offline: false } on success.
// Returns { data: null, offline: true } when fetch throws (no network).
// Returns { data: null, offline: false } when server responds non-OK.
// Never throws — callers check the offline flag.
export async function fetchStatus(): Promise<{ data: StatusJson | null; offline: boolean }> {
  try {
    const res = await fetch(STATUS_CDN_URL, {
      headers: { 'Cache-Control': 'no-cache' },
    });
    if (!res.ok) return { data: null, offline: false };
    const data = await res.json() as StatusJson;
    return { data, offline: false };
  } catch {
    return { data: null, offline: true };
  }
}
```

**Existing submitReport (throws) pattern** (`mobile/lib/api.ts` lines 96-137):
```typescript
// Unlike fetchStatus(), submitReport may throw. The offline queue owns retries.
const SUPABASE_URL = (Constants.expoConfig?.extra?.supabaseUrl as string) ?? '';
const SUPABASE_KEY = (Constants.expoConfig?.extra?.supabaseAnonKey as string) ?? '';

const REPORT_HEADERS = {
  'Content-Type': 'application/json',
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  Prefer: 'return=minimal',
};

export async function submitReport(payload: ReportPayload): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/outage_reports`, {
    method: 'POST',
    headers: REPORT_HEADERS,
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
}
```

**New registerToken** — use never-throw `{ ok, offline }` shape (same as fetchStatus, not submitReport, because token reg is fire-and-forget with no retry queue):
```typescript
export interface PushTokenPayload {
  expo_token:          string;
  zone:                string;
  platform:            'android' | 'ios';
  notify_outage:       boolean;
  notify_restoration:  boolean;
  notify_neighbor:     boolean;
}

// Never throws — returns { ok: false, offline: true } on network error.
// Uses anon key for INSERT (ADR-007). No device_fingerprint (ADR-005).
export async function registerToken(
  payload: PushTokenPayload,
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
    if (!res.ok) return { ok: false, offline: false };
    return { ok: true, offline: false };
  } catch {
    return { ok: false, offline: true };
  }
}
```

Note: `Prefer: 'resolution=merge-duplicates'` enables upsert-on-conflict for the `expo_token` unique index. Reuses existing `SUPABASE_URL`, `SUPABASE_KEY`, and `REPORT_HEADERS` already in scope from submitReport.

---

### `mobile/lib/storage.ts` (modify — add notification keys to STORAGE_KEYS)

**Existing STORAGE_KEYS pattern** (`mobile/lib/storage.ts` lines 17-24):
```typescript
export const STORAGE_KEYS = {
  hasSeenOnboarding: 'hasSeenOnboarding',
  selectedZone:      'selectedZone',
  themeOverride:     'themeOverride',
  cacheTimestamp:    'statusCacheTimestamp',
  reportQueue:       'reportQueue',
  lastReportTime:    'lastReportTime',
} as const;
```

**Add three new keys** — append inside the same object, same aligned format:
```typescript
  pushPermissionGranted: 'pushPermissionGranted',   // boolean — OS permission granted
  notifyOutage:          'notifyOutage',             // boolean — NOTF-01 toggle
  notifyRestoration:     'notifyRestoration',        // boolean — NOTF-02 toggle
  notifyNeighbor:        'notifyNeighbor',           // boolean — NOTF-04 toggle
```

These mirror the `push_tokens` boolean columns so the UI reads locally (fast) and syncs to Supabase on change. No new MMKV instance needed — same `storage` exported from line 12.

---

### `mobile/lib/regions.ts` (modify — add ADJACENCY_MAP export)

**Existing export structure** (`mobile/lib/regions.ts` lines 9-13, 127-144):
```typescript
// Translated verbatim from pipeline/regions.py REGIONS dict.
// Keys are canonical region identifiers used in status.json — must match exactly.
// To add a region: add it to pipeline/regions.py first, then mirror here.
export const REGIONS: Record<string, RegionMeta> = {
  maracaibo: { ... },
  // ...
};

export const ZONE_SECTIONS: ZoneSection[] = [ ... ];

export function filterSections(query: string): ZoneSection[] { ... }
```

**Add ADJACENCY_MAP** — append after REGIONS, before ZONE_SECTIONS, same comment style:
```typescript
// ── adjacency map ─────────────────────────────────────────────────────────────
// Mirrored verbatim from pipeline/regions.py ADJACENCY_MAP.
// Pipeline is canonical. Changes here MUST match pipeline/regions.py exactly.
// Used in notify.tsx to display neighbor zone names in toggle description.
export const ADJACENCY_MAP: Record<string, string[]> = {
  maracaibo:        ['punto_fijo', 'valera'],
  punto_fijo:       ['maracaibo', 'barquisimeto'],
  san_cristobal:    ['merida', 'barinas'],
  merida:           ['san_cristobal', 'valera', 'barinas'],
  valera:           ['merida', 'barinas', 'barquisimeto', 'maracaibo'],
  barinas:          ['san_cristobal', 'merida', 'valera', 'barquisimeto'],
  barquisimeto:     ['punto_fijo', 'valera', 'barinas', 'valencia'],
  valencia:         ['barquisimeto', 'maracay'],
  maracay:          ['valencia', 'los_teques', 'caracas'],
  caracas:          ['los_teques', 'guarenas_guatire', 'maracay'],
  los_teques:       ['caracas', 'maracay', 'guarenas_guatire'],
  guarenas_guatire: ['caracas', 'los_teques', 'barcelona'],
  barcelona:        ['guarenas_guatire', 'cumana', 'maturin'],
  cumana:           ['barcelona', 'porlamar', 'maturin'],
  maturin:          ['barcelona', 'cumana', 'ciudad_guayana'],
  porlamar:         ['cumana'],
  ciudad_guayana:   ['maturin'],
};
```

---

### `mobile/app/(tabs)/notify.tsx` (rewrite — opt-in + toggles screen)

**Closest analog:** `mobile/app/(tabs)/report.tsx`

**Imports pattern** (`mobile/app/(tabs)/report.tsx` lines 1-19):
```typescript
import Ionicons from '@expo/vector-icons/Ionicons';
import { getLocales } from 'expo-localization';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';
import { tt, type Lang } from '@/lib/i18n';
import { REGIONS, ADJACENCY_MAP } from '@/lib/regions';
import { STORAGE_KEYS, storage } from '@/lib/storage';
import { registerToken } from '@/lib/api';
```

Also needs `expo-notifications` and `expo-device` (new deps):
```typescript
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
```

**Screen shell pattern** (`mobile/app/(tabs)/report.tsx` lines 27-35):
```typescript
function detectLang(): Lang {
  const primary = getLocales()[0]?.languageCode ?? 'es';
  return primary === 'en' ? 'en' : 'es';
}

export default function NotifyScreen() {
  const lang = detectLang();
  const { theme } = useTheme();
  const styles = createStyles(theme);
  // state hooks...

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* conditional: explainer OR toggle list */}
      </ScrollView>
    </View>
  );
}
```

**Pressable + disabled pattern** (`mobile/app/(tabs)/report.tsx` lines 150-165):
```typescript
<Pressable
  disabled={!canSubmit}
  onPress={() => setPendingStatus('no_power')}
  style={({ pressed }) => [
    styles.actionButton,
    styles.outButton,
    (!canSubmit || pressed) && styles.dimmed,
  ]}
>
  <Text style={styles.actionText}>{tt('report_out', lang)}</Text>
</Pressable>
```

**StyleSheet + theme pattern** (`mobile/app/(tabs)/report.tsx` end of file):
```typescript
const createStyles = (theme: MobileTheme) =>
  StyleSheet.create({
    root:    { flex: 1, backgroundColor: theme.bg },
    content: { padding: 16, gap: 20 },
    header:  { gap: 4 },
    // ...
  });
```

**Expo token registration flow** (RESEARCH.md lines 374-391):
```typescript
async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (!Device.isDevice) return null;  // simulators cannot receive push

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('outages', {
      name: 'Apagones',
      importance: Notifications.AndroidImportance.MAX,
    });
  }

  let finalStatus = (await Notifications.getPermissionsAsync()).status;
  if (finalStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return null;

  const projectId =
    Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
  if (!projectId) throw new Error('EAS projectId not found in app.json');

  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  return token;
}
```

EAS projectId is already in `mobile/app.json` `extra.eas.projectId` = `53f480cb-b4e4-420e-8be7-c36e78bc914c`.

**Critical SDK 56 note** (RESEARCH.md): `setNotificationChannelAsync` MUST be called before `getExpoPushTokenAsync` on Android. `shouldShowAlert` is deprecated — use `shouldShowBanner: true, shouldShowList: true` in `setNotificationHandler`.

---

### `pipeline/tests/test_notify.py` (NEW test file)

**Analog:** `tests/test_outage_lifecycle.py`

**Test file header + fixture pattern** (`tests/test_outage_lifecycle.py` lines 1-43):
```python
"""
Tests for pipeline/outage_lifecycle.py.
All Supabase calls are mocked — offline tests only.
"""
import pytest
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, call, patch

from pipeline.outage_lifecycle import (
    _close_outage,
    _create_active_outage,
    _fetch_active_outages,
    process_lifecycle,
)

NOW = datetime(2026, 6, 13, 14, 0, 0, tzinfo=timezone.utc)
STARTED = NOW - timedelta(hours=2)


def _region(status="likely_outage", score=0.7, crowd=5):
    return {"status": status, "current_score": score, "crowd_reports_30min": crowd}


def _active_row(region="maracaibo", event_id=None, started=None):
    return {
        "region":       region,
        "event_id":     event_id or "evt-001",
        "started_at":   (started or STARTED).isoformat(),
        "outage_type":  None,
        "last_score":   0.8,
        "predicted_dur": None,
    }


def _client(active_rows=None):
    c = MagicMock()
    c.table.return_value.select.return_value.execute.return_value = MagicMock(
        data=active_rows or []
    )
    c.table.return_value.insert.return_value.execute.return_value = MagicMock(data=[])
    c.table.return_value.delete.return_value.eq.return_value.execute.return_value = MagicMock(data=[])
    return c
```

For `test_notify.py`, replace with:
```python
"""
Tests for pipeline/notify.py.
All Supabase calls and HTTP calls are mocked — offline tests only.
"""
import pytest
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

from pipeline.notify import send_notifications, _is_suppressed, _fetch_tokens

NOW = datetime(2026, 6, 13, 14, 0, 0, tzinfo=timezone.utc)


def _lifecycle_result(new_outages=None, restorations=None):
    return {
        "new_outages":  new_outages or [],
        "restorations": restorations or [],
    }


def _region_scored(status="confirmed_outage", score=0.85):
    return {"status": status, "current_score": score}


def _mock_client(tokens=None, suppressed=False):
    """Mock supabase client — push_tokens returns token list, notification_log returns empty."""
    c = MagicMock()
    # push_tokens query chain: .table().select().in_().eq().execute()
    c.table.return_value.select.return_value.in_.return_value.eq.return_value.execute.return_value = MagicMock(
        data=[{"expo_token": t} for t in (tokens or [])]
    )
    # notification_log query chain
    c.table.return_value.select.return_value.eq.return_value.eq.return_value.gte.return_value.limit.return_value.execute.return_value = MagicMock(
        data=[] if not suppressed else [{"id": 1}]
    )
    c.table.return_value.insert.return_value.execute.return_value = MagicMock(data=[])
    return c
```

**Test class pattern** (`tests/test_outage_lifecycle.py` lines 48-61):
```python
class TestFetchActiveOutages:
    def test_empty_returns_empty_dict(self):
        result = _fetch_active_outages(_client([]))
        assert result == {}

    def test_db_error_returns_empty(self):
        c = MagicMock()
        c.table.side_effect = Exception("DB down")
        assert _fetch_active_outages(c) == {}
```

Mirror for `test_notify.py`:
```python
class TestSendNotifications:
    def test_no_tokens_no_http_call(self):
        """No push_tokens rows → no HTTP call, returns sent=0."""
        with patch("pipeline.notify._send_expo_batch") as mock_send:
            result = send_notifications(
                _lifecycle_result(new_outages=["maracaibo"]),
                {"maracaibo": _region_scored()},
                _mock_client(tokens=[]),
                NOW,
            )
        mock_send.assert_not_called()
        assert result["sent"] == 0

    def test_outage_fires_for_subscribed_token(self): ...
    def test_suppressed_by_cooldown_skips(self): ...
    def test_unstable_status_suppressed(self): ...
    def test_neighbor_outage_fans_to_neighbor_subscribers(self): ...
    def test_http_failure_non_fatal(self): ...
    def test_empty_lifecycle_events_no_send(self): ...


class TestCooldown:
    def test_cooldown_suppresses_repeat(self): ...
    def test_restoration_fires_after_outage_within_window(self): ...


class TestEdgeCases:
    def test_empty_lifecycle_events_no_send(self): ...
    def test_all_signals_none_no_crash(self): ...
```

---

## Shared Patterns

### Python: Isolated try/except — non-fatal failure
**Source:** `pipeline/outage_lifecycle.py` lines 38-50 + `pipeline/main.py` lines 332-337
**Apply to:** `pipeline/notify.py` (every helper) + main.py notify call site
```python
try:
    <operation>
    logger.info("<action>: region=%s", region)
except Exception as exc:
    logger.error("<context> failed: %s", exc)
    # return empty/default — never re-raise
```

### Python: Logger naming
**Source:** `pipeline/outage_lifecycle.py` line 14 / `pipeline/collector_internet_unified.py` line 33
**Apply to:** `pipeline/notify.py`
```python
logger = logging.getLogger(__name__)
```

### Python: Logging call format — no f-strings
**Source:** `pipeline/outage_lifecycle.py` lines 48, 82
**Apply to:** All log calls in `pipeline/notify.py`
```python
logger.info("push sent: zone=%s event=%s count=%d", zone, event_type, n)
logger.warning("expo batch failed: %s", exc)    # not: f"expo batch failed: {exc}"
```

### TypeScript: Never-throw API wrapper shape
**Source:** `mobile/lib/api.ts` lines 76-91 (fetchStatus)
**Apply to:** `registerToken` in `mobile/lib/api.ts`
```typescript
// Returns { ok: true, offline: false } on success.
// Returns { ok: false, offline: true } on network error.
// Returns { ok: false, offline: false } on HTTP error.
// Never throws.
export async function registerToken(...): Promise<{ ok: boolean; offline: boolean }> {
  try {
    const res = await fetch(...);
    if (!res.ok) return { ok: false, offline: false };
    return { ok: true, offline: false };
  } catch {
    return { ok: false, offline: true };
  }
}
```

### TypeScript: SUPABASE_URL / SUPABASE_KEY already in scope
**Source:** `mobile/lib/api.ts` lines 97-98
**Apply to:** `registerToken` — no redeclaration needed, it's in the same file
```typescript
const SUPABASE_URL = (Constants.expoConfig?.extra?.supabaseUrl as string) ?? '';
const SUPABASE_KEY = (Constants.expoConfig?.extra?.supabaseAnonKey as string) ?? '';
```

### TypeScript: Section divider comment style
**Source:** `mobile/lib/storage.ts` lines 3, 14
**Apply to:** New sections in all mobile files
```typescript
// ── section name ──────────────────────────────────────────────────────────────
```

### TypeScript: Screen skeleton (theme + lang + ScrollView)
**Source:** `mobile/app/(tabs)/report.tsx` lines 21-35 + bottom StyleSheet
**Apply to:** `mobile/app/(tabs)/notify.tsx`
```typescript
function detectLang(): Lang { ... }

export default function NotifyScreen() {
  const lang = detectLang();
  const { theme } = useTheme();
  const styles = createStyles(theme);
  // ...
  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content}>
        ...
      </ScrollView>
    </View>
  );
}

const createStyles = (theme: MobileTheme) =>
  StyleSheet.create({
    root:    { flex: 1, backgroundColor: theme.bg },
    content: { padding: 16, gap: 20 },
  });
```

### SQL: Table + RLS + GRANT block sequence
**Source:** `docs/schema.sql` lines 75-133
**Apply to:** Both new tables in `docs/schema.sql`
Sequence: `CREATE TABLE IF NOT EXISTS` → `CREATE INDEX IF NOT EXISTS` → `ALTER TABLE ENABLE ROW LEVEL SECURITY` → `DROP POLICY IF EXISTS` → `CREATE POLICY` → `REVOKE` → `GRANT`

### Test: MagicMock Supabase client builder
**Source:** `tests/test_outage_lifecycle.py` lines 36-43
**Apply to:** `pipeline/tests/test_notify.py` — build a `_mock_client()` fixture following the same `.table().select()...execute()` chaining pattern.

---

## No Analog Found

All files have identifiable analogs in the codebase. No entries.

---

## Metadata

**Analog search scope:** `pipeline/`, `tests/`, `mobile/lib/`, `mobile/app/(tabs)/`, `docs/`
**Files scanned:** 12 source files read directly
**Pattern extraction date:** 2026-06-13
