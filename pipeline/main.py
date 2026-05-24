"""
Cocuyo pipeline entry point — Phase 2.

Flow:
  Phase 1: crowd reports → validate → score → status.json → R2
  Phase 2: + internet (IODA/CF) + satellite (VIIRS) + weather → cross-validate

Exit codes:
  0 — success or collector failure (logged, pipeline continues)
  1 — R2 upload failure (total system failure, GitHub Actions emails on this)

Environment variables:
  SUPABASE_URL               — required
  SUPABASE_SERVICE_ROLE_KEY  — required (server-side only, never in frontend)
  R2_ENDPOINT_URL            — required for upload
  R2_ACCESS_KEY_ID           — required for upload
  R2_SECRET_ACCESS_KEY       — required for upload
  CF_API_TOKEN               — required for Phase 2 Cloudflare Radar
  NASA_TOKEN                 — required for Phase 2 VIIRS
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

from pipeline.cross_validation import backfill_confirmed_by_passive, cross_validate
from pipeline.outage_lifecycle import process_lifecycle
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

def _create_supabase_client():
    from supabase import create_client  # lazy — not needed in tests
    return create_client(
        os.environ["SUPABASE_URL"],
        os.environ["SUPABASE_SERVICE_ROLE_KEY"],
    )


def _fetch_all_recent_reports(now: datetime, client=None) -> dict[str, list[dict]]:
    """
    Pull all crowd reports from last 30 min in one query.
    Keyed by canonical region (unknown regions discarded).
    One collector — caller increments collector_errors on failure.
    """
    if client is None:
        client = _create_supabase_client()
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


def _fetch_passive_signals(now: datetime) -> tuple[float | None, dict, dict, int]:
    """
    Collect Phase 2 passive signals. Returns (internet_score, viirs, weather, errors).
    Each collector isolated — failure increments errors, others continue.
    """
    from pipeline.collector_internet_unified import collect_all_internet_signals
    from pipeline.collector_viirs import fetch_latest_viirs
    from pipeline.collector_weather import fetch_weather_stress

    errors = 0
    internet_score: float | None = None
    viirs_data:  dict = {}
    weather_data: dict = {}

    try:
        result = collect_all_internet_signals(now=now)
        internet_score = result["classification"].get("internet_score")
        logger.info("internet collector: situation=%s score=%s",
                    result["classification"].get("situation"), internet_score)
    except Exception as exc:
        logger.error("internet collector failed: %s", exc)
        errors += 1

    try:
        viirs_data = fetch_latest_viirs()
        logger.info("VIIRS collector: %d regions with data", len(viirs_data))
    except Exception as exc:
        logger.error("VIIRS collector failed: %s", exc)
        errors += 1

    try:
        weather_data = fetch_weather_stress()
        logger.info("weather collector: %d cities", len(weather_data))
    except Exception as exc:
        logger.error("weather collector failed: %s", exc)
        errors += 1

    return internet_score, viirs_data, weather_data, errors


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
    s3.put_bucket_cors(
        Bucket="cocuyo",
        CORSConfiguration={
            "CORSRules": [{
                "AllowedOrigins": ["https://app.cocuyo.kralgor.com"],
                "AllowedMethods": ["GET", "HEAD"],
                "AllowedHeaders": ["*"],
                "MaxAgeSeconds": 3600,
            }]
        },
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
    internet_score: float | None = None,
    satellite_score: float | None = None,
    weather_score: float | None = None,
    supabase_client=None,
) -> dict:
    """Validate crowd reports, blend with passive signals, cross-validate."""
    scored: list[dict] = []
    for report in raw_reports:
        result = validator.validate(report, raw_reports, now=now)
        if result.accepted:
            scored.append({
                "status":   report["status"],
                "weight":   result.weight,
                "ip_hash":  report.get("ip_hash"),
                "sub_zone": report.get("sub_zone"),
            })

    crowd_reports_count = len(scored)
    crowd_score_val: float | None = compute_crowd_score(scored) if scored else None

    region_score = compute_region_score(
        crowd_score=crowd_score_val,
        internet_score=internet_score,
        satellite_score=satellite_score,
        weather_score=weather_score,
    )

    has_passive = any(s is not None for s in (internet_score, satellite_score, weather_score))

    if has_passive:
        cv = cross_validate(
            region=region_key,
            crowd_score=crowd_score_val or 0.0,
            crowd_confidence="medium",
            inet_score=internet_score,
            satellite_score=satellite_score,
        )
        final_score: float | None = cv["final_score"]
        # Passive confirms outage → backfill matching no_power reports
        if (
            supabase_client is not None
            and final_score is not None
            and final_score >= 0.5
            and "flag" not in cv
        ):
            backfill_confirmed_by_passive(region_key, supabase_client, now=now)
    else:
        final_score = None

    # current_score: null when no passive validation or status is crowd-only
    current_score = (
        final_score
        if has_passive and region_score.status not in ("no_data",)
        else None
    )

    logger.info(
        "region=%s status=%s crowd=%s passive_score=%s reports=%d",
        region_key,
        region_score.status,
        f"{crowd_score_val:.3f}" if crowd_score_val is not None else "None",
        f"{final_score:.3f}" if final_score is not None else "None",
        crowd_reports_count,
    )

    return {
        "display_name":        REGIONS[region_key]["display_name"],
        "current_score":       current_score,
        "prediction_score":    None,
        "status":              region_score.status,
        "signals": {
            "internet":    internet_score,
            "satellite":   satellite_score,
            "crowdsource": crowd_score_val,
            "weather":     weather_score,
        },
        "crowd_reports_30min": crowd_reports_count,
        "prediction_text":     None,
        "rationing_pattern":   _RATIONING_PATTERNS.get(region_key),
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
    Execute one pipeline cycle. Returns status.json dict.
    Separated from main() so tests can call directly with injected data.
    """
    if now is None:
        now = datetime.now(timezone.utc)

    phase = int(os.getenv("COCUYO_PHASE") or "1")
    collector_errors = 0
    validator = ReportValidator()

    # Crowd reports — one Supabase query for all regions
    raw_by_region: dict[str, list[dict]] = {k: [] for k in REGIONS}
    supabase_client = None
    try:
        supabase_client = _create_supabase_client()
        raw_by_region = _fetch_all_recent_reports(now, client=supabase_client)
        total = sum(len(v) for v in raw_by_region.values())
        logger.info("crowd collector: %d reports across %d regions", total, len(REGIONS))
    except Exception as exc:
        logger.error("crowd collector failed: %s", exc)
        collector_errors += 1

    # Phase 2: passive signals
    internet_score: float | None = None
    viirs_data:  dict = {}
    weather_data: dict = {}

    if phase >= 2:
        inet_score, viirs_data, weather_data, passive_errors = _fetch_passive_signals(now)
        internet_score    = inet_score
        collector_errors += passive_errors

    # Score all 17 regions
    region_output: dict[str, dict] = {}
    for region_key in REGIONS:
        sat_score = viirs_data.get(region_key, {}).get("score")
        wx_score  = weather_data.get(region_key, {}).get("weather_score")
        region_output[region_key] = score_region(
            region_key,
            raw_by_region.get(region_key, []),
            validator,
            now,
            internet_score=internet_score if phase >= 2 else None,
            satellite_score=sat_score,
            weather_score=wx_score,
            supabase_client=supabase_client if phase >= 2 else None,
        )

    if phase >= 2 and supabase_client is not None:
        try:
            process_lifecycle(region_output, now, supabase_client)
        except Exception as exc:
            logger.error("lifecycle failed: %s", exc)

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
