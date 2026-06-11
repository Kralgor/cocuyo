---
phase: 2
slug: reporting-sharing-quick-wins
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-11
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest-expo ~56.0.4 |
| **Config file** | `mobile/jest.config.js` (exists) |
| **Setup file** | `mobile/jest.setup.js` (mocks MMKV + NetInfo; needs expo-location/expo-battery mocks added in Wave 0) |
| **Quick run command** | `cd mobile && npx jest --testPathPattern="__tests__/lib/(queue|gps|share|amoled|parroquias)" --passWithNoTests` |
| **Full suite command** | `cd mobile && npx jest --passWithNoTests` |
| **Estimated runtime** | ~20 seconds |

---

## Sampling Rate

- **After every task commit:** Run quick command above
- **After every plan wave:** Run full suite
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Req | Behavior | Test Type | Automated Command | File Exists | Status |
|-----|----------|-----------|-------------------|-------------|--------|
| REPT-01 | `findNearestZone` correct zone for lat/lon; null beyond 150km | unit | `npx jest --testPathPattern="gps"` | ❌ W0 | ⬜ pending |
| REPT-01 | GPS timeout (10s Promise.race) falls back to null | unit | same | ❌ W0 | ⬜ pending |
| REPT-02 | savedZone fallback when GPS null | unit | same | ❌ W0 | ⬜ pending |
| REPT-03 | `enqueue` stores MMKV item with UUID | unit | `npx jest --testPathPattern="queue"` | ❌ W0 | ⬜ pending |
| REPT-03 | `flushQueue` removes on success / increments attempts on failure | unit | same | ❌ W0 | ⬜ pending |
| REPT-03 | discard after MAX_ATTEMPTS | unit | same | ❌ W0 | ⬜ pending |
| REPT-03 | 30-min cooldown blocks second enqueue | unit | same | ❌ W0 | ⬜ pending |
| SHAR-01 | `composeShareText` omits ETA when absent / includes duration when present | unit | `npx jest --testPathPattern="share"` | ❌ W0 | ⬜ pending |
| BATT-01 | AMOLED theme `bg:#000000`, inherits dark tokens | unit | `npx jest --testPathPattern="amoled"` | ❌ W0 | ⬜ pending |
| BATT-02 | `useBattery` saving=true <0.20; false at -1 (unavailable) | unit | same | ❌ W0 | ⬜ pending |
| BATT-03 | parroquias lookup: empty for unknown region; arrays for valid pairs | unit | `npx jest --testPathPattern="parroquias"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `mobile/__tests__/lib/queue.test.ts` — REPT-03 queue logic stubs
- [ ] `mobile/__tests__/lib/gps.test.ts` — REPT-01/02 haversine + timeout
- [ ] `mobile/__tests__/lib/share.test.ts` — SHAR-01 text composition
- [ ] `mobile/__tests__/lib/amoled.test.ts` — BATT-01/02 theme + battery hook
- [ ] `mobile/__tests__/lib/parroquias.test.ts` — BATT-03 data lookup
- [ ] `mobile/jest.setup.js` — add expo-location, expo-battery mocks

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| WhatsApp opens with prefilled text | SHAR-01 | Requires WhatsApp installed on device | Tap share on zone hero → WhatsApp opens with Spanish status text |
| GPS permission flow on real device | REPT-01 | Permission dialogs not testable in jest | First report → permission prompt → zone prefilled within 10s |
| Offline report syncs on reconnect | REPT-02 | Real connectivity transition | Airplane mode → report → disable airplane → queue flushes |
| Supabase INSERT with parroquia column | REPT-03 | Live DB; user must run ALTER TABLE + GRANT in Supabase first | Submit report with parroquia → row visible in Supabase table editor |
| AMOLED on OLED screen | BATT-01 | Visual verification | Settings → AMOLED → backgrounds pure black |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-06-11
