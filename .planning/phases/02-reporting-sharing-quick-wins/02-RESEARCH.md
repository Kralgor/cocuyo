# Phase 2: Reporting + Sharing + Quick Wins — Research

**Researched:** 2026-06-11
**Domain:** React Native (Expo SDK 56) — reporting, offline queues, GPS, WhatsApp sharing, battery management
**Confidence:** HIGH (APIs verified via official Expo SDK 56 docs; package versions from npm registry)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Report Submission UX**
- Two big buttons on Report tab: "Se fue la luz" / "Volvió la luz" — one tap + confirm toast. Zero friction.
- GPS zone detect: on report-tab open, GPS resolves nearest of 17 zones, prefilled with manual picker override; 10s timeout falls back to saved zone. Location permission requested at first report, NOT during onboarding.
- Offline queue: MMKV-backed queue + NetInfo connectivity listener auto-sync + sync on app open. UI state: "Guardado — se enviará al volver la conexión".
- Parroquia tagging INCLUDED: optional cascading picker (municipio → parroquia) on report confirm. New nullable `parroquia` column on `outage_reports` (additive — web sends null). Schema change requires docs/ARCHITECTURE.md update.
- GPS→parroquia polygon auto-detect DEFERRED (needs bundled ADM3 polygons).
- Client-side dedupe: 1 report per ~30 min stored locally.

**WhatsApp Sharing**
- Format: pre-formatted Spanish text — status + duration + ETA + link. Image card (react-native-view-shot) is STRETCH only.
- Entry points: share button on zone hero + auto-prompt after report submit ("Avisa a tus vecinos").
- Link target: https://app.cocuyo.kralgor.com
- Channel: `Linking.openURL('whatsapp://send?text=')` with system Share.share() fallback.

**Emergency Contacts**
- Bundled static JSON per state: national numbers (911, Corpoelec national), per-state entries marked "por verificar".
- Placement: "Números útiles" card at bottom of Zone tab.
- Tap: `tel:` link opens dialer.
- Updates via EAS Update (bundled JSON, no CDN fetch).

**Battery + AMOLED**
- AMOLED: third theme variant extending DARK_THEME with #000000 bg / #0A0A0A panel.
- Low battery: expo-battery listener; below 20% → refresh interval 10min→30min, animations paused.
- Battery banner: "Modo ahorro activo", tappable session-dismiss.
- New deps allowed: expo-battery, @react-native-community/netinfo (already installed), expo-location.

### Claude's Discretion
- Exact toast/confirm visuals, queue retry backoff, share text wording polish, contacts JSON shape.

### Deferred Ideas (OUT OF SCOPE)
- GPS point-in-polygon parroquia auto-detect (needs geoBoundaries ADM3 bundle).
- Parroquia-level SCORED status (pipeline work, needs user density).
- Image share cards (react-native-view-shot) — stretch only.
- Raffle/incentive mechanics.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REPT-01 | User can submit an outage report with their zone auto-detected via GPS | expo-location `getCurrentPositionAsync` with `Promise.race` 10s timeout pattern; `requestForegroundPermissionsAsync` flow documented |
| REPT-02 | User can manually select their zone if GPS is denied or unavailable | Existing `ZonePicker` component + GPS timeout/denial fallback to `savedZone` MMKV key |
| REPT-03 | User can submit reports while offline, queued and synced when connectivity returns | MMKV-backed queue + NetInfo `addEventListener` + `AppState` foreground listener; idempotency key via expo-crypto `randomUUID()` |
| SHAR-01 | User can share outage status to WhatsApp with one tap (pre-formatted Spanish text) | `expo-linking` `openURL('whatsapp://send?text=')` + RN `Share.share()` fallback; URL encoding verified <4000 chars |
| BATT-01 | User can enable AMOLED true-black dark mode for battery conservation | AMOLED_THEME constant extending DARK_THEME; ThemeContext `override` type extended to include `'amoled'` |
| BATT-02 | App automatically reduces refresh frequency when device battery drops below 20% | `expo-battery` `addBatteryLevelListener` / `useBatteryLevel()` hook; threshold 0.20; interval 600_000→1_800_000ms |
| BATT-03 | User can view emergency contacts (utility company, emergency services) for their zone | Bundled `mobile/assets/contacts.json` keyed by state; `Linking.openURL('tel:')` |
</phase_requirements>

---

## Summary

Phase 2 adds the high-value user-facing features on top of the Phase 1 foundation: outage report submission (online and offline), WhatsApp sharing, emergency contacts, and battery conservation. All features use already-installed or Expo-ecosystem packages — no novel dependencies.

The dominant technical challenge is the **offline queue**: an MMKV-persisted array of `QueuedReport` objects, sync-triggered by NetInfo connectivity events and AppState foreground transitions. The key pitfall is distinguishing `isConnected` (network present) from `isInternetReachable` (actual internet vs. captive portal). The queue must use expo-crypto `randomUUID()` as an idempotency key to prevent double-submit on retry.

