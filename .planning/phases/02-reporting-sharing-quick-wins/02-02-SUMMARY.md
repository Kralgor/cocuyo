phase: 02
plan: 02
subsystem: mobile-test-assets
tags: [parroquias, contacts, jest, red-tests, queue, gps, share, amoled]
depends_on: [02-01]
provides: [parroquia-assets, contacts-assets, wave-3-red-tests]
affects: [02-03, 02-04, 02-05, 02-06, 02-07]
tech_stack:
  added: []
  patterns:
    - JSON assets live under mobile/assets and are consumed by pure lib helpers
    - Red tests define Wave 3 and Wave 4 module contracts before implementation
key_files:
  created:
    - mobile/assets/parroquias.json
    - mobile/assets/contacts.json
    - mobile/__tests__/lib/queue.test.ts
    - mobile/__tests__/lib/gps.test.ts
    - mobile/__tests__/lib/share.test.ts
    - mobile/__tests__/lib/amoled.test.ts
    - mobile/__tests__/lib/parroquias.test.ts
  modified: []
key_decisions:
  - Kept CORPOELEC per-state contacts as verified:false scaffolds until manual Phase 5 research confirms numbers.
  - Used national 911 entries as verified emergency contacts.
  - Seeded intentionally failing tests for future modules without creating implementation stubs.
requirements_completed: [REPT-01, REPT-02, REPT-03, SHAR-01, BATT-01, BATT-02, BATT-03]
duration: 35m
completed: 2026-06-12

# Phase 02 Plan 02: Reporting Assets and Red Tests Summary

Parroquia and contacts JSON assets plus Wave 3/4 red Jest contracts are in place for reporting queue, GPS, sharing, AMOLED battery mode, and parroquia lookup work.

## What Changed

- Added `mobile/assets/parroquias.json` covering all 16 states represented by `REGIONS`, including Zulia/Maracaibo and Distrito Capital/Caracas.
- Added `mobile/assets/contacts.json` with verified national 911 entries and per-state CORPOELEC scaffolds marked `verified:false`.
- Added red tests for queue behavior, GPS nearest-zone detection, WhatsApp share text, AMOLED/battery mode, and parroquia lookup.

## Verification

- JSON parse and asset checks passed for both assets.
- Asset checks confirmed Zulia, Distrito Capital, and verified national `911` contact coverage.
- New Wave 2 test files fail red as expected because future modules are not implemented yet:
  - `mobile/lib/queue`
  - `mobile/lib/gps`
  - `mobile/lib/share`
  - `mobile/lib/parroquias`
  - `mobile/hooks/useBattery`
- Existing Phase 1 regression suite passed: 8 suites, 95 tests.

## Issues Encountered

None.

## Deviations From Plan

None - followed plan as specified.

## User Setup Required

None.

## Self-Check: PASSED

All key files exist, production/test commit `64da0d1` exists for `02-02`, required red tests fail for the expected missing-module reason, and existing tests remain green.

## Next

Ready for Wave 3: `02-03`, `02-04`, and `02-05`.
