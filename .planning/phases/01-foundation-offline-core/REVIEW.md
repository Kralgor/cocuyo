---
phase: 01-foundation-offline-core
reviewed: 2026-06-08T00:00:00Z
depth: deep
files_reviewed: 30
files_reviewed_list:
  - mobile/lib/api.ts
  - mobile/lib/storage.ts
  - mobile/lib/query.ts
  - mobile/lib/regions.ts
  - mobile/lib/i18n.ts
  - mobile/lib/theme.ts
  - mobile/hooks/useStatus.ts
  - mobile/hooks/useOffline.ts
  - mobile/hooks/useTheme.ts
  - mobile/contexts/ThemeContext.tsx
  - mobile/app/_layout.tsx
  - mobile/app/index.tsx
  - mobile/app/onboarding.tsx
  - mobile/app/zone-picker.tsx
  - mobile/app/(tabs)/_layout.tsx
  - mobile/app/(tabs)/index.tsx
  - mobile/app/(tabs)/food.tsx
  - mobile/app/(tabs)/report.tsx
  - mobile/app/(tabs)/notify.tsx
  - mobile/app/(tabs)/history.tsx
  - mobile/components/StatusHero.tsx
  - mobile/components/StaleBanner.tsx
  - mobile/components/SignalCard.tsx
  - mobile/components/SettingsModal.tsx
  - mobile/components/ZonePicker.tsx
  - mobile/components/PlaceholderTab.tsx
  - mobile/constants/colors.ts
findings:
  critical: 2
  warning: 6
  info: 5
  total: 13
status: blockers_resolved
resolution:
  date: 2026-06-08
  commit: 93856e8
  resolved: [CR-01, CR-02, WR-03]
  also_fixed: ["verifier WARNING: updates.url restored"]
  deferred: [WR-01, WR-02, WR-04, WR-05, WR-06, IN-01, IN-02, IN-03, IN-04, IN-05]
---

# Phase 1: Code Review Report

> **Resolution (2026-06-08, commit `93856e8`):** Both BLOCKERS fixed with
> regression tests (suite now 93 green, tsc clean). CR-01 — guards made
> reactive via `useMMKVBoolean`/`useMMKVString`, routed through the tested
> `resolveInitialRoute` helper. CR-02 — pure `computeStaleness` helper with a
> `hasCache` state; banner gated on `hasCache`; `useOffline` test rewritten to
> exercise the real helper plus never-fetched cases. WR-03 (stuck refresh
> spinner) also fixed; verifier's `updates.url` WARNING closed. WR-01/02/04/05/06
> and all INFO items are non-blocking and deferred — tracked below for a later
> polish pass.

**Reviewed:** 2026-06-08
**Depth:** deep
**Files Reviewed:** 27 source files (+ 3 test files cross-referenced)
**Status:** issues_found

## Summary

Phase 1 of Cocuyo Mobile delivers the offline-first foundation: status fetch, MMKV persistence, React Query + persister wiring, theming, i18n, the onboarding/zone-picker/tabs navigation gate, and the zone-detail home screen. The code is clean, well-commented, and adheres to most project rules (no `any`, functional components only, no service_role key, `device_fingerprint` absent, only one CDN file read). Library API facts were verified against installed versions: `react-native-mmkv@4.3.1` does export `createMMKV` and uses `remove()` (both used correctly), and `Stack.Protected` exists in `expo-router@56.2.6`.

However, two BLOCKERS were found. The most serious is the navigation guard architecture: `app/_layout.tsx` reads the MMKV guard values into plain (non-reactive) constants, while `onboarding.tsx` and `zone-picker.tsx` mutate those same MMKV keys with `storage.set()` and rely on "Stack.Protected re-renders" to advance. MMKV writes do NOT trigger a React re-render, so `RootLayout` never re-evaluates its guards and the app gets stuck on the onboarding/zone-picker screen until a manual reload. This contradicts the explicit comments in those files and breaks the core first-launch flow. The second blocker is a staleness-age display bug that renders an epoch-scale minute count to users on first launch / when the cache is empty.

The remaining findings are correctness and quality concerns: a side-effecting MMKV write inside a React Query `queryFn`, a settings sheet that can overflow without scrolling, dead i18n keys, and a few minor type-safety and accessibility items.

## Critical Issues

### CR-01: Navigation guards never re-evaluate after MMKV write — first-launch flow is stuck

