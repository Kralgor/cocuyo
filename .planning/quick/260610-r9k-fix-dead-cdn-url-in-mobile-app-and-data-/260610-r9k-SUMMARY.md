---
phase: quick-260610-r9k
plan: "01"
subsystem: mobile, pipeline, ci, web
tags: [bug-fix, data-honesty, cdn, ci-automation]
dependency_graph:
  requires: []
  provides: [live-cdn-url, honest-cadence, honest-bajones-ui, ci-history-backfill]
  affects: [mobile/lib/api.ts, mobile/app.json, pipeline/main.py, app/components/mobile/ScreenBajones.tsx, app/lib/history.ts, .github/workflows/collect.yml]
tech_stack:
  added: []
  patterns: [configurable-env-base-url, tdd-red-green, conservative-bound-constant]
key_files:
  created: []
  modified:
    - mobile/app.json
    - mobile/lib/api.ts
    - .env.example
    - pipeline/main.py
    - tests/test_pipeline_integration.py
    - app/components/mobile/ScreenBajones.tsx
    - app/lib/i18n.ts
    - app/lib/history.ts
    - .github/workflows/collect.yml
decisions:
  - "Use 120-min conservative bound for next_update_approx (single ISO timestamp, not a range) to keep the StatusJson contract intact"
  - "Replace all three synthetic-data blocks in ScreenBajones with a single pending block — zero fabricated measurements"
  - "Attach history backfill to the existing Sunday retrain job rather than adding a new cron schedule (avoids more throttled schedules)"
  - "Relative /history/ fallback in history.ts preserved — existing static deploy works with no env var change"
metrics:
  duration: "~15 min"
  completed_date: "2026-06-10"
  tasks_completed: 4
  files_changed: 9
---

# Quick Task 260610-r9k: Fix Dead CDN URL + Data Honesty Pass Summary

**One-liner:** Replace dead `cdn.cocuyo.app` with live `cocuyo.kralgor.com`, set honest 120-min `next_update_approx` bound, drop synthetic Bajones data, and add weekly CI history backfill to R2.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Replace dead CDN URL | b11a2ac | mobile/app.json, mobile/lib/api.ts, .env.example |
| 2 (RED) | Add failing cadence bound test | 10dfb5b | tests/test_pipeline_integration.py |
| 2 (GREEN) | Honest next_update_approx constant | 3dc966f | pipeline/main.py |
| 3 | Honest Bajones screen | 9707ef3 | app/components/mobile/ScreenBajones.tsx, app/lib/i18n.ts |
| 4 | Weekly history backfill CI + configurable fetch base | df79233 | .github/workflows/collect.yml, app/lib/history.ts, .env.example |

## Task Details

### Task 1 — Dead CDN URL

Three files updated from `cdn.cocuyo.app` (no DNS) to `cocuyo.kralgor.com` (200, fresh):
- `mobile/app.json` `extra.statusCdnUrl`
- `mobile/lib/api.ts` fallback constant + comment
- `.env.example` `NEXT_PUBLIC_STATUS_URL`

**Follow-up required (not run this session):** `mobile/app.json` `extra` is baked at EAS build time. This fix reaches devices only after the next EAS Build or EAS Update. No build/deploy executed per CLAUDE.md.

### Task 2 — Honest next_update_approx (TDD)

`_UPDATE_INTERVAL_MIN` changed from 10 to 120 with explanatory comment:
> "GitHub throttles */10 cron to ~2h; advertise a conservative bound so next_update_approx never over-promises"

New test `TestCadenceBound.test_next_update_approx_conservative_bound` asserts delta is 110–130 min. All 24 integration tests green.

### Task 3 — Honest Bajones Screen

Removed `BAJONES_24H`, `BajonSeed`, `toTraceEvents`, `FrequencyTrace`, `MiniStat`, `BajonEvent` imports and all usage. The three synthetic-data blocks (frequency trace, event list, summary stats) replaced by one honest pending block:
- Spanish-primary via two new i18n keys: `bajones_pending_title`, `bajones_pending_body`
- Reuses existing `t.panel`, `t.line`, `t.ink`, `t.inkFaint`, `var(--font-serif)`, `var(--font-mono)` tokens
- `demoData.ts` not deleted (other teaser screens may use it)
- TypeScript strict mode clean

### Task 4 — History Backfill CI + Configurable Base

**CI** (`retrain` job, Sunday 00:00 UTC):
- `CF_API_TOKEN` added to env (backfill uses it optionally for Cloudflare cross-correlation)
- New step: `python pipeline/backfill_history.py --days 365`
- New step: boto3 upload of all `app/public/history/*.json` to R2 bucket `cocuyo` under `history/` prefix with `ContentType: application/json`

**Web** (`app/lib/history.ts`):
- `_historyUrl()` helper reads `NEXT_PUBLIC_HISTORY_BASE`; strips trailing slash; falls back to `/history/${regionKey}.json`
- Existing cache and null-on-error behavior unchanged

**`.env.example`**: `NEXT_PUBLIC_HISTORY_BASE=` documented with live example value.

## Deviations from Plan

None — plan executed exactly as written. TDD gates followed for Task 2 (RED commit → GREEN commit).

## TDD Gate Compliance

Task 2 followed RED/GREEN sequence:
1. `test(quick-260610-r9k):` commit 10dfb5b — RED gate (failing test)
2. `fix(quick-260610-r9k):` commit 3dc966f — GREEN gate (implementation)

## Self-Check: PASSED

Files exist:
- mobile/app.json — FOUND, contains cocuyo.kralgor.com
- mobile/lib/api.ts — FOUND, contains cocuyo.kralgor.com
- .env.example — FOUND, contains NEXT_PUBLIC_HISTORY_BASE
- pipeline/main.py — FOUND, _UPDATE_INTERVAL_MIN = 120
- tests/test_pipeline_integration.py — FOUND, TestCadenceBound present
- app/components/mobile/ScreenBajones.tsx — FOUND, no BAJONES_24H
- app/lib/i18n.ts — FOUND, bajones_pending_title present
- app/lib/history.ts — FOUND, NEXT_PUBLIC_HISTORY_BASE present
- .github/workflows/collect.yml — FOUND, backfill_history.py + history/ upload present

Commits verified in git log: b11a2ac, 10dfb5b, 3dc966f, 9707ef3, df79233
