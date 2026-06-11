# Phase 2: Reporting + Sharing + Quick Wins — Pattern Map

**Mapped:** 2026-06-11
**Files analyzed:** 17 new/modified files
**Analogs found:** 17 / 17

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `mobile/lib/api.ts` (ADD submitReport) | service | request-response | `app/lib/api.ts:93-112` | exact |
| `mobile/lib/storage.ts` (ADD queue keys) | utility | CRUD | `mobile/lib/storage.ts` (self) | self-extend |
| `mobile/lib/queue.ts` (NEW) | service | event-driven | `mobile/lib/api.ts` + `mobile/hooks/useOffline.ts` | role-match |
| `mobile/lib/parroquias.ts` (NEW) | utility | transform | `mobile/lib/regions.ts` | exact |
| `mobile/lib/share.ts` (NEW) | utility | transform | `app/lib/api.ts:93-112` (pure fn pattern) | role-match |
| `mobile/hooks/useBattery.ts` (NEW) | hook | event-driven | `mobile/hooks/useOffline.ts` | exact |
| `mobile/hooks/useReportQueue.ts` (NEW) | hook | event-driven | `mobile/hooks/useOffline.ts` | exact |
| `mobile/hooks/useStatus.ts` (EXTEND: interval param) | hook | request-response | `mobile/hooks/useStatus.ts` (self) | self-extend |
| `mobile/contexts/ThemeContext.tsx` (EXTEND: amoled) | provider | CRUD | `mobile/contexts/ThemeContext.tsx` (self) | self-extend |
| `mobile/constants/colors.ts` (ADD AMOLED_THEME) | config | transform | `mobile/constants/colors.ts` (self) | self-extend |
| `mobile/components/Toast.tsx` (NEW) | component | event-driven | `mobile/components/StaleBanner.tsx` | exact |
| `mobile/components/BatteryBanner.tsx` (NEW) | component | event-driven | `mobile/components/StaleBanner.tsx` | exact |
| `mobile/components/ReportConfirmSheet.tsx` (NEW) | component | request-response | `mobile/components/SettingsModal.tsx` | exact |
| `mobile/components/ContactsCard.tsx` (NEW) | component | request-response | `mobile/components/SignalCard.tsx` | role-match |
| `mobile/components/SharePrompt.tsx` (NEW) | component | event-driven | `mobile/components/StaleBanner.tsx` | role-match |
| `mobile/app/(tabs)/report.tsx` (REPLACE placeholder) | component | request-response | `mobile/app/(tabs)/index.tsx` | exact |
| `mobile/app/(tabs)/index.tsx` (EXTEND: share + contacts) | component | request-response | `mobile/app/(tabs)/index.tsx` (self) | self-extend |
| `mobile/__tests__/lib/queue.test.ts` (NEW) | test | CRUD | `mobile/__tests__/lib/api.test.ts` | exact |
| `mobile/__tests__/lib/gps.test.ts` (NEW) | test | transform | `mobile/__tests__/lib/api.test.ts` | exact |
| `mobile/__tests__/lib/share.test.ts` (NEW) | test | transform | `mobile/__tests__/lib/api.test.ts` | exact |
| `mobile/__tests__/lib/amoled.test.ts` (NEW) | test | transform | `mobile/__tests__/lib/api.test.ts` | exact |
| `mobile/__tests__/lib/parroquias.test.ts` (NEW) | test | transform | `mobile/__tests__/lib/api.test.ts` | exact |
| `mobile/assets/parroquias.json` (NEW) | config | — | `mobile/lib/regions.ts` (structure) | role-match |
| `mobile/assets/contacts.json` (NEW) | config | — | `mobile/assets/` (bundled JSON pattern) | role-match |
| `mobile/jest.setup.js` (ADD new mocks) | config | — | `mobile/jest.setup.js` (self) | self-extend |
| `docs/schema.sql` (ADD parroquia column) | migration | CRUD | existing ALTER TABLE pattern | role-match |
| `docs/ARCHITECTURE.md` (UPDATE) | config | — | existing doc | self-extend |

---

## Pattern Assignments

### `mobile/lib/api.ts` — ADD `submitReport`

**Analog:** `app/lib/api.ts:68-112` (web submitReport)
**Also reference:** `mobile/lib/api.ts:1-93` (existing mobile fetchStatus structure)

