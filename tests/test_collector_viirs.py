"""
Tests for pipeline/collector_viirs.py. All offline.
"""
import pytest
from datetime import datetime, timezone
from unittest.mock import MagicMock

from pipeline.collector_viirs import (
    BASELINE_RADIANCE,
    _STATUS_TO_SCORE,
    classify_ratio,
    fetch_latest_viirs,
)

# A fixed UTC datetime inside the 06:00-08:00 publication window.
_IN_WINDOW = datetime(2026, 5, 16, 7, 0, 0, tzinfo=timezone.utc)

# ── classify_ratio ────────────────────────────────────────────────────────────

class TestClassifyRatio:
    def test_zero_is_major_outage(self):
        assert classify_ratio(0.0) == "major_outage"

    def test_below_0_3_is_major_outage(self):
        assert classify_ratio(0.29) == "major_outage"

    def test_exactly_0_3_is_partial_outage(self):
        assert classify_ratio(0.3) == "partial_outage"

    def test_between_0_3_and_0_6_is_partial_outage(self):
        assert classify_ratio(0.45) == "partial_outage"

    def test_below_0_6_is_partial_outage(self):
        assert classify_ratio(0.59) == "partial_outage"

    def test_exactly_0_6_is_degraded(self):
        assert classify_ratio(0.6) == "degraded"

    def test_between_0_6_and_0_85_is_degraded(self):
        assert classify_ratio(0.72) == "degraded"

    def test_below_0_85_is_degraded(self):
        assert classify_ratio(0.84) == "degraded"

    def test_exactly_0_85_is_normal(self):
        assert classify_ratio(0.85) == "normal"

    def test_1_0_is_normal(self):
        assert classify_ratio(1.0) == "normal"

    def test_above_1_0_is_normal(self):
        assert classify_ratio(1.5) == "normal"


# ── fetch_latest_viirs — missing granules ─────────────────────────────────────

class TestMissingGranules:
    def _empty_session(self):
        resp = MagicMock()
        resp.raise_for_status.side_effect = None
        resp.json.return_value = {"feed": {"entry": []}}
        s = MagicMock()
        s.get.return_value = resp
        return s

    def _error_session(self):
        s = MagicMock()
        s.get.side_effect = Exception("CMR timeout")
        return s

    def test_no_granules_returns_empty_dict(self):
        result = fetch_latest_viirs(_session=self._empty_session(), now=_IN_WINDOW)
        assert result == {}

    def test_cmr_error_returns_empty_dict(self):
        result = fetch_latest_viirs(_session=self._error_session(), now=_IN_WINDOW)
        assert result == {}

    def test_http_error_returns_empty_dict(self):
        resp = MagicMock()
        resp.raise_for_status.side_effect = Exception("HTTP 503")
        s = MagicMock()
        s.get.return_value = resp
        result = fetch_latest_viirs(_session=s, now=_IN_WINDOW)
        assert result == {}


# ── fetch_latest_viirs — with granules ────────────────────────────────────────

