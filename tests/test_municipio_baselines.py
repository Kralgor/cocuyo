"""
Tests for pipeline/municipio_baselines.py — adaptive per-municipio baselines.

The core independence guarantee: each municipio's outage detection uses its
OWN radiance history, never the state capital's baseline. Day one seeds the
baseline (no false outage); later drops register against the municipio's own
typical brightness.
"""
import pytest

from pipeline.municipio_baselines import (
    EMA_ALPHA,
    update_baselines,
    radiance_ratio,
)


class TestUpdateBaselines:
    def test_first_observation_seeds_baseline(self):
        """Day one: a lit rural municipio seeds its own (dim) baseline —
        no false outage, because its ratio starts at ~1.0."""
        baselines = {}
        updated = update_baselines(baselines, {"Guárico|Las Mercedes": 2.5})
        assert updated["Guárico|Las Mercedes"] == pytest.approx(2.5)

    def test_lit_rural_municipio_ratio_is_normal(self):
        """The key independence property: a small town's ratio is computed
        against ITS OWN dim baseline, not the state capital's bright one."""
        baselines = {"Guárico|Las Mercedes": 2.5}
        updated = update_baselines(baselines, {"Guárico|Las Mercedes": 2.4})
        ratio = radiance_ratio(2.4, updated["Guárico|Las Mercedes"])
        assert ratio == pytest.approx(0.97, abs=0.01)  # normal night, no outage

    def test_real_outage_drops_ratio(self):
        baselines = {"Guárico|Las Mercedes": 2.5}
        ratio = radiance_ratio(0.4, baselines["Guárico|Las Mercedes"])
        assert ratio == pytest.approx(0.16)  # lights mostly out

    def test_ema_update_smooths_noise(self):
        baselines = {"Zulia|Maracaibo": 30.0}
        updated = update_baselines(baselines, {"Zulia|Maracaibo": 34.0})
        expected = EMA_ALPHA * 34.0 + (1 - EMA_ALPHA) * 30.0
        assert updated["Zulia|Maracaibo"] == pytest.approx(expected)

    def test_unknown_municipios_left_alone(self):
        baselines = {"Zulia|Maracaibo": 30.0}
        updated = update_baselines(baselines, {"Táchira|San Cristóbal": 12.0})
        assert updated["Zulia|Maracaibo"] == pytest.approx(30.0)
        assert updated["Táchira|San Cristóbal"] == pytest.approx(12.0)

    def test_empty_observations_unchanged(self):
        baselines = {"Zulia|Maracaibo": 30.0}
        assert update_baselines(baselines, {}) == baselines

    def test_none_and_negative_observations_ignored(self):
        baselines = {}
        updated = update_baselines(baselines, {
            "Zulia|Maracaibo": None,
            "Zulia|Cabimas": -5,
        })
        assert updated == {}


class TestRadianceRatio:
    def test_valid_ratio(self):
        assert radiance_ratio(15.0, 30.0) == pytest.approx(0.5)

    def test_zero_baseline_returns_none(self):
        assert radiance_ratio(15.0, 0) is None

    def test_negative_observed_returns_none(self):
        assert radiance_ratio(-1.0, 30.0) is None