**File:** `mobile/app/_layout.tsx:35-38`, `mobile/app/onboarding.tsx:56-58`, `mobile/app/zone-picker.tsx:18-20`
**Issue:**
`RootLayout` reads guard inputs into non-reactive local constants:
```ts
const hasSeenOnboarding: boolean = storage.getBoolean(STORAGE_KEYS.hasSeenOnboarding) ?? false;
const selectedZone: string | null = storage.getString(STORAGE_KEYS.selectedZone) ?? null;
```
These values are passed to `<Stack.Protected guard={...}>`. The onboarding and zone-picker screens advance by writing MMKV directly:
```ts
function handleComplete(): void { storage.set(STORAGE_KEYS.hasSeenOnboarding, true); } // onboarding.tsx
function handleSelect(zoneKey: string): void { storage.set(STORAGE_KEYS.selectedZone, zoneKey); } // zone-picker.tsx
```
The in-code comments claim "Stack.Protected guard in _layout.tsx re-evaluates synchronously and advances." This is false. `storage.set()` mutates native storage but does NOT notify React — `RootLayout` holds no state subscribed to those keys (no `useState`, no `useMMKV`/`useMMKVBoolean`/`useMMKVString` hook, no listener). With no state change, `RootLayout` does not re-render, the `guard` props keep their stale values, and the user remains on the onboarding screen (and then zone-picker) until the app is force-reloaded. This breaks the primary first-run experience (TRST-01 → D-10 → tabs) end to end.

Note the `routing.test.ts` suite only exercises the pure `resolveInitialRoute` helper — which `_layout.tsx` does not actually call — so the green tests give false confidence; the real guard wiring is untested.

**Fix:** Make the guard inputs reactive so a write triggers a re-render. Use MMKV's reactive hooks in the layout:
```ts
import { useMMKVBoolean, useMMKVString } from 'react-native-mmkv';
import { storage } from '@/lib/storage';

export default function RootLayout() {
  const [hasSeenOnboarding] = useMMKVBoolean(STORAGE_KEYS.hasSeenOnboarding, storage);
  const [selectedZone]      = useMMKVString(STORAGE_KEYS.selectedZone, storage);

  const guardOnboarding = !hasSeenOnboarding;
  const guardZonePicker = !!hasSeenOnboarding && !selectedZone;
  const guardTabs       = !!hasSeenOnboarding && !!selectedZone;
  // ...pass these to Stack.Protected
}
```
The screens can keep writing via `storage.set(...)`; the hooks observe the change and re-render `RootLayout`. (`resolveInitialRoute` can stay as a tested pure helper, but `_layout.tsx` should actually use it: `resolveInitialRoute(!!hasSeenOnboarding, selectedZone ?? null)`.)

### CR-02 (BLOCKER tier): Staleness banner shows epoch-scale minutes on first launch / empty cache

**File:** `mobile/hooks/useOffline.ts:22-30`, surfaced in `mobile/components/StaleBanner.tsx:37` and `mobile/app/(tabs)/index.tsx:106,175`
**Issue:**
```ts
const lastFetch = storage.getNumber(STORAGE_KEYS.cacheTimestamp) ?? 0;
const ageMs = Date.now() - lastFetch;
const isStale = ageMs > 15 * 60 * 1000;
return { isOffline, isStale, ageMinutes: Math.floor(ageMs / 60_000) };
```
When no successful fetch has ever written `cacheTimestamp` (true first launch, or offline first launch), `lastFetch` defaults to `0`. `ageMs` then equals `Date.now()` (≈ 1.7e12 ms), and `ageMinutes` becomes ≈ 29,000,000. `isStale` is correctly `true`, so the `StaleBanner` renders with text like "Última actualización hace 29024691 min — sin conexión", which is user-facing nonsense. The home screen only suppresses the banner via `showFirstError`/`showSkeleton` in the hero area, but `StaleBanner` itself (line 106) renders whenever `isOffline || isStale`, independent of those flags.

**Fix:** Treat "never fetched" as a distinct state and clamp/guard the age:
```ts
const stored = storage.getNumber(STORAGE_KEYS.cacheTimestamp);
const hasCache = typeof stored === 'number' && stored > 0;
const ageMs = hasCache ? Date.now() - stored : 0;
const isStale = hasCache && ageMs > 15 * 60 * 1000;
return { isOffline, isStale, hasCache, ageMinutes: Math.floor(ageMs / 60_000) };
```
Then in `index.tsx`, gate the banner on real data: `const showBanner = (isOffline || isStale) && hasCache;` (first-launch-no-data is already handled by `showFirstError`). This prevents the absurd minute count and avoids a stale banner before any fetch has succeeded.

## Warnings

### WR-01: Side-effecting MMKV write inside React Query `queryFn`

