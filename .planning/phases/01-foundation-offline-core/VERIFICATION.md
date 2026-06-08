---
phase: 01-foundation-offline-core
verified: 2026-06-08T00:00:00Z
status: human_needed
score: 5/5 must-haves verified (code-level)
overrides_applied: 0
human_verification:
  - test: "Install standalone preview APK (build 5684241e) and run the 8-step on-device checklist"
    expected: "Splash → onboarding → zone picker → home status; airplane mode shows amber stale banner with cached status; Wi-Fi back clears banner; settings theme toggle + Cambiar zona work"
    why_human: "On-device launch, real rendering, airplane-mode behavior, and live refresh cannot be verified by static code inspection or jest (no @testing-library/react-native, no device)"
  - test: "Verify real status.json renders once the CDN is live"
    expected: "Selected zone shows a real status hero (SIN LUZ / CON LUZ / etc.), duration line when an outage is active, and the 3 signal cards populate"
    why_human: "status.json CDN may not be live yet; fetch+render path is verified structurally but live data display is unconfirmed"
  - test: "Install and launch on a physical iOS device"
    expected: "App launches and is usable on iOS 16.4+"
    why_human: "iOS EAS build deferred (Apple Developer Program not purchased); PLAT-03 confirmed via Android only"
deferred: []
---

# Phase 1: Foundation + Offline Core Verification Report

**Phase Goal:** Users can open the app, see current outage status for any zone, view it offline with a staleness indicator, and trust the app is not government surveillance.
**Verified:** 2026-06-08
**Status:** human_needed (all 5 criteria CODE-VERIFIED; on-device + live-data smoke test is the remaining human gate)
**Re-verification:** No — initial verification

## Overall Verdict: PASS (code-level) — pending on-device confirmation

Every success criterion and every Phase 1 requirement is backed by concrete, wired implementation in `mobile/`. The full test suite (91/91) and `tsc --noEmit` (exit 0) were run independently by the verifier and confirmed green. The only items that cannot be closed by static analysis are the on-device smoke test, live `status.json` data rendering, and iOS (which is an accepted, recorded deferral — not a defect).

## Goal Achievement

### Observable Truths (Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can open the app and see real-time outage status for any Venezuelan zone | ✓ VERIFIED (code) | Data path fully wired: `lib/api.ts:80` `fetchStatus()` → `hooks/useStatus.ts:20` (React Query) → `app/(tabs)/index.tsx:56-65` reads `data.regions[selectedZone]` → `components/StatusHero.tsx:88` renders `statusLabel(status)`. 17 zones in `lib/regions.ts` (17 `display_name` entries). Zone selection path: `app/zone-picker.tsx:18` → `components/ZonePicker.tsx` (SectionList + search + status dots). Contract matches web `app/lib/api.ts` (same field names). Live data unconfirmed (CDN may not be live) → human check. |
| 2 | User can see how long a zone has been without power (outage duration displayed) | ✓ VERIFIED (code) | `components/StatusHero.tsx:69` `duration = outage?.started_at ? formatDuration(outage.elapsed_minutes, lang) : null`; rendered at line 91-93 only when an outage exists. `formatDuration` (`lib/i18n.ts:100`) produces "2 h 34 min" / "45 min". `OutageInfo.elapsed_minutes` typed in `lib/api.ts:27`. |
| 3 | User can view cached status offline, with a stale banner if cache > 15 min | ✓ VERIFIED (code) | Persistence: `lib/query.ts:28` MMKV `createSyncStoragePersister` + `networkMode: 'offlineFirst'` (line 39), `gcTime` 24h > `staleTime` 9min, wired via `PersistQueryClientProvider` in `app/_layout.tsx:41`. Staleness: `hooks/useOffline.ts:25` `isStale = ageMs > 15*60*1000`; `useStatus` writes `cacheTimestamp` on success (`useStatus.ts:27`). Banner gate: `app/(tabs)/index.tsx:75` `showBanner = isOffline || isStale` → `components/StaleBanner.tsx` (non-dismissible View, no Pressable). |
| 4 | User sees trust onboarding on first launch (open source, anonymity, non-government) | ✓ VERIFIED (code) | `app/onboarding.tsx:33-38` four trust points wired to i18n keys. `lib/i18n.ts:17-24` copy covers open source ("Verifica el código en GitHub"), anonymity ("Sin cuentas, sin registro, sin rastreo"), non-political ("Sin afiliación política / Hecho por venezolanos"), offline. First-launch gate: `app/_layout.tsx:56` `Stack.Protected guard={!hasSeenOnboarding}`; `onboarding.tsx:57` writes `hasSeenOnboarding=true` on Comenzar. |
| 5 | User can access privacy / open-source section in settings with a working GitHub link | ✓ VERIFIED (code) | `components/SettingsModal.tsx:169-182` "Privacidad y código abierto" section + GitHub row → `Linking.openURL(GITHUB_URL)` (line 85). `GITHUB_URL = 'https://github.com/kralgor/cocuyo'` hardcoded constant (line 28, T-01-08 mitigated). Modal mounted at `app/(tabs)/index.tsx:181`, opened via header gear (line 90). |

