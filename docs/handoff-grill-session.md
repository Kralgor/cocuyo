# Handoff: Grill Session — Architecture Decisions for Cocuyo

**Date:** 2026-05-16  
**Session type:** /grill-with-docs (Opus)  
**Duration:** 48 questions resolved  
**Next step:** Begin implementation at T-001  

---

## What happened

Full architectural grilling of the Cocuyo spec (docs/SPEC.md) against
reality. Challenged every assumption in the 22-section specification.
Resolved ambiguities, deferred premature features, tightened security,
and made Phase 1 scope honest about what it can actually deliver.

---

## ADRs Created (7)

| ADR | Decision | File |
|-----|----------|------|
| 003 | Internet signal is national, not per-region, in Phase 1-2 | docs/adr/003-internet-signal-is-national.md |
| 004 | Phase 1 operates in data-collection mode, not detection mode | docs/adr/004-phase1-data-collection-mode.md |
| 005 | Device fingerprint deferred from validation until Phase 4 | docs/adr/005-device-fingerprint-deferred.md |
| 006 | Region assignment is user-selected, not GPS-derived | docs/adr/006-region-assignment-user-selected.md |
| 007 | Supabase RLS two-key model with server-side ip_hash | docs/adr/007-supabase-rls-two-key-model.md |
| 008 | GitHub Actions cron for Phase 1 only, migrate before Phase 2 | docs/adr/008-github-actions-phase1-only.md |
| 009 | Normalize outage score by available signals, not total weight | docs/adr/009-normalize-by-available-signals.md |

---

## Key Deviations from Original Spec

| Topic | Spec said | We decided | Why |
|-------|-----------|------------|-----|
| Regions | 14 cities | 17 cities (+barcelona, guarenas_guatire, valera) | Coverage gap in highest-risk tier |
| Phase 1 UI | Green/yellow/orange/red map | Grey/blue only + disclaimers | No passive validation = no confidence |
| Validation layers | 7 layers | 3 in Phase 1, 5 in Phase 2, 7 in Phase 4 | Device fingerprint unproven |
| Report flow | 4 taps | 2 taps Phase 1 (region + status only) | Minimize friction until demand proven |
| Scoring | Fixed weighted sum | Normalize by available signals | Crowd-only can't reach >0.30 otherwise |
| Prediction | Heuristic in scorer.py | Null until Phase 4 ML model | Fake prediction worse than none |
| Quorum | Dynamic + diversity multiplier | Fixed 3/2 IPs Phase 1, outage_ratio directly post-quorum | Cold start + double-counting |
| OONI | Phase 2 | Phase 3 | Hours latency, sparse probes, not needed for cross-validation |
| Page weight | 100KB | 250KB (framework floor is 187KB) | Stack is locked |
| Timeline | 2-3 weeks Phase 1 | 3-4 weeks | PWA, rationing patterns, RPC, integration test added |

---

## Documents Modified

- **CONTEXT.md** — 16 new sections added (see file for full state)
- **docs/ARCHITECTURE.md** — schema (3 tables + event_id), scoring formula, scheduler, status.json examples
- **docs/TASKS.md** — Tasks added: T-001B, T-005B, T-016-PRE, T-016B, T-025B. Many tasks updated with refined Done When conditions.
- **CLAUDE.md** — 3 new Never Do entries (device_fingerprint, service_role key)
- **.env.example** — Rewritten with phase-grouped vars

---

## Phase 1 Task Sequence (3-4 weeks)

```
T-001  → Supabase schema (3 tables + RLS + 2 DB functions)
T-001B → pipeline/regions.py (single source of truth for 17 regions)
T-002  → pipeline/validation.py (3 checks only)
T-003  → pipeline/quorum.py (fixed quorum, cold start)
T-004  → pipeline/scorer.py (normalize by available signals)
T-005  → pipeline/main.py skeleton (full JSON skeleton, rationing patterns)
T-005B → tests/test_pipeline_integration.py (end-to-end gate)
T-006  → app/ Next.js scaffold (static export, PWA, lazy Leaflet)
T-007  → Map.tsx (grey/blue only, lazy-loaded)
T-008  → ReportButton.tsx (2 taps, power-back shortcut, RPC feedback)
T-009  → app/lib/api.ts (fetch, submit, auto-refresh from next_update_approx)
T-010  → .github/workflows/collect.yml (cron + concurrency)
```

Critical path: T-001 → T-001B → T-002 → T-003 → T-004 → T-005 → T-005B → T-006 → T-007/T-008/T-009 (parallel) → T-010

---

## Decisions Not Captured in ADRs (implementation details)

These are documented in CONTEXT.md sections but didn't warrant ADRs
(easily reversible or obvious once stated):

- sub_zone null in Phase 1-2, defined by zone_mapper in Phase 3
- state derived server-side, not user input
- duration_min not collected from users
- display_name stays in status.json (not separate file)
- regions.py is single source of truth for region metadata
- Hand-written sw.js, no next-pwa dependency
- Cache-Control: max-age=60, s-maxage=300
- Auto-refresh: 10min Phase 1, 5min Phase 2+, adapts to next_update_approx
- Pipeline exits 1 only on R2 upload failure, 0 on collector failures
- GitHub Actions concurrency: cancel-in-progress: true
- get_recent_count RPC gated by recent INSERT from same IP
- "unlisted" reports count toward RPC but excluded from scoring
- All time logic converts UTC to VET (UTC-4) before comparisons
- localStorage stores last report for power-back shortcut
- Rationing patterns as static seed data in status.json
- Outage lifecycle via event_id UUID linking multi-region events
- Two-stage classifier: simple Phase 2, full Phase 4
- collector_errors field in status.json for pipeline monitoring
- R2 is accepted SPOF in Phase 1, fallback planned for Phase 2

---

## Risks for Implementation

1. **Supabase ip_hash function**: depends on `inet_client_addr()` or request
   headers being available inside a DB function called via REST API.
   Verify this actually works behind Cloudflare proxy during T-001.

2. **Next.js static export + PWA**: service worker with static export
   requires manual registration — not all Next.js PWA guides cover this.
   Test offline behavior on actual Android device with throttled connection.

3. **GitHub Actions cron variance**: first-time users during an outage
   may see stale data. The staleness warning mitigates but doesn't eliminate
   the credibility risk. Consider launching during an active outage when
   you can manually trigger the workflow.

4. **get_recent_count gating**: the RPC needs to hash the caller's IP
   the same way the INSERT trigger does. If hashing differs, the EXISTS
   check will never match. Use the same hash function in both.

---

## Suggested Skills for Next Session

- **/tdd** — for T-002 through T-005B (all pipeline modules need tests first)
- **/diagnose** — if Supabase ip_hash function doesn't work as expected
- **/zoom-out** — at start of any new session to re-orient

---

## Files to Read First in Next Session

1. CLAUDE.md (project rules)
2. CONTEXT.md (all decisions from this session)
3. docs/TASKS.md (current task, Done When conditions)
4. The relevant ADR if working on a task that touches a decided boundary
