#!/usr/bin/env bash
# M2 owner-only PRE-HOLDOUT metadata audit. Zero 2025/26 row reads/writes.
set -euo pipefail
umask 077
[[ "${GITHUB_REPOSITORY:-}" == 'StanleyLl0yd/FootballForecast' ]]
[[ "${GITHUB_REF:-}" == 'refs/heads/main' ]]
[[ "$(git rev-parse HEAD)" == "${GITHUB_SHA:-}" ]]
[[ "${GITHUB_RUN_ID:-}" =~ ^[0-9]{1,18}$ ]]
for name in PGHOST PGUSER PGDATABASE PGPASSWORD; do
  [[ -n "${!name:-}" ]] || { echo 'FAIL: protected DB credentials unavailable'; exit 2; }
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
  echo 'FAIL: pinned private DB CA mismatch'; exit 2;
}
openssl x509 -in "$work/ca.crt" -noout -checkend 86400 >/dev/null
export PGSSLROOTCERT="$work/ca.crt"
export PYTHONPATH=ml/src PYTHONDONTWRITEBYTECODE=1 PYTHONNOUSERSITE=1
python -m football_forecast.research.openfootball_roster_preflight > "$work/receipt.json"
node --input-type=module - "$work/receipt.json" <<'M2_RECEIPT'
import {readFileSync} from 'node:fs';
const bytes=readFileSync(process.argv[2]);
if(!bytes.length||bytes.length>4096)throw Error('Refuse oversized private receipt');
const v=JSON.parse(bytes.toString('utf8'));
const fields=['schemaVersion','kind','protocol','codeSha','trainOnlyClubCount',
'returningClubCount','unseenClubCount','trainAliasSetSha256',
'trainModelArtifactSha256','trainFittedModelSha256',
'privateHoldoutSnapshotIdentitySha256','candidateCrosswalkSha256',
'realPrivateTrainMetadataVerified','externalHoldoutSourceRechecked',
'holdoutRead','modelApproved','immutableStudyLockApproved',
'holdoutEvaluationPermitted','productionForecastsWritten'];
const digest=/^[a-f0-9]{64}$/;
if(Object.keys(v).length!==fields.length||fields.some(k=>!Object.hasOwn(v,k))||
   v.schemaVersion!==1||v.kind!=='M2_PROTECTED_PREHOLDOUT_ROSTER_PREFLIGHT'||
   v.protocol!=='m2-openfootball-calendar-v1'||v.codeSha!==process.env.GITHUB_SHA||
   v.trainOnlyClubCount!==16||v.returningClubCount!==14||v.unseenClubCount!==2||
   ['trainAliasSetSha256','trainModelArtifactSha256','trainFittedModelSha256',
    'privateHoldoutSnapshotIdentitySha256','candidateCrosswalkSha256']
     .some(k=>!digest.test(v[k]))||
   v.trainAliasSetSha256!=='3f10e2bd77f348b570036efc8827f0571a26cae55c7dcb4ad93b5a39710e631b'||
   v.privateHoldoutSnapshotIdentitySha256!=='afe82bbf33d6e547403ef1ce9505493a655661e0e0f78dffecaea9e857f5b191'||
   v.candidateCrosswalkSha256!=='99ad249ceae34aa8fd12d77be8e4b58ad8b80ec87b169021b5ca962d176080b2'||
   v.realPrivateTrainMetadataVerified!==true||
   v.externalHoldoutSourceRechecked!==false||
   v.holdoutRead!==false||v.modelApproved!==false||
   v.immutableStudyLockApproved!==false||
   v.holdoutEvaluationPermitted!==false||v.productionForecastsWritten!==0)
  throw Error('M2 private roster preflight not proven');
M2_RECEIPT
echo "M2_PREHOLDOUT_ROSTER_PREFLIGHT_JSON=$(cat "$work/receipt.json")"
echo "M2_PREHOLDOUT_ROSTER_PREFLIGHT_SHA256=$(sha256sum "$work/receipt.json" | cut -d ' ' -f1)"
{
  echo '## M2 owner-only pinned 2024 train roster preflight — NOT AN APPROVED STUDY LOCK'
  echo 'Private PostgreSQL transaction READ ONLY; 2024 train club metadata only.'
  echo 'No 2025/26 matches, match IDs, scores, kickoff, model fit or predictions.'
  echo 'All raw team/source IDs stayed in memory, no artifacts uploaded.'
  echo '~~~json'
  cat "$work/receipt.json"
  echo
  echo '~~~'
} >> "$GITHUB_STEP_SUMMARY"