**Existing mobile constant pattern** (`mobile/lib/api.ts:67-73`):
```typescript
// CDN URL read from app.json extra — set by EAS at build time.
// Falls back to the live production CDN URL (cocuyo.kralgor.com).
const STATUS_CDN_URL: string =
  (Constants.expoConfig?.extra?.statusCdnUrl as string | undefined) ??
  'https://cocuyo.kralgor.com/status.json';
```

**Pattern to copy — Supabase constants and headers** (`app/lib/api.ts:68-79`):
```typescript
const SUPABASE_URL    = process.env.NEXT_PUBLIC_SUPABASE_URL    ?? '';
const SUPABASE_KEY    = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

const HEADERS = {
  'Content-Type':  'application/json',
  'apikey':        SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Prefer':        'return=minimal',
};
```

**Adaptation for mobile** — replace `process.env` with `Constants.expoConfig?.extra`:
```typescript
const SUPABASE_URL = (Constants.expoConfig?.extra?.supabaseUrl as string) ?? '';
const SUPABASE_KEY = (Constants.expoConfig?.extra?.supabaseAnonKey as string) ?? '';
```

**Pattern to copy — submitReport function** (`app/lib/api.ts:93-112`):
```typescript
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
```

**Mobile addition:** extend payload type with `parroquia: string | null` and the full `ReportPayload` interface from RESEARCH.md Pattern 7. Keep `never-throw` contract from `fetchStatus` for queue path only; `submitReport` MAY throw (caller catches for queue retry).

**ADR comment to include** (`mobile/lib/storage.ts:8-12`):
```typescript
// ADR-007: Only SUPABASE_ANON_KEY in client apps. Phase 1 uses no Supabase at all.
// SUPABASE_ANON_KEY added in Phase 2 for report submission only.
// NEVER store SUPABASE_SERVICE_ROLE_KEY here — only anon key is permitted (ADR-007).
```

---

### `mobile/lib/storage.ts` — ADD queue keys + lastReportTime

**Analog:** `mobile/lib/storage.ts` (self-extend, lines 16-22)

**Existing STORAGE_KEYS pattern** (`mobile/lib/storage.ts:16-22`):
```typescript
export const STORAGE_KEYS = {
  hasSeenOnboarding: 'hasSeenOnboarding',          // boolean — trust screen shown once (D-08)
  selectedZone:      'selectedZone',               // string  — canonical region key from regions.ts
  themeOverride:     'themeOverride',              // 'light' | 'dark' | null (missing = follow system)
  cacheTimestamp:    'statusCacheTimestamp',       // number  — epoch ms of last successful fetchStatus()
} as const;
```

**Add these keys** (same format, append to object):
```typescript
  reportQueue:    'reportQueue',    // string  — JSON-serialized QueuedReport[]
  lastReportTime: 'lastReportTime', // number  — epoch ms of last enqueue (30-min dedup)
```

**Type extension for themeOverride** — update inline comment to `'light' | 'dark' | 'amoled' | null`.

---

### `mobile/lib/queue.ts` (NEW)

**Analog:** `mobile/lib/storage.ts` (MMKV pattern) + `mobile/hooks/useOffline.ts` (pure helper extraction pattern)

**MMKV read/write pattern** (`mobile/lib/storage.ts:1-12`):
```typescript
import { createMMKV } from 'react-native-mmkv';
export const storage = createMMKV({ id: 'cocuyo' });
```
Import `storage` and `STORAGE_KEYS` from `@/lib/storage` — never create a second MMKV instance.

**Pure helper + hook split pattern** (`mobile/hooks/useOffline.ts:16-28`):
```typescript
// Extracted so unit-testable without rendering the hook
export function computeStaleness(stored: number | undefined): {
  isStale: boolean;
  hasCache: boolean;
  ageMinutes: number;
} { ... }
```
Apply same pattern: put `getQueue`, `saveQueue`, `enqueue`, `dedupeCheck`, `flushQueue` as pure exportable functions in `queue.ts`; mount them via `useReportQueue` hook. Tests import the pure functions directly.

