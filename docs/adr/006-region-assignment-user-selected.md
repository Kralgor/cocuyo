# ADR-006: Region assignment is user-selected, not GPS-derived

## Status: Accepted

## Decision
Users select their region from a list of 14 canonical cities. GPS is
requested after selection and stored as lat/lon for future zone mapping
analysis. GPS never overrides or validates the user's region choice.

A 15th option — "My city isn't listed" — captures freetext city name
and GPS. These reports are stored with region: "unlisted" and excluded
from scoring until Phase 5 expansion review.

No reverse geocoding service is used, ever.

## The 14 Canonical Regions (locked)
caracas, maracaibo, valencia, barquisimeto, maracay, ciudad_guayana,
san_cristobal, merida, barinas, maturin, cumana, punto_fijo,
los_teques, porlamar

## Rationale
Three region-assignment flows were considered:

**Flow A — Manual selection (chosen):** User picks from list. Simple,
no external dependency. Risk: user in Cabimas selects "Maracaibo"
because it's the closest option. Acceptable in Phase 1 where the
14-region granularity is already coarse.

**Flow B — GPS auto-detect:** Requires reverse geocoding service (new
dependency), location permission (many users decline), and a coordinate-
to-region mapping table. GPS coordinates between the 14 cities have no
valid mapping. Adds complexity without proportional benefit in Phase 1.

**Flow C — Hybrid:** Doubles implementation surface for Phase 1 MVP.

GPS data is still collected for zone_mapper.py (Phase 3, T-019), which
clusters GPS points to discover feeder circuit boundaries organically.
Storing GPS from day one means zone mapping has a head start when it
ships.

## Consequences
- No reverse geocoding dependency in the entire stack
- Users outside 14 cities can still report via "unlisted" flow
- _check_geo_consistency validates bounding box only (is this in
  Venezuela?) — does not check GPS vs claimed region
- GPS absence is a mild weight penalty (0.7), not rejection
- Cabimas/Cabimas-like cases are mixed into nearest city bucket —
  acceptable at 14-region granularity, resolved by zone mapper later
- Expansion trigger: when "unlisted" reports cluster around a GPS
  centroid with >50 reports, flag for manual review to add region 15+
  (Phase 5 scope)

## Rejected Alternatives
- GPS-first with manual fallback: adds reverse geocoding dependency
- GPS-only: excludes users who deny location permission
- Freetext region entry: normalization nightmare ("Mcbo", "mcaibo",
  "Maracaibo", "maracaibo")
