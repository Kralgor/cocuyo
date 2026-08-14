"""
Tests for pipeline/municipio_status.py — per-municipio status computation.

Covers the pure logic: state→region attribution, own-satellite override,
region-less states, aggregate state status, and payload shape.
"""
import pytest

from pipeline.municipio_status import (
    aggregate_state_status,
    build_municipios_payload,
    derive_municipio_entry,
    region_for_state,
)

# ── fixtures ───────────────────────────────────────────────────────────────────

ZULIA_REGION = {
    "display_name": "Maracaibo (Zulia)",
    "current_score": 0.8,
    "status": "no_power",
    "signals": {
        "internet": 0.7,
        "satellite": 0.9,
        "crowdsource": 0.75,
        "weather": 0.3,
    },
}

CARABOBO_REGION = {
    "display_name": "Valencia (Carabobo)",
    "current_score": 0.1,
    "status": "normal",
    "signals": {
        "internet": 0.05,
        "satellite": 0.1,
        "crowdsource": 0.02,
        "weather": 0.1,
    },
}

VALENCIA_MUNI = {"name": "Valencia", "lat": 10.17003, "lon": -68.0004}


# ── state → region mapping ────────────────────────────────────────────────────

class TestRegionForState:
    def test_state_with_region_maps_to_region_key(self):
        assert region_for_state("Zulia") == "maracaibo"
        assert region_for_state("Carabobo") == "valencia"

    def test_miranda_maps_to_first_region(self):
        assert region_for_state("Miranda") == "los_teques"

    def test_state_without_region_returns_none(self):
        assert region_for_state("Amazonas") is None
        assert region_for_state("Apure") is None


# ── derive_municipio_entry ────────────────────────────────────────────────────

class TestDeriveMunicipioEntry:
    def test_region_attribution_without_own_satellite(self):
        entry = derive_municipio_entry(VALENCIA_MUNI, CARABOBO_REGION, None)
        assert entry["name"] == "Valencia"
        assert entry["signals"]["internet"] == pytest.approx(0.05)
        assert entry["signals"]["crowdsource"] == pytest.approx(0.02)
        assert entry["signals"]["weather"] == pytest.approx(0.1)
        # derive() keeps satellite as passed — the region fallback happens
        # in build_municipios_payload (tested there)
        assert entry["signals"]["satellite"] is None
        assert entry["status"] == "normal"

    def test_own_satellite_outage_dominates_quiet_region(self):
        # 0.95 = VIIRS major-outage classification; must not be diluted to
        # "normal" by the region's quiet signals (the v1 dominance rule).
        entry = derive_municipio_entry(VALENCIA_MUNI, CARABOBO_REGION, 0.95)
        assert entry["signals"]["satellite"] == pytest.approx(0.95)
        assert entry["status"] == "confirmed_outage"

    def test_own_satellite_partial_outage_is_likely(self):
        entry = derive_municipio_entry(VALENCIA_MUNI, CARABOBO_REGION, 0.65)
        assert entry["status"] == "likely_outage"

    def test_own_satellite_normal_keeps_blend_status(self):
        entry = derive_municipio_entry(VALENCIA_MUNI, CARABOBO_REGION, 0.1)
        assert entry["status"] == "normal"

    def test_region_less_state_is_honest_no_data(self):
        entry = derive_municipio_entry(VALENCIA_MUNI, None, None)
        assert entry["signals"]["internet"] is None
        assert entry["signals"]["crowdsource"] is None
        assert entry["signals"]["weather"] is None
        assert entry["signals"]["satellite"] is None
        assert entry["status"] == "no_data"

    def test_region_less_state_with_own_satellite(self):
        entry = derive_municipio_entry(VALENCIA_MUNI, None, 0.85)
        assert entry["signals"]["satellite"] == pytest.approx(0.85)
        assert entry["signals"]["internet"] is None
        assert entry["status"] != "no_data"  # satellite alone is a real signal

    def test_no_region_and_no_signals_never_fabricates(self):
        entry = derive_municipio_entry(VALENCIA_MUNI, None, None)
        for key in ("internet", "satellite", "crowdsource", "weather"):
            assert entry["signals"][key] is None

    def test_rounds_scores(self):
        entry = derive_municipio_entry(VALENCIA_MUNI, CARABOBO_REGION, 0.123456)
        assert entry["current_score"] == round(entry["current_score"], 4)
        assert entry["signals"]["satellite"] == pytest.approx(0.1235, abs=1e-4)


# ── build_municipios_payload ──────────────────────────────────────────────────

class TestBuildMunicipiosPayload:
    def test_builds_all_states_with_entries(self):
        payload = build_municipios_payload(
            {"maracaibo": ZULIA_REGION, "valencia": CARABOBO_REGION},
            satellite_by_municipio=None,
        )
        assert len(payload) == 24  # every state present
        # Zulia municipios inherit maracaibo's signals incl. satellite fallback
        zulia_entry = payload["Zulia"][0]
        assert zulia_entry["signals"]["internet"] == pytest.approx(0.7)
        assert zulia_entry["signals"]["satellite"] == pytest.approx(0.9)
        # region-less state has no attributed signals
        amazonas_entry = payload["Amazonas"][0]
        assert amazonas_entry["signals"]["internet"] is None

    def test_own_satellite_map_overrides(self):
        payload = build_municipios_payload(
            {"valencia": CARABOBO_REGION},
            satellite_by_municipio={("Carabobo", "Valencia"): 0.9},
        )
        valencia = next(m for m in payload["Carabobo"] if m["name"] == "Valencia")
        assert valencia["signals"]["satellite"] == pytest.approx(0.9)

    def test_every_municipio_has_lat_lon_name_status(self):
        payload = build_municipios_payload(
            {"maracaibo": ZULIA_REGION, "valencia": CARABOBO_REGION},
            satellite_by_municipio=None,
        )
        total = sum(len(v) for v in payload.values())
        assert total == 332
        for state, entries in payload.items():
            for e in entries:
                assert e["name"]
                assert isinstance(e["lat"], float)
                assert isinstance(e["lon"], float)
                assert "status" in e
                assert "current_score" in e
                assert set(e["signals"]) == {"internet", "satellite", "crowdsource", "weather"}


# ── aggregate_state_status ────────────────────────────────────────────────────

class TestAggregateStateStatus:
    def test_worst_status_wins(self):
        entries = [
            {"status": "normal"},
            {"status": "no_power"},
            {"status": "unstable"},
        ]
        assert aggregate_state_status(entries) == "no_power"

    def test_all_normal(self):
        assert aggregate_state_status([{"status": "normal"}, {"status": "power_back"}]) == "power_back"

    def test_empty_is_no_data(self):
        assert aggregate_state_status([]) == "no_data"
