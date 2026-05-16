import logging
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)

# Signal weights — constant across all phases (ADR-009)
_WEIGHTS: dict[str, float] = {
    "internet":    0.35,
    "crowdsource": 0.30,
    "satellite":   0.20,
    "weather":     0.15,
}

_PASSIVE_SIGNALS = frozenset({"internet", "satellite", "weather"})


@dataclass
class RegionScore:
    current_score: float
    status: str
    signals_used: list[str] = field(default_factory=list)
    prediction_score: float | None = None   # null until Phase 4 trained model
    prediction_text: str | None = None      # null until Phase 4 trained model


def compute_region_score(
    crowd_score: float | None,
    internet_score: float | None = None,
    satellite_score: float | None = None,
    weather_score: float | None = None,
) -> RegionScore:
    signals: dict[str, float | None] = {
        "internet":    internet_score,
        "crowdsource": crowd_score,
        "satellite":   satellite_score,
        "weather":     weather_score,
    }

    available: dict[str, float] = {
        name: val for name, val in signals.items() if val is not None
    }

    if not available:
        return RegionScore(current_score=0.0, status="no_data", signals_used=[])

    # Normalize by available signal weight — absent ≠ zero (ADR-009)
    numerator   = sum(_WEIGHTS[name] * val for name, val in available.items())
    denominator = sum(_WEIGHTS[name] for name in available)
    score = numerator / denominator

    has_passive = bool(_PASSIVE_SIGNALS & available.keys())

    if not has_passive:
        # Phase 1: crowd data only — cannot cross-validate, status stays unverified
        status = "unverified_reports"
    else:
        status = _threshold_status(score)

    logger.debug("score=%.3f status=%s signals=%s", score, status, list(available))
    return RegionScore(
        current_score=score,
        status=status,
        signals_used=list(available.keys()),
    )


def _threshold_status(score: float) -> str:
    if score > 0.70:
        return "confirmed_outage"
    if score >= 0.45:
        return "likely_outage"
    if score >= 0.25:
        return "at_risk"
    return "normal"