**File:** `mobile/hooks/useStatus.ts:22-32`
**Issue:** The `queryFn` performs a write (`storage.set(STORAGE_KEYS.cacheTimestamp, Date.now())`) as a side effect of fetching. `queryFn` may run in contexts where the write is misleading: with `networkMode: 'offlineFirst'` and `retry: 3`, a successful refetch updates the timestamp, but the timestamp represents "last network success," not "data freshness from the pipeline." More importantly, mixing a storage mutation into the fetch function couples staleness state to query internals and makes the timestamp untestable in isolation. If React Query ever serves a deduped/structural-shared result without re-running `queryFn`, the timestamp can drift from reality.
**Fix:** Move the timestamp write to a success observer so it reflects committed query success:
```ts
const query = useQuery({ queryKey: ['status'], queryFn });
useEffect(() => {
  if (query.isSuccess && query.dataUpdatedAt) {
    storage.set(STORAGE_KEYS.cacheTimestamp, query.dataUpdatedAt);
  }
}, [query.isSuccess, query.dataUpdatedAt]);
```
This ties the timestamp to React Query's own `dataUpdatedAt`, which is the canonical freshness signal.

### WR-02: Settings bottom sheet is fixed-height and non-scrollable — content overflow / inline ZonePicker clipping

**File:** `mobile/components/SettingsModal.tsx:100-183` (sheet `View`), styles `sheet` (`:200-210`) and `zonePickerContainer` (`:272-277`)
**Issue:** The sheet is a plain `View` at `height: '70%'` with no `ScrollView`. It stacks: header, separator, zone section + 240dp inline `ZonePicker`, appearance segmented control, and the privacy section + GitHub link. On smaller devices (or when the 240dp picker is expanded), the combined content height exceeds 70% of the screen, and because there is no scroll container, the bottom rows (privacy text, GitHub link) and/or the picker are clipped and unreachable. The GitHub link is a TRST-02 trust affordance — clipping it is a functional regression.
**Fix:** Wrap the sheet body in a `ScrollView` (or render the zone picker as a separate full-screen route/modal rather than inline). Minimum: `<ScrollView style={{ flex: 1 }} contentContainerStyle={...}>` around sections B–D so content remains reachable when the inline picker expands.

### WR-03: Pull-to-refresh swallows `refetch` rejection — `refreshing` can stick on error

**File:** `mobile/app/(tabs)/index.tsx:68-72`
**Issue:**
```ts
async function handleRefresh() {
  setRefreshing(true);
  await refetch();
  setRefreshing(false);
}
```
`useStatus().refetch` is typed as `() => void` here but is actually React Query's refetch (returns a promise that rejects when the query errors after retries, because `queryFn` throws on failed fetch). An awaited rejection throws out of `handleRefresh`, skipping `setRefreshing(false)` and leaving the spinner stuck until the next render cycle. The narrowed `() => void` return type in `useStatus` also hides the promise from callers.
**Fix:** Guard with try/finally and surface the real return type:
```ts
async function handleRefresh() {
  setRefreshing(true);
  try { await refetch(); } finally { setRefreshing(false); }
}
```
Also widen `useStatus`'s `refetch` type to the actual `() => Promise<unknown>` (or the React Query `RefetchFn`) instead of `() => void`.

### WR-04: `detectLang()` duplicated in 6 components and recomputed every render

**File:** `mobile/app/onboarding.tsx:24-28`, `mobile/app/(tabs)/index.tsx:26-30`, `mobile/components/StatusHero.tsx:11-15`, `mobile/components/StaleBanner.tsx:10-14`, `mobile/components/SignalCard.tsx:10-14`, `mobile/components/ZonePicker.tsx:24-28`, `mobile/components/PlaceholderTab.tsx:12-16`, `mobile/components/SettingsModal.tsx:20-24`
**Issue:** The exact same `detectLang()` function is copy-pasted into eight files. Besides the duplication (one fix must be applied in eight places), it is invoked in the render body of every component on every render, calling `getLocales()` each time. There is no single source of truth for the active language, and a future locale-toggle feature would have to touch every file. This is the kind of cross-cutting helper CLAUDE.md's i18n layer (`lib/i18n.ts`) should own.
**Fix:** Export `detectLang()` (or a `useLang()` hook) once from `mobile/lib/i18n.ts` and import it everywhere. Memoize at a context boundary if language can change at runtime.

### WR-05: Unsafe double cast on theme override read

**File:** `mobile/contexts/ThemeContext.tsx:27`
**Issue:**
```ts
const storedOverride = storage.getString(STORAGE_KEYS.themeOverride) as 'light' | 'dark' | null ?? null;
```
`getString` returns `string | undefined`. Casting an arbitrary stored string straight to the literal union `'light' | 'dark'` defeats strict typing (CLAUDE.md: "TypeScript strict mode, no any types" — and unchecked assertions are the same hazard). If MMKV ever holds a corrupted/legacy value (e.g. `'auto'`), it silently flows through as a valid union member; `effective` then falls to the `=== 'light' ? LIGHT : DARK` branch and is treated as dark, masking the bad data. Operator precedence is also fragile: `as ... ?? null` reads awkwardly and depends on `as` binding tighter than `??`.
**Fix:** Validate explicitly instead of asserting:
```ts
const raw = storage.getString(STORAGE_KEYS.themeOverride);
const storedOverride: 'light' | 'dark' | null =
  raw === 'light' || raw === 'dark' ? raw : null;
```

