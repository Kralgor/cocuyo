"""
Cross-validation: reconciles crowd reports vs passive signals.

cross_validate() is pure — no I/O. Returns final_score, confidence, flag.
backfill_confirmed_by_passive() is the side-effect: marks no_power reports
in a region as confirmed when passive signals agree.
"""
import logging
from datetime import datetime, timedelta, timezone

logger = logging.getLogger(__name__)

_BACKFILL_WINDOW_MIN = 30


def cross_validate(
    region: str,
    crowd_score: float,
    crowd_confidence: str,
    inet_score: float | None,
    satellite_score: float | None,
) -> dict:
    """
    Compare crowd vs passive signals. None passive treated as 0 (no evidence).

    Returns dict with: final_score, trust_crowd, confidence, note, [flag].
    """
    inet_score      = inet_score      if inet_score      is not None else 0.0
    satellite_score = satellite_score if satellite_score is not None else 0.0

    crowd_says_outage = crowd_score      >= 0.5
    inet_says_outage  = inet_score       >= 0.5
    sat_says_outage   = satellite_score  >= 0.5

    n = sum([crowd_says_outage, inet_says_outage, sat_says_outage])

    # Case 1: all agree — outage
    if n == 3:
        return {
            "final_score":  max(crowd_score, inet_score, satellite_score),
            "trust_crowd":  True,
            "confidence":   "very_high",
            "note":         "All signals confirm outage",
        }

    # Case 2: all agree — normal
    if n == 0:
        return {
            "final_score":  (crowd_score + inet_score + satellite_score) / 3,
            "trust_crowd":  True,
            "confidence":   "high",
            "note":         "All signals indicate normal operation",
        }

    # Case 3: crowd says outage, passive says no → possible manipulation
    if crowd_says_outage and not inet_says_outage and not sat_says_outage:
        return {
            "final_score":  crowd_score * 0.3,
            "trust_crowd":  False,
            "confidence":   "low",
            "note": (
                "Crowd reports indicate outage but internet connectivity "
                "and satellite data show normal. Possible false reports. "
                "Monitoring."
            ),
            "flag": "possible_manipulation",
        }

    # Case 4: passive says outage, crowd says no → users offline
    if not crowd_says_outage and (inet_says_outage or sat_says_outage):
        passive_avg = (inet_score + satellite_score) / 2
        return {
            "final_score":  passive_avg,
            "trust_crowd":  False,
            "confidence":   "medium",
            "note": (
                "Passive monitoring detects outage but few crowd reports. "
                "Users may be offline."
            ),
        }

    # Case 5: 2 of 3 agree
    if n == 2:
        agreeing = []
        if crowd_says_outage:   agreeing.append(crowd_score)
        if inet_says_outage:    agreeing.append(inet_score)
        if sat_says_outage:     agreeing.append(satellite_score)
        return {
            "final_score":  sum(agreeing) / len(agreeing),
            "trust_crowd":  crowd_says_outage,
            "confidence":   "medium",
            "note":         "Majority of signals indicate outage",
        }

    # Fallback (should not reach here)
    return {
        "final_score":  (crowd_score + inet_score + satellite_score) / 3,
        "trust_crowd":  True,
        "confidence":   "low",
    }


def backfill_confirmed_by_passive(
    region: str,
    supabase_client,
    now: datetime | None = None,
    window_minutes: int = _BACKFILL_WINDOW_MIN,
) -> int:
    """
    Mark no_power reports in region as confirmed_by_passive=TRUE.
    Covers reports from the last `window_minutes` minutes.
    Uses service_role client (RLS bypassed). Returns count updated.
    """
    if now is None:
        now = datetime.now(timezone.utc)
    cutoff = (now - timedelta(minutes=window_minutes)).isoformat()

    try:
        result = (
            supabase_client
            .table("outage_reports")
            .update({"confirmed_by_passive": True})
            .eq("region", region)
            .eq("status", "no_power")
            .gte("created_at", cutoff)
            .execute()
        )
        count = len(result.data) if result.data else 0
        logger.info("backfill %s: %d reports confirmed", region, count)
        return count
    except Exception as exc:
        logger.error("backfill %s failed: %s", region, exc)
        return 0
