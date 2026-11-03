"""PostgreSQL 17 integration for the actual protected seven-season storage writer.

The fixture is synthetic. No OpenFoot network traffic, credentials, or held-out labels.
"""
import os
import sys

import psycopg

from football_forecast.data.rpl_private_history import persist_history, validate_history_document

sys.path.insert(0, "ml/tests")
from test_private_rpl_history import document  # noqa: E402


def main() -> None:
    source, rows = validate_history_document(document())
    with psycopg.connect(
        host="127.0.0.1",
        dbname="postgres",
        user="postgres",
        password=os.environ["PGPASSWORD"],
        sslmode="disable",
        connect_timeout=10,
    ) as connection:
        first = persist_history(connection, source, rows)
    if (first["storedSeasons"] != 7 or first["storedMatchesVerified"] != 1680
            or first["insertedNewSnapshots"] != 7
            or first["existingSnapshotsVerified"] != 0
            or first["holdoutRead"] is not False):
        raise AssertionError("synthetic initial seven-season insert mismatch")

    with psycopg.connect(
        host="127.0.0.1",
        dbname="postgres",
        user="postgres",
        password=os.environ["PGPASSWORD"],
        sslmode="disable",
        connect_timeout=10,
    ) as connection:
        replay = persist_history(connection, source, rows)
        counts = connection.execute(
            "select "
            "(select count(*) from ff_private.ff_rpl_history_snapshots),"
            "(select count(*) from ff_private.ff_rpl_history_matches),"
            "(select count(*) from ff_private.ff_rpl_history_snapshots "
            " where model_training_approved or holdout_read or historical_prematch_verified),"
            "(select count(*) from ff_private.ff_rpl_history_matches "
            " where source_publication_at is not null)"
        ).fetchone()
    if (replay["insertedNewSnapshots"] != 0 or replay["existingSnapshotsVerified"] != 7
            or replay["storedMatchesVerified"] != 1680
            or counts != (7, 1680, 0, 0)):
        raise AssertionError("synthetic idempotent replay or private constraints mismatch")

    print("PASS: real PostgreSQL 17 seven-season storage and idempotent readback")


if __name__ == "__main__":
    main()
