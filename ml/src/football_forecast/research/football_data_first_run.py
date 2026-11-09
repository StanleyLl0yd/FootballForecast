"""One irreversible private RPL 2025/26 fixed-Poisson study executor.

Only an exact protected GitHub OWNER issue-comment may invoke this module.
The PostgreSQL claim commits BEFORE the first result-bearing source GET.
Both claim and aggregate-only result tables are immutable/privileged.
Any failure after claim irrevocably consumes the study (no holdout-driven redo).
No source rows, provider IDs, model coefficients, or score metrics are logged.
"""
import json
import os
import sys
from hashlib import sha256
from pathlib import Path
from re import fullmatch
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import (
    HTTPRedirectHandler,
    Request,
    build_opener,
)

from football_forecast.data.contracts import DataError
from football_forecast.data.openfootball_training import PROTOCOL
from football_forecast.research.football_data_day_only import (
    _FROZEN_MODEL_ARTIFACT,
    _FROZEN_MODEL_FITTED,
    _NAME_POLICY_SHA,
    _SOURCE,
    parse_russian_2025_csv,
    score_fixed_day_only,
)
from football_forecast.research.locking import _digest
from football_forecast.research.model_escrow import load_private_model
from football_forecast.research.openfootball_escrow import _private_connection

_STUDY_ID = "rpl-2025-26-football-data-fixed-poisson-v1"
_COMMAND = "/m2-private-fixed-first-score-2025-26"
_OWNER_USER_ID = 131160519
_DECLARATION = Path("docs/M2_FIRST_FIXED_RETRO_STUDY_INTENT.json")
_MAX_SOURCE_BYTES = 15_000_000

_SQL_MODEL = """
select model_bytes,model_artifact_sha256,fitted_model_sha256,
       research_state,holdout_read,model_approved
from ff_private.ff_m2_training_model_escrow
where protocol='m2-openfootball-calendar-v1'
"""
_SQL_CLAIM = """
insert into ff_private.ff_m2_one_use_study_claims (
  study_id,study_declaration_sha256,code_sha,github_run_id,
  predeclared_names_sha256,source_uri,model_artifact_sha256,
  fitted_model_sha256,research_classification,source_scope,
  committed_before_first_label_read,prediction_publication_permitted
) values (%s,%s,%s,%s,%s,%s,%s,%s,
          'NON_STRICT_RETROSPECTIVE','OWNER_PERSONAL_RESEARCH',true,false)
"""
_SQL_RESULT = """
insert into ff_private.ff_m2_one_use_study_results (
  study_id,github_run_id,source_sha256,selected_rows_sha256,
  predeclared_names_sha256,total_fixtures,eligible_fixtures,abstentions,
  kickoff_time_quality,model_log_loss,model_brier,model_rps,
  prior_log_loss,prior_brier,prior_rps,model_top1_accuracy,
  prior_top1_accuracy,no_model_tuning,no_source_rows_published
) values (%s,%s,%s,%s,%s,240,182,58,'DAY_ONLY',
          %s,%s,%s,%s,%s,%s,%s,%s,true,true)
"""


def verified_event() -> tuple[str, int]:
    """Do not trust the workflow gate alone; validate event JSON again."""
    if (os.environ.get("GITHUB_REPOSITORY") != "StanleyLl0yd/FootballForecast"
            or os.environ.get("GITHUB_REF") != "refs/heads/main"
            or os.environ.get("GITHUB_ACTOR") != "StanleyLl0yd"
            or os.environ.get("GITHUB_EVENT_NAME") != "issue_comment"
            or os.environ.get("GITHUB_RUN_ATTEMPT") != "1"):
        raise DataError("M2 first evaluation: owner-only one-shot gate denied")
    sha = os.environ.get("GITHUB_SHA", "")
    run = os.environ.get("GITHUB_RUN_ID", "")
    if (not fullmatch(r"[a-f0-9]{40}", sha)
            or not isinstance(run, str)
            or not fullmatch(r"[1-9][0-9]{0,17}", run)):
        raise DataError("M2 first evaluation: invalid protected run identity")
    event_path = Path(os.environ.get("GITHUB_EVENT_PATH", ""))
    if (event_path.is_symlink() or not event_path.is_file()
            or not 0 < event_path.stat().st_size <= 100_000):
        raise DataError("M2 first evaluation: missing trusted event")
    data = json.loads(event_path.read_text(encoding="utf-8"))
    comment = data.get("comment")
    issue = data.get("issue")
    if (not isinstance(comment, dict) or not isinstance(issue, dict)
            or comment.get("body") != _COMMAND
            or comment.get("author_association") != "OWNER"
            or not isinstance(comment.get("user"), dict)
            or comment["user"].get("id") != _OWNER_USER_ID
            or comment["user"].get("login") != "StanleyLl0yd"
            or issue.get("number") != 182
            or issue.get("pull_request") is not None):
        raise DataError("M2 first evaluation: owner issue authorization missing")
    return sha, int(run)


