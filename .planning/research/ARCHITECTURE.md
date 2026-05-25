# Architecture Patterns

**Domain:** React Native + Expo mobile app — power outage monitoring, offline-first, push notifications
**Researched:** 2026-05-24
**Confidence:** MEDIUM — Expo SDK 51/52 + FCM architecture from training data (cutoff Aug 2025); no live doc verification possible in this environment. Verify Expo push token flow against current docs before Phase 3 implementation.

---

## Recommended Architecture

### System Diagram

```
[Existing Pipeline: GitHub Actions cron]
         |
         | detects status change
         v
[pipeline/notify.py] ──── POST /send ────> [Expo Push Service]
                                                    |
                                          ┌─────────┴─────────┐
                                          v                   v
                                    [FCM (Android)]    [APNs (iOS)]
                                          |                   |
                                          └─────────┬─────────┘
                                                    v
                                            [Device: Cocuyo App]

[Cloudflare R2 CDN]
  status.json (every 10 min)
         |
         | fetch on foreground / background refresh
         v
[App: StatusCache (MMKV)] ←──── [StatusSyncService]
         |
         | read
         v
[UI: Map / RegionCard / StatusBanner]

[App: ReportQueue (MMKV)] ←── user tap
         |
         | drain when online
         v
[Supabase REST API: outage_reports table]
         |
         | pipeline reads on next cron (existing behavior)
         v
[pipeline/collector_crowd.py]
```

---

## Component Boundaries

| Component | Responsibility | Reads From | Writes To | Lives In |
|-----------|---------------|------------|-----------|----------|
| `StatusSyncService` | Fetch status.json, update cache, trigger local food timer auto-start | Cloudflare R2 CDN | MMKV `status_cache` | `app/services/statusSync.ts` |
| `StatusCache` | Persist last-known status.json to MMKV; serve offline reads | MMKV | — | `app/lib/statusCache.ts` |
| `ReportQueue` | Accept user reports offline, persist to MMKV, drain to Supabase when online | User action | MMKV `report_queue`, Supabase REST | `app/lib/reportQueue.ts` |
| `PushTokenService` | Register Expo push token, persist locally, handle token refresh | Expo Notifications SDK | MMKV `push_token`, Supabase `push_tokens` table (new) | `app/services/pushToken.ts` |
| `NotificationHandler` | Route incoming push to correct UI action; handle foreground/background/killed states | FCM / APNs | React Navigation | `app/services/notificationHandler.ts` |
| `FoodTimerStore` | Store food items + start times; compute time-to-spoil; schedule local notifications | User action + auto-start on outage detection | MMKV `food_timers` | `app/stores/foodTimerStore.ts` |
| `ZonePreferenceStore` | User's selected home zone; drives notification subscription filter | User settings | MMKV `zone_prefs` | `app/stores/zonePrefs.ts` |
| `pipeline/notify.py` | Query Supabase for registered tokens, detect status transitions, POST to Expo Push API | `push_tokens` table, previous `status.json` | Expo Push Service | `pipeline/notify.py` |
| **Supabase `push_tokens` table (NEW)** | Maps Expo push token → zone subscription list; upserted by app, read by pipeline | App via anon REST | Pipeline via service_role | Supabase |

---

## Data Flow

### Flow 1: Status Read (happy path, online)

```
App foreground / 10-min background refresh
  → StatusSyncService fetches https://r2.cocuyo.com/status.json
  → Parses JSON, validates schema version
  → Writes to MMKV StatusCache (keyed by updated_at)
  → Emits "status:updated" event
  → UI components re-render from cache
  → If status transitions to outage in user's zone:
      → FoodTimerStore.autoStartTimers(region)
```

### Flow 2: Status Read (offline)

```
App foreground, no connectivity
  → StatusSyncService fetch fails
  → Reads last-known StatusCache from MMKV
  → UI renders cached data with "last updated X min ago" banner
  → No error state — offline is expected behavior
```

### Flow 3: Report Submission (online)

```
User taps "sin luz" / "volvió la luz"
  → GPS auto-detect (expo-location, one-time permission prompt)
  → ReportQueue.enqueue({ region, status, lat, lon, onset_type })
  → ReportQueue.drain() → POST /rest/v1/outage_reports (anon key)
  → Supabase RLS validates, ip_hash trigger fires
  → App shows social proof: calls get_recent_count() RPC
```

### Flow 4: Report Submission (offline)

