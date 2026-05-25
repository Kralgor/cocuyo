---
phase: 01
plan: 04
subsystem: mobile
tags: [home-screen, status-hero, staleness-banner, signal-cards, settings-modal, offline, trust, expo-linking]
depends_on:
  requires: [01-02, 01-03]
  provides: [home-screen, status-hero-component, stale-banner-component, signal-card-component, settings-modal-component]
  affects: [01-05]
tech_stack:
  added: []
  patterns:
    - StatusHero animated shimmer skeleton — Animated.loop opacity 0.5→1.0→0.5 at 1200ms
    - StaleBanner non-dismissible — View only (no Pressable/TouchableOpacity), full-width warn bg
    - SignalCard bar fill — percentage string width on accent fill View inside lineStrong track
    - SettingsModal inline ZonePicker — no nested modal, rendered in sheet as resizable View
    - GITHUB_URL hardcoded constant in SettingsModal — never derived from remote data (T-01-08)
    - RefreshControl wired to useStatus().refetch for pull-to-refresh
    - Local boolean useState for SettingsModal visibility — no router navigation
key_files:
  created:
    - mobile/components/StatusHero.tsx
    - mobile/components/StaleBanner.tsx
    - mobile/components/SignalCard.tsx
    - mobile/components/SettingsModal.tsx
    - mobile/__tests__/components/SettingsModal.test.ts
  modified:
    - mobile/app/(tabs)/index.tsx
decisions:
  - "StatusHero hero text always #FFFFFF regardless of theme — contrast guaranteed by ok/warn/danger color choice (UI-SPEC contrast rule)"
  - "SkeletonCard inline component in index.tsx for signal card shimmer — avoids a third file for a 20-line animated placeholder"
  - "ZonePicker rendered inline in SettingsModal sheet as resized View (not nested modal) — avoids modal-over-modal z-index complexity"
  - "SettingsModal test file uses pure behavioral assertions without @testing-library/react-native — consistent with Wave 3 test pattern"
  - "fillPercent computed as template literal percentage string for React Native width — RN supports '72%' string width values"
metrics:
  duration: 6 minutes
  completed_date: "2026-05-25T23:16:00Z"
  tasks_completed: 3
  tasks_total: 3
  files_created: 5
  files_modified: 1
---

# Phase 1 Plan 04: Home Screen — StatusHero, StaleBanner, SignalCards, SettingsModal Summary

Zone detail home screen with color-coded 48sp status hero, non-dismissible amber staleness banner at >15 min, three signal breakdown bar cards (Internet/Reportes/Satélite), skeleton shimmer on first launch, and slide-up settings modal with hardcoded GitHub link and zone/theme controls.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | StatusHero + StaleBanner + SignalCard components | 303ae4a | 3 created |
| 2 | Zone detail home screen with header gear + states | 2c9ecee | 1 modified |
| 3 | Settings modal — privacy/GitHub + theme + zone | 8497f52 | 2 created |

## Verification Results

- `cd mobile && npx tsc --noEmit` → exits 0 (strict mode clean, all 6 files)
- `cd mobile && npx jest` → 91 tests pass across 8 suites (was 80/7 before; 11 new tests added)
- `grep -q "isOffline\|isStale" "mobile/app/(tabs)/index.tsx"` → found (STAT-03 gate)
- `grep -rq "github.com/kralgor/cocuyo" mobile/components/SettingsModal.tsx` → found (TRST-02)
- `grep -q "statusLabel" mobile/components/StatusHero.tsx` → found
- `grep -q "ageMinutes" mobile/components/StaleBanner.tsx` → found
- `grep -q "lineStrong" mobile/components/SignalCard.tsx` → found

## Deviations from Plan

None — plan executed exactly as written. ZonePicker (Plan 03) was available as noted in parallel execution context and was wired directly (no defensive fallback needed).

## Known Stubs

None. All components are fully wired with real data from useStatus() / useOffline() / useTheme(). No hardcoded empty values or placeholder text flow to UI rendering.

## Threat Flags

No new threat surface beyond what was declared in the plan threat register:

- T-01-07 mitigated: All RegionEntry field access uses optional chaining (`region?.status ?? 'no_data'`, `region?.signals.internet`, etc.) — missing or malformed fields fall back to no_data/skeleton states, no crash, no injection.
- T-01-08 mitigated: `GITHUB_URL = 'https://github.com/kralgor/cocuyo'` is a top-level constant in SettingsModal.tsx — never derived from remote data or user input.
- T-01-09 accepted: All displayed data is public outage status; no PII in Phase 1.
- T-01-SC: No new packages installed.

## Self-Check: PASSED

- `[ -f mobile/components/StatusHero.tsx ]` → FOUND (commit 303ae4a)
- `[ -f mobile/components/StaleBanner.tsx ]` → FOUND (commit 303ae4a)
- `[ -f mobile/components/SignalCard.tsx ]` → FOUND (commit 303ae4a)
- `[ -f mobile/app/(tabs)/index.tsx ]` → FOUND (commit 2c9ecee)
- `[ -f mobile/components/SettingsModal.tsx ]` → FOUND (commit 8497f52)
- `[ -f mobile/__tests__/components/SettingsModal.test.ts ]` → FOUND (commit 8497f52)
- Commits confirmed: 303ae4a, 2c9ecee, 8497f52
