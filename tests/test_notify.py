"""All offline - mock Supabase and HTTP."""

from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

from pipeline.notify import (
    _fetch_tokens,
    _is_suppressed,
    _send_expo_batch,
    send_notifications,
)


NOW = datetime(2026, 6, 13, 14, 0, 0, tzinfo=timezone.utc)


def _lifecycle_result(new_outages=None, restorations=None):
    return {
        "new_outages": new_outages or [],
        "restorations": restorations or [],
    }


def _region_scored(status="likely_outage", score=0.8):
    return {
        "status": status,
        "current_score": score,
        "signals": {},
    }


def _mock_client(tokens=None, suppressed=False):
    client = MagicMock()
    token_specs = tokens if tokens is not None else [("ExponentPushToken[test]", "caracas")]
    token_rows = [
        {
            "expo_token": token if isinstance(token, str) else token[0],
            "zone": "caracas" if isinstance(token, str) else token[1],
            "notify_outage": True,
            "notify_restoration": True,
            "notify_neighbor": True,
            "platform": "android",
        }
        for token in token_specs
    ]

    push_execute = MagicMock(data=token_rows)
    push_query = MagicMock()
    push_query.select.return_value = push_query
    push_query.in_.return_value = push_query
    push_query.eq.return_value = push_query
    push_query.execute.return_value = push_execute

    log_execute = MagicMock(data=[{"event_id": "evt-prior", "event_type": "outage"}] if suppressed else [])
    log_query = MagicMock()
    log_query.select.return_value = log_query
    log_query.eq.return_value = log_query
    log_query.gte.return_value = log_query
    log_query.limit.return_value = log_query
    log_query.execute.return_value = log_execute
    log_query.insert.return_value.execute.return_value = MagicMock(data=[])

    def table(name):
        if name == "push_tokens":
            return push_query
        if name == "notification_log":
            return log_query
        raise AssertionError(name)

    client.table.side_effect = table
    return client


class TestSendNotifications:
    def test_outage_fires_for_subscribers(self):
        client = _mock_client(tokens=[("ExponentPushToken[test]", "caracas")])
        lifecycle = _lifecycle_result(new_outages=["caracas"])
        regions = {"caracas": _region_scored("likely_outage")}

        with patch("pipeline.notify._send_expo_batch") as send:
            result = send_notifications(lifecycle, regions, client, now=NOW)

        send.assert_called_once()
        message = send.call_args.args[0][0]
        assert "Sin luz" in message["title"]
        assert message["data"]["event_type"] == "outage"
        assert result["sent"] == 1

    def test_restoration_fires_for_subscribers(self):
        client = _mock_client(tokens=[("ExponentPushToken[test]", "maracaibo")])
        lifecycle = _lifecycle_result(restorations=["maracaibo"])
        regions = {"maracaibo": _region_scored("normal", score=0.1)}

        with patch("pipeline.notify._send_expo_batch") as send:
            send_notifications(lifecycle, regions, client, now=NOW)

        message = send.call_args.args[0][0]
        assert "Volvio la luz" in message["title"] or "Volvió la luz" in message["title"]
        assert message["data"]["event_type"] == "restoration"

    def test_neighbor_outage_fires_for_neighbor_subscribers(self):
        client = _mock_client(tokens=[("ExponentPushToken[neighbor]", "los_teques")])
        lifecycle = _lifecycle_result(new_outages=["caracas"])
        regions = {"caracas": _region_scored("likely_outage")}

        with patch("pipeline.notify._send_expo_batch") as send:
            send_notifications(lifecycle, regions, client, now=NOW)

        messages = send.call_args.args[0]
        message = next(msg for msg in messages if msg["data"]["event_type"] == "neighbor_outage")
        assert message["data"]["event_type"] == "neighbor_outage"
        assert message["data"]["source_zone"] == "caracas"

    def test_no_tokens_no_http_call(self):
        client = _mock_client(tokens=[])
        lifecycle = _lifecycle_result(new_outages=["caracas"])
        regions = {"caracas": _region_scored("likely_outage")}

        with patch("pipeline.notify._send_expo_batch") as send:
            result = send_notifications(lifecycle, regions, client, now=NOW)

        send.assert_not_called()
        assert result["sent"] == 0


class TestExpoApi:
    def test_message_format(self):
        client = _mock_client()
        lifecycle = _lifecycle_result(new_outages=["caracas"])
        regions = {"caracas": _region_scored("likely_outage")}

        with patch("pipeline.notify._send_expo_batch") as send:
            send_notifications(lifecycle, regions, client, now=NOW)

        message = send.call_args.args[0][0]
        assert {"to", "title", "body", "data", "channelId"} <= set(message)

    def test_batch_chunking(self):
        tokens = [f"ExponentPushToken[{i}]" for i in range(150)]
        client = _mock_client(tokens=tokens)
        lifecycle = _lifecycle_result(new_outages=["caracas"])
        regions = {"caracas": _region_scored("likely_outage")}

        with patch("pipeline.notify._send_expo_batch") as send:
            send_notifications(lifecycle, regions, client, now=NOW)

        assert send.call_count == 2
        assert all(len(call.args[0]) <= 100 for call in send.call_args_list)


class TestSuppression:
    def test_unstable_zone_skipped(self):
        client = _mock_client()
        lifecycle = _lifecycle_result(new_outages=["caracas"])
        regions = {"caracas": _region_scored("unstable", score=0.65)}

        with patch("pipeline.notify._send_expo_batch") as send:
            result = send_notifications(lifecycle, regions, client, now=NOW)

        send.assert_not_called()
        assert result["skipped_unstable"] >= 1


class TestCooldown:
    def test_cooldown_suppresses_repeat(self):
        client = _mock_client(suppressed=True)
        lifecycle = _lifecycle_result(new_outages=["caracas"])
        regions = {"caracas": _region_scored("likely_outage")}

        with patch("pipeline.notify._send_expo_batch") as send:
            result = send_notifications(lifecycle, regions, client, now=NOW)

        send.assert_not_called()
        assert result["skipped_cooldown"] >= 1

    def test_restoration_fires_after_outage_within_window(self):
        client = _mock_client(suppressed=True)
        lifecycle = _lifecycle_result(restorations=["caracas"])
        regions = {"caracas": _region_scored("normal", score=0.1)}

        with patch("pipeline.notify._send_expo_batch") as send:
            send_notifications(lifecycle, regions, client, now=NOW)

        send.assert_called_once()


class TestEdgeCases:
    def test_empty_lifecycle_events_no_send(self):
        client = _mock_client()
        lifecycle = _lifecycle_result()
        regions = {"caracas": _region_scored("normal", score=0.1)}

        with patch("pipeline.notify._send_expo_batch") as send:
            result = send_notifications(lifecycle, regions, client, now=NOW)

        send.assert_not_called()
        assert result["sent"] == 0

    def test_all_signals_none_no_crash(self):
        client = _mock_client()
        lifecycle = _lifecycle_result(new_outages=["caracas"])
        regions = {"caracas": _region_scored("likely_outage", score=None)}

        with patch("pipeline.notify._send_expo_batch"):
            send_notifications(lifecycle, regions, client, now=NOW)
