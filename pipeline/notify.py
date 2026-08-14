"""Phase 3 Expo push notification fan-out.

Reads anonymous push token subscriptions, sends factual Spanish outage messages
through Expo, and records cooldown/log rows. All helper failures are non-fatal:
the pipeline must still write status.json and upload CDN output.
"""

from __future__ import annotations

import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Any

import requests

from pipeline.regions import ADJACENCY_MAP


logger = logging.getLogger(__name__)

_EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"
_BATCH_SIZE = 100
_TOGGLE_BY_EVENT = {
    "outage": "notify_outage",
    "restoration": "notify_restoration",
    "neighbor_outage": "notify_neighbor",
}


def _chunk(items: list[dict[str, Any]], size: int = _BATCH_SIZE):
    for start in range(0, len(items), size):
        yield items[start : start + size]


def _fetch_tokens(zones, event_type: str, client) -> list[dict[str, Any]]:
    """Return subscribed token rows for zones and event type."""
    zone_list = list(dict.fromkeys(zones))
    if not zone_list:
        return []

    toggle_col = _TOGGLE_BY_EVENT[event_type]
    try:
        res = (
            client.table("push_tokens")
            .select("expo_token,zone,platform,notify_outage,notify_restoration,notify_neighbor")
            .in_("zone", zone_list)
            .eq(toggle_col, True)
            .execute()
        )
        rows = list(getattr(res, "data", None) or [])
        return [row for row in rows if row.get("zone") in zone_list and row.get(toggle_col, True)]
    except Exception as exc:  # pragma: no cover - defensive pipeline guard
        logger.warning("push token query failed (non-fatal): %s", exc)
        return []


def _is_suppressed(
    zone: str,
    event_type: str,
    cooldown_hours: int,
    client,
    now: datetime | None = None,
) -> bool:
    """Return true when this zone/event was notified within the cooldown."""
    now = now or datetime.now(timezone.utc)
    since = now - timedelta(hours=cooldown_hours)
    try:
        res = (
            client.table("notification_log")
            .select("event_id")
            .eq("zone", zone)
            .eq("event_type", event_type)
            .gte("sent_at", since.isoformat())
            .limit(1)
            .execute()
        )
        rows = list(getattr(res, "data", None) or [])
        return any(row.get("event_type", event_type) == event_type for row in rows)
    except Exception as exc:  # pragma: no cover - defensive pipeline guard
        logger.warning("notification cooldown query failed (non-fatal): %s", exc)
        return False


