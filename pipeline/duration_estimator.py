"""
Duration estimator — conditional survival analysis.

Estimates remaining outage duration given:
- Historical durations for this region/type
- How long the outage has already lasted
- Real-time recovery signals (crowd, internet)

Key insight: estimate refines as outage continues.
P(remaining > dt | lasted t) = P(total > t+dt) / P(total > t)
"""
from datetime import datetime, timedelta, timezone


def survival_estimate(historical_durations: list[float], elapsed: float) -> dict:
    """
    Conditional survival analysis.
    Given outage has lasted 'elapsed' minutes, return distribution of remaining time.
    """
    still_going = [d for d in historical_durations if d > elapsed]

    if len(still_going) < 5:
        return {
            "median_remaining_min":      30,
            "optimistic_remaining_min":  10,
            "pessimistic_remaining_min": 120,
            "confidence": "low",
            "message": "Outage has lasted longer than most similar events",
        }

    remaining = sorted(d - elapsed for d in still_going)
    n = len(remaining)
    p25 = remaining[int(n * 0.25)]
    p50 = remaining[int(n * 0.50)]
    p75 = remaining[int(n * 0.75)]

    return {
        "optimistic_remaining_min":  max(p25, 5),
        "median_remaining_min":      p50,
        "pessimistic_remaining_min": p75,
        "confidence": "high" if n >= 30 else "medium",
    }


def fallback_estimate(initial: dict, elapsed_hours: float) -> dict:
    """Linear adjustment when historical data is sparse (< 20 durations)."""
    elapsed_min   = elapsed_hours * 60
    median_total  = initial["median"] * 60
    min_total     = initial["min"]    * 60
    max_total     = initial["max"]    * 60

    return {
        "optimistic_remaining_min":  max(min_total    - elapsed_min, 5),
        "median_remaining_min":      max(median_total - elapsed_min, 10),
        "pessimistic_remaining_min": max(max_total    - elapsed_min, 15),
        "confidence": "low",
    }


def estimate_remaining(
    outage_type: str,
    region: str,
    initial_estimate_hours: dict,   # {min, median, max} in hours
    elapsed_minutes: float,
    crowd_restoration_reports: int,
    inet_recovering: bool,
    historical_durations: list[float],
    now: datetime | None = None,
) -> dict:
    """
    Return updated estimate of remaining outage duration.
    Called each pipeline cycle while outage is active.
    """
    if now is None:
        now = datetime.now(timezone.utc)

    elapsed_hours = elapsed_minutes / 60

    if len(historical_durations) >= 20:
        remaining = survival_estimate(historical_durations, elapsed_minutes)
    else:
        remaining = fallback_estimate(initial_estimate_hours, elapsed_hours)

    confidence_boost = ""

    if crowd_restoration_reports >= 3:
        remaining["median_remaining_min"] *= 0.6
        confidence_boost = "Power restored in nearby areas, likely coming soon"

    if inet_recovering:
        remaining["median_remaining_min"] *= 0.7
        confidence_boost = "Internet connectivity recovering in region"

    result: dict = {
        "elapsed_minutes":            round(elapsed_minutes),
        "estimated_remaining_min":    round(remaining["median_remaining_min"]),
        "estimated_remaining_range_min": {
            "optimistic":  round(remaining["optimistic_remaining_min"]),
            "likely":      round(remaining["median_remaining_min"]),
            "pessimistic": round(remaining["pessimistic_remaining_min"]),
        },
        "estimated_restoration_time": (
            now + timedelta(minutes=remaining["median_remaining_min"])
        ).isoformat(),
        "confidence":      remaining.get("confidence", "medium"),
        "message":         remaining.get("message", ""),
        "confidence_boost": confidence_boost,
    }

    max_min = initial_estimate_hours["max"] * 60
    if elapsed_minutes > max_min:
        result["status"]  = "longer_than_expected"
        result["message"] = (
            f"Outage lasted longer than typical maximum of "
            f"{initial_estimate_hours['max']}h for this type. "
            f"Could be a more serious event."
        )

    return result