**Error handling pattern** (`mobile/lib/api.ts:80-92`):
```typescript
// Never throws — callers check the offline flag.
export async function fetchStatus(): Promise<{ data: StatusJson | null; offline: boolean }> {
  try { ... } catch { return { data: null, offline: true }; }
}
```
`flushQueue` must NOT throw — catch per-item and accumulate `remaining[]`, return `flushed` count.

**Section divider comment style** (`mobile/lib/storage.ts`):
```typescript
// ── queue helpers ──────────────────────────────────────────────────────────────
```

---

### `mobile/lib/parroquias.ts` (NEW)

**Analog:** `mobile/lib/regions.ts` (bundled data + typed lookup pattern)

**Typed const import + lookup pattern** (`mobile/lib/regions.ts:1-8, 13-16`):
```typescript
export interface RegionMeta {
  display_name: string;
  state:        string;
  lat:          number;
  lon:          number;
}
export const REGIONS: Record<string, RegionMeta> = { ... };
```

Apply same pattern: import `parroquias.json` as typed data; expose `getMunicipios(regionKey)` and `getParroquias(regionKey, municipio)` as named exports. Lookup via `REGIONS[regionKey]?.state` to translate zone key → state name (exactly as shown in RESEARCH.md Parroquia Dataset section). Return empty arrays on no-match — never null/undefined.

**Import pattern** (mirrors `mobile/lib/regions.ts:13`):
```typescript
import data from '@/assets/parroquias.json';
import { REGIONS } from '@/lib/regions';
```

---

### `mobile/lib/share.ts` (NEW)

**Analog:** Pure function pattern from `mobile/lib/regions.ts:151-167` (filterSections — pure export, no side effects)

**Pure function export pattern** (`mobile/lib/regions.ts:151-167`):
```typescript
export function filterSections(query: string): ZoneSection[] {
  if (!query) return ZONE_SECTIONS;
  ...
}
```

`composeShareText(region: RegionEntry, regionKey: string): string` follows same shape — pure function, no imports of hooks or RN APIs. Takes `RegionEntry` from `@/lib/api` (already imported everywhere). Omits ETA line when `region.outage?.estimated_restoration` is absent (CONTEXT.md honesty principle). Link target: `https://app.cocuyo.kralgor.com`.

`shareToWhatsApp(text: string): Promise<void>` is the side-effectful companion — import `{ Linking, Share }` from `react-native` and use pattern from RESEARCH.md Pattern 5.

---

### `mobile/hooks/useBattery.ts` (NEW)

**Analog:** `mobile/hooks/useOffline.ts` (event listener hook pattern)

**useEffect listener + cleanup pattern** (`mobile/hooks/useOffline.ts:44-57` structure; actual listener syntax from RESEARCH.md Pattern 4):
```typescript
import { useNetInfo } from '@react-native-community/netinfo';
import { storage, STORAGE_KEYS } from '@/lib/storage';

export function useOffline(): { ... } {
  const { isConnected } = useNetInfo();
  const stored = storage.getNumber(STORAGE_KEYS.cacheTimestamp);
  ...
}
```

`useBattery` follows same shape — `useState` for level, `useEffect` mounts listener, returns cleanup. Return `{ isBatterySaving: boolean; level: number }`. Guard `-1` (unavailable) as not-saving.

**Section divider + JSDoc comment style** (`mobile/hooks/useOffline.ts:30-37`):
```typescript
// ── useOffline ─────────────────────────────────────────────────────────────────
// Combines NetInfo connectivity state with MMKV cache age for offline/staleness detection.
// isStale=true when the last successful fetchStatus() was more than 15 minutes ago (STAT-03, D-13).
export function useOffline(): { ... }
```

---

### `mobile/hooks/useReportQueue.ts` (NEW)

**Analog:** `mobile/hooks/useOffline.ts` (dual listener pattern) + `mobile/app/_layout.tsx` (AppState usage)

**NetInfo addEventListener pattern** (`mobile/hooks/useOffline.ts:44` + RESEARCH.md Pattern 3):
```typescript
import { useNetInfo } from '@react-native-community/netinfo';
```

**AppState listener pattern** (`mobile/app/_layout.tsx` shows import pattern; actual pattern from RESEARCH.md Pattern 3):
```typescript
import { AppState } from 'react-native';
// ...
const sub = AppState.addEventListener('change', next => {
  if (next === 'active') { ... }
});
return () => { unsubNet(); sub.remove(); };
```

