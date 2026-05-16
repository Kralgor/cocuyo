# ADR-003: Internet signal is national, not per-region, in Phase 1-2

## Status: Accepted

## Decision
inet_score is a single national value applied identically to all 14 regions
in Phase 1-2. It is computed as 1 minus the lowest normalized ASN score
among all 4 Venezuelan ISPs (CANTV, Inter, Movistar VE, Digitel).

Regional differentiation comes from crowd data (Phase 1) and satellite
pixels (Phase 3). Internet data becomes region-aware in Phase 4 when
historical patterns can weight regions by grid priority tier.

## Rationale
IODA and Cloudflare Radar operate per-ASN, not per-city. They can detect
"CANTV is down nationally" but cannot distinguish "Maracaibo is down but
Valencia is fine." Pretending the internet signal is per-region would give
false precision — all 14 regions would move in lockstep anyway.

Admitting the limitation explicitly keeps scorer.py honest and avoids
debugging phantom regional differences that are actually just noise.

## Consequences
- All 14 regions receive the same inet_score in Phase 1-2
- scorer.py must document this as a comment at the inet_score computation
- Regional outage detection before Phase 3 relies entirely on crowd reports
- Phase 4 can introduce region weighting using the grid priority hierarchy
  (western states cut first → higher prior probability given national drop)

## Rejected Alternatives
- Treating per-ASN data as per-region: false precision, same underlying signal
- Skipping internet signal entirely until regional: loses the strongest
  early signal for national/transmission events
