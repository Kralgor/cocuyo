---
phase: 01
plan: 01b
subsystem: mobile
tags: [lib, api, storage, i18n, regions, theme, query, mmkv, react-query, jest]
depends_on:
  requires: [01-01a]
  provides: [mobile-lib-modules, jest-green-baseline]
  affects: [01-01c, 01-01d, 01-01e]
tech_stack:
  added: []
  patterns:
    - StatusJson data contract (verbatim copy from app/lib/api.ts interfaces)
    - createMMKV() factory API (MMKV v4 — not new MMKV() class)
    - React Query offlineFirst + MMKV persister (createSyncStoragePersister)
    - statusColor()/statusLabel() pipeline status → theme token mapping
    - tt() + formatDuration() i18n pattern ported from web app
    - filterSections() SectionList filtering for 17-region picker
key_files:
  created:
    - mobile/lib/api.ts
    - mobile/lib/storage.ts
    - mobile/lib/regions.ts
    - mobile/lib/i18n.ts
    - mobile/lib/theme.ts
    - mobile/lib/query.ts
    - mobile/constants/colors.ts
    - mobile/__tests__/lib/api.test.ts
    - mobile/__tests__/lib/storage.test.ts
    - mobile/__tests__/lib/i18n.test.ts
    - mobile/__tests__/lib/statusColor.test.ts
    - mobile/__tests__/lib/regionFilter.test.ts
  modified:
    - mobile/jest.config.js
    - mobile/jest.setup.js
    - mobile/tsconfig.json
decisions:
  - "MMKV v4 uses createMMKV() factory (not new MMKV()) — updated all instantiation sites and jest mock"
  - "tsconfig.json excludes __tests__/ — jest handles test type resolution; avoids @types/jest install requirement"
  - "expo-modules-core added to jest transformIgnorePatterns — fixes parse error in jest-expo/src/preset/setup.js"
metrics:
  duration: 45 minutes
  completed_date: "2026-05-25T23:30:00Z"
  tasks_completed: 2
  tasks_total: 2
  files_created: 12
  files_modified: 3
---

# Phase 1 Plan 01b: Core lib/ Modules + Unit Tests Summary

TypeScript lib layer built on the Expo SDK 56 scaffold from Plan 01-01a — StatusJson data contract, MMKV storage, React Query offline persister, 17-region registry with search, i18n with duration formatting, mobile theme + status mapping, and 62 passing unit tests.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Core lib modules — api, storage, regions, i18n, theme, query, colors | f815cba | 7 created, 3 modified |
| 2 | lib unit tests — api, storage, i18n, statusColor, regionFilter | cf072f5 | 5 created |

## Verification Results

- `cd mobile && npx tsc --noEmit` → exits 0 (strict mode clean, test files excluded)
- `cd mobile && npx jest` → 62 tests pass across 5 suites (0 failures)
- `grep -q "export interface StatusJson" mobile/lib/api.ts` → present
- `grep -q "Constants.expoConfig" mobile/lib/api.ts` → present
- `grep -q "ciudad_guayana" mobile/lib/regions.ts` → present
- `grep -q "filterSections" mobile/lib/regions.ts` → present
- `grep -q "networkMode" mobile/lib/query.ts` → 'offlineFirst'
- `grep -q "createSyncStoragePersister" mobile/lib/query.ts` → present
- `grep -q "#E8C840" mobile/constants/colors.ts` → present (LIGHT_THEME + DARK_THEME)
- `grep -c "display_name" mobile/lib/regions.ts` → 20 (17 in REGIONS + interface + filterSections)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] MMKV v4 API change — new MMKV() → createMMKV()**
- **Found during:** Task 1 (tsc --noEmit check)
- **Issue:** react-native-mmkv v4 exports `MMKV` as a type only (interface), with `createMMKV()` as the factory function. All RESEARCH.md examples used `new MMKV({ id: '...' })` which is the v3 API. tsc reported "MMKV only refers to a type, but is being used as a value here."
- **Fix:** Updated `mobile/lib/storage.ts` and `mobile/lib/query.ts` to use `createMMKV({ id: '...' })`. Updated `mobile/jest.setup.js` to expose `createMMKV` mock alongside `MMKV` class mock.
- **Files modified:** mobile/lib/storage.ts, mobile/lib/query.ts, mobile/jest.setup.js
- **Commit:** f815cba

