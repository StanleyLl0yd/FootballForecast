#!/usr/bin/env bash
# One irreversible, owner-authorized, PRIVATE M2 first score on 2025/26.
set -euo pipefail
umask 077
[[ "${GITHUB_REPOSITORY:-}" == 'StanleyLl0yd/FootballForecast' ]]
[[ "${GITHUB_REF:-}" == 'refs/heads/main' ]]
[[ "${GITHUB_ACTOR:-}" == 'StanleyLl0yd' ]]
[[ "${GITHUB_EVENT_NAME:-}" == 'issue_comment' ]]
[[ "${GITHUB_RUN_ATTEMPT:-}" == '1' ]]
[[ "$(git rev-parse HEAD)" == "${GITHUB_SHA:-}" ]]
[[ "${GITHUB_RUN_ID:-}" =~ ^[1-9][0-9]{0,17}$ ]]
for name in PGHOST PGUSER PGDATABASE PGPASSWORD GITHUB_EVENT_PATH; do
  [[ -n "${!name:-}" ]] || { echo 'FAIL: protected runtime inputs unavailable'; exit 2; }
done
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
if [[ -n "${M1_PGROOTCERT_B64:-}" ]]; then
  printf '%s' "$M1_PGROOTCERT_B64" | base64 --decode > "$work/ca.crt"
else
  cp security/certs/supabase-root-2021-ca.crt "$work/ca.crt"
fi
fingerprint="$(openssl x509 -in "$work/ca.crt" -outform DER | sha256sum | cut -d ' ' -f1)"
[[ "$fingerprint" == '807025ad50d4ed219d2c9c7d299c004f824eb00cf7f65afef607d07b72e6cafa' ]] || {
  echo 'FAIL: pinned private PostgreSQL CA mismatch'; exit 2;
}
openssl x509 -in "$work/ca.crt" -noout -checkend 86400 >/dev/null
export PGSSLROOTCERT="$work/ca.crt"
export PYTHONPATH=ml/src PYTHONDONTWRITEBYTECODE=1 PYTHONNOUSERSITE=1
# The script irrevocably commits a DB claim before its first CSV GET.
python -m football_forecast.research.football_data_first_run > "$work/receipt.json"
node --input-type=module - "$work/receipt.json" <<'RECEIPT'
import {readFileSync} from 'node:fs';
const bytes=readFileSync(process.argv[2]);
if(!bytes.length||bytes.length>4096)throw Error('Invalid bounded aggregate-only receipt');
const v=JSON.parse(bytes.toString('utf8'));
const keys=['schemaVersion','kind','studyId','codeSha','githubRunId',
'declarationSha256','sourceSha256','selectedRowsSha256',
'predeclaredNamesSha256','privateAggregateSha256','eligibleMatches',
'abstentions','scoreMetricsPrivate','rawLabelsPublished',
'strictAsOfBacktestClaimed','productionForecastsWritten','oneUseReservationConsumed'];
const sha=/^[a-f0-9]{64}$/;
if(Object.keys(v).length!==keys.length||keys.some(k=>!Object.hasOwn(v,k))||
 v.schemaVersion!==1||v.kind!=='M2_FIRST_PRIVATE_FIXED_SCORE_STORED'||
 v.studyId!=='rpl-2025-26-football-data-fixed-poisson-v1'||
 v.codeSha!==process.env.GITHUB_SHA||
 v.githubRunId!==Number(process.env.GITHUB_RUN_ID)||
 ['declarationSha256','sourceSha256','selectedRowsSha256',
 'predeclaredNamesSha256','privateAggregateSha256'].some(k=>!sha.test(v[k]))||
 v.eligibleMatches!==182||v.abstentions!==58||
 v.scoreMetricsPrivate!==true||v.rawLabelsPublished!==false||
 v.strictAsOfBacktestClaimed!==false||v.productionForecastsWritten!==0||
 v.oneUseReservationConsumed!==true)throw Error('Private M2 one-use receipt denied');
RECEIPT
echo "M2_PRIVATE_FIRST_SCORE_RECEIPT=$(cat "$work/receipt.json")"
echo "M2_PRIVATE_FIRST_SCORE_RECEIPT_SHA256=$(sha256sum "$work/receipt.json" | cut -d ' ' -f1)"
{
  echo '## M2 private first fixed-model score — one-use reservation consumed'
  echo 'Exact owner GitHub comment + protected main + immutable private PostgreSQL.'
  echo 'All raw source rows and fitted model coefficients kept out of Actions logs.'
  echo 'Only source/cohort digests and counts are published; numeric metrics private.'
  echo 'DAY_ONLY; no authenticated kickoff/as-of, training, tuning, odds superiority or public forecast.'
  echo '~~~json'
  cat "$work/receipt.json"
  echo
  echo '~~~'
} >> "$GITHUB_STEP_SUMMARY"
