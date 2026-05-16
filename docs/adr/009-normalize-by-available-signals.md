# ADR-009: Normalize outage score by available signals, not total weight

## Status: Accepted

## Decision
scorer.py computes current_score as:

    current_score = sum(weight_i * signal_i) / sum(weight_i)
    where i ranges over signals that are not None

The four weights (internet 0.35, crowdsource 0.30, satellite 0.20,
weather 0.15) remain constant. The denominator varies based on which
signals are available in a given pipeline run.

A None signal means "absent" — excluded from both numerator and
denominator. It is never treated as zero (which would mean "normal").

If all signals are None: status "no_data", score 0.0.

## Rationale
The original spec hardcodes weights summing to 1.0 and computes a
simple weighted sum. This breaks across phases:

- Phase 1 (crowd only): max score = 0.30 * 1.0 = 0.30 → never reaches
  confirmed_outage (>0.70), even with 100% crowd agreement
- Phase 2 (internet + crowd): max = 0.35 + 0.30 = 0.65 → still can't
  reach confirmed_outage
- Phase 3+: all four signals → max = 1.0, thresholds work as designed

This means a national blackout detected by internet + crowd in Phase 2
can never be called "confirmed" — you'd need VIIRS satellite data which
has 12-hour latency. That's absurd.

Normalizing by available weight fixes this: two signals at 1.0 produce
a score of 1.0 regardless of how many signals are absent. The thresholds
work correctly at every phase.

## Consequences
- Crowd-only (Phase 1) produces full 0-1 score range — but capped
  by "unverified_reports" status per ADR-004
- Two-signal agreement in Phase 2 can reach confirmed_outage
- Adding a new signal in a later phase shifts the denominator — scores
  may change slightly even if existing signals are unchanged
- Weights never change without a recalibration ADR backed by data
- scorer.py logs which signals were available each run for debugging

## Rejected Alternatives
- Phase-aware weights (different weights per phase): more complex,
  requires maintaining multiple weight sets, same result
- Fixed weights with lower thresholds per phase: thresholds are locked
  in CONTEXT.md and well-understood, changing them per phase adds confusion
- Treating None as zero: conflates "no data" with "everything is fine",
  masks real outages when a collector fails
