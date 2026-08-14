"""
Adaptive per-municipio VIIRS baselines.

Each municipio's outage detection compares TODAY's observed radiance against
its OWN typical radiance — never against the state capital's baseline (a lit
rural municipio is naturally dimmer than Maracaibo; judging it against the
city baseline would permanently flag it as an outage).

Calibration: baseline = exponential moving average of the municipio's own
observations. First observation seeds the baseline (treated as a normal day,
so day one never produces a false outage). Real outages then register as a
radiance drop against the municipio's own brightness.

Persistence: baselines live in R2 (municipio_baselines.json) so they survive
across runs and accumulate a weekly history via the daily VIIRS window.
"""

from __future__ import annotations

import json
import logging
from typing import Optional

logger = logging.getLogger(__name__)

R2_KEY = "municipio_baselines.json"
EMA_ALPHA = 0.3


def _s3_client():
    import os
    import boto3  # lazy — not needed in unit tests

    return boto3.client(
        "s3",
        endpoint_url=os.environ["R2_ENDPOINT_URL"],
        aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
    )


def _r2_get(s3, key: str) -> Optional[dict]:
    try:
        obj = s3.get_object(Bucket="cocuyo", Key=key)
        body = obj["Body"].read().decode("utf-8")
        return json.loads(body)
    except Exception as exc:
        logger.debug("R2 read %s failed: %s", key, exc)
        return None


def _r2_put(s3, key: str, data: dict) -> None:
    body = json.dumps(data, separators=(",", ":"), ensure_ascii=False).encode()
    s3.put_object(
        Bucket="cocuyo",
        Key=key,
        Body=body,
        ContentType="application/json",
        CacheControl="max-age=3600",
    )


def load_baselines(s3=None) -> dict[str, float]:
    """Current per-municipio baselines: {f"{state}|{name}": radiance}.

    Best-effort: any failure (missing boto3, no creds, R2 down) returns {} —
    the municipio layer runs with self-seeding baselines instead.
    """
    try:
        client = s3 or _s3_client()
        data = _r2_get(client, R2_KEY) or {}
        baselines = data.get("baselines", {})
        return {k: float(v) for k, v in baselines.items() if float(v) > 0}
    except Exception as exc:
        logger.warning("municipio baselines load failed: %s", exc)
        return {}


def update_baselines(
    baselines: dict[str, float],
    observations: dict[str, float],
) -> dict[str, float]:
    """
    EMA-update baselines with a new night's observations (pure logic).

    Missing municipios are seeded with their first observation. Returns the
    merged baseline dict — empty observations leave baselines unchanged.
    """
    merged = dict(baselines)
    for key, observed in observations.items():
        if observed is None or observed <= 0:
            continue
        prev = merged.get(key)
        if prev is None or prev <= 0:
            merged[key] = round(observed, 2)  # seed — treat as a normal night
        else:
            merged[key] = round(EMA_ALPHA * observed + (1 - EMA_ALPHA) * prev, 2)
    return merged


def save_baselines(s3, baselines: dict[str, float]) -> None:
    """Persist baselines to R2. Best-effort — failures never break the run."""
    try:
        client = s3 or _s3_client()
        _r2_put(client, R2_KEY, {"baselines": baselines})
        logger.info("saved %d municipio baselines to R2", len(baselines))
    except Exception as exc:
        logger.warning("municipio baselines save failed: %s", exc)


def radiance_ratio(observed: float, baseline: float) -> Optional[float]:
    """observed / baseline; None when inputs are invalid."""
    if baseline is None or baseline <= 0 or observed is None or observed < 0:
        return None
    return observed / baseline
