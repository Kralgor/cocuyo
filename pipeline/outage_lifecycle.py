"""
Outage lifecycle manager.

Runs each pipeline cycle to bridge region scores → outage events:
  - normal→outage: INSERT active_outages (shared event_id if multi-region)
  - outage→normal: INSERT outage_history, DELETE active_outages

Requires service_role client (RLS bypassed).
"""
import logging
import uuid
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

_OUTAGE_STATUSES = frozenset({"likely_outage", "confirmed_outage"})
_NORMAL_STATUSES = frozenset({"normal"})


# ── DB helpers ────────────────────────────────────────────────────────────────

def _fetch_active_outages(client) -> dict[str, dict]:
    """Return active outage rows keyed by region."""
    try:
        result = client.table("active_outages").select("*").execute()
        return {row["region"]: row for row in (result.data or [])}
    except Exception as exc:
        logger.error("fetch active_outages failed: %s", exc)
        return {}


def _create_active_outage(
    region: str,
    event_id: str,
    region_data: dict,
    now: datetime,
    client,
) -> None:
    try:
        client.table("active_outages").insert({
            "event_id":    event_id,
            "region":      region,
            "started_at":  now.isoformat(),
            "outage_type": None,          # Phase 3 classifier
            "last_score":  region_data.get("current_score"),
            "last_updated": now.isoformat(),
        }).execute()
        logger.info("active_outage created: region=%s event=%s", region, event_id)
    except Exception as exc:
        logger.error("create active_outage %s failed: %s", region, exc)


def _close_outage(
    region: str,
    active_row: dict,
    region_data: dict,
    now: datetime,
    client,
) -> None:
    """Write outage_history row and remove from active_outages."""
    try:
        started_at = datetime.fromisoformat(active_row["started_at"])
        if started_at.tzinfo is None:
            started_at = started_at.replace(tzinfo=timezone.utc)
        duration_min = round((now - started_at).total_seconds() / 60)

        client.table("outage_history").insert({
            "event_id":       active_row["event_id"],
            "region":         region,
            "outage_type":    active_row.get("outage_type"),
            "started_at":     active_row["started_at"],
            "ended_at":       now.isoformat(),
            "duration_min":   duration_min,
            "day_of_week":    started_at.weekday(),
            "hour_started":   started_at.hour,
            "crowd_reports":  region_data.get("crowd_reports_30min", 0),
            "predicted_dur":  active_row.get("predicted_dur"),
            "prediction_error": None,     # Phase 4
        }).execute()

        client.table("active_outages").delete().eq("region", region).execute()
        logger.info("outage closed: region=%s duration=%dmin", region, duration_min)
    except Exception as exc:
        logger.error("close outage %s failed: %s", region, exc)


# ── main entry point ──────────────────────────────────────────────────────────

def process_lifecycle(
    regions_scored: dict[str, dict],
    now: datetime,
    client,
) -> dict:
    """
    Detect outage transitions and update DB tables.
    Called once per pipeline cycle by main.py.

    Returns {"new_outages": [region, ...], "restorations": [region, ...]}.
    """
    active = _fetch_active_outages(client)

    new_outage_regions = [
        r for r, data in regions_scored.items()
        if data.get("status") in _OUTAGE_STATUSES and r not in active
    ]
    restored_regions = [
        r for r in active
        if regions_scored.get(r, {}).get("status") in _NORMAL_STATUSES
    ]

    # Simultaneous multi-region transition → shared event_id
    shared_event_id = str(uuid.uuid4())
    use_shared = len(new_outage_regions) > 1

    for region in new_outage_regions:
        event_id = shared_event_id if use_shared else str(uuid.uuid4())
        _create_active_outage(region, event_id, regions_scored[region], now, client)

    for region in restored_regions:
        _close_outage(region, active[region], regions_scored[region], now, client)

    if new_outage_regions:
        logger.info("new outages: %s (shared=%s)", new_outage_regions, use_shared)
    if restored_regions:
        logger.info("restorations: %s", restored_regions)

    return {"new_outages": new_outage_regions, "restorations": restored_regions}
