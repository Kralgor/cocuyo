"""
Outage type classifier — Phase 2 simple version.

4 output types: rationing, transmission_fault, national_blackout, unknown.
Uses only signals available at Phase 2 detection time.
"""
from dataclasses import dataclass
from datetime import datetime


# Known rationing schedules (seed data; manually updated).
# typical_start_hour is local Venezuelan time (UTC-4), but pipeline uses UTC.
# UTC offset = local + 4, so 13:00 local = 17:00 UTC — stored as UTC hour.
_VET_OFFSET = 4  # VET = UTC - 4

# Schedule hours are local Venezuelan time (VET = UTC-4).
_RATIONING_SCHEDULES: dict[str, dict] = {
    "maracaibo": {
        "frequency": "interdiario",
        "typical_start_hour_vet": 13,   # 1pm VET
        "window_hours": 4,
        "description": "Every other day (interdiario), 2-6h, usually after 1pm",
    },
    "san_cristobal": {
        "frequency": "daily",
        "typical_start_hour_vet": 10,   # 10am VET
        "window_hours": 4,
        "description": "Daily, 3-4 blocks totaling 10-12h, starts ~10am",
    },
    "merida": {
        "frequency": "daily",
        "typical_start_hour_vet": 12,   # noon VET
        "window_hours": 4,
        "description": "Daily, 3-7h, starts ~noon",
    },
    "barquisimeto": {
        "frequency": "3-4x/week",
        "typical_start_hour_vet": 14,   # 2pm VET
        "window_hours": 4,
        "description": "3-4 times per week, 2-5h, after 2pm",
    },
}

_NATIONAL_REGIONS_THRESHOLD = 5
_TRANSMISSION_REGIONS_THRESHOLD = 2

# Hours around typical_start_hour_utc that still count as "in window"
_HOUR_TOLERANCE = 3

# Interval tolerance for periodic pattern (hours)
_INTERVAL_TOLERANCE_H = 6
_PERIODIC_INTERVALS = [24, 48, 72]


@dataclass
class OutageSignals:
    inet_drop_national: bool
    inet_drop_regional: bool
    adjacent_regions_affected: int
    crowd_reports_count: int
    time_since_last_outage_hours: float


def check_rationing_pattern(region: str, hour: int, day_of_week: int) -> dict:
    """
    Check if given region/hour/day matches a known rationing schedule.

    Returns {"matches": bool, "confidence": float, "pattern": str | None}.
    hour: UTC hour (0-23).
    day_of_week: 0=Monday.
    """
    schedule = _RATIONING_SCHEDULES.get(region)
    if schedule is None:
        return {"matches": False, "confidence": 0.0, "pattern": None}

    # Convert UTC hour to VET for comparison
    vet_hour = (hour - _VET_OFFSET) % 24
    start = schedule["typical_start_hour_vet"]
    window = schedule["window_hours"]
    # In-window: vet_hour within [start - tolerance, start + window + tolerance]
    in_window = (start - _HOUR_TOLERANCE) <= vet_hour <= (start + window + _HOUR_TOLERANCE)

    if not in_window:
        return {"matches": False, "confidence": 0.0, "pattern": None}

    # Frequency-based confidence
    frequency = schedule["frequency"]
    if frequency == "daily":
        # Daily = always matches on any weekday
        base_confidence = 0.8 if day_of_week < 5 else 0.5
    elif frequency == "interdiario":
        # Every other day — can't know parity without DB; moderate confidence
        base_confidence = 0.65
    else:
        # 3-4x/week or other
        base_confidence = 0.55

    # Boost if hour is very close to typical start
    hour_delta = abs(hour - start)
    if abs(vet_hour - start) <= 1:
        base_confidence = min(base_confidence + 0.15, 1.0)

    return {
        "matches": True,
        "confidence": round(base_confidence, 3),
        "pattern": schedule["description"],
    }


def classify_outage_type(
    signals: OutageSignals,
    region: str,
    started_at: datetime,
) -> dict:
    """
    Classify outage into rationing | transmission_fault | national_blackout | unknown.

    Priority order (highest wins):
      1. national_blackout — >= 5 regions OR national inet drop
      2. transmission_fault — >= 2 regions OR regional inet drop (no national)
      3. rationing — matches schedule OR periodic interval
      4. unknown — fallback
    """
    hour = started_at.hour
    day  = started_at.weekday()

    # ── Priority 1: national blackout ─────────────────────────────────────────
    if signals.adjacent_regions_affected >= _NATIONAL_REGIONS_THRESHOLD or signals.inet_drop_national:
        regions = signals.adjacent_regions_affected
        confidence = 0.9 if (signals.inet_drop_national and regions >= 5) else 0.75
        explanation = (
            f"{regions} regions affected simultaneously. "
            + ("National internet drop detected. " if signals.inet_drop_national else "")
            + "Possible generation failure or cascading grid collapse."
        )
        return {"type": "national_blackout", "confidence": confidence, "explanation": explanation}

    # ── Priority 2: transmission fault ────────────────────────────────────────
    if signals.adjacent_regions_affected >= _TRANSMISSION_REGIONS_THRESHOLD or signals.inet_drop_regional:
        regions = signals.adjacent_regions_affected
        confidence = 0.80 if (signals.inet_drop_regional and regions >= 2) else 0.65
        explanation = (
            f"{regions} regions affected. "
            + ("Regional internet connectivity drop detected. " if signals.inet_drop_regional else "")
            + "Consistent with high-voltage transmission line failure."
        )
        return {"type": "transmission_fault", "confidence": confidence, "explanation": explanation}

    # ── Priority 3: rationing ─────────────────────────────────────────────────
    pattern = check_rationing_pattern(region, hour, day)
    periodic = _matches_periodic_interval(signals.time_since_last_outage_hours)

    if pattern["matches"] or periodic:
        if pattern["matches"] and periodic:
            confidence = min(pattern["confidence"] + 0.15, 0.95)
        elif pattern["matches"]:
            confidence = pattern["confidence"]
        else:
            confidence = 0.55

        explanation = (
            (f"Matches known rationing schedule: {pattern['pattern']}. " if pattern["matches"] else "")
            + (f"Interval since last outage (~{signals.time_since_last_outage_hours:.0f}h) "
               f"matches periodic pattern. " if periodic else "")
        ).strip()

        return {"type": "rationing", "confidence": confidence, "explanation": explanation}

    # ── Priority 4: unknown ───────────────────────────────────────────────────
    return {
        "type": "unknown",
        "confidence": 0.0,
        "explanation": "Insufficient signals to classify outage type.",
    }


def _matches_periodic_interval(hours: float) -> bool:
    """True if interval is within tolerance of a known periodic cycle."""
    if hours <= 0:
        return False
    return any(
        abs(hours - period) <= _INTERVAL_TOLERANCE_H
        for period in _PERIODIC_INTERVALS
    )
