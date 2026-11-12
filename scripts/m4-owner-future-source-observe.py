#!/usr/bin/env python3
"""A5 protected network-only 15th-round source probe. No prediction or DB I/O.

Hard-coded 2026/27 future round. On ANY missing/revised fixture, report
unavailable privately and refuse to treat the cohort as an actual observation.
This probe does not separately corroborate club mapping or persist receipts.
"""
import os
import ssl
import sys
from dataclasses import asdict
from datetime import UTC, datetime
from json import dumps
from urllib.error import URLError
from urllib.request import HTTPRedirectHandler, Request, build_opener, HTTPSHandler

from football_forecast.research.m4_future_rpl_identity import (
    verify_directed_future_identities,
)
from football_forecast.research.m4_future_rpl_source import (
    CALENDAR, COMPETITION, MAX_BYTES_PER_DAY, inspect_future_rpl_source,
)


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, msg, headers, newurl):
        raise URLError("unexpected source redirect")


def main() -> None:
    if (
        os.environ.get("GITHUB_REPOSITORY") != "StanleyLl0yd/FootballForecast"
        or os.environ.get("GITHUB_REF") != "refs/heads/main"
        or os.environ.get("GITHUB_ACTOR") != "StanleyLl0yd"
        or os.environ.get("M4_FUTURE_READONLY_GATE") != "true"
    ):
        raise RuntimeError("M4: owner/repository/gate not verified")
    key = os.environ.get("OPENFOOT_API_KEY", "")
    if not key.startswith("of_live_") or not 16 <= len(key) <= 264:
        raise RuntimeError("M4: source credential unavailable")
    client = build_opener(NoRedirect(), HTTPSHandler(context=ssl.create_default_context()))
    data = {}
    for day in CALENDAR:
        url = (
            "https://openfootapi.com/v1/matches?competition=" +
            COMPETITION + "&date=" + day
        )
        request = Request(url, headers={
            "Accept": "application/json",
            "Authorization": "Bearer " + key,
            "User-Agent": "FootballForecast-M4-Private-Source-Observation/1",
        }, method="GET")
        with client.open(request, timeout=15) as response:
            if (response.status != 200 or
                    "application/json" not in response.headers.get(
                        "Content-Type", "").lower()):
                raise RuntimeError("M4: source response unexpected")
            body = response.read(MAX_BYTES_PER_DAY + 1)
            if not 2 <= len(body) <= MAX_BYTES_PER_DAY:
                raise RuntimeError("M4: oversized or empty source")
            data[day] = body
    receipt = inspect_future_rpl_source(data, datetime.now(UTC))
    # A second fail-closed, source-only comparison with two pinned independent
    # public schedules. This is not a trusted live second-source signature.
    verify_directed_future_identities(data)
    if (receipt.forecast_written or receipt.public_forecasts_written or
            receipt.model_approved or receipt.holdout_2025_26_read or
            receipt.genuine_as_of_attested or
            receipt.independent_source_confirmed):
        raise RuntimeError("M4: unauthorized future source receipt")
    # No team names, IDs, match scores, source bytes, API keys or predictions
    # are ever emitted to the workflow logs or stored in GitHub artifacts.
    print(dumps(asdict(receipt), sort_keys=True, separators=(",", ":")))


if __name__ == "__main__":
    try:
        main()
    except Exception:
        print("M4_UNAPPROVED_FUTURE_SOURCE: no valid complete observation", file=sys.stderr)
        sys.exit(2)
