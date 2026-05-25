# Phase 1: Foundation + Offline Core - Pattern Map

**Mapped:** 2026-05-25
**Files analyzed:** 18 new files
**Analogs found:** 14 / 18

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `mobile/app/_layout.tsx` | provider / root layout | request-response | `app/contexts/AppContext.tsx` | role-match |
| `mobile/app/onboarding.tsx` | component / screen | request-response | `app/pages/index.tsx` | partial |
| `mobile/app/zone-picker.tsx` | component / screen | request-response | `app/pages/index.tsx` | partial |
| `mobile/app/(tabs)/_layout.tsx` | config / nav layout | request-response | `app/components/mobile/MobileShell.tsx` | role-match |
| `mobile/app/(tabs)/index.tsx` | component / screen | request-response | `app/pages/index.tsx` | role-match |
| `mobile/app/(tabs)/report.tsx` | component / placeholder | — | `app/pages/index.tsx` | partial |
| `mobile/app/(tabs)/notify.tsx` | component / placeholder | — | none | no-analog |
| `mobile/app/(tabs)/food.tsx` | component / placeholder | — | none | no-analog |
| `mobile/app/(tabs)/history.tsx` | component / placeholder | — | none | no-analog |
| `mobile/lib/api.ts` | utility | request-response | `app/lib/api.ts` | exact |
| `mobile/lib/storage.ts` | utility | CRUD | `app/contexts/AppContext.tsx` | partial |
| `mobile/lib/query.ts` | config | event-driven | `app/lib/api.ts` (useAutoRefresh) | role-match |
| `mobile/lib/regions.ts` | utility / config | — | `pipeline/regions.py` | exact |
| `mobile/lib/i18n.ts` | utility | transform | `app/lib/i18n.ts` | exact |
| `mobile/lib/theme.ts` | utility / config | — | `app/lib/theme.ts` | role-match |
| `mobile/contexts/ThemeContext.tsx` | provider | event-driven | `app/contexts/AppContext.tsx` | exact |
| `mobile/hooks/useStatus.ts` | hook | request-response | `app/lib/api.ts` (useAutoRefresh) | role-match |
| `mobile/hooks/useOffline.ts` | hook | event-driven | `app/lib/api.ts` (useAutoRefresh offline detection) | role-match |
| `mobile/hooks/useTheme.ts` | hook | — | `app/contexts/AppContext.tsx` (useApp) | exact |
| `mobile/components/StatusHero.tsx` | component | — | none | no-analog |
| `mobile/components/StaleBanner.tsx` | component | — | none | no-analog |
| `mobile/components/ZonePicker.tsx` | component | — | `app/pages/index.tsx` (region selector section) | partial |
| `mobile/components/SignalCard.tsx` | component | — | none | no-analog |
| `mobile/components/SettingsModal.tsx` | component | — | `app/components/mobile/MobileShell.tsx` (settings button) | partial |
| `mobile/components/PlaceholderTab.tsx` | component | — | none | no-analog |
| `mobile/constants/colors.ts` | config | — | `app/lib/theme.ts` (THEMES) | role-match |

---

## Pattern Assignments

### `mobile/lib/api.ts` (utility, request-response)

**Analog:** `app/lib/api.ts`

**Imports pattern** (lines 1–6, adapt for React Native — no `process.env.NEXT_PUBLIC_*`, use `expo-constants`):
```typescript
import Constants from 'expo-constants';

// ── constants ─────────────────────────────────────────────────────────────────
const STATUS_CDN_URL = (Constants.expoConfig?.extra?.statusCdnUrl as string)
  ?? 'https://cdn.cocuyo.app/status.json';
```

**StatusJson interface** — copy verbatim from `app/lib/api.ts` lines 4–65. All interfaces (`RegionSignals`, `RationingPattern`, `OutageEstimatedRemaining`, `OutageInfo`, `CrowdInfo`, `RegionEntry`, `StatusJson`) must match exactly — this is the data contract.