```
User taps "sin luz" while offline
  → ReportQueue.enqueue() → persists to MMKV
  → App shows "guardado — se enviará cuando haya señal"
  → NetInfo listener fires when connectivity returns
  → ReportQueue.drain() sends all queued reports in order
  → Duplicate protection: if >30 min old, silently discard (stale report)
```

### Flow 5: Push Notification (pipeline-triggered)

```
pipeline/main.py detects status change in region:
  status was "normal" → now "confirmed_outage"
  → pipeline/notify.py queries push_tokens table:
      SELECT token FROM push_tokens WHERE zone_subscriptions @> '["maracaibo"]'
  → Batches tokens (Expo Push API accepts 100/request)
  → POSTs to https://exp.host/--/api/v2/push/send
  → Expo service routes to FCM (Android) or APNs (iOS)
  → Device receives push notification
  → NotificationHandler.handleIncoming():
      foreground: in-app banner + update StatusCache
      background/killed: system tray notification, deep link on tap
```

### Flow 6: Push Token Registration

```
App first launch (or permission granted):
  → expo-notifications.getExpoPushTokenAsync()
  → PushTokenService stores token in MMKV
  → PushTokenService POSTs to Supabase push_tokens table (anon INSERT):
      { token, zone_subscriptions: [user's selected zone], platform, app_version }
  → On zone preference change: PATCH push_tokens WHERE token = ?
  → On app uninstall: token becomes invalid; Expo Push API returns DeadEndToken
      → pipeline/notify.py removes dead tokens (cleanup pass after each notify run)
```

---

## Component Build Order (Dependencies)

Build order matters because each layer depends on the one below.

```
Phase 1 (Foundation):
  1. StatusCache (MMKV) — everything reads from this
  2. StatusSyncService — populates the cache
  3. UI: Map + RegionCard (reads cache, no write needed)
  4. ReportQueue (MMKV persistence layer)
  5. Report submission UI + Supabase POST

Phase 2 (Offline):
  6. NetInfo integration → ReportQueue drain on reconnect
  7. Offline status banner ("cached X min ago")
  8. Background fetch (expo-background-fetch) → silent StatusSync refresh

Phase 3 (Push Notifications):
  9. Supabase push_tokens table (schema migration — NEW)
  10. PushTokenService (token registration + zone subscription)
  11. pipeline/notify.py (new pipeline module)
  12. NotificationHandler (foreground/background routing)
  13. Notification permission prompt UX

Phase 4 (Food Timers):
  14. FoodTimerStore (MMKV, food item schema)
  15. Local notification scheduling (expo-notifications local)
  16. Food timer auto-start on outage detection
  17. Food timer UI (list, add/remove items, progress indicator)

Phase 5 (Polish):
  18. ZonePreferenceStore + settings screen
  19. Dark/AMOLED mode
  20. WhatsApp share integration
  21. Low battery mode (polling frequency reduction via BatteryManager API)
  22. Emergency contacts per zone (static data, no backend)
```

---

## Patterns to Follow

### Pattern 1: MMKV as Single Source of Truth

**What:** Use `react-native-mmkv` for all persistent state — status cache, report queue, food timers, user prefs, push token. Single key-value store with typed accessors.

**Why:** MMKV is 10x faster than AsyncStorage, synchronous reads (no await), works offline by definition, survives app kills. Expo manages AsyncStorage migration via a documented path.

**Key schema:**
```typescript
// All MMKV keys — define as constants, never hardcode strings
export const CACHE_KEYS = {
  STATUS_CACHE: 'status:cache',        // full status.json object
  STATUS_UPDATED_AT: 'status:updated', // ISO string
  REPORT_QUEUE: 'reports:queue',       // JSON array of pending reports
  PUSH_TOKEN: 'push:token',            // Expo push token string
  ZONE_PREF: 'user:zone',             // string region key
  FOOD_TIMERS: 'timers:food',          // JSON array of timer objects
} as const
```

### Pattern 2: Expo Push Token → Expo Push Service (not direct FCM)

**What:** Use Expo's push notification service as the abstraction layer. App calls `expo-notifications`, pipeline POSTs to Expo's API at `https://exp.host/--/api/v2/push/send`. Expo handles FCM/APNs routing.

**Why:** Eliminates platform-specific FCM/APNs credential management in the pipeline. Expo handles token normalization and platform routing. Free for Cocuyo's scale. Direct FCM requires Firebase Admin SDK and separate APNs certificates — unnecessary complexity.

**Tradeoff:** Expo Push Service is a third-party intermediary. Acceptable for a public-good app; documents this dependency explicitly.

