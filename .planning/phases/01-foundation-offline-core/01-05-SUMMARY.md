---
phase: 01-foundation-offline-core
plan: "05"
subsystem: infra
tags: [eas, expo, build, android, ios, ota, device-verification]

requires:
  - phase: 01-01a
    provides: mobile-scaffold, eas.json profiles, app.json config
  - phase: 01-01b
    provides: lib modules, offline cache, i18n, status color logic
  - phase: 01-03
    provides: navigation flow, trust onboarding, zone picker
  - phase: 01-04
    provides: zone detail, settings modal, staleness banner

provides:
  - EAS cloud development builds for Android + iOS (pending user auth + build completion)
  - OTA update delivery (pending device verification)
  - Phase 1 human sign-off on all 8 verification criteria

affects: [phase-02, eas-update-channel]

tech-stack:
  added: []
  patterns:
    - EAS cloud build (non-interactive) for WSL environments without native toolchains
    - eas-cli via npx eas-cli (not local install, not eas binary on PATH)

key-files:
  created:
    - .planning/phases/01-foundation-offline-core/01-05-SUMMARY.md
  modified:
    - mobile/app.json (eas init will replace [EAS_PROJECT_ID] placeholder — blocked on auth)

key-decisions:
  - "EAS init and builds blocked on auth gate — user must run eas login before eas init and eas build"
  - "eas CLI invoked as npx eas-cli (not npx eas) — binary not installed locally or in node_modules"
  - "expo-doctor passes 21/21 checks — no issues; iOS 16.4 deploymentTarget already resolved in Plan 01-01a"
  - "deploymentTarget remains 16.4 (not 15.0) — expo-build-properties hard-rejects 15.0 at config parse time"

requirements-completed: []

duration: 15min
completed: "2026-05-25"
---

# Phase 01 Plan 05: EAS Development Builds + Manual Device Verification Summary

**Pre-build verification complete (TypeScript + 91 Jest tests pass); EAS builds blocked at auth gate — user must run `eas login` then `eas init` then trigger builds.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-05-25T23:45:00Z
- **Completed:** 2026-05-25T23:55:00Z
- **Tasks:** 0 of 2 auto-tasks complete (blocked at EAS auth gate before Task 1 build step)
- **Files modified:** 0 (eas.json already correct; app.json awaits eas init)

## Accomplishments

- TypeScript typecheck passes (`npx tsc --noEmit` exits 0)
- Full Jest suite passes: 91 tests across 8 suites in 13.7s
- expo-doctor 21/21 checks pass — no issues detected
- eas.json confirmed correct: development profile has `developmentClient: true, distribution: internal`
- `npx eas-cli whoami` → "Not logged in" — auth gate confirmed

## Task Commits

No task commits — plan halted at EAS auth gate before any file-modifying work.

## Files Created/Modified

- No files created or modified — eas.json was already correct from Plan 01-01a.

## Decisions Made

- `npx eas-cli` is the correct invocation (not `npx eas` or `eas` binary). The eas-cli package is not installed locally in `mobile/node_modules/`.
- iOS deploymentTarget is 16.4 (not 15.0). This was fixed in Plan 01-01a. expo-doctor confirms no iOS target warnings.
- The `[EAS_PROJECT_ID]` placeholder in `mobile/app.json` (lines 15 and 63) must be replaced by `eas init` — this requires expo.dev auth first.

## Deviations from Plan

None — plan halted at the expected auth gate. EAS auth was an identified risk in Plan 01-01a-SUMMARY.md. No unplanned work was required.

## Issues Encountered

**EAS auth gate (expected, not a bug):**
- `npx eas-cli whoami` returns "Not logged in"
- `eas init` and `eas build` cannot proceed without expo.dev authentication
- This was pre-identified in Plan 01-01a-SUMMARY.md ("EAS Init — Auth Gate")

**expo-doctor findings:** None. 21/21 checks pass. iOS 16.4 deploymentTarget does not trigger any warning (correct value per Plan 01-01a fix).

## User Setup Required

See checkpoint below — user must complete EAS auth and trigger builds manually.

## Next Phase Readiness

Blocked pending:
1. User runs `eas login` (expo.dev credentials)
2. User runs `cd mobile && npx eas-cli init` (sets real project ID in app.json — replaces `[EAS_PROJECT_ID]`)
3. User triggers `npx eas-cli build --profile development --platform android --non-interactive`
4. User triggers `npx eas-cli build --profile development --platform ios --non-interactive`
5. User installs artifacts on device/emulator and completes 8-step verification checklist

Once builds are triggered and user completes on-device verification, PLAT-01/02/03, TRST-01/02, STAT-01/02/03 requirements are confirmed closed and Phase 1 is complete.

---
*Phase: 01-foundation-offline-core*
*Completed: 2026-05-25*