**Core fetch pattern** (`app/lib/api.ts` lines 82–91):
```typescript
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

**Difference from web:** Replace `{ cache: 'no-store' }` with `{ headers: { 'Cache-Control': 'no-cache' } }` — React Native fetch does not support the `cache` option. Return shape `{ data: T | null; offline: boolean }` is identical.

**Error handling pattern:** Never throw from `fetchStatus()`. Catch block returns `{ data: null, offline: true }`. Callers check `offline` flag, never catch errors from this function.

---

### `mobile/lib/i18n.ts` (utility, transform)

**Analog:** `app/lib/i18n.ts`

**Type + map pattern** (lines 1–5):
```typescript
export type Lang = 'es' | 'en';

type StringEntry = { es: string; en: string };
type StringMap = Record<string, StringEntry>;

const STRINGS: StringMap = { /* ... */ };
```

**Lookup function pattern** (`app/lib/i18n.ts` lines 154–158):
```typescript
export function tt(key: string, lang: Lang = 'es'): string {
  const entry = STRINGS[key];
  if (!entry) return key;          // key as fallback — never crashes
  return entry[lang] ?? entry.es;  // always falls back to Spanish
}
```

**Duration format pattern** (`app/lib/i18n.ts` lines 160–166):
```typescript
export function formatDuration(min: number | null, lang: Lang): string {
  if (min == null) return '—';
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h === 0) return `${m} min`;
  return lang === 'en' ? `${h}h ${m}m` : `${h} h ${m} min`;
}
```

**Mobile additions needed** (not in web analog — add to `mobile/lib/i18n.ts`):
- `hasSeenOnboarding` flag key labels
- Trust screen 4 bullet point strings
- Zone picker strings: `search_placeholder`, `no_results`
- Staleness banner string: `stale_banner` (key `stale_banner: { es: 'Última actualización hace {X} min — sin conexión', en: 'Last updated {X} min ago — offline' }`)
- Status hero labels: `status_no_power`, `status_power_back`, `status_unstable`, `status_normal`, `status_no_data`

**Section divider convention** from CLAUDE.md — maintain in mobile TypeScript:
```typescript
// ── strings ────────────────────────────────────────────────────────────────────
```

---

### `mobile/lib/theme.ts` (utility/config)

**Analog:** `app/lib/theme.ts`

**Interface pattern** (`app/lib/theme.ts` lines 1–22 — adapt for mobile, drop web-only fields):
```typescript
// app/lib/theme.ts interface (reference — mobile drops tileUrl, tileAttr, radius, glow)
export interface Theme {
  name: ThemeName;
  bg: string; panel: string; panel2: string;
  line: string; lineStrong: string;
  ink: string; inkDim: string; inkFaint: string;
  accent: string; ok: string; risk: string; warn: string; danger: string;
}
```

Mobile interface (from RESEARCH.md Pattern 5) — rename to `MobileTheme`, drop web fields, add OLED-specific tokens:
```typescript
export interface MobileTheme {
  bg: string; panel: string;
  ink: string; inkDim: string; inkFaint: string;
  accent: string; ok: string; warn: string; danger: string;
  line: string; lineStrong: string;
}
```

**statusColor function pattern** (`app/lib/theme.ts` lines 85–94) — adapt status values for mobile pipeline contract:
```typescript
// web uses 'confirmed_outage' | 'likely_outage' | 'at_risk' — pipeline status values
// mobile maps same pipeline statuses: 'no_power' | 'power_back' | 'unstable' | 'normal' | 'no_data'
export function statusColor(status: string, theme: MobileTheme): string {
  switch (status) {
    case 'no_power':   return theme.danger;
    case 'unstable':   return theme.warn;
    case 'power_back': return theme.ok;
    case 'normal':     return theme.ok;
    case 'no_data':    return theme.inkFaint;
    default:           return theme.inkFaint;
  }
}
```

**Palette values** — use RESEARCH.md Pattern 5 values exactly (fresh mobile palette, not porting web tinta/estudio per D-05).

---

### `mobile/contexts/ThemeContext.tsx` (provider, event-driven)

**Analog:** `app/contexts/AppContext.tsx`

**Context creation pattern** (`app/contexts/AppContext.tsx` lines 1–16):
```typescript
import React, { createContext, useContext, useState, ReactNode } from 'react';
// mobile adds: import { useColorScheme } from 'react-native'; import { storage } from '@/lib/storage';

interface ThemeContextValue {
  theme: MobileTheme;
  override: 'light' | 'dark' | null;
  setOverride: (v: 'light' | 'dark' | null) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);