```python
# pipeline/notify.py — send pattern
import requests

def send_push_notifications(tokens: list[str], title: str, body: str, data: dict) -> None:
    messages = [
        {
            "to": token,
            "title": title,
            "body": body,
            "data": data,
            "sound": "default",
            "priority": "high",
        }
        for token in tokens
    ]
    # Expo Push API: max 100 messages per request
    for batch in chunk(messages, 100):
        resp = requests.post(
            "https://exp.host/--/api/v2/push/send",
            json=batch,
            headers={"Accept-Encoding": "gzip", "Content-Type": "application/json"},
            timeout=10,
        )
        handle_receipts(resp.json())  # remove dead tokens from push_tokens table
```

### Pattern 3: Stateless Report Queue with Idempotency

**What:** Each queued report includes a `client_id` (UUID generated at tap time). On drain, POST with `client_id` in the body. Supabase unique constraint on `client_id` prevents duplicate inserts on retry.

**Why:** Venezuela's connectivity is unreliable. A user may tap, the request may partially succeed, connectivity drops, app retries. Without idempotency, duplicate reports corrupt the crowd signal.

**Database change needed:** Add `client_id UUID UNIQUE` column to `outage_reports`. Pipeline already de-dupes by ip_hash + time window, so this is defense-in-depth.

### Pattern 4: Background Fetch with Graceful Degradation

**What:** `expo-background-fetch` registers a task that runs every 15 minutes (iOS minimum) or as configured (Android). Task calls StatusSyncService. If fetch fails, cache serves stale data — no crash, no error state.

**Constraint:** iOS background fetch is at OS discretion — app cannot guarantee 15-min intervals. For Cocuyo, push notifications are the real-time signal; background fetch is for cache freshness only.

```typescript
TaskManager.defineTask(BACKGROUND_FETCH_TASK, async () => {
  try {
    await statusSyncService.sync()
    return BackgroundFetch.BackgroundFetchResult.NewData
  } catch {
    return BackgroundFetch.BackgroundFetchResult.Failed
  }
})
```

### Pattern 5: Notification State Machine

**What:** NotificationHandler manages three distinct states — foreground (app open), background (app running but not visible), killed (app not running). Each state requires different handling.

```
foreground:   → suppress OS notification, show in-app banner
              → update StatusCache immediately
              → trigger food timer auto-start if outage

background:   → OS shows system tray notification
              → App receives notification in background task
              → Update StatusCache silently

killed:       → OS shows system tray notification only
              → On user tap: app launches, notification data in getInitialNotificationAsync()
              → Deep link to affected region's card
```

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Direct FCM Integration (bypassing Expo)

**What:** Integrating Firebase Admin SDK directly into pipeline, managing FCM tokens natively, handling APNs separately.

**Why bad:** Doubles the token management complexity (FCM token + APNs token per device), requires platform-specific credentials in pipeline secrets, no benefit at Cocuyo's scale.

**Instead:** Use Expo Push Token + Expo Push Service. One token per device, one API endpoint for both platforms.

### Anti-Pattern 2: AsyncStorage for Report Queue

**What:** Using Expo's default AsyncStorage for persisting the pending report queue.

**Why bad:** AsyncStorage is async-only (risk of queue corruption on app kill mid-write), slower than MMKV, no atomic operations.

**Instead:** MMKV with JSON serialization. Reads are synchronous, writes are atomic per key.

### Anti-Pattern 3: Polling-Based Notification (WebSocket or long-poll)

**What:** Keeping a persistent connection to Supabase Realtime or a WebSocket to detect status changes.

**Why bad:** Battery drain is catastrophic in an app used during power outages (battery is precious). Realtime connections don't survive app backgrounding on iOS. Defeats the whole "battery-saving during outages" goal.

**Instead:** Push notifications for real-time alerts + background fetch for cache freshness. No persistent connections.

### Anti-Pattern 4: Storing Zone Subscription Server-Side per Notification

**What:** Sending zone-targeted pushes by having each notification check the pipeline's understanding of which users are in which zones.

**Why bad:** The pipeline has no user registry (app is anonymous). There is no "user" — only tokens with zone preferences.

**Instead:** `push_tokens` table stores zone_subscriptions as an array column. Pipeline queries `WHERE zone_subscriptions @> '["maracaibo"]'`. Simple, server-side, indexed.

### Anti-Pattern 5: GPS Coordinates in Push Tokens

**What:** Storing user GPS location in push_tokens for geo-targeted notifications.

