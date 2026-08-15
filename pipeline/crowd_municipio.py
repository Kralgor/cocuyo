"""
Per-municipio crowd aggregation.

Reports carry an optional parroquia (the mobile/web cascading pickers send
it). Each report with a parroquia is mapped to its municipio via
pipeline/parroquias.lookup_municipio; reports without parroquia (or from
states the dataset doesn't cover) stay region-level — nothing is lost, they
just don't get municipio granularity.

Per-municipio crowd signal: same quorum discipline as regions — below
quorum the signal is None (absent != no reports); above quorum the score
is the no_power share of validated report weight.
"""

from __future__ import annotations

import logging
from typing import Optional

from pipeline.parroquias import lookup_municipio
from pipeline.quorum import compute_crowd_score, compute_quorum

logger = logging.getLogger(__name__)


def municipio_key(report: dict) -> tuple[str, str] | None:
    """(state, municipio) for a report with a resolvable parroquia, else None."""
    parroquia = report.get("parroquia")
    if not parroquia:
        return None
    return lookup_municipio(str(parroquia))


def aggregate_by_municipio(
    reports_by_region: dict[str, list[dict]],
    validator=None,
    now=None,
) -> dict[tuple[str, str], list[dict]]:
    """
    Group validated reports by municipio.

    Each report keeps its assigned weight; reports that don't resolve to a
    municipio are skipped (region-level path already handles them).
    """
    out: dict[tuple[str, str], list[dict]] = {}
    for region_reports in reports_by_region.values():
        for report in region_reports:
            key = municipio_key(report)
            if key is None:
                continue
            scored = report
            if validator is not None:
                result = validator.validate(report, [report], now=now)
                if not result.accepted:
                    continue
                scored = {**report, "weight": result.weight}
            out.setdefault(key, []).append(scored)
    return out


def municipio_crowd_signal(
    reports: list[dict],
) -> tuple[Optional[float], int]:
    """
    (crowd_score, count) for a municipio's reports.

    Below quorum -> (None, count): the signal is absent, never fabricated.
    Above quorum -> (compute_crowd_score, count).
    """
    if not reports:
        return None, 0
    quorum = compute_quorum(reports)
    if not quorum.met:
        return None, len(reports)
    return compute_crowd_score(reports), len(reports)


def build_crowd_by_municipio(
    reports_by_region: dict[str, list[dict]],
    validator=None,
    now=None,
) -> dict[tuple[str, str], dict]:
    """
    {(state, municipio): {"crowd_score": float|None, "crowd_count": int}}
    for every municipio that received reports in the window.
    """
    grouped = aggregate_by_municipio(reports_by_region, validator, now)
    out: dict[tuple[str, str], dict] = {}
    for key, reports in grouped.items():
        score, count = municipio_crowd_signal(reports)
        out[key] = {"crowd_score": score, "crowd_count": count}
    return out