```

**Provider pattern** (`app/contexts/AppContext.tsx` lines 22–74 — adapt for mobile):
```typescript
// web reads from localStorage; mobile reads from MMKV (synchronous)
// web: localStorage.getItem(STORAGE_THEME)
// mobile: storage.getString('themeOverride')
export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();  // 'light' | 'dark' | null
  const override = storage.getString('themeOverride') as 'light' | 'dark' | null ?? null;
  const [overrideState, setOverrideState] = useState(override);
  const effective = overrideState ?? systemScheme ?? 'dark';
  const theme = effective === 'light' ? LIGHT_THEME : DARK_THEME;

  function setOverride(v: 'light' | 'dark' | null) {
    setOverrideState(v);
    if (v) storage.set('themeOverride', v);
    else storage.delete('themeOverride');
  }

  return (
    <ThemeContext.Provider value={{ theme, override: overrideState, setOverride }}>
      {children}
    </ThemeContext.Provider>
  );
}
```

**Consumer hook pattern** (`app/contexts/AppContext.tsx` lines 76–80):
```typescript
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
```

**Key difference from web:** No `useEffect` + localStorage async init. MMKV is synchronous — read directly in function body during render (RESEARCH.md Pitfall 1: never read MMKV at module level, only inside React components/hooks).

---

### `mobile/lib/storage.ts` (utility, CRUD)

**Analog:** `app/contexts/AppContext.tsx` (localStorage pattern, lines 18–36)

**Web pattern to adapt** (`app/contexts/AppContext.tsx` lines 18–36):
```typescript
// web: localStorage.getItem / setItem / removeItem
const STORAGE_THEME  = 'cocuyo_theme';
const STORAGE_LANG   = 'cocuyo_lang';
const STORAGE_REGION = 'cocuyo_region';
```

**Mobile pattern** — MMKV instance + typed accessors (RESEARCH.md Pattern 1):
```typescript
import { MMKV } from 'react-native-mmkv';

// ── MMKV instance ──────────────────────────────────────────────────────────────
// Single instance — created once at module level.
// SAFE: module-level MMKV() instantiation is allowed (bridge is ready by import time).
// NOT SAFE: calling storage.getBoolean() at module level — only call inside components/hooks.
export const storage = new MMKV({ id: 'cocuyo' });

// ── typed accessors ────────────────────────────────────────────────────────────
export const STORAGE_KEYS = {
  hasSeenOnboarding: 'hasSeenOnboarding',
  selectedZone:      'selectedZone',
  themeOverride:     'themeOverride',        // 'light' | 'dark' | null (missing = system)
  cacheTimestamp:    'statusCacheTimestamp', // epoch ms of last successful fetch
} as const;
```

**Critical constraint** (RESEARCH.md Pitfall 1): `storage.getBoolean('hasSeenOnboarding')` is called inside React components, not at module level. `storage = new MMKV(...)` at module level is fine.

---

### `mobile/lib/query.ts` (config, event-driven)

**Analog:** `app/lib/api.ts` lines 127–169 (`useAutoRefresh`)

The web analog uses a manual `useEffect` + `setTimeout` polling loop. Mobile replaces this entire pattern with React Query 5 + MMKV persister. Copy from RESEARCH.md Pattern 1 exactly:

```typescript
import { MMKV } from 'react-native-mmkv';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { QueryClient } from '@tanstack/react-query';

// ── MMKV adapter for React Query persister ─────────────────────────────────────
const mmkvPersistStore = new MMKV({ id: 'react-query-cache' });

const clientStorage = {
  setItem:    (key: string, value: string) => mmkvPersistStore.set(key, value),
  getItem:    (key: string): string | null => mmkvPersistStore.getString(key) ?? null,
  removeItem: (key: string) => mmkvPersistStore.delete(key),
};

