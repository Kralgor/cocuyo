"""
RIPE Atlas probe-connectivity collector.

Queries the RIPE Atlas API for Venezuelan probes and computes a
per-region disconnected-probe ratio as a weak corroborating internet signal.
This collector is SUPPLEMENTARY — it only adds a small corroboration delta
to the existing IODA/Cloudflare internet_score (approved decision #4).

Returns {} on any error — never raises. Stateless.
"""
import logging
import math
from typing import Optional

import requests

from pipeline.regions import REGIONS

logger = logging.getLogger(__name__)

RIPE_API  = "https://atlas.ripe.net/api/v2"
TIMEOUT_S = 15

# Max score this collector can contribute — keeps it a WEAK corroboration.
# Never intended to replace IODA or Cloudflare signals.
_MAX_SCORE = 0.6

# Probe status IDs from RIPE Atlas API.
_STATUS_CONNECTED    = 1
_STATUS_DISCONNECTED = 2


# ── pure helpers ──────────────────────────────────────────────────────────────

def nearest_region(
    lat: float,
    lon: float,
    threshold: float = 0.5,
) -> Optional[str]:
    """
    Map a probe lat/lon to the nearest canonical REGIONS key.

    Uses simple Euclidean degree distance (acceptable for ~15 km granularity
    over Venezuela's extent). Returns None when no region is within threshold.
    """
    best_key: Optional[str] = None
    best_dist: float = float("inf")

    for key, meta in REGIONS.items():
        dlat = lat - meta["lat"]
        dlon = lon - meta["lon"]
        dist = math.sqrt(dlat * dlat + dlon * dlon)
        if dist < best_dist:
            best_dist = dist
            best_key = key

    if best_dist <= threshold:
        return best_key
    return None


def score_region_probes(disconnected: int, total: int) -> float:
    """
    Convert a disconnected/total probe count to a weak corroboration score.

    Returns 0.0 when total < 2 (insufficient sample). Otherwise scales
    the disconnected/total ratio into [0, _MAX_SCORE] as a weak signal.
    A low disconnect ratio (< 0.1) maps to 0 — noise floor. Values ramp
    from 0.1 to 1.0 disconnection rate toward _MAX_SCORE ceiling.

    Cap note: _MAX_SCORE = 0.6 keeps this a supplementary corroboration,
    not a primary decision signal.
    """
    if total < 2:
        return 0.0
    ratio = disconnected / total
    if ratio < 0.1:
        return 0.0
    # Linear ramp: ratio 0.1 -> 0, ratio 1.0 -> _MAX_SCORE
    ramp = (ratio - 0.1) / 0.9
    return round(min(ramp * _MAX_SCORE, _MAX_SCORE), 4)


# ── collector ─────────────────────────────────────────────────────────────────

def fetch_ripe_connectivity(
    _session: Optional[requests.Session] = None,
) -> dict:
    """
    Query RIPE Atlas for Venezuelan probes and compute per-region status.

    Returns {region_key: {"disconnected_ratio": float, "probe_count": int,
                          "score": float}} or {} on any error.

    Handles single-page result — VE typically has < 20 probes total.
    Uses probe `status.id` (1=connected, 2=disconnected) and lat/lon
    from `geometry.coordinates`.
    """
    session = _session or requests.Session()
    try:
        resp = session.get(
            f"{RIPE_API}/probes/",
            params={
                "country_code": "VE",
                "page_size":    100,
                "format":       "json",
            },
            timeout=TIMEOUT_S,
        )
        resp.raise_for_status()
        data = resp.json()
    except Exception as exc:
        logger.warning("RIPE Atlas probes query failed: %s", exc)
        return {}

    probes = data.get("results", [])
    if not probes:
        return {}

    # Group probes by nearest region
    region_counts: dict[str, dict] = {}

    for probe in probes:
        try:
            status_id = probe.get("status", {}).get("id")
            coords = probe.get("geometry", {}).get("coordinates", [])
            if len(coords) < 2:
                continue
            # RIPE geometry uses [lon, lat] order
            lon, lat = float(coords[0]), float(coords[1])
        except (TypeError, ValueError):
            continue

        region = nearest_region(lat, lon)
        if region is None:
            continue

        if region not in region_counts:
            region_counts[region] = {"total": 0, "disconnected": 0}

        region_counts[region]["total"] += 1
        if status_id == _STATUS_DISCONNECTED:
            region_counts[region]["disconnected"] += 1

    if not region_counts:
        return {}

    result: dict = {}
    for region, counts in region_counts.items():
        total        = counts["total"]
        disconnected = counts["disconnected"]
        ratio        = disconnected / total if total > 0 else 0.0
        result[region] = {
            "disconnected_ratio": round(ratio, 4),
            "probe_count":        total,
            "score":              score_region_probes(disconnected, total),
        }

    return result