Hook exports `{ queueLength: number; isFlushing: boolean }` and internally calls `flushQueue` from `@/lib/queue`. Mount once in root layout or report screen — not both.

---

### `mobile/hooks/useStatus.ts` — EXTEND with refreshInterval param

**Analog:** `mobile/hooks/useStatus.ts` (self-extend, lines 1-42)

**Current useQuery pattern** (`mobile/hooks/useStatus.ts:1-42`):
```typescript
import { useQuery } from '@tanstack/react-query';
import { fetchStatus } from '@/lib/api';
import { storage, STORAGE_KEYS } from '@/lib/storage';

export function useStatus(): {
  data: StatusJson | null;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
} {
  const query = useQuery({
    queryKey: ['status'],
    queryFn: async (): Promise<StatusJson> => { ... },
  });
  ...
}
```

Add optional `refreshInterval?: number` parameter. When provided, pass as `refetchInterval` to `useQuery`. Callers pass `isBatterySaving ? 1_800_000 : 600_000` from `useBattery`. Default when not provided: `undefined` (existing behavior, query.ts defaults apply).

---

### `mobile/contexts/ThemeContext.tsx` — EXTEND with `'amoled'`

**Analog:** `mobile/contexts/ThemeContext.tsx` (self-extend, lines 1-60)

**Type and switch pattern** (`mobile/contexts/ThemeContext.tsx:9-31`):
```typescript
interface ThemeContextValue {
  theme: MobileTheme;
  override: 'light' | 'dark' | null;
  setOverride: (v: 'light' | 'dark' | null) => void;
}
// ...
const storedOverride = storage.getString(STORAGE_KEYS.themeOverride) as 'light' | 'dark' | null ?? null;
const [overrideState, setOverrideState] = useState<'light' | 'dark' | null>(storedOverride);

const effective = overrideState ?? systemScheme ?? 'dark';
const theme = effective === 'light' ? LIGHT_THEME : DARK_THEME;
```

Change union to `'light' | 'dark' | 'amoled' | null` everywhere — interface, useState generic, storedOverride cast, setOverride parameter. Update theme selection:
```typescript
const theme =
  effective === 'light'  ? LIGHT_THEME  :
  effective === 'amoled' ? AMOLED_THEME : DARK_THEME;
```

**MMKV remove pattern** (`mobile/contexts/ThemeContext.tsx:42-44`):
```typescript
// MMKV v4 uses remove() not delete() — per 01-01b deviation fix
storage.remove(STORAGE_KEYS.themeOverride);
```
Preserve this comment; it applies to null-setOverride path unchanged.

**Pitfall to avoid** (RESEARCH.md Pitfall 7): update type in STORAGE_KEYS comment in `storage.ts` atomically with ThemeContext change.

---

### `mobile/constants/colors.ts` — ADD `AMOLED_THEME`

**Analog:** `mobile/constants/colors.ts` (self-extend, lines 39-51)

**DARK_THEME spread pattern** (`mobile/constants/colors.ts:39-51`):
```typescript
export const DARK_THEME: MobileTheme = {
  bg:          '#0F0F0F',
  panel:       '#1A1A1A',
  ink:         '#F0EBE0',
  ...
};
```

Add after DARK_THEME:
```typescript
// ── AMOLED theme ───────────────────────────────────────────────────────────────
// True-black variant of DARK_THEME — OLED pixels off at #000000 = zero power draw.
// Extends DARK_THEME: only bg and panel change (all other tokens identical).
// Source: 02-CONTEXT.md BATT-01
export const AMOLED_THEME: MobileTheme = {
  ...DARK_THEME,
  bg:    '#000000',  // true black — OLED pixel off
  panel: '#0A0A0A',  // near-black panel separation
};
```

---

### `mobile/components/Toast.tsx` (NEW)

**Analog:** `mobile/components/StaleBanner.tsx` (full file — fixed-height banner with theme tokens)