class TestWithGranules:
    def _session_with_granules(self, n=2):
        resp = MagicMock()
        resp.raise_for_status.side_effect = None
        resp.json.return_value = {"feed": {"entry": [{"id": f"g{i}"} for i in range(n)]}}
        s = MagicMock()
        s.get.return_value = resp
        return s

    def test_extract_none_produces_empty_result(self):
        # _extract_fn always returns None -> no regions in result
        result = fetch_latest_viirs(
            _session=self._session_with_granules(),
            _extract_fn=lambda g, r: None,
            now=_IN_WINDOW,
        )
        assert result == {}

    def test_extract_value_populates_region(self):
        baseline = BASELINE_RADIANCE["caracas"]  # 45.2
        observed = baseline * 0.9               # ratio=0.9 -> normal
        result = fetch_latest_viirs(
            _session=self._session_with_granules(),
            _extract_fn=lambda g, r: observed if r == "caracas" else None,
            now=_IN_WINDOW,
        )
        assert "caracas" in result
        assert result["caracas"]["status"] == "normal"

    def test_result_contains_required_keys(self):
        baseline = BASELINE_RADIANCE["maracaibo"]
        observed = baseline * 0.2  # major_outage
        result = fetch_latest_viirs(
            _session=self._session_with_granules(),
            _extract_fn=lambda g, r: observed if r == "maracaibo" else None,
            now=_IN_WINDOW,
        )
        entry = result["maracaibo"]
        assert "observed" in entry
        assert "baseline" in entry
        assert "ratio" in entry
        assert "status" in entry
        assert "score" in entry

    def test_major_outage_ratio_and_score(self):
        baseline = BASELINE_RADIANCE["valencia"]
        observed = baseline * 0.2   # ratio=0.2 -> major_outage
        result = fetch_latest_viirs(
            _session=self._session_with_granules(),
            _extract_fn=lambda g, r: observed if r == "valencia" else None,
            now=_IN_WINDOW,
        )
        assert result["valencia"]["status"] == "major_outage"
        assert result["valencia"]["score"] == pytest.approx(0.90)
        assert result["valencia"]["ratio"] == pytest.approx(0.2, abs=0.001)

    def test_partial_outage_score(self):
        baseline = BASELINE_RADIANCE["barquisimeto"]
        observed = baseline * 0.45  # ratio=0.45 -> partial_outage
        result = fetch_latest_viirs(
            _session=self._session_with_granules(),
            _extract_fn=lambda g, r: observed if r == "barquisimeto" else None,
            now=_IN_WINDOW,
        )
        assert result["barquisimeto"]["status"] == "partial_outage"
        assert result["barquisimeto"]["score"] == pytest.approx(0.60)

    def test_degraded_score(self):
        baseline = BASELINE_RADIANCE["maracay"]
        observed = baseline * 0.72  # degraded
        result = fetch_latest_viirs(
            _session=self._session_with_granules(),
            _extract_fn=lambda g, r: observed if r == "maracay" else None,
            now=_IN_WINDOW,
        )
        assert result["maracay"]["status"] == "degraded"
        assert result["maracay"]["score"] == pytest.approx(0.30)

    def test_baseline_stored_in_result(self):
        baseline = BASELINE_RADIANCE["caracas"]
        result = fetch_latest_viirs(
            _session=self._session_with_granules(),
            _extract_fn=lambda g, r: baseline if r == "caracas" else None,
            now=_IN_WINDOW,
        )
        assert result["caracas"]["baseline"] == baseline

    def test_all_17_regions_have_baselines(self):
        # The original 17 regions all have baselines; the 8 state capitals
        # added 2026-08-15 legitimately don't (no baseline history yet).
        from pipeline.regions import REGIONS
        original = [k for k in REGIONS if k not in (
            "guanare", "san_felipe", "san_carlos", "san_juan_de_los_morros",
            "san_fernando_de_apure", "puerto_ayacucho", "tucupita", "la_guaira",
        )]
        assert set(BASELINE_RADIANCE.keys()) == set(original)

    def test_date_str_sent_to_cmr(self):
        s = self._session_with_granules()
        fetch_latest_viirs(
            date_str="2026-05-15",
            _session=s,
            _extract_fn=lambda g, r: None,
            now=_IN_WINDOW,
        )
        call_params = s.get.call_args.kwargs.get("params") or s.get.call_args[1].get("params", {})
        assert "2026-05-15" in call_params.get("temporal", "")


# ── lonlat_to_tile_pixel ─────────────────────────────────────────────────────