def _send_expo_batch(messages: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Send one Expo batch. Caller is responsible for chunking."""
    if not messages:
        return []

    headers = {"Content-Type": "application/json"}
    token = os.getenv("EXPO_ACCESS_TOKEN")
    if token:
        headers["Authorization"] = f"Bearer {token}"

    try:
        res = requests.post(_EXPO_PUSH_URL, json=messages, headers=headers, timeout=10)
        res.raise_for_status()
        payload = res.json()
        data = payload.get("data") if isinstance(payload, dict) else None
        return data if isinstance(data, list) else []
    except Exception as exc:  # pragma: no cover - defensive pipeline guard
        logger.warning("Expo push send failed (non-fatal): %s", exc)
        return []


def _build_message(
    *,
    token: str,
    zone: str,
    affected_zone: str,
    event_type: str,
) -> dict[str, Any]:
    if event_type == "restoration":
        title = "Volvió la luz"
        body = f"Reportamos recuperación en {affected_zone}. Verifica tu zona."
    elif event_type == "neighbor_outage":
        title = "Aviso de zona vecina"
        body = f"Hay una interrupción confirmada cerca de {zone}: {affected_zone}."
    else:
        title = "Sin luz"
        body = f"Interrupción confirmada en {affected_zone}. Sin ETA oficial."

    return {
        "to": token,
        "title": title,
        "body": body,
        "channelId": "outages",
        "data": {
            "zone": zone,
            "affected_zone": affected_zone,
            "source_zone": affected_zone,
            "event_type": event_type,
        },
    }


def _record_notification(
    client,
    *,
    event_id: str,
    event_type: str,
    zone: str,
    ticket_id: str | None,
    expo_token: str | None,
    token_count: int,
):
    try:
        client.table("notification_log").insert(
            {
                "event_id": event_id,
                "event_type": event_type,
                "zone": zone,
                "ticket_id": ticket_id,
                "expo_token": expo_token,
                "token_count": token_count,
            }
        ).execute()
    except Exception as exc:  # pragma: no cover - defensive pipeline guard
        logger.warning("notification log insert failed (non-fatal): %s", exc)


def _event_id(event_type: str, zone: str, now: datetime) -> str:
    return f"{event_type}:{zone}:{now.strftime('%Y%m%d%H')}"


def _is_unstable(zone: str, regions_scored: dict[str, dict[str, Any]]) -> bool:
    return (regions_scored.get(zone) or {}).get("status") == "unstable"


def _queue_event(
    *,
    messages: list[dict[str, Any]],
    client,
    zones: list[str],
    affected_zone: str,
    event_type: str,
    now: datetime,
    cooldown_hours: int,
    counters: dict[str, int],
):
    if _is_suppressed(affected_zone, event_type, cooldown_hours, client, now):
        counters["skipped_cooldown"] += 1
        return

    rows = _fetch_tokens(zones, event_type, client)
    for row in rows:
        token = row.get("expo_token")
        zone = row.get("zone")
        if not token or not zone:
            continue
        messages.append(
            _build_message(
                token=token,
                zone=zone,
                affected_zone=affected_zone,
                event_type=event_type,
            )
        )


def send_notifications(
    lifecycle_result: dict[str, list[str]],
    regions_scored: dict[str, dict[str, Any]],
    client,
    now: datetime | None = None,
    cooldown_hours: int = 2,
) -> dict[str, int]:
    """Fan out confirmed lifecycle events to subscribed Expo push tokens."""
    now = now or datetime.now(timezone.utc)
    counters = {"sent": 0, "skipped_cooldown": 0, "skipped_unstable": 0}
    messages: list[dict[str, Any]] = []

    try:
        for zone in lifecycle_result.get("new_outages", []):
            if _is_unstable(zone, regions_scored):
                counters["skipped_unstable"] += 1
                continue
            _queue_event(
                messages=messages,
                client=client,
                zones=[zone],
                affected_zone=zone,
                event_type="outage",
                now=now,
                cooldown_hours=cooldown_hours,
                counters=counters,
            )
            _queue_event(
                messages=messages,
                client=client,
                zones=ADJACENCY_MAP.get(zone, []),
                affected_zone=zone,
                event_type="neighbor_outage",
                now=now,
                cooldown_hours=cooldown_hours,
                counters=counters,
            )

        for zone in lifecycle_result.get("restorations", []):
            if _is_unstable(zone, regions_scored):
                counters["skipped_unstable"] += 1
                continue
            _queue_event(
                messages=messages,
                client=client,
                zones=[zone],
                affected_zone=zone,
                event_type="restoration",
                now=now,
                cooldown_hours=cooldown_hours,
                counters=counters,
            )

        for batch in _chunk(messages):
            tickets = _send_expo_batch(batch)
            counters["sent"] += len(batch)
            for index, message in enumerate(batch):
                ticket = tickets[index] if index < len(tickets) else {}
                _record_notification(
                    client,
                    event_id=_event_id(message["data"]["event_type"], message["data"]["affected_zone"], now),
                    event_type=message["data"]["event_type"],
                    zone=message["data"]["affected_zone"],
                    ticket_id=ticket.get("id") if isinstance(ticket, dict) else None,
                    expo_token=message.get("to"),
                    token_count=len(batch),
                )
    except Exception as exc:  # pragma: no cover - final non-fatal guard
        logger.warning("notify fan-out failed (non-fatal): %s", exc)

    return counters
