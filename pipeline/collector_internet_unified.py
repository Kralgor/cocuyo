"""
Unified internet signal collector — Phase 2.

Combines IODA (BGP) + Cloudflare Radar (HTTP traffic) as primary signals,
with RIPE Atlas + M-Lab as weak corroborating sources. OONI deferred to Phase 3.

classify_internet_situation() produces one of 4 situation types:
  power_outage       — multi-ISP BGP + traffic collapse
  isp_failure        — single ISP drop, others stable
  confirmed_disruption — Cloudflare-flagged outage event
  normal             — all sources clear

apply_corroboration() blends RIPE/M-Lab into the internet_score with a capped
delta. This keeps ADR-009 scorer.py weights (internet 0.35, crowd 0.30,
satellite 0.20, weather 0.15) untouched — corroboration only refines the
internet_score INPUT, not the blend weights.

Also returns internet_score (0-1) for scorer.py weight blend.
"""
import logging
from datetime import datetime, timezone

import requests

from pipeline.collector_cloudflare import (
    VE_ASNS,
    detect_outage_from_timeseries,
    fetch_traffic_anomalies,
    fetch_traffic_timeseries_by_asn,
)
from pipeline.collector_internet import fetch_ioda_signals

logger = logging.getLogger(__name__)

# Maps situation -> 0-1 outage severity for scorer.py
_SITUATION_SCORES: dict[str, float] = {
    "power_outage":         0.95,
    "confirmed_disruption": 0.70,
    "isp_failure":          0.40,
    "censorship":           0.10,  # deferred — OONI Phase 3
    "normal":               0.00,
}


def classify_internet_situation(
    ioda: dict[str, dict],
    cloudflare: dict,
    ooni: dict,
) -> dict:
    """
    Cross-reference IODA + Cloudflare (+ future OONI) to classify situation.

    ooni is empty dict in Phase 2 — censorship case never fires.
    """
    per_asn      = cloudflare.get("per_asn", {})
    total_isps   = len(per_asn)
    isps_dropping = sum(1 for r in per_asn.values() if r.get("detected"))
    ioda_dropping = sum(
        1 for data in ioda.values()
        if data.get("score") is not None and data["score"] < 0.7
    )
    ooni_anomaly_rate = ooni.get("anomaly_rate", 0)

    # Case 1: ≥75% ISPs down on CF + ≥2 BGP-level drops → power outage
    if total_isps > 0 and isps_dropping >= total_isps * 0.75 and ioda_dropping >= 2:
        situation = "power_outage"
        detail = (
            f"{isps_dropping}/{total_isps} ISPs show traffic drops. "
            f"BGP disrupted for {ioda_dropping} ASNs. "
            f"Cross-ISP failure indicates infrastructure (power) cause."
        )
        return {
            "situation":       situation,
            "confidence":      "high",
            "detail":          detail,
            "internet_score":  _SITUATION_SCORES[situation],
        }

    # Case 2: exactly 1 ISP dropping, IODA stable → ISP-specific fault
    if isps_dropping == 1 and ioda_dropping <= 1:
        dropping = [asn for asn, r in per_asn.items() if r.get("detected")]
        affected = VE_ASNS.get(dropping[0], "Unknown") if dropping else "Unknown"
        situation = "isp_failure"
        return {
            "situation":       situation,
            "confidence":      "medium",
            "affected_isp":    affected,
            "detail": (
                "Only one ISP affected. Other providers stable. "
                "Likely ISP equipment or routing issue, not power."
            ),
            "internet_score":  _SITUATION_SCORES[situation],
        }

    # Case 3: OONI anomalies + stable traffic → censorship (Phase 3)
    if ooni_anomaly_rate > 0.3 and isps_dropping == 0:
        situation = "censorship"
        return {
            "situation":       situation,
            "confidence":      "medium",
            "detail": (
                f"OONI anomaly rate {ooni_anomaly_rate:.0%}. "
                f"Traffic volumes normal. Likely content blocking."
            ),
            "internet_score":  _SITUATION_SCORES[situation],
        }

    # Case 4: CF-flagged outage event present
    cf_outages = [
        a for a in cloudflare.get("anomalies", [])
        if a.get("type") == "OUTAGE"
    ]
    if cf_outages:
        situation = "confirmed_disruption"
        return {
            "situation":       situation,
            "confidence":      "high",
            "detail": (
                f"Cloudflare flagged {len(cf_outages)} "
                f"outage anomalies for Venezuela in the last 24h."
            ),
            "anomalies":       cf_outages,
            "internet_score":  _SITUATION_SCORES[situation],
        }

    # Case 5: everything normal
    situation = "normal"
    return {
        "situation":       situation,
        "confidence":      "high",
        "detail":          "All sources show normal connectivity.",
        "internet_score":  _SITUATION_SCORES[situation],
    }