def checked_declaration() -> str:
    if _DECLARATION.is_symlink() or not _DECLARATION.is_file():
        raise DataError("M2 first evaluation: missing protected study intent")
    blob = _DECLARATION.read_bytes()
    if not 100 < len(blob) < 15_000:
        raise DataError("M2 first evaluation: invalid study intent bytes")
    data = json.loads(blob.decode("utf-8"))
    train = data.get("fixedTraining", {})
    source = data.get("source", {})
    evaluation = data.get("evaluation", {})
    crosswalk = data.get("crosswalk", {})
    if (data.get("schemaVersion") != 1
            or data.get("kind") != "M2_FIRST_FIXED_POISSON_PRIVATE_RETROSPECTIVE_STUDY_INTENT"
            or source.get("uri") != _SOURCE
            or source.get("sourceByteSha256") is not None
            or source.get("selectedRowsSha256") is not None
            or source.get("status") != "UNFETCHED_SEALED"
            or train.get("protocol") != PROTOCOL
            or train.get("trainingModelArtifactSha256") != _FROZEN_MODEL_ARTIFACT
            or train.get("fixedModelSha256") != _FROZEN_MODEL_FITTED
            or train.get("trainingOnlyHdaCounts") != [103, 65, 72]
            or train.get("reTrainingPermitted") is not False
            or crosswalk.get("knownClubs") != 14
            or crosswalk.get("unseenClubs") != ["Балтика", "Сочи"]
            or crosswalk.get("mappingMayBeEditedAfterFirstSourceRead") is not False
            or evaluation.get("totalSeasonFixturesExpected") != 240
            or evaluation.get("modelEligibleExpected") != 182
            or evaluation.get("abstentionsExpected") != 58
            or evaluation.get("datePrecision") != "DAY_ONLY"
            or evaluation.get("tuningOnHoldoutPermitted") is not False
            or data.get("privatePersonalUse") is not True
            or data.get("dataRedistributionApproved") is not False
            or data.get("authorizedToFetchHoldout") is not False
            or data.get("immutableStudyLockAccepted") is not False
            or data.get("evaluated") is not False):
        raise DataError("M2 first evaluation: study declaration drift")
    return sha256(blob).hexdigest()


class _BoundedRedirect(HTTPRedirectHandler):
    """Keep all redirects HTTPS, only the same published country CSV."""
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        url = urlsplit(newurl)
        if (code not in (301, 302, 307, 308)
                or url.scheme != "https"
                or url.hostname not in ("football-data.co.uk", "www.football-data.co.uk")
                or url.port not in (None, 443)
                or url.path != "/new/RUS.csv"
                or url.query or url.fragment or url.username or url.password):
            raise DataError("M2 first evaluation: refused source redirect")
        # urllib's standard redirect behavior may turn HEAD into GET.
        # Preserve the method to guarantee the pre-reservation probe
        # NEVER downloads holdout labels, even across allowed redirects.
        return Request(
            newurl, method=req.get_method(), headers=dict(req.headers),
            origin_req_host=req.origin_req_host, unverifiable=True,
        )


