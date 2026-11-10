#!/usr/bin/env python3
"""Protected SELECT-only two-season correlation; never export a private row.

Both public season pages are processed in memory. All private fixtures,
source IDs, per-match scores, and identity matching stay inside PostgreSQL.
Only two aggregate result rows return to the runner, then counts/SHA to log.
"""
import os
import sys
from hashlib import sha256
from json import dumps
from pathlib import Path
from urllib.request import Request, urlopen

from football_forecast.research.m3_rsssf_match_schedule import parse_rsssf_rpl

URLS = (
    ("2021/22", "https://www.rsssf.org/tablesr/rus2022.html"),
    ("2022/23", "https://www.rsssf.org/tablesr/rus2023.html"),
)
COLUMNS = (
    "season", "mapped_clubs", "matched_fixtures",
    "official_score_agreements", "official_score_disagreements",
    "revised_official_excluded", "candidate_played_score_agreements",
    "shared_clubs", "stable_clubs",
)


def main() -> None:
    if (os.environ.get("GITHUB_REPOSITORY") != "StanleyLl0yd/FootballForecast"
            or os.environ.get("GITHUB_REF") != "refs/heads/main"
            or os.environ.get("GITHUB_ACTOR") != "StanleyLl0yd"):
        raise RuntimeError("unauthorized research context")
    public_input = []
    source_shas = []
    for season, url in URLS:
        request = Request(url, headers={"User-Agent": "FootballForecast-research/1.0"})
        with urlopen(request, timeout=25) as response:
            if response.geturl() != url or response.status != 200:
                raise RuntimeError("unexpected source response")
            raw = response.read(3_000_001)
        if len(raw) > 3_000_000:
            raise RuntimeError("oversized source")
        source_shas.append(sha256(raw).hexdigest())
        for fixture in parse_rsssf_rpl(raw, season):
            public_input.append({
                "season": fixture.season, "match_date": fixture.day.isoformat(),
                "home_alias": fixture.home, "away_alias": fixture.away,
                "hg": fixture.home_goals, "ag": fixture.away_goals,
                "revised": fixture.official_result_revised,
            })
    if len(public_input) != 480:
        raise RuntimeError("missing public fixture rows")

    import psycopg  # Only the protected runner has DB credentials.

    sql = (Path(__file__).resolve().parents[1]
           / "research/sql/m3_480_owner_correspondence.sql").read_text(encoding="utf-8")
    if sql.count("%s") != 1 or len(sql) > 15000:
        raise RuntimeError("untrusted fixed SQL")
    # All private fixture computations take place in PostgreSQL.
    # Parameter contains PUBLIC-only fixtures; the SELECT returns aggregates.
    with psycopg.connect(
        host=os.environ["PGHOST"], user=os.environ["PGUSER"],
        password=os.environ["PGPASSWORD"], dbname=os.environ["PGDATABASE"],
        sslmode="verify-full", sslrootcert=os.environ["PGSSLROOTCERT"],
        connect_timeout=10,
        options="-c default_transaction_read_only=on -c statement_timeout=120000",
    ) as conn:
        with conn.cursor() as cur:
            cur.execute("SET TRANSACTION READ ONLY")
            cur.execute(sql, (dumps(public_input, separators=(",", ":")),))
            if tuple(column.name for column in cur.description) != COLUMNS:
                raise RuntimeError("unexpected aggregate schema")
            result = [dict(zip(COLUMNS, row, strict=True)) for row in cur.fetchall()]
            conn.rollback()
    if len(result) != 2 or [r["season"] for r in result] != ["2021/22", "2022/23"]:
        raise RuntimeError("incomplete private aggregate")
    for row in result:
        if any(type(row[k]) is not int or not 0 <= row[k] <= 480 for k in COLUMNS[1:]):
            raise RuntimeError("untrusted aggregate values")
        if row["official_score_agreements"] + row["official_score_disagreements"] != row["matched_fixtures"]:
            raise RuntimeError("inconsistent aggregate score count")
        if row["revised_official_excluded"] + row["candidate_played_score_agreements"] != row["official_score_agreements"]:
            raise RuntimeError("inconsistent role count")

    # Never echo the SELECT results or private data; only selected counts + digest.
    receipt = {"kind": "M3_TWO_SEASON_OWNER_SQL_AGGREGATES",
               "sha": os.environ["GITHUB_SHA"], "source_shas": source_shas,
               "sql_sha256": sha256(sql.encode()).hexdigest(), "seasons": result,
               "holdout2025_26Read": False, "privateRowsExported": False}
    digest = sha256(dumps(receipt, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    print("M3_CORRELATION_SHA256=" + digest)
    print("M3_MAPPED_CLUBS=" + str(sum(x["mapped_clubs"] for x in result)) + "/32")
    print("M3_MATCHED_FIXTURES=" + str(sum(x["matched_fixtures"] for x in result)) + "/480")
    print("M3_PLAYED_SCORE_CANDIDATES=" +
          str(sum(x["candidate_played_score_agreements"] for x in result)) + "/479")
    print("M3_SCORE_DISAGREEMENTS=" +
          str(sum(x["official_score_disagreements"] for x in result)))
    print("M3_CROSS_SEASON_STABLE_CLUB_IDS=" + str(result[0]["stable_clubs"])
          + "/" + str(result[0]["shared_clubs"]))
    print("M3_FULLY_CORRESPONDED=" + str(
        all(x["mapped_clubs"] == 16 and x["matched_fixtures"] == 240
            and x["official_score_disagreements"] == 0
            and x["revised_official_excluded"] == int(x["season"] == "2022/23")
            for x in result)
        and result[0]["shared_clubs"] == result[1]["shared_clubs"]
        and result[0]["stable_clubs"] == result[1]["stable_clubs"]))


if __name__ == "__main__":
    try:
        main()
    except Exception:
        print("FAIL: private RPL crosswalk inconclusive", file=sys.stderr)
        sys.exit(2)
