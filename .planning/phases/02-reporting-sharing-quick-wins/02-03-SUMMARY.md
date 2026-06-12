phase: 02
plan: 03
subsystem: mobile-reporting-core
tags: [supabase, queue, gps, mmkv, expo-location]
depends_on: [02-01, 02-02]
provides: [submit-report, offline-report-queue, gps-zone-detection]
affects: [02-06]
tech_stack:
  added: []
  patterns:
    - fetchStatus remains never-throw while submitReport may throw for queue retry handling
    - MMKV queue stores only pending report payloads with UUIDs and attempt counts
    - GPS detection uses nearest REGIONS coordinate with 150km cutoff and 10s timeout
key_files:
  created:
    - mobile/lib/queue.ts
    - mobile/lib/gps.ts
  modified:
    - mobile/lib/api.ts
key_decisions:
  - Kept report submission as direct Supabase REST POST using anon config from app.json.
  - Implemented queue flush as never-throw and attempt-capped so UI sync hooks can call it safely.
  - Cleared GPS timeout handles after Promise.race completion to avoid Jest open-handle warnings.
requirements_completed: [REPT-01, REPT-02, REPT-03]
duration: 45m
completed: 2026-06-12

# Phase 02 Plan 03: Reporting Core Summary

Supabase report submission, offline MMKV queueing, duplicate cooldown checks, and GPS nearest-zone detection are implemented and covered by the Wave 2 red tests.

## What Changed

- Added `ReportPayload`, `QueuedReport`, and `submitReport(payload)` to `mobile/lib/api.ts`.
- Added `mobile/lib/queue.ts` with `getQueue`, `saveQueue`, `enqueue`, `canEnqueue`, and `flushQueue`.
- Added `mobile/lib/gps.ts` with `findNearestZone` and `detectNearestZone`.
- Preserved `fetchStatus` never-throw behavior while documenting that `submitReport` may throw for queue retry handling.

## Verification

- API scan passed for `submitReport`, payload types, anon key config, `return=minimal`, and no service-role string.
- `rtk npx tsc --noEmit -p tsconfig.json` passed.
- `rtk npx jest __tests__/lib/queue.test.ts __tests__/lib/gps.test.ts --runInBand` passed: 2 suites, 7 tests.
- Green-subset regression passed: 10 suites, 102 tests.

## Issues Encountered

- Initial GPS timeout implementation left a pending timer after successful location resolution. Fixed by clearing the timeout in `finally`.

## Deviations From Plan

None - followed plan as specified.

## User Setup Required

None.

## Self-Check: PASSED

All key files exist, implementation commit `4389de9` exists for `02-03`, queue/GPS tests are green, TypeScript passes, and remaining red tests belong to later Wave 3/4 plans.

## Next

Ready for `02-04`: share text and parroquia lookup libs.
