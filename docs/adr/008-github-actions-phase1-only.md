# ADR-008: GitHub Actions cron for Phase 1 only, migrate before Phase 2

## Status: Accepted

## Decision
Phase 1 uses GitHub Actions cron (*/10 * * * *) as the pipeline scheduler.
Accept 10-40 minute variance and silently dropped runs. Migrate to a
reliable scheduler (<2min variance) as a prerequisite before Phase 2
passive signals go live.

The frontend displays staleness honestly:
- "Last updated X minutes ago" shown prominently
- Warning shown when updated_at > 45 minutes old
- status.json includes updated_at, next_update_approx, and scheduler fields

The pipeline must be idempotent — safe to run multiple times or skip
runs without corrupting state.

## Rationale
GitHub Actions cron has well-documented reliability problems:
- Minimum granularity is 5 minutes but execution is best-effort
- Delays of 10-60 minutes common during peak hours (top of every hour)
- Runs silently dropped when runner queue is full, no retry, no notification

For Phase 1 (data-collection mode, "unverified_reports" status, crowd
data only), this is acceptable. Users see report counts and disclaimers,
not real-time outage scores. The value proposition is "others are reporting
too" — a 30-minute delay on crowd aggregation doesn't destroy that.

For Phase 2 (passive signals, confident outage detection, color-coded map),
freshness becomes critical. A 40-minute delay between a national blackout
and status.json updating would be a credibility-destroying experience.
Users checking during an outage on mobile data who see stale green data
will not come back.

## Consequences
- Phase 1 pipeline tolerates missed/delayed runs gracefully
- No retry logic needed in Phase 1 — idempotent runs handle it
- Frontend always shows data age, warns on staleness >45min
- T-016-PRE added to TASKS.md: scheduler migration before Phase 2
- Scheduler choice (VPS vs Cloudflare Worker) deferred to Phase 2 start
  when cost/complexity tradeoffs are clearer
- status.json gains three metadata fields: updated_at, next_update_approx,
  scheduler

## Rejected Alternatives
- VPS from day one: adds $5/mo cost and Docker ops complexity before
  validating demand. Premature for Phase 1.
- Cloudflare Worker from day one: good option but adds deployment
  complexity. Save for Phase 2 when it's actually needed.
- Shorter cron interval (*/5): doesn't fix the variance problem, just
  burns more Actions minutes on a public repo
- Accepting GitHub Actions permanently: unacceptable for Phase 2+ where
  freshness matters to credibility
