"""
Outage type classifier — Phase 2 simple + full OutageSignature scorer.

classify_outage_type dispatches on input type:
  OutageSignals  → simple 4-type if/elif (Phase 2 backward compat)
  OutageSignature → full 6-type scored system (T-025B)
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



def _matches_periodic_interval(hours: float) -> bool:
    """True if interval is within tolerance of a known periodic cycle."""
    if hours <= 0:
        return False
    return any(
        abs(hours - period) <= _INTERVAL_TOLERANCE_H
        for period in _PERIODIC_INTERVALS
    )


# ── Full OutageSignature classifier (T-025B) ──────────────────────────────────

@dataclass
class OutageSignature:
    """All signals available at detection time (18-field full version)."""
    # Geographic scope
    regions_affected: list
    zones_affected: list
    total_zones_in_region: int

    # Temporal
    started_at: datetime
    day_of_week: int
    matches_known_schedule: bool
    time_since_last_outage_hours: float

    # Speed of onset
    reports_first_5min: int
    reports_first_15min: int

    # Internet connectivity
    inet_drop_pct: float        # 0-100
    inet_drop_speed: str        # "instant" | "gradual" | "none"

    # Crowd report content
    reports_mention_explosion: int
    reports_mention_transformer: int
    reports_mention_smoke_fire: int
    reports_mention_fluctuation: int

    # Weather
    active_storm: bool
    wind_speed_kmh: float
    lightning_nearby: bool

    # Historical pattern
    similar_outage_count_90days: int


def _classify_full(sig: OutageSignature) -> dict:
    """Score-based 6-type classifier using OutageSignature."""
    scores: dict[str, float] = {
        "rationing":        0.0,
        "feeder_fault":     0.0,
        "substation_fault": 0.0,
        "transmission_fault": 0.0,
        "national_blackout": 0.0,
        "weather_damage":   0.0,
    }

    pct_zones = len(sig.zones_affected) / max(sig.total_zones_in_region, 1)

    # === GEOGRAPHIC SCOPE ===
    if len(sig.regions_affected) >= 5:
        scores["national_blackout"] += 0.4
    elif len(sig.regions_affected) >= 2:
        scores["transmission_fault"] += 0.3

    if len(sig.zones_affected) == 1:
        scores["rationing"]    += 0.2
        scores["feeder_fault"] += 0.2
    elif 2 <= len(sig.zones_affected) <= 5:
        scores["substation_fault"] += 0.2
        scores["rationing"]        += 0.1
    elif pct_zones > 0.5:
        scores["substation_fault"] += 0.3

    # === TEMPORAL PATTERN ===
    if sig.matches_known_schedule:
        scores["rationing"] += 0.35
    else:
        scores["feeder_fault"]     += 0.1
        scores["substation_fault"] += 0.1

    if sig.day_of_week < 5 and 10 <= sig.started_at.hour <= 21:
        scores["rationing"] += 0.1

    if sig.time_since_last_outage_hours > 0:
        for period in _PERIODIC_INTERVALS:
            if abs(sig.time_since_last_outage_hours - period) < _INTERVAL_TOLERANCE_H:
                scores["rationing"] += 0.15
                break

    if sig.similar_outage_count_90days > 20:
        scores["rationing"] += 0.15
    elif sig.similar_outage_count_90days < 3:
        scores["feeder_fault"]   += 0.15
        scores["weather_damage"] += 0.1

    # === ONSET SPEED ===
    if sig.reports_first_5min > 20:
        scores["feeder_fault"]      += 0.1
        scores["substation_fault"]  += 0.1
        scores["national_blackout"] += 0.1
    elif sig.reports_first_5min < 5 and sig.reports_first_15min > 15:
        scores["rationing"] += 0.1

    # === INTERNET DROP PATTERN ===
    if sig.inet_drop_speed == "instant" and sig.inet_drop_pct > 80:
        scores["national_blackout"]  += 0.2
        scores["transmission_fault"] += 0.15
    elif sig.inet_drop_speed == "gradual":
        scores["rationing"] += 0.1

    # === USER-REPORTED SYMPTOMS ===
    if sig.reports_mention_explosion > 0 or sig.reports_mention_smoke_fire > 0:
        scores["feeder_fault"]   += 0.25
        scores["weather_damage"] += 0.1

    if sig.reports_mention_transformer > 2:
        scores["feeder_fault"] += 0.2

    if sig.reports_mention_fluctuation > 5:
        scores["substation_fault"] += 0.15
        scores["rationing"]        += 0.05

    # === WEATHER ===
    if sig.active_storm:
        scores["weather_damage"] += 0.3
    if sig.lightning_nearby:
        scores["weather_damage"] += 0.15
    if sig.wind_speed_kmh > 60:
        scores["weather_damage"] += 0.2

    if not sig.active_storm and not sig.lightning_nearby:
        scores["weather_damage"] *= 0.2

    # === NORMALIZE ===
    total = sum(scores.values())
    if total > 0:
        scores = {k: round(v / total, 3) for k, v in scores.items()}

    best_type  = max(scores, key=scores.get)
    confidence = scores[best_type]

    return {
        "type":        best_type,
        "confidence":  confidence,
        "all_scores":  scores,
        "explanation": build_explanation(best_type, sig),
    }


def build_explanation(outage_type: str, sig: OutageSignature) -> str:
    explanations = {
        "rationing": (
            f"Matches scheduled rationing pattern. "
            f"{sig.similar_outage_count_90days} similar outages in last 90 days. "
            f"{'Matches known PAC schedule.' if sig.matches_known_schedule else ''}"
        ),
        "feeder_fault": (
            f"Localized to single zone. "
            f"{'Users report explosion/smoke. ' if sig.reports_mention_explosion or sig.reports_mention_smoke_fire else ''}"
            f"Does not match typical rationing schedule."
        ),
        "substation_fault": (
            f"{len(sig.zones_affected)} adjacent zones affected simultaneously. "
            f"Likely substation or major distribution equipment failure."
        ),
        "transmission_fault": (
            f"{len(sig.regions_affected)} regions affected simultaneously. "
            f"Consistent with high-voltage transmission line failure."
        ),
        "national_blackout": (
            f"{len(sig.regions_affected)} regions affected. "
            f"Internet connectivity dropped {sig.inet_drop_pct:.0f}% instantly. "
            f"Possible generation failure or cascading grid collapse."
        ),
        "weather_damage": (
            f"Active storm in area with {sig.wind_speed_kmh:.0f} km/h winds. "
            f"{'Lightning detected nearby. ' if sig.lightning_nearby else ''}"
            f"Outage likely caused by weather damage to local infrastructure."
        ),
    }
    return explanations.get(outage_type, "Unable to determine cause.")


# ── unified dispatcher ────────────────────────────────────────────────────────

def classify_outage_type(sig, region: str | None = None, started_at: datetime | None = None) -> dict:
    """
    Classify an outage.

    If sig is OutageSignature → full 6-type scored system.
    If sig is OutageSignals   → simple 4-type if/elif (Phase 2 backward compat).
    """
    if isinstance(sig, OutageSignature):
        return _classify_full(sig)
    return _classify_simple(sig, region, started_at)


def _classify_simple(
    signals: "OutageSignals",
    region: str | None,
    started_at: datetime | None,
) -> dict:
    """Original Phase 2 simple classifier — preserved for backward compatibility."""
    if started_at is None:
        raise ValueError("started_at required for OutageSignals classifier")
    if region is None:
        raise ValueError("region required for OutageSignals classifier")

    hour = started_at.hour
    day  = started_at.weekday()

    if signals.adjacent_regions_affected >= _NATIONAL_REGIONS_THRESHOLD or signals.inet_drop_national:
        regions = signals.adjacent_regions_affected
        confidence = 0.9 if (signals.inet_drop_national and regions >= 5) else 0.75
        explanation = (
            f"{regions} regions affected simultaneously. "
            + ("National internet drop detected. " if signals.inet_drop_national else "")
            + "Possible generation failure or cascading grid collapse."
        )
        return {"type": "national_blackout", "confidence": confidence, "explanation": explanation}

    if signals.adjacent_regions_affected >= _TRANSMISSION_REGIONS_THRESHOLD or signals.inet_drop_regional:
        regions = signals.adjacent_regions_affected
        confidence = 0.80 if (signals.inet_drop_regional and regions >= 2) else 0.65
        explanation = (
            f"{regions} regions affected. "
            + ("Regional internet connectivity drop detected. " if signals.inet_drop_regional else "")
            + "Consistent with high-voltage transmission line failure."
        )
        return {"type": "transmission_fault", "confidence": confidence, "explanation": explanation}

    pattern  = check_rationing_pattern(region, hour, day)
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

    return {
        "type": "unknown",
        "confidence": 0.0,
        "explanation": "Insufficient signals to classify outage type.",
    }