### WR-06: `ZonePicker.renderItem` assumes `REGIONS[key]` is defined

**File:** `mobile/components/ZonePicker.tsx:71-93`
**Issue:**
```ts
const region = REGIONS[key];
// ...
const a11yLabel = `${region.display_name}, ${statusText}`;
// ...
<Text style={styles.zoneName}>{region.display_name}</Text>
```
`REGIONS` is typed `Record<string, RegionMeta>`, so indexing returns `RegionMeta` even when the key is absent — strict mode does not flag it because `noUncheckedIndexedAccess` is not enabled (verify in tsconfig). The list keys come from `ZONE_SECTIONS`, which is currently in sync with `REGIONS`, but `filterSections` (`lib/regions.ts:158-160`) already null-guards `REGIONS[key]` precisely because a desync is possible. If a section key ever lacks a `REGIONS` entry, `renderItem` dereferences `undefined.display_name` and crashes the picker. The two code paths disagree on whether the lookup can be missing.
**Fix:** Mirror the `filterSections` guard:
```ts
const region = REGIONS[key];
if (!region) return null;
```
and/or enable `noUncheckedIndexedAccess` in `tsconfig.json` to force this check everywhere.

## Info

### IN-01: Dead i18n keys `duration_label_es` / `duration_label_min`

**File:** `mobile/lib/i18n.ts:36-37`
**Issue:** These two keys are never referenced — `StatusHero` formats durations via `formatDuration()` (i18n.ts:100), not via `tt('duration_label_*')`. Their EN strings ("{X}h {Y}m without power") also embed an `{X}`/`{Y}` template that nothing fills. Dead strings drift out of sync with the real formatter.
**Fix:** Remove the unused keys, or route `formatDuration` through them if templated copy is the intended design.

### IN-02: `StatusHero`/`StaleBanner`/`SignalCard` use `accessibilityRole="none"` with an `accessibilityLabel`

**File:** `mobile/components/StatusHero.tsx:82-83`, `mobile/components/StaleBanner.tsx:50-51`, `mobile/components/SignalCard.tsx:68-69`
**Issue:** Setting `accessibilityRole="none"` while also providing an `accessibilityLabel` is contradictory: `role="none"` signals "not an accessibility element," which can cause some screen readers to skip the label entirely. The hero status, the stale warning, and signal values are exactly the content blind users most need announced.
**Fix:** Use `accessibilityRole="text"` (or omit the role and set `accessible={true}`) on these labeled views so the label is reliably surfaced.

### IN-03: `app/index.tsx` placeholder text is untranslated and unstyled by theme

**File:** `mobile/app/index.tsx:4-9`
**Issue:** The fallback index screen renders hardcoded `"Cocuyo — cargando..."` with no theme background (default white). During the brief window before guards resolve, dark-theme users may see a white flash, and the string bypasses the i18n layer. Minor since the splash usually covers this, but it is an inconsistency with the rest of the app.
**Fix:** Use `tt('...')` and apply `theme.bg`, or remove the route if Stack.Protected always redirects away from it.

### IN-04: `SettingsModal` zone row shows raw region key, not display name

**File:** `mobile/components/SettingsModal.tsx:60,126-128`
**Issue:** `selectedZone` is the canonical key (`'ciudad_guayana'`) read straight from MMKV and rendered as the current-zone label. The home header (`index.tsx:88`) correctly prefers `region?.display_name`. Settings shows the snake_case key to the user, e.g. "ciudad_guayana" instead of "Ciudad Guayana (Bolívar)".
**Fix:** `REGIONS[selectedZone]?.display_name ?? tt('settings_zone_change', lang)`.

### IN-05: `formatDuration` negative/`NaN` inputs unhandled

**File:** `mobile/lib/i18n.ts:100-106`
**Issue:** Only `min == null` is special-cased. A negative `elapsed_minutes` (clock skew between device and pipeline `started_at`) or `NaN` (malformed status.json) would produce strings like "-1 h 59 min" or "NaN min". Low risk given the data contract, but the function is a pure utility that should be defensive.
**Fix:** `if (min == null || !Number.isFinite(min) || min < 0) return '—';`

---

_Reviewed: 2026-06-08_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