class TestPixelMath:
    def test_in_tile_correctness_origin(self):
        from pipeline.collector_viirs import lonlat_to_tile_pixel
        # tile h10v07: lon -80..-70, lat 0..10
        # corner (lat=0, lon=-80) -> row=2399, col=0  (lat increases upward -> row=2399 at bottom)
        row, col = lonlat_to_tile_pixel(0.0, -80.0, 10, 7)
        assert row == 2399
        assert col == 0

    def test_in_tile_correctness_top_left(self):
        from pipeline.collector_viirs import lonlat_to_tile_pixel
        # tile h10v07: lon -80..-70, lat 0..10
        # corner (lat=10, lon=-80) -> row=0, col=0
        row, col = lonlat_to_tile_pixel(10.0, -80.0, 10, 7)
        assert row == 0
        assert col == 0

    def test_in_tile_correctness_midpoint(self):
        from pipeline.collector_viirs import lonlat_to_tile_pixel
        # midpoint of tile h10v07: lat=5, lon=-75 -> row=1200, col=1200
        row, col = lonlat_to_tile_pixel(5.0, -75.0, 10, 7)
        assert row == 1200
        assert col == 1200

    def test_outside_tile_returns_none(self):
        from pipeline.collector_viirs import lonlat_to_tile_pixel
        # tile h10v07: lon -80..-70 — coord outside
        result = lonlat_to_tile_pixel(5.0, -60.0, 10, 7)
        assert result is None

    def test_outside_tile_lat_returns_none(self):
        from pipeline.collector_viirs import lonlat_to_tile_pixel
        # tile h10v07: lat 0..10 — lat 15 is outside
        result = lonlat_to_tile_pixel(15.0, -75.0, 10, 7)
        assert result is None


# ── mask_valid_radiance ──────────────────────────────────────────────────────

class TestRadianceMasking:
    def test_fill_65535_dropped(self):
        import numpy as np
        from pipeline.collector_viirs import mask_valid_radiance
        ntl = np.array([65535, 100, 200], dtype=np.uint16)
        qf  = np.array([0, 0, 0], dtype=np.uint8)
        result = mask_valid_radiance(ntl, qf)
        # 65535 dropped, remaining 2 values scaled by 0.1
        assert len(result) == 2
        assert result[0] == pytest.approx(100 * 0.1)
        assert result[1] == pytest.approx(200 * 0.1)

    def test_qf2_dropped(self):
        import numpy as np
        from pipeline.collector_viirs import mask_valid_radiance
        ntl = np.array([100, 200, 300], dtype=np.uint16)
        qf  = np.array([0, 2, 1], dtype=np.uint8)
        result = mask_valid_radiance(ntl, qf)
        # QF==2 (cloud/poor) dropped — only indices 0,2 remain
        assert len(result) == 2
        assert result[0] == pytest.approx(100 * 0.1)
        assert result[1] == pytest.approx(300 * 0.1)

    def test_scale_0_1_applied(self):
        import numpy as np
        from pipeline.collector_viirs import mask_valid_radiance
        ntl = np.array([500], dtype=np.uint16)
        qf  = np.array([0], dtype=np.uint8)
        result = mask_valid_radiance(ntl, qf)
        assert result[0] == pytest.approx(50.0)

    def test_all_cloud_returns_empty(self):
        import numpy as np
        from pipeline.collector_viirs import mask_valid_radiance
        ntl = np.array([100, 200, 300], dtype=np.uint16)
        qf  = np.array([2, 2, 2], dtype=np.uint8)
        result = mask_valid_radiance(ntl, qf)
        assert len(result) == 0


class TestMeanRegionRadiance:
    def test_returns_none_when_zero_valid_pixels(self):
        import numpy as np
        from pipeline.collector_viirs import mean_region_radiance
        ntl = np.array([[65535, 65535], [65535, 65535]], dtype=np.uint16)
        qf  = np.array([[0, 0], [0, 0]], dtype=np.uint8)
        result = mean_region_radiance(ntl, qf, [0, 1], [0, 1])
        assert result is None

    def test_mean_of_valid_pixels(self):
        import numpy as np
        from pipeline.collector_viirs import mean_region_radiance
        ntl = np.array([[100, 200], [300, 400]], dtype=np.uint16)
        qf  = np.array([[0, 0], [0, 0]], dtype=np.uint8)
        result = mean_region_radiance(ntl, qf, [0, 1], [0, 1])
        # mean of [100, 200, 300, 400] * 0.1 = 25.0
        assert result == pytest.approx(25.0)

    def test_cloud_pixels_excluded_from_mean(self):
        import numpy as np
        from pipeline.collector_viirs import mean_region_radiance
        ntl = np.array([[100, 200]], dtype=np.uint16)
        qf  = np.array([[0, 2]], dtype=np.uint8)
        result = mean_region_radiance(ntl, qf, [0], [0, 1])
        # only pixel at [0,0] valid: 100*0.1 = 10.0
        assert result == pytest.approx(10.0)


