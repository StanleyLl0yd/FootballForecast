"""Disposable PostgreSQL 17 integration: only synthetic historical fixtures."""
import os
import sys

import psycopg

from football_forecast.research.openfoot_history_store import store_archive

sys.path.insert(0, "ml/tests")
from test_m2_openfoot_private_history import fixture  # noqa: E402


def main():
    manifest, data = fixture()
    kwargs = {
        "host": "127.0.0.1", "user": "postgres", "password": os.environ["PGPASSWORD"],
        "dbname": "postgres", "sslmode": "disable", "connect_timeout": 10,
    }
    with psycopg.connect(**kwargs) as conn:
        first = store_archive(conn, manifest, data)
    if not first["databaseReadbackVerified"] or not first["insertedByThisRun"]:
        raise AssertionError("synthetic private history first storage failed")
    with psycopg.connect(**kwargs) as conn:
        replay = store_archive(conn, manifest, data)
        counts = conn.execute("""
            select (select count(*) from ff_private.ff_rpl_history_snapshots),
                   (select count(*) from ff_private.ff_rpl_history_matches),
                   (select count(distinct season) from ff_private.ff_rpl_history_snapshots)
        """).fetchone()
    if (not replay["databaseReadbackVerified"] or replay["insertedByThisRun"]
            or counts != (7, 1680, 7)):
        raise AssertionError("synthetic archive replay or database counts mismatch")
    print("PASS: private seven-season archive PostgreSQL transaction, readback and idempotency")


if __name__ == "__main__":
    main()
