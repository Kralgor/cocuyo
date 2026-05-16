import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any

from pipeline.regions import VE_LAT_MIN, VE_LAT_MAX, VE_LON_MIN, VE_LON_MAX

logger = logging.getLogger(__name__)

_RATE_WINDOW_MIN = 30
_RATE_SOFT_LIMIT = 3
_RATE_HARD_LIMIT = 6
_GPS_ABSENT_WEIGHT = 0.7
_CONTRADICTION_MIN_REPORTS = 5
_CONTRADICTION_THRESHOLD = 0.70

# Only no_power ↔ power_back are direct opposites; unstable has no opposite.
_OPPOSITE: dict[str, str] = {"no_power": "power_back", "power_back": "no_power"}


@dataclass
class ValidationResult:
    accepted: bool
    weight: float
    rejection_reason: str | None
    flags: list[str] = field(default_factory=list)


class ReportValidator:
    def validate(
        self,
        report: dict[str, Any],
        recent_reports: list[dict[str, Any]],
        now: datetime | None = None,
    ) -> ValidationResult:
        if now is None:
            now = datetime.now(timezone.utc)

        weight = 1.0
        flags: list[str] = []

        # Check 1: IP rate limiting
        ip_ok, ip_flag = self._check_ip_rate(report, recent_reports, now)
        if not ip_ok:
            return ValidationResult(
                accepted=False,
                weight=0.0,
                rejection_reason="ip_rate_exceeded",
                flags=["ip_rate_exceeded"],
            )
        if ip_flag:
            flags.append(ip_flag)

        # Check 2: geo consistency (bounding box + GPS-absent penalty)
        geo_ok, weight_mod, geo_flag = self._check_geo_consistency(report)
        if not geo_ok:
            return ValidationResult(
                accepted=False,
                weight=0.0,
                rejection_reason="geo_outside_venezuela",
                flags=["geo_outside_venezuela"],
            )
        weight *= weight_mod
        if geo_flag:
            flags.append(geo_flag)

        # Check 3: contradiction vs regional consensus
        contradiction_flag = self._check_contradiction(report, recent_reports, now)
        if contradiction_flag:
            flags.append(contradiction_flag)

        # Device fingerprint: deferred to Phase 4 per ADR-005.
        # TODO: implement _check_device_fingerprint when Phase 4 stability
        # analysis of CANTV network fingerprints is complete (ADR-005).
        _ = self._check_device_fingerprint(report)

        logger.debug("report validated weight=%.2f flags=%s", weight, flags)
        return ValidationResult(
            accepted=True,
            weight=weight,
            rejection_reason=None,
            flags=flags,
        )

    def _check_ip_rate(
        self,
        report: dict[str, Any],
        recent_reports: list[dict[str, Any]],
        now: datetime,
    ) -> tuple[bool, str | None]:
        cutoff = now - timedelta(minutes=_RATE_WINDOW_MIN)
        same_ip_count = sum(
            1
            for r in recent_reports
            if r.get("ip_hash") == report.get("ip_hash")
            and _parse_ts(r["created_at"]) > cutoff
        )
        if same_ip_count >= _RATE_HARD_LIMIT:
            return False, None
        if same_ip_count >= _RATE_SOFT_LIMIT:
            return True, "ip_rate_soft_limit"
        return True, None

    def _check_geo_consistency(
        self,
        report: dict[str, Any],
    ) -> tuple[bool, float, str | None]:
        lat = report.get("lat")
        lon = report.get("lon")

        if lat is None or lon is None:
            # GPS absence lowers trust but never blocks the report (ADR-006).
            return True, _GPS_ABSENT_WEIGHT, "gps_absent"

        inside = (
            VE_LAT_MIN <= lat <= VE_LAT_MAX
            and VE_LON_MIN <= lon <= VE_LON_MAX
        )
        if not inside:
            return False, 0.0, None

        return True, 1.0, None

    def _check_contradiction(
        self,
        report: dict[str, Any],
        recent_reports: list[dict[str, Any]],
        now: datetime,
    ) -> str | None:
        status = report.get("status")
        opposite = _OPPOSITE.get(status)  # type: ignore[arg-type]
        if opposite is None:
            return None  # "unstable" has no direct opposite

        cutoff = now - timedelta(minutes=_RATE_WINDOW_MIN)
        region = report.get("region")
        regional = [
            r for r in recent_reports
            if r.get("region") == region
            and _parse_ts(r["created_at"]) > cutoff
        ]

        if len(regional) < _CONTRADICTION_MIN_REPORTS:
            return None

        opposite_ratio = sum(
            1 for r in regional if r.get("status") == opposite
        ) / len(regional)

        return "contradiction_vs_consensus" if opposite_ratio >= _CONTRADICTION_THRESHOLD else None

    def _check_device_fingerprint(self, report: dict[str, Any]) -> str | None:
        # TODO: implement device fingerprint rate limiting in Phase 4.
        # Deferred pending stability analysis on Venezuelan CANTV network (ADR-005).
        return None


def _parse_ts(value: datetime | str) -> datetime:
    """Accept either a datetime object or an ISO-8601 string."""
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    return datetime.fromisoformat(value.replace("Z", "+00:00"))