# ── which_tiles ──────────────────────────────────────────────────────────────

class TestWhichTiles:
    def test_barinas_maps_to_h10v07(self):
        from pipeline.collector_viirs import which_tiles
        # barinas: lat=8.62, lon=-70.21 → tile h10v07 (lon -80..-70, lat 0..10)
        tiles = which_tiles(8.62, -70.21)
        assert "h10v07" in tiles

    def test_merida_maps_to_h10v07(self):
        from pipeline.collector_viirs import which_tiles
        # merida: lat=8.59, lon=-71.14 → tile h10v07 (lon -80..-70, lat 0..10)
        tiles = which_tiles(8.59, -71.14)
        assert "h10v07" in tiles

    def test_caracas_maps_to_h11v06(self):
        from pipeline.collector_viirs import which_tiles
        # caracas: lat=10.48, lon=-66.90 → tile h11v06 (lon -70..-60, lat 10..20)
        tiles = which_tiles(10.48, -66.90)
        assert "h11v06" in tiles

    def test_maracaibo_maps_to_h10v06(self):
        from pipeline.collector_viirs import which_tiles
        # maracaibo: lat=10.64, lon=-71.61 → tile h10v06 (lon -80..-70, lat 10..20)
        tiles = which_tiles(10.64, -71.61)
        assert "h10v06" in tiles

    def test_returns_list(self):
        from pipeline.collector_viirs import which_tiles
        result = which_tiles(8.62, -70.21)
        assert isinstance(result, list)
        assert len(result) >= 1


# ── in_publication_window ────────────────────────────────────────────────────

class TestPublicationWindow:
    def test_true_at_07_utc(self):
        from datetime import datetime, timezone
        from pipeline.collector_viirs import in_publication_window
        t = datetime(2026, 5, 16, 7, 0, 0, tzinfo=timezone.utc)
        assert in_publication_window(t) is True

    def test_true_at_06_00_utc(self):
        from datetime import datetime, timezone
        from pipeline.collector_viirs import in_publication_window
        t = datetime(2026, 5, 16, 6, 0, 0, tzinfo=timezone.utc)
        assert in_publication_window(t) is True

    def test_false_at_08_00_utc(self):
        from datetime import datetime, timezone
        from pipeline.collector_viirs import in_publication_window
        t = datetime(2026, 5, 16, 8, 0, 0, tzinfo=timezone.utc)
        assert in_publication_window(t) is False

    def test_false_at_14_utc(self):
        from datetime import datetime, timezone
        from pipeline.collector_viirs import in_publication_window
        t = datetime(2026, 5, 16, 14, 0, 0, tzinfo=timezone.utc)
        assert in_publication_window(t) is False

    def test_false_at_midnight_utc(self):
        from datetime import datetime, timezone
        from pipeline.collector_viirs import in_publication_window
        t = datetime(2026, 5, 16, 0, 0, 0, tzinfo=timezone.utc)
        assert in_publication_window(t) is False

    def test_fetch_outside_window_returns_empty_no_network(self):
        from datetime import datetime, timezone
        from unittest.mock import MagicMock
        from pipeline.collector_viirs import fetch_latest_viirs
        # 14:00 UTC is outside 06:00-08:00 window
        outside_window = datetime(2026, 5, 16, 14, 0, 0, tzinfo=timezone.utc)
        session = MagicMock()
        result = fetch_latest_viirs(
            now=outside_window,
            _session=session,
        )
        assert result == {}
        session.get.assert_not_called()

    def test_fetch_inside_window_calls_cmr(self):
        from datetime import datetime, timezone
        from unittest.mock import MagicMock
        from pipeline.collector_viirs import fetch_latest_viirs
        # 07:00 UTC is inside window
        inside_window = datetime(2026, 5, 16, 7, 0, 0, tzinfo=timezone.utc)
        resp = MagicMock()
        resp.raise_for_status.side_effect = None
        resp.json.return_value = {"feed": {"entry": []}}
        session = MagicMock()
        session.get.return_value = resp
        # returns {} because no granules, but session.get WAS called
        result = fetch_latest_viirs(
            now=inside_window,
            _session=session,
        )
        session.get.assert_called_once()
