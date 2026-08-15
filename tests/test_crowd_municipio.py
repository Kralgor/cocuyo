"""
Tests for pipeline/crowd_municipio.py — per-municipio crowd aggregation.

Reports with a parroquia resolve to a municipio; reports without one stay
region-level. Below quorum the municipio crowd signal is None (never
fabricated); above quorum the no_power share becomes the score.
"""
import pytest

from pipeline.crowd_municipio import (
    aggregate_by_municipio,
    build_crowd_by_municipio,
    municipio_crowd_signal,
    municipio_key,
)


def report(parroquia, status="no_power", ip="ip1", weight=1.0, region="caracas"):
    return {
        "region": region,
        "parroquia": parroquia,
        "status": status,
        "ip_hash": ip,
        "weight": weight,
        "lat": None,
        "lon": None,
    }


class TestMunicipioKey:
    def test_known_parroquia_resolves(self):
        assert municipio_key(report("Petare")) == ("Miranda", "Sucre (Miranda)")

    def test_missing_parroquia_is_none(self):
        assert municipio_key(report(None)) is None

    def test_unknown_parroquia_is_none(self):
        assert municipio_key(report("Lugar Inexistente")) is None

    def test_case_and_accent_insensitive(self):
        assert municipio_key(report("petare")) == ("Miranda", "Sucre (Miranda)")
        assert municipio_key(report("PETARE")) == ("Miranda", "Sucre (Miranda)")


class TestAggregateByMunicipio:
    def test_groups_reports_by_municipio(self):
        reports = {
            "caracas": [report("Petare"), report("Petare", ip="ip2"), report("El Cafetal")],
            "maracaibo": [report("San Timoteo", region="maracaibo")],
        }
        grouped = aggregate_by_municipio(reports)
        assert len(grouped[("Miranda", "Sucre (Miranda)")]) == 2
        assert len(grouped[("Miranda", "Baruta")]) == 1
        assert len(grouped[("Zulia", "Baralt (Zulia)")]) == 1

    def test_unresolvable_reports_skipped(self):
        reports = {"caracas": [report(None), report("Lugar Inexistente")]}
        assert aggregate_by_municipio(reports) == {}


class TestMunicipioCrowdSignal:
    def test_no_reports_is_none(self):
        assert municipio_crowd_signal([]) == (None, 0)

    def test_below_quorum_is_none(self):
        # 1 report, 1 ip — below MIN_REPORTS=3 / MIN_UNIQUE_IPS=2
        assert municipio_crowd_signal([report("Petare")]) == (None, 1)

    def test_above_quorum_scores_no_power_share(self):
        reports = [
            report("Petare", ip="ip1"),
            report("Petare", ip="ip2"),
            report("Petare", ip="ip3"),
        ]
        score, count = municipio_crowd_signal(reports)
        assert count == 3
        assert score == pytest.approx(1.0)  # all no_power

    def test_above_quorum_with_power_back_blends(self):
        reports = [
            report("Petare", ip="ip1"),
            report("Petare", ip="ip2", status="power_back"),
            report("Petare", ip="ip3"),
        ]
        score, count = municipio_crowd_signal(reports)
        assert count == 3
        assert score == pytest.approx(2 / 3)


class TestBuildCrowdByMunicipio:
    def test_builds_signal_map(self):
        reports = {
            "caracas": [
                report("Petare", ip="ip1"),
                report("Petare", ip="ip2"),
                report("Petare", ip="ip3"),
            ],
        }
        out = build_crowd_by_municipio(reports)
        key = ("Miranda", "Sucre (Miranda)")
        assert key in out
        assert out[key]["crowd_count"] == 3
        assert out[key]["crowd_score"] == pytest.approx(1.0)

    def test_below_quorum_recorded_without_score(self):
        reports = {"caracas": [report("Petare")]}
        out = build_crowd_by_municipio(reports)
        key = ("Miranda", "Sucre (Miranda)")
        assert out[key]["crowd_count"] == 1
        assert out[key]["crowd_score"] is None
