"""
Tests for pipeline/quorum.py — compute_quorum and compute_crowd_score.

Both functions accept raw reports (weight=0 excluded internally).
Tests verify behavior through public interface only.
"""

import pytest
from pipeline.quorum import compute_quorum, compute_crowd_score, QuorumResult

MIN_REPORTS = 3  # cold-start quorum constant — matches module


def r(status="no_power", weight=1.0, ip_hash="hash_a", sub_zone=None):
    return {"status": status, "weight": weight, "ip_hash": ip_hash, "sub_zone": sub_zone}


# ── QuorumResult shape ────────────────────────────────────────────────────────

class TestQuorumResult:
    def test_zero_reports_not_met(self):
        result = compute_quorum([])
        assert result.met is False
        assert result.total_weight == pytest.approx(0.0)
        assert result.unique_ips == 0

    def test_quorum_met_at_minimum_threshold(self):
        reports = [r(ip_hash="a"), r(ip_hash="a"), r(ip_hash="b")]
        result = compute_quorum(reports)
        assert result.met is True

    def test_below_min_report_count_not_met(self):
        reports = [r(ip_hash="a"), r(ip_hash="b")]  # only 2 reports
        result = compute_quorum(reports)
        assert result.met is False

    def test_below_min_unique_ips_not_met(self):
        reports = [r(ip_hash="a"), r(ip_hash="a"), r(ip_hash="a")]  # 3 from 1 IP
        result = compute_quorum(reports)
        assert result.met is False

    def test_zero_weight_reports_excluded(self):
        # 3 weight=0 reports + 1 valid — only 1 valid report
        reports = [r(weight=0.0)] * 3 + [r(ip_hash="b")]
        result = compute_quorum(reports)
        assert result.met is False

    def test_total_weight_is_weighted_sum(self):
        reports = [r(weight=0.7, ip_hash="a"), r(weight=1.0, ip_hash="a"), r(weight=1.0, ip_hash="b")]
        result = compute_quorum(reports)
        assert result.total_weight == pytest.approx(2.7)

    def test_unique_ips_counts_distinct_hashes(self):
        reports = [r(ip_hash="a"), r(ip_hash="a"), r(ip_hash="b")]
        result = compute_quorum(reports)
        assert result.unique_ips == 2

    def test_all_null_sub_zones_quorum_not_blocked(self):
        # min_zones check skipped when all sub_zones are null (Phase 1-2)
        reports = [r(ip_hash="a", sub_zone=None), r(ip_hash="a", sub_zone=None), r(ip_hash="b", sub_zone=None)]
        result = compute_quorum(reports)
        assert result.met is True

    def test_many_reports_many_ips_quorum_met(self):
        reports = [r(ip_hash=f"ip_{i}") for i in range(10)]
        result = compute_quorum(reports)
        assert result.met is True


# ── crowd score — pre-quorum ──────────────────────────────────────────────────

class TestCrowdScorePreQuorum:
    def test_zero_reports_score_zero(self):
        assert compute_crowd_score([]) == pytest.approx(0.0)

    def test_single_no_power_report_dampened(self):
        # (no_power_weight / MIN_REPORTS) * 0.5 = (1.0 / 3) * 0.5
        score = compute_crowd_score([r(status="no_power", ip_hash="a")])
        assert score == pytest.approx(1.0 / MIN_REPORTS * 0.5, abs=1e-6)

    def test_two_reports_same_ip_dampened(self):
        reports = [r(ip_hash="a"), r(ip_hash="a")]
        score = compute_crowd_score(reports)
        # (2.0 / 3) * 0.5 = 0.333…
        assert score == pytest.approx(2.0 / MIN_REPORTS * 0.5, abs=1e-6)

    def test_pre_quorum_score_always_below_half(self):
        # 2 full-weight no_power reports: (2/3)*0.5 = 0.333
        reports = [r(ip_hash="a"), r(ip_hash="b")]
        assert compute_crowd_score(reports) < 0.5

    def test_pre_quorum_power_back_scores_zero(self):
        # power_back reports give no outage signal
        reports = [r(status="power_back", ip_hash="a"), r(status="power_back", ip_hash="b")]
        assert compute_crowd_score(reports) == pytest.approx(0.0)

    def test_zero_weight_reports_do_not_count(self):
        # weight=0 are invalid; only 2 valid remain → below quorum
        reports = [r(weight=0.0)] * 3 + [r(ip_hash="a"), r(ip_hash="a")]
        score = compute_crowd_score(reports)
        expected = (2.0 / MIN_REPORTS) * 0.5
        assert score == pytest.approx(expected, abs=1e-6)


# ── crowd score — post-quorum ─────────────────────────────────────────────────

class TestCrowdScorePostQuorum:
    def _quorum_reports(self, statuses):
        """3 reports: 2 from ip_a, 1 from ip_b, with given statuses."""
        assert len(statuses) == 3
        ips = ["a", "a", "b"]
        return [r(status=s, ip_hash=ip) for s, ip in zip(statuses, ips)]

    def test_all_no_power_score_one(self):
        reports = self._quorum_reports(["no_power", "no_power", "no_power"])
        assert compute_crowd_score(reports) == pytest.approx(1.0)

    def test_all_power_back_score_zero(self):
        reports = self._quorum_reports(["power_back", "power_back", "power_back"])
        assert compute_crowd_score(reports) == pytest.approx(0.0)

    def test_mixed_score_equals_outage_ratio(self):
        # 2 no_power, 1 power_back → 2/3
        reports = self._quorum_reports(["no_power", "no_power", "power_back"])
        assert compute_crowd_score(reports) == pytest.approx(2.0 / 3.0, abs=1e-6)

    def test_unstable_reduces_score(self):
        # unstable counts in total_weight but not no_power_weight → 2/3
        reports = self._quorum_reports(["no_power", "unstable", "no_power"])
        assert compute_crowd_score(reports) == pytest.approx(2.0 / 3.0, abs=1e-6)

    def test_gps_penalized_weight_reflected(self):
        # weight=0.7 (GPS absent) counts at 0.7 in both num and denom
        reports = [
            r(status="no_power", weight=0.7, ip_hash="a"),
            r(status="no_power", weight=0.7, ip_hash="a"),
            r(status="no_power", weight=1.0, ip_hash="b"),
        ]
        # all no_power → ratio = 2.4/2.4 = 1.0
        assert compute_crowd_score(reports) == pytest.approx(1.0)

    def test_gps_penalized_mixed_weight_correct_ratio(self):
        reports = [
            r(status="no_power",   weight=0.7, ip_hash="a"),
            r(status="power_back", weight=1.0, ip_hash="a"),
            r(status="no_power",   weight=1.0, ip_hash="b"),
        ]
        # no_power_weight=1.7, total_weight=2.7
        assert compute_crowd_score(reports) == pytest.approx(1.7 / 2.7, abs=1e-6)

    def test_score_full_range_reachable(self):
        # 0.0 and 1.0 both reachable post-quorum
        all_out = [r(status="no_power", ip_hash=f"ip_{i}") for i in range(5)]
        all_back = [r(status="power_back", ip_hash=f"ip_{i}") for i in range(5)]
        assert compute_crowd_score(all_out)  == pytest.approx(1.0)
        assert compute_crowd_score(all_back) == pytest.approx(0.0)
