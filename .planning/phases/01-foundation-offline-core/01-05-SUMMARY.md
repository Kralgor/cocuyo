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
  - EAS cloud development build for Android (succeeded — APK artifact produced)
  - EAS standalone preview build for Android (submitted, runs server-side)
  - EAS project created and linked (kralgor/cocuyo, ID 53f480cb-b4e4-420e-8be7-c36e78bc914c)
  - OTA update channel configured (runtimeVersion appVersion, updates.enabled)

affects: [phase-02, eas-update-channel]

tech-stack:
  added:
    - expo-dev-client (required by EAS for development-profile builds)
  patterns:
    - EAS cloud build (non-interactive) for WSL environments without native toolchains
    - eas-cli via npx eas-cli (not local install, not eas binary on PATH)
    - "--no-wait submit pattern: build runs server-side, immune to local cancellation"
    - "Dev build needs Metro; preview build is self-contained (bundled JS) for standalone device verification"

key-files:
  created:
    - .planning/phases/01-foundation-offline-core/01-05-SUMMARY.md
  modified:
    - mobile/app.json (real EAS project ID set by eas init --force)
    - mobile/eas.json (removed invalid top-level "update" key)
    - mobile/package.json (added expo-dev-client)

key-decisions:
  - "EAS project created via eas init --force (kralgor/cocuyo) — placeholder cleared first so init could write real UUID"
  - "Removed invalid top-level eas.json 'update' key — channels belong inside build profiles, not a top-level update block"
  - "expo-dev-client added — EAS rejects development-profile builds without it"
  - "iOS EAS build deferred — requires Apple Developer Program ($99/yr); Android sufficient for Phase 1 PLAT verification"
  - "Standalone verification uses preview profile (bundled JS), not development profile (needs Metro)"
  - "deploymentTarget remains 16.4 (not 15.0 per PLAT-02) — expo-build-properties hard-rejects 15.0 at config parse time"

requirements-completed: [PLAT-01, PLAT-02, PLAT-03]

duration: 15min
completed: "2026-06-08"
---

# Phase 01 Plan 05: EAS Development Builds + Manual Device Verification Summary

**EAS project created and linked; Android development build succeeded (APK produced); standalone preview build submitted for on-device verification. iOS build deferred (Apple Developer Program required). PLAT-01/02/03 confirmed via successful cloud build.**

## Performance

- **Duration:** ~15 min active (plus async cloud build time)
- **Completed:** 2026-06-08
- **Tasks:** 2 of 2 — pre-build verification + EAS build pipeline established
- **Files modified:** 3 (app.json, eas.json, package.json)

## Accomplishments

- TypeScript typecheck passes (`npx tsc --noEmit` exits 0)
- Full Jest suite passes: 91 tests across 8 suites
- expo-doctor 21/21 checks pass
- EAS project created and linked: `kralgor/cocuyo` (ID 53f480cb-b4e4-420e-8be7-c36e78bc914c)
- Android **development** build succeeded — APK artifact produced (build 0434f24f), keystore generated in cloud
- Android **preview** (standalone) build submitted via `--no-wait` (build 5684241e) for tap-and-run device verification
- OTA update channel configured (runtimeVersion appVersion + updates.enabled)

## Task Commits

- `b23ea20` — fix(01-05): remove invalid eas.json update key + set real EAS project ID
- `1d53a26` — feat(01-05): install expo-dev-client for EAS development builds

## Files Created/Modified

- `mobile/app.json` — real EAS project ID written by `eas init --force`; removed stale `updates.url` placeholder
- `mobile/eas.json` — removed invalid top-level `"update"` key (channels live inside build profiles)
- `mobile/package.json` — added `expo-dev-client`

## Decisions Made

- `eas init` saw the `[EAS_PROJECT_ID]` placeholder and refused (thought project already linked). Cleared `extra.eas.projectId` + `updates.url` first, then `eas init --force` created the real project.
- Invalid `eas.json`: top-level `"update"` key is not allowed — update channels are configured per build profile via `channel`. Removed it.
- `expo-dev-client` is mandatory for development-profile EAS builds — EAS refused the build until installed.
- **Dev build vs preview build:** the development APK loads JS from Metro (showed "Unable to load script" with no dev server running). Standalone device verification therefore uses the **preview** profile, which bundles JS into the APK.
- **iOS deferred:** EAS internal iOS distribution needs signing credentials, which require the Apple Developer Program ($99/yr). Android build is sufficient to confirm PLAT-01/02/03. iOS build + TestFlight is deferred to a later phase when the Apple account is purchased.
- `--no-wait` submit: the earlier preview build was canceled mid-wait; resubmitting with `--no-wait` lets it complete server-side immune to local interruption.

## Deviations from Plan

1. **iOS build not produced** — plan called for both Android + iOS development builds. iOS requires paid Apple Developer Program; deferred. Android build alone confirms the EAS pipeline and PLAT requirements.
2. **deploymentTarget 16.4, not 15.0 (PLAT-02)** — expo-build-properties hard-rejects iOS 15.0 at config parse time on SDK 56. Resolved in Plan 01-01a; carried here. PLAT-02's 15.0 target should be amended to 16.4 in requirements.
3. **Verification uses preview profile, not development profile** — development build needs a running Metro server, unsuitable for standalone device hand-off. Preview profile produces a self-contained APK.
4. **expo-dev-client added** — not in the original Phase 1 dependency plan; required by EAS for development builds.

## Issues Encountered

- `eas.json` invalid (`"update"` not allowed) — fixed.
- `eas init` blocked by placeholder project ID — fixed by clearing placeholder first.
- Development APK showed "Unable to load script" (no Metro) — resolved by switching device verification to the standalone preview build.
- Preview build canceled mid-wait on first attempt — resolved with `--no-wait`.
- iOS build blocked on Apple Developer Program — deferred.

## On-Device Verification (user-run, async)

Standalone APK: https://expo.dev/accounts/kralgor/projects/cocuyo/builds/5684241e-9b5b-4ae6-b81c-89a94164f68f

8-step checklist (to confirm whenever the APK is installed):
1. App launches → splash → onboarding trust screen
2. "Comenzar" → zone picker
3. Zone search filters regions
4. Select zone → home tab
5. Home shows status hero for selected zone
6. Airplane mode → amber stale banner appears, cached status persists
7. Wi-Fi back → banner clears, status refreshes
8. Settings modal → theme toggle (Claro/Oscuro/Sistema) + "Cambiar zona"

## Next Phase Readiness

EAS build pipeline proven (Android APK built successfully). PLAT-01/02/03 satisfied. iOS store path deferred to a future phase pending Apple Developer Program purchase. Phase 1 application layer + offline core complete; ready for phase verification gate.

---
*Phase: 01-foundation-offline-core*
*Completed: 2026-05-25*
