"""
M-Lab NDT (Network Diagnostic Test) collector — DOCUMENTED STUB.

M-Lab provides global network measurement data. The statistics API
candidate URL (https://statistics.measurementlab.net/v0/) is a CANDIDATE
only — verify endpoint and authentication before wiring a real implementation.

This module intentionally returns {} and logs a warning so that:
1. The calling code (collector_internet_unified.py) handles it gracefully.
2. The stub is easy to replace once the endpoint is verified.
3. No invented endpoint is asserted as working fact.

Approved decision #3: M-Lab stub acceptable for Phase 2. Verify endpoint
before activating in Phase 3.
"""
import logging
from typing import Optional

import requests

logger = logging.getLogger(__name__)

# CANDIDATE endpoint — verify before using. Do NOT call this URL as fact.
# See: https://statistics.measurementlab.net/v0/
_MLAB_ENDPOINT_CANDIDATE = "https://statistics.measurementlab.net/v0/"


def fetch_mlab_signals(
    _session: Optional[requests.Session] = None,
) -> dict:
    """
    M-Lab NDT collector stub.

    Returns {} and logs a warning. The M-Lab statistics endpoint has not
    been verified — wiring a live call requires confirming the endpoint URL,
    authentication requirements, and response schema.

    To activate: verify endpoint, implement the real collector following
    the collector_ripe.py pattern (stateless, try/except, returns {} on error).
    """
    # verify endpoint: _MLAB_ENDPOINT_CANDIDATE — endpoint unverified
    logger.warning(
        "M-Lab collector stub: endpoint unverified — returning no signal"
    )
    return {}
