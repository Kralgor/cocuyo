"""
VIIRS nighttime lights satellite collector (NASA LANCE NRT).

Compares observed radiance vs per-region baseline to detect light
anomalies correlated with power outages. HDF5 granule download/parsing
is Phase 3 detail — _extract_region_radiance() returns None until then.

Used by main.py as satellite_score input to scorer.py.
"""
import logging
import os
from datetime import date, timedelta

import requests

logger = logging.getLogger(__name__)

CMR_URL   = "https://cmr.earthdata.nasa.gov/search/granules.json"
TIMEOUT_S = 20

VE_BBOX = {
    "west":  -73.38,
    "south":   0.65,
    "north":  12.20,
    "east":  -59.80,
}

# Seed baselines (nW·cm⁻²·sr⁻¹) — calibrate from Black Marble historical avg.
# Spec values where given; remaining estimated from city population/area.
BASELINE_RADIANCE: dict[str, float] = {
    "caracas":          45.2,
    "maracaibo":        38.7,
    "valencia":         29.1,
    "barquisimeto":     22.4,
    "maracay":          20.8,
    "ciudad_guayana":   18.3,
    "guarenas_guatire": 19.4,
    "barcelona":        21.3,
    "los_teques":       16.7,
    "maturin":          17.9,
    "porlamar":         18.5,
    "cumana":           16.8,
    "san_cristobal":    15.2,
    "punto_fijo":       14.2,
    "barinas":          13.1,
    "valera":           11.5,
    "merida":           12.8,
}

_STATUS_TO_SCORE: dict[str, float] = {
    "major_outage":   0.90,
    "partial_outage": 0.60,
    "degraded":       0.30,
    "normal":         0.00,
}


def classify_ratio(ratio: float) -> str:
    """Map observed/baseline radiance ratio to status string."""
    if ratio < 0.3:
        return "major_outage"
    if ratio < 0.6:
        return "partial_outage"
    if ratio < 0.85:
        return "degraded"
    return "normal"


def _fetch_granule_list(
    date_str: str,
    session: requests.Session,
) -> list[dict]:
    """Query NASA CMR for VNP46A2NRT granules covering Venezuela."""
    token = os.environ.get("NASA_TOKEN", "")
    try:
        resp = session.get(
            CMR_URL,
            params={
                "short_name":   "VNP46A2NRT",
                "temporal":     f"{date_str}T00:00:00Z,{date_str}T23:59:59Z",
                "bounding_box": (
                    f"{VE_BBOX['west']},{VE_BBOX['south']},"
                    f"{VE_BBOX['east']},{VE_BBOX['north']}"
                ),
                "page_size": 10,
            },
            headers={"Authorization": f"Bearer {token}"},
            timeout=TIMEOUT_S,
        )
        resp.raise_for_status()
        return resp.json().get("feed", {}).get("entry", [])
    except Exception as exc:
        logger.warning("VIIRS CMR query failed: %s", exc)
        return []


def _extract_region_radiance(
    granules: list[dict],
    region: str,
) -> float | None:
    """
    Download HDF5 granule(s) and extract mean radiance for region bbox.
    Phase 3 impl — returns None until rasterio processing is wired up.
    """
    return None  # TODO: Phase 3 — rasterio HDF5 processing


def fetch_latest_viirs(
    date_str: str | None = None,
    _session: requests.Session | None = None,
    _extract_fn=_extract_region_radiance,
) -> dict[str, dict]:
    """
    Return per-region radiance analysis keyed by region string.

    Each entry: {observed, baseline, ratio, status, score}.
    Region absent from result when granule missing or extract fails.
    """
    if date_str is None:
        date_str = (date.today() - timedelta(days=1)).strftime("%Y-%m-%d")

    session  = _session or requests.Session()
    granules = _fetch_granule_list(date_str, session)

    if not granules:
        logger.warning("VIIRS: no granules for %s — satellite signal unavailable", date_str)
        return {}

    results: dict[str, dict] = {}
    for region, baseline in BASELINE_RADIANCE.items():
        observed = _extract_fn(granules, region)
        if observed is None:
            continue
        ratio = observed / baseline
        status = classify_ratio(ratio)
        results[region] = {
            "observed": round(observed, 2),
            "baseline": baseline,
            "ratio":    round(ratio, 3),
            "status":   status,
            "score":    _STATUS_TO_SCORE[status],
        }

    return results
