# Skill Observation Log

Observations captured during task-oriented work. Each entry identifies a
potential skill improvement or new skill opportunity.

**Status key:** OPEN = not yet actioned | ACTIONED = skill updated/created |
DECLINED = user decided not to pursue

---

## 2026-06-13

### Observation 1: GSD phase passed automated verification while a blocking external-credential prerequisite was unmet

**Date:** 2026-06-13
**Session context:** Cocuyo Phase 3 (push notifications) was executed by GSD and marked "implementation complete, automated checks passed, human UAT pending." First on-device UAT immediately failed: "Unable to get Firebase Messaging instance... Default FirebaseApp is not initialized." Root cause: the Firebase/FCM provisioning step (create Firebase project, add `google-services.json`, set `android.googleServicesFile`, upload FCM V1 service account to EAS) was never done — it is an external-console action no automated check exercised.
**Skill:** gsd-execute-phase / gsd-verify-work (GSD workflow skills)
**Type:** internal
**Phase/Area:** Verification / readiness gating for phases with external-service dependencies

**Issue:** The push-notification feature was structurally non-functional (no FCM credentials in the build) yet passed every automated gate and was recorded as execution-complete. The verification artifact flagged "human UAT pending" but did not surface the specific unmet external prerequisite as a hard blocker. The gap is only visible on a physical device.

**Suggested improvement:** When a phase depends on an external-service credential/console setup (Firebase, APNs, app-store, OAuth client, etc.), GSD verification should enumerate those as explicit, named "human prerequisite" gates with a binary done/not-done check, separate from generic "human UAT pending." A phase whose core feature cannot initialize without an un-automatable external step should not read as "implementation complete" without that step called out as outstanding.

**Principle:** Automated verification proves code-path correctness, not deployability. Phases gated on external credentials need those credentials tracked as first-class blocking prerequisites, or "complete" overstates readiness and UAT predictably fails on the first device run.

### Observation 2: phase-plan-index query returned wrong wave/dependency data; plan-file frontmatter was authoritative

**Date:** 2026-06-19
**Session context:** gsd-execute-phase 4 (Cocuyo food-spoilage-timers), 4-plan phase
**Skill:** gsd-execute-phase
**Type:** internal
**Phase/Area:** discover_and_group_plans / wave grouping

**Issue:** `gsd-sdk query phase-plan-index 04` reported all 4 plans in Wave 1 with `depends_on: []` and empty `files_modified` for every plan. The actual PLAN.md frontmatter showed a strictly linear chain: 04-01 (w1, no deps) -> 04-02 (w2, deps 04-01) -> 04-03 (w3, deps 04-01,02) -> 04-04 (w4, deps 04-01,02,03), with shared files (food.ts in 01+02, food.tsx in 03+04). Trusting the index would have dispatched 4 parallel worktree agents off one base commit, breaking the chain (04-02 needs 04-01's committed food.ts) and colliding on shared files. The workflow's intra-wave files_modified overlap safety check was also blind because the index reported empty files_modified.

**Suggested improvement:** In discover_and_group_plans, do not trust phase-plan-index wave/depends_on/files_modified values without cross-checking the PLAN.md frontmatter when the index reports suspicious uniformity (all plans same wave AND all deps empty AND all files_modified empty). Add a validation step: if index shows >1 plan all in one wave with no declared deps/files, re-read plan frontmatter directly and reconcile. Treat plan-file frontmatter as source of truth on conflict.

**Principle:** A derived index is a cache, not the source of truth. When an orchestrator's safety checks (parallel-execution gating, file-overlap detection) depend entirely on derived metadata, a stale/buggy derivation silently disables those safeguards. Cross-check derived data against primary artifacts before making irreversible parallel-dispatch decisions.
