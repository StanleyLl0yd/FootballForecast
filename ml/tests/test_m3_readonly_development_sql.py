"""Regression contract for the read-only M3 real-development SQL observation.

Static checks are defence-in-depth, not a SQL sandbox or permission to publish.
The real SQL has been run separately against the seven development snapshots;
holdout 2025/26 is never read.
"""
import re
from pathlib import Path

import pytest

SQL_PATH = (
    Path(__file__).resolve().parents[2]
    / "research/sql/m3_development_poisson_observation.sql"
)
EXPECTED_SEASONS = (
    "2018/19", "2019/20", "2020/21", "2021/22",
    "2022/23", "2023/24", "2024/25",
)
EXPECTED_EXCLUSIONS = (
    ("2019/20", "2020-06-27", "0", "3", "technical"),
    ("2019/20", "2020-07-01", "0", "3", "technical"),
    ("2019/20", "2020-07-16", "3", "0", "technical"),
    ("2019/20", "2020-07-22", "3", "0", "technical"),
    ("2020/21", "2020-09-13", "0", "3", "technical"),
    ("2020/21", "2020-09-19", "3", "0", "technical"),
    ("2022/23", "2023-03-19", "0", "3", "revised_official"),
)


def _code(sql: str) -> str:
    return "\n".join(line.partition("--")[0] for line in sql.splitlines()).strip()


def audit_static_m3_sql(sql: str) -> None:
    """Assert a narrow pre-registered query shape; does not parse arbitrary SQL."""
    code = _code(sql)
    assert code.lower().startswith("with seasons(")
    assert code.endswith(";")
    assert code.count(";") == 1
    forbidden = (
        "insert", "update", "delete", "drop", "alter", "truncate", "grant",
        "revoke", "copy", "execute", "call", "do", "create", "merge",
        "pg_read_file", "pg_ls_dir", "dblink", "http_get",
    )
    for keyword in forbidden:
        assert not re.search(rf"\b{keyword}\b", code, re.IGNORECASE)
    assert "2025/26" not in code and "2026/27" not in code
    # Only the original two private development tables are referenced.
    assert set(re.findall(r"ff_private\.([a-z_]+)", code)) == {
        "ff_rpl_history_snapshots", "ff_rpl_history_matches",
    }
    season_def = code.split("), exclusions(", 1)[0]
    assert tuple(re.findall(r"'(20\d\d/\d\d)'", season_def)) == EXPECTED_SEASONS
    excludes = code.split("exclusions(", 1)[1].split("), raw AS", 1)[0]
    extracted = tuple(re.findall(
        r"\('(20\d\d/\d\d)','(20\d\d-\d\d-\d\d)'::date,"
        r"(\d+),(\d+),'([a-z_]+)'\)",
        excludes,
    ))
    assert extracted == EXPECTED_EXCLUSIONS
    required_guards = (
        "count(*)=7 AND min(n)=240 AND max(n)=240",
        "min(h)=16 AND max(h)=16",
        "min(a)=16 AND max(a)=16",
        "min(pairs)=240 AND max(pairs)=240",
        "sum(invalid)=0",
        "SELECT count(*)=7 FROM tagged WHERE reason IS NOT NULL",
        "SELECT count(DISTINCT (season,kickoff_at::date,hg,ag))=7",
        "WHERE (SELECT ok FROM gate)",
        "e.season_order<f.season_order",
        "WHERE season_order>=2",
        "WHERE reason IS NULL",
    )
    for guard in required_guards:
        assert guard in code
    frozen = (
        "20*1.35", "20*1.05", "12*l.mu_h", "12*l.mu_a",
        "least(6.0,greatest(0.05", "generate_series(0,30)",
        "count(*) FILTER(WHERE t.label=0)+1",
        "count(*) FILTER(WHERE t.label=1)+1",
        "count(*) FILTER(WHERE t.label=2)+1",
    )
    for part in frozen:
        assert part in code
    final = code.rsplit("\nSELECT validation_season,max(train_n)", 1)
    assert len(final) == 2
    projection = final[1]
    assert "source_match_id" not in projection
    assert "home_team_id" not in projection
    assert "away_team_id" not in projection
    assert "kickoff_at" not in projection
    assert "paired_log_loss_gain" in projection
    assert "paired_gain_approx_95pct_halfwidth" in projection
    assert "count(*) FILTER (WHERE unseen)" in projection


def test_committed_read_only_query_contract() -> None:
    audit_static_m3_sql(SQL_PATH.read_text(encoding="utf-8"))


@pytest.mark.parametrize("old,new", [
    ("'2018/19',0", "'2025/26',0"),
    ("('2019/20','2020-06-27'::date,0,3,'technical')",
     "('2019/20','2020-06-27'::date,0,4,'technical')"),
    ("min(n)=240 AND max(n)=240", "min(n)=241 AND max(n)=240"),
    ("e.season_order<f.season_order", "e.season_order<=f.season_order"),
    ("20*1.35", "20*1.45"),
    ("12*l.mu_h", "8*l.mu_h"),
    ("WHERE reason IS NULL", "WHERE reason IS NOT NULL"),
    ("WHERE (SELECT ok FROM gate)", "WHERE true"),
    ("count(*) FILTER(WHERE t.label=0)+1",
     "count(*) FILTER(WHERE t.label=0)+2"),
    ("count(*) FILTER (WHERE unseen)", "count(*) FILTER (WHERE false)"),
])
def test_mutated_development_contract_is_rejected(old: str, new: str) -> None:
    source = SQL_PATH.read_text(encoding="utf-8")
    assert old in source
    with pytest.raises(AssertionError):
        audit_static_m3_sql(source.replace(old, new))


@pytest.mark.parametrize("injection", [
    "DELETE FROM ff_private.ff_rpl_history_matches;",
    "INSERT INTO public.predictions VALUES (1);",
    "UPDATE ff_private.ff_rpl_history_snapshots SET model_training_approved=true;",
    "COPY (SELECT * FROM ff_private.ff_rpl_history_matches) TO STDOUT;",
])
def test_mutating_or_exfiltrating_statement_is_not_allowed(injection: str) -> None:
    source = SQL_PATH.read_text(encoding="utf-8")
    with pytest.raises(AssertionError):
        audit_static_m3_sql(source + "\n" + injection)