**Score:** 5/5 truths CODE-VERIFIED. Live rendering + on-device launch routed to human verification.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `mobile/lib/api.ts` | StatusJson contract + fetchStatus | ✓ VERIFIED | Full typed contract, fetch never throws, returns `{data, offline}`. Matches web contract. |
| `mobile/lib/query.ts` | Offline persister + offlineFirst | ✓ VERIFIED | MMKV sync persister, offlineFirst, gcTime>staleTime. |
| `mobile/hooks/useStatus.ts` | React Query wrapper, writes cache ts | ✓ VERIFIED | Writes `cacheTimestamp` on success; throws on null to trigger retry. |
| `mobile/hooks/useOffline.ts` | 15-min staleness + connectivity | ✓ VERIFIED | `isStale` at 15min threshold; `isOffline` from NetInfo. |
| `mobile/app/_layout.tsx` | Stack.Protected routing + persist provider | ✓ VERIFIED | 3 guards (onboarding/zone-picker/tabs), splash hide on persist onSuccess. |
| `mobile/app/(tabs)/index.tsx` | Home/zone-detail screen | ✓ VERIFIED | Wires useStatus/useOffline/useTheme → StatusHero/SignalCard/StaleBanner/SettingsModal. |
| `mobile/components/StatusHero.tsx` | Status + duration | ✓ VERIFIED | statusColor/statusLabel + formatDuration(elapsed_minutes). |
| `mobile/components/StaleBanner.tsx` | Non-dismissible stale banner | ✓ VERIFIED | View only, no dismiss control, amber warn bg. |
| `mobile/components/SignalCard.tsx` | Signal breakdown bars | ✓ VERIFIED | Imported + rendered 3× in index.tsx. |
| `mobile/components/SettingsModal.tsx` | Privacy + GitHub + zone + theme | ✓ VERIFIED | Privacy section, hardcoded GitHub link, inline ZonePicker, theme segmented control. |
| `mobile/app/onboarding.tsx` | Trust onboarding | ✓ VERIFIED | 4 trust points, GitHub link, Comenzar→MMKV flag. |
| `mobile/components/ZonePicker.tsx` | Searchable 17-zone picker | ✓ VERIFIED | SectionList + statusColor dots; reused by zone-picker route and SettingsModal. |
| `mobile/lib/regions.ts` | 17 canonical regions + filter | ✓ VERIFIED | 17 region entries + filterSections. |
| `mobile/lib/i18n.ts` | ES/EN strings + formatDuration | ✓ VERIFIED | All trust/settings/status keys present. |
| `mobile/lib/theme.ts` / `constants/colors.ts` | status→color mapping, 2 themes | ✓ VERIFIED | statusColor/statusLabel; LIGHT/DARK themes. |
| `mobile/app.json` | PLAT config (minSdk 24, deploymentTarget, updates, EAS id) | ⚠️ MOSTLY | minSdkVersion 24 ✓ (PLAT-01), deploymentTarget 16.4 (amended PLAT-02), `updates.enabled:true` + real EAS projectId ✓, **`updates.url` absent** (see WARNING). |
| `mobile/eas.json` | Build profiles + channels | ✓ VERIFIED | development/preview/production profiles, preview+production channels. (Cosmetic: trailing comma after `build` block — JSONC-tolerated by eas-cli.) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `useStatus` | `lib/api.fetchStatus` | import + call in queryFn | ✓ WIRED | `useStatus.ts:23` awaits fetchStatus, persists ts. |
| `(tabs)/index.tsx` | `useStatus`/`useOffline` | hook calls + render | ✓ WIRED | data→region→StatusHero/SignalCard; offline→StaleBanner. |
| `_layout.tsx` | persisted MMKV cache | PersistQueryClientProvider | ✓ WIRED | offline cache restored before splash hide. |
| `onboarding.tsx` | routing | MMKV write → Stack.Protected | ✓ WIRED | hasSeenOnboarding write re-evaluates guard. |
| `zone-picker.tsx` | routing | MMKV selectedZone → Stack.Protected | ✓ WIRED | selectedZone write advances to (tabs). |
| `SettingsModal` | GitHub | Linking.openURL(const) | ✓ WIRED | hardcoded URL, opened on press. |
| `StatusHero` | duration | formatDuration(elapsed_minutes) | ✓ WIRED | rendered only when outage present. |
| app runtime | OTA update server | `updates.url` | ⚠️ PARTIAL | `updates.enabled:true` but no `updates.url` — runtime OTA fetch has no endpoint configured (WARNING). |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `(tabs)/index.tsx` | `region` | `useStatus().data.regions[selectedZone]` ← `fetchStatus()` ← CDN `status.json` | Pending live CDN | ⚠️ STRUCTURALLY FLOWING — full fetch→render path verified; live data unconfirmed because CDN may not be live yet (routed to human). No hardcoded/empty fallback masks the real path; empty states are explicit error/skeleton branches. |
| `StatusHero` | `status`, `outage` | props from `region` | Same as above | ⚠️ As above |
| `SignalCard` | `value` | `region.signals.*` | Same as above | ⚠️ As above |

