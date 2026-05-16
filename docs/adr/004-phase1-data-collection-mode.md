# ADR-004: Phase 1 operates in data-collection mode, not detection mode

## Status: Accepted

## Decision
Phase 1 (crowdsource-only) does not claim to detect outages. It collects
reports and displays them with an "unverified" label. Confident outage
detection (green/yellow/orange/red) begins in Phase 2 when passive signals
enable cross-validation.

Specific rules:
- Quorum fixed at 3 reports + 2 unique IPs for all regions
- ESTIMATED_ACTIVE_USERS starts as empty dict, populated by calibration.py
  only after real analytics exist (Phase 4)
- scorer.py returns "unverified_reports" when quorum is met but no passive
  signals exist to cross-validate
- Map shows grey (no reports) or blue (unverified reports) — not the
  green/yellow/orange/red scale
- UI shows raw report count with disclaimer: "Unverified — not enough
  data to confirm"

## Rationale
Day-one user counts are zero. The hardcoded ESTIMATED_ACTIVE_USERS numbers
(500 for Caracas, 15 for Porlamar) are aspirational fiction. Using them
produces quorum thresholds that are either too high (quorum never triggers,
map stays blank) or too low (trivially gameable).

Without passive signals to cross-validate, there is no safety net against
false reports. Presenting unverified crowd data as confirmed outage status
would destroy credibility on the first coordinated troll attack.

Phase 1's job is: validate demand, collect ground truth, build user base.
Not: be a reliable outage detector.

## Consequences
- Phase 1 UI is explicitly a "report collector" not an "outage dashboard"
- The green/yellow/orange/red color scale is a Phase 2 feature
- Users in Phase 1 see report counts and disclaimers
- First-impression risk: users may find Phase 1 underwhelming
- Mitigated by: being honest about what the data means builds trust faster
  than false confidence

## Rejected Alternatives
- Using aspirational user counts from day one: produces broken quorum thresholds
- Showing confident outage scores without cross-validation: credibility risk
- Waiting for Phase 2 to launch: delays demand validation and data collection
