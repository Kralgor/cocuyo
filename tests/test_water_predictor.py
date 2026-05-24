"""Tests for pipeline/water_predictor.py"""

import pytest
from pipeline.water_predictor import predict_water_loss, WaterPrediction, REGION_PROFILES


class TestLossProbability:
    def test_zero_outage_low_probability(self):
        r = predict_water_loss(0.0, "caracas")
        assert r.loss_probability <= 0.10

    def test_spec_invariant_70pct_at_6h_default_region(self):
        """Spec 15.1: 70% of users lose water after 6h outage (default-profile zone)."""
        r = predict_water_loss(6.0, "caracas")  # caracas has base_loss=6.0
        assert abs(r.loss_probability - 0.70) < 0.02, (
            f"Expected ~0.70, got {r.loss_probability:.4f}"
        )

    def test_maracaibo_faster_loss(self):
        """Maracaibo reaches 70% loss probability at 3h, not 6h."""
        r = predict_water_loss(3.0, "maracaibo")
        assert abs(r.loss_probability - 0.70) < 0.02

    def test_long_outage_approaches_critical(self):
        # At 4× base threshold, sigmoid reaches ~0.945; capped at 0.98 above that.
        r = predict_water_loss(24.0, "caracas")
        assert r.loss_probability >= 0.93

    def test_probability_monotone(self):
        probs = [predict_water_loss(h, "caracas").loss_probability for h in range(0, 25, 2)]
        assert all(probs[i] <= probs[i + 1] for i in range(len(probs) - 1))


class TestTankLevel:
    def test_full_tank_extends_threshold(self):
        r_none = predict_water_loss(6.0, "caracas", tank_level=None)
        r_full = predict_water_loss(6.0, "caracas", tank_level="full")
        assert r_full.loss_probability < r_none.loss_probability

    def test_low_tank_shortens_threshold(self):
        r_none = predict_water_loss(4.0, "caracas", tank_level=None)
        r_low  = predict_water_loss(4.0, "caracas", tank_level="low")
        assert r_low.loss_probability > r_none.loss_probability

    def test_empty_tank_immediate_critical(self):
        r = predict_water_loss(0.0, "caracas", tank_level="empty")
        assert r.risk_level == "critical"
        assert r.loss_probability >= 0.95

    def test_unknown_tank_level_ignored(self):
        r = predict_water_loss(6.0, "caracas", tank_level="unknown_value")
        assert r.tank_level is None  # invalid -> cleared


class TestRiskLevels:
    def test_low_risk_short_outage(self):
        r = predict_water_loss(0.5, "caracas")
        assert r.risk_level == "low"

    def test_medium_risk(self):
        r = predict_water_loss(3.0, "caracas")
        assert r.risk_level == "medium"

    def test_high_risk_at_70pct(self):
        r = predict_water_loss(6.0, "caracas")
        assert r.risk_level in ("high", "critical")

    def test_critical_risk_long_outage(self):
        r = predict_water_loss(20.0, "caracas")
        assert r.risk_level == "critical"


class TestEstimatedLossHours:
    def test_eta_none_when_already_lost(self):
        # At base_loss_hours P≈0.705 > 0.70, so ETA should be None.
        r = predict_water_loss(6.0, "caracas")
        assert r.estimated_loss_hours is None or r.estimated_loss_hours < 0.01

    def test_eta_positive_before_threshold(self):
        r = predict_water_loss(1.0, "caracas")
        assert r.estimated_loss_hours is not None
        assert r.estimated_loss_hours > 0

    def test_eta_decreases_as_outage_grows(self):
        eta1 = predict_water_loss(1.0, "caracas").estimated_loss_hours
        eta2 = predict_water_loss(3.0, "caracas").estimated_loss_hours
        assert eta1 is not None and eta2 is not None
        assert eta1 > eta2


class TestAllRegions:
    def test_all_known_regions_return_valid_prediction(self):
        for region_key in REGION_PROFILES:
            r = predict_water_loss(6.0, region_key)
            assert r.risk_level in ("low", "medium", "high", "critical")
            assert 0.0 <= r.loss_probability <= 1.0

    def test_unknown_region_falls_back_to_default(self):
        r = predict_water_loss(6.0, "nonexistent_region")
        assert abs(r.loss_probability - 0.70) < 0.02
