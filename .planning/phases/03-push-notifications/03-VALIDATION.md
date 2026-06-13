---
phase: 3
slug: push-notifications
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-13
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest (pipeline) / jest or vitest (mobile — Wave 0 confirms) |
| **Config file** | none — Wave 0 installs/confirms |
| **Quick run command** | `python -m pytest pipeline/test_notify.py -q` |
| **Full suite command** | `python -m pytest pipeline/ -q` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run quick run command
- **After every plan wave:** Run full suite command
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| _populated during planning_ | | | NOTF-01/02/04, INFR-01/02/03 | | | | | | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `pipeline/test_notify.py` — offline mock-data stubs for fan-out + adjacency + cooldown
- [ ] `pipeline/conftest.py` — shared fixtures (mock Supabase, mock Expo Push HTTP)
- [ ] Confirm mobile test runner (jest/vitest) if mobile logic gets unit coverage

*Planner to finalize against RESEARCH.md Validation Architecture section.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real device receives push | INFR-01 | Requires FCM credentials + physical device/dev build | Send test push to a registered token; confirm banner |
| OS permission dialog flow | NOTF-01 | Native OS dialog | Open notify tab, tap Activar, grant; confirm token registered |

*Planner to finalize.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
