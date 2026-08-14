---
phase: 04-food-spoilage-timers
plan: 04
subsystem: mobile-food-notifications
tags: [notifications, food, local-first, expo-notifications, NOTF-03, FOOD-03, FOOD-04]
requires: [04-01, 04-02, 04-03]
provides:
  - local-food-warning-notifications
  - useFoodNotifications-hook
  - food-tab-point-of-use-permission
affects:
  - mobile/app/(tabs)/food.tsx
tech-stack:
  added: []
  patterns:
    - local-first Expo notifications (no push token, no Supabase for food state)
    - point-of-use OS permission request (D-11)
    - MMKV-only scheduled-id registry + dedupe
key-files:
  created:
    - mobile/lib/foodNotifications.ts
    - mobile/hooks/useFoodNotifications.ts
    - mobile/__tests__/lib/foodNotifications.test.ts
  modified:
    - mobile/app/(tabs)/food.tsx
    - mobile/lib/i18n.ts
    - mobile/jest.setup.js
decisions:
  - D-09 schedule warnings before unsafe threshold (outageStartedAt + threshold - lead)
  - D-10 local-first, no account/identity/push pipeline for food state
  - D-11 permission requested only from explicit Food alert enable action
  - D-16 restoration/disable/reset cancels active food notifications
  - D-17 cautious Spanish-first copy, no safety/temperature guarantee
  - D-18 stale/offline scheduling uses last-known outage start from active session
metrics:
  duration: ~1 session
  tasks: 5
  files: 6
  completed: 2026-06-19
---

# Phase 4 Plan 04: Local Food Spoilage Notifications Summary

Local Expo notifications scheduled before tracked-food spoilage thresholds, gated behind point-of-use permission, deduped per session/item/warning level, and canceled on restoration/disable/reset — with zero food state leaving the device.

## What was built

- **`mobile/lib/foodNotifications.ts`** — local-first notification domain + scheduler:
  - `FoodNotificationPrefs` (`enabled`, `reviewPromptEnabled`) with defensive MMKV read/write under `foodNotificationPrefs`.
  - `FoodDismissedWarnings` map (`${timerSessionId}:${itemId}:${warningLevel}` → scheduled OS id) under `foodDismissedWarnings`, doubling as the scheduled-id registry for cancel/dedupe.
  - Pure helpers: `makeFoodWarningKey`, `buildFoodWarningNotification` (cautious Spanish copy — "revisa", "evita abrir la nevera", "si tienes dudas, descarta"), `getFoodWarningScheduleTime` (`outageStartedAt + thresholdMinutes - warningLeadMinutes`, null when no active session).
  - Async: `ensureFoodNotificationPermission` (check-then-request, point-of-use only), `scheduleFoodWarningNotifications` (enabled items, future times only, dedupe), `cancelFoodWarningNotifications`, `rescheduleFoodWarningNotifications`, `cancelAllFoodWarningNotifications`.
- **`mobile/hooks/useFoodNotifications.ts`** — exposes `enabled`, `permissionStatus`, `busy`, `error`, `enableFoodAlerts()` (the only permission-requesting path), `disableFoodAlerts()`, `syncFoodNotifications(session, items)`. Never requests permission on mount. Permission denial is surfaced as non-fatal UI state.
- **`mobile/app/(tabs)/food.tsx`** — replaced the 04-03 local-only placeholder toggle with the real hook: toggle calls `enableFoodAlerts`/`disableFoodAlerts`; an effect runs `syncFoodNotifications` only when alerts are enabled and the session/enabled-items change; enabled/disabled/denied/error states rendered; reset now disables alerts (cancels scheduled warnings) before clearing timers.
- **`mobile/lib/i18n.ts`** — added `food_alerts_on`, `food_alerts_off`, `food_alerts_denied` (ASCII/Spanish-first, EN fallback).
- **`mobile/jest.setup.js`** — extended the `expo-notifications` mock with `scheduleNotificationAsync`, `cancelScheduledNotificationAsync`, and `PermissionStatus`.
- **`mobile/__tests__/lib/foodNotifications.test.ts`** — 16 tests covering scheduling math, disabled-prefs/disabled-food/past-time non-scheduling, dedupe, cancel-on-restore/reset, reschedule, point-of-use permission (request only on explicit call), non-fatal denial, and a local-first source guard (no `registerToken`/`supabase`/`lib/api`/`getExpoPushTokenAsync` in code).

## Verification

- `cd mobile && npx jest __tests__/lib/foodNotifications.test.ts --watchAll=false` → 16 passed.
- `cd mobile && npx jest --watchAll=false` → **185 passed, 0 failed**.
- `cd mobile && npx tsc --noEmit` → clean (strict mode, no `any`).

## Requirements

- **NOTF-03** — local warning scheduled at `outageStartedAt + threshold - lead`. Complete (local notifications; the original "push notification" wording is satisfied by local-first per D-10).
- **FOOD-03** — schedules only for active saved-zone sessions using the session outage start; cancels on restoration/idle. Preserved.
- **FOOD-04** — local warning before threshold (already complete in lifecycle; now wired to real OS scheduling). Preserved.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Test brittleness] Local-first source guard matched its own header comment**
- **Found during:** Task 5
- **Issue:** The "no Supabase" static guard read the module source and matched the cautionary header comment that names the threat ("Supabase"), failing falsely.
- **Fix:** Strip block/line comments before matching; also added a `from 'lib/api'` import guard. Behavior of the guard (assert no network registration symbols in code) is unchanged.
- **Files modified:** `mobile/__tests__/lib/foodNotifications.test.ts`
- **Commit:** fec23af

No other deviations — plan executed as written. `food_alerts_soon` i18n key is now unused but intentionally left in place (no removal needed).

## Threat coverage

- T-04-04-01 (info disclosure): notification `data` carries only local `timerSessionId`/`itemId`; no food state sent anywhere. Source guard test enforces no api/supabase/push-token usage.
- T-04-04-02 (duplicate notifications / DoS): scheduled-id registry + dismissed-key dedupe by session/item/warning level; past times not re-scheduled.
- T-04-04-03 (consent): permission requested only inside `ensureFoodNotificationPermission`, called only from `enableFoodAlerts` (a user tap).
- T-04-04-04 (safety): copy is cautious and early, never guarantees food safety or claims to know temperature.

## Human prerequisites / on-device validation required

These cannot be verified by automated tests (mocks only) and require a real Android development build / device:

- [ ] **OS permission prompt** appears ONLY after tapping "Activar avisos de comida" — never on Food tab open or app launch.
- [ ] **Permission denial** path: deny the prompt; the Food tab shows the denied state and does not crash; alerts stay off.
- [ ] **Actual local notification delivery**: with alerts enabled during an active outage session, a warning notification fires at approximately `outageStartedAt + threshold - lead` (verify on a short custom-food threshold to keep the wait small).
- [ ] **Cancellation on restoration/reset**: enable alerts during an outage, then trigger restoration (or reset timers / disable alerts) and confirm no scheduled food warning fires afterward.
- [ ] **Android notification channel/heads-up** rendering of the cautious Spanish copy looks correct on device.

(iOS APNs delivery remains blocked on Apple Developer Program enrollment — pre-existing phase-level blocker, not introduced here.)

## Self-Check: PASSED

- FOUND: mobile/lib/foodNotifications.ts
- FOUND: mobile/hooks/useFoodNotifications.ts
- FOUND: mobile/__tests__/lib/foodNotifications.test.ts
- FOUND commits: ef2549a, df29f08, 7ad0104, fec23af