**Why bad:** Privacy violation — persistent location record per device, even if token is anonymous. Venezuelan users are sensitive to surveillance. Defeats trust positioning.

**Instead:** User explicitly selects home zone ("Maracaibo"). Zone key stored in push_tokens.zone_subscriptions. No GPS data ever leaves the device for notification targeting.

---

## New Infrastructure: push_tokens Table

This is the only database schema addition required for the mobile app.

```sql
-- push_tokens: maps Expo push tokens to zone subscriptions
-- Upserted by app (anon), read by pipeline (service_role)
CREATE TABLE push_tokens (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  token         TEXT UNIQUE NOT NULL,           -- Expo push token
  zone_subscriptions TEXT[] NOT NULL DEFAULT '{}', -- e.g. {"maracaibo","caracas"}
  platform      TEXT CHECK (platform IN ('android', 'ios')),
  app_version   TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  last_seen_at  TIMESTAMPTZ DEFAULT now()       -- update on each app open
);

-- Index for pipeline query: "all tokens subscribed to zone X"
CREATE INDEX idx_push_tokens_zones ON push_tokens USING GIN (zone_subscriptions);

-- RLS: anon can upsert own token only; pipeline uses service_role
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_upsert_own_token" ON push_tokens
  FOR INSERT WITH CHECK (true);         -- INSERT open; UNIQUE constraint prevents duplication
CREATE POLICY "anon_update_own_token" ON push_tokens
  FOR UPDATE USING (true);              -- UPDATE open; token is the natural auth factor here

-- GRANT to anon role
GRANT INSERT, UPDATE ON push_tokens TO anon;
```

**Pipeline access:** service_role bypasses RLS — pipeline reads all tokens for zone queries, and deletes dead tokens after send receipts return `DeviceNotRegistered`.

---

## Scalability Considerations

| Concern | At 1K users | At 100K users | At 1M users |
|---------|-------------|---------------|-------------|
| push_tokens table size | Negligible | ~100K rows, trivial | ~1M rows — GIN index stays fast; partition by created_at if needed |
| Expo Push API rate limit | Free tier sufficient | Free tier sufficient (Expo: no documented rate limit for reasonable use) | May need direct FCM — evaluate at 500K tokens |
| Notify latency | <5s pipeline run | <30s for 100K token batching | Shard notify.py by region, run in parallel |
| Status.json CDN | Cloudflare R2 + CDN: effectively infinite read scale | Same | Same |
| Report queue (Supabase inserts) | RLS-gated inserts at 1K/10min window — Supabase free handles this | Same | Supabase Pro or Postgres connection pooling (pgBouncer) |
| Dead token accumulation | Cleanup after each notify run — trivial | Same — automated via receipt polling | Same |

---

## Pipeline Extension: notify.py Module

The pipeline's role expands in Phase 3. New responsibilities only; existing flow unchanged.

```
Existing:
  main.py → collectors → scorer → status.json → R2 upload

New (additive):
  main.py → [existing] → notify.py
  notify.py inputs:
    - current status.json (just written)
    - previous status.json (fetched from R2 before overwrite, or Supabase snapshot)
  notify.py logic:
    - For each region: compare previous_status vs current_status
    - Transition "normal" → "confirmed_outage": send "power out" push
    - Transition "confirmed_outage" → "normal": send "power restored" push
    - Transition any → "at_risk": send "watch out" push (optional, user-configurable)
  notify.py outputs:
    - Expo Push API calls (fire and forget, log errors)
    - Dead token deletions from push_tokens table
```

**Critical constraint:** notify.py must not block or error the main pipeline. Wrap in try/except, log failures, continue. Status.json upload must succeed even if notify fails.

---

## Sources

- Expo SDK 51/52 documentation (training data, cutoff Aug 2025) — MEDIUM confidence
- Expo push notifications architecture (training data) — MEDIUM confidence
- Firebase Cloud Messaging / APNs routing via Expo service — MEDIUM confidence
- Cocuyo existing architecture: `/docs/ARCHITECTURE.md` — HIGH confidence (read directly)
- MMKV vs AsyncStorage performance characteristics — MEDIUM confidence (well-documented tradeoff)
- Supabase RLS patterns — HIGH confidence (consistent with existing schema)

**Verify before Phase 3 implementation:**
- Current Expo Push Token API endpoint and request schema
- Expo SDK version pinning for `expo-notifications` (breaking changes between SDK 50→52)
- `expo-background-fetch` minimum interval on iOS (was 15 min as of SDK 50)
- Dead token receipt polling flow (Expo two-step receipt API)
