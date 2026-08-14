---
phase: 03-push-notifications
plan: 05
subsystem: pipeline
tags: [expo-push, notifications, supabase, lifecycle, cooldown]
requires:
  - phase: 03
    provides: notification red tests and push schema
provides:
  - pipeline-side Expo push fan-out
  - unstable and cooldown suppression
  - non-fatal notification integration in pipeline main
affects: [pipeline, notifications]
tech-stack:
  added: []
  patterns: [service-role fan-out, Expo batch send, non-fatal pipeline side effect]
key-files:
  created:
    - pipeline/notify.py
  modified:
    - pipeline/main.py
    - tests/test_notify.py
key-decisions:
  - Push security remains optional: Authorization header is included only when EXPO_ACCESS_TOKEN exists.
  - Notification failures are logged and never block status.json generation.
patterns-established:
  - send_notifications consumes confirmed lifecycle events instead of raw status diffs.
requirements-completed: [NOTF-01, NOTF-02, NOTF-04, INFR-01, INFR-03]
duration: 45min
completed: 2026-06-13
---

# Phase 03 Plan 05: Pipeline Push Fan-Out Summary

Pipeline-side Expo push fan-out for confirmed outages, restorations, and neighbor warnings with cooldown and unstable-zone suppression.

## Tasks

- Added `pipeline/notify.py` with token fetching, cooldown checks, Expo batch sends, Spanish factual copy, and notification logging.
- Wired Phase 3 notification fan-out into `pipeline/main.py` after lifecycle processing.
- Updated `tests/test_notify.py` fixtures to assert direct and neighbor subscriptions separately.

## Verification

- `python3 -m pytest tests/test_notify.py -q` passed: 11 tests.
- `python3 -m pytest tests/test_outage_lifecycle.py -q` passed: 20 tests.

## Issues Encountered

- MagicMock query chains do not apply Supabase `.in_()` / `.eq()` filters, so `pipeline/notify.py` also filters fetched rows defensively in-process.

## Deviations from Plan

- None.

## User Setup Required

Before release: enable Expo push security and configure `EXPO_ACCESS_TOKEN` in CI/production.

## Next Phase

Ready for mobile opt-in flow verification.