export const persister = createSyncStoragePersister({ storage: clientStorage });

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime:      1000 * 60 * 60 * 24,  // 24h — keep cache alive (must be > staleTime)
      staleTime:   1000 * 60 * 9,         // 9 min — slightly under 10-min pipeline cycle
      networkMode: 'offlineFirst',         // serve cache without waiting for network
      retry:       3,
    },
  },
});
```

**Anti-pattern:** Never use `networkMode: 'online'` (default) — it blocks offline cache serving (RESEARCH.md Pitfall 6). Never use `gcTime` shorter than `staleTime` — cache gets evicted before saving (RESEARCH.md anti-patterns).

---

### `mobile/lib/regions.ts` (utility/config)

**Analog:** `pipeline/regions.py` lines 19–127

Translate Python `REGIONS` dict to TypeScript. Copy all 17 keys exactly. Add `SECTIONS` grouping needed for `ZonePicker.tsx` SectionList (from RESEARCH.md Pattern 6):

```typescript
// ── region meta ────────────────────────────────────────────────────────────────
export interface RegionMeta {
  display_name: string;
  state: string;
  lat: number;
  lon: number;
}

// Keys must match pipeline/regions.py exactly — same keys used in status.json
export const REGIONS: Record<string, RegionMeta> = {
  maracaibo:         { display_name: 'Maracaibo (Zulia)',            state: 'Zulia',             lat: 10.6427, lon: -71.6125 },
  san_cristobal:     { display_name: 'San Cristóbal (Táchira)',      state: 'Táchira',           lat: 7.7669,  lon: -72.2311 },
  merida:            { display_name: 'Mérida (Mérida)',              state: 'Mérida',            lat: 8.5897,  lon: -71.1440 },
  // ... all 17 from pipeline/regions.py
};

// ── zone picker sections ───────────────────────────────────────────────────────
// Used by ZonePicker.tsx SectionList
export const ZONE_SECTIONS: Array<{ title: string; data: string[] }> = [
  { title: 'Zulia',             data: ['maracaibo'] },
  { title: 'Táchira',          data: ['san_cristobal'] },
  // ... per RESEARCH.md Pattern 6
];
```

---

### `mobile/hooks/useStatus.ts` (hook, request-response)

**Analog:** `app/lib/api.ts` lines 127–169 (`useAutoRefresh`)

Web pattern uses manual `useEffect` + `useRef` + `setTimeout`. Mobile replaces with React Query `useQuery` wrapper:

```typescript
import { useQuery } from '@tanstack/react-query';
import { fetchStatus } from '@/lib/api';
import { storage, STORAGE_KEYS } from '@/lib/storage';
import type { StatusJson } from '@/lib/api';

// ── useStatus ──────────────────────────────────────────────────────────────────
export function useStatus(): {
  data: StatusJson | null;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
} {
  const query = useQuery({
    queryKey: ['status'],
    queryFn: async () => {
      const result = await fetchStatus();
      if (result.data) {
        // Update cache timestamp on successful fetch
        storage.set(STORAGE_KEYS.cacheTimestamp, Date.now());
      }
      if (!result.data) throw new Error('fetch failed');
      return result.data;
    },
    // gcTime / staleTime / networkMode inherited from queryClient defaults in lib/query.ts
  });

  return {
    data:      query.data ?? null,
    isLoading: query.isLoading,
    isError:   query.isError,
    refetch:   query.refetch,
  };
}
```

**Web pattern difference:** `useAutoRefresh` in `app/lib/api.ts` reads `data?.next_update_approx` to schedule the next fetch adaptively. In mobile, React Query handles retry/refetch timing via `staleTime`. The `next_update_approx` field can still be used for display purposes but does not drive fetch scheduling.

---

### `mobile/hooks/useOffline.ts` (hook, event-driven)

**Analog:** `app/lib/api.ts` lines 127–169 (`useAutoRefresh` — the `offline` state portion)

Web: `setOffline(isOffline)` set from `fetchStatus()` return value. Mobile: dedicated NetInfo hook + cache age check (RESEARCH.md Pattern 4):

```typescript
import { useNetInfo } from '@react-native-community/netinfo';
import { storage, STORAGE_KEYS } from '@/lib/storage';

