"""
Calibration — weekly update of estimated active users per region.

Counts distinct ip_hash reporters over 30 days, multiplies by DEFAULT_MULTIPLIER
(1 reporter ≈ 10 viewers) to estimate total active user base.
Feeds quorum threshold: more users → higher bar to trust crowd signal.
"""
import logging
from collections import defaultdict
from datetime import datetime, timedelta, timezone

logger = logging.getLogger(__name__)

DEFAULT_MULTIPLIER = 10   # 1 reporter per ~10 viewers (conservative estimate)
_WINDOW_DAYS = 30


def recalibrate_active_users(
    client,
    now: datetime | None = None,
    multiplier: int = DEFAULT_MULTIPLIER,
) -> dict[str, int]:
    """
    Return estimated active users per region from Supabase analytics.

    Queries outage_reports for last 30 days, counts distinct ip_hash per region,
    multiplies by multiplier. Keyed by region string.
    """
    if now is None:
        now = datetime.now(timezone.utc)

    cutoff = (now - timedelta(days=_WINDOW_DAYS)).isoformat()

    try:
        result = (
            client.table("outage_reports")
            .select("region,ip_hash")
            .gte("created_at", cutoff)
            .execute()
        )
        rows = result.data or []
    except Exception as exc:
        logger.error("calibration query failed: %s", exc)
        return {}

    # Count distinct ip_hash per region in Python
    unique_ips: dict[str, set] = defaultdict(set)
    for row in rows:
        region  = row.get("region")
        ip_hash = row.get("ip_hash")
        if region and ip_hash:
            unique_ips[region].add(ip_hash)

    return {
        region: len(ips) * multiplier
        for region, ips in unique_ips.items()
    }