def apply_corroboration(
    base_score: float,
    ripe: dict,
    mlab: dict,
    cap: float = 0.15,
) -> float:
    """
    Refine internet_score using RIPE Atlas + M-Lab corroboration.

    Computes a delta from RIPE per-region probe scores (max across all
    regions, to capture the worst-affected area) scaled into [0, cap].
    M-Lab contributes 0 while stubbed. Delta is added to base_score and
    result is clamped to [0.0, 1.0].

    This keeps ADR-009 scorer.py blend weights untouched — we are only
    refining the internet_score before it enters the scorer, not changing
    the IODA/Cloudflare/satellite/crowd mix.
    """
    # Compute RIPE delta: take the maximum per-region score across VE
    ripe_max: float = 0.0
    for region_data in ripe.values():
        region_score = region_data.get("score", 0.0)
        if isinstance(region_score, (int, float)) and region_score > ripe_max:
            ripe_max = float(region_score)

    # Scale RIPE contribution into [0, cap]: ripe_max is already in [0, 0.6],
    # so we proportionally scale it to the cap.
    ripe_delta = ripe_max * (cap / 0.6) if ripe_max > 0 else 0.0
    ripe_delta = min(ripe_delta, cap)

    # M-Lab contributes 0 while stubbed (returns {})
    mlab_delta: float = 0.0

    total_delta = ripe_delta + mlab_delta
    result = base_score + total_delta
    return max(0.0, min(1.0, result))


def collect_all_internet_signals(
    now: datetime | None = None,
    _ioda_session: requests.Session | None = None,
    _cf_session: requests.Session | None = None,
) -> dict:
    """
    Pull IODA + Cloudflare, classify, apply RIPE/M-Lab corroboration, return unified result.

    internet_score (0-1) ready for scorer.py. OONI skipped (Phase 3).
    Adds "ripe" and "mlab" transparency keys to the returned dict.
    """
    if now is None:
        now = datetime.now(timezone.utc)

    ioda = fetch_ioda_signals(now=now, _session=_ioda_session)

    cloudflare: dict = {
        "anomalies": fetch_traffic_anomalies(_session=_cf_session),
        "per_asn":   {},
    }
    for asn in VE_ASNS:
        ts = fetch_traffic_timeseries_by_asn(asn, _session=_cf_session)
        cloudflare["per_asn"][asn] = detect_outage_from_timeseries(ts)

    ooni: dict = {}  # Phase 3

    classification = classify_internet_situation(ioda, cloudflare, ooni)

    # RIPE Atlas corroboration — lazy import; failure -> empty dict (never aborts)
    try:
        from pipeline.collector_ripe import fetch_ripe_connectivity  # noqa: PLC0415
        ripe = fetch_ripe_connectivity()
    except Exception as exc:
        logger.warning("RIPE corroboration failed: %s", exc)
        ripe = {}

    # M-Lab corroboration — lazy import; documented stub returns {}
    try:
        from pipeline.collector_mlab import fetch_mlab_signals  # noqa: PLC0415
        mlab = fetch_mlab_signals()
    except Exception as exc:
        logger.warning("M-Lab corroboration failed: %s", exc)
        mlab = {}

    # Blend corroboration into internet_score (ADR-009 weights untouched)
    classification["internet_score"] = apply_corroboration(
        classification["internet_score"], ripe, mlab
    )

    return {
        "timestamp":      now.isoformat(),
        "ioda":           ioda,
        "cloudflare":     cloudflare,
        "ooni":           ooni,
        "classification": classification,
        "ripe":           ripe,
        "mlab":           mlab,
    }
