phase: 02
plan: 01
subsystem: mobile-config
tags: [expo, supabase, jest, storage, i18n, schema]
depends_on: [01-foundation-offline-core]
provides: [reporting-foundation-config, supabase-public-config, parroquia-schema-contract]
affects: [02-02, 02-03, 02-04, 02-05, 02-06, 02-07]
tech_stack:
  added:
    - expo-location@56.0.17
    - expo-battery@56.0.4
    - expo-crypto@56.0.4
  patterns:
    - Expo config extra carries only public Supabase URL and anon key
    - Expo Location config plugin owns Spanish when-in-use permission copy
    - Phase 2 native module mocks live in mobile/jest.setup.js
key_files:
  created:
    - .planning/phases/02-reporting-sharing-quick-wins/02-USER-SETUP.md
  modified:
    - mobile/package.json
    - mobile/package-lock.json
    - mobile/app.json
    - mobile/jest.setup.js
    - mobile/lib/storage.ts
    - mobile/lib/i18n.ts
    - docs/schema.sql
    - docs/ARCHITECTURE.md
key_decisions:
  - Reused the existing root .env Supabase project URL and kept service_role out of mobile config.
  - Stored the anon/public key in app.json extra per ADR-007 and Plan 02-01.
  - Documented parroquia as nullable optional input while preserving server-owned state/sub_zone fields.
requirements_completed: [REPT-01, REPT-02, REPT-03, SHAR-01, BATT-01, BATT-02, BATT-03]
duration: 1h 20m
completed: 2026-06-12

# Phase 02 Plan 01: Reporting Foundation Config Summary

Expo reporting dependencies, Supabase public config, Phase 2 storage/i18n mocks, and nullable parroquia schema support are ready for downstream report-flow plans.

## What Changed

- Installed and locked `expo-location`, `expo-battery`, and `expo-crypto` at SDK 56-compatible versions.
- Added `expo-location` config plugin with Spanish when-in-use permission text.
- Added `expo.extra.supabaseUrl` and `expo.extra.supabaseAnonKey`; no service-role key is present in mobile config.
- Extended `STORAGE_KEYS` with `reportQueue` and `lastReportTime`, and updated theme override docs for `amoled`.
- Added Phase 2 i18n keys for reporting, GPS, queue, toast, contacts, sharing, battery, and AMOLED copy.
- Added Jest mocks for `expo-location`, `expo-battery`, and `expo-crypto`.
- Added nullable `parroquia` support to `docs/schema.sql` and documented it in `docs/ARCHITECTURE.md`.
- Persisted and completed the Supabase dashboard setup checklist in `02-USER-SETUP.md`.

## Verification

- `node` config check: dependencies, Supabase extra, location plugin, and no service-role leak passed.
- `node` storage/i18n/mock check passed.
- `rtk npx jest --passWithNoTests` passed: 8 suites, 95 tests.
- User confirmed Supabase dashboard setup was completed for the `parroquia` migration and anon key.

## Issues Encountered

- Initial `npm install` failed with DNS `EAI_AGAIN` under sandboxed network access. Re-ran `rtk npm install` with approved network access; install completed and dependency versions resolved correctly.
- The Supabase project URL existed in root `.env`, but the public anon variables were empty. User supplied/completed the anon key in `mobile/app.json`.

## Deviations From Plan

- Created `02-USER-SETUP.md` and marked it complete after user confirmation, preserving the human-action checkpoint record.

## User Setup Required

Complete. See `02-USER-SETUP.md`.

## Self-Check: PASSED

All key files exist, production commit `e631cfb` exists for `02-01`, acceptance criteria passed, and plan-level verification is green.

## Next

Ready for `02-02`: bundled parroquias/contacts assets and pure-lib test scaffolding.
