---
phase: 1
slug: foundation-offline-core
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-25
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest 29 (bundled with Expo SDK 56) + React Native Testing Library |
| **Config file** | `mobile/jest.config.js` (Wave 0 creates this) |
| **Quick run command** | `cd mobile && npx jest --testPathPattern=__tests__` |
| **Full suite command** | `cd mobile && npx jest` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd mobile && npx jest --testPathPattern=__tests__`
- **After every plan wave:** Run `cd mobile && npx jest`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Secure Behavior | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------------|-----------|-------------------|--------|
| status-color-map | scaffold | 1 | STAT-01 | N/A | unit | `npx jest statusColor` | ⬜ pending |
| duration-calc | scaffold | 1 | STAT-02 | N/A | unit | `npx jest duration` | ⬜ pending |
| cache-staleness | cache | 1 | STAT-03 | N/A | unit | `npx jest staleness` | ⬜ pending |
| region-filter | zone-picker | 1 | STAT-01 | N/A | unit | `npx jest regionFilter` | ⬜ pending |
| i18n-lookup | i18n | 1 | TRST-01 | N/A | unit | `npx jest i18n` | ⬜ pending |
| onboarding-flag | onboarding | 1 | TRST-01 | N/A | unit | `npx jest onboarding` | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `mobile/jest.config.js` — Jest config with Expo preset
- [ ] `mobile/__tests__/statusColor.test.ts` — stub: status value → color/label mapping
- [ ] `mobile/__tests__/duration.test.ts` — stub: outageSince ISO string → "Hace Xh Ym" string
- [ ] `mobile/__tests__/staleness.test.ts` — stub: cache timestamp + now → isStale boolean (>15 min)
- [ ] `mobile/__tests__/regionFilter.test.ts` — stub: search string → filtered region list
- [ ] `mobile/__tests__/i18n.test.ts` — stub: locale string + key → translated string
- [ ] `mobile/__tests__/onboarding.test.ts` — stub: MMKV hasSeenOnboarding flag → navigation guard

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| App builds and launches on Android emulator | PLAT-01 | Native build verification | `eas build --profile development --platform android` then install on API 24 emulator |
| App builds and launches on iOS simulator | PLAT-02 | Native build verification | `eas build --profile development --platform ios` then install on iOS 15 simulator |
| OTA update delivered to device | PLAT-03 | Requires live EAS project + device | `eas update --branch preview` and confirm device receives update |
| Trust onboarding screen appears on first launch | TRST-01 | UI flow verification | Clear app data, launch, verify trust screen appears before zone picker |
| Trust screen never shows again after first use | TRST-01 | UI flow verification | Complete onboarding, kill app, relaunch — trust screen must not appear |
| Privacy/About section accessible in Settings | TRST-02 | UI navigation verification | Open Settings (gear icon), verify About/Privacy section with working GitHub link |
| Staleness banner appears when cache >15 min old | STAT-03 | Requires time manipulation or mock | Mock status fetch to fail after 15 min, verify yellow banner appears |
| Offline state shows cached data | STAT-03 | Requires network toggle | Enable airplane mode, launch app, verify cached data displays |
| Dark mode follows system preference | D-06 | UI visual verification | Toggle device dark mode, verify app theme switches |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
