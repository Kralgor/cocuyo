---
phase: 5
slug: polish-store-submission
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-23
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from 05-RESEARCH.md "Validation Architecture".

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest-expo ~56.0.4 |
| **Config file** | `mobile/jest.config.js` |
| **Quick run command** | `npm test --prefix mobile -- --testPathPattern=history` |
| **Full suite command** | `npm test --prefix mobile` |
| **Estimated runtime** | ~15s quick / ~60s full |

---

## Sampling Rate

- **After every task commit:** Run quick command (history pattern)
- **After every plan wave:** Run full suite
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 05-01-* | 01 | 1 | STAT-04 | — | fetch returns null on non-OK; no PII stored | unit | `npm test --prefix mobile -- --testPathPattern=history` | ❌ W0 | ⬜ pending |
| 05-02-* | 02 | 2 | STAT-04 | — | history/forecast render; graceful null state | unit | `npm test --prefix mobile` | ❌ W0 | ⬜ pending |
| 05-03-* | 03 | 3 | PLAT-04/05 | — | only anon key in build config; no secrets committed | manual+config | `eas build --profile production --platform android` (human) | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `mobile/__tests__/lib/history.test.ts` — fetch + parse + null-state stubs for STAT-04
- [ ] react-native-svg installed via `npx expo install react-native-svg` (v15.15.5)

*Existing jest-expo infrastructure covers the rest.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| App live on Google Play | PLAT-04 | First AAB upload must be manual in Play Console; needs $25 account | Human uploads production AAB, completes listing |
| App live on Apple App Store | PLAT-05 | Needs Apple Developer Program ($99/yr) + App Store Connect record | Human enrolls, creates app record, submits build |
| History screen renders real CDN data | STAT-04 | Depends on `retrain` job having populated `history/*.json` | Open History tab on device with a real region selected |