// ── useOffline ─────────────────────────────────────────────────────────────────
export function useOffline(): {
  isOffline: boolean;
  isStale: boolean;
  ageMinutes: number;
} {
  const { isConnected } = useNetInfo();
  const lastFetch = storage.getNumber(STORAGE_KEYS.cacheTimestamp) ?? 0;
  const ageMs = Date.now() - lastFetch;
  const isStale = ageMs > 15 * 60 * 1000;  // 15 min threshold per D-13
  return {
    isOffline:  isConnected === false,
    isStale,
    ageMinutes: Math.floor(ageMs / 60_000),
  };
}
```

---

### `mobile/app/_layout.tsx` (provider/root layout)

**Analog:** `app/contexts/AppContext.tsx` (provider pattern, lines 22–74) + `app/pages/_app.tsx`

Root layout wraps the entire app. Pattern is AppContext.tsx's provider composition, adapted for Expo Router + PersistQueryClientProvider:

```typescript
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { queryClient, persister } from '@/lib/query';
import { storage, STORAGE_KEYS } from '@/lib/storage';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  // MMKV reads are synchronous — no useState needed for guard conditions (Pitfall 2)
  const hasSeenOnboarding = storage.getBoolean(STORAGE_KEYS.hasSeenOnboarding) ?? false;
  const selectedZone      = storage.getString(STORAGE_KEYS.selectedZone) ?? null;

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister, maxAge: 1000 * 60 * 60 * 24 }}
      onSuccess={() => SplashScreen.hideAsync()}  // hide splash after cache restored (Pitfall 3)
    >
      <ThemeProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Protected guard={!hasSeenOnboarding}>
            <Stack.Screen name="onboarding" />
          </Stack.Protected>
          <Stack.Protected guard={hasSeenOnboarding && !selectedZone}>
            <Stack.Screen name="zone-picker" />
          </Stack.Protected>
          <Stack.Protected guard={hasSeenOnboarding && !!selectedZone}>
            <Stack.Screen name="(tabs)" />
          </Stack.Protected>
        </Stack>
      </ThemeProvider>
    </PersistQueryClientProvider>
  );
}
```

**Anti-pattern:** Do NOT call `SplashScreen.hideAsync()` in `useEffect` — it must fire in `onSuccess` of `PersistQueryClientProvider` (RESEARCH.md Pitfall 3).

---

### `mobile/app/(tabs)/_layout.tsx` (config/nav layout)

**Analog:** `app/components/mobile/MobileShell.tsx` (tab bar pattern, lines 106–113)

Web analog has a custom `TabBar` component. Mobile uses Expo Router `Tabs` (no `@react-navigation/bottom-tabs` — SDK 56 provides this through `expo-router`, RESEARCH.md Pitfall 4):

```typescript
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';

export default function TabLayout() {
  const { theme } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor:   theme.accent,
        tabBarInactiveTintColor: theme.inkDim,
        tabBarStyle: { backgroundColor: theme.bg, borderTopColor: theme.line },
      }}
    >
      <Tabs.Screen name="index"   options={{ title: 'Mi Zona',   tabBarIcon: ({ color }) => <Ionicons name="location"      color={color} size={22} /> }} />
      <Tabs.Screen name="report"  options={{ title: 'Reportar',  tabBarIcon: ({ color }) => <Ionicons name="megaphone"     color={color} size={22} /> }} />
      <Tabs.Screen name="notify"  options={{ title: 'Alertas',   tabBarIcon: ({ color }) => <Ionicons name="notifications" color={color} size={22} /> }} />
      <Tabs.Screen name="food"    options={{ title: 'Comida',    tabBarIcon: ({ color }) => <Ionicons name="restaurant"    color={color} size={22} /> }} />
      <Tabs.Screen name="history" options={{ title: 'Historial', tabBarIcon: ({ color }) => <Ionicons name="time"         color={color} size={22} /> }} />
    </Tabs>
  );
}
```

**Gear icon for settings** (D-02): Add header right button to `index` tab screen options in `(tabs)/_layout.tsx` or inside `app/(tabs)/index.tsx` using `<Stack.Screen options={{ headerRight: ... }} />`.

---

### `mobile/app/onboarding.tsx` + `mobile/app/zone-picker.tsx` (screens)

**Analog:** `app/pages/index.tsx` (top-level screen structure only — partial match)

These are greenfield screens with no close analog. Key patterns to apply:

**MMKV write-on-complete pattern** (adapted from `app/contexts/AppContext.tsx` lines 41–54):
```typescript
// web: localStorage.setItem(STORAGE_REGION, region)
// mobile — onboarding complete:
import { storage, STORAGE_KEYS } from '@/lib/storage';
import { useRouter } from 'expo-router';

function handleOnboardingComplete() {
  storage.set(STORAGE_KEYS.hasSeenOnboarding, true);
  // Stack.Protected in _layout.tsx re-evaluates guard — navigates automatically
}

