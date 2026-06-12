phase: 02
plan: 05
subsystem: mobile-battery-sync-theme
tags: [amoled, battery, queue-sync, react-query, netinfo]
depends_on: [02-01, 02-02, 02-03]
provides: [amoled-theme, battery-hook, adaptive-status-refresh, report-queue-sync-hook]
affects: [02-06, 02-07]
tech_stack:
  added: []
  patterns:
    - Theme override supports light, dark, amoled, and null
    - Queue flushing is gated on isConnected and isInternetReachable === true
    - Status polling interval can be injected by battery-aware UI code
key_files:
  created:
    - mobile/hooks/useBattery.ts
    - mobile/hooks/useReportQueue.ts
  modified:
    - mobile/constants/colors.ts
    - mobile/contexts/ThemeContext.tsx
    - mobile/hooks/useStatus.ts
    - mobile/__tests__/lib/amoled.test.ts
key_decisions:
  - Added surface/text aliases on AMOLED_THEME for compatibility with the seeded test while preserving panel/ink app tokens.
  - Exposed isBatterySaving and isLowPower from useBattery so plan semantics and test compatibility both hold.
  - Kept useReportQueue strict about isInternetReachable === true to avoid captive-portal false positives.
requirements_completed: [BATT-01, BATT-02, REPT-03]
duration: 45m
completed: 2026-06-12

# Phase 02 Plan 05: AMOLED, Battery, and Queue Sync Summary

AMOLED theming, battery state detection, adaptive status polling, and queue auto-sync hooks are implemented and covered by the full mobile test suite.

## What Changed

- Added `AMOLED_THEME` with true black background and dark panel override.
- Extended `ThemeContext` override type and theme selection for `amoled`.
- Added `useBattery()` with battery-level subscription and low-power detection.
- Extended `useStatus(refreshInterval?)` to pass `refetchInterval` through React Query.
- Added `useReportQueue()` to flush queued reports on connectivity return and app foreground when internet reachability is confirmed.
- Fixed the seeded AMOLED hook test to render through `react-test-renderer` instead of calling a hook as a plain function.

## Verification

- `rtk npx tsc --noEmit -p tsconfig.json` passed.
- `rtk npx jest __tests__/lib/amoled.test.ts --runInBand` passed: 1 suite, 2 tests.
- `rtk npx jest --passWithNoTests --runInBand` passed: 13 suites, 109 tests.
- Source checks confirmed `refreshInterval`/`refetchInterval` and strict `isInternetReachable === true` guard.

## Issues Encountered

- The seeded AMOLED test originally called `useBattery()` directly, causing React's invalid-hook-call error. Reworked it to render a probe component with `react-test-renderer`.

## Deviations From Plan

- Added compatibility aliases `surface` and `text` to `AMOLED_THEME` because the seeded test used those names while the app theme contract uses `panel` and `ink`.

## User Setup Required

None.

## Self-Check: PASSED

All key files exist, implementation commit `70a51a7` exists for `02-05`, TypeScript passes, and the full mobile Jest suite is green.

## Next

Ready for Wave 4: `02-06` report-flow UI wiring and `02-07` zone-screen quick wins.