GPS auto-detect uses `expo-location` `getCurrentPositionAsync` wrapped in `Promise.race` with a 10s manual timeout — the API does not expose a timeout parameter and has a known Android hang bug (expo/expo#39851, reported September 2025, no fix confirmed in SDK 56). The haversine nearest-zone algorithm uses a 150km max-distance threshold, which correctly captures in-country users and Venezuelan diaspora in border cities while rejecting clearly foreign locations.

The parroquia dataset has a critical gap: both major open-source Venezuelan JSON repos (zokeber, CodersVenezuela) are missing Zulia and Distrito Capital — the two most important zones (Maracaibo, Caracas). The plan must include a task to curate a custom `mobile/assets/parroquias.json` combining the zokeber base with hand-authored Zulia and Distrito Capital data.

**Primary recommendation:** Follow the exact interface shapes in `02-UI-SPEC.md`. The code patterns below are drop-in implementations verified against SDK 56 docs.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Report submission (online) | Mobile client → Supabase REST | — | Same path as web: anon key POST to `outage_reports` |
| Offline report queue | Mobile client (MMKV) | NetInfo + AppState triggers | Queue never touches server until connectivity confirmed |
| GPS zone detection | Mobile client (expo-location) | — | One-shot foreground; no server needed |
| Parroquia picker data | Mobile client (bundled JSON asset) | — | Static data, no CDN fetch; ships with EAS Update |
| WhatsApp sharing | Mobile client (expo-linking) | RN Share API fallback | Deep link opens WhatsApp directly |
| Battery monitoring | Mobile client (expo-battery) | — | Device sensor; no server |
| Emergency contacts | Mobile client (bundled JSON asset) | — | Static per-state data; updates via OTA |
| Theme (AMOLED) | Mobile client (ThemeContext + MMKV) | — | Extends existing context; no backend |
| Schema migration (parroquia column) | Database (Supabase SQL) | — | Additive nullable column + column-level GRANT |

---

## Standard Stack

### Core (already installed in mobile/)
| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| `react-native-mmkv` | `^4.3.1` | Offline queue persistence | Already installed; `createMMKV` factory pattern |
| `@react-native-community/netinfo` | `12.0.1` | Connectivity detection + queue sync trigger | Already installed; `useNetInfo`, `addEventListener` |
| `expo-linking` | `~56.0.11` | WhatsApp `whatsapp://send?text=` deep link | Already installed |

### New This Phase
| Library | Version | Purpose | Registry Status |
|---------|---------|---------|----------------|
| `expo-location` | `~56.0.17` | GPS one-shot position for zone detection | [VERIFIED: npm registry — published 2026-06-10] |
| `expo-battery` | `~56.0.4` | Battery level listener for power-save mode | [VERIFIED: npm registry — published 2026-05-19] |
| `expo-crypto` | `~56.0.4` | `randomUUID()` for queue item idempotency keys | [VERIFIED: npm registry — published 2026-05-26] |

### React Native Built-in (no install)
| API | Purpose |
|-----|---------|
| `Share` (from `react-native`) | Fallback share sheet when WhatsApp absent |
| `AppState` (from `react-native`) | Trigger queue sync on app foreground |

**Installation:**
```bash
npx expo install expo-location expo-battery expo-crypto
```

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| expo-crypto randomUUID | `react-native-get-random-values` + uuid package | Extra deps; expo-crypto is already in SDK 56 |
| MMKV queue | AsyncStorage queue | 30x slower; sync reads unavailable |
| expo-battery | Manual AppState polling | No event-based threshold detection |

---

## Package Legitimacy Audit

> slopcheck unavailable in this environment (auto-mode sandbox denied install). All packages are Expo official or pre-approved.

| Package | Registry | Published | Downloads | Source Repo | Disposition |
|---------|----------|-----------|-----------|-------------|-------------|
| `expo-location` | npm | 2026-06-10 | Millions/wk (Expo official) | github.com/expo/expo | Approved — Expo official |
| `expo-battery` | npm | 2026-05-19 | Millions/wk (Expo official) | github.com/expo/expo | Approved — Expo official |
| `expo-crypto` | npm | 2026-05-26 | Millions/wk (Expo official) | github.com/expo/expo | Approved — Expo official |
| `@react-native-community/netinfo` | npm | 2026-02-14 | Millions/wk | github.com/react-native-netinfo | Approved — Phase 1 RESEARCH.md |

**Packages removed:** none
**Packages flagged:** none

All three new packages are published by the `expo` npm org (peerDependency `expo: '*'`), confirmed on npm registry. Same trust level as `expo-router`, `expo-constants` already in use.

---

## Architecture Patterns

### System Architecture Diagram

```
[User tap]
    │
    ▼
[ReportScreen]
    │── GPS resolving ──► expo-location.getCurrentPositionAsync()
    │                         │ (Promise.race 10s timeout)
    │                         ▼
    │                    nearestZone(17 coords, haversine, 150km max)
    │
    │── Confirm sheet ──► parroquia picker (bundled parroquias.json)
    │
    │── Submit ─────────► isConnected? (NetInfo)
    │                         │
    │                    YES  │  NO
    │                    ▼    │  ▼
    │              POST Supabase  MMKV queue.push(QueuedReport)
    │              /rest/v1/outage_reports  │
    │              (anon key)              │
    │                    │          [NetInfo onChange | AppState→active]
    │                    │                ▼
    │                    │          flushQueue() → POST each
    │                    ▼
    │              success → toast + share prompt
    │
[ZoneDetail screen]
    │── Share button ──► composeShareText(regionEntry)
    │                         ▼
    │               Linking.canOpenURL('whatsapp://send')
    │                    YES ▼        NO ▼
    │              Linking.openURL  Share.share({ message })
    │
    │── Contacts card ──► bundled contacts.json[state]
    │                         ▼
    │               Linking.openURL('tel:{number}')
    │
[Root layout]
    │── expo-battery ──► useBatteryLevel() < 0.20
    │                         ▼
    │               isBatterySaving = true
    │               useStatus interval: 600_000 → 1_800_000ms
    │               Animated.loop.stop()
    │               battery banner appears
```

### Recommended Project Structure (additions to Phase 1)
```
mobile/
├── assets/
│   ├── parroquias.json       # curated: zokeber 14 states + Zulia + DC
│   └── contacts.json         # emergency contacts per state
├── lib/
│   ├── api.ts                # ADD: submitReport() function
│   ├── storage.ts            # ADD: queue keys, STORAGE_KEYS.reportQueue + lastReportTime
│   ├── regions.ts            # unchanged
│   ├── parroquias.ts         # NEW: load + filter parroquias.json
│   └── queue.ts              # NEW: enqueueReport, flushQueue, dedupeCheck
├── hooks/
│   ├── useStatus.ts          # EXTEND: accept refreshInterval param
│   ├── useOffline.ts         # unchanged
│   ├── useBattery.ts         # NEW: expo-battery listener, isBatterySaving state
│   └── useReportQueue.ts     # NEW: queue state, flush trigger
├── constants/
│   └── colors.ts             # ADD: AMOLED_THEME constant
├── contexts/
│   └── ThemeContext.tsx      # EXTEND: 'amoled' override type + AMOLED_THEME branch
├── components/
│   ├── BatteryBanner.tsx     # NEW: 40dp warn strip, session dismiss
│   ├── Toast.tsx             # NEW: slide-up toast, 4 states
│   ├── ReportConfirmSheet.tsx # NEW: bottom sheet with parroquia picker
│   ├── ContactsCard.tsx      # NEW: "Números útiles" section
│   └── SharePrompt.tsx       # NEW: post-report inline prompt
└── app/(tabs)/
    ├── report.tsx            # REPLACE placeholder with full ReportScreen
    └── index.tsx             # EXTEND: share button, contacts card, share prompt
```

### Pattern 1: GPS Zone Detection with Timeout
**What:** Wrap `getCurrentPositionAsync` in `Promise.race` — the API has no timeout parameter and can hang indefinitely on Android (verified bug).
**When to use:** Every time report tab opens; permission already checked first.

```typescript
// Source: expo.dev/versions/v56.0.0/sdk/location + github.com/expo/expo/issues/39851
import * as Location from 'expo-location';
import { REGIONS } from '@/lib/regions';

const GPS_TIMEOUT_MS = 10_000;
const MAX_ZONE_DISTANCE_KM = 150;

async function detectNearestZone(): Promise<string | null> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') return null;

  let coords: { latitude: number; longitude: number } | null = null;
  try {
    const result = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('GPS timeout')), GPS_TIMEOUT_MS)
      ),
    ]);
    coords = result.coords;
  } catch {
    return null; // timeout or permission error — caller falls back to savedZone
  }

  return findNearestZone(coords.latitude, coords.longitude);
}

function findNearestZone(lat: number, lon: number): string | null {
  let best: string | null = null;
  let bestDist = Infinity;

  for (const [key, meta] of Object.entries(REGIONS)) {
    const d = haversineKm(lat, lon, meta.lat, meta.lon);
    if (d < bestDist) { bestDist = d; best = key; }
  }

  return bestDist <= MAX_ZONE_DISTANCE_KM ? best : null;
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const toRad = (deg: number) => (deg * Math.PI) / 180;
```

### Pattern 2: MMKV Offline Queue
**What:** Store pending reports as a JSON-serialized array in MMKV; flush on connectivity or foreground.
**When to use:** Every report submission path; caller checks connectivity first.

```typescript
// Source: react-native-mmkv v4 docs + NetInfo docs
import { storage, STORAGE_KEYS } from '@/lib/storage';
import { Crypto } from 'expo-crypto';
import type { ReportPayload, QueuedReport } from '@/lib/api';

const QUEUE_KEY = 'reportQueue';
const MAX_ATTEMPTS = 5;

function getQueue(): QueuedReport[] {
  const raw = storage.getString(QUEUE_KEY);
  if (!raw) return [];
  try { return JSON.parse(raw) as QueuedReport[]; } catch { return []; }
}

function saveQueue(queue: QueuedReport[]): void {
  storage.set(QUEUE_KEY, JSON.stringify(queue));
}

export function enqueue(payload: ReportPayload): string {
  const id = Crypto.randomUUID();
  const item: QueuedReport = { id, payload, queued_at: new Date().toISOString(), attempts: 0 };
  saveQueue([...getQueue(), item]);
  return id;
}

export async function flushQueue(submitFn: (p: ReportPayload) => Promise<void>): Promise<number> {
  const queue = getQueue();
  if (queue.length === 0) return 0;
  let flushed = 0;

  const remaining: QueuedReport[] = [];
  for (const item of queue) {
    if (item.attempts >= MAX_ATTEMPTS) continue; // discard permanently failed
    try {
      await submitFn(item.payload);
      flushed++;
    } catch {
      remaining.push({ ...item, attempts: item.attempts + 1 });
    }
  }
  saveQueue(remaining);
  return flushed;
}
```

### Pattern 3: NetInfo + AppState Queue Flush Hook
**What:** Two listeners trigger `flushQueue`: connectivity change to connected + app foregrounded.
**Pitfall:** Use `isInternetReachable` (not just `isConnected`) to guard against captive portals.

```typescript
// Source: @react-native-community/netinfo README + react-native AppState docs
import { useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { AppState } from 'react-native';
import { flushQueue } from '@/lib/queue';
import { submitReport } from '@/lib/api';

export function useSyncQueue() {
  useEffect(() => {
    // Trigger on connectivity change
    const unsubNet = NetInfo.addEventListener(state => {
      if (state.isConnected && state.isInternetReachable) {
        flushQueue(submitReport);
      }
    });

    // Trigger on app foreground
    const sub = AppState.addEventListener('change', next => {
      if (next === 'active') {
        NetInfo.fetch().then(state => {
          if (state.isConnected && state.isInternetReachable) {
            flushQueue(submitReport);
          }
        });
      }
    });

    return () => { unsubNet(); sub.remove(); };
  }, []);
}
```

### Pattern 4: Battery Level Listener
**What:** `addBatteryLevelListener` fires when level changes; threshold at 0.20.
**When to use:** Mount once in root layout.

```typescript
// Source: docs.expo.dev/versions/v56.0.0/sdk/battery/
import { useState, useEffect } from 'react';
import * as Battery from 'expo-battery';

export function useBattery(): { isBatterySaving: boolean; level: number } {
  const [level, setLevel] = useState(1.0);

  useEffect(() => {
    // Get initial level
    Battery.getBatteryLevelAsync().then(l => { if (l !== -1) setLevel(l); });

    // Listen for changes
    const sub = Battery.addBatteryLevelListener(({ batteryLevel }) => {
      if (batteryLevel !== -1) setLevel(batteryLevel);
    });

    return () => sub.remove();
  }, []);

  return { isBatterySaving: level < 0.20 && level !== -1, level };
}
```

### Pattern 5: WhatsApp Share + Fallback
**What:** Try WhatsApp deep link first; fall back to system share sheet.

```typescript
// Source: docs.expo.dev/versions/v56.0.0/sdk/linking/ + reactnative.dev/docs/share
import { Linking, Share } from 'react-native';

export async function shareToWhatsApp(text: string): Promise<void> {
  const encoded = encodeURIComponent(text);
  const url = `whatsapp://send?text=${encoded}`;

  const canOpen = await Linking.canOpenURL(url);
  if (canOpen) {
    await Linking.openURL(url);
  } else {
    await Share.share({ message: text });
  }
}
```

### Pattern 6: AMOLED Theme Extension
**What:** Extend ThemeContext to support `'amoled'` as a third override value.

```typescript
// Extend mobile/constants/colors.ts
import { DARK_THEME } from './colors';

