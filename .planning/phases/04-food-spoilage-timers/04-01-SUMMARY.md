---
phase: 04-food-spoilage-timers
plan: 01
subsystem: mobile-food-domain
tags: [food, spoilage, mmkv, offline, domain-model]
requires: [STORAGE_KEYS registry, expo-crypto, react-native-mmkv]
provides:
  - FOOD_PRESETS (compact Spanish-first grocery catalog)
  - food domain types (FoodPreset, TrackedFoodItem, FoodWarningLevel)
  - timer helpers (classifyFoodTimer, getFoodTimerProgress)
  - tracked-item MMKV helpers (read/write/upsert/remove/reset)
affects:
  - future Food tab UI (active cards)
  - future food spoilage local notifications (NOTF-03)
tech-stack:
  added: []
  patterns:
    - "pure deterministic timer classification on minutes-since-outage"
    - "defensive JSON parse returns [] on corrupt/tampered MMKV data"
    - "storage read only on call, never at module load"
key-files:
  created:
    - mobile/lib/food.ts
    - mobile/__tests__/lib/food.test.ts
  modified:
    - mobile/lib/storage.ts
decisions:
  - "D-01/D-02/D-14: 11-preset compact catalog across 7 categories (dairy, meat, eggs, leftovers, prepared, produce, freezer)"
  - "D-03: Spanish-first names + cautious copy; no temperature claims, no safety guarantees"
  - "D-17: every preset warningLeadMinutes < thresholdMinutes (early warnings)"
  - "D-12: custom foods limited to name, threshold, optional category + warning lead"
  - "Custom validation bounds: 15 min <= threshold <= 72 h; warning lead must be < threshold"
metrics:
  duration: ~12m
  completed: 2026-06-19
  tasks: 4
  files: 3
requirements: [FOOD-01, FOOD-02, FOOD-04]
---

# Phase 4 Plan 01: Food Domain Model Summary

Local, offline food spoilage domain for Cocuyo Mobile: a compact Spanish-first preset catalog, lightweight custom items, pure deterministic warning classification, and MMKV persistence helpers — with no backend, sync, sensors, or pantry scope.

## What Was Built

- **Task 1 — `mobile/lib/storage.ts`:** Added four food keys to `STORAGE_KEYS` (`foodTrackedItems`, `foodTimerState`, `foodNotificationPrefs`, `foodDismissedWarnings`), preserving the `as const` shape. No backend/sync/sensor keys.
- **Task 2 — `mobile/lib/food.ts` (domain + presets):** Types (`FoodCategory`, `FoodPresetId`, `FoodPreset`, `TrackedFoodItem`, `FoodWarningLevel`, `CustomFoodInput`, `FoodTimerProgress`). `FOOD_PRESETS` — 11 compact presets (milk, cheese, eggs, raw_chicken, raw_beef, cooked_leftovers, cooked_rice, arepas_dough, vegetables, full_freezer, half_freezer) with Spanish names, conservative thresholds, early warning leads, and cautious `cautionText`. Helpers: `createTrackedFoodFromPreset`, `validateCustomFood`, `createCustomTrackedFood`, `classifyFoodTimer`, `getFoodTimerProgress`.
- **Task 3 — `mobile/lib/food.ts` (MMKV helpers):** `readTrackedFoodItems` (defensive parse → `[]` on missing/invalid/non-array, filters malformed entries, never throws), `writeTrackedFoodItems`, `upsertTrackedFoodItem`, `removeTrackedFoodItem`, `resetTrackedFoodItems`. Storage read only on call; no network/api imports.
- **Task 4 — `mobile/__tests__/lib/food.test.ts`:** Coverage for FOOD-01 (preset shape, categories, Spanish names, lead<threshold), FOOD-02 (validation + creation/trim), FOOD-04 (safe/warning/expired boundaries, progress clamping), and MMKV helpers including invalid-JSON tolerance and malformed-entry dropping.

## Verification

- `cd mobile && npx jest --watchAll=false` → **PASS** — 140 tests, 0 failures across the full mobile suite.

## Decisions Made

- 11-item catalog chosen as the compact basic-grocery set (D-01/D-02/D-14); freezer presets (full/half) carry the longest thresholds (48h / 24h) with multi-hour warning leads.
- Default custom warning lead = `min(30, threshold/4)` when not supplied, ensuring lead < threshold.
- Malformed stored entries are filtered (must have string `id` + numeric `thresholdMinutes`) rather than rejecting the whole list — corruption of one item does not wipe valid tracking.

## Deviations from Plan

None — plan executed as written. Domain model (Task 2) and MMKV helpers (Task 3) were authored in a single `food.ts` write and committed together as one `feat` commit, since they share the file; both task scopes are fully covered.

## Threat Coverage

- **T-04-01-01 (Tampering, MMKV JSON):** `readTrackedFoodItems` parses defensively, returns `[]` on invalid JSON, drops malformed entries, never throws. Tested.
- **T-04-01-02 (Info disclosure):** Food state lives only in MMKV; module imports no network/api/Supabase code.
- **T-04-01-03 (Safety):** Preset copy is cautious, makes no safety guarantee, and asserts no temperature knowledge; warnings fire before the hard threshold (D-17). Tested.

## Known Stubs

None. `foodTimerState`, `foodNotificationPrefs`, and `foodDismissedWarnings` keys are defined for use by later Phase 4 plans (auto-start timers, notifications, UI) — this is intentional forward-provisioning, not a stub blocking this plan's goal.

## Commits

- `d56da24` feat(04-01): add food spoilage MMKV storage keys
- `3ebf67d` feat(04-01): add food domain model, presets, timer + MMKV helpers
- `0a4288d` test(04-01): add food domain tests for FOOD-01/02/04 + MMKV helpers

## Self-Check: PASSED

All created/modified files exist on disk; all three task commits present in git log.
