# Phase 4 Research: Food Spoilage Timers

**Date:** 2026-06-15  
**Scope:** Local/offline food spoilage timers in the Expo React Native mobile app.  
**Requirements:** FOOD-01, FOOD-02, FOOD-03, FOOD-04, NOTF-03

## Summary

Phase 4 should replace the current `mobile/app/(tabs)/food.tsx` placeholder with a practical, Spanish-first outage utility for tracking selected foods during power cuts. It should not become pantry management. The feature should use a compact preset catalog of common Venezuelan groceries, allow lightweight custom items, auto-start timers for tracked foods when the saved zone enters outage, keep counting while status is stale/offline, warn early before spoilage, and reset active timers when power is restored.

No backend schema, accounts, sync, sensors, barcode scanning, household sharing, or new read API are needed. The app already has the necessary local foundations: MMKV storage in `mobile/lib/storage.ts`, saved-zone status via `mobile/hooks/useStatus.ts`, typed `status.json` contracts in `mobile/lib/api.ts`, Spanish/English i18n in `mobile/lib/i18n.ts`, and notification permission patterns in `mobile/hooks/useNotifications.ts` plus `mobile/app/(tabs)/notify.tsx`.

## Recommended Architecture

Implement food timers as a local mobile feature with three layers:

1. **Food domain module:** Add a small `mobile/lib/food.ts` or equivalent module for preset definitions, stored record types, timer derivation, warning thresholds, status classification, and pure helper functions. Keep calculations testable without React Native.
2. **Food storage hook:** Add a hook such as `useFoodTimers()` that reads/writes MMKV through `STORAGE_KEYS`, consumes `useStatus()`, and derives active timer state from saved zone status plus persisted food state. Avoid storage reads at module load, matching `mobile/lib/storage.ts` guidance.
3. **Food tab UI:** Replace `food.tsx` with the real screen. Use `StyleSheet.create()`, `useTheme()`, Spanish-primary text through `mobile/lib/i18n.ts`, and compact utility layouts rather than marketing-style cards.

Status reads should continue through the static CDN model documented in `docs/ARCHITECTURE.md` and ADR-001. Food timers should never require a network round trip once presets and tracked foods are in local state.

## Existing Patterns to Reuse

- **MMKV key registry:** Extend `STORAGE_KEYS` in `mobile/lib/storage.ts`; do not create ad hoc storage key strings across components.
- **No module-load MMKV reads:** `storage.ts` explicitly allows module-level `createMMKV()` but warns against module-level `storage.get*()` calls. Food hooks should read inside hooks/components.
- **Saved zone:** Reuse `STORAGE_KEYS.selectedZone`; do not introduce multi-zone food tracking.
- **Status source:** Reuse `useStatus()` and `StatusJson.regions[selectedZone]`. `RegionEntry.outage?.started_at` and `elapsed_minutes` are the best available timer anchors.
- **Offline/stale honesty:** Phase 1 established visible stale status instead of hiding uncertainty. Food copy should state when timers are based on the last known outage start.
- **Notification permission UX:** Reuse Phase 3's point-of-use pattern. Food warnings should request notification permission only when the user enables food alerts or starts tracking foods during an outage.
- **i18n:** Add Food strings to `mobile/lib/i18n.ts`; Spanish is primary, English may follow existing fallback behavior.
- **Styling:** Follow existing React Native + Expo Router patterns: `ScrollView`, `Pressable`, `Switch`, `Ionicons`, theme tokens, and 8px-ish radii.

## Data Model

Recommended MMKV keys:

- `foodTrackedItems`: JSON array of tracked food records.
- `foodTimerState`: JSON object for current outage session metadata.
- `foodNotificationPrefs`: JSON object or individual booleans if consistent with notify toggles.
- `foodDismissedWarnings`: JSON object keyed by `timerSessionId:itemId:warningLevel` to avoid repeated local alerts.

Suggested stored types:

