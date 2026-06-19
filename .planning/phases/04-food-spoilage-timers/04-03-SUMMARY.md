---
phase: 04-food-spoilage-timers
plan: 03
subsystem: mobile-ui
tags: [food-timers, i18n, react-native, expo-router, spanish-first, offline]
requires: [04-01, 04-02]
provides:
  - food-tab-screen
  - food-i18n-strings
  - food-alerts-point-of-use-entry
affects:
  - mobile/app/(tabs)/food.tsx
  - mobile/lib/i18n.ts
tech-stack:
  added: []
  patterns:
    - point-of-use permission entry (no OS prompt on mount)
    - lang detection via expo-localization getLocales()
    - theme-token styling via useTheme() + StyleSheet.create()
key-files:
  created: []
  modified:
    - mobile/app/(tabs)/food.tsx
    - mobile/lib/i18n.ts
    - mobile/__tests__/lib/i18n.test.ts
    - mobile/__tests__/lib/food.test.ts
    - mobile/__tests__/lib/foodTimers.test.ts
decisions:
  - "ASCII-only copy for new food i18n keys (apagon/revision/Volvio) per plan rule"
  - "Custom item threshold entered in hours, converted to minutes before validateCustomFood"
  - "Preset 'added' state detected via tracked item presetId, not random UUID id"
  - "Food alerts toggle is local component state only — no scheduler, no OS prompt, no remote registration (Plan 04 will wire the scheduler)"
metrics:
  duration: ~22m
  completed: 2026-06-19
---

# Phase 4 Plan 3: Food Tab UI Summary

Spanish-first local Food timer screen wired to the `useFoodTimers` lifecycle hook: preset/custom add, active timer cards with cautious early-warning labels, outage review prompt, honest stale/offline banner, restored-review state that never declares food safe, and a point-of-use food-alerts entry point with no scheduler yet.

## What Was Built

- **Task 1 — i18n (505610c):** Added ~40 ASCII-only Spanish-first food keys to `lib/i18n.ts` (title/subtitle, no-zone, empty-tracked, section headings, outage prompt, stale/offline notes, restored review, safe/warning/expired labels, add/remove/reset/enable/disable/close actions, food-alerts copy) with English fallbacks. Extended `i18n.test.ts` to assert food keys resolve, ASCII-only, and contain no safety guarantees.
- **Tasks 2–4 — Food screen (07ac3cc):** Replaced `PlaceholderTab` in `app/(tabs)/food.tsx` with a real `ScrollView` screen:
  - Header with restaurant icon, title, subtitle, and saved-zone name (or no-zone hint).
  - Outage review banner when `session.needsOutageReviewPrompt` → `acknowledgeOutagePrompt`.
  - Stale/offline honesty banner during active sessions (distinct offline vs stale copy).
  - Restored-review banner (`session.status === 'restored_review'`) → asks to check fridge/food, never says "safe", → `dismissRestoredReview`.
  - Active timer cards from `timerCards` showing elapsed/remaining and `safe|warning|expired` level mapped to `theme.ok|warn|danger`.
  - Preset list (add, with "Added" disabled state via `presetId`).
  - Tracked-foods list (enable/disable `Switch`, remove, reset-all).
  - Lightweight custom-item form (name + hours → minutes, `validateCustomFood` error surfaced) — dismissible, no quantity/price/barcode/sync.
  - Food-alerts point-of-use panel: local toggle, copy stating food state stays local, "automatic alerts arrive in a coming update", no OS permission request on mount.
- **Task 5 — tests (9a6ec00):** Extended `food.test.ts` (all food copy keys resolve; restored/expired copy makes no safety claim) and `foodTimers.test.ts` (prompt acknowledge, restored dismiss, timer-card elapsed/remaining/warning level, stale+offline flags remain visible).

## Decision Coverage

D-01..D-18 covered at the user-facing layer: compact presets only (D-01/02/14), Spanish-first cautious copy (D-03/17), saved-zone session reflection (D-04), opt-in tracking (D-05), MMKV-only via hook (D-06), restored review not "safe" (D-07/16), honest stale/offline (D-08/18), early-warning copy (D-09/17), local-first alerts no identity (D-10), point-of-use permission (D-11), lightweight custom name+threshold (D-12), quick remove/reset/enable/disable (D-13), in-app outage prompt (D-15).

## Verification

- `cd mobile && npx jest --watchAll=false` → **169 passed, 0 failed**
- `cd mobile && npx tsc --noEmit` → **No errors found**

## Deviations from Plan

None requiring user input. Minor in-scope adjustments tracked as Rule 1/3 fixes:
- **[Rule 3 - Blocking] Preset "added" detection.** Initial draft matched preset by tracked `id`; preset tracked items use a random UUID with `presetId` set, so detection now uses a `presetId` set. Fixed inline; tsc clean.
- **[Rule 1 - Bug] Type-predicate filter.** `presetId` is typed `FoodPresetId | null`; a `(id): id is string` predicate failed tsc. Replaced with a plain `id != null` filter. Fixed inline.

## Known Stubs

- **Food alerts toggle** (`app/(tabs)/food.tsx`): the enable toggle is local component state and does not yet schedule notifications. This is intentional per plan Task 4 — the NOTF-03 scheduler is Plan 04's scope. Copy explicitly states automatic alerts arrive in a coming update; no permission is requested and no food state is uploaded.

## Self-Check: PASSED

- Commits 505610c, 07ac3cc, 9a6ec00 — all FOUND in git log.
- mobile/app/(tabs)/food.tsx, mobile/lib/i18n.ts — FOUND on disk.
