---
phase: 03-push-notifications
plan: 03
subsystem: database
tags: [supabase, rls, push-tokens, adjacency-map, architecture]
requires: []
provides:
  - push_tokens and notification_log schema
  - Canonical pipeline ADJACENCY_MAP
  - Push fan-out architecture documentation
affects: [docs, pipeline, notifications]
tech-stack:
  added: []
  patterns: [ADR-007 two-key RLS, service-role fan-out, symmetric adjacency]
key-files:
  created: []
  modified:
    - docs/schema.sql
    - pipeline/regions.py
    - docs/ARCHITECTURE.md
key-decisions:
  - Kept push token rows anonymous and excluded device_fingerprint from the push_tokens schema.
  - Made pipeline/regions.py the canonical adjacency source; mobile mirrors it without cross-boundary imports.
patterns-established:
  - Notification fan-out reads push_tokens and writes notification_log only from the pipeline service_role boundary.
requirements-completed: [INFR-02, NOTF-04]
duration: 30min
completed: 2026-06-13
---

# Phase 03 Plan 03: Push Schema and Adjacency Summary

Push subscription schema, service-role notification log, canonical neighbor adjacency, and architecture docs for pipeline-side fan-out.

## Tasks

- Added `push_tokens` and `notification_log` DDL, RLS, indexes, and grants to `docs/schema.sql`.
- Added a symmetric 17-zone `ADJACENCY_MAP` to `pipeline/regions.py`.
- Documented Phase 3 push fan-out, `push_tokens`, `notification_log`, `pipeline/notify.py`, and the ADR-007 two-key boundary in `docs/ARCHITECTURE.md`.

## Verification

- `python3 -c "from pipeline.regions import REGIONS, ADJACENCY_MAP; ..."` passed with `OK symmetric 17`.
- Grep checks confirmed `push_tokens`, `notification_log`, `event_type` check, `ADJACENCY_MAP`, and architecture references exist.

## Issues Encountered

- The plan's literal schema grep `! grep -q device_fingerprint docs/schema.sql` conflicts with existing Phase 1/2 `outage_reports.device_fingerprint` required by ADR-005. The implemented push token schema itself has no `device_fingerprint` column.

## Deviations from Plan

- Did not remove pre-existing `device_fingerprint` fields from `outage_reports`; they are prior-phase schema, not Phase 3 push-token fields.

## User Setup Required

None.

## Next Phase

Ready for plan 05 to import `ADJACENCY_MAP` and use the new tables after the FCM checkpoint is complete.