```ts
type FoodPresetId =
  | 'milk'
  | 'cheese'
  | 'eggs'
  | 'raw_chicken'
  | 'raw_beef'
  | 'cooked_leftovers'
  | 'cooked_rice'
  | 'arepas_dough'
  | 'vegetables'
  | 'full_freezer'
  | 'half_freezer';

type TrackedFoodItem = {
  id: string;
  name: string;
  category: string;
  thresholdMinutes: number;
  warningLeadMinutes: number;
  presetId?: FoodPresetId;
  createdAt: string;
  enabled: boolean;
};

type FoodTimerSession = {
  status: 'idle' | 'active' | 'restored_review';
  zone: string;
  outageStartedAt: string;
  source: 'status_outage_started_at' | 'status_elapsed_minutes' | 'detected_at';
  startedAtLocal: string;
  lastStatusUpdatedAt?: string;
  restoredAt?: string;
  acknowledgedOutagePromptAt?: string;
};
```

The preset catalog should be code/static data, not user-editable storage. Keep it compact and practical for FOOD-01. For FOOD-02, custom food v1 should be `name + thresholdMinutes` with optional category/default warning lead. Do not store quantities, prices, barcode data, household ownership, freezer temperature, or inventory history.

## Timer Semantics

FOOD-03 should auto-start timers only for foods the user has chosen to track. Auto-start should be explicit to the user: when the saved zone enters outage, show an in-app prompt if active and use a notification when appropriate. Avoid a silent workflow that leaves users wondering why timers appeared.

Outage detection:

- Treat `confirmed_outage`, `likely_outage`, or current mobile outage-equivalent statuses as outage candidates; planner should verify exact status strings in current app code before implementation.
- Prefer `region.outage.started_at` as the outage session start.
- If `started_at` is absent but `elapsed_minutes` exists, derive `outageStartedAt = now - elapsed_minutes`.
- If both are absent but the app observes a transition to outage, use local detection time and label the source accordingly.

Stale/offline behavior:

- If cached status is stale or fetch fails, keep active timers counting from the last known outage start. Do not switch to manual-only mode.
- UI copy should say the timer is based on the last update, not on live confirmation.
- If no first status has ever been cached, show an empty/offline state and let users manually prepare tracked foods, but do not invent an outage start.

Restoration behavior:

- When the saved zone status returns to power/restored/normal, reset active food timers and move the UI into a factual review state: "Volvio la luz. Revisa nevera y alimentos antes de consumir."
- Do not silently mark food safe. Do not keep active timers running after restoration.
- Store `restoredAt` only long enough to show the review state; planner can decide whether a "Cerrar revision" action clears it.

Warning classification:

- `safe`: elapsed < threshold - lead time.
- `warning`: elapsed >= threshold - lead time and elapsed < threshold.
- `expired/check`: elapsed >= threshold.

Use cautious early warnings. Candidate lead times: 30-60 minutes for short refrigerator thresholds, 2-4 hours for freezer thresholds. Copy must avoid guarantees; use "revisa", "evita abrir la nevera", and "si tienes dudas, descarta".

## Notification Strategy

NOTF-03 is best implemented with local Expo notifications for food timers. Pipeline push infrastructure is not required because spoilage timing is local, selected foods are local, and the feature must work offline. Phase 3 notification permission and preferences are still useful patterns.

Recommended behavior:

- Add a Food-specific notification preference, separate from outage/restoration/neighbor push toggles.
- Request notification permission at point of use: when enabling food alerts or confirming food timers after outage detection.
- Schedule local notifications for each enabled tracked food at `outageStartedAt + thresholdMinutes - warningLeadMinutes`.
- Cancel or reschedule food notifications when tracked foods change, warning lead changes, outage start changes, or power is restored.
- Cancel all active food timer notifications on restoration/reset.
- Deduplicate alerts through local IDs/dismissal state so opening the app does not schedule duplicates.