**Banner structure pattern** (`mobile/components/StaleBanner.tsx:1-85`):
```typescript
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { getLocales } from 'expo-localization';
import { tt } from '@/lib/i18n';
import { useTheme } from '@/hooks/useTheme';

export default function StaleBanner({ ageMinutes }: StaleBannerProps) {
  const { theme } = useTheme();
  const lang      = detectLang();
  const styles    = createStyles(theme);
  return (
    <View style={styles.banner} accessibilityLiveRegion="polite">
      <Text style={styles.bannerText}>{bannerText}</Text>
    </View>
  );
}

function createStyles(theme: MobileTheme) {
  return StyleSheet.create({
    banner: {
      height:          40,
      width:           '100%',
      backgroundColor: theme.warn,
      alignItems:      'center',
      justifyContent:  'center',
    },
    bannerText: {
      fontSize:   13,
      fontWeight: '400',
      color:      theme.ink,
    },
  });
}
```

Toast differs: slide-up `Animated.Value` from bottom, `Pressable` dismiss, 4 variant colors (`ok`, `warn`, `danger`, `ink`), auto-dismiss after 3s. Use `useNativeDriver: true` for translate animation (same as index.tsx `SkeletonCard` pattern).

**Animated pattern** (`mobile/app/(tabs)/index.tsx:200-211`):
```typescript
const opacity = React.useRef(new Animated.Value(0.5)).current;
React.useEffect(() => {
  const anim = Animated.loop(
    Animated.sequence([
      Animated.timing(opacity, { toValue: 1.0, duration: 600, useNativeDriver: true }),
      ...
    ]),
  );
  anim.start();
  return () => anim.stop();
}, [opacity]);
```

---

### `mobile/components/BatteryBanner.tsx` (NEW)

**Analog:** `mobile/components/StaleBanner.tsx` (lines 1-85 — exact match in role and layout)

Copy `StaleBanner` structure exactly. Differences:
- Props: `{ onDismiss: () => void }` (dismissible — tappable for session override)
- Wrap in `Pressable` with `onPress={onDismiss}` (unlike StaleBanner which is non-dismissible)
- Text: "Modo ahorro activo" (i18n key `battery_saving_banner`)
- Background: `theme.warn` (same amber as StaleBanner)
- Add dismiss icon (Ionicons `close` 16dp, `theme.ink`, right side)

**Pressable pattern** (`mobile/components/ZonePicker.tsx:85-96`):
```typescript
<Pressable
  onPress={() => onSelect(key)}
  style={({ pressed }) => [styles.zoneRow, pressed && styles.zoneRowPressed]}
  accessibilityRole="button"
>
```

---

### `mobile/components/ReportConfirmSheet.tsx` (NEW)

**Analog:** `mobile/components/SettingsModal.tsx` (full file — bottom sheet, Modal, sections, Pressable rows)

**Modal + sheet layout pattern** (`mobile/components/SettingsModal.tsx:88-115`):
```typescript
return (
  <Modal
    visible={visible}
    transparent
    animationType="slide"
    onRequestClose={onClose}
    statusBarTranslucent
  >
    <Pressable style={styles.backdrop} onPress={onClose} />
    <View style={styles.sheet}>
      <View style={styles.handle} />
      <View style={styles.header}>
        <Text style={styles.title}>{tt('settings_title', lang)}</Text>
        <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button">
          <Ionicons name="close" size={24} color={theme.inkDim} />
        </Pressable>
      </View>
      <View style={styles.separator} />
      ...
    </View>
  </Modal>
);
```

**Sheet styles** (`mobile/components/SettingsModal.tsx:196-221`):
```typescript
backdrop: {
  flex:            1,
  backgroundColor: 'rgba(0,0,0,0.40)',
},
sheet: {
  position:        'absolute',
  bottom:          0,
  left:            0,
  right:           0,
  height:          '70%',
  backgroundColor: theme.panel,
  borderTopLeftRadius:  16,
  borderTopRightRadius: 16,
  paddingBottom:   24,
},
handle: {
  width:  36, height: 4, borderRadius: 2,
  backgroundColor: theme.lineStrong,
  alignSelf: 'center', marginTop: 8, marginBottom: 8,
},
```

`ReportConfirmSheet` shows: parroquia picker (cascading municipio → parroquia Picker rows), confirm CTA button (accent bg), cancel link. Props: `{ visible, region, status, onConfirm(parroquia: string | null), onClose }`.

---

### `mobile/components/ContactsCard.tsx` (NEW)

