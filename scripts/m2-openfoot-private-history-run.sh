#!/usr/bin/env bash
# Protected research-only import; source records never enter CI logs/artifacts.
set -euo pipefail
umask 077
[[ "$GITHUB_REPOSITORY" == 'StanleyLl0yd/FootballForecast' ]]
[[ "$GITHUB_REF" == 'refs/heads/main' ]]
[[ "$GITHUB_ACTOR" == 'StanleyLl0yd' ]]
[[ "$(git rev-parse HEAD)" == "$GITHUB_SHA" ]]
[[ "$GITHUB_RUN_ID" =~ ^[0-9]{1,18}$ ]]
if [[ ! "$OPENFOOT_API_KEY" =~ ^of_live_[A-Za-z0-9_-]{8,256}$ ]]; then
  echo 'M2_PRIVATE_ARCHIVE=REFUSED_FREE_STARTER_KEY'; exit 2
fi
[[ -n "$PGHOST" && -n "$PGUSER" && -n "$PGDATABASE" && -n "$PGPASSWORD" ]] || {
  echo 'M2_PRIVATE_ARCHIVE=REFUSED_PROTECTED_DB_CREDENTIALS'; exit 2
}
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
if [[ -n "$M1_PGROOTCERT_B64" ]]; then
  printf '%s' "$M1_PGROOTCERT_B64" | base64 --decode > "$work/ca.crt"
else
  cp security/certs/supabase-root-2021-ca.crt "$work/ca.crt"
fi
cert_sha="$(openssl x509 -in "$work/ca.crt" -outform DER | sha256sum | cut -d ' ' -f1)"
[[ "$cert_sha" == '807025ad50d4ed219d2c9c7d299c004f824eb00cf7f65afef607d07b72e6cafa' ]] || {
  echo 'M2_PRIVATE_ARCHIVE=REFUSED_PINNED_CA'; exit 2
}
openssl x509 -in "$work/ca.crt" -noout -checkend 86400 >/dev/null
export PGSSLROOTCERT="$work/ca.crt" PYTHONDONTWRITEBYTECODE=1 PYTHONNOUSERSITE=1 PYTHONPATH=ml/src
printf 'header = "Authorization: Bearer %s"\n' "$OPENFOOT_API_KEY" > "$work/key.conf"
unset OPENFOOT_API_KEY
observed="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
index=0
for season in 2018/19 2019/20 2020/21 2021/22 2022/23 2023/24 2024/25; do
  index=$((index+1))
  dir="$work/$(printf '%02d' "$index")"
  mkdir "$dir"
  encoded="$(printf '%s' "$season" | sed 's@/@%2F@')"
  status="$(curl --silent --show-error --fail --proto '=https' --max-redirs 0 \
    --connect-timeout 8 --max-time 20 --max-filesize 200000 \
    --config "$work/key.conf" -H 'Accept: application/json' \
    -H 'User-Agent: FootballForecastM2Research/1.0 (https://github.com/StanleyLl0yd/FootballForecast)' \
    --output "$dir/seed.json" --write-out '%{http_code}' \
    "https://openfootapi.com/v1/matches?competition=comp_premier_league_rus&season=$encoded" \
    2>/dev/null || true)"
  if [[ "$status" != 200 || ! -s "$dir/seed.json" ]]; then
    echo "M2_PRIVATE_ARCHIVE=INCONCLUSIVE_SEED_$index"; exit 2
  fi
  if ! node scripts/m2-openfoot-seven-season-full-audit.mjs \
    discover "$dir/seed.json" "$season" "$dir/ids.txt"; then
    echo "M2_PRIVATE_ARCHIVE=INCONCLUSIVE_SEASON_SCOPE_$index"; exit 2
  fi
  sleep 1.2
  page=0
  while IFS= read -r team_id; do
    [[ "$team_id" =~ ^[A-Za-z0-9_-]{2,160}$ ]]
    page=$((page+1))
    file="$dir/$(printf '%02d' "$page").json"
    status="$(curl --silent --show-error --fail --proto '=https' --max-redirs 0 \
      --connect-timeout 8 --max-time 20 --max-filesize 200000 \
      --config "$work/key.conf" -H 'Accept: application/json' \
      -H 'User-Agent: FootballForecastM2Research/1.0 (https://github.com/StanleyLl0yd/FootballForecast)' \
      --output "$file" --write-out '%{http_code}' \
      "https://openfootapi.com/v1/matches?competition=comp_premier_league_rus&season=$encoded&team=$team_id" \
      2>/dev/null || true)"
    if [[ "$status" != 200 || ! -s "$file" ]]; then
      echo "M2_PRIVATE_ARCHIVE=INCONCLUSIVE_TEAM_$index"; exit 2
    fi
    if ! node scripts/m2-openfoot-seven-season-full-audit.mjs \
      check "$file" "$season" "$team_id"; then
      echo "M2_PRIVATE_ARCHIVE=INCONCLUSIVE_TEAM_SCOPE_$index"; exit 2
    fi
    sleep 1.2
  done < "$dir/ids.txt"
  [[ "$page" == 16 ]]
done
rm -f "$work/key.conf"
node scripts/m2-openfoot-private-history-validate.mjs "$work" "$work" "$observed"
python -m football_forecast.research.openfoot_history_store \
  "$work/manifest.json" "$work/history.jsonl" > "$work/receipt.json"
node --input-type=module - "$work/receipt.json" <<'RECEIPT'
import {readFileSync} from 'node:fs';
const b=readFileSync(process.argv[2]);
if(b.length<10||b.length>4096)process.exit(2);
const v=JSON.parse(b.toString('utf8'));
const keys=['schemaVersion','kind','sourceResponsesSha256','normalizedSha256',
  'codeSha','githubRunId','storedRunId','seasons','matches','privateArchiveStored',
  'insertedByThisRun','databaseReadbackVerified','researchState',
  'modelTrainingApproved','holdoutRead','productionForecastsWritten'];
if(Object.keys(v).length!==keys.length||Object.keys(v).some(k=>!keys.includes(k))||
  v.schemaVersion!==1||v.kind!=='M2_OPENFOOT_PRIVATE_RPL_HISTORY_ARCHIVE'||
  !/^[a-f0-9]{40}$/.test(v.codeSha)||v.codeSha!==process.env.GITHUB_SHA||
  !/^[a-f0-9]{64}$/.test(v.sourceResponsesSha256)||
  !/^[a-f0-9]{64}$/.test(v.normalizedSha256)||
  v.githubRunId!==Number(process.env.GITHUB_RUN_ID)||
  !Number.isSafeInteger(v.storedRunId)||v.storedRunId<1||
  v.seasons!==7||v.matches!==1680||v.privateArchiveStored!==true||
  typeof v.insertedByThisRun!=='boolean'||v.databaseReadbackVerified!==true||
  v.researchState!=='SOURCE_ARCHIVE_ONLY_UNAPPROVED'||
  v.modelTrainingApproved!==false||v.holdoutRead!==false||
  v.productionForecastsWritten!==0)process.exit(2);
RECEIPT
echo "M2_PRIVATE_SEVEN_SEASON_ARCHIVE=$(cat "$work/receipt.json")"
{
  echo '## M2 private seven-season RPL historical archive'
  echo '1680 historical results persisted in protected append-only PostgreSQL tables.'
  echo 'No public source rows, credential disclosure, model fit, sealed holdout or forecasts.'
  echo '~~~json'
  cat "$work/receipt.json"
  echo
  echo '~~~'
} >> "$GITHUB_STEP_SUMMARY"