If Phase 3 has already added `expo-notifications`, reuse its registration/channel setup where possible, but do not register food timers with Supabase and do not send food state to the backend.

## UI/UX Constraints

- The Food tab should be the primary experience, not a placeholder or explainer screen.
- Use Spanish-first direct copy for Venezuelan users.
- Keep preset choices compact: basic groceries, common perishables, cooked leftovers, and freezer/fridge containers. Avoid medication-specific complexity unless represented as a simple preset.
- Make "track", "remove", and "reset" quick. Outage workflows are stressful and often battery-constrained.
- Show an outage prompt when a new outage is detected: "Se detecto un apagon en tu zona. Revisa tus temporizadores de comida."
- Show live elapsed time, remaining time, warning status, and uncertainty/stale state in each active timer.
- Do not claim safety based on unknown fridge temperature. The app tracks time since outage, not food temperature.
- Preserve battery-conscious UI: avoid heavy animation, polling, or background work beyond scheduled local notifications.

## Testing Plan

Focus tests on pure timer behavior first, then hooks/UI integration:

- **Preset/catalog tests:** FOOD-01 presets exist, are compact, have positive thresholds, warning lead is less than threshold, Spanish labels exist.
- **Custom item tests:** FOOD-02 validates non-empty name and sane threshold range; persists and removes custom items in MMKV-backed state.
- **Auto-start tests:** FOOD-03 starts only tracked/enabled foods when saved-zone status enters outage; uses `started_at` before `elapsed_minutes`; does not start every catalog preset.
- **Stale/offline tests:** Active timers continue counting from the last known outage start when `useStatus()` fails or cached status is stale.
- **Restoration tests:** Active session resets on power restoration and cancels scheduled food notifications.
- **Warning tests:** FOOD-04 classifies safe/warning/expired boundaries correctly, especially exact lead-time and threshold edges.
- **Notification tests:** NOTF-03 schedules one local warning per tracked item, reschedules on item edits, cancels on reset/restoration, and does not request permission before user intent.
- **UI tests/manual QA:** Food tab renders with no selected zone, selected zone normal, active outage, stale/offline active outage, restored review state, no tracked foods, and multiple tracked foods.

If the project has Jest/React Native Testing Library configured, isolate domain helpers into a pure module to avoid brittle native-module tests. Mock MMKV and Expo notifications in hook tests.

## Risks and Mitigations

- **Risk: inaccurate safety guarantee.** Mitigate with cautious language, early warnings, and explicit "check/discard if unsure" copy.
- **Risk: status string mismatch.** Mitigate by centralizing outage/restored status classification in one helper and covering current `RegionEntry.status` values in tests.
- **Risk: duplicate local notifications.** Mitigate with deterministic notification identifiers and stored scheduled/dismissed warning keys.
- **Risk: silent confusing auto-start.** Mitigate with in-app prompt and notification on outage detection before/while timers become active.
- **Risk: stale status stops timers.** Mitigate by persisting `FoodTimerSession.outageStartedAt` and continuing from it offline.
- **Risk: scope creep into pantry management.** Mitigate by limiting custom foods to name and threshold, no quantities/sync/barcodes/sharing.
- **Risk: restoration handling hides food risk.** Mitigate by resetting timers but showing a review state instead of "safe" messaging.

## Planner Notes

- Plan 1 should likely add the food domain module, presets, MMKV keys, and pure tests.
- Plan 2 can add `useFoodTimers()` with status integration, stale/offline continuation, auto-start prompt state, and restoration reset.
- Plan 3 can build the Food tab UI around tracked presets/custom foods and active timer cards.
- Plan 4 can add NOTF-03 local notification scheduling/cancellation and permission UX.
- Keep backend work out of Phase 4 unless implementation discovers Phase 3 notification setup is missing; even then, food state remains local.
- Update docs only if implementation changes architecture or dependencies. This research phase should write no files except this document.

## RESEARCH COMPLETE
