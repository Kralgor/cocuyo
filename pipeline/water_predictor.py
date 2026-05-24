"""
Water supply depletion predictor.

Given outage duration + region + optional user-reported tank level,
estimates probability of water loss and hours until expected depletion.

Key invariant (spec section 15.1):
  For a default-profile zone, P(water loss | outage >= 6h) = 0.70.
  Calibration constant k=1.28 derived from this constraint.
"""

import math
import logging
from dataclasses import dataclass

logger = logging.getLogger(__name__)

# ─── region profiles ──────────────────────────────────────────────────────────
# base_loss_hours: outage duration at which P(loss) reaches 0.70.
# Maracaibo: water arrives by pipe every ~20 days; no municipal pressure buffer.
# Interior/Andean cities: intermittent supply, smaller tanks.
# Capital/coastal: better baseline infrastructure.

REGION_PROFILES: dict[str, dict[str, float]] = {
    "maracaibo":         {"base_loss_hours": 3.0},
    "punto_fijo":        {"base_loss_hours": 3.5},
    "merida":            {"base_loss_hours": 4.0},
    "valera":            {"base_loss_hours": 4.0},
    "san_cristobal":     {"base_loss_hours": 4.5},
    "barquisimeto":      {"base_loss_hours": 5.0},
    "barinas":           {"base_loss_hours": 5.0},
    "cumana":            {"base_loss_hours": 5.0},
    "maturin":           {"base_loss_hours": 5.0},
    "barcelona":         {"base_loss_hours": 5.5},
    "porlamar":          {"base_loss_hours": 5.5},
    "ciudad_guayana":    {"base_loss_hours": 5.5},
    "caracas":           {"base_loss_hours": 6.0},
    "los_teques":        {"base_loss_hours": 6.0},
    "guarenas_guatire":  {"base_loss_hours": 6.0},
    "valencia":          {"base_loss_hours": 6.0},
    "maracay":           {"base_loss_hours": 6.0},
}

DEFAULT_BASE_LOSS_HOURS = 6.0

# Tank level multipliers applied to base_loss_hours.
TANK_LEVEL_MULT: dict[str, float] = {
    "full":  1.5,
    "half":  1.0,
    "low":   0.5,
    "empty": 0.0,
}

# Calibration constant: ensures P(outage=base_loss_hours) ≈ 0.705.
# Derived: 0.705 = 0.05 + 0.90*(1 - e^(-k)) → k = -ln(1 - 0.655/0.90) ≈ 1.30
# Slightly above 0.70 to keep P(base) strictly in the "high" risk band.
_K = 1.30


@dataclass
class WaterPrediction:
    region_key:          str
    outage_hours:        float
    tank_level:          str | None
    loss_probability:    float          # 0.0–1.0
    risk_level:          str            # "low" | "medium" | "high" | "critical"
    estimated_loss_hours: float | None  # hours from now until expected loss; None if already lost


def _base_loss_hours(region_key: str, tank_level: str | None) -> float:
    profile = REGION_PROFILES.get(region_key, {"base_loss_hours": DEFAULT_BASE_LOSS_HOURS})
    base = profile["base_loss_hours"]
    if tank_level is not None:
        mult = TANK_LEVEL_MULT.get(tank_level, 1.0)
        base = base * mult
    return base


def _loss_probability(outage_hours: float, base: float) -> float:
    """Sigmoid probability of water loss. P(base) = 0.70 by construction."""
    if base <= 0:
        return 0.98
    if outage_hours <= 0:
        return 0.05
    t = outage_hours / base
    return min(0.98, 0.05 + 0.90 * (1.0 - math.exp(-_K * t)))


def _risk_level(prob: float) -> str:
    if prob >= 0.85:
        return "critical"
    if prob >= 0.70:
        return "high"
    if prob >= 0.40:
        return "medium"
    return "low"


def _hours_until_loss(outage_hours: float, base: float) -> float | None:
    """Hours from now until P(loss) reaches 0.70. None if already there."""
    target_prob = 0.70
    current = _loss_probability(outage_hours, base)
    if current >= target_prob:
        return None
    # Invert: t_target = -ln(1 - (0.70 - 0.05)/0.90) / k * base
    # Then hours_remaining = t_target * base - outage_hours
    t_target = -math.log(1.0 - (target_prob - 0.05) / 0.90) / _K
    target_outage_hours = t_target * base
    return max(0.0, target_outage_hours - outage_hours)


def predict_water_loss(
    outage_hours: float,
    region_key: str,
    tank_level: str | None = None,
) -> WaterPrediction:
    """
    Predict water depletion risk given outage duration.

    Args:
        outage_hours: hours since power was lost
        region_key:   canonical region identifier from regions.py
        tank_level:   user-reported level: "full"|"half"|"low"|"empty"|None

    Returns:
        WaterPrediction with probability, risk level, and ETA to loss
    """
    if tank_level is not None and tank_level not in TANK_LEVEL_MULT:
        logger.warning("Unknown tank_level=%r, ignoring", tank_level)
        tank_level = None

    base = _base_loss_hours(region_key, tank_level)
    prob = _loss_probability(outage_hours, base)
    risk = _risk_level(prob)
    eta  = _hours_until_loss(outage_hours, base)

    logger.debug(
        "water_predict region=%s outage=%.1fh tank=%s base=%.1fh prob=%.2f risk=%s eta=%s",
        region_key, outage_hours, tank_level, base, prob, risk,
        f"{eta:.1f}h" if eta is not None else "now",
    )

    return WaterPrediction(
        region_key=region_key,
        outage_hours=outage_hours,
        tank_level=tank_level,
        loss_probability=prob,
        risk_level=risk,
        estimated_loss_hours=eta,
    )
