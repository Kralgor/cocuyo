---
phase: 04-food-spoilage-timers
plan: 02
subsystem: mobile-food-lifecycle
tags: [food, spoilage, timers, lifecycle, mmkv, offline, hooks]
requires:
  - mobile/lib/food.ts domain model (04-01)
  - StatusJson/RegionEntry types (mobile/lib/api.ts)
  - useStatus, useOffline hooks
  - STORAGE_KEYS.foodTimerState
provides:
  - FoodTimerSession type + idle/active/restored_review lifecycle
  - isFoodOutageStatus, deriveOutageStart, deriveFoodTimerSession (pure)
  - readFoodTimerState/writeFoodTimerState/resetFoodTimerState (MMKV)
  - acknowledgeFoodOutagePrompt, dismissRestoredFoodReview
  - useFoodTimers() hook
affects:
  - future Food tab UI (timer cards, prompt + restored-review banners)
  - future food spoilage local notifications (NOTF/04-03)
tech-stack:
  added: []
  patterns:
    - "pure lifecycle reducer derives next session from previous + status + tracked items"
    - "stale/offline active sessions keep counting from last known outage start"
    - "defensive MMKV parse returns idle session on corrupt/old-version JSON"
    - "hook persists session via serialized-equality diff to avoid update loops"
    - "modest 30s tick, interval torn down on unmount (no background polling)"
key-files:
  created:
    - mobile/hooks/useFoodTimers.ts
    - mobile/__tests__/lib/foodTimers.test.ts
  modified:
    - mobile/lib/food.ts
decisions:
  - "D-04: saved-zone active outage auto-starts a timer session"
  - "D-05: auto-start only for enabled tracked foods, never every preset"
  - "D-06: timer session state is local/offline MMKV (STORAGE_KEYS.foodTimerState)"
  - "D-07: restoration -> restored_review; never declares food safe"
  - "D-08: stale/offline/unstable surfaced as uncertainty flags, not hidden"
  - "D-15: fresh outage sets needsOutageReviewPrompt for UI/notification layer"
  - "D-16: restoration clears active counting (review state, not paused)"
  - "D-18: stale/offline keeps counting from previous outageStartedAt"
  - "isFoodOutageStatus = no_power | confirmed_outage | likely_outage; unstable is NOT auto-start (instability, not power loss)"
metrics:
  duration: ~1 session
  completed: 2026-06-19
requirements: [FOOD-03, FOOD-04]
---

# Phase 4 Plan 02: Food Timer Lifecycle State Summary

Local/offline food-timer lifecycle that auto-starts spoilage timers from the
saved-zone outage status for tracked/enabled foods, keeps counting through
stale/offline status from the best-known outage start, and resets to a factual
restored-review state on power-back without ever declaring food safe.

## What Was Built

**Task 1 + 2 — `mobile/lib/food.ts` extension (commit fa98fb4):**
- `FoodTimerSession` type with `status: idle | active | restored_review`, zone,
  `timerSessionId`, `outageStartedAt`, `source`, `startedAtLocal`, plus optional
  staleness/offline/prompt/restored metadata.
- `isFoodOutageStatus()` — true for `no_power` (the mobile `region.status` outage
  value per `lib/theme.ts`) and the `outage.type` values `confirmed_outage` /
  `likely_outage`. `unstable` is intentionally excluded (bajón instability is not
  full power loss; it surfaces as uncertainty per D-08, not auto-start).
- `deriveOutageStart()` — prefers `outage.started_at`, then derives from
  `outage.elapsed_minutes` relative to `now`, then falls back to local
  `detected_at` (D-18).
- `deriveFoodTimerSession()` — pure lifecycle reducer covering D-04/05/07/08/15/16/18.
- MMKV state helpers: `readFoodTimerState` (idle on missing/invalid/old JSON,
  never throws), `writeFoodTimerState`, `resetFoodTimerState`,
  `acknowledgeFoodOutagePrompt`, `dismissRestoredFoodReview`.

**Task 3 — `mobile/hooks/useFoodTimers.ts` (commit f5ed614):**
- Reads `selectedZone` from MMKV, calls `useStatus()` selecting
  `data.regions[selectedZone]`, and `useOffline()` for stale/offline flags.
- Derives + persists the session on input change via serialized-equality diff.
- Exposes `trackedItems`, `enabledTrackedItems`, `session`, `timerCards`,
  `isOffline`, `isStatusStale`, `acknowledgeOutagePrompt`, `dismissRestoredReview`,
  `addPreset`, `addCustomItem`, `removeItem`, `setItemEnabled`, `resetAllFoodTimers`.
- 30s tick interval, mounted-only, torn down on unmount (T-04-02-03).

**Task 4 — `mobile/__tests__/lib/foodTimers.test.ts` (commit ffb3338):**
- 19 tests covering FOOD-03 start conditions (zone + enabled only, not every
  preset, not on `unstable`), `started_at` > `elapsed_minutes` > `detected_at`,
  stale/offline continued counting, restoration review state without a "safe"
  declaration, prompt flag on fresh outage, and invalid-JSON idle fallback.

## Verification

- `npx jest __tests__/lib/foodTimers.test.ts --watchAll=false` → PASS (19)
- `npx jest --watchAll=false` → PASS (159, full suite)
- `npx tsc --noEmit` → No errors found (strict mode, no `any`)

## Decisions Made

- `isFoodOutageStatus` accepts `no_power`, `confirmed_outage`, `likely_outage`;
  excludes `unstable` (verified against `lib/theme.ts` and `lib/api.ts` status
  strings rather than guessing).
- Tasks 1 and 2 both edit `food.ts` and were committed together as one cohesive
  session-layer commit; tasks 3 and 4 are separate commits.
- Hook persists via JSON-equality diff to prevent a derive→setState→derive loop.

## Deviations from Plan

None — plan executed as written. Threat mitigations T-04-02-01 (defensive parse +
uncertainty flags), T-04-02-02 (restored_review, never declares safe), and
T-04-02-03 (no background polling, mounted-only interval) were all implemented.

## Known Stubs

None. The lifecycle layer is fully wired to real inputs (status + MMKV). UI
rendering of `timerCards` / prompt / restored-review banners is the next plan's
scope.

## Self-Check: PASSED
- FOUND: mobile/lib/food.ts (modified, FoodTimerSession + helpers present)
- FOUND: mobile/hooks/useFoodTimers.ts
- FOUND: mobile/__tests__/lib/foodTimers.test.ts
- FOUND: commit fa98fb4 (feat 04-02 session layer)
- FOUND: commit f5ed614 (feat 04-02 hook)
- FOUND: commit ffb3338 (test 04-02 lifecycle)
