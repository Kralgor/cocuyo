"""
Cloudflare Radar traffic collector.

Pulls per-ASN HTTP traffic timeseries and anomaly events for Venezuela.
Detects >60% traffic drops vs rolling baseline — correlates with outages.

Used by collector_internet_unified.py. Never called directly by main.py.
"""
import logging
import os

import requests

logger = logging.getLogger(__name__)

CF_API    = "https://api.cloudflare.com/client/v4/radar"
TIMEOUT_S = 15

# Venezuelan ASNs — plain numbers (no "AS" prefix, unlike IODA)
VE_ASNS: dict[str, str] = {
    "8048":   "CANTV",
    "21826":  "Inter",
    "264731": "Movistar VE",
    "22313":  "Digitel",
}


def _headers() -> dict[str, str]:
    token = os.environ.get("CF_API_TOKEN", "")
    return {"Authorization": f"Bearer {token}"}


def fetch_traffic_anomalies(
    _session: requests.Session | None = None,
) -> list[dict]:
    """
    Return Cloudflare-flagged traffic anomaly events for VE (last 24h).
    Empty list on error.
    """
    session = _session or requests.Session()
    try:
        resp = session.get(
            f"{CF_API}/traffic_anomalies",
            params={"location": "VE", "dateRange": "1d", "limit": 50},
            headers=_headers(),
            timeout=TIMEOUT_S,
        )
        resp.raise_for_status()
        anomalies = resp.json().get("result", {}).get("trafficAnomalies", [])
        return [
            {
                "type":                  a.get("type"),
                "asn":                   a.get("asnDetails", {}).get("asn"),
                "asn_name":              a.get("asnDetails", {}).get("name"),
                "start":                 a.get("startDate"),
                "end":                   a.get("endDate"),
                "location":              a.get("locationDetails", {}).get("code"),
                "visible_in_data_sources": a.get("visibleInDataSources", []),
            }
            for a in anomalies
        ]
    except Exception as exc:
        logger.warning("CF traffic_anomalies: %s", exc)
        return []


def fetch_traffic_timeseries_by_asn(
    asn: str,
    date_range: str = "1d",
    _session: requests.Session | None = None,
) -> dict:
    """
    Return normalized HTTP traffic timeseries for one ASN.
    Values are relative request counts (not raw). Drop -> users offline.

    Returns {"asn", "provider", "timestamps", "values"}.
    On error: timestamps=[], values=[], "error" key added.
    """
    session = _session or requests.Session()
    try:
        resp = session.get(
            f"{CF_API}/http/timeseries",
            params={"asn": asn, "dateRange": date_range, "aggInterval": "15m"},
            headers=_headers(),
            timeout=TIMEOUT_S,
        )
        resp.raise_for_status()
        series = resp.json().get("result", {}).get("httpRequests", {})
        return {
            "asn":        asn,
            "provider":   VE_ASNS.get(asn, "Unknown"),
            "timestamps": series.get("timestamps", []),
            "values":     series.get("values", []),
        }
    except Exception as exc:
        logger.warning("CF timeseries ASN %s: %s", asn, exc)
        return {
            "asn":        asn,
            "provider":   VE_ASNS.get(asn, "Unknown"),
            "timestamps": [],
            "values":     [],
            "error":      str(exc),
        }


def detect_outage_from_timeseries(timeseries: dict) -> dict:
    """
    Detect >60% traffic drop vs rolling baseline.

    Uses first 75% of values as baseline, checks last 25%.
    Drop threshold: value < baseline_avg * 0.4.

    Returns {"detected": bool, ...detail keys on True...}.
    """
    values     = timeseries.get("values", [])
    timestamps = timeseries.get("timestamps", [])

    if len(values) < 8:
        return {"detected": False, "reason": "insufficient_data"}

    baseline_end    = int(len(values) * 0.75)
    baseline_values = [v for v in values[:baseline_end] if v is not None]

    if not baseline_values:
        return {"detected": False, "reason": "no_baseline"}

    baseline_avg = sum(baseline_values) / len(baseline_values)

    if baseline_avg == 0:
        return {"detected": False, "reason": "zero_baseline"}

    recent_values     = values[baseline_end:]
    recent_timestamps = timestamps[baseline_end:] if timestamps else [None] * len(recent_values)

    drops = [
        {
            "timestamp": recent_timestamps[i] if i < len(recent_timestamps) else None,
            "value":     val,
            "ratio":     round(val / baseline_avg, 3),
        }
        for i, val in enumerate(recent_values)
        if val is not None and val < baseline_avg * 0.4
    ]

    if drops:
        return {
            "detected":       True,
            "provider":       timeseries.get("provider"),
            "drop_count":     len(drops),
            "worst_ratio":    min(d["ratio"] for d in drops),
            "first_drop_at":  drops[0]["timestamp"],
            "drops":          drops,
        }

    return {"detected": False}
