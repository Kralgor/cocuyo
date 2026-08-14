# Phase 3: Push Notifications - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-13
**Phase:** 3-Push Notifications
**Areas discussed:** Zone subscription model, Notification opt-in & permission, Neighboring-zone early warning, Anti-spam / flapping control

---

## Zone Subscription Model

| Option | Description | Selected |
|--------|-------------|----------|
| Saved zone, auto-subscribed | Auto-subscribe selected zone; neighbor warnings derived automatically | |
| Saved zone + explicit toggle | Auto-subscribe saved zone; per-type on/off toggles on notify tab | ✓ |
| Pick zones to follow | Explicit multi-zone subscribe list (pulls ADVN-02 forward) | |

**User's choice:** Saved zone + explicit toggle
**Notes:** One active zone subscription per device; subscription follows the saved zone when changed. Multi-zone (ADVN-02) stays v2.

---

## Notification Opt-In & Permission

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated notify-tab prompt | Explainer (why/what's stored/anonymous) before OS dialog; point-of-use | ✓ |
| Prompt after first status view | Soft in-app prompt once user has seen their zone status | |
| Prompt on first outage detected | Only ask when something happens in their zone | |

**User's choice:** Dedicated notify-tab prompt
**Notes:** Carries forward Phase 2 trust pattern — permission never requested during onboarding. Token registration is anon-key only, no device_fingerprint (ADR-005/007).

---

## Neighboring-Zone Early Warning (NOTF-04)

| Option | Description | Selected |
|--------|-------------|----------|
| Hand-curated adjacency map | User-defined neighbors per zone, geography/grid-aware | ✓ |
| Same-state grouping | Same-state zones are neighbors; coarse but free | |
| Defer neighbor warnings | Ship out/restored only; move NOTF-04 to follow-up | |

**User's choice:** Hand-curated adjacency map (built collaboratively)
**Notes:** User asked for help building the map ("I know Venezuela but not all the country"). Claude proposed a symmetric 17-zone adjacency map (geography + national grid); user reviewed the four questionable calls (maracaibo↔valera, guarenas_guatire↔barcelona, porlamar island link, ciudad_guayana↔maturin) and approved the proposed map as-is. Final map locked in CONTEXT.md D-07.

---

## Anti-Spam / Flapping Control

| Option | Description | Selected |
|--------|-------------|----------|
| Cooldown + confirmed transitions | Per-zone/per-event cooldown AND only confirmed/stable transitions; suppress on unstable | ✓ |
| Cooldown only | Simple cooldown; notify on any transition | |
| Notify every transition | No throttle; fire on each change | |

**User's choice:** Cooldown + confirmed transitions
**Notes:** Build on existing outage_lifecycle.py / restoration_tracker.py rather than raw cycle diffs. Suppress during `unstable` (bajones). Cooldown window length is Claude's discretion (~2-3h candidate).

---

## Claude's Discretion

- Exact cooldown window length (N hours) and quiet-hours policy.
- Final Spanish copy per event type (out / restored / neighbor).
- `push_tokens` column shape, RLS policy, stale-token cleanup mechanism.
- Android notification channels / iOS categories config.
- Single-source approach for the adjacency map across pipeline + app without breaking the no-shared-code boundary.

## Deferred Ideas

- Multi-zone follow list (ADVN-02) — v2.
- Quiet-hours / DND scheduling — decide scope in planning.
- Food spoilage notifications (NOTF-03) — Phase 4.
- Parroquia-level reporting todo — reviewed, not folded (reporting scope, not push).