export const AMOLED_THEME: MobileTheme = {
  ...DARK_THEME,
  bg:    '#000000',  // true black — OLED pixel off
  panel: '#0A0A0A',  // near-black panel separation
};

// Extend STORAGE_KEYS.themeOverride: 'light' | 'dark' | 'amoled' | null
// Extend ThemeContext override type: 'light' | 'dark' | 'amoled' | null
// In ThemeProvider: if (override === 'amoled') return AMOLED_THEME
```

### Pattern 7: Supabase submitReport (mobile)
**What:** Add `submitReport` to `mobile/lib/api.ts`. Payload matches `docs/schema.sql` + adds `parroquia`.

```typescript
// Source: app/lib/api.ts:94 (web reference) + 02-UI-SPEC.md TypeScript interfaces
import Constants from 'expo-constants';

const SUPABASE_URL  = (Constants.expoConfig?.extra?.supabaseUrl as string)  ?? '';
const SUPABASE_KEY  = (Constants.expoConfig?.extra?.supabaseAnonKey as string) ?? '';

const REPORT_HEADERS = {
  'Content-Type':  'application/json',
  'apikey':        SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Prefer':        'return=minimal',
};

export interface ReportPayload {
  region:             string;
  status:             'no_power' | 'power_back';
  lat:                number | null;
  lon:                number | null;
  city_freetext:      null;          // always null — mobile uses region key
  onset_type:         null;          // Phase 2: always null
  symptom:            null;          // Phase 2: always null
  device_fingerprint: null;          // ADR-005: deferred to Phase 4
  parroquia:          string | null; // NEW nullable column
}