def _http(method: str) -> bytes:
    """HEAD is allowed before reservation; the only GET happens after commit."""
    if method not in ("HEAD", "GET"):
        raise DataError("M2 first evaluation: unapproved source method")
    opener = build_opener(_BoundedRedirect())
    request = Request(
        _SOURCE, method=method,
        headers={
            "Accept": "text/csv, text/plain",
            "Accept-Encoding": "identity",
            "User-Agent": "FootballForecastPrivateM2/1.0 (personal research)",
        },
    )
    try:
        with opener.open(request, timeout=50) as response:
            if response.status != 200:
                raise DataError("M2 first evaluation: missing official CSV source")
            size = response.headers.get("Content-Length")
            if size is not None and (not size.isdecimal()
                                     or int(size) > _MAX_SOURCE_BYTES):
                raise DataError("M2 first evaluation: source content too large")
            if method == "HEAD":
                return b""
            data = response.read(_MAX_SOURCE_BYTES + 1)
    except (HTTPError, URLError, TimeoutError, OSError) as exc:
        raise DataError("M2 first evaluation: source unreachable") from exc
    if not 100 < len(data) <= _MAX_SOURCE_BYTES:
        raise DataError("M2 first evaluation: source invalid or oversized")
    return data


def run_once(*, code_sha: str, github_run_id: int) -> dict[str, object]:
    """Irreversibly reserve before GET; fail closed on missing source/score."""
    declaration_sha = checked_declaration()
    # Availability precheck only. HEAD receives no body and learns no labels.
    _http("HEAD")
    with _private_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(_SQL_MODEL)
            rows = cursor.fetchall()
            if len(rows) != 1:
                raise DataError("M2 first evaluation: model escrow ambiguous")
            model_payload, artifact, fitted, state, holdout, approved = rows[0]
            if (artifact != _FROZEN_MODEL_ARTIFACT
                    or fitted != _FROZEN_MODEL_FITTED
                    or state != "TRAIN_ONLY_UNAPPROVED"
                    or holdout is not False
                    or approved is not False):
                raise DataError("M2 first evaluation: frozen model state drift")
            model = load_private_model(
                bytes(model_payload), artifact_sha256=_FROZEN_MODEL_ARTIFACT,
                fitted_model_sha256=_FROZEN_MODEL_FITTED,
                expected_protocol=PROTOCOL,
            )
            cursor.execute(_SQL_CLAIM, (
                _STUDY_ID, declaration_sha, code_sha, github_run_id,
                _NAME_POLICY_SHA, _SOURCE,
                _FROZEN_MODEL_ARTIFACT, _FROZEN_MODEL_FITTED,
            ))
        # This commit MUST succeed BEFORE retrieving any result label.
        connection.commit()
        raw = _http("GET")
        batch = parse_russian_2025_csv(raw)
        result = score_fixed_day_only(
            model=model, batch=batch,
            expected_source_sha256=sha256(raw).hexdigest(),
            expected_cohort_sha256=batch.cohort_sha256,
            expected_name_policy_sha256=_NAME_POLICY_SHA,
        )
        m = result.metrics
        with connection.cursor() as cursor:
            cursor.execute(_SQL_RESULT, (
                _STUDY_ID, github_run_id, result.source_sha256,
                result.cohort_sha256, result.name_policy_sha256,
                m.model_log_loss, m.model_brier, m.model_rps,
                m.training_prior_log_loss, m.training_prior_brier,
                m.training_prior_rps, result.model_top1_accuracy,
                result.training_prior_top1_accuracy,
            ))
        connection.commit()
        return {
            "schemaVersion": 1,
            "kind": "M2_FIRST_PRIVATE_FIXED_SCORE_STORED",
            "studyId": _STUDY_ID,
            "codeSha": code_sha,
            "githubRunId": github_run_id,
            "declarationSha256": declaration_sha,
            "sourceSha256": result.source_sha256,
            "selectedRowsSha256": result.cohort_sha256,
            "predeclaredNamesSha256": result.name_policy_sha256,
            "privateAggregateSha256": _digest(result.as_dict()),
            "eligibleMatches": 182,
            "abstentions": 58,
            "scoreMetricsPrivate": True,
            "rawLabelsPublished": False,
            "strictAsOfBacktestClaimed": False,
            "productionForecastsWritten": 0,
            "oneUseReservationConsumed": True,
        }


def main() -> None:
    try:
        sha, run_id = verified_event()
        receipt = run_once(code_sha=sha, github_run_id=run_id)
        print(json.dumps(receipt, sort_keys=True, separators=(",", ":")))
    except Exception:
        # Never print DB exception/detail, raw labels, model bytes or tokens.
        print("INCONCLUSIVE: M2 first private evaluation stopped; reservation may be consumed",
              file=sys.stderr)
        raise SystemExit(2) from None


if __name__ == "__main__":
    main()
