# ADR-005: Device fingerprint deferred from validation until Phase 4

## Status: Accepted

## Decision
device_fingerprint is collected and stored in outage_reports from day one,
but is not used in any validation, rate limiting, or trust scoring logic
until Phase 4. ip_hash is the sole rate-limiting identifier in Phase 1-2.

The validation pipeline runs 5 layers in Phase 1-2:
1. IP rate limit
2. Geolocation consistency
3. Contradiction detection
4. Dynamic quorum
5. Cross-validation against passive signals (Phase 2+)

Device fingerprint rate limiting and device trust scoring are Phase 4
features, contingent on a stability analysis of fingerprint persistence
across the Venezuelan user base.

## Rationale
Browser fingerprints (user-agent + screen + timezone hash) are both
brittle and weak:

**Brittle:** A Chrome update changes user-agent. Screen rotation changes
dimensions. A 90-day trusted veteran becomes an unknown device overnight.
Device trust scoring requires stable identity — fingerprints don't provide it.

**Weak:** Anyone with DevTools can change user-agent. The hash prevents
server-side inspection. The most sophisticated anti-abuse mechanism
(device trust) sits on a foundation that attackers bypass trivially.

**Venezuela-specific:** CANTV assigns dynamic IPs, many users are behind
carrier-grade NAT. ip_hash is also imperfect, but it catches the easy
spam cases. The hard cases (coordinated real users) are caught by
cross-validation with passive signals in Phase 2 — not by rate limiting.

Collecting the fingerprint from day one lets us answer the key question
before building on it: do fingerprints actually survive browser updates
across Venezuelan CANTV users?

## Consequences
- validation.py implements 3 checks, not 4 (_check_device_rate is stubbed)
- Device trust scoring (spec Section 13) is Phase 4 scope
- ip_hash is the only rate-limiting key — less effective behind NAT
- Cross-validation with passive signals is the real safety net
- Phase 4 must analyze fingerprint stability before enabling device trust
- CLAUDE.md Never Do list prohibits using device_fingerprint in validation
  until Phase 4 analysis is complete

## Rejected Alternatives
- Implementing device fingerprint checks from day one: builds on unproven
  assumption that fingerprints are stable in this user base
- Not collecting fingerprint at all: loses the ability to retroactively
  analyze stability and bootstrap trust scores in Phase 4
- Using localStorage token: more stable but requires consent UX,
  doesn't survive incognito/clear-data, adds complexity to Phase 1 MVP