No HOLLOW_PROP detected: SignalCard/StatusHero receive real `region` fields, not hardcoded empties. Empty values appear only in explicit no-data/error/skeleton branches, which is correct UX.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Test suite green | `cd mobile && npx jest` | 91 passed, 8 suites, 0 failures | ✓ PASS |
| TypeScript strict clean | `cd mobile && npx tsc --noEmit` | exit 0 | ✓ PASS |
| 17 regions present | `grep -c display_name lib/regions.ts` | 17 region entries (+interface) | ✓ PASS |
| 5 tabs registered | `grep -c Tabs.Screen app/(tabs)/_layout.tsx` | 5 | ✓ PASS |
| No service_role key | inspected app.json/lib | none (anon-only, ADR-007) | ✓ PASS |
| App launch / live data / airplane mode | (device) | — | ? SKIP → human |

### Probe Execution

No conventional `scripts/*/tests/probe-*.sh` probes and no probe-based verification declared for this phase. The phase's runnable verification is the jest suite (run above) plus the EAS cloud build (succeeded server-side, build 0434f24f) and the manual 8-step device checklist. Probe step: N/A.

### Requirements Coverage

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|----------|
| STAT-01 | View real-time outage status for any zone | ✓ SATISFIED (code) | fetchStatus→useStatus→region→StatusHero; 17 zones; picker. Live data → human. |
| STAT-02 | See how long a zone has been without power | ✓ SATISFIED (code) | StatusHero.tsx:69/91 formatDuration(elapsed_minutes). |
| STAT-03 | Cached offline view + staleness indicator | ✓ SATISFIED (code) | MMKV persister + offlineFirst + useOffline 15-min + StaleBanner. |
| TRST-01 | Trust onboarding on first launch | ✓ SATISFIED (code) | onboarding.tsx + i18n trust copy + Stack.Protected first-launch gate. |
| TRST-02 | Persistent privacy/open-source section + GitHub link | ✓ SATISFIED (code) | SettingsModal privacy section + hardcoded GitHub Linking.openURL. |
| PLAT-01 | Runs on Android (API 24+) | ✓ SATISFIED | app.json `minSdkVersion: 24`; Android EAS dev build succeeded (APK 0434f24f). |
| PLAT-02 | Runs on iOS (15+) | ⚠️ AMENDED | `deploymentTarget: 16.4` (expo-build-properties hard-rejects 15.0 on SDK 56). Recorded as a requirement amendment to 16.4, not a defect. iOS build deferred → human (device). |
| PLAT-03 | OTA updates via Expo EAS Update | ⚠️ MOSTLY SATISFIED | `updates.enabled:true`, runtimeVersion appVersion, real EAS projectId, eas.json channels per-profile, Android build proves pipeline. **Gap:** `updates.url` absent from app.json — runtime OTA fetch endpoint not configured (WARNING). Confirmed via Android build only (iOS deferred). |

