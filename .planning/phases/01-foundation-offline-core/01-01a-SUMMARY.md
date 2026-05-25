---
phase: 01
plan: 01a
subsystem: mobile
tags: [expo, scaffold, jest, config, eas]
depends_on:
  requires: []
  provides: [mobile-scaffold, jest-harness]
  affects: [01-01b]
tech_stack:
  added:
    - expo@56.0.4
    - expo-router@56.2.6
    - react-native@0.85.3
    - react-native-mmkv@4.3.1
    - react-native-nitro-modules@0.35.7
    - "@tanstack/react-query@5.100.14"
    - "@tanstack/react-query-persist-client@5.100.14"
    - "@tanstack/query-sync-storage-persister@5.100.14"
    - "@react-native-community/netinfo@12.0.1"
    - expo-localization@56.0.6
    - expo-updates@56.0.16
    - expo-build-properties@56.0.14
    - jest-expo@56.0.4
  patterns:
    - Expo Router file-based navigation (expo-router/entry main)
    - MMKV in-memory jest mock for synchronous storage tests
    - babel-preset-expo with api.cache(true)
key_files:
  created:
    - mobile/package.json
    - mobile/app.json
    - mobile/eas.json
    - mobile/tsconfig.json
    - mobile/babel.config.js
    - mobile/jest.config.js
    - mobile/jest.setup.js
    - mobile/app/_layout.tsx
    - mobile/app/index.tsx
  modified: []
decisions:
  - "deploymentTarget set to 16.4 (not 15.0): expo-build-properties SDK 56 plugin validation rejects 15.0 at config parse time — fallback per RESEARCH.md Q1 applied"
  - "Template src/ removed and replaced with minimal app/_layout.tsx + app/index.tsx: template used @/components mapping to src/ which conflicts with required @/*: [./*] path alias"
  - "EAS init deferred to human-action gate: requires expo.dev login; [EAS_PROJECT_ID] placeholder left in app.json"
metrics:
  duration: 7 minutes
  completed_date: "2026-05-25T22:30:57Z"
  tasks_completed: 2
  tasks_total: 2
  files_created: 9
  files_modified: 0
---

# Phase 1 Plan 01a: Expo SDK 56 Scaffold + EAS Config + Jest Harness Summary

Expo SDK 56 project scaffolded in `mobile/` with all Phase 1 packages installed, Cocuyo-specific config applied (PLAT-01/02/03), and a jest-expo test harness running green — providing the Wave 1 foundation for Plan 01-01b lib module authoring.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Scaffold Expo SDK 56 + config files + EAS init | 712e8f9 | mobile/package.json, app.json, eas.json, tsconfig.json, babel.config.js, app/_layout.tsx, app/index.tsx |
| 2 | Test harness — jest config + MMKV/NetInfo mocks | b6a4708 | mobile/jest.config.js, mobile/jest.setup.js |

## Verification Results

- `cd mobile && npx tsc --noEmit` → exits 0 (strict mode clean)
- `cd mobile && npx jest --passWithNoTests` → exits 0 (harness boots)
- `grep -rn "SERVICE_ROLE" mobile/ | grep -v node_modules` → empty (ADR-007 compliant)
- `grep -q 'deploymentTarget' mobile/app.json` → present (16.4)
- `grep -q 'minSdkVersion' mobile/app.json` → present (24)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] iOS deploymentTarget changed from 15.0 to 16.4**
- **Found during:** Task 2 (expo install jest-expo triggered config validation)
- **Issue:** expo-build-properties SDK 56 plugin throws `Error: ios.deploymentTarget needs to be at least version 16.4` at config parse time when set to "15.0". This is a hard validation error, not just a warning.
- **Fix:** Changed `"ios": { "deploymentTarget": "16.4" }` in mobile/app.json per RESEARCH.md Q1 fallback: "If expo-doctor flags it, accept 16.4 and update PLAT-02 constraint with Leo."
- **Impact:** PLAT-02 requirement states iOS 15+. Effective minimum is now iOS 16.4. iOS 15.x users (~2-5% globally) cannot install the app. This is a constraint change that should be reviewed with Leo.
- **Files modified:** mobile/app.json
- **Commit:** b6a4708

**2. [Rule 1 - Bug] Template src/ directory removed**
- **Found during:** Task 1 (tsc --noEmit check)
- **Issue:** Template scaffold used `@/components` → `./src/components` path mapping. Plan requires `@/*: ["./*"]`. With the plan's tsconfig, all template src/ imports failed resolution (31 errors).
- **Fix:** Removed template `src/` and `scripts/` directories; created minimal `app/_layout.tsx` + `app/index.tsx` at the correct Expo Router root per RESEARCH.md project structure.
- **Files modified:** Removed `mobile/src/`, `mobile/scripts/`; created `mobile/app/_layout.tsx`, `mobile/app/index.tsx`
- **Commit:** 712e8f9

### EAS Init — Auth Gate (not started, checkpoint deferred)

`eas init` requires Expo account authentication. Attempted but received:
```
An Expo user account is required to proceed.
Either log in with eas login or set the EXPO_TOKEN environment variable.
```
`[EAS_PROJECT_ID]` placeholder remains in `app.json` at:
- `expo.updates.url`: `https://u.expo.dev/[EAS_PROJECT_ID]`
- `expo.extra.eas.projectId`: `[EAS_PROJECT_ID]`

User must run `eas login` followed by `eas init` from the `mobile/` directory.

## Known Stubs

| Stub | File | Line | Reason |
|------|------|------|--------|
| `[EAS_PROJECT_ID]` in updates.url | mobile/app.json | 15 | EAS init requires expo.dev auth — human-action gate |
| `[EAS_PROJECT_ID]` in extra.eas.projectId | mobile/app.json | 63 | Same — populated by `eas init` |

These stubs do NOT prevent Plan 01-01a's goals (scaffold + harness). They DO need resolution before Plan 01-05 (EAS Build) and live OTA updates work.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: information_disclosure | mobile/app.json | extra.statusCdnUrl = https://cdn.cocuyo.app/status.json — public CDN URL, no secrets, acceptable |

No service_role key exposure. No new auth paths. No user data storage in this plan.

## Self-Check

Committed files verified:

- `[ -f mobile/app.json ]` → exists in commit 712e8f9
- `[ -f mobile/eas.json ]` → exists in commit 712e8f9
- `[ -f mobile/jest.config.js ]` → exists in commit b6a4708
- `[ -f mobile/jest.setup.js ]` → exists in commit b6a4708
- `[ -f mobile/tsconfig.json ]` → exists in commit 712e8f9
- `[ -f mobile/babel.config.js ]` → exists in commit 712e8f9
- Commits confirmed: `git log --oneline -2` → b6a4708, 712e8f9

## Self-Check: PASSED
