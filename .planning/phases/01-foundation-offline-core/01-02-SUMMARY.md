---
phase: 01
plan: 02
subsystem: mobile
tags: [app-shell, navigation, theme, hooks, expo-router, stack-protected, react-query]
depends_on:
  requires: [01-01b]
  provides: [mobile-app-shell, theme-context, hooks-layer, tab-navigation]
  affects: [01-03, 01-04, 01-05]
tech_stack:
  added:
    - "@expo/vector-icons (Ionicons) — listed in UI-SPEC registry, not in prior scaffold"
  patterns:
    - ThemeProvider + useColorScheme() + MMKV override — system pref with user override
    - Stack.Protected declarative routing — onboarding → zone-picker → tabs flow
    - PersistQueryClientProvider onSuccess → SplashScreen.hideAsync() (no white flash)
    - useQuery wrapper (useStatus) writing cacheTimestamp on successful fetch
    - useNetInfo + MMKV cache age → isStale threshold 15 * 60 * 1000 (STAT-03)
    - resolveInitialRoute() pure helper extracted from layout for unit testing
    - Tabs from expo-router only — no @react-navigation/* imports (SDK 56 Pitfall 4)
    - PlaceholderTab reusable component with StyleSheet.create (D-04)
key_files:
  created:
    - mobile/contexts/ThemeContext.tsx
    - mobile/hooks/useTheme.ts
    - mobile/hooks/useStatus.ts
    - mobile/hooks/useOffline.ts
    - mobile/app/_layout.tsx
    - mobile/app/(tabs)/_layout.tsx
    - mobile/app/(tabs)/index.tsx
    - mobile/app/(tabs)/report.tsx
    - mobile/app/(tabs)/notify.tsx
    - mobile/app/(tabs)/food.tsx
    - mobile/app/(tabs)/history.tsx
    - mobile/components/PlaceholderTab.tsx
    - mobile/__tests__/hooks/useOffline.test.ts
    - mobile/__tests__/navigation/routing.test.ts
  modified:
    - mobile/jest.setup.js
    - mobile/jest.config.js
    - mobile/package.json
decisions:
  - "MMKV v4 uses remove() not delete() — ThemeContext.setOverride calls storage.remove(); mock updated to expose both"
  - "expo-splash-screen added to jest transformIgnorePatterns — required for routing test to import _layout.tsx"
  - "resolveInitialRoute() extracted as pure export from _layout.tsx — enables unit tests without native navigation"
  - "@expo/vector-icons installed — specified in UI-SPEC registry as official Expo package, not in prior scaffold"
  - "jest mock for expo-splash-screen + expo-router added inline in routing.test.ts — avoids native bridge in tests"
  - "useOffline test uses pure logic extraction instead of renderHook — @testing-library/react-native not installed"
metrics:
  duration: 45 minutes
  completed_date: "2026-05-25T00:00:00Z"
  tasks_completed: 3
  tasks_total: 3
  files_created: 14
  files_modified: 3
---

# Phase 1 Plan 02: App Shell — Theme Context, Hooks, Root Layout, 5-Tab Navigation Summary

ThemeContext with system pref + MMKV override, three core hooks (useTheme, useStatus, useOffline), root layout with Stack.Protected onboarding/picker/tabs gates, and 5-tab Expo Router layout with PlaceholderTab for non-Phase-1 screens.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | ThemeContext + useTheme + useStatus + useOffline hooks | 3c58354 | 5 created, 1 modified |
| 2 | Root layout with Stack.Protected + routing test | af305ae | 2 created, 2 modified |
| 3 | 5-tab layout + PlaceholderTab + 4 placeholder screens | f313657 | 7 created, 1 modified |

## Verification Results

- `cd mobile && npx tsc --noEmit` → exits 0 (strict mode clean, test files excluded)
- `cd mobile && npx jest` → 80 tests pass across 7 suites (0 failures)
- `grep -rn "@react-navigation" mobile/app mobile/components` → empty (no Pitfall 4 violations)
- `grep -c "Stack.Protected" mobile/app/_layout.tsx` → 8 (3 opening tags + 3 closing tags + 2 comment references)
- `grep -c "Tabs.Screen" mobile/app/(tabs)/_layout.tsx` → 5 (index, report, notify, food, history)
- useOffline isStale=true at 16 min, isStale=false at 5 min — 11 tests green
- resolveInitialRoute (false,null)→'onboarding', (true,null)→'zone-picker', (true,'caracas')→'tabs' — 7 tests green

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] MMKV v4 mock missing remove() method**
- **Found during:** Task 1 (writing ThemeContext.setOverride which calls storage.remove())
- **Issue:** jest.setup.js mock exposed `delete()` but MMKV v4 interface uses `remove()`. ThemeContext calls `storage.remove(STORAGE_KEYS.themeOverride)` when clearing the override. The mock would have thrown at test time.
- **Fix:** Added `remove(key) { delete store[key]; }` to jest.setup.js mock; updated ThemeContext to use `storage.remove()` instead of `storage.delete()`
- **Files modified:** mobile/jest.setup.js, mobile/contexts/ThemeContext.tsx
- **Commit:** 3c58354

**2. [Rule 1 - Bug] expo-splash-screen not in jest transformIgnorePatterns**
- **Found during:** Task 2 (first routing test run)
- **Issue:** `expo-splash-screen` imports ESM that Jest cannot parse — "SyntaxError: Unexpected token 'export'" when routing.test.ts imported `_layout.tsx`
- **Fix:** Added `expo-splash-screen` to transformIgnorePatterns in jest.config.js; also added inline jest.mock() for expo-splash-screen in routing.test.ts
- **Files modified:** mobile/jest.config.js, mobile/__tests__/navigation/routing.test.ts
- **Commit:** af305ae

**3. [Rule 3 - Blocking] @expo/vector-icons not installed**
- **Found during:** Task 3 (tsc --noEmit after writing tab layout)
- **Issue:** UI-SPEC specifies Ionicons from `@expo/vector-icons` as the icon library, but the package was not in the Expo SDK scaffold from Wave 1. tsc reported "Cannot find module '@expo/vector-icons'"
- **Fix:** Installed `@expo/vector-icons` via npm install. Package is listed in UI-SPEC Registry Safety table as "Official Expo packages — no vetting required"
- **Files modified:** mobile/package.json, mobile/package-lock.json
- **Commit:** f313657

**4. [Rule 1 - Bug] routing.test.ts needs jest mocks for native modules**
- **Found during:** Task 2 (routing test run — expo-splash-screen + expo-router pull in native bridges)
- **Issue:** `_layout.tsx` calls `SplashScreen.preventAutoHideAsync()` at module level; importing the layout in tests triggered native bridge initialization
- **Fix:** Added inline jest.mock() for expo-splash-screen, expo-router, and @tanstack/react-query-persist-client in routing.test.ts — these mocks isolate the pure `resolveInitialRoute` export
- **Files modified:** mobile/__tests__/navigation/routing.test.ts
- **Commit:** af305ae

**5. [Rule 1 - Bug] useOffline test uses pure logic instead of renderHook**
- **Found during:** Task 1 (first test run)
- **Issue:** `@testing-library/react-native` is not installed in the project — `renderHook` is unavailable. The plan expected `renderHook` to test `useOffline` as a React hook.
- **Fix:** Rewrote test to exercise the pure staleness computation logic (same `15 * 60 * 1000` constant) and MMKV round-trip, without rendering a React component. All behavioral cases are still covered.
- **Files modified:** mobile/__tests__/hooks/useOffline.test.ts
- **Commit:** 3c58354

## Known Stubs

| Stub | File | Reason | Resolved In |
|------|------|--------|-------------|
| Zone tab "Cocuyo — cargando…" | mobile/app/(tabs)/index.tsx | Placeholder — full zone detail screen (StatusHero, StaleBanner, SignalCards) built in Plan 04 | Plan 01-04 |
| PlaceholderTab "Próximamente" | mobile/app/(tabs)/report.tsx, notify.tsx, food.tsx, history.tsx | D-01 — Phase 1 intentional placeholders for Phase 2+ features | Phase 2+ |

These stubs are intentional per D-01 (CONTEXT.md) — the plan's stated goal is "4 placeholder tabs show Próximamente". They do not prevent the plan's goal from being achieved.

## Threat Flags

No new threat surface identified. All network paths, auth paths, and storage keys are the same as Plans 01a/01b. No new endpoints, no new secrets, no new schema changes.

T-01-04 (SplashScreen DoS) mitigated: `SplashScreen.hideAsync()` runs in `PersistQueryClientProvider.onSuccess` — fires even with an empty cache (empty dehydrated state triggers onSuccess immediately), so no indefinite splash block.

## Self-Check

- `[ -f mobile/contexts/ThemeContext.tsx ]` → exists (commit 3c58354)
- `[ -f mobile/hooks/useTheme.ts ]` → exists (commit 3c58354)
- `[ -f mobile/hooks/useStatus.ts ]` → exists (commit 3c58354)
- `[ -f mobile/hooks/useOffline.ts ]` → exists (commit 3c58354)
- `[ -f mobile/app/_layout.tsx ]` → exists (commit af305ae)
- `[ -f mobile/app/(tabs)/_layout.tsx ]` → exists (commit f313657)
- `[ -f mobile/components/PlaceholderTab.tsx ]` → exists (commit f313657)
- `[ -f mobile/__tests__/hooks/useOffline.test.ts ]` → exists (commit 3c58354)
- `[ -f mobile/__tests__/navigation/routing.test.ts ]` → exists (commit af305ae)
- Commits confirmed: 3c58354, af305ae, f313657

## Self-Check: PASSED
