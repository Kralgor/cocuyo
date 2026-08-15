"""
Per-municipio status computation.

Extends the 17-region model down to every municipio in Venezuela
(24 states, 332 municipios — pipeline/municipios.py geography).

Each municipio entry carries its own data:

  - satellite: VIIRS night-light radiance sampled at the municipio's OWN
    centroid (collector_viirs.extract_radiance_at_point), ratio vs the
    state's region baseline. This is the municipio's own observation.
  - internet / weather / crowdsource: attributed from the state's region.
    Municipios share the state's grid and the region city is the state's
    network hub, so the state's signals apply down. States without a
    region (Amazonas, Apure, Cojedes, Delta Amacuro, Guárico, La Guaira,
    Portuguesa, Yaracuy) report null for attributed signals — honest
    no_data, never fabricated.

Output schema (appended to status.json as "municipios"):

    "municipios": {
      "Carabobo": [
        { "name": "Valencia", "lat": ..., "lon": ...,
          "current_score": 0.12, "status": "normal",
          "signals": { "internet": ..., "satellite": ..., "crowdsource": ..., "weather": ... } },
        ...
      ]
    }
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional

from pipeline.municipios import Municipio, MUNICIPIOS, STATE_ORDER
from pipeline.regions import REGIONS
from pipeline.scorer import compute_region_score

logger = logging.getLogger(__name__)

# Reverse map: state display name -> region key (regions.py). One region per
# state except Miranda (los_teques + guarenas_guatire) — both attributed.
_STATE_TO_REGION: dict[str, str] = {}
for key, meta in REGIONS.items():
    _STATE_TO_REGION.setdefault(meta["state"], key)

# Statuses that should read as "lights out" on the map
OUTAGE_STATUSES = {
    "no_power",
    "confirmed_outage",
    "likely_outage",
    "unverified_reports",
    "major_outage",
    "partial_outage",
}

# VIIRS ratio classification -> app status vocabulary (v2 satellite-dominant)
_SATELLITE_TO_STATUS: dict[str, str] = {
    "major_outage":   "confirmed_outage",
    "partial_outage": "likely_outage",
    "degraded":       "at_risk",
    "normal":         "normal",
}


def _score_to_classification(score: float) -> str:
    """Inverse of the satellite score map (collector_viirs._STATUS_TO_SCORE):
    0.9 major, 0.6 partial, 0.4 degraded, else normal."""
    if score >= 0.85:
        return "major_outage"
    if score >= 0.55:
        return "partial_outage"
    if score >= 0.30:
        return "degraded"
    return "normal"


def region_for_state(state: str) -> Optional[str]:
    """Region key covering a state, or None when the state has no region."""
    return _STATE_TO_REGION.get(state)


def aggregate_state_status(municipio_entries: list[dict]) -> str:
    """
    Worst status among a state's municipios (drives the state circle color).

    Order: outage > unstable/degraded > power_back > normal > no_data.
    """
    rank = {
        "no_data": 0, "unknown": 0,
        "normal": 1, "power_back": 2,
        "degraded": 3, "unstable": 4,
        "partial_outage": 5, "likely_outage": 5,
        "unverified_reports": 6, "confirmed_outage": 6,
        "major_outage": 7, "no_power": 8,
    }
    worst = "no_data"
    worst_r = rank[worst]
    for entry in municipio_entries:
        r = rank.get(entry.get("status", "no_data"), 0)
        if r > worst_r:
            worst_r, worst = r, entry.get("status", "no_data")
    return worst


def derive_municipio_entry(
    municipio: Municipio,
    region_entry: Optional[dict],
    satellite: Optional[dict],
    crowd: Optional[dict] = None,
) -> dict:
    """
    Build one municipio's status entry. Pure logic — no network.

    Status rule (v3):
      - Crowd quorum met (crowd passed with a score): the blended score
        decides (crowd + own satellite + region internet/weather). People
        reporting are ground truth; satellite corroborates.
      - Otherwise, when the municipio's OWN VIIRS sample exists: its
        status comes from THAT observation (major_outage ->
        confirmed_outage, partial -> likely, degraded -> at_risk,
        normal -> normal). The municipio's lights ARE its status.
      - Otherwise: region signals via the weighted blend (fallback).
    """
    crowd_score = (crowd or {}).get("crowd_score")
    crowd_count = (crowd or {}).get("crowd_count", 0)

    signals = {
        "internet":    (region_entry or {}).get("signals", {}).get("internet") if region_entry else None,
        "satellite":   (satellite or {}).get("score"),
        "crowdsource": crowd_score,
        "weather":     (region_entry or {}).get("signals", {}).get("weather") if region_entry else None,
    }

    if crowd_score is not None:
        # reports are ground truth — blend everything (scorer handles
        # passive validation: crowd + satellite/internet -> threshold status)
        scored = compute_region_score(
            crowd_score=crowd_score,
            internet_score=signals["internet"],
            satellite_score=signals["satellite"],
            weather_score=signals["weather"],
        )
        status = scored.status
        current_score = scored.current_score
    elif satellite and satellite.get("status"):
        # own observation decides — per-municipio independent
        status = _SATELLITE_TO_STATUS.get(
            satellite["status"],
            (region_entry or {}).get("status", "no_data"),
        )
        current_score = satellite.get("score", 0.0)
    else:
        scored = compute_region_score(
            crowd_score=None,
            internet_score=signals["internet"],
            satellite_score=signals["satellite"],
            weather_score=signals["weather"],
        )
        status = scored.status
        current_score = scored.current_score

    entry: dict = {
        "name": municipio["name"],
        "lat":  municipio["lat"],
        "lon":  municipio["lon"],
        "current_score": round(current_score, 4),
        "status": status,
        "crowd_reports_30min": crowd_count,
        "signals": {
            "internet":    _r(signals["internet"]),
            "satellite":   _r(signals["satellite"]),
            "crowdsource": _r(signals["crowdsource"]),
            "weather":     _r(signals["weather"]),
        },
    }
    return entry


def build_municipios_payload(
    regions: dict[str, dict],
    satellite_by_municipio: Optional[dict[tuple[str, str], Optional[dict]]] = None,
    crowd_by_municipio: Optional[dict[tuple[str, str], dict]] = None,
) -> dict:
    """
    Build the full "municipios" section from the per-region status payload.

    regions: the "regions" section of status.json (region key -> entry).
    satellite_by_municipio: optional {(state, muni_name): {"status", "score",
      "ratio"}} from the VIIRS sampler. Missing municipios fall back to the
      state region's own satellite entry when present, else no satellite.
    crowd_by_municipio: optional {(state, muni_name): {"crowd_score",
      "crowd_count"}} from the per-municipio crowd aggregation.
    """
    payload: dict[str, list[dict]] = {}
    for state in STATE_ORDER:
        region_key = region_for_state(state)
        region_entry = regions.get(region_key) if region_key else None
        state_entries: list[dict] = []
        for m in MUNICIPIOS.get(state, []):
            own = None
            if satellite_by_municipio is not None:
                own = satellite_by_municipio.get((state, m["name"]))
            if own is None and region_entry is not None:
                # own sample missing (clouds) — inherit the state region's
                # satellite score, mapped back to its classification so a
                # state-wide outage is not masked as normal.
                sat = region_entry.get("signals", {}).get("satellite")
                if sat is not None:
                    own = {"status": _score_to_classification(sat), "score": sat}
            crowd = None
            if crowd_by_municipio is not None:
                crowd = crowd_by_municipio.get((state, m["name"]))
            entry = derive_municipio_entry(m, region_entry, own, crowd)
            entry["state"] = state
            state_entries.append(entry)
        payload[state] = state_entries
    return payload


def _r(value: Optional[float]) -> Optional[float]:
    """Round a score for JSON output (null-safe)."""
    return round(value, 4) if value is not None else None
