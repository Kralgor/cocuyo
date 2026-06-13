---
phase: 03-push-notifications
plan: 06
subsystem: mobile
tags: [expo-notifications, react-native, mmkv, notify-tab]
requires:
  - phase: 03
    provides: registerToken and mobile adjacency/storage foundation
provides:
  - Expo notification permission helper
  - useNotifications subscription hook
  - Notify tab opt-in and preference UI
affects: [mobile, notifications]
tech-stack:
  added: []
  patterns: [point-of-use permission, never-throw registration, MMKV preference sync]
key-files:
  created:
    - mobile/lib/notifications.ts
    - mobile/hooks/useNotifications.ts
  modified:
    - mobile/app/(tabs)/notify.tsx
    - mobile/__tests__/lib/notifications.test.ts
    - mobile/lib/storage.ts
key-decisions:
  - Permission is requested only after tapping Activar notificaciones.
  - Notify tab copy states that Cocuyo stores only anonymous token, saved zone, and preferences.
  - All three notification preferences default on after opt-in and sync back to push_tokens.
patterns-established:
  - Mobile notification state is local-first and non-fatal when offline registration fails.
requirements-completed: [NOTF-01, NOTF-02, NOTF-04, INFR-02]
duration: 50min
completed: 2026-06-13
---

# Phase 03 Plan 06: Mobile Notify Opt-In Summary

Notify tab opt-in flow with Expo token registration, saved-zone subscription sync, and independent outage/restoration/neighbor toggles.

## Tasks

- Added `mobile/lib/notifications.ts` for SDK 56 notification handler, Android channel setup, permission request, and Expo token retrieval.
- Added `mobile/hooks/useNotifications.ts` for MMKV-backed permission/token/pref state and Supabase `registerToken()` sync.
- Replaced the Notify tab placeholder with a Spanish-first point-of-use opt-in screen and post-opt-in toggles.
- Expanded `mobile/__tests__/lib/notifications.test.ts` for Android channel setup, denied permission, granted token, and existing registerToken paths.

## Verification

- `cd mobile && npx jest __tests__/lib/notifications.test.ts --watchAll=false` passed: 7 tests.
- `cd mobile && npx jest --watchAll=false` passed: 14 suites, 116 tests.
- `cd mobile && npx tsc --noEmit` passed.

## Issues Encountered

- `useTheme` and `storage` are named exports in this app; imports were corrected after TypeScript caught the mismatch.
- The theme type does not expose `accentSoft`; the screen uses existing palette fields.

## Deviations from Plan

- Manual development-build smoke test for OS permission prompt timing is still required on device/build.

## User Setup Required

Before release: enable Expo push security and configure `EXPO_ACCESS_TOKEN` in CI/production.

## Next Phase

Ready for human APK/development-build smoke verification of the OS permission prompt and real-device push token flow.
