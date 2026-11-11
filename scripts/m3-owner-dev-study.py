#!/usr/bin/env python3
"""Protected read-only M3 study: emit hashes/counts, never underlying metrics/rows."""

import os
import sys
from dataclasses import asdict
from json import dumps
from pathlib import Path

from football_forecast.research.m3_owner_study_receipt import (
    COLUMNS,
    audit_owner_study_aggregates,
)


def main() -> None:
    if os.getenv("GITHUB_REPOSITORY") != "StanleyLl0yd/FootballForecast":
        raise RuntimeError("repository context denied")
    if os.getenv("GITHUB_REF") != "refs/heads/main":
        raise RuntimeError("unprotected ref")
    if os.getenv("GITHUB_ACTOR") != "StanleyLl0yd":
        raise RuntimeError("owner identity missing")
    root = Path(__file__).resolve().parents[1]
    sql = (root / "research/sql/m3_development_poisson_observation.sql").read_text(
        encoding="utf-8"
    )
    import psycopg  # Imported only within protected runner; pure tests need no DB.

    # No user-supplied SQL parameters, table names or season selectors.
    with psycopg.connect(
        host=os.environ["PGHOST"], user=os.environ["PGUSER"],
        password=os.environ["PGPASSWORD"], dbname=os.environ["PGDATABASE"],
        sslmode="verify-full", sslrootcert=os.environ["PGSSLROOTCERT"],
        connect_timeout=10,
        options="-c default_transaction_read_only=on -c statement_timeout=120000",
    ) as conn:
        with conn.cursor() as cur:
            cur.execute("SET TRANSACTION READ ONLY")
            cur.execute(sql)
            columns = tuple(desc.name for desc in cur.description)
            if columns != COLUMNS:
                raise RuntimeError("unexpected result shape")
            aggregate_rows = [dict(zip(columns, row, strict=True)) for row in cur.fetchall()]
            conn.rollback()
    receipt = audit_owner_study_aggregates(
        aggregate_rows, code_sha=os.environ["GITHUB_SHA"], sql_text=sql
    )
    print(dumps(asdict(receipt), sort_keys=True, separators=(",", ":")))


if __name__ == "__main__":
    try:
        main()
    except Exception:
        # Do not log private SQL results, database details, credentials or IDs.
        print("FAIL: bounded M3 owner study did not complete", file=sys.stderr)
        sys.exit(2)
