"""
IODA internet connectivity collector.

Pulls BGP visibility and active probing scores from Georgia Tech's IODA
API for 4 Venezuelan ASNs. Score 0-1: near 1.0 = normal, below 0.7 = trouble.

Used by collector_internet_unified.py to combine with Cloudflare Radar.
Never called directly by main.py — unified collector aggregates first.
"""
import logging
from datetime import datetime, timezone

import requests

logger = logging.getLogger(__name__)

IODA_API = "https://api.ioda.inetintel.cc.gatech.edu/v2"
TIMEOUT_S = 15

# Venezuelan ASNs — CANTV is state telecom and largest provider
ASNS: dict[str, str] = {
    "AS8048":   "CANTV",
    "AS21826":  "Inter",
    "AS264731": "Movistar VE",
    "AS22313":  "Digitel",
}


def fetch_ioda_signals(
    now: datetime | None = None,
    _session: requests.Session | None = None,
) -> dict[str, dict]:
    """
    Return per-ASN IODA signal dict keyed by ASN string.

    Each entry: {"provider": str, "score": float | None, "timestamp": int}
    On error:   {"provider": str, "score": None, "error": str}
    """
    if now is None:
        now = datetime.now(timezone.utc)
    ts = int(now.timestamp())
    one_hour_ago = ts - 3600

    session = _session or requests.Session()
    results: dict[str, dict] = {}

    for asn, name in ASNS.items():
        asn_number = asn.replace("AS", "")
        url = (
            f"{IODA_API}/signals/raw/asn/{asn_number}"
            f"?from={one_hour_ago}&until={ts}"
        )
        try:
            resp = session.get(url, timeout=TIMEOUT_S)
            resp.raise_for_status()
            results[asn] = {
                "provider":  name,
                "score":     extract_latest_score(resp.json()),
                "timestamp": ts,
            }
        except Exception as exc:
            logger.warning("IODA %s: %s", asn, exc)
            results[asn] = {
                "provider": name,
                "score":    None,
                "error":    str(exc),
            }

    return results


def extract_latest_score(data: dict) -> float | None:
    """Return last non-null value from IODA data array, rounded to 3 dp."""
    try:
        series = data.get("data", [])
        if not series:
            return None
        values = series[0].get("values", [])
        for v in reversed(values):
            if v is not None:
                return round(float(v), 3)
    except (AttributeError, KeyError, IndexError, TypeError, ValueError):
        pass
    return None
