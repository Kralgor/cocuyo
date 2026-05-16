import logging
from dataclasses import dataclass

logger = logging.getLogger(__name__)

# Cold-start fixed quorum — Phase 1 (ESTIMATED_ACTIVE_USERS empty, ADR-004)
MIN_REPORTS = 3
MIN_UNIQUE_IPS = 2


@dataclass
class QuorumResult:
    met: bool
    total_weight: float
    unique_ips: int


def compute_quorum(reports: list[dict]) -> QuorumResult:
    valid = [r for r in reports if r.get("weight", 0.0) > 0]

    if not valid:
        return QuorumResult(met=False, total_weight=0.0, unique_ips=0)

    total_weight = sum(r["weight"] for r in valid)
    unique_ips = len({r["ip_hash"] for r in valid})

    # Zone diversity check skipped when all sub_zones are null (Phase 1-2, ADR-004).
    # Sub_zones are always null in Phase 1; zone mapper ships in Phase 3.
    met = len(valid) >= MIN_REPORTS and unique_ips >= MIN_UNIQUE_IPS

    logger.debug(
        "quorum: n=%d weight=%.2f unique_ips=%d met=%s",
        len(valid), total_weight, unique_ips, met,
    )
    return QuorumResult(met=met, total_weight=total_weight, unique_ips=unique_ips)


def compute_crowd_score(reports: list[dict]) -> float:
    valid = [r for r in reports if r.get("weight", 0.0) > 0]

    if not valid:
        return 0.0

    total_weight = sum(r["weight"] for r in valid)
    no_power_weight = sum(r["weight"] for r in valid if r.get("status") == "no_power")

    quorum = compute_quorum(valid)

    if quorum.met:
        # Post-quorum: score = outage_ratio directly, no diversity multiplier (ADR-009)
        return no_power_weight / total_weight

    # Pre-quorum dampening: outage_ratio * (total_weight / MIN_REPORTS) * 0.5
    # Simplifies to: no_power_weight / MIN_REPORTS * 0.5
    return (no_power_weight / MIN_REPORTS) * 0.5
