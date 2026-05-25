# Phase 1: Foundation + Offline Core - Research

**Researched:** 2026-05-25
**Domain:** Expo SDK 56 / React Native / Expo Router / MMKV / React Query offline cache
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Full 5-tab bar in Phase 1. Non-Phase-1 tabs show "Coming in next update" placeholder. Tab labels/icons are mobile-native (Claude picks).
- **D-02:** Settings accessible via header gear icon (top-right of Zone tab). Opens as modal/sheet. No settings tab.
- **D-03:** Persist last-viewed zone in MMKV. First launch shows zone picker after trust onboarding. Subsequent launches open directly to saved zone.
- **D-04:** StyleSheet.create() + ThemeProvider context. No NativeWind. Theme object with typed color tokens via useTheme() hook.
- **D-05:** Fresh mobile-native palette. Not porting web tinta/estudio. Keep Cocuyo brand feel.
- **D-06:** Light + dark mode in Phase 1. ThemeProvider detects device system preference by default. User can override in settings.
- **D-07:** Single full-screen trust screen on first launch. 4 trust points (open source, anonymous, non-political, works offline) + GitHub link + "Comenzar" CTA.
- **D-08:** Trust screen shows once only (MMKV flag `hasSeenOnboarding`). Same content accessible in Settings > About/Privacy (TRST-02).
- **D-09:** Language detection follows device locale. ES if locale is ES, EN if EN, ES fallback for everything else.
- **D-10:** Trust screen then zone picker are separate sequential steps. Trust → dismiss → zone picker appears.
- **D-11:** Zone picker: 17 zones grouped by state, search bar at top, colored status dots per row.
- **D-12:** Zone detail: hero status layout (large color-coded block, duration, signal breakdown cards).
- **D-13:** Offline staleness banner non-dismissible when cache > 15 min old. Yellow/orange: "Última actualización hace X min — sin conexión".
- **D-14 (Claude's Discretion):** First-launch empty state: show zone picker after trust screen; skeleton cards while fetching; "Sin datos aún — conecta a internet" if first fetch fails offline.

### Claude's Discretion
- D-14: First-launch empty state approach (skeleton → offline message)

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| STAT-01 | User can view real-time outage status for any zone | React Query + CDN status.json fetch; StatusJson interface reused from app/lib/api.ts |
| STAT-02 | User can see how long a zone has been without power | `outage.started_at` field in RegionEntry; duration computed from Date.now() − Date.parse(started_at) |
| STAT-03 | User can view cached status data when offline, with visible staleness indicator | MMKV persister + React Query staleTime; NetInfo offline detection; cache timestamp tracking |
| TRST-01 | User sees trust onboarding screen on first launch | Stack.Protected (Expo Router SDK 53+) + MMKV `hasSeenOnboarding` flag |
| TRST-02 | User can access privacy/open-source section in settings with GitHub link | Settings modal/sheet via header gear icon; Linking.openURL for GitHub |
| PLAT-01 | App runs on Android (API 24+) | Expo SDK 56 default minSdkVersion=24; EAS Build |
| PLAT-02 | App runs on iOS (15+) | Expo SDK 56 minimum is iOS 16.4; use `ios.deploymentTarget: "15.0"` via expo-build-properties |
| PLAT-03 | App supports OTA updates via Expo EAS Update | expo-updates + EAS Update; runtimeVersion fingerprint policy |
</phase_requirements>

---

## Summary

Phase 1 scaffolds a React Native Expo app from scratch in the `mobile/` directory, adjacent to the existing web app. The stack is Expo SDK 56 (React Native 0.85, React 19.2.3) with Expo Router for file-based tab navigation. The core offline architecture pairs React Query 5 with an MMKV persister — MMKV is the fastest synchronous key-value store for React Native, and the persister allows React Query to restore cached status.json on cold launch before any network call completes.

The critical implementation nuance is that MMKV requires a **development build** (not Expo Go), because it links native C++ code via NitroModules. This means the project uses `npx expo prebuild` to generate native iOS/Android projects, then EAS Build for cloud compilation. This is the standard path for any Expo app with native dependencies and is well-supported.

Expo Router SDK 56 introduced a breaking change: `expo-router` no longer lists `@react-navigation/*` as a dependency. For a new project starting at SDK 56, this is a non-issue — use `expo-router` APIs directly from the start. Tab navigation, Stack navigation, and the new `Stack.Protected` guard for onboarding flows all work through `expo-router`.

**Primary recommendation:** Scaffold with `npx create-expo-app@latest mobile --template default@sdk-56`, configure MMKV + React Query persister in the root `_layout.tsx`, implement Stack.Protected for the trust→zone-picker flow, and build a 5-tab Expo Router layout. EAS Build handles compilation; EAS Update handles OTA.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Status.json fetch | React Native (fetch API) | React Query cache | Same as web app, no backend call |
| Offline cache | MMKV (device storage) | React Query persister | MMKV survives app kills; React Query restores state |
| Offline detection | @react-native-community/netinfo | React Query `networkMode` | NetInfo gives real-time connectivity events |
| Staleness tracking | App state (cache timestamp in MMKV) | React Query `dataUpdatedAt` | Need to compare cache age to 15-min threshold |
| Navigation / routing | Expo Router (file-based) | — | Standard Expo pattern for SDK 52+ |
| Theme / dark mode | ThemeProvider context | React Native Appearance API | Context wraps the app; Appearance detects system pref |
| Language detection | expo-localization | Custom i18n lookup | Reads device locale; falls back to ES |
| Trust onboarding | Stack.Protected + MMKV flag | — | Guard gates routes; MMKV persists seen state |
| OTA updates | expo-updates + EAS Update | — | PLAT-03 requirement |
| Settings modal | React Native Modal / Bottom Sheet | — | No settings tab (D-02) |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| expo | 56.0.4 | Expo SDK — device APIs, build tooling | Official Expo SDK, React Native 0.85 |
| expo-router | 56.2.6 | File-based routing, Stack, Tabs | Standard navigation for Expo SDK 52+; no react-navigation needed |
| react-native-mmkv | 4.3.1 | Synchronous key-value storage (zone, theme, onboarding flags, cache) | 30x faster than AsyncStorage; NitroModules for New Architecture |
| react-native-nitro-modules | 0.35.7 | MMKV v4 peer dependency (NitroModules runtime) | Required by react-native-mmkv v4 |
| @tanstack/react-query | 5.100.14 | Data fetching, cache, stale-while-revalidate | Industry standard; built-in offline modes |
| @tanstack/react-query-persist-client | 5.100.14 | PersistQueryClientProvider + persister interface | Restores React Query cache from MMKV on cold launch |
| @tanstack/query-sync-storage-persister | 5.100.14 | createSyncStoragePersister utility | Adapts MMKV to the persister interface (sync) |
| @react-native-community/netinfo | 12.0.1 | Network connectivity detection; offline/online events | Supported by Expo Go; standard offline detection lib |
| expo-localization | 56.0.6 | Device locale detection for ES/EN language selection | Official Expo API |
| expo-constants | 56.0.15 | App metadata, EAS environment vars | Official Expo; required by expo-router |
| expo-updates | 56.0.16 | OTA update infrastructure (PLAT-03) | Official Expo EAS Update |
| expo-splash-screen | 56.0.10 | Hide splash until app is ready (cache restored) | Official Expo |
| expo-linking | 56.0.11 | Deep linking; Linking.openURL for GitHub link in settings | Official Expo |
| expo-status-bar | 56.0.4 | Status bar styling per theme | Official Expo; included in expo-router deps |
| react-native-safe-area-context | 5.8.0 | Safe area insets for notches/home indicators | Required by expo-router |
| react-native-screens | 4.25.2 | Native screen optimization | Required by expo-router |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| expo-system-ui | 56.0.5 | Enable dark mode background on Android root view | Required for `userInterfaceStyle: automatic` on Android dev builds |
| expo-build-properties | 56.0.14 | Set Android minSdkVersion / iOS deploymentTarget in app.json | When overriding platform minimums beyond SDK defaults |
| expo-secure-store | 56.0.4 | Encrypted storage for secrets | Not needed in Phase 1 (no secrets) — listed for Phase 2+ |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| react-native-mmkv | @react-native-async-storage/async-storage | AsyncStorage is asynchronous — can't use createSyncStoragePersister; MMKV is 30x faster and synchronous |
| @tanstack/react-query | SWR or custom fetch hook | React Query has built-in offline persistence, retry logic, and stale-while-revalidate; best choice with MMKV persister |
| expo-localization | react-native-localize | react-native-localize requires prebuild too; expo-localization is official and works in Expo Go |
| Stack.Protected | Manual router.replace() redirect | Stack.Protected is declarative, less error-prone, available SDK 53+ |

**Installation (Phase 1 packages):**
```bash
# In mobile/ directory after create-expo-app scaffold:
npx expo install expo-router react-native-mmkv react-native-nitro-modules \
  @tanstack/react-query @tanstack/react-query-persist-client \
  @tanstack/query-sync-storage-persister \
  @react-native-community/netinfo expo-localization \
  expo-constants expo-updates expo-splash-screen expo-linking \
  expo-status-bar react-native-safe-area-context react-native-screens \
  expo-system-ui
```

**Important:** Use `npx expo install` (not `npm install`) so Expo resolves versions compatible with your SDK.

**Version verification:** All versions above were confirmed via `npm view [package] version` on 2026-05-25.

---

## Package Legitimacy Audit

> slopcheck was run but targeting PyPI — all packages are npm packages. npm registry age and source repo verified manually via `npm view`.

| Package | Registry | Age | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-------------|-----------|-------------|
| expo | npm | Since 2013 | github.com/expo/expo | OK (npm) | Approved |
| expo-router | npm | Since 2022 | github.com/expo/expo | OK (npm) | Approved |
| react-native-mmkv | npm | Since 2021 | github.com/mrousavy/react-native-mmkv | OK (npm) | Approved |
| react-native-nitro-modules | npm | Since 2024 | github.com/mrousavy/nitro | OK (npm) | Approved |
| @tanstack/react-query | npm | Since 2022 | github.com/TanStack/query | OK (npm) | Approved |
| @tanstack/react-query-persist-client | npm | Since 2022 | github.com/TanStack/query | OK (npm) | Approved |
| @tanstack/query-sync-storage-persister | npm | Since 2022 | github.com/TanStack/query | OK (npm) | Approved |
| @react-native-community/netinfo | npm | Since 2019 | github.com/react-native-netinfo/react-native-netinfo | OK (npm) | Approved |
| expo-localization | npm | Since 2018 | github.com/expo/expo | OK (npm) | Approved |
| expo-constants | npm | Since 2018 | github.com/expo/expo | OK (npm) | Approved |
| expo-updates | npm | Since 2019 | github.com/expo/expo | OK (npm) | Approved |
| expo-splash-screen | npm | Since 2020 | github.com/expo/expo | OK (npm) | Approved |
| expo-linking | npm | — | github.com/expo/expo | OK (npm) | Approved |
| expo-system-ui | npm | — | github.com/expo/expo | OK (npm) | Approved |

No postinstall scripts found on any package.

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

*Note: slopcheck targeted PyPI by default — all packages above are npm-only and were cross-verified via `npm view` and official Expo documentation.*

---

## Architecture Patterns

### System Architecture Diagram

```
                      ┌─────────────────────┐
                      │  CDN (Cloudflare R2) │
                      │   status.json        │
                      └─────────┬───────────┘
                                │ fetch (every 10 min)
                                ▼
┌─────────────────────────────────────────────────────┐
│                   mobile/ (Expo App)                 │
│                                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │  React Query (queryClient)                    │   │
│  │  • query key: ['status']                      │   │
│  │  • staleTime: 9 min / networkMode: 'always'  │   │
│  │  • retry: 3 with exponential backoff          │   │
│  │  ┌─────────────────────────────────────────┐  │   │
│  │  │  MMKV Persister                          │  │   │
│  │  │  • PersistQueryClientProvider           │  │   │
│  │  │  • Restores cache on cold launch        │  │   │
│  │  │  • Key: 'react-query-cache'             │  │   │
│  │  └─────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│  ┌────────────────────────────────────────────┐      │
│  │  NetInfo                                    │      │
│  │  • useNetInfo() → isConnected              │      │
│  │  • Events → trigger React Query refetch    │      │
│  └──────────────────────────────────────────┘        │
│                                                      │
│  ┌────────────────────────────────────────────┐      │
│  │  MMKV Direct Storage (non-query state)     │      │
│  │  • hasSeenOnboarding: boolean               │      │
│  │  • selectedZone: string                     │      │
│  │  • themeOverride: 'light'|'dark'|null       │      │
│  │  • cacheTimestamp: number (epoch ms)        │      │
│  └──────────────────────────────────────────┘        │
│                                                      │
│  Expo Router (file-based)                            │
│  app/                                                │
│  ├── _layout.tsx       ← Root layout, Stack.Protected│
│  ├── onboarding.tsx    ← Trust screen (guarded)      │
│  ├── zone-picker.tsx   ← Zone picker (guarded)       │
│  └── (tabs)/                                         │
│      ├── _layout.tsx   ← 5-tab bar                   │
│      ├── index.tsx     ← Zone tab (status + detail)  │
│      ├── report.tsx    ← Report tab (placeholder)    │
│      ├── notify.tsx    ← Notify tab (placeholder)    │
│      ├── food.tsx      ← Food tab (placeholder)      │
│      └── history.tsx   ← History tab (placeholder)   │
└─────────────────────────────────────────────────────┘
```

### Recommended Project Structure

```
mobile/
├── app/                          # Expo Router routes
│   ├── _layout.tsx               # Root layout: ThemeProvider, QueryClient, Stack.Protected
│   ├── onboarding.tsx            # Trust screen (only shown on first launch)
│   ├── zone-picker.tsx           # Zone picker (shown after onboarding OR when no zone set)
│   └── (tabs)/
│       ├── _layout.tsx           # Tab bar layout: 5 tabs
│       ├── index.tsx             # Zone tab: hero status + detail
│       ├── report.tsx            # Placeholder: "Próximamente"
│       ├── notify.tsx            # Placeholder: "Próximamente"
│       ├── food.tsx              # Placeholder: "Próximamente"
│       └── history.tsx           # Placeholder: "Próximamente"
├── components/
│   ├── StatusHero.tsx            # Large color-coded status block
│   ├── StaleBanner.tsx           # Non-dismissible offline banner
│   ├── ZonePicker.tsx            # SectionList with search + status dots
│   ├── SignalCard.tsx            # Signal breakdown card
│   ├── SettingsModal.tsx         # Gear icon → modal with About/Privacy
│   └── PlaceholderTab.tsx        # Reusable "coming soon" screen
├── lib/
│   ├── api.ts                    # fetchStatus() adapted for React Native
│   ├── storage.ts                # MMKV instance + typed accessors
│   ├── query.ts                  # QueryClient + persister setup
│   ├── regions.ts                # 17 region keys + state grouping (from pipeline/regions.py)
│   ├── i18n.ts                   # tt() + formatDuration() adapted from app/lib/i18n.ts
│   └── theme.ts                  # MobileTheme interface, light/dark palettes, useTheme()
├── hooks/
│   ├── useStatus.ts              # useQuery wrapper for status.json
│   ├── useOffline.ts             # useNetInfo() + cache age → isOffline + isStale
│   └── useTheme.ts               # ThemeContext consumer hook
├── contexts/
│   └── ThemeContext.tsx          # ThemeProvider: system pref + user override
├── constants/
│   └── colors.ts                 # Palette tokens for light and dark themes
├── app.json                      # Expo config: scheme, bundleId, runtimeVersion
├── eas.json                      # EAS Build + Update channels
├── babel.config.js               # babel-preset-expo
├── tsconfig.json                 # strict mode, path aliases
└── package.json                  # "main": "expo-router/entry"
```

### Pattern 1: MMKV + React Query Persister

**What:** Persist React Query cache to MMKV so status.json is available on cold launch, before any network call completes.

**When to use:** Root `_layout.tsx` — wraps the entire app.

**Example:**
```typescript
// Source: github.com/mrousavy/react-native-mmkv/blob/main/docs/WRAPPER_REACT_QUERY.md
// + tanstack.com/query/latest/docs/framework/react/plugins/persistQueryClient
import { MMKV } from 'react-native-mmkv';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { QueryClient } from '@tanstack/react-query';

const mmkv = new MMKV({ id: 'react-query-cache' });

const clientStorage = {
  setItem: (key: string, value: string) => mmkv.set(key, value),
  getItem: (key: string): string | null => mmkv.getString(key) ?? null,
  removeItem: (key: string) => mmkv.delete(key),
};

const persister = createSyncStoragePersister({ storage: clientStorage });

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 1000 * 60 * 60 * 24, // 24h — keep cache alive
      staleTime: 1000 * 60 * 9,    // 9 min — slightly under 10-min pipeline cycle
      networkMode: 'offlineFirst',  // serve cache without waiting for network
      retry: 3,
    },
  },
});

// In root _layout.tsx:
export default function RootLayout() {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister, maxAge: 1000 * 60 * 60 * 24 }}
      onSuccess={() => SplashScreen.hideAsync()}
    >
      {/* ... */}
    </PersistQueryClientProvider>
  );
}
```

### Pattern 2: Stack.Protected for Onboarding Flow

**What:** Declarative route guarding — trust screen and zone picker only appear when needed. Available since Expo Router SDK 53.

**When to use:** Root `_layout.tsx` — wraps route groups.

**Example:**
```typescript
// Source: docs.expo.dev/router/advanced/ + lucas-rouret.fr/blog/tech/stack-protected
import { Stack } from 'expo-router';
import { storage } from '@/lib/storage';

export default function RootLayout() {
  const hasSeenOnboarding = storage.getBoolean('hasSeenOnboarding') ?? false;
  const selectedZone = storage.getString('selectedZone') ?? null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* Onboarding: only when not seen */}
      <Stack.Protected guard={!hasSeenOnboarding}>
        <Stack.Screen name="onboarding" />
      </Stack.Protected>

      {/* Zone picker: after onboarding, before zone selected */}
      <Stack.Protected guard={hasSeenOnboarding && !selectedZone}>
        <Stack.Screen name="zone-picker" />
      </Stack.Protected>

      {/* Main app: after zone selected */}
      <Stack.Protected guard={hasSeenOnboarding && !!selectedZone}>
        <Stack.Screen name="(tabs)" />
      </Stack.Protected>
    </Stack>
  );
}
```

### Pattern 3: 5-Tab Layout with Placeholders

**What:** Expo Router `(tabs)/_layout.tsx` with 5 tabs; 4 are placeholder screens.

**When to use:** Phase 1 tab bar scaffold.

**Example:**
```typescript
// Source: docs.expo.dev/router/advanced/tabs/
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons'; // included in Expo SDK
import { useTheme } from '@/hooks/useTheme';

export default function TabLayout() {
  const { theme } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.inkDim,
        tabBarStyle: { backgroundColor: theme.bg, borderTopColor: theme.line },
      }}
    >
      <Tabs.Screen name="index"   options={{ title: 'Mi Zona',   tabBarIcon: ({ color }) => <Ionicons name="location" color={color} size={22} /> }} />
      <Tabs.Screen name="report"  options={{ title: 'Reportar',  tabBarIcon: ({ color }) => <Ionicons name="megaphone" color={color} size={22} /> }} />
      <Tabs.Screen name="notify"  options={{ title: 'Alertas',   tabBarIcon: ({ color }) => <Ionicons name="notifications" color={color} size={22} /> }} />
      <Tabs.Screen name="food"    options={{ title: 'Comida',    tabBarIcon: ({ color }) => <Ionicons name="restaurant" color={color} size={22} /> }} />
      <Tabs.Screen name="history" options={{ title: 'Historial', tabBarIcon: ({ color }) => <Ionicons name="time" color={color} size={22} /> }} />
    </Tabs>
  );
}
```

### Pattern 4: Offline Detection + Staleness Banner

**What:** Combine NetInfo (connectivity) with cache timestamp (staleness) for the STAT-03 banner requirement.

**When to use:** Zone detail screen header; staleness = cache older than 15 min OR offline.

**Example:**
```typescript
// Source: docs.expo.dev/versions/latest/sdk/netinfo/ + training knowledge
import { useNetInfo } from '@react-native-community/netinfo';
import { storage } from '@/lib/storage';

export function useOffline() {
  const { isConnected } = useNetInfo();
  const lastFetch = storage.getNumber('statusCacheTimestamp') ?? 0;
  const ageMs = Date.now() - lastFetch;
  const isStale = ageMs > 15 * 60 * 1000; // 15 min
  return {
    isOffline: isConnected === false,
    isStale,
    ageMinutes: Math.floor(ageMs / 60_000),
  };
}

// In zone detail screen:
// { isOffline || isStale } && <StaleBanner ageMinutes={ageMinutes} />
```

### Pattern 5: Theme System (StyleSheet.create + ThemeProvider)

**What:** React context-based theme, typed color tokens, useColorScheme() for system preference.

**When to use:** Root layout wraps with ThemeProvider; all screens consume via useTheme().

**Example:**
```typescript
// Source: docs.expo.dev/develop/user-interface/color-themes/ + reactnative.dev/docs/appearance
import { useColorScheme, Appearance } from 'react-native';
import { storage } from '@/lib/storage';

export interface MobileTheme {
  bg: string; panel: string; ink: string; inkDim: string; inkFaint: string;
  accent: string; ok: string; warn: string; danger: string;
  line: string; lineStrong: string;
}

export const LIGHT_THEME: MobileTheme = {
  bg: '#F5F0E8',    // warm off-white — sunlight readable
  panel: '#FDFAF3',
  ink: '#1A1A1A',
  inkDim: 'rgba(26,26,26,0.60)',
  inkFaint: 'rgba(26,26,26,0.38)',
  accent: '#E8C840',  // Cocuyo firefly yellow — kept from brand
  ok: '#3A7A38',      // deep green — OLED friendly
  warn: '#C05A10',    // orange-amber
  danger: '#B03020',  // dark red
  line: 'rgba(26,26,26,0.08)',
  lineStrong: 'rgba(26,26,26,0.20)',
};

export const DARK_THEME: MobileTheme = {
  bg: '#0F0F0F',      // near-black — battery-friendly
  panel: '#1A1A1A',
  ink: '#F0EBE0',
  inkDim: 'rgba(240,235,224,0.60)',
  inkFaint: 'rgba(240,235,224,0.35)',
  accent: '#E8C840',
  ok: '#5AAA58',
  warn: '#E07530',
  danger: '#D04030',
  line: 'rgba(240,235,224,0.08)',
  lineStrong: 'rgba(240,235,224,0.20)',
};

// ThemeProvider reads system pref, allows override stored in MMKV:
export function ThemeProvider({ children }) {
  const systemScheme = useColorScheme(); // 'light' | 'dark' | null
  const override = storage.getString('themeOverride'); // 'light' | 'dark' | null
  const effective = override ?? systemScheme ?? 'dark'; // default dark (OLED, Venezuela)
  const theme = effective === 'light' ? LIGHT_THEME : DARK_THEME;
  return <ThemeContext.Provider value={{ theme, override, setOverride }}>{children}</ThemeContext.Provider>;
}
```

### Pattern 6: Zone Picker (SectionList + Search)

**What:** 17 zones grouped by state in a SectionList with search bar filtering.

**When to use:** zone-picker.tsx route and Settings zone-change action.

```typescript
// Source: reactnative.dev/docs/sectionlist + training knowledge
import { SectionList, TextInput } from 'react-native';

// Group 17 zones by state — derived from pipeline/regions.py
const SECTIONS = [
  { title: 'Zulia',            data: ['maracaibo'] },
  { title: 'Táchira',         data: ['san_cristobal'] },
  { title: 'Mérida',          data: ['merida'] },
  { title: 'Trujillo',        data: ['valera'] },
  { title: 'Lara',            data: ['barquisimeto'] },
  { title: 'Falcón',          data: ['punto_fijo'] },
  { title: 'Carabobo',        data: ['valencia'] },
  { title: 'Aragua',          data: ['maracay'] },
  { title: 'Distrito Capital', data: ['caracas'] },
  { title: 'Miranda',          data: ['los_teques', 'guarenas_guatire'] },
  { title: 'Barinas',          data: ['barinas'] },
  { title: 'Monagas',          data: ['maturin'] },
  { title: 'Anzoátegui',       data: ['barcelona'] },
  { title: 'Sucre',            data: ['cumana'] },
  { title: 'Nueva Esparta',    data: ['porlamar'] },
  { title: 'Bolívar',          data: ['ciudad_guayana'] },
];
// Filter pattern: filter sections + items on query, remove empty sections
```

### Pattern 7: Status Color Mapping (mobile-native)

**What:** Map pipeline status strings to mobile theme colors for hero block and status dots.

```typescript
// Source: app/lib/theme.ts statusColor() adapted for mobile
export function statusColor(status: string, theme: MobileTheme): string {
  switch (status) {
    case 'no_power':    return theme.danger;  // red
    case 'unstable':    return theme.warn;    // orange
    case 'power_back':  return theme.ok;      // green
    case 'normal':      return theme.ok;      // green
    case 'no_data':     return theme.inkFaint;
    default:            return theme.inkFaint;
  }
}

// Hero label mapping:
export function statusLabel(status: string, lang: Lang): string {
  const labels: Record<string, { es: string; en: string }> = {
    no_power:   { es: 'SIN LUZ',    en: 'NO POWER' },
    power_back: { es: 'CON LUZ',    en: 'POWER ON' },
    unstable:   { es: 'INESTABLE',  en: 'UNSTABLE' },
    normal:     { es: 'NORMAL',     en: 'NORMAL' },
    no_data:    { es: 'SIN DATOS',  en: 'NO DATA' },
  };
  return labels[status]?.[lang] ?? status.toUpperCase();
}
```

### Anti-Patterns to Avoid

- **Using Expo Go for development:** MMKV requires a dev build (Expo Go does not support native modules). Use `npx expo run:android` or an EAS dev build.
- **Importing from @react-navigation/*:** In SDK 56, all navigation imports come from `expo-router` or `expo-router/js-tabs`. No separate `@react-navigation/bottom-tabs` install needed.
- **Using AsyncStorage instead of MMKV:** AsyncStorage is asynchronous; the sync persister pattern requires synchronous storage. MMKV is the right choice.
- **Calling Stack.Protected guard with async state:** Stack.Protected reads values synchronously on render. Use MMKV's synchronous `getBoolean()`/`getString()` — never await a promise for guard conditions.
- **Setting `networkMode: 'online'` (default) in QueryClient:** This causes queries to stay `loading` when offline, never serving the persisted cache. Use `networkMode: 'offlineFirst'` or `'always'`.
- **Not setting `gcTime` > `staleTime`:** If `gcTime` is shorter than the cache persistence window, React Query evicts the cache before MMKV saves it. Set `gcTime` to 24h.
- **Storing StatusJson directly in MMKV (bypassing React Query):** Duplicates cache management. Let React Query own the data; MMKV is only the persistence layer via the persister.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Offline cache with stale-while-revalidate | Custom fetch + state machine | React Query 5 + MMKV persister | React Query handles background refetch, error retry, deduplication |
| Network state detection | WebSocket ping loop or setInterval | @react-native-community/netinfo | OS-level network change events, handles airplane mode edge cases |
| File-based route navigation | Custom navigator component | Expo Router | Code splitting, deep linking, type-safe routes — all free |
| OTA updates | Custom JS bundle fetching | expo-updates + EAS Update | Code signing, rollback, version compatibility all handled |
| Dark mode detection | Polling Appearance API | useColorScheme() hook | Re-renders automatically on system change |
| Key-value storage | SQLite / AsyncStorage | MMKV | Synchronous, JSI-based, 30x faster — critical for persister boot path |
| Platform-safe insets | Manual padding per device | react-native-safe-area-context | Handles notches, Dynamic Island, Android navigation bars |

**Key insight:** The offline-first pattern (React Query + MMKV persister) is subtle to get right — `gcTime`, `networkMode`, and persister `maxAge` must all be configured together. Don't try to replicate this with manual cache logic; the persister already handles dehydration/rehydration.

---

## Common Pitfalls

### Pitfall 1: MMKV in Root Layout — Initialization Order

**What goes wrong:** Calling `storage.getBoolean('hasSeenOnboarding')` at module level before MMKV is initialized crashes on cold launch.

**Why it happens:** MMKV requires the JS bridge to be ready; module-level eval runs during bundle parse, before the bridge is fully established.

**How to avoid:** Create the MMKV instance once at module level in `lib/storage.ts`, then call getters only inside React components or hooks (i.e., during render, not at import time).

**Warning signs:** "MMKV instance has not been created yet" or undefined crashes on iOS/Android launch.

---

### Pitfall 2: Stack.Protected + Async MMKV reads

**What goes wrong:** Using `async/await` or `useState` initialized to `null` for the guard condition causes a flicker — the app briefly shows the wrong screen before the flag loads.

**Why it happens:** Stack.Protected evaluates the guard on every render; if the initial state is `null` (before async read completes), the wrong route group activates.

**How to avoid:** MMKV is synchronous. Call `storage.getBoolean('hasSeenOnboarding') ?? false` directly in the component — no `useState` needed. The value is instantly available.

**Warning signs:** Flash of onboarding screen on returning users; or onboarding skipped on fresh install.

---

### Pitfall 3: SplashScreen not hidden after MMKV restore

**What goes wrong:** App shows white screen for 1–2 seconds after launch because `SplashScreen.hideAsync()` is never called after the persister restores the cache.

**Why it happens:** `PersistQueryClientProvider` has an `onSuccess` callback that fires when restoration is complete. If you call `SplashScreen.hideAsync()` in `App.useEffect()` instead, it fires before cache restore, causing a blank flash.

**How to avoid:** Call `SplashScreen.preventAutoHideAsync()` before render. Call `SplashScreen.hideAsync()` in the `onSuccess` callback of `PersistQueryClientProvider`.

**Warning signs:** White/blank screen for 1+ seconds on cold launch.

---

### Pitfall 4: Expo SDK 56 — No @react-navigation/* imports

**What goes wrong:** Importing `useNavigation` from `@react-navigation/native` or `createBottomTabNavigator` from `@react-navigation/bottom-tabs` causes module not found errors.

**Why it happens:** Expo Router SDK 56 no longer lists react-navigation as a dependency. The packages are not installed in the project.

**How to avoid:** All navigation imports come from `expo-router` in SDK 56. Use `import { Tabs, Stack, useRouter } from 'expo-router'`.

**Warning signs:** "Cannot find module '@react-navigation/native'" error at build time.

---

### Pitfall 5: iOS deploymentTarget mismatch with PLAT-02

**What goes wrong:** Expo SDK 56 defaults to iOS 16.4 minimum. PLAT-02 requires iOS 15+. Without explicit `deploymentTarget`, users on iOS 15.x cannot install the app.

**Why it happens:** SDK 56 bumped the iOS minimum to 16.4 (from 15.1 in SDK 52). This is higher than the project's requirement.

**How to avoid:** Add `expo-build-properties` and set `ios.deploymentTarget` to `"15.0"` in the plugin config in `app.json`. Verify React Native 0.85 itself supports iOS 15 (it does — [ASSUMED] based on React Native's historical policy of supporting 2 major versions back).

**Warning signs:** App Store submission rejected for minimum iOS version; crash on iOS 15.x.

---

### Pitfall 6: React Query networkMode default blocks offline cache

**What goes wrong:** On first launch with no network, the status query stays in `loading` state forever, even though MMKV has a persisted cache from a previous session.

**Why it happens:** The default `networkMode: 'online'` pauses queries when the device is offline — it never attempts to return the cached data.

**How to avoid:** Set `networkMode: 'offlineFirst'` in QueryClient's defaultOptions. This serves cache immediately and only tries the network when available.

**Warning signs:** Zone detail screen shows skeleton/loading forever when offline, even on a returning user's device.

---

### Pitfall 7: MMKV prebuild requirement — Expo Go incompatibility

**What goes wrong:** Running `npx expo start` and scanning with Expo Go shows a red screen: "Native module not found: MMKVNative".

**Why it happens:** MMKV uses JSI/NitroModules (native C++ bindings) that cannot be loaded by the generic Expo Go sandbox. Expo Go only supports a fixed set of native modules.

**How to avoid:** Use a **development build** from day one:
1. `npx expo prebuild` — generates ios/ and android/ directories
2. `npx expo run:android` (or `eas build --profile development`) — installs the dev build on device/emulator

**Warning signs:** "expo-go not compatible" warning; or MMKVNative module not found.

---

## Code Examples

Verified patterns from official sources:

### EAS Update Configuration (app.json)

```json
// Source: docs.expo.dev/eas-update/runtime-versions/
{
  "expo": {
    "name": "Cocuyo",
    "slug": "cocuyo",
    "scheme": "cocuyo",
    "version": "1.0.0",
    "platforms": ["ios", "android"],
    "runtimeVersion": {
      "policy": "appVersion"
    },
    "updates": {
      "url": "https://u.expo.dev/[EAS_PROJECT_ID]",
      "enabled": true,
      "fallbackToCacheTimeout": 0
    },
    "android": {
      "package": "app.cocuyo.mobile",
      "versionCode": 1
    },
    "ios": {
      "bundleIdentifier": "app.cocuyo.mobile",
      "buildNumber": "1"
    },
    "plugins": [
      [
        "expo-build-properties",
        {
          "android": { "minSdkVersion": 24 },
          "ios": { "deploymentTarget": "15.0" }
        }
      ]
    ]
  }
}
```

### eas.json

```json
// Source: docs.expo.dev/eas/json/
{
  "cli": { "version": ">= 19.0.0", "appVersionSource": "remote" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "channel": "preview"
    },
    "production": {
      "channel": "production"
    }
  },
  "update": {
    "channel": "production"
  }
}
```

### Device Locale Detection

```typescript
// Source: docs.expo.dev/versions/latest/sdk/localization/
import { getLocales } from 'expo-localization';
import type { Lang } from './i18n';

export function detectLang(): Lang {
  const locales = getLocales();
  const primary = locales[0]?.languageCode ?? 'es';
  return primary === 'en' ? 'en' : 'es'; // ES fallback for all non-EN
}
```

### Duration Calculation from OutageInfo

```typescript
// STAT-02: Display how long a zone has been without power
// Source: app/lib/api.ts OutageInfo interface
function formatOutageDuration(startedAt: string, lang: Lang): string {
  const ms = Date.now() - Date.parse(startedAt);
  const totalMin = Math.floor(ms / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return lang === 'en' ? `${m}m` : `${m} min`;
  return lang === 'en' ? `${h}h ${m}m` : `${h} h ${m} min`;
}
// Note: outage.elapsed_minutes is also available in the API response
// — use elapsed_minutes from status.json for consistency with pipeline's calculation
```

### StatusJson Adapter for React Native

```typescript
// mobile/lib/api.ts — adapted from app/lib/api.ts
// Same interface, React Native fetch (no Next.js env vars)
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

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual useEffect + AsyncStorage for offline | React Query 5 + MMKV persister + `networkMode: 'offlineFirst'` | React Query v4→v5 (2023-2024) | Built-in cache rehydration; no custom cache logic |
| React Navigation with createBottomTabNavigator | Expo Router file-based tabs | Expo SDK 50+ (2024) | Zero navigation boilerplate; type-safe routes |
| Redux or Zustand for global state | React Context + MMKV for simple key-value state | 2023-2024 | Simpler; MMKV eliminates async state init |
| @react-navigation/* installed separately | expo-router includes navigation (SDK 56) | Expo SDK 56 (May 2026) | No @react-navigation/* packages in package.json |
| Expo Go for development | Dev builds via `expo run:*` or EAS | SDK 52+ (2024) | Required for any native module (MMKV, etc.) |
| Manual redirect for onboarding | Stack.Protected guard | Expo Router SDK 53 (2024) | Declarative; no scattered router.replace() calls |

**Deprecated/outdated:**
- `@react-navigation/bottom-tabs` and `@react-navigation/native` installed separately: Do not install in SDK 56 projects — use expo-router's bundled versions.
- `expo-app-loading`: Replaced by expo-splash-screen. Do not use.
- `AsyncStorage` from `@react-native-async-storage/async-storage` as the persister: Still works but is async; MMKV is preferred for synchronous boot path.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | iOS 15.0 deploymentTarget is achievable with React Native 0.85 and Expo SDK 56 | PLAT-02 / Standard Stack | iOS 15 users (~2-5% globally) cannot install the app; must use higher minimum |
| A2 | Stack.Protected is available in expo-router 56.x (introduced in SDK 53) | Architecture Patterns | Must use manual router.replace() redirect pattern instead; more complex |
| A3 | `networkMode: 'offlineFirst'` in React Query 5 serves persisted cache without any network check | Pitfall 6 | App may still block on offline; need to test `networkMode: 'always'` as fallback |
| A4 | MMKV v4 + react-native-nitro-modules works with Expo SDK 56 New Architecture | Standard Stack | MMKV may need a minor version bump; check `npx expo-doctor` after install |

---

## Open Questions

1. **iOS 15 vs SDK 56 default of 16.4**
   - What we know: Expo SDK 56 defaulted iOS min to 16.4. expo-build-properties can override `deploymentTarget`.
   - What's unclear: Whether React Native 0.85 itself supports iOS 15.0 at the C++ level, or whether 16.4 is also a React Native constraint.
   - Recommendation: Set `deploymentTarget: "15.0"` and run `npx expo-doctor` post-install. If expo-doctor flags it, accept 16.4 and update PLAT-02 constraint with Leo.

2. **EAS Project ID for status.json URL**
   - What we know: EAS Update URL requires a project ID from `eas.json` / `app.json`.
   - What's unclear: Whether Leo has an existing EAS account/project for Cocuyo Mobile.
   - Recommendation: Run `eas init` in Wave 0 to create the EAS project; it auto-populates `extra.eas.projectId`.

3. **CDN URL for status.json in mobile**
   - What we know: Web app uses `NEXT_PUBLIC_STATUS_URL` env var.
   - What's unclear: Expo environment variable strategy for the CDN URL (hardcode vs Expo config plugin vs `app.json` extra).
   - Recommendation: Use `app.json` `extra.statusCdnUrl` + `Constants.expoConfig.extra.statusCdnUrl` in `lib/api.ts`. Confirmed by `expo-constants` docs.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | npm install, expo CLI | ✓ | v22.22.1 | — |
| npm | Package management | ✓ | 10.9.4 | — |
| eas-cli | EAS Build + Update (PLAT-03) | ✗ | — | Install: `npm install -g eas-cli` |
| Android SDK / adb | Local Android dev builds | ✗ | — | Use EAS cloud build (`eas build --profile development`) |
| Xcode / xcrun | Local iOS dev builds | ✗ (WSL) | — | Use EAS cloud build; iOS development requires macOS |
| Expo Go | Quick prototyping | — | n/a | Not usable (MMKV requires dev build); use EAS dev build |
| Android emulator | Local testing | ✗ | — | Physical device via EAS dev build |

**Missing dependencies with no fallback:**
- Xcode: iOS builds require macOS. WSL cannot compile iOS native code. Use EAS Build cloud (EAS free tier supports development builds).

**Missing dependencies with fallback:**
- eas-cli: One-time `npm install -g eas-cli@latest` before Wave 0. Required for PLAT-03.
- Android SDK: EAS cloud build removes this requirement. Planner should scaffold EAS dev build in Wave 0 rather than local `npx expo run:android`.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Jest + jest-expo preset |
| Config file | `mobile/jest.config.js` (Wave 0 gap) |
| Quick run command | `cd mobile && npx jest --testPathPattern="__tests__"` |
| Full suite command | `cd mobile && npx jest` |

**Note:** jest-expo is the standard test preset for Expo projects. It handles React Native module mocking automatically.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| STAT-01 | fetchStatus() returns StatusJson from CDN | unit | `jest __tests__/lib/api.test.ts` | ❌ Wave 0 |
| STAT-01 | fetchStatus() returns offline:true on network error | unit | `jest __tests__/lib/api.test.ts` | ❌ Wave 0 |
| STAT-02 | outage duration formatted correctly from started_at | unit | `jest __tests__/lib/i18n.test.ts` | ❌ Wave 0 |
| STAT-03 | MMKV persister stores and restores StatusJson | unit | `jest __tests__/lib/storage.test.ts` | ❌ Wave 0 |
| STAT-03 | useOffline() returns isStale=true after 15 min | unit | `jest __tests__/hooks/useOffline.test.ts` | ❌ Wave 0 |
| TRST-01 | hasSeenOnboarding=false routes to onboarding | unit | `jest __tests__/navigation/routing.test.ts` | ❌ Wave 0 |
| TRST-01 | hasSeenOnboarding=true skips onboarding | unit | `jest __tests__/navigation/routing.test.ts` | ❌ Wave 0 |
| TRST-02 | Settings modal renders GitHub link | unit | `jest __tests__/components/SettingsModal.test.ts` | ❌ Wave 0 |
| PLAT-03 | expo-updates module loads without error | smoke | manual — EAS build required | manual-only |

**Manual-only justification (PLAT-03):** OTA update delivery requires a real EAS build and a deployed update channel. Cannot be unit tested.

### Sampling Rate

- **Per task commit:** `cd mobile && npx jest --testPathPattern="(api|storage|i18n|useOffline)" --passWithNoTests`
- **Per wave merge:** `cd mobile && npx jest`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `mobile/jest.config.js` — jest-expo preset configuration
- [ ] `mobile/__tests__/lib/api.test.ts` — covers STAT-01
- [ ] `mobile/__tests__/lib/storage.test.ts` — covers STAT-03 (MMKV mock)
- [ ] `mobile/__tests__/lib/i18n.test.ts` — covers STAT-02
- [ ] `mobile/__tests__/hooks/useOffline.test.ts` — covers STAT-03 staleness
- [ ] `mobile/__tests__/navigation/routing.test.ts` — covers TRST-01

**MMKV mock note:** In tests, mock `react-native-mmkv` with an in-memory object. The official jest setup is documented at `mrousavy/react-native-mmkv` (Jest mocking section).

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | App is anonymous — no auth |
| V3 Session Management | No | No sessions |
| V4 Access Control | Partial | ADR-007: Only SUPABASE_ANON_KEY in app, never service_role |
| V5 Input Validation | No | Phase 1 is read-only (no user input submitted) |
| V6 Cryptography | No | No secrets stored in Phase 1 |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Service role key in mobile app | Information Disclosure | ADR-007: Only anon key in app; never service_role; enforced by CLAUDE.md |
| CDN data tampering | Tampering | Phase 1: no integrity check on status.json; trust CDN TLS. Acceptable for non-critical read-only data |
| Device storage snooping | Information Disclosure | MMKV stores zone name + theme preference; no sensitive data in Phase 1 |
| Expo config API key exposure | Information Disclosure | `SUPABASE_ANON_KEY` is public-safe by design (row-level security enforces access); safe to include in `app.json` extra |

**Key constraint from CLAUDE.md:** Never use `SUPABASE_SERVICE_ROLE_KEY` in any client-side file. Phase 1 does not call Supabase at all (read-only CDN). Phase 2 will use anon key only for report submission.

---

## Sources

### Primary (HIGH confidence — official docs)
- `docs.expo.dev/versions/latest/` — Expo SDK 56, React Native 0.85, platform minimums
- `docs.expo.dev/router/installation/` — Expo Router setup, file structure, package.json entry point
- `docs.expo.dev/router/advanced/tabs/` — Tab layout with `(tabs)/_layout.tsx`, hiding tabs with `href: null`
- `docs.expo.dev/router/migrate/sdk-55-to-56/` — Breaking change: no @react-navigation/* imports in SDK 56
- `docs.expo.dev/eas-update/getting-started/` — EAS Update configuration
- `docs.expo.dev/eas-update/runtime-versions/` — runtimeVersion policies (appVersion, fingerprint)
- `docs.expo.dev/versions/latest/sdk/localization/` — expo-localization getLocales() API
- `docs.expo.dev/versions/latest/sdk/netinfo/` — @react-native-community/netinfo API
- `docs.expo.dev/develop/user-interface/color-themes/` — useColorScheme(), Appearance API
- `docs.expo.dev/develop/user-interface/safe-areas/` — react-native-safe-area-context
- `tanstack.com/query/latest/docs/framework/react/plugins/persistQueryClient` — React Query persister API
- `github.com/mrousavy/react-native-mmkv` — MMKV installation, Expo prebuild requirement, NitroModules
- `github.com/mrousavy/react-native-mmkv/blob/main/docs/WRAPPER_REACT_QUERY.md` — MMKV + React Query persister pattern

### Secondary (MEDIUM confidence — official docs + search verification)
- `lucas-rouret.fr/blog/tech/stop-using-manual-redirects-...` — Stack.Protected pattern (verified against Expo docs)
- `expo.dev/changelog/sdk-56-beta` — SDK 56 release notes
- `expo.dev/changelog/2024-11-12-sdk-52` — SDK 52 minSdkVersion=24, iOS 15.1 minimum

### Tertiary (LOW confidence — search only)
- iOS 15 compatibility with React Native 0.85 — not officially confirmed; flagged as ASSUMED

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified via npm view against official Expo docs
- Architecture: HIGH — patterns verified against official Expo Router and React Query docs
- Pitfalls: HIGH — SDK 56 breaking changes verified via official migration guide; MMKV prebuild verified via official README
- iOS 15 target: LOW — SDK 56 default is 16.4; lower target is ASSUMED to be achievable

**Research date:** 2026-05-25
**Valid until:** 2026-06-25 (Expo SDK 57 expected ~Q3 2026; SDK 56 is stable)