No ORPHANED requirements: REQUIREMENTS.md maps exactly STAT-01/02/03, TRST-01/02, PLAT-01/02/03 to Phase 1; all are claimed and addressed.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `app/(tabs)/report.tsx`, `notify.tsx`, `food.tsx`, `history.tsx` | 4 | `<PlaceholderTab/>` "Próximamente" | ℹ️ Info | Intentional Phase 2+ placeholders for non-Phase-1 tabs (D-01). Not part of any Phase 1 criterion. Not a gap. |
| `app/onboarding.tsx` | 73 | Text wordmark instead of logo image asset | ℹ️ Info | No logo asset in Phase 1; text wordmark satisfies TRST-01 functionally. |
| `mobile/app.json` | 17-20 | `updates.enabled:true` without `updates.url` | ⚠️ Warning | OTA runtime fetch has no endpoint (see PLAT-03 gap). |
| `mobile/eas.json` | end | trailing comma after `build` block | ℹ️ Info | JSONC; tolerated by eas-cli. Cosmetic. |

No `TBD`/`FIXME`/`XXX` debt markers in any source file. No `return null`/empty-data stubs flowing to UI. No service_role key exposure.

### Human Verification Required

#### 1. On-device standalone smoke test
**Test:** Install preview APK (https://expo.dev/accounts/kralgor/projects/cocuyo/builds/5684241e-9b5b-4ae6-b81c-89a94164f68f) and run the 8-step checklist.
**Expected:** Splash → onboarding → zone picker → home status; airplane mode shows amber stale banner with cached status persisting; Wi-Fi back clears banner and refreshes; settings theme toggle (Claro/Oscuro/Sistema) and Cambiar zona work.
**Why human:** Device launch, real rendering, airplane-mode behavior, and live refresh cannot be verified by jest (no @testing-library/react-native installed) or static inspection.

#### 2. Live status.json data rendering
**Test:** Once the CDN `status.json` is live, select a zone and observe the home screen.
**Expected:** Real status hero (SIN LUZ / CON LUZ / INESTABLE), duration line for active outages, and 3 signal cards populated.
**Why human:** CDN may not be live yet; fetch+render path verified structurally only.

#### 3. iOS device run
**Test:** Build + install on iOS 16.4+ (after Apple Developer Program purchase).
**Expected:** App launches and is usable on iOS.
**Why human:** iOS EAS build deferred ($99/yr Apple program not purchased); PLAT-03 confirmed via Android only — recorded, accepted deferral.

### Gaps Summary

No BLOCKERS. All 5 success criteria and all 8 requirements have concrete, wired, substantive implementations in `mobile/`, with 91/91 tests and tsc passing under independent re-run.

One WARNING (non-blocking for the Phase 1 goal): `app.json` sets `updates.enabled: true` but omits `updates.url` (`https://u.expo.dev/<projectId>`). The 01-05 step removed the placeholder via `eas init --force` and did not re-add the resolved URL. The EAS build pipeline and per-profile channels are configured and the Android build succeeded, so the build side of PLAT-03 is proven — but runtime OTA delivery will not resolve an update endpoint until `updates.url` is set. Recommend adding it before relying on `eas update` OTA in production (likely Phase 5 store work). Because PLAT-03's build pipeline is demonstrably working and OTA delivery is not exercised by any Phase 1 success criterion, this does not block the phase goal.

Recorded constraints (not defects): iOS build deferred (Apple program), PLAT-02 amended 15.0→16.4 (SDK 56 hard limit), live CDN data and on-device launch routed to human verification.

**Status is `human_needed`** because criteria 1 (live render) and the platform run require on-device/live confirmation; all code-level checks PASS.

---

_Verified: 2026-06-08_
_Verifier: Claude (gsd-verifier)_
