# Phase 3: Push Notifications — Research

**Researched:** 2026-06-13
**Domain:** Expo Push Service (server-side Python), expo-notifications (client-side), Supabase push_tokens RLS, pipeline fan-out integration
**Confidence:** HIGH (all core claims verified via official Expo docs or direct codebase inspection)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Single zone subscription (saved zone from MMKV Phase 1 D-03). No multi-zone list.
- **D-02:** Notify tab: per-type toggles for NOTF-01/02/04, all default ON after opt-in.
- **D-03:** Zone change → token row updated to new zone.
- **D-04:** Permission requested at point of use (notify tab), not onboarding.
- **D-05:** Token registration via SUPABASE_ANON_KEY only (ADR-007). No device_fingerprint (ADR-005). Anonymous row.
- **D-06:** Neighbor warnings from saved zone's adjacency list only.
- **D-07:** Locked adjacency map (17 zones, symmetric). Authoritative copy in CONTEXT.md.
- **D-08:** Adjacency map canonical in pipeline; mirrored in mobile. No cross-import.
- **D-09:** Two-part suppression: confirmed lifecycle events only + per-zone per-type cooldown window.
- **D-10:** Suppress notifications while zone is `unstable` (bajones).
- **D-11:** Spanish-first, factual copy. No invented ETAs.
- **INFR-01:** Pipeline sends via Expo Push Service (https://exp.host/--/api/v2/push/send), not raw FCM/APNs.
- **ADR-007:** anon key only in client; pipeline reads push_tokens with service_role.
- **ADR-005:** No device_fingerprint until Phase 4.

### Claude's Discretion
- Exact cooldown window length (N hours)
- Quiet-hours policy (in-scope or defer)
- push_tokens exact column shape and RLS policy details
- Stale-token cleanup mechanism
- Android channel / iOS category config
- Final Spanish copy wording per event type

### Deferred Ideas (OUT OF SCOPE)
- Multi-zone follow list (ADVN-02)
- Quiet-hours / do-not-disturb scheduling (candidate — decide in planning)
- Food spoilage notifications (NOTF-03) — Phase 4
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| NOTF-01 | User receives push notification when power goes out in subscribed zone | Expo Push API send format, pipeline fan-out from outage_lifecycle.py new_outages |
| NOTF-02 | User receives push notification when power is restored in subscribed zone | Expo Push API, pipeline fan-out from restoration_tracker.py restored status |
| NOTF-04 | User receives push notification when a neighboring zone experiences outage (early warning) | Adjacency map resolution, token query by neighbor zones |
| INFR-01 | Pipeline sends push notifications via Expo Push Service on zone status changes | Verified Python `requests` approach, batch format, receipt flow |
| INFR-02 | Supabase push_tokens table stores device tokens with zone subscriptions | Concrete SQL provided in this document |
| INFR-03 | Pipeline detects status transitions (previous vs current) and fires Expo Push API | Integration point: process_lifecycle() return dict consumed by notify fan-out |
</phase_requirements>

---

## Summary

Phase 3 has two distinct work streams: (1) a pipeline-side Python module (`pipeline/notify.py`) that reads confirmed lifecycle events, resolves subscriber tokens, and fires the Expo Push HTTP API using only the approved `requests` library; (2) a mobile-side TypeScript implementation replacing the `notify.tsx` placeholder with opt-in UX, permission flow, token registration, and per-type toggle storage.

The Expo Push Service is a simple JSON HTTP API with no Python SDK required. The pipeline reads confirmed outage open/close events from `process_lifecycle()` — which already returns `{"new_outages": [...], "restorations": [...]}` — and translates these into Expo push messages. A new `push_tokens` Supabase table (anon INSERT, service_role read) stores tokens with zone subscriptions and per-type toggle columns. Cooldown state persists in a `notification_log` table (one row per zone+type event_id) to survive the stateless 10-min cron.

The mobile side needs `expo-notifications` (v56.0.17) added to app.json plugins and package.json. `expo-device` (v56.0.4) is already installed. The existing `device_fingerprint: null` pattern from Phase 2 continues — push tokens are fully anonymous.

**Primary recommendation:** Implement `pipeline/notify.py` as a pure function `send_notifications(lifecycle_events, regions_scored, client, now)` called after `process_lifecycle()` in `main.py`. Cooldown state stored in a lightweight `notification_log` table in Supabase (no new infrastructure required).

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Outage transition detection | Pipeline (Python) | — | process_lifecycle() already owns this |
| Push fan-out (send API call) | Pipeline (Python) | — | Has service_role access to tokens; cron context |
| Token storage (write) | Supabase (anon INSERT) | — | ADR-007: client writes with anon key |
| Token storage (read) | Supabase (service_role) | — | ADR-007: only pipeline reads |
| Cooldown state | Supabase (notification_log) | — | Must survive stateless cron restarts |
| Receipt cleanup (stale tokens) | Pipeline (Python) | — | Periodic async check, same cron context |
| Permission request | Mobile (client) | — | Point-of-use (D-04) |
| Token registration | Mobile (client) | — | expo-notifications.getExpoPushTokenAsync |
| Adjacency map (canonical) | pipeline/regions.py | — | D-08: pipeline owns it |
| Adjacency map (mirror) | mobile/lib/regions.ts | — | D-08: mirror only, no cross-import |
| Per-type toggle prefs (store) | Mobile (MMKV) | push_tokens (sync) | Local-first; synced to push_tokens row |
| Notify tab UI | Mobile (client) | — | Opt-in explainer + toggles screen |

---

## Standard Stack

### Core (no new Python dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `requests` | 2.32.3 (already in requirements.txt) | POST to Expo Push API | Already approved; Expo API is plain JSON HTTP |
| `supabase-py` | 2.10.0 (already installed) | Read push_tokens with service_role | Already in pipeline |

[VERIFIED: official Expo docs] The Expo Push Service accepts plain `application/json` POST requests. No SDK required. The approved `requests` library is sufficient for all pipeline-side push functionality.

### Mobile (new client dependency)

| Package | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `expo-notifications` | ~56.0.17 | Token registration, permission request, notification handler | Official Expo SDK; required for getExpoPushTokenAsync |
| `expo-device` | ~56.0.4 | `Device.isDevice` check before requesting push token | Already installed per package.json |

[VERIFIED: npm registry — github.com/expo/expo monorepo] Both packages are part of the official Expo SDK monorepo, published 2020-03-30, current latest tags matching SDK 56.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `requests` (direct HTTP) | `expo-server-sdk-python` community package | Community SDK wraps same API; adds a dep not in approved list; direct HTTP is simpler and already approved |
| Supabase `notification_log` table for cooldown | Redis / in-memory dict | Redis adds infrastructure; in-memory doesn't survive cron restarts; Supabase already in use |
| MMKV for per-type toggles | Supabase push_tokens columns | MMKV is local-first; toggles stored as columns in push_tokens so pipeline can read them during fan-out |

**Installation (mobile only):**
```bash
npx expo install expo-notifications
```
`expo-device` is already installed at ~56.0.4.

---

## Package Legitimacy Audit

| Package | Registry | Age | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-------------|-----------|-------------|
| expo-notifications | npm | 6+ yrs (2020-03-30) | github.com/expo/expo (monorepo) | false positive — slopcheck checked PyPI, not npm; package confirmed on npm registry at 56.0.17 | Approved |
| expo-device | npm | 6+ yrs (already installed) | github.com/expo/expo (monorepo) | same false positive | Already installed — no action needed |

**Note on slopcheck output:** slopcheck reported these packages as "hallucinated or dangerous" because it queried PyPI instead of npm. Both packages are official Expo SDK packages published under the `expo` npm organization from the `github.com/expo/expo` monorepo. Confirmed via `npm view expo-notifications repository.url` → `git+https://github.com/expo/expo.git`.

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

No postinstall scripts in either package (scripts only contain `expo-module lint/test/build` — standard Expo module toolchain, no network calls).

---

## Architecture Patterns

### System Architecture Diagram

```
GitHub Actions Cron (every 10 min)
  │
  ▼
pipeline/main.py::run()
  │
  ├── score_region() × 17
  │
  ├── process_lifecycle(region_output, now, client)
  │     └── returns {"new_outages": [...], "restorations": [...]}
  │
  └── notify.send_notifications(lifecycle_events, regions_scored, client, now)  ← NEW
        │
        ├── skip if unstable (D-10)
        ├── check cooldown: SELECT notification_log WHERE zone+type+event_id
        │
        ├── for each new_outage:
        │     ├── query push_tokens WHERE zone=affected (subscribers)
        │     ├── query push_tokens WHERE zone IN neighbors(affected) (NOTF-04)
        │     └── POST https://exp.host/--/api/v2/push/send [batch ≤100]
        │
        ├── for each restoration:
        │     ├── query push_tokens WHERE zone=restored (subscribers)
        │     └── POST https://exp.host/--/api/v2/push/send [batch ≤100]
        │
        ├── INSERT notification_log rows (cooldown tracking)
        └── async receipt check (next cycle or separate function)

Mobile App (React Native / Expo SDK 56)
  │
  └── notify.tsx (NotifyScreen)
        ├── first-launch: explainer UI → OS permission dialog
        ├── granted: getExpoPushTokenAsync({ projectId }) → POST push_tokens
        ├── MMKV: store permission state + per-type toggles
        └── useEffect: sync zone change → PATCH/upsert push_tokens

Supabase (Postgres)
  ├── push_tokens (anon INSERT, service_role read/upsert)
  └── notification_log (service_role only)
```

### Recommended Project Structure (new files only)

```
pipeline/
├── notify.py                  # Fan-out module: send_notifications() pure function
├── tests/
│   └── test_notify.py         # Offline unit tests with mock Expo HTTP + mock Supabase

mobile/
├── lib/
│   └── notifications.ts       # registerForPushNotifications(), syncToken(), NotifPrefs type
├── hooks/
│   └── useNotifications.ts    # Hook: wraps notifications.ts, reads/writes MMKV + Supabase
└── app/(tabs)/
    └── notify.tsx             # Replaces placeholder: opt-in explainer + toggles UI
```

### Pattern 1: Pipeline Expo Push API Call (Python, `requests`)

**What:** POST batch of up to 100 messages to Expo Push endpoint.
**When to use:** After process_lifecycle() returns confirmed transitions.

```python
# Source: https://docs.expo.dev/push-notifications/sending-notifications/
import requests
import os

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"

def _send_expo_batch(messages: list[dict]) -> list[dict]:
    """
    POST up to 100 push messages to Expo. Returns ticket list.
    Raises on HTTP error. Caller catches and logs.
    """
    headers = {
        "accept": "application/json",
        "accept-encoding": "gzip, deflate",
        "content-type": "application/json",
    }
    expo_token = os.getenv("EXPO_ACCESS_TOKEN")
    if expo_token:
        headers["Authorization"] = f"Bearer {expo_token}"

    resp = requests.post(EXPO_PUSH_URL, json=messages, headers=headers, timeout=10)
    resp.raise_for_status()
    return resp.json().get("data", [])


def _chunk(lst: list, size: int = 100):
    for i in range(0, len(lst), size):
        yield lst[i : i + size]


def send_push_messages(messages: list[dict]) -> list[dict]:
    """Send all messages, chunking at 100. Returns all tickets."""
    tickets = []
    for batch in _chunk(messages, 100):
        try:
            tickets.extend(_send_expo_batch(batch))
        except Exception as exc:
            logger.warning("expo push batch failed: %s", exc)
    return tickets
```

### Pattern 2: Expo Push Message Object Format

[VERIFIED: https://docs.expo.dev/push-notifications/sending-notifications/]

```python
# NOTF-01: power out
{
    "to": "ExponentPushToken[xxxxxx]",
    "title": "Sin luz en Maracaibo",
    "body": "Se detectó un apagón en tu zona.",
    "data": {"zone": "maracaibo", "event_type": "outage", "event_id": "uuid"},
    "channelId": "outages",           # Android only; ignored on iOS
    "priority": "high",
    "sound": "default",
}

# NOTF-02: power restored
{
    "to": "ExponentPushToken[xxxxxx]",
    "title": "Volvió la luz en Maracaibo",
    "body": "Se detectó el retorno del servicio eléctrico.",
    "data": {"zone": "maracaibo", "event_type": "restoration", "event_id": "uuid"},
    "channelId": "outages",
    "priority": "high",
    "sound": "default",
}

# NOTF-04: neighbor warning
{
    "to": "ExponentPushToken[xxxxxx]",
    "title": "Apagón en Valencia (zona vecina)",
    "body": "Una zona vecina a Maracay perdió el servicio. Mantente alerta.",
    "data": {"zone": "maracay", "affected_zone": "valencia", "event_type": "neighbor_outage"},
    "channelId": "outages",
    "priority": "default",   # neighbor warning is lower urgency
    "sound": "default",
}
```

**Key constraints:**
- `to` accepts a single token string or an array of strings [VERIFIED: official docs]
- Array body: up to 100 messages per request [VERIFIED: official docs]
- Total payload size: ~4 KiB max [VERIFIED: official docs]
- Rate limit: 600 notifications/second per project [VERIFIED: official docs]
- No `ttl` field needed for power alerts (deliver immediately or not at all is correct behavior)

### Pattern 3: Receipt Flow (DeviceNotRegistered cleanup)

[VERIFIED: https://docs.expo.dev/push-notifications/sending-notifications/]

Tickets from send → receipt IDs → check receipts ~15 min later.

```python
EXPO_RECEIPTS_URL = "https://exp.host/--/api/v2/push/getReceipts"

def check_receipts_and_cleanup(ticket_ids: list[str], client) -> None:
    """
    Fetch receipts for prior send tickets.
    Remove push_tokens rows for DeviceNotRegistered errors.
    Max 1000 IDs per request.
    """
    if not ticket_ids:
        return
    try:
        resp = requests.post(
            EXPO_RECEIPTS_URL,
            json={"ids": ticket_ids[:1000]},
            headers={"content-type": "application/json"},
            timeout=10,
        )
        receipts = resp.json().get("data", {})
        dead_tokens = []
        for receipt_id, receipt in receipts.items():
            if receipt.get("status") == "error":
                details = receipt.get("details", {})
                if details.get("error") == "DeviceNotRegistered":
                    # Need to correlate receipt_id → token; store mapping in notification_log
                    dead_tokens.append(receipt_id)
        if dead_tokens:
            logger.info("removing %d dead tokens", len(dead_tokens))
            # DELETE push_tokens WHERE expo_receipt_id IN dead_tokens
            # (expo_receipt_id column on notification_log joins to push_tokens)
    except Exception as exc:
        logger.warning("receipt check failed (non-fatal): %s", exc)
```

**Recommended receipt strategy:** Store ticket IDs in `notification_log.ticket_id` column. A separate pipeline function (or the next cycle) calls `check_receipts_and_cleanup`. Receipts are available for at least 24 hours; check at ~15 minutes. This is non-blocking — receipt failure never aborts the pipeline.

### Pattern 4: Mobile Token Registration (expo-notifications v56)

[VERIFIED: https://docs.expo.dev/versions/v56.0.0/sdk/notifications/]

```typescript
// Source: docs.expo.dev/push-notifications/push-notifications-setup
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Set at module level (outside component) — controls foreground notification display
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,   // NOT shouldShowAlert (deprecated)
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (!Device.isDevice) {
    // Push tokens unavailable on simulators/emulators without Google Play
    return null;
  }

  // Android: channel MUST be created before permission prompt (SDK 56 requirement)
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('outages', {
      name: 'Apagones',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      enableVibrate: true,
      showBadge: false,
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    return null;
  }

  // projectId from app.json extra.eas.projectId (53f480cb-b4e4-420e-8be7-c36e78bc914c)
  const projectId =
    Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
  if (!projectId) throw new Error('EAS projectId not found in app.json');

  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  return token;
}
```

**Critical SDK 56 notes:**
- `shouldShowAlert` is deprecated — use `shouldShowBanner` and `shouldShowList` [VERIFIED: SDK 56 docs]
- `setNotificationChannelAsync` must be called BEFORE `getExpoPushTokenAsync` on Android 13+ [VERIFIED: SDK 56 docs]
- Push notifications require a development build (not Expo Go) since SDK 53 [VERIFIED: SDK 56 docs]
- `expo-device` is already installed at ~56.0.4 — no new install needed

### Pattern 5: Supabase Token Registration (mobile, anon key)

Following the same `{data, offline}` never-throw pattern as `submitReport` in `mobile/lib/api.ts`:

```typescript
// In mobile/lib/notifications.ts
export interface PushTokenPayload {
  expo_token: string;
  zone: string;
  platform: 'android' | 'ios';
  notify_outage: boolean;
  notify_restoration: boolean;
  notify_neighbor: boolean;
}

export async function registerToken(
  payload: PushTokenPayload,
): Promise<{ ok: boolean; offline: boolean }> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/push_tokens`, {
      method: 'POST',
      headers: {
        ...ANON_HEADERS,
        'Prefer': 'resolution=merge-duplicates',   // upsert on conflict
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

The `Prefer: resolution=merge-duplicates` header triggers PostgREST upsert on the `expo_token` unique constraint. For this to work from the anon role, the RLS policy must also allow UPDATE (see SQL section below).

### Pattern 6: Pipeline Fan-out Hook in main.py

The hook goes AFTER `process_lifecycle()` returns, before R2 upload:

```python
# In pipeline/main.py::run(), after line 334 (process_lifecycle call)
if phase >= 3 and supabase_client is not None:
    try:
        from pipeline.notify import send_notifications
        send_notifications(lifecycle_result, region_output, supabase_client, now)
    except Exception as exc:
        logger.error("notify fan-out failed: %s", exc)
        # Non-fatal: pipeline continues, R2 upload proceeds
```

`lifecycle_result` is the dict returned by `process_lifecycle()`:
`{"new_outages": ["maracaibo", ...], "restorations": ["caracas", ...]}`.

### Anti-Patterns to Avoid

- **Diffing status.json cycle-to-cycle for triggers:** status can flap on every 10-min cycle during bajones. The `process_lifecycle()` return value is the correct trigger source — it already applies the stable-transition logic.
- **Firing NOTF-04 for every outage to ALL neighbors' subscribers:** Only fire to subscribers of the neighbor zone, not to all zones everywhere. The adjacency map maps `affected_zone → list_of_neighbor_zones`; the query is `push_tokens WHERE zone IN neighbor_zones AND notify_neighbor = true`.
- **Blocking pipeline on push failure:** Entire notify block wrapped in try/except; push failure is non-fatal.
- **Calling getExpoPushTokenAsync in a component:** Must be in an async function, wrapped in Device.isDevice check. Never call at module level.
- **Using `shouldShowAlert`:** Deprecated in SDK 53+. Use `shouldShowBanner` + `shouldShowList`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Push HTTP batching | Custom chunking with retry | `requests` + standard 100-item batch loop | Expo's limit is fixed at 100; simple slice loop is sufficient |
| FCM/APNs credential management | Raw Firebase SDK, APNS certs | Expo Push Service relay | Expo abstracts both; single endpoint, single token format |
| Token deduplication | In-memory set or Redis | Supabase `expo_token` UNIQUE constraint + upsert | DB-level uniqueness; survives cron restarts |
| Cooldown state | Cron-cycle in-memory dict | `notification_log` Supabase table | In-memory dies on cron restart every 10 min |
| Android notification channels | Custom native module | `setNotificationChannelAsync` | Expo SDK handles Android 13 permission prompt dependency |
| Receipt-to-token mapping | Separate tracking store | `notification_log.ticket_id` column | One table tracks both cooldown and receipt correlation |

**Key insight:** The pipeline is stateless by design (cron). Any state that must persist across cycles (cooldown, receipt IDs) must live in Supabase.

---

## Supabase Schema: push_tokens and notification_log

### push_tokens table

```sql
-- ============================================================
-- push_tokens: Phase 3 — device push subscriptions
-- anon can INSERT/UPSERT (write token + prefs, update zone/prefs)
-- service_role reads all rows during fan-out
-- No user-identifying data; anonymous by design (ADR-005, ADR-007)
-- ============================================================

CREATE TABLE IF NOT EXISTS push_tokens (
    id                   BIGSERIAL PRIMARY KEY,
    expo_token           TEXT NOT NULL,
    zone                 TEXT NOT NULL,               -- canonical region key
    platform             TEXT NOT NULL CHECK (platform IN ('android', 'ios')),
    notify_outage        BOOLEAN NOT NULL DEFAULT TRUE,
    notify_restoration   BOOLEAN NOT NULL DEFAULT TRUE,
    notify_neighbor      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at           TIMESTAMPTZ DEFAULT NOW(),
    updated_at           TIMESTAMPTZ DEFAULT NOW()
);

-- Uniqueness on the token itself — one row per device
CREATE UNIQUE INDEX IF NOT EXISTS idx_push_tokens_token
    ON push_tokens (expo_token);

-- Fan-out query index: service_role reads by zone
CREATE INDEX IF NOT EXISTS idx_push_tokens_zone
    ON push_tokens (zone);

-- RLS
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

-- anon: INSERT only (for first-time registration)
DROP POLICY IF EXISTS "anon_can_insert_push_token" ON push_tokens;
CREATE POLICY "anon_can_insert_push_token" ON push_tokens
    FOR INSERT TO anon
    WITH CHECK (true);

-- anon: UPDATE own token row (for zone change, toggle prefs)
-- Allows upsert via Prefer: resolution=merge-duplicates
DROP POLICY IF EXISTS "anon_can_update_push_token" ON push_tokens;
CREATE POLICY "anon_can_update_push_token" ON push_tokens
    FOR UPDATE TO anon
    USING (true)
    WITH CHECK (true);

-- anon: SELECT needed for upsert to resolve conflict
DROP POLICY IF EXISTS "anon_can_select_push_token" ON push_tokens;
CREATE POLICY "anon_can_select_push_token" ON push_tokens
    FOR SELECT TO anon
    USING (true);

-- service_role bypasses RLS automatically — no policy needed for pipeline reads/deletes.

-- Column grants for anon (restrict to user-supplied fields only)
REVOKE ALL ON push_tokens FROM anon;
GRANT INSERT (expo_token, zone, platform, notify_outage, notify_restoration, notify_neighbor)
    ON push_tokens TO anon;
GRANT UPDATE (zone, notify_outage, notify_restoration, notify_neighbor, updated_at)
    ON push_tokens TO anon;
GRANT SELECT ON push_tokens TO anon;   -- needed for upsert conflict detection

-- service_role: full access (RLS bypassed, but explicit grant for completeness)
GRANT SELECT, INSERT, UPDATE, DELETE ON push_tokens TO service_role;
```

**RLS design rationale:**
- anon can INSERT/UPDATE/SELECT their own token row. Because push_tokens has no user identity, we cannot scope `USING` to a specific user — anon can technically read/update any row. This is acceptable: push tokens are not secret (they expire, Expo validates ownership server-side, no PII stored). The alternative is a server-side upsert endpoint, which contradicts the static architecture (no server).
- The broader SELECT for anon is required for PostgREST `Prefer: resolution=merge-duplicates` to resolve the unique conflict. Without SELECT, the upsert returns an error.
- service_role bypasses RLS entirely — no policy needed for pipeline fan-out reads.

### notification_log table (cooldown + receipt tracking)

```sql
-- ============================================================
-- notification_log: Phase 3 — cooldown tracking + receipt correlation
-- service_role only. Never written by anon.
-- One row per (zone, event_type, event_id) — deduplicates fan-out.
-- ============================================================

CREATE TABLE IF NOT EXISTS notification_log (
    id              BIGSERIAL PRIMARY KEY,
    zone            TEXT NOT NULL,
    event_type      TEXT NOT NULL CHECK (event_type IN ('outage', 'restoration', 'neighbor_outage')),
    event_id        TEXT,                          -- from outage_lifecycle event_id (nullable for neighbor)
    ticket_id       TEXT,                          -- Expo receipt ID for DeviceNotRegistered cleanup
    sent_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    token_count     INTEGER NOT NULL DEFAULT 0
);

-- Cooldown lookup: (zone, event_type) within time window
CREATE INDEX IF NOT EXISTS idx_notif_log_zone_type
    ON notification_log (zone, event_type, sent_at DESC);

-- Receipt lookup: ticket_id for cleanup
CREATE INDEX IF NOT EXISTS idx_notif_log_ticket
    ON notification_log (ticket_id) WHERE ticket_id IS NOT NULL;

ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;
-- No anon policies — service_role only (RLS default-deny for anon)
GRANT SELECT, INSERT, UPDATE ON notification_log TO service_role;
```

---

## Pipeline Integration: notify.py Module Design

### Where it hooks in (`pipeline/main.py`)

`process_lifecycle()` at line 334 already returns `{"new_outages": [...], "restorations": [...]}`.

Current code:
```python
if phase >= 2 and supabase_client is not None:
    try:
        process_lifecycle(region_output, now, supabase_client)
    except Exception as exc:
        logger.error("lifecycle failed: %s", exc)
```

Phase 3 change — capture the return value and pass to notify:
```python
if phase >= 2 and supabase_client is not None:
    lifecycle_result = {}
    try:
        lifecycle_result = process_lifecycle(region_output, now, supabase_client)
    except Exception as exc:
        logger.error("lifecycle failed: %s", exc)

    if phase >= 3:
        try:
            from pipeline.notify import send_notifications
            send_notifications(lifecycle_result, region_output, supabase_client, now)
        except Exception as exc:
            logger.error("notify fan-out failed (non-fatal): %s", exc)
```

### notify.py module signature

```python
def send_notifications(
    lifecycle_events: dict,       # {"new_outages": [...], "restorations": [...]}
    regions_scored: dict,         # full region_output from run()
    client,                       # supabase service_role client
    now: datetime,
    cooldown_hours: int = 2,      # Claude's discretion — see recommendation below
) -> dict:
    """
    Fan-out push notifications for confirmed lifecycle transitions.
    Returns {"sent": int, "skipped_cooldown": int, "skipped_unstable": int}.
    Non-fatal: all failures logged, never raises.
    """
```

### Adjacency resolution inside notify.py

```python
# Source: CONTEXT.md D-07 locked map — lives in pipeline/regions.py
from pipeline.regions import ADJACENCY_MAP

# Example usage:
def _get_neighbor_zones(zone: str) -> list[str]:
    return ADJACENCY_MAP.get(zone, [])
```

`ADJACENCY_MAP` is a new dict added to `pipeline/regions.py` — the canonical home (D-08). The mobile mirror goes in `mobile/lib/regions.ts` as a `ADJACENCY_MAP: Record<string, string[]>` export.

### Fan-out query logic

```python
def _fetch_tokens_for_zones(zones: list[str], event_type: str, client) -> list[str]:
    """
    Read push tokens for zones where the relevant toggle is enabled.
    event_type: 'outage' | 'restoration' | 'neighbor_outage'
    """
    column_map = {
        "outage":          "notify_outage",
        "restoration":     "notify_restoration",
        "neighbor_outage": "notify_neighbor",
    }
    toggle_col = column_map[event_type]

    try:
        result = (
            client.table("push_tokens")
            .select("expo_token")
            .in_("zone", zones)
            .eq(toggle_col, True)
            .execute()
        )
        return [row["expo_token"] for row in (result.data or [])]
    except Exception as exc:
        logger.warning("push_tokens query failed: %s", exc)
        return []
```

### Suppression logic

```python
def _is_suppressed(zone: str, event_type: str, cooldown_hours: int, client) -> bool:
    """Check cooldown: was this zone+event_type notified within cooldown_hours?"""
    cutoff = (now - timedelta(hours=cooldown_hours)).isoformat()
    try:
        result = (
            client.table("notification_log")
            .select("id")
            .eq("zone", zone)
            .eq("event_type", event_type)
            .gte("sent_at", cutoff)
            .limit(1)
            .execute()
        )
        return bool(result.data)
    except Exception as exc:
        logger.warning("cooldown check failed: %s", exc)
        return False   # fail-open: if we can't check, send anyway
```

---

## Claude's Discretion Recommendations

### D-CD-1: Cooldown Window Length

**Recommendation: 3 hours.**

Rationale: Venezuelan outages per rationing schedules (see `_RATIONING_PATTERNS` in main.py) typically run 2-6 hours. A 2-hour cooldown would re-fire NOTF-01 during a single long outage if the outage_lifecycle briefly closes and reopens (score fluctuation around threshold). A 3-hour window covers most outage durations without significantly delaying re-notification after a genuine second event. Set as `cooldown_hours: int = 3` default parameter in `send_notifications()` — overridable via env var `NOTIFY_COOLDOWN_HOURS` for tuning.

NOTF-02 (restoration) has separate cooldown tracking from NOTF-01 (outage). A restoration followed by a new outage within 3 hours correctly fires both, because they are different `event_type` values in `notification_log`.

### D-CD-2: Quiet-Hours Policy

**Recommendation: Defer to post-Phase-3 (v2 enhancement).**

Rationale: (1) Quiet hours require storing a timezone preference per token, adding schema complexity. (2) Venezuelan users losing power at 3am need the notification — silence is actively harmful in the target context. (3) OS-level do-not-disturb handles quiet hours for users who want them. Defer until real user feedback says it's a pain point.

### D-CD-3: Stale Token Cleanup Mechanism

**Recommendation: Async receipt check on the NEXT pipeline cycle, not synchronously.**

- Send batch → collect ticket IDs → INSERT into `notification_log.ticket_id`
- On next cycle (or a separate cleanup function called every 5th cycle to reduce API load), call `getReceipts` for pending ticket IDs in `notification_log` from the last 24 hours
- Any `DeviceNotRegistered` receipt → DELETE from `push_tokens` WHERE `expo_token` = the token that generated that ticket
- Ticket-to-token correlation: store `expo_token` in `notification_log` alongside `ticket_id`

This means `notification_log` needs an `expo_token TEXT` column for cleanup correlation.

Revised `notification_log` schema addition:
```sql
ALTER TABLE notification_log ADD COLUMN IF NOT EXISTS expo_token TEXT;
```

### D-CD-4: Android Channel / iOS Category Config

**Recommendation:**

Single Android channel: `channelId: "outages"` with `importance: HIGH`. No separate channels for outage vs restoration vs neighbor — channel importance should be uniform (all are real-time safety info). Users who want to mute neighbor warnings can toggle the in-app preference; the OS channel should not gate this.

iOS categories: Skip `setNotificationCategoryAsync` for Phase 3. iOS categories add interactive action buttons (e.g., "View Zone"). This is Phase 4+ scope. For now, tapping the notification opens the app to the home screen (default behavior).

```typescript
// Android channel config for notify.tsx / notifications.ts
await Notifications.setNotificationChannelAsync('outages', {
  name: 'Apagones',
  importance: Notifications.AndroidImportance.HIGH,  // NOT MAX — avoids full-screen interrupt
  vibrationPattern: [0, 250, 250, 250],
  enableVibrate: true,
  showBadge: false,  // badge count adds no value for outage alerts
  description: 'Notificaciones de apagones, restauraciones y zonas vecinas',
});
```

`AndroidImportance.HIGH` (not MAX) shows in the notification shade with sound+vibration but does NOT take over the full screen — appropriate for power alerts that don't require immediate action.

### D-CD-5: Spanish Copy per Event Type

```
NOTF-01 (outage):
  title: "Sin luz en {display_name}"
  body: "Se detectó un apagón en tu zona."

NOTF-02 (restoration):
  title: "Volvió la luz en {display_name}"
  body: "Se detectó el retorno del servicio eléctrico."

NOTF-04 (neighbor warning):
  title: "Apagón en zona vecina"
  body: "{neighbor_display_name} perdió el servicio. Tu zona podría verse afectada."
```

Honesty principle (D-11): Never include ETA in notification copy. ETAs come from the ML model in Phase 5.

---

## Adjacency Map Single-Source Decision (D-08)

**Recommendation: Pipeline-canonical, mobile-mirrored static constant.**

The adjacency map is a pure data structure — 17 entries, changes only if the region list changes. Both pipeline and mobile need it, but they cannot share code.

Approach:
1. Add `ADJACENCY_MAP: dict[str, list[str]]` to `pipeline/regions.py` — the locked D-07 map from CONTEXT.md.
2. Add `export const ADJACENCY_MAP: Record<string, string[]>` to `mobile/lib/regions.ts` — verbatim mirror with a comment: `// Mirror of pipeline/regions.py ADJACENCY_MAP — must stay in sync manually`.
3. Do NOT carry it via `status.json` — that would add ~2KB to every CDN read, require frontend parsing, and couple the CDN contract to a static lookup that never changes at runtime.

The no-shared-code boundary is maintained: both define it from the same reviewed list (CONTEXT.md D-07), neither imports the other.

---

## Expo Push Auth: When is an Expo Access Token Required?

[VERIFIED: https://docs.expo.dev/push-notifications/sending-notifications/]

Push security (access token) is **optional** and **off by default**. It is enabled from the EAS Dashboard. Without it, any caller can POST to the Expo endpoint for your project (tokens still validate to your project, preventing spoofing of token origins).

**Recommendation for Phase 3:** Enable push security in EAS Dashboard. Store the access token in GitHub Actions secrets as `EXPO_ACCESS_TOKEN`. Pass it in the `Authorization: Bearer` header in `notify.py`. This is a one-time EAS Dashboard action with no code overhead beyond reading the env var.

**FCM Credentials (Android):** [VERIFIED via Expo push setup docs] Expo requires FCM V1 credentials (Google Service Account JSON) to deliver Android push notifications. This requires:
1. Create a Firebase project (if not already done)
2. Generate a service account key JSON from Firebase Console
3. Upload via `eas credentials` → Android → production → Google Service Account
4. Add `google-services.json` to `mobile/android/` (EAS build process)

This is a **blocking prerequisite for Android push delivery** — without FCM credentials, Expo cannot relay to Android devices. For iOS, APNs credentials are managed similarly via `eas credentials` → iOS.

The EAS project ID `53f480cb-b4e4-420e-8be7-c36e78bc914c` (from `mobile/app.json`) is already configured for updates; the same project is used for push credentials.

---

## STORAGE_KEYS additions (mobile/lib/storage.ts)

New MMKV keys to add to `STORAGE_KEYS` constant:

```typescript
pushPermissionGranted: 'pushPermissionGranted',   // boolean — OS permission status
pushToken:             'pushToken',               // string | null — last registered token
notifyOutage:          'notifyOutage',            // boolean — NOTF-01 toggle
notifyRestoration:     'notifyRestoration',       // boolean — NOTF-02 toggle
notifyNeighbor:        'notifyNeighbor',          // boolean — NOTF-04 toggle
```

---

## Common Pitfalls

### Pitfall 1: Android 13 Push Permission Requires Channel First
**What goes wrong:** `getExpoPushTokenAsync` (and the OS permission dialog) silently fails on Android 13+ if no notification channel exists.
**Why it happens:** Android 13+ OS requires a channel to be defined before it shows a permission prompt.
**How to avoid:** Always call `setNotificationChannelAsync('outages', {...})` before `requestPermissionsAsync()` on Android. This is documented in SDK 56 docs. The channel call is safe to repeat (idempotent on channel ID).
**Warning signs:** Permission prompt never appears on Android 13 devices; `requestPermissionsAsync()` returns `denied` immediately.

### Pitfall 2: shouldShowAlert is Deprecated (SDK 53+)
**What goes wrong:** Notification handler with `shouldShowAlert: true` compiles but triggers a deprecation warning; behavior may differ from expected in future SDK versions.
**Why it happens:** SDK 53 split `shouldShowAlert` into `shouldShowBanner` (banner overlay) and `shouldShowList` (notification center). Both should be `true` for standard push behavior.
**How to avoid:** Use `shouldShowBanner: true, shouldShowList: true` in `setNotificationHandler`.

### Pitfall 3: Expo Push Requires Development Build (not Expo Go)
**What goes wrong:** Testing push notification registration in Expo Go fails silently since SDK 53 (Android).
**Why it happens:** Expo removed push notification support from Expo Go on Android to reduce binary size.
**How to avoid:** Use `eas build --profile development` or `expo run:android` for a dev build. iOS Simulator (Xcode 14+) supports push notifications.

### Pitfall 4: Supabase Anon Upsert Requires SELECT + UPDATE + INSERT Policies
**What goes wrong:** `Prefer: resolution=merge-duplicates` (upsert) returns 403 if anon only has INSERT policy.
**Why it happens:** PostgREST upsert under the hood requires SELECT to detect the conflict, then UPDATE to overwrite. INSERT-only policy blocks both.
**How to avoid:** Grant all three operations to anon for push_tokens, as shown in the SQL above. The data is not sensitive (no PII, tokens are not secret).

### Pitfall 5: process_lifecycle() Return Value Must Be Captured
**What goes wrong:** The Phase 2 call to `process_lifecycle()` currently discards the return value (result is not assigned). The Phase 3 fan-out requires the `new_outages` and `restorations` lists.
**Why it happens:** Phase 2 only needed the side effects (DB writes), not the return value.
**How to avoid:** Modify the `main.py` call site to assign `lifecycle_result = process_lifecycle(...)` before passing to `send_notifications()`.

### Pitfall 6: Flapping During Bajones (D-10)
**What goes wrong:** Zones in `unstable` status trigger lifecycle events repeatedly during voltage wave events (bajones). Without suppression, users receive repeated outage/restoration notifications minutes apart.
**Why it happens:** `outage_lifecycle.py` fires on every confirmed transition. During bajones, power may flick on and off repeatedly within an hour.
**How to avoid:** Two layers — `process_lifecycle()` already uses `_OUTAGE_STATUSES` and `_NORMAL_STATUSES` (not "unstable"), but the lifecycle can still open/close repeatedly on a real multi-hour bajon. The per-zone per-type 3-hour cooldown in `notification_log` is the second layer that stops repeated fan-out.

### Pitfall 7: FCM Credentials are a Build Prerequisite
**What goes wrong:** App builds fine, push token registration succeeds client-side, but notifications never arrive on Android.
**Why it happens:** Expo can generate a push token without FCM credentials, but cannot relay to FCM without them. The failure is silent on the client.
**How to avoid:** Set up FCM V1 credentials via `eas credentials` before the first push test. This requires a Firebase project and Google Service Account JSON — plan time for this infra step.

---

## Validation Architecture

nyquist_validation is enabled in `.planning/config.json`.

### Test Framework

| Property | Value |
|----------|-------|
| Framework (pipeline) | pytest (already configured, no version pinned) |
| Framework (mobile) | jest-expo (jest.config.js, jest.setup.js) |
| Pipeline quick run | `python -m pytest pipeline/tests/test_notify.py -x` |
| Pipeline full suite | `python -m pytest pipeline/tests/ -x` |
| Mobile quick run | `cd mobile && npx jest __tests__/lib/notifications.test.ts --watchAll=false` |
| Mobile full suite | `cd mobile && npx jest --watchAll=false` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| NOTF-01 | Pipeline sends outage notification to subscribed zone tokens | unit | `pytest pipeline/tests/test_notify.py::TestSendNotifications::test_outage_fires_for_subscribers -x` | ❌ Wave 0 |
| NOTF-01 | Notification suppressed if zone is unstable | unit | `pytest pipeline/tests/test_notify.py::TestSuppression::test_unstable_zone_skipped -x` | ❌ Wave 0 |
| NOTF-02 | Pipeline sends restoration notification on confirmed restoration | unit | `pytest pipeline/tests/test_notify.py::TestSendNotifications::test_restoration_fires_for_subscribers -x` | ❌ Wave 0 |
| NOTF-04 | Neighbor zones receive early warning notification | unit | `pytest pipeline/tests/test_notify.py::TestSendNotifications::test_neighbor_outage_fires_for_neighbor_subscribers -x` | ❌ Wave 0 |
| INFR-01 | Expo Push API called with correct message format | unit | `pytest pipeline/tests/test_notify.py::TestExpoApi::test_message_format -x` | ❌ Wave 0 |
| INFR-01 | Batch chunking at 100 messages | unit | `pytest pipeline/tests/test_notify.py::TestExpoApi::test_batch_chunking -x` | ❌ Wave 0 |
| INFR-01 | No send when no tokens returned | unit | `pytest pipeline/tests/test_notify.py::TestSendNotifications::test_no_tokens_no_http_call -x` | ❌ Wave 0 |
| INFR-02 | Token registration POST succeeds with anon key | unit | `cd mobile && npx jest __tests__/lib/notifications.test.ts -t "registerToken" --watchAll=false` | ❌ Wave 0 |
| INFR-02 | Token registration returns {ok:false, offline:true} on network error | unit | same file | ❌ Wave 0 |
| INFR-03 | Cooldown: second outage within window skipped | unit | `pytest pipeline/tests/test_notify.py::TestCooldown::test_cooldown_suppresses_repeat -x` | ❌ Wave 0 |
| INFR-03 | Cooldown: outage + restoration fire independently (different event_type) | unit | `pytest pipeline/tests/test_notify.py::TestCooldown::test_restoration_fires_after_outage_within_window -x` | ❌ Wave 0 |
| INFR-03 | All signals None → no notifications | unit | `pytest pipeline/tests/test_notify.py::TestEdgeCases::test_empty_lifecycle_events_no_send -x` | ❌ Wave 0 |

### New Modules Requiring Tests (pipeline/tests/test_notify.py)

All tests must be **offline** — mock Supabase client and mock `requests.post`.

**Mock data needed:**
```python
MOCK_TOKENS = [
    {"expo_token": "ExponentPushToken[aaa111]", "zone": "caracas"},
    {"expo_token": "ExponentPushToken[bbb222]", "zone": "los_teques"},   # neighbor of caracas
]

MOCK_LIFECYCLE_OUTAGE = {
    "new_outages": ["caracas"],
    "restorations": [],
}

MOCK_LIFECYCLE_RESTORATION = {
    "new_outages": [],
    "restorations": ["caracas"],
}

MOCK_REGIONS_SCORED = {
    "caracas": {"status": "confirmed_outage", "current_score": 0.8},
    "los_teques": {"status": "normal", "current_score": 0.1},
}
```

**Pattern (follows test_outage_lifecycle.py style):**
```python
import pytest
from unittest.mock import MagicMock, patch
from pipeline.notify import send_notifications

def _mock_client(tokens=None):
    client = MagicMock()
    client.table.return_value.select.return_value.in_.return_value.eq.return_value.execute.return_value.data = tokens or []
    return client

class TestSendNotifications:
    def test_outage_fires_for_subscribers(self):
        client = _mock_client(tokens=[{"expo_token": "ExponentPushToken[aaa111]"}])
        with patch("pipeline.notify._send_expo_batch") as mock_send:
            mock_send.return_value = [{"status": "ok", "id": "receipt-1"}]
            result = send_notifications(
                MOCK_LIFECYCLE_OUTAGE,
                MOCK_REGIONS_SCORED,
                client,
                now=NOW,
            )
        assert result["sent"] >= 1
        mock_send.assert_called_once()
        msg = mock_send.call_args[0][0][0]
        assert msg["data"]["event_type"] == "outage"
        assert "Sin luz" in msg["title"]
```

### New Modules Requiring Tests (mobile/__tests__/lib/notifications.test.ts)

**Mock expo-notifications in jest.setup.js (new addition):**
```typescript
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn().mockResolvedValue(null),
  getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  getExpoPushTokenAsync: jest.fn().mockResolvedValue({ data: 'ExponentPushToken[test123]' }),
  AndroidImportance: { HIGH: 4, MAX: 5 },
  addNotificationReceivedListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
  addNotificationResponseReceivedListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
}));

jest.mock('expo-device', () => ({
  isDevice: true,
}));
```

### Sampling Rate
- Per task commit: `pytest pipeline/tests/test_notify.py -x` (pipeline) + `cd mobile && npx jest __tests__/lib/notifications.test.ts --watchAll=false` (mobile)
- Per wave merge: full suites — `pytest pipeline/tests/ -x` + `cd mobile && npx jest --watchAll=false`
- Phase gate: both suites green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `pipeline/tests/test_notify.py` — covers all INFR and NOTF pipeline requirements
- [ ] `mobile/__tests__/lib/notifications.test.ts` — covers INFR-02 token registration
- [ ] `expo-notifications` mock in `mobile/jest.setup.js` — required for all notification tests
- [ ] `expo-device` mock in `mobile/jest.setup.js` — already partially done; add `isDevice: true`

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| expo-notifications | Token registration, notification handler | ✗ (not yet installed) | — | Install via `npx expo install expo-notifications` |
| expo-device | Device.isDevice check | ✓ (already in package.json) | ~56.0.4 | — |
| EAS project ID | getExpoPushTokenAsync | ✓ (53f480cb in app.json) | — | — |
| Firebase project + google-services.json | Android push delivery | ✗ (not yet configured) | — | No fallback — blocking for Android |
| APNs credentials | iOS push delivery | ✗ (Apple Developer Program) | — | Can defer to Phase 5 (iOS store submission) |
| EXPO_ACCESS_TOKEN | Push security (optional) | ✗ | — | Optional; skip if push security not enabled in EAS |
| Supabase push_tokens table | Token storage | ✗ (not yet created) | — | Must create before first token registration |
| Supabase notification_log table | Cooldown state | ✗ (not yet created) | — | Must create before first fan-out cycle |

**Missing dependencies blocking execution:**
- `expo-notifications` package (one `npx expo install` command)
- Firebase project + FCM V1 credentials + `google-services.json` (requires human time: ~30 min Firebase setup + `eas credentials` CLI)
- Supabase schema migration for `push_tokens` and `notification_log`

**Missing dependencies with partial fallback:**
- APNs credentials: iOS push can be deferred to Phase 5 store submission. Android-only push is functional without it.
- EXPO_ACCESS_TOKEN: Optional if push security not enabled in EAS Dashboard. Recommend enabling but not a hard blocker.

---

## Security Domain

`security_enforcement` not set to false in config — section required.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No (anonymous system) | — |
| V3 Session Management | No (stateless cron + anon tokens) | — |
| V4 Access Control | Yes | RLS + two-key model (ADR-007) |
| V5 Input Validation | Yes | Supabase CHECK constraints on `platform`, `event_type`; column grants restrict anon fields |
| V6 Cryptography | No (tokens are opaque Expo strings, not crypto material) | — |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Token flooding (anon bulk INSERT fake tokens) | Denial of Service | Rate limiting via Supabase or Cloudflare in front of PostgREST; INSERT volume monitoring |
| Push token scraping (SELECT all tokens via anon key) | Information Disclosure | SELECT policy scoped — anon can SELECT (needed for upsert) but cannot filter by other users' zones; no PII in push_tokens |
| Fake outage notifications via direct Expo API | Spoofing | Expo validates token origin against registered project; tokens are project-specific |
| Notification log injection | Tampering | notification_log has no anon write policy; service_role only |
| Expo Access Token exposure | Elevation of Privilege | Store as GitHub Actions secret `EXPO_ACCESS_TOKEN`; never in client code |

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Raw FCM/APNs integration (separate Android/iOS credentials) | Expo Push Service relay (single endpoint) | Expo SDK 1+ | Single token format, single HTTP endpoint, Expo manages FCM/APNs credential rotation |
| `shouldShowAlert` in notification handler | `shouldShowBanner` + `shouldShowList` | SDK 53 | Deprecated API; must use new fields or deprecation warning + undefined behavior |
| Expo Go for push notification testing | Development build required | SDK 53 (Android) | Must build dev client for any push token work on Android |
| FCM Legacy API | FCM V1 (service account JSON) | Firebase 2024 migration | FCM Legacy API shut down; only V1 accepted |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | FCM Legacy API is no longer accepted by Expo for Android credential setup | Environment Availability, Pitfall 7 | If wrong, Legacy API approach might still work — low risk, FCM V1 is correct path regardless |
| A2 | APNs credentials can be deferred to Phase 5 for iOS push delivery | Environment Availability | If Apple rejects the app without push configured, Phase 3 iOS push must be set up earlier |
| A3 | Push security (EXPO_ACCESS_TOKEN) is disabled by default in EAS | Expo Push Auth section | If wrong, push send calls fail with UNAUTHORIZED immediately — but this is easy to detect and fix |

---

## Open Questions

1. **Firebase project already exists?**
   - What we know: `google-services.json` not present in `mobile/` or `mobile/android/`; no Firebase project referenced in app.json.
   - What's unclear: Whether Leo has an existing Firebase project for this app.
   - Recommendation: Planner should add a Wave 0 task: "Create Firebase project for Cocuyo, upload FCM V1 credentials via `eas credentials`." This is a human-only step (~30 min), not automatable.

2. **EAS push security currently enabled?**
   - What we know: EAS project `53f480cb-b4e4-420e-8be7-c36e78bc914c` exists and is used for OTA updates. Push security setting is in EAS Dashboard, not inspectable from code.
   - What's unclear: Whether push security is on or off.
   - Recommendation: Planner adds a checkpoint task: "Check EAS Dashboard → Push → Security. If disabled, enable and add `EXPO_ACCESS_TOKEN` to GitHub Actions secrets."

3. **notification_log.expo_token column for DeviceNotRegistered cleanup**
   - What we know: Receipt IDs map to sent tickets, not directly to tokens. To delete a dead token, we need the token that produced a given ticket ID.
   - What's unclear: Best schema for this mapping — store (ticket_id, expo_token) pair in notification_log vs a separate join table.
   - Recommendation: Add `expo_token TEXT` column to `notification_log`. One row per push send (one per zone+event_type+cycle), storing the ticket_id and expo_token for later cleanup. This is low volume (~17 zones × 3 event types × cooldown-filtered = rarely more than a handful per cycle).

---

## Sources

### Primary (HIGH confidence)
- [Expo Notifications SDK v56 reference](https://docs.expo.dev/versions/v56.0.0/sdk/notifications/) — getExpoPushTokenAsync, requestPermissionsAsync, setNotificationChannelAsync, setNotificationHandler, deprecation of shouldShowAlert
- [Expo Push Notifications — Sending Notifications](https://docs.expo.dev/push-notifications/sending-notifications/) — API endpoint, batch limits (100 msgs), rate limit (600/s), receipt flow, DeviceNotRegistered error, access token auth
- [Expo Push Notifications — Setup Guide](https://docs.expo.dev/push-notifications/push-notifications-setup/) — FCM credentials requirement, plugin config, projectId setup
- `pipeline/outage_lifecycle.py` (inspected) — process_lifecycle() return dict structure, _OUTAGE_STATUSES
- `pipeline/restoration_tracker.py` (inspected) — check_restoration() return dict, "restored" status
- `pipeline/main.py` (inspected) — phase gating pattern, lifecycle call site, collector isolation pattern
- `pipeline/regions.py` (inspected) — REGIONS dict (17 canonical keys), module pattern for ADJACENCY_MAP addition
- `mobile/app.json` (inspected) — EAS projectId (53f480cb), plugins list, existing deps
- `mobile/package.json` (inspected) — expo-device already at ~56.0.4; expo-notifications absent
- `mobile/lib/storage.ts` (inspected) — STORAGE_KEYS pattern, MMKV instance
- `docs/schema.sql` (inspected) — existing table patterns, RLS policy syntax, GRANT patterns
- `docs/adr/007-supabase-rls-two-key-model.md` (inspected) — two-key model constraints
- npm registry — `npm view expo-notifications version` → 56.0.17; `npm view expo-device version` → 56.0.4

### Secondary (MEDIUM confidence)
- [Supabase Row Level Security docs](https://supabase.com/docs/guides/database/postgres/row-level-security) — service_role bypasses RLS, anon INSERT policy pattern
- WebSearch — Python `requests` direct HTTP to Expo Push API (pattern confirmed, same as official docs)

### Tertiary (LOW confidence — none)
All core claims verified from official docs or codebase inspection.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — official Expo docs + npm registry confirmation
- Architecture: HIGH — based on inspected pipeline files; process_lifecycle() return value confirmed
- Pitfalls: HIGH — sourced from official SDK docs (deprecation notes, Android 13 channel requirement)
- Schema SQL: HIGH — follows existing schema.sql patterns exactly; RLS follows ADR-007

**Research date:** 2026-06-13
**Valid until:** 2026-07-13 (Expo SDK docs are stable; FCM V1 credential path unlikely to change)
