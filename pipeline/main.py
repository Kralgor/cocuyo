"""
Cocuyo pipeline entry point — Phase 1 skeleton.

Flow: crowd reports (Supabase) → validate → score → status.json → R2 upload.

Exit codes:
  0 — success or collector failure (logged, pipeline continues)
  1 — R2 upload failure (total system failure, GitHub Actions emails on this)

Environment variables:
  SUPABASE_URL               — required
  SUPABASE_SERVICE_ROLE_KEY  — required (server-side only, never in frontend)
  R2_ENDPOINT_URL            — required for upload
  R2_ACCESS_KEY_ID           — required for upload
  R2_SECRET_ACCESS_KEY       — required for upload
  COCUYO_PHASE               — integer, default 1
  COCUYO_DRY_RUN             — set to "1" to skip R2 upload (local testing)
  STATUS_JSON_PATH           — output path for status.json, default "status.json"
"""

import json
import logging
import os
import sys
from datetime import datetime, timedelta, timezone
from typing import Any

from pipeline.quorum import compute_crowd_score, compute_quorum
from pipeline.regions import REGIONS
from pipeline.scorer import compute_region_score
from pipeline.validation import ReportValidator

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

_REPORT_WINDOW_MIN = 30
_UPDATE_INTERVAL_MIN = 10  # Phase 1 cadence

# Static rationing patterns — seed data, manually updated.
# Source: CONTEXT.md "Known Rationing Patterns" section.
# Regions without documented schedules are absent (not shown as "no rationing").
_RATIONING_PATTERNS: dict[str, dict[str, Any]] = {
    "maracaibo": {
        "description": "Every other day (interdiario), 2-6h, usually after 1pm",
        "frequency": "interdiario",
        "typical_start_hour": 13,
        "typical_duration_hours": "2-6",
    },
    "san_cristobal": {
        "description": "Daily, 3-4 blocks totaling 10-12h, starts ~10am",
        "frequency": "daily",
        "typical_start_hour": 10,
        "typical_duration_hours": "10-12",
    },
    "merida": {
        "description": "Daily, 3-7h, starts ~noon",
        "frequency": "daily",
        "typical_start_hour": 12,
        "typical_duration_hours": "3-7",
    },
    "barquisimeto": {
        "description": "3-4 times per week, 2-5h, after 2pm",
        "frequency": "3-4x/week",
        "typical_start_hour": 14,
        "typical_duration_hours": "2-5",
    },
}


# ── Supabase ──────────────────────────────────────────────────────────────────

def _fetch_all_recent_reports(now: datetime) -> dict[str, list[dict]]:
    """
    Pull all crowd reports from the last 30 minutes in one query.
    Returns a dict keyed by canonical region (unknown regions discarded).
    Counts as ONE collector — caller sets collector_errors += 1 on any failure.
    """
    from supabase import create_client  # lazy import — not needed in tests

    client = create_client(
        os.environ["SUPABASE_URL"],
        os.environ["SUPABASE_SERVICE_ROLE_KEY"],
    )
    cutoff = (now - timedelta(minutes=_REPORT_WINDOW_MIN)).isoformat()
    response = (
        client.table("outage_reports")
        .select("region,status,ip_hash,lat,lon,created_at,sub_zone,device_fingerprint")
        .gte("created_at", cutoff)
        .execute()
    )
    by_region: dict[str, list[dict]] = {k: [] for k in REGIONS}
    for report in (response.data or []):
        region = report.get("region")
        if region in by_region:
            by_region[region].append(report)
    return by_region


# ── R2 upload ─────────────────────────────────────────────────────────────────

def _upload_to_r2(payload: dict) -> None:
    import boto3  # lazy import — not needed in tests

    body = json.dumps(payload, separators=(",", ":"), ensure_ascii=False).encode()
    s3 = boto3.client(
        "s3",
        endpoint_url=os.environ["R2_ENDPOINT_URL"],
        aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
    )
    s3.put_object(
        Bucket="cocuyo",
        Key="status.json",
        Body=body,
        ContentType="application/json",
        CacheControl="max-age=60, s-maxage=300",
    )
    logger.info("uploaded status.json to R2 (%d bytes)", len(body))


