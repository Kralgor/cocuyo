"""
Bajones (voltage instability) wave detector.

Aggregates 'unstable' crowd reports per region within a sliding time window.
An "instability wave" is declared when >5 reports arrive in 15 minutes,
indicating a pre-outage voltage degradation event.

Spec section 15.5.
"""

import logging
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

logger = logging.getLogger(__name__)

WAVE_THRESHOLD    = 5   # reports needed to declare a wave (exclusive: >5 means >=6)
WINDOW_MINUTES    = 15  # rolling window size

# Severity bands (unstable report count in window)
_SEV_MILD     = (6,  10)
_SEV_MODERATE = (11, 20)
# severe: 21+


@dataclass
class BajonReport:
    region:    str
    timestamp: datetime


@dataclass
class WaveDetection:
    region:               str
    wave_detected:        bool
    unstable_count_15min: int
    severity:             str | None   # "mild" | "moderate" | "severe" | None
    window_start:         datetime


def _severity(count: int) -> str | None:
    if count <= WAVE_THRESHOLD:
        return None
    if count <= _SEV_MILD[1]:
        return "mild"
    if count <= _SEV_MODERATE[1]:
        return "moderate"
    return "severe"


def detect_waves(
    reports: list[BajonReport],
    reference_time: datetime | None = None,
    window_minutes: int = WINDOW_MINUTES,
    threshold: int = WAVE_THRESHOLD,
) -> dict[str, WaveDetection]:
    """
    Detect instability waves per region.

    Args:
        reports:        List of BajonReport with region + timestamp.
                        Only reports with status='unstable' should be passed.
        reference_time: End of the window (default: now UTC).
        window_minutes: Rolling window size in minutes.
        threshold:      Minimum report count to declare a wave (exclusive).

    Returns:
        Dict mapping region_key → WaveDetection.
        Only regions present in input are included.
    """
    if reference_time is None:
        reference_time = datetime.now(tz=timezone.utc)

    cutoff = reference_time - timedelta(minutes=window_minutes)

    # group reports in window by region
    counts: dict[str, int] = {}
    for r in reports:
        ts = r.timestamp
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
        if ts >= cutoff:
            counts[r.region] = counts.get(r.region, 0) + 1

    # build detections for every region seen in input
    all_regions = {r.region for r in reports}
    result: dict[str, WaveDetection] = {}

    for region in all_regions:
        count = counts.get(region, 0)
        detected = count > threshold
        result[region] = WaveDetection(
            region=region,
            wave_detected=detected,
            unstable_count_15min=count,
            severity=_severity(count),
            window_start=cutoff,
        )
        if detected:
            logger.info(
                "bajon_wave region=%s count=%d severity=%s",
                region, count, _severity(count),
            )

    return result
