---
phase: 03-push-notifications
plan: 01
subsystem: testing
tags: [pytest, jest, expo-notifications, push-notifications]
requires: []
provides:
  - Red pipeline notification fan-out test scaffold
  - Red mobile token registration test scaffold
affects: [pipeline, mobile, notifications]
tech-stack:
  added: []
  patterns: [offline tests, mocked Expo SDK, mocked Supabase client]
key-files:
  created:
    - tests/test_notify.py
    - mobile/__tests__/lib/notifications.test.ts
  modified:
    - mobile/jest.setup.js
key-decisions:
  - Kept pipeline notification tests in red collection state until pipeline.notify is implemented by plan 05.
  - Added Expo notification/device Jest mocks for offline mobile tests.
patterns-established:
  - Push tests patch pipeline.notify._send_expo_batch so no Expo network call is attempted.
requirements-completed: [NOTF-01, NOTF-02, NOTF-04, INFR-01, INFR-02, INFR-03]
duration: 35min
completed: 2026-06-13
---

# Phase 03 Plan 01: Notification Test Scaffolds Summary

Offline push notification red tests for pipeline fan-out, cooldown, adjacency, suppression, Expo batching, and mobile token registration.

## Tasks

- Created `tests/test_notify.py` with named pytest classes covering outage, restoration, neighbor outage, no-token, batch, suppression, cooldown, and edge cases.
- Added `expo-notifications` and `expo-device` mocks to `mobile/jest.setup.js`.
- Created `mobile/__tests__/lib/notifications.test.ts` for the `registerToken()` never-throw contract and Supabase `push_tokens` upsert request shape.

## Verification

- `python3 -m pytest tests/test_notify.py -q` fails during collection with `ModuleNotFoundError: No module named 'pipeline.notify'`, the expected red state before plan 05.
- Initial mobile red state failed before implementation; after plan 04 added `registerToken()` and installed `expo-notifications`, `cd mobile && npx jest __tests__/lib/notifications.test.ts --watchAll=false` passes.

## Issues Encountered

- The environment uses `python3`, not `python`, for pytest.
- The mobile test needed a local `expo-constants` mock, matching the existing API test pattern.

## Deviations from Plan

- None for behavior. The mobile registration scaffold became green after plan 04, as expected for Wave 0 sequencing.

## User Setup Required

None.

## Next Phase

Ready for `03-02` FCM credential checkpoint and Wave 1 implementation after the checkpoint is satisfied.