# ── per-region pipeline ───────────────────────────────────────────────────────

def score_region(
    region_key: str,
    raw_reports: list[dict],
    validator: ReportValidator,
    now: datetime,
) -> dict:
    """Validate reports, compute crowd score, build region entry for status.json."""
    # Validate and collect accepted reports with their weights
    scored: list[dict] = []
    for report in raw_reports:
        result = validator.validate(report, raw_reports, now=now)
        if result.accepted:
            scored.append({
                "status": report["status"],
                "weight": result.weight,
                "ip_hash": report.get("ip_hash"),
                "sub_zone": report.get("sub_zone"),
            })

    crowd_reports_count = len(scored)

    # crowd_score is None when no valid reports — scorer returns "no_data"
    crowd_score_val: float | None = compute_crowd_score(scored) if scored else None

    region_score = compute_region_score(crowd_score=crowd_score_val)

    # current_score is null in Phase 1 (no passive cross-validation).
    # Raw crowd signal is surfaced in signals.crowdsource instead.
    current_score = (
        None
        if region_score.status in ("no_data", "unverified_reports")
        else region_score.current_score
    )

    logger.info(
        "region=%s status=%s crowd_score=%s reports=%d signals=%s",
        region_key,
        region_score.status,
        f"{crowd_score_val:.3f}" if crowd_score_val is not None else "None",
        crowd_reports_count,
        region_score.signals_used,
    )

    return {
        "display_name": REGIONS[region_key]["display_name"],
        "current_score": current_score,
        "prediction_score": None,
        "status": region_score.status,
        "signals": {
            "internet":    None,
            "satellite":   None,
            "crowdsource": crowd_score_val,
            "weather":     None,
        },
        "crowd_reports_30min": crowd_reports_count,
        "prediction_text": None,
        "rationing_pattern": _RATIONING_PATTERNS.get(region_key),
    }


# ── main ──────────────────────────────────────────────────────────────────────

def build_status_json(
    now: datetime,
    phase: int,
    collector_errors: int,
    regions: dict[str, dict],
) -> dict:
    next_update = now + timedelta(minutes=_UPDATE_INTERVAL_MIN)
    return {
        "updated_at":         now.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "phase":              phase,
        "scheduler":          "github-actions",
        "next_update_approx": next_update.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "collector_errors":   collector_errors,
        "regions":            regions,
    }


def run(now: datetime | None = None) -> dict:
    """
    Execute one pipeline cycle. Returns the status.json dict.
    Separated from main() so tests can call it directly with injected reports.
    """
    if now is None:
        now = datetime.now(timezone.utc)

    phase = int(os.getenv("COCUYO_PHASE", "1"))
    collector_errors = 0
    validator = ReportValidator()

    # Collect crowd reports — one query for all regions (one collector)
    raw_by_region: dict[str, list[dict]] = {k: [] for k in REGIONS}
    try:
        raw_by_region = _fetch_all_recent_reports(now)
        total = sum(len(v) for v in raw_by_region.values())
        logger.info("crowd collector: fetched %d reports across %d regions", total, len(REGIONS))
    except Exception as exc:
        logger.error("crowd collector failed: %s", exc)
        collector_errors += 1

    # Score all 17 regions
    region_output: dict[str, dict] = {}
    for region_key in REGIONS:
        region_output[region_key] = score_region(
            region_key,
            raw_by_region.get(region_key, []),
            validator,
            now,
        )

    return build_status_json(now, phase, collector_errors, region_output)


def main() -> None:
    dry_run = os.getenv("COCUYO_DRY_RUN", "0") == "1"
    now = datetime.now(timezone.utc)

    status_doc = run(now=now)

    # Write status.json locally
    output_path = os.getenv("STATUS_JSON_PATH", "status.json")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(status_doc, f, indent=2, ensure_ascii=False)
    logger.info("wrote %s", output_path)

    if dry_run:
        logger.info("dry run — skipping R2 upload")
        return

    try:
        _upload_to_r2(status_doc)
    except Exception as exc:
        logger.error("R2 upload failed: %s", exc)
        sys.exit(1)


if __name__ == "__main__":
    main()
