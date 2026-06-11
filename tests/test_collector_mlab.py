"""
Tests for pipeline/collector_mlab.py. All offline.

M-Lab collector is a documented stub — endpoint unverified.
Tests verify stub contract: returns {} and does not raise.
"""
import logging
import pytest
from unittest.mock import MagicMock

from pipeline.collector_mlab import fetch_mlab_signals


class TestFetchMlabSignals:
    def test_returns_empty_dict(self):
        result = fetch_mlab_signals()
        assert result == {}

    def test_does_not_raise(self):
        # Stub must be safe to call with no arguments
        try:
            fetch_mlab_signals()
        except Exception as exc:
            pytest.fail(f"fetch_mlab_signals raised: {exc}")

    def test_returns_empty_dict_with_session(self):
        # Session injection is ignored by the stub — still returns {}
        session = MagicMock()
        result = fetch_mlab_signals(_session=session)
        assert result == {}

    def test_session_not_called(self):
        # Stub must not call any real endpoint
        session = MagicMock()
        fetch_mlab_signals(_session=session)
        session.get.assert_not_called()
        session.post.assert_not_called()

    def test_warning_logged(self, caplog):
        with caplog.at_level(logging.WARNING, logger="pipeline.collector_mlab"):
            fetch_mlab_signals()
        assert any("stub" in record.message.lower() or "unverified" in record.message.lower()
                   for record in caplog.records)
