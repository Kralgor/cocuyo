---
created: 2026-06-11T18:14:57Z
title: Parroquia-level reporting (hyperlocal)
area: general
files:
  - pipeline/regions.py
  - pipeline/quorum.py
  - app/lib/api.ts:95 (submitReport payload)
  - mobile/lib/api.ts
  - docs/schema.sql (outage_reports)
  - docs/ARCHITECTURE.md (must update on schema change)
---

## Problem

Reports and status are city-level (17 canonical regions). User wants hyperlocal
granularity down to parroquia (~1,140 nationally), inspired by
radarnacionalven.blogspot.com (crowdsourced, estado→municipio→parroquia→sector,
12h report expiry, pattern forecasts).

Constraints discovered 2026-06-11:
- Passive signals cannot resolve parroquia: IODA/Cloudflare are state/ASN level.
  Only VIIRS satellite can (~450m pixels; h5py extraction implemented 2026-06-11).
- Quorum math assumes city-level user density; parroquia cells will be empty for
  months. Scored parroquia status too early = fake precision = trust damage.
- status.json with 1,140 entries ≈ 600KB — needs per-state split or raw-report
  feed instead of full scored grid.

## Solution

Two-stage rollout:

1. **Report-side (Phase 2 candidate):** reports carry optional `parroquia`
   (cascading picker estado→municipio→parroquia + GPS point-in-polygon against
   geoBoundaries/OSM ADM3 polygons; coordinate used transiently, never stored —
   parroquia name only, privacy-compatible). Zone screen shows raw recent
   hyperlocal reports with 12h expiry ("3 vecinos en Parroquia X reportaron sin
   luz hace 12 min") — explicitly raw reports, NOT scored status.
   Schema change to outage_reports → update docs/ARCHITECTURE.md (project rule).

2. **Scoring-side (deferred until density):** parroquia gets its own scored
   status only when weekly active reporters in that parroquia cross a quorum
   threshold (calibration.py already estimates per-region active users — extend).
   Region score remains the trust anchor; VIIRS can corroborate parroquia-level
   once Phase 3 satellite is proven.