export async function submitReport(payload: ReportPayload): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/outage_reports`, {
    method:  'POST',
    headers: REPORT_HEADERS,
    body:    JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}
```

### Anti-Patterns to Avoid
- **Using `isConnected` alone for flush trigger:** `isConnected: true` fires on captive portals (hotel WiFi redirect). Guard with `&& state.isInternetReachable`. [VERIFIED: netinfo README reachabilityUrl config]
- **Module-level MMKV reads:** `storage.getString()` at module top level crashes before bridge init. Read inside hooks/functions only. [Established: Phase 1 RESEARCH.md Pitfall 1]
- **No `Promise.race` on GPS:** `getCurrentPositionAsync` hangs indefinitely on Android after first launch. Always wrap with timeout. [VERIFIED: expo/expo#39851]
- **Omitting column GRANT for parroquia:** Adding a column via `ALTER TABLE` does NOT automatically extend existing column-level `GRANT INSERT` statements. Must explicitly add `GRANT INSERT (parroquia) ON outage_reports TO anon`. [CITED: PostgreSQL column privilege docs]
- **Double-submit without idempotency:** Queue items that partially succeed (request sent, response lost) will be retried. Use `expo-crypto randomUUID()` as queue item ID; consider idempotency key header on Supabase POST for future hardening.
- **Inventing ETAs in share text:** If `outage.estimated_restoration` is absent, omit the ETA line. Never generate a time estimate from the client. [Locked: CONTEXT.md honesty principle]

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Unique IDs for queue items | Custom timestamp-based ID | `expo-crypto.Crypto.randomUUID()` | UUIDs are collision-resistant; timestamps collide in rapid taps |
| GPS coordinate math | Custom trig | `haversineKm()` (4-line pure function) | Simple enough to inline; no dep needed |
| Connectivity detection | Custom ping | `@react-native-community/netinfo` (already installed) | Handles WiFi/cellular/VPN transitions natively |
| Battery events | `AppState` polling | `expo-battery addBatteryLevelListener` | Platform-native threshold events, no polling |
| Share sheet | Custom modal | `React Native Share.share()` | System sheet for all non-WhatsApp apps |
| WhatsApp deeplink | Custom URL scheme encoding | `Linking.openURL` + `encodeURIComponent` | Standard; URL length verified <4000 chars |

---

## Schema Change: `parroquia` Column

**Additive — does not break existing web or pipeline code.**

SQL to run once in Supabase SQL editor:
```sql
-- 1. Add column (nullable — web continues sending null)
ALTER TABLE outage_reports ADD COLUMN IF NOT EXISTS parroquia TEXT;

-- 2. Grant INSERT on new column to anon role
--    (column-level GRANTs do NOT auto-extend to new columns — must be explicit)
GRANT INSERT (parroquia) ON outage_reports TO anon;
```

**RLS policy unchanged.** The existing `anon_can_insert` policy uses `WITH CHECK (true)` — it does not restrict by column. The GRANT restriction is what limits which columns anon can write. Adding the GRANT is sufficient.

**Files requiring update:**
- `docs/schema.sql` — add ALTER TABLE + GRANT to idempotent schema
- `docs/ARCHITECTURE.md` — document new column (project rule: never modify schema without updating architecture doc)

---

## Parroquia Dataset

### Source
`github.com/zokeber/venezuela-json` (111KB raw JSON) provides municipio→parroquia data for 22 states. [CITED: github.com/zokeber/venezuela-json]

### Critical Gap
**Both major open-source Venezuelan JSON datasets (zokeber, CodersVenezuela) are MISSING Zulia and Distrito Capital.** [VERIFIED: fetched raw files]

- Zulia = Maracaibo zone (highest population, most reports)
- Distrito Capital = Caracas zone (capital city)
- Both datasets cover only 22 of 24 Venezuelan administrative divisions

### Resolution
**Curate a custom `mobile/assets/parroquias.json`** combining:
1. zokeber data filtered to the 14 Cocuyo-relevant states (Anzoátegui, Aragua, Barinas, Bolívar, Carabobo, Falcón, Lara, Mérida, Miranda, Monagas, Nueva Esparta, Sucre, Táchira, Trujillo)
2. Hand-authored Zulia entry (21 municipios, ~106 parroquias per venezuela npm docs)
3. Hand-authored Distrito Capital entry (1 municipio: Libertador, 22 parroquias per venezuela npm docs)

**File format** (matches zokeber structure, simplified):
```typescript
interface ParroquiaDataset {
  estado:    string;                           // matches REGIONS[key].state exactly
  municipios: { municipio: string; parroquias: string[] }[];
}
// File is ParroquiaDataset[]
```

**State name mapping** — use exact diacritics from REGIONS meta:
| REGIONS state | zokeber estado | Match? |
|--------------|----------------|--------|
| Táchira | Táchira | ✓ exact |
| Mérida | Mérida | ✓ exact |
| Falcón | Falcón | ✓ exact |
| Bolívar | Bolívar | ✓ exact |
| Distrito Capital | *(missing)* | Hand-author |
| Zulia | *(missing)* | Hand-author |

**Estimated size:** ~45KB raw, ~12-15KB gzip. Well within bundle budget.

**Lookup at runtime:**
```typescript
// mobile/lib/parroquias.ts
import data from '@/assets/parroquias.json';
import { REGIONS } from '@/lib/regions';

export function getMunicipios(regionKey: string): string[] {
  const state = REGIONS[regionKey]?.state;
  if (!state) return [];
  const entry = (data as ParroquiaDataset[]).find(d => d.estado === state);
  return entry?.municipios.map(m => m.municipio) ?? [];
}

export function getParroquias(regionKey: string, municipio: string): string[] {
  const state = REGIONS[regionKey]?.state;
  if (!state) return [];
  const entry = (data as ParroquiaDataset[]).find(d => d.estado === state);
  return entry?.municipios.find(m => m.municipio === municipio)?.parroquias ?? [];
}
```

---

## GPS Threshold Analysis

**Computed from actual 17 zone coordinates (haversine):**

| Metric | Value |
|--------|-------|
| Min closest-neighbor distance | 22 km (Caracas ↔ Los Teques) |
| Max inter-zone distance | 1057 km |
| Nearest-of-17 always unambiguous? | YES — lowest distance wins |
| Recommended max threshold | **150 km** |

**150 km threshold behavior:**
- Venezuelan urban users (zone centers): ✓ assigns correctly (<50km)
- Venezuelan rural users: ✓ assigns to nearest (unless truly remote)
- Cucuta, Colombia (Venezuelan diaspora border city): ✓ assigns san_cristobal (34km)
- Bogota, Colombia: ✗ rejects (396km > 150km) → falls back to savedZone
- Boa Vista, Brazil: ✗ rejects (654km) → falls back to savedZone

**The threshold does NOT resolve tie-breaking** (nearest-of-17 always has one winner). It only determines whether the nearest zone is close enough to auto-assign.

---

## Expo SDK 56 — Verified API Notes

### expo-location `56.0.17` [VERIFIED: docs.expo.dev/versions/v56.0.0/sdk/location/]
- `requestForegroundPermissionsAsync()` — returns `{ status: 'granted' | 'denied' | 'undetermined' }`
- `getCurrentPositionAsync(options)` — `LocationOptions.accuracy` enum, NO timeout parameter
- **Known hang bug (Android):** After first launch, can hang indefinitely. `Promise.race` workaround is the only documented solution. (expo/expo#39851, SDK 53 report, status unknown in SDK 56)
- `Accuracy` enum: `Lowest(1)` / `Low(2)` / `Balanced(3)` / `High(4)` / `Highest(5)` / `BestForNavigation(6)`
- Use `Accuracy.Balanced` for zone detection (100m precision, faster resolution)
- Foreground permission only needed for `getCurrentPositionAsync`
- app.json plugin entry required for custom permission message strings (optional but recommended for trust)

```json
// app.json plugin entry for custom permission copy
["expo-location", {
  "locationWhenInUsePermission": "Cocuyo usa tu ubicación para detectar tu zona automáticamente."
}]
```

### expo-battery `56.0.4` [VERIFIED: docs.expo.dev/versions/v56.0.0/sdk/battery/]
- `getBatteryLevelAsync()` — returns 0.0–1.0 or -1 (unavailable)
- `addBatteryLevelListener(callback)` — fires on Android at significant thresholds; iOS fires on 1%+ drop (max once/minute); web never fires
- `useBatteryLevel()` hook available
- No app.json plugin entry required
- `BatteryState.UNPLUGGED(1)`, `CHARGING(2)`, `FULL(3)`, `NOT_CHARGING(4)` (Android only), `UNKNOWN(0)`

### @react-native-community/netinfo `12.0.1` [VERIFIED: npm registry 2026-02-14]
- Already installed. `useNetInfo()` hook available.
- Key: `state.isConnected` — network present (true even on captive portals)
- Key: `state.isInternetReachable` — actual internet (false on captive portals; checks `clients3.google.com/generate_204`)
- **Always use both:** `isConnected && isInternetReachable` for flush gate
- `NetInfo.addEventListener(callback)` — unsubscribe by calling returned function
- `NetInfo.fetch()` — one-shot current state

### expo-linking `56.0.11` [VERIFIED: docs.expo.dev/versions/v56.0.0/sdk/linking/]
- `Linking.canOpenURL(url)` — returns `Promise<boolean>`; on web always `true`
- `Linking.openURL(url)` — opens registered scheme handler
- WhatsApp URL: `whatsapp://send?text={encodeURIComponent(shareText)}` — URL length tested <200 chars for typical share text

### React Native `Share` API [VERIFIED: reactnative.dev/docs/share]
- `Share.share({ message: string })` — opens system share sheet
- Returns `Promise<{ action: string; activityType?: string }>`
- Works on both iOS and Android
- Used as fallback when WhatsApp not installed

### expo-crypto `56.0.4` [VERIFIED: docs.expo.dev/versions/v56.0.0/sdk/crypto/]
- `Crypto.randomUUID()` — returns UUIDv4 string; cryptographically secure
- **Required:** `crypto.randomUUID` is NOT natively available in Hermes (RN 0.85). Use `expo-crypto` instead of global `crypto.randomUUID()`.
- No app.json plugin entry required

---

## Common Pitfalls

### Pitfall 1: GPS Hang on Android (repeat launch)
**What goes wrong:** `getCurrentPositionAsync` never resolves on Android after the first app launch. The report screen waits forever.
**Why it happens:** Reported expo bug (expo/expo#39851, September 2025); believed to be initialization timing in the location manager. No official fix confirmed for SDK 56.
**How to avoid:** Always use `Promise.race` with a 10s timeout. On timeout, treat as denied: show "select manually" UI, fall back to `savedZone`.
**Warning signs:** GPS strip stays in "Detectando…" state past 5 seconds during testing on Android.

### Pitfall 2: isConnected vs isInternetReachable (captive portal false positive)
**What goes wrong:** Queue flush fires on hotel WiFi / Cantv captive portal. POST request reaches a redirect page that returns 200, but Supabase wasn't actually reached. The Supabase client throws on non-JSON response.
**Why it happens:** `isConnected: true` means a network interface is active, not that the internet is reachable.
**How to avoid:** Gate queue flush on `state.isConnected && state.isInternetReachable`. The netinfo library checks `clients3.google.com/generate_204` by default.
**Warning signs:** Reports appear to succeed (no error) but don't appear in Supabase.

### Pitfall 3: Missing GRANT for `parroquia` column
**What goes wrong:** `parroquia` value submitted by mobile client is silently dropped or causes a 403. The anon INSERT policy allows the row but the column GRANT controls which columns can be populated.
**Why it happens:** PostgreSQL column-level `GRANT INSERT (col_list)` does NOT auto-extend to new columns added by `ALTER TABLE`. The column exists in the table but anon has no INSERT privilege on it.
**How to avoid:** Always run `GRANT INSERT (parroquia) ON outage_reports TO anon` as part of the migration. Verify by testing anon INSERT with `parroquia` value in Supabase SQL editor.
**Warning signs:** Supabase returns 201 (insert accepted) but `parroquia` column is NULL for all mobile-submitted rows.

### Pitfall 4: Double-submit from queue retry
**What goes wrong:** A report is POST-ed to Supabase (request transmitted), but the response is lost (network drop). Queue retries and sends a second report.
**Why it happens:** MMKV queue doesn't know if the server received the request.
**How to avoid:** Use `expo-crypto randomUUID()` as queue item `id`. Client-side dedupe: check `STORAGE_KEYS.lastReportTime` before enqueue (30-min cooldown prevents most duplicate submits). Server-side: Supabase's IP rate limiter and the pipeline's IP deduplication provide additional protection.
**Warning signs:** User sees "Ya reportaste hace 0 min" even though they only tapped once.

### Pitfall 5: Parroquia dataset Zulia/DC missing
**What goes wrong:** `getMunicipios('maracaibo')` returns empty array. Parroquia picker shows nothing for Venezuela's largest zone.
**Why it happens:** Both public Venezuelan JSON datasets (zokeber, CodersVenezuela) omit Zulia and Distrito Capital.
**How to avoid:** The plan must include a dedicated task to hand-author these two state entries in `parroquias.json` before any parroquia picker code is written.
**Warning signs:** Picker shows empty list for maracaibo / caracas / los_teques / guarenas_guatire zones.

### Pitfall 6: app.json not updated for expo-location plugin
**What goes wrong:** EAS Build succeeds but the iOS permission dialog shows a generic system string instead of the Spanish app copy. Trust signal degraded.
**Why it happens:** expo-location plugin config controls the `NSLocationWhenInUseUsageDescription` pstring in Info.plist.
**How to avoid:** Add expo-location plugin entry in `app.json` with `locationWhenInUsePermission` in Spanish before first EAS Build that uses location.

### Pitfall 7: ThemeContext `'amoled'` override breaks MMKV key type
**What goes wrong:** Existing code reads `STORAGE_KEYS.themeOverride` and casts to `'light' | 'dark' | null`. After adding `'amoled'`, the stored value `'amoled'` falls through to `null` (no match) and theme reverts to system default.
**Why it happens:** `ThemeContext.tsx:27` casts `storage.getString(...)` to `'light' | 'dark' | null`. Adding `'amoled'` requires updating both the type and the switch/conditional in the provider.
**How to avoid:** Update the union type in ThemeContext, STORAGE_KEYS comment, and the theme selection logic atomically. Test by selecting AMOLED, backgrounding and reopening the app.

---

## State of the Art

| Old Approach | Current Approach | Notes |
|--------------|------------------|-------|
| AsyncStorage offline queue | MMKV queue (already established) | 30x faster, synchronous reads |
| Global `crypto.randomUUID()` | `expo-crypto.Crypto.randomUUID()` | Hermes doesn't polyfill global crypto |
| Manual dark theme only | Dark + AMOLED variant | AMOLED pixels off = zero power draw |
| Static refresh interval | Battery-adaptive interval | expo-battery listener pattern |

**Deprecated/outdated:**
- `react-native-community/netinfo` v9/v10 APIs: v12 (current) removed some legacy APIs. Don't copy patterns from old Stack Overflow answers.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | expo/expo#39851 GPS hang bug not fixed in SDK 56 | GPS Pattern | If fixed, `Promise.race` is still harmless but the warning in pitfall 1 is unnecessary |
| A2 | `isInternetReachable` is `null` (unknown) briefly after connectivity change before the reachability check completes | Queue pitfall | Queue flush fires on captive portal if `null` treated as `true`; guard should be `=== true` not truthy |
| A3 | Zulia has 21 municipios and ~106 parroquias | Parroquia dataset | If count is wrong, picker needs more/fewer rows — data only, no code change |
| A4 | Distrito Capital has 1 municipio (Libertador) and 22 parroquias | Parroquia dataset | Same as A3 |
| A5 | Column-level GRANT in Supabase (which uses PostgreSQL) does not auto-extend to new columns | Schema change | If wrong, GRANT step is harmless redundancy |

---

## Open Questions

1. **Zulia/DC parroquia accuracy**
   - What we know: `venezuela` npm package mentions Zulia (21 municipios, 106 parroquias) and Distrito Capital (Libertador, 22 parroquias)
   - What's unclear: Exact parroquia names for both — need to extract from `venezuela` npm package data files or another authoritative source
   - Recommendation: Wave 0 task — extract and include in `parroquias.json` before any picker code is written

2. **isInternetReachable null guard**
   - What we know: Returns `null` when state is unknown (initial state before first check)
   - What's unclear: How long the null period lasts in practice on connectivity change
   - Recommendation: Gate flush on `state.isInternetReachable === true` (strict equality, not truthy) to exclude null

3. **Emergency contacts content**
   - What we know: National: 911, Corpoelec national number. Per-state: marked "por verificar" per CONTEXT.md; research is a USER task (STATE.md blocker)
   - What's unclear: Corpoelec per-state numbers, regional emergency lines
   - Recommendation: Scaffold `contacts.json` with national entries and empty per-state arrays marked `verified: false`; user fills in per-state during or after Phase 2

4. **Supabase anon key in app.json extra**
   - What we know: Web uses `NEXT_PUBLIC_SUPABASE_ANON_KEY` env var at build time; mobile uses `Constants.expoConfig.extra`
   - What's unclear: EAS secret vs. app.json plain extra for anon key (anon key is public by design per ADR-007, so plain extra is acceptable)
   - Recommendation: Add `supabaseUrl` and `supabaseAnonKey` to `app.json extra` section (same pattern as `statusCdnUrl`)

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| expo-location | REPT-01 GPS detection | ✗ (not installed) | — | Install: `npx expo install expo-location` |
| expo-battery | BATT-02 level listener | ✗ (not installed) | — | Install: `npx expo install expo-battery` |
| expo-crypto | REPT-03 queue item UUID | ✗ (not installed) | — | Install: `npx expo install expo-crypto` |
| @react-native-community/netinfo | REPT-03 connectivity | ✓ | 12.0.1 | Already installed (Phase 1) |
| expo-linking | SHAR-01 WhatsApp | ✓ | ~56.0.11 | Already installed (Phase 1) |
| React Native Share | SHAR-01 fallback | ✓ | Built-in RN 0.85 | No install needed |
| Supabase project | REPT-01/02/03 | ✓ (Phase 1 verified) | — | Env vars: `supabaseUrl`, `supabaseAnonKey` |
| EAS project | BATT-03 OTA updates | ✓ | Configured in app.json | — |

**Missing with install fallback (no blockers):** expo-location, expo-battery, expo-crypto — all install via `npx expo install`.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | jest-expo `~56.0.4` |
| Config file | `mobile/jest.config.js` (exists) |
| Setup file | `mobile/jest.setup.js` (mocks MMKV + NetInfo) |
| Quick run command | `cd mobile && npx jest --testPathPattern="__tests__/lib/queue" --passWithNoTests` |
| Full suite command | `cd mobile && npx jest --passWithNoTests` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REPT-01 | `findNearestZone` returns correct zone key for lat/lon; returns null beyond 150km | unit | `npx jest --testPathPattern="queue|regions"` | ❌ Wave 0: `__tests__/lib/gps.test.ts` |
| REPT-01 | `detectNearestZone` falls back to null on GPS timeout (mock `expo-location` hang) | unit | same | ❌ Wave 0 |
| REPT-02 | `savedZone` fallback used when GPS returns null | unit | same | ❌ Wave 0 |
| REPT-03 | `enqueue` stores item in MMKV with UUID | unit | `npx jest --testPathPattern="queue"` | ❌ Wave 0: `__tests__/lib/queue.test.ts` |
| REPT-03 | `flushQueue` removes items on success, increments attempts on failure | unit | same | ❌ Wave 0 |
| REPT-03 | `flushQueue` discards items after MAX_ATTEMPTS | unit | same | ❌ Wave 0 |
| REPT-03 | 30-min cooldown prevents second enqueue within window | unit | same | ❌ Wave 0 |
| SHAR-01 | `composeShareText` omits ETA line when `outage_estimate` absent | unit | `npx jest --testPathPattern="share"` | ❌ Wave 0: `__tests__/lib/share.test.ts` |
| SHAR-01 | `composeShareText` includes duration line when `started_at` present | unit | same | ❌ Wave 0 |
| BATT-01 | AMOLED_THEME has `bg: '#000000'` and inherits all other DARK_THEME tokens | unit | `npx jest --testPathPattern="theme"` | ❌ Wave 0: `__tests__/lib/amoled.test.ts` |
| BATT-02 | `useBattery` returns `isBatterySaving: true` when level < 0.20 | unit | same | ❌ Wave 0 |
| BATT-02 | `useBattery` returns `isBatterySaving: false` when level = -1 (unavailable) | unit | same | ❌ Wave 0 |
| BATT-03 | `getMunicipios` returns empty array for unknown regionKey | unit | `npx jest --testPathPattern="parroquias"` | ❌ Wave 0: `__tests__/lib/parroquias.test.ts` |
| BATT-03 | `getParroquias` returns string array for valid (regionKey, municipio) | unit | same | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `cd mobile && npx jest --testPathPattern="__tests__/lib/(queue|gps|share|amoled|parroquias)" --passWithNoTests`
- **Per wave merge:** `cd mobile && npx jest --passWithNoTests`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `mobile/__tests__/lib/queue.test.ts` — covers REPT-03 queue logic
- [ ] `mobile/__tests__/lib/gps.test.ts` — covers REPT-01/02 haversine + timeout
- [ ] `mobile/__tests__/lib/share.test.ts` — covers SHAR-01 text composition
- [ ] `mobile/__tests__/lib/amoled.test.ts` — covers BATT-01/02 theme + battery hook
- [ ] `mobile/__tests__/lib/parroquias.test.ts` — covers BATT-03 data lookup

**jest.setup.js additions needed for new mocks:**
```javascript
// expo-location mock
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  getCurrentPositionAsync: jest.fn(() => Promise.resolve({ coords: { latitude: 10.4806, longitude: -66.9036 } })),
  Accuracy: { Balanced: 3 },
}));

// expo-battery mock
jest.mock('expo-battery', () => ({
  getBatteryLevelAsync: jest.fn(() => Promise.resolve(0.85)),
  addBatteryLevelListener: jest.fn(() => ({ remove: jest.fn() })),
}));

// expo-crypto mock
jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => 'mock-uuid-1234'),
}));
```

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | App is fully anonymous (ADR-007) |
| V3 Session Management | No | No sessions — stateless anonymous reports |
| V4 Access Control | Yes | Supabase RLS `anon_can_insert` policy + column-level GRANTs enforce what anon can write |
| V5 Input Validation | Yes | `status` must be `'no_power' | 'power_back'` (TypeScript union + Supabase CHECK constraint enforces at DB level); parroquia is free text nullable — no injection risk via PostgREST parameterized queries |
| V6 Cryptography | Yes | `expo-crypto randomUUID()` — cryptographically secure; never hand-roll UUID |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Report spam / manipulation | Tampering | IP rate limiting via `ip_hash` trigger (existing); client-side 30-min cooldown; PostgREST anon key only |
| Parroquia injection | Tampering | PostgREST uses parameterized binding — no SQL injection via REST body |
| Service role key exposure | Information Disclosure | ADR-007: only `SUPABASE_ANON_KEY` in mobile app; never `SERVICE_ROLE_KEY`; key goes in `app.json extra` (public by design) |
| GPS spoofing → zone falsification | Tampering | GPS coordinates are optional metadata; pipeline uses IP geolocation as ground truth for validation |

---

## Project Constraints (from CLAUDE.md)

| Directive | Impact on Phase 2 |
|-----------|-------------------|
| `Never hardcode API keys` | `supabaseAnonKey` → `app.json extra` (EAS build var), read via `Constants.expoConfig.extra` |
| `Never use service_role key in frontend/mobile code` (ADR-007) | Report submission uses anon key only |
| `device_fingerprint: null until Phase 4` (ADR-005) | `ReportPayload.device_fingerprint` is always `null` |
| `Never run dev server or deploy during coding session` | Tests only; no `expo start` |
| `Never modify database schema without updating docs/ARCHITECTURE.md` | Schema change task must include ARCHITECTURE.md update |
| `Dependencies: do not add without asking` | Phase 2 adds only expo-battery, expo-location, expo-crypto — all pre-approved in CONTEXT.md |
| `Outage status values: 'no_power' | 'power_back' | 'unstable'` | ReportPayload.status restricted to `'no_power' | 'power_back'` (not 'unstable') |
| `TypeScript: strict mode, no any types` | All new interfaces fully typed |
| `React: functional components only` | All new components functional |
| `Never change static JSON architecture` | No new CDN fetch — contacts.json and parroquias.json are bundled assets |

---

## Sources

### Primary (HIGH confidence)
- `docs.expo.dev/versions/v56.0.0/sdk/location/` — expo-location SDK 56 API, permissions, accuracy enum
- `docs.expo.dev/versions/v56.0.0/sdk/battery/` — expo-battery SDK 56 API, hooks, listeners
- `docs.expo.dev/versions/v56.0.0/sdk/linking/` — canOpenURL, openURL
- `docs.expo.dev/versions/v56.0.0/sdk/crypto/` — randomUUID, SDK 56 inclusion confirmed
- `docs.expo.dev/versions/v56.0.0/sdk/netinfo/` — isConnected, isInternetReachable, addEventListener
- `reactnative.dev/docs/share` — Share.share API, iOS/Android behavior
- `npm registry (npm view)` — package versions: expo-location@56.0.17, expo-battery@56.0.4, expo-crypto@56.0.4, netinfo@12.0.1
- `raw.githubusercontent.com/zokeber/venezuela-json/master/venezuela.json` — dataset structure, 22-state coverage, missing Zulia+DC confirmed
- `raw.githubusercontent.com/CodersVenezuela/Venezuela-JSON/master/venezuela.json` — cross-verified: also missing Zulia+DC

### Secondary (MEDIUM confidence)
- `github.com/expo/expo/issues/39851` — GPS hang bug report (SDK 53, closed without confirmed fix)
- `github.com/react-native-netinfo/react-native-netinfo README` — isInternetReachable, reachabilityUrl
- `expo.dev/changelog/sdk-56` — SDK 56 changes (no breaking changes to location/battery/netinfo)
- `app.unpkg.com/venezuela@2.0.0/files/DOCUMENTACION.md` — Zulia (21 municipios, 106 parroquias) and DC counts

### Tertiary (LOW confidence, verify before use)
- PostgreSQL column GRANT behavior on ALTER TABLE ADD COLUMN — tested reasoning from PostgreSQL docs; not directly verified by running SQL against Supabase

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified on npm registry at SDK 56 versions
- Architecture: HIGH — directly derived from CONTEXT.md locked decisions and existing Phase 1 code patterns
- GPS/Battery APIs: HIGH — verified against SDK 56 official docs
- Parroquia dataset: HIGH — raw files fetched; gap confirmed empirically
- GPS threshold: HIGH — computed from actual coordinates
- Pitfalls: MEDIUM-HIGH — GPS hang verified via GitHub issue; column GRANT behavior from docs reasoning

**Research date:** 2026-06-11
**Valid until:** 2026-07-11 (30 days — Expo SDK versions stable; parroquia data static)