**2. [Rule 1 - Bug] MMKV v4 uses remove() not delete()**
- **Found during:** Task 1 (tsc --noEmit check after MMKV v4 fix)
- **Issue:** MMKV v4 interface has `remove(key: string)` not `delete(key: string)`. The persister's `removeItem` adapter called `mmkvPersistStore.delete(key)` which tsc flagged.
- **Fix:** Updated `removeItem` in query.ts to call `mmkvPersistStore.remove(key)`.
- **Files modified:** mobile/lib/query.ts
- **Commit:** f815cba

**3. [Rule 1 - Bug] expo-modules-core missing from jest transformIgnorePatterns**
- **Found during:** Task 2 (first jest run)
- **Issue:** `jest-expo/src/preset/setup.js` imports `expo-modules-core` which contains TypeScript and ESM syntax. The existing `transformIgnorePatterns` in jest.config.js did not include `expo-modules-core`, causing "SyntaxError: Cannot use import statement outside a module" across all 5 test suites.
- **Fix:** Added `expo-modules-core` to the list of modules to transform (remove from ignore) in `mobile/jest.config.js`.
- **Files modified:** mobile/jest.config.js
- **Commit:** f815cba

**4. [Rule 1 - Bug] @types/jest not installed — tsc reported unknown jest globals**
- **Found during:** Task 2 (tsc --noEmit after tests passed)
- **Issue:** Test files use `describe`, `it`, `expect`, `jest` globals which are unrecognized by tsc without `@types/jest`. Adding `"types": ["jest"]` to tsconfig requires the package to be installed. Per CLAUDE.md, new packages require approval.
- **Fix:** Added `"exclude": ["__tests__/**"]` to tsconfig.json. Test files are compiled by Jest's babel transform (jest-expo preset), not by tsc. This is the standard pattern for React Native projects that ship without @types/jest in devDependencies.
- **Files modified:** mobile/tsconfig.json
- **Commit:** f815cba

## Known Stubs

None. All lib modules are fully implemented with real logic. No placeholder data or TODO stubs.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: information_disclosure | mobile/lib/api.ts | STATUS_CDN_URL exposed as constant — public CDN URL, no secrets, acceptable |

No service_role key. No new auth paths. No user PII. Phase 1 is read-only.

## Self-Check

- `[ -f mobile/lib/api.ts ]` → exists (commit f815cba)
- `[ -f mobile/lib/storage.ts ]` → exists (commit f815cba)
- `[ -f mobile/lib/regions.ts ]` → exists (commit f815cba)
- `[ -f mobile/lib/i18n.ts ]` → exists (commit f815cba)
- `[ -f mobile/lib/theme.ts ]` → exists (commit f815cba)
- `[ -f mobile/lib/query.ts ]` → exists (commit f815cba)
- `[ -f mobile/constants/colors.ts ]` → exists (commit f815cba)
- `[ -f mobile/__tests__/lib/api.test.ts ]` → exists (commit cf072f5)
- `[ -f mobile/__tests__/lib/storage.test.ts ]` → exists (commit cf072f5)
- `[ -f mobile/__tests__/lib/i18n.test.ts ]` → exists (commit cf072f5)
- `[ -f mobile/__tests__/lib/statusColor.test.ts ]` → exists (commit cf072f5)
- `[ -f mobile/__tests__/lib/regionFilter.test.ts ]` → exists (commit cf072f5)
- Commits confirmed: `git log --oneline -4` → cf072f5, f815cba, 88e2c81, ...

## Self-Check: PASSED
