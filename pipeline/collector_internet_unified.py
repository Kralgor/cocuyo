"""
Unified internet signal collector — Phase 2.

Combines IODA (BGP) + Cloudflare Radar (HTTP traffic).
OONI (censorship detection) deferred to Phase 3.

classify_internet_situation() produces one of 4 situation types:
  power_outage       — multi-ISP BGP + traffic collapse
  isp_failure        — single ISP drop, others stable
  confirmed_disruption — Cloudflare-flagged outage event
  normal             — all sources clear

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


def collect_all_internet_signals(
    now: datetime | None = None,
    _ioda_session: requests.Session | None = None,
    _cf_session: requests.Session | None = None,
) -> dict:
    """
    Pull IODA + Cloudflare, classify, return unified result.

    internet_score (0-1) ready for scorer.py. OONI skipped (Phase 3).
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

    return {
        "timestamp":      now.isoformat(),
        "ioda":           ioda,
        "cloudflare":     cloudflare,
        "ooni":           ooni,
        "classification": classification,
    }
