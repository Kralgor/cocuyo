"""
Restoration tracker — detects when power returns in a region.

Requires stable + at least 2 signals to declare "restored".
One signal alone → "recovering". No signals → "still_out".
"""
from datetime import datetime, timezone

RESTORATION_THRESHOLDS = {
    "crowd_reports_power_back": 5,   # N users report power back
    "inet_recovery_ratio":      0.85, # connectivity ≥ 85% of baseline
    "min_stable_minutes":       15,   # no fluctuation in last 15 min
}


def check_restoration(
    region: str,
    outage_start: datetime,
    current_inet_score: float,
    baseline_inet_score: float,
    crowd_power_back_reports: int,
    crowd_power_back_first_at: datetime | None,
    last_fluctuation_at: datetime | None,
    now: datetime | None = None,
) -> dict:
    """
    Determine restoration status for a region.
    Returns {"status": restored|recovering|still_out, ...}.
    """
    if now is None:
        now = datetime.now(timezone.utc)

    signals: list[str] = []

    # Signal 1: internet connectivity recovered
    if baseline_inet_score > 0:
        recovery_ratio = current_inet_score / baseline_inet_score
    else:
        recovery_ratio = 0.0

    inet_recovered = recovery_ratio >= RESTORATION_THRESHOLDS["inet_recovery_ratio"]
    if inet_recovered:
        signals.append("internet_recovered")

    # Signal 2: crowd reports confirm power back
    crowd_confirmed = (
        crowd_power_back_reports >= RESTORATION_THRESHOLDS["crowd_reports_power_back"]
    )
    if crowd_confirmed:
        signals.append("crowd_confirmed")

    # Signal 3: stability — no fluctuation in last min_stable_minutes
    stable = True
    if last_fluctuation_at is not None:
        minutes_since = (now - last_fluctuation_at).total_seconds() / 60
        stable = minutes_since >= RESTORATION_THRESHOLDS["min_stable_minutes"]

    if stable and (inet_recovered or crowd_confirmed):
        signals.append("stable")

    # ── decision ──────────────────────────────────────────────────────────────

    if "stable" in signals and len(signals) >= 2:
        actual_end = crowd_power_back_first_at if crowd_power_back_first_at else now
        duration_minutes = (actual_end - outage_start).total_seconds() / 60

        return {
            "status":                   "restored",
            "confidence":               "high" if len(signals) >= 3 else "medium",
            "restored_at":              actual_end.isoformat(),
            "outage_duration_minutes":  round(duration_minutes),
            "signals":                  signals,
        }

    if len(signals) >= 1:
        return {
            "status":     "recovering",
            "confidence": "low",
            "signals":    signals,
            "message":    "Early signs of restoration, monitoring stability",
        }

    return {"status": "still_out", "signals": []}