// zone-picker complete:
function handleZoneSelected(zoneKey: string) {
  storage.set(STORAGE_KEYS.selectedZone, zoneKey);
  // Stack.Protected guard becomes true — navigates to (tabs) automatically
}
```

**No manual `router.replace()`** — Stack.Protected guard re-renders automatically when MMKV writes happen (RESEARCH.md Pattern 2).

---

### `mobile/components/ZonePicker.tsx` (component)

**Analog:** `app/pages/index.tsx` (region selection region, partial)

Web uses a custom region selector. Mobile uses React Native `SectionList` with search filtering (RESEARCH.md Pattern 6):

```typescript
import { SectionList, TextInput, View } from 'react-native';
import { ZONE_SECTIONS, REGIONS } from '@/lib/regions';

// Filter pattern — filter sections + items on query, remove empty sections
function filterSections(query: string) {
  const q = query.toLowerCase();
  return ZONE_SECTIONS
    .map(section => ({
      ...section,
      data: section.data.filter(key =>
        REGIONS[key].display_name.toLowerCase().includes(q) ||
        REGIONS[key].state.toLowerCase().includes(q)
      ),
    }))
    .filter(section => section.data.length > 0);
}
```

**Status dot color** — call `statusColor(status, theme)` from `@/lib/theme` (same pattern as web `app/lib/theme.ts` line 85).

---

### `mobile/components/SettingsModal.tsx` (component)

**Analog:** `app/components/mobile/MobileShell.tsx` (settings button, lines 77–100)

Web renders a settings gear SVG button. Mobile opens a modal/sheet with About/Privacy section (D-02, TRST-02):

```typescript
// GitHub link — use expo-linking
import * as Linking from 'expo-linking';