**Analog:** `mobile/components/SignalCard.tsx` (card panel pattern) + `mobile/components/SettingsModal.tsx` (Linking.openURL pattern)

**Card layout pattern** (`mobile/components/SignalCard.tsx:93-102`):
```typescript
function createStyles(theme: MobileTheme) {
  return StyleSheet.create({
    card: {
      backgroundColor: theme.panel,
      borderRadius:    8,
      padding:         16,
      marginBottom:    8,
    },
    ...
  });
}
```

**Linking.openURL pattern** (`mobile/components/SettingsModal.tsx:83-85`):
```typescript
async function handleGitHub() {
  await Linking.openURL(GITHUB_URL);
}
```

`ContactsCard` maps `contacts.json[state]` entries to tappable rows calling `Linking.openURL('tel:{number}')`. Section header "Números útiles" in Label 13sp inkDim. Tap row: 48dp height, `accessibilityRole="button"`, phone icon (Ionicons `call-outline`).

---

### `mobile/components/SharePrompt.tsx` (NEW)

**Analog:** `mobile/components/StaleBanner.tsx` (banner strip) for layout; `mobile/components/SettingsModal.tsx:83-85` for Linking pattern

This is an inline post-report prompt strip (not a modal). Two actions: "Compartir" (accent Pressable) + dismiss "✕". Calls `shareToWhatsApp` from `@/lib/share`. Auto-appears after successful submit; parent controls `visible` boolean prop.

**Pressable + icon row pattern** (`mobile/components/SettingsModal.tsx:173-183`):
```typescript
<Pressable
  style={styles.githubRow}
  onPress={handleGitHub}
  accessibilityRole="link"
>
  <Ionicons name="logo-github" size={18} color={theme.inkDim} />
  <Text style={styles.githubText}>{tt('settings_github', lang)}</Text>
</Pressable>
```

---

### `mobile/app/(tabs)/report.tsx` — REPLACE placeholder with ReportScreen

**Analog:** `mobile/app/(tabs)/index.tsx` (full file — primary tab screen pattern)

**Screen structure pattern** (`mobile/app/(tabs)/index.tsx:1-60`):
```typescript
import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { getLocales } from 'expo-localization';
import { useTheme }   from '@/hooks/useTheme';
import { storage, STORAGE_KEYS } from '@/lib/storage';
import { tt }         from '@/lib/i18n';
import type { Lang } from '@/lib/i18n';
import type { MobileTheme } from '@/lib/theme';

function detectLang(): Lang {
  const locales = getLocales();
  const primary = locales[0]?.languageCode ?? 'es';
  return primary === 'en' ? 'en' : 'es';
}

export default function ZoneScreen() {
  const { theme } = useTheme();
  const lang      = detectLang();
  ...
  const styles = createStyles(theme);
  return (
    <View style={styles.root}>
      ...
    </View>
  );
}
```

**State management pattern** (`mobile/app/(tabs)/index.tsx:59-65`):
```typescript
const [settingsOpen, setSettingsOpen] = useState(false);
const [refreshing,   setRefreshing]   = useState(false);
const selectedZone = storage.getString(STORAGE_KEYS.selectedZone) ?? '';
```

ReportScreen adds: GPS detection (async on tab focus), zone display + manual picker override, "Se fue la luz" / "Volvió la luz" Pressable buttons (large, 80dp min height, `theme.danger` / `theme.ok`), `ReportConfirmSheet` state, offline queue state, `Toast` state.

**Pull-to-refresh → handleRefresh pattern** (`mobile/app/(tabs)/index.tsx:68-76`):
```typescript
async function handleRefresh() {
  setRefreshing(true);
  try {
    await refetch();
  } finally {
    setRefreshing(false);
  }
}
```

---

### `mobile/app/(tabs)/index.tsx` — EXTEND with share button + ContactsCard

**Analog:** `mobile/app/(tabs)/index.tsx` (self-extend)

Add to imports: `{ shareToWhatsApp }` from `@/lib/share`, `ContactsCard` component.
Add share button to header row (alongside existing gear icon) — same `Pressable` + `Ionicons` pattern used for gear:
```typescript
// existing pattern (mobile/app/(tabs)/index.tsx:97-110):
<Pressable onPress={() => setSettingsOpen(true)} hitSlop={8} accessibilityRole="button">
  <Ionicons name="settings-outline" size={24} color={theme.inkDim} />
</Pressable>
```

