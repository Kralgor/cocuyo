# 05-03 Summary — Store Submission Setup

**Date:** 2026-08-14
**Plan:** 05-03-PLAN.md — eas.json submit profiles + app.json metadata + EAS build + human gates
**Status:** ✅ Task 1 complete — ⛔ Gates A (Android) and B (iOS) BLOCKED on human credentials

## What was done (Task 1 — all automated)

1. **`mobile/eas.json`** — added `submit.production` profiles:
   - `android`: `serviceAccountKeyPath: ./credentials/google-service-account.json`, `track: "internal"`
   - `ios`: `appleId: "leonardoduam@gmail.com"`, `ascAppId: "<APP_STORE_CONNECT_APP_ID>"`, `appleTeamId: "<APPLE_TEAM_ID>"` (placeholders per plan)
   - Valid JSON verified via `node -e "require(...)"`.
2. **`mobile/app.json` metadata verified** (no changes needed — already correct): `version 1.0.0`, `android.versionCode 1`, `ios.buildNumber "1"`, `android.package app.cocuyo.mobile`, `ios.bundleIdentifier app.cocuyo.mobile`, `ITSAppUsesNonExemptEncryption: false`. iOS permission strings present (expo-location `locationWhenInUsePermission` Spanish copy).
3. **`.gitignore` fix**: the plan/RESEARCH asserted `credentials/` was gitignored — it was not (only `credentials.json` and `*.jks`). Added `/credentials/` so the Google service-account JSON (Gate A step 3) can never be committed accidentally (threat T-05-05 mitigation). Verified: `git check-ignore mobile/credentials/google-service-account.json` → ignored; nothing tracked under `credentials/`.

## Not done (blocked)

- **EAS production Android build** (Gate A step 4): `eas` CLI not installed anywhere in this environment and no `EXPO_ACCESS_TOKEN` present — build requires human credentials/login.
- **Gate A — Google Play**: requires $25 developer account, Play Console app creation, service-account JSON, first MANUAL AAB upload (API cannot create apps), store listing.
- **Gate B — iOS**: requires $99/yr Apple Developer Program enrollment (blocked since Phase 1), App Store Connect record, real ascAppId/appleTeamId.

## Human resume signals (from plan)

- Gate A: type **"android-live"** after the AAB is visible in Play Console internal testing.
- Gate B: type **"ios-review"** when iOS build is submitted to App Review, or **"ios-deferred"** if skipping.

## Gate A quick reference (full detail in 05-03-PLAN.md)

1. Play Console: create app, package `app.cocuyo.mobile`
2. Generate Google service account JSON → `mobile/credentials/google-service-account.json`
3. `cd mobile && eas build --platform android --profile production` (needs `eas-cli` + `EXPO_ACCESS_TOKEN` or `expo login`)
4. Download AAB → Play Console → Internal testing → Create release → upload (FIRST upload must be manual)
5. Complete listing: short/full description (Spanish), ≥2 screenshots, feature graphic 1024×500, content rating, data-safety form (no data collected), privacy policy URL
6. After manual upload: `eas submit --platform android --profile production --latest` works