function openGitHub() {
  Linking.openURL('https://github.com/kralgor/cocuyo');
}
```

**Modal open pattern** — match web's `onSettingsOpen` prop pattern from `MobileShell.tsx` line 13:
```typescript
// Parent passes onSettingsOpen callback — modal renders conditionally on boolean state
const [settingsVisible, setSettingsVisible] = useState(false);
```

---

### `mobile/app/(tabs)/report.tsx`, `notify.tsx`, `food.tsx`, `history.tsx` (placeholders)

**Analog:** None — greenfield. Copy `PlaceholderTab.tsx` component pattern.

Each placeholder screen is two lines plus the component import:
```typescript
import PlaceholderTab from '@/components/PlaceholderTab';
export default function ReportScreen() { return <PlaceholderTab />; }
```

`PlaceholderTab.tsx` renders `tt('coming_soon', lang)` text centered with theme colors. The `coming_soon` key already exists in `app/lib/i18n.ts` line 151 — copy to `mobile/lib/i18n.ts`.

---

### Config files: `mobile/app.json`, `mobile/eas.json`, `mobile/tsconfig.json`, `mobile/babel.config.js`

**Analog:** `app/tsconfig.json`, `app/next.config.js` (config structure pattern only)

**tsconfig.json** — copy strict mode from `app/tsconfig.json`. Key additions for Expo Router:
```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "paths": { "@/*": ["./*"] }
  }
}
```

**app.json** — copy verbatim from RESEARCH.md Code Examples section (EAS Update Configuration). Fill `[EAS_PROJECT_ID]` after `eas init`.

**eas.json** — copy verbatim from RESEARCH.md Code Examples section.

**babel.config.js** — standard Expo:
```javascript
module.exports = function(api) {
  api.cache(true);
  return { presets: ['babel-preset-expo'] };
};
```

---

### Test files: `mobile/__tests__/lib/api.test.ts`, `storage.test.ts`, `i18n.test.ts`, `hooks/useOffline.test.ts`, `navigation/routing.test.ts`

**Analog:** None in mobile (greenfield). Web has no test files.

Test structure follows RESEARCH.md Validation Architecture. All tests use jest-expo preset. MMKV mock pattern (per RESEARCH.md Wave 0 Gaps):
```typescript
// jest setup mock for react-native-mmkv
jest.mock('react-native-mmkv', () => ({
  MMKV: jest.fn().mockImplementation(() => {
    const store: Record<string, string | boolean | number> = {};
    return {
      set:       (key: string, value: string | boolean | number) => { store[key] = value; },
      getString: (key: string) => store[key] as string ?? undefined,
      getBoolean:(key: string) => store[key] as boolean ?? undefined,
      getNumber: (key: string) => store[key] as number ?? undefined,
      delete:    (key: string) => { delete store[key]; },
    };
  }),
}));
```

---

## Shared Patterns

### Section dividers (all TypeScript files)

**Source:** `app/lib/api.ts` lines 3, 67, 82, 94, 115, 127 — consistent throughout web codebase

**Apply to:** All `mobile/lib/*.ts`, `mobile/hooks/*.ts`, `mobile/contexts/*.tsx` files

```typescript
// ── section name ──────────────────────────────────────────────────────────────
```

### Return shape { data: T | null; offline: boolean }

**Source:** `app/lib/api.ts` lines 82–91 (`fetchStatus` return type)

**Apply to:** `mobile/lib/api.ts`, `mobile/hooks/useStatus.ts`

Functions that fetch remote data return this exact shape. Never return `null` directly — always `{ data: null, offline: true/false }`.

### MMKV over localStorage (all storage access)

**Source:** `app/contexts/AppContext.tsx` lines 18–36 (localStorage pattern)

**Apply to:** `mobile/lib/storage.ts`, `mobile/contexts/ThemeContext.tsx`, `mobile/app/_layout.tsx`, `mobile/app/onboarding.tsx`, `mobile/app/zone-picker.tsx`

Everywhere web uses `localStorage.getItem/setItem`, mobile uses `storage.getBoolean/getString/set` from `@/lib/storage`. Keys defined once in `STORAGE_KEYS` constant, not scattered across files.

### useContext + null guard

**Source:** `app/contexts/AppContext.tsx` lines 76–80

**Apply to:** `mobile/hooks/useTheme.ts`, any future context consumer hooks

```typescript
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
```

### No f-strings in log calls

**Source:** CLAUDE.md coding style

**Apply to:** No logging in Phase 1 mobile (no Python in mobile dir). Applies to pipeline only. Mobile has no logger — React Native errors bubble to the crash handler.

### Caveman section comments with ADR references

**Source:** `pipeline/main.py` (convention), `app/lib/api.ts` line 108 (`// ADR-005 deferred to Phase 4`)

**Apply to:** `mobile/lib/storage.ts` (reference ADR-007 on SUPABASE_ANON_KEY), `mobile/lib/query.ts` (note offline-first rationale)

```typescript
// ADR-007: Only SUPABASE_ANON_KEY in client apps. Phase 1 uses no Supabase at all.
// SUPABASE_ANON_KEY added in Phase 2 for report submission only.
```

---

## No Analog Found

Files with no close match in the codebase — planner should use RESEARCH.md patterns directly:

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `mobile/components/StatusHero.tsx` | component | — | No full-screen hero status block in web app (web uses RegionCard layout) |
| `mobile/components/StaleBanner.tsx` | component | — | Web has `offline_banner` string in i18n.ts but no dedicated banner component |
| `mobile/components/SignalCard.tsx` | component | — | Web renders signals inline in RegionCard; no standalone signal card component |
| `mobile/components/PlaceholderTab.tsx` | component | — | No placeholder/coming-soon component in web app |
| `mobile/app/(tabs)/notify.tsx` | screen/placeholder | — | Push notifications feature does not exist in web |
| `mobile/app/(tabs)/food.tsx` | screen/placeholder | — | Food safety timer does not exist in web |
| `mobile/app/(tabs)/history.tsx` | screen/placeholder | — | History tab in web is a full component — mobile placeholder only in Phase 1 |

For these files, use RESEARCH.md Pattern 3 (5-tab layout), Pattern 7 (status color mapping), and the design decisions from CONTEXT.md (D-12 hero layout, D-13 staleness banner).

---

## Metadata

**Analog search scope:** `app/lib/`, `app/contexts/`, `app/components/`, `app/pages/`, `pipeline/regions.py`

**Files scanned:** 8 source files (api.ts, i18n.ts, theme.ts, AppContext.tsx, MobileShell.tsx, demoData.ts, regions.py, index.tsx)

**Key constraint reminder:** `mobile/` is a new directory — all files are new. No files are modified in `app/` or `pipeline/`. The mobile app is additive.

**Pattern extraction date:** 2026-05-25