Add `SharePrompt` below StatusHero (controlled by `showSharePrompt` state). Add `ContactsCard` at bottom of ScrollView content (below signal cards section, before last-updated row).

---

### Test files: `__tests__/lib/queue.test.ts`, `gps.test.ts`, `share.test.ts`, `amoled.test.ts`, `parroquias.test.ts`

**Analog:** `mobile/__tests__/lib/api.test.ts` (full file — canonical test structure)

**Test file structure pattern** (`mobile/__tests__/lib/api.test.ts:1-97`):
```typescript
/**
 * Tests for mobile/lib/api.ts
 * Covers: STAT-01 — fetchStatus() returns StatusJson from CDN, or offline flag on error
 */

import { fetchStatus } from '../../lib/api';

// ── fetch mock setup ───────────────────────────────────────────────────────────
const mockFetch = jest.fn();
global.fetch = mockFetch;

// ── mock expo-constants ────────────────────────────────────────────────────────
jest.mock('expo-constants', () => ({ ... }));

// ── helpers ────────────────────────────────────────────────────────────────────
function makeMockStatusJson() { ... }

// ── tests ──────────────────────────────────────────────────────────────────────
describe('fetchStatus', () => {
  beforeEach(() => { mockFetch.mockClear(); });

  it('returns { data: StatusJson, offline: false } on a 200 response', async () => { ... });
  it('never throws — caller always receives a result object', async () => { ... });
});
```

Each new test file follows this exact structure: doc comment at top, section-divider comments, `beforeEach` cleanup, one `describe` block per function, one `it` per behavior from the test map in RESEARCH.md Validation Architecture section.

**Mock additions needed in `jest.setup.js`** (append to file, same `jest.mock()` style as existing MMKV + NetInfo mocks):
```javascript
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  getCurrentPositionAsync: jest.fn(() => Promise.resolve({ coords: { latitude: 10.4806, longitude: -66.9036 } })),
  Accuracy: { Balanced: 3 },
}));

jest.mock('expo-battery', () => ({
  getBatteryLevelAsync: jest.fn(() => Promise.resolve(0.85)),
  addBatteryLevelListener: jest.fn(() => ({ remove: jest.fn() })),
}));

jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => 'mock-uuid-1234'),
}));
```

---

### `mobile/assets/parroquias.json` (NEW)

**Structure reference:** `mobile/lib/regions.ts` (grouped-by-state pattern)

File shape (from RESEARCH.md Parroquia Dataset):
```typescript
// ParroquiaDataset[]
[
  {
    "estado": "Zulia",
    "municipios": [
      { "municipio": "Maracaibo", "parroquias": ["Coquivacoa", "El Empedrado", ...] }
    ]
  }
]
```

State name strings must match `REGIONS[key].state` exactly (diacritics: `Táchira`, `Mérida`, `Falcón`, `Bolívar`, `Distrito Capital`, `Zulia`). Hand-author Zulia (21 municipios) and Distrito Capital (1 municipio: Libertador, 22 parroquias) entries — these are missing from zokeber source.

---

### `mobile/assets/contacts.json` (NEW)

No analog in codebase. Scaffold structure decided by Claude's discretion (CONTEXT.md):
```json
[
  {
    "state": "national",
    "entries": [
      { "name": "Emergencias", "number": "911", "verified": true },
      { "name": "Corpoelec nacional", "number": "0800-100-2727", "verified": true }
    ]
  },
  {
    "state": "Zulia",
    "entries": [
      { "name": "Corpoelec Zulia", "number": "", "verified": false }
    ]
  }
]
```

Key `state` matches `REGIONS[key].state` for lookup. `verified: false` entries marked "por verificar" — user fills per CONTEXT.md.

---

### `docs/schema.sql` — ADD parroquia migration

**No analog in mobile codebase.** SQL from RESEARCH.md Schema Change section:
```sql
-- 1. Add column (nullable — web continues sending null)
ALTER TABLE outage_reports ADD COLUMN IF NOT EXISTS parroquia TEXT;

-- 2. Grant INSERT on new column to anon role
--    (column-level GRANTs do NOT auto-extend to new columns — must be explicit)
GRANT INSERT (parroquia) ON outage_reports TO anon;
```

