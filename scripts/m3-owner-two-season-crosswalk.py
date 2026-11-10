#!/usr/bin/env python3
"""Read-only owner-only correlation of two RPL development seasons."""
import os
import sys
from hashlib import sha256
from json import dumps
from urllib.request import Request, urlopen

from football_forecast.research.m3_private_public_two_season_graph import (
    PrivateFixture,
    audit_two_season_fixture_correspondence,
)
from football_forecast.research.m3_rsssf_match_schedule import parse_rsssf_rpl

URLS = (
    ("2021/22", "https://www.rsssf.org/tablesr/rus2022.html"),
    ("2022/23", "https://www.rsssf.org/tablesr/rus2023.html"),
)
QUERY = """
SELECT s.season,m.kickoff_at,m.home_team_id,m.away_team_id,
       m.home_goals,m.away_goals,m.status
FROM ff_private.ff_rpl_history_snapshots s
JOIN ff_private.ff_rpl_history_matches m ON m.snapshot_id=s.id
WHERE s.season IN ('2021/22','2022/23')
ORDER BY s.season,m.kickoff_at,m.home_team_id,m.away_team_id
"""


def main() -> None:
    if (os.environ.get("GITHUB_REPOSITORY") != "StanleyLl0yd/FootballForecast"
            or os.environ.get("GITHUB_REF") != "refs/heads/main"
            or os.environ.get("GITHUB_ACTOR") != "StanleyLl0yd"):
        raise RuntimeError("unauthorized research context")
    public_rows = []
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
        public_rows.extend(parse_rsssf_rpl(raw, season))

    import psycopg  # Protected environment only, no public CI DB connection.

    with psycopg.connect(
        host=os.environ["PGHOST"], user=os.environ["PGUSER"],
        password=os.environ["PGPASSWORD"], dbname=os.environ["PGDATABASE"],
        sslmode="verify-full", sslrootcert=os.environ["PGSSLROOTCERT"],
        connect_timeout=10,
        options="-c default_transaction_read_only=on -c statement_timeout=120000",
    ) as conn:
        with conn.cursor() as cur:
            cur.execute("SET TRANSACTION READ ONLY")
            cur.execute(QUERY)
            private_rows = tuple(PrivateFixture(*row) for row in cur.fetchall())
            conn.rollback()
    audit = audit_two_season_fixture_correspondence(tuple(public_rows), private_rows)
    # Only aggregate diagnostics and their SHA; never return private ID arrays.
    safe = {
        "kind": "M3_PRIVATE_PUBLIC_TWO_SEASON_SCORE_FREE_AGGREGATE",
        "revisionSha": os.environ["GITHUB_SHA"],
        "publicSha256": source_shas,
        "mappedClubs": sum(x.independently_mapped_clubs for x in audit.seasons),
        "matchedFixtures": audit.total_date_direction_correspondences,
        "playedScoreCandidates": audit.candidate_played_score_agreements,
        "scoreDisagreements": audit.total_official_score_disagreements,
        "sharedClubs": audit.shared_clubs_between_seasons,
        "stableIds": audit.shared_clubs_with_stable_provider_id,
        "complete": audit.all_fixture_graphs_resolved,
        "holdout2025_26Read": False,
        "privateRowsExported": False,
    }
    digest = sha256(dumps(safe, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    print("M3_CORRELATION_SHA256=" + digest)
    print("M3_MAPPED_CLUBS=" + str(safe["mappedClubs"]) + "/32")
    print("M3_MATCHED_FIXTURES=" + str(safe["matchedFixtures"]) + "/480")
    print("M3_PLAYED_SCORE_CANDIDATES=" + str(safe["playedScoreCandidates"]) + "/479")
    print("M3_SCORE_DISAGREEMENTS=" + str(safe["scoreDisagreements"]))
    print("M3_CROSS_SEASON_STABLE_CLUB_IDS=" + str(safe["stableIds"])
          + "/" + str(safe["sharedClubs"]))
    print("M3_FULLY_CORRESPONDED=" + str(safe["complete"]))


if __name__ == "__main__":
    try:
        main()
    except Exception:
        print("FAIL: private RPL crosswalk inconclusive", file=sys.stderr)
        sys.exit(2)