---

## Shared Patterns

### Theme Token Usage (all new components)
**Source:** `mobile/constants/colors.ts:1-51` + `mobile/components/SignalCard.tsx:93-139`
**Apply to:** All new components (Toast, BatteryBanner, ReportConfirmSheet, ContactsCard, SharePrompt, ReportScreen)
```typescript
// Pattern: createStyles(theme: MobileTheme) called inside component, not at module level
const styles = createStyles(theme);
// Never: const styles = StyleSheet.create({...}) at module level with theme values
```
Token mapping: `bg` = screen background (60%), `panel` = cards/modals/sheets (30%), `accent` = CTAs/active (10%). Status colors: `ok` = power back, `danger` = no power, `warn` = banners/unstable.

### i18n (all new components)
**Source:** `mobile/components/StaleBanner.tsx:9-14` + `mobile/components/ZonePicker.tsx:21-28`
**Apply to:** All new components that render text
```typescript
import { getLocales } from 'expo-localization';
import { tt } from '@/lib/i18n';
import type { Lang } from '@/lib/i18n';

function detectLang(): Lang {
  const locales = getLocales();
  const primary = locales[0]?.languageCode ?? 'es';
  return primary === 'en' ? 'en' : 'es';
}
```
Spanish-first: all user-facing strings via `tt(key, lang)`. Never hardcode Spanish text inline.

### Accessibility (all new interactive components)
**Source:** `mobile/components/ZonePicker.tsx:85-96` + `mobile/components/SettingsModal.tsx:106-114`
**Apply to:** All Pressable elements in new components
```typescript
<Pressable
  onPress={handler}
  hitSlop={8}
  accessibilityRole="button"
  accessibilityLabel={tt('key', lang)}
>
```
48dp minimum touch target for all interactive elements (ZonePicker row: `height: 48`).

### MMKV Access (all new hooks and lib functions)
**Source:** `mobile/lib/storage.ts:6-7` + `mobile/hooks/useOffline.ts:48`
**Apply to:** `queue.ts`, `useReportQueue.ts`, any new code reading MMKV
```typescript
// SAFE: createMMKV() at module level (bridge ready by import time)
export const storage = createMMKV({ id: 'cocuyo' });
// SAFE: storage.getString() inside hook body or function
// NOT SAFE: storage.getString() at module level outside a function
```

### Never-throw fetch (api.ts additions)
**Source:** `mobile/lib/api.ts:80-92`
**Apply to:** `submitReport` called from queue flush path
`submitReport` MAY throw (queue catches it). `fetchStatus` NEVER throws. Keep this asymmetry explicit with comments.

### StyleSheet.create pattern (all new components)
**Source:** `mobile/components/SignalCard.tsx:93` + `mobile/components/StaleBanner.tsx:63`
**Apply to:** All new components
```typescript
// Always: factory function receiving theme, called inside component
function createStyles(theme: MobileTheme) {
  return StyleSheet.create({ ... });
}
// Inside component:
const styles = createStyles(theme);
```

### Section divider comments
**Source:** `mobile/lib/storage.ts:3`, `mobile/hooks/useOffline.ts:4`, `mobile/lib/api.ts:3`
**Apply to:** All new files
```typescript
// ── section name ───────────────────────────────────────────────────────────────
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `mobile/lib/queue.ts` (flush side) | service | event-driven | No offline queue exists in Phase 1; pattern assembled from MMKV + NetInfo building blocks |
| `mobile/hooks/useReportQueue.ts` | hook | event-driven | AppState + NetInfo dual-listener combo is novel to Phase 2 |
| `mobile/assets/parroquias.json` | data | — | No nested geographic JSON exists; structure derived from zokeber source + RESEARCH.md spec |
| `mobile/assets/contacts.json` | data | — | No static bundled contact data exists; shape from Claude's discretion per CONTEXT.md |

For these files, use RESEARCH.md Patterns 2–3 (queue), Pattern 4 (battery listener hook), and the Parroquia Dataset section directly as implementation reference.

---

## Metadata

**Analog search scope:** `mobile/` (all subdirectories), `app/lib/api.ts` (web reference for submitReport)
**Files scanned:** 22 source files + 7 test/config files
**Pattern extraction date:** 2026-06-11
