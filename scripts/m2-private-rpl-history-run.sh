#!/usr/bin/env bash
# Owner-only $0 historical RPL import; source records never leave private runner.
set -euo pipefail
umask 077
[[ "$GITHUB_REPOSITORY" == 'StanleyLl0yd/FootballForecast' ]]
[[ "$GITHUB_REF" == 'refs/heads/main' ]]
[[ "$GITHUB_ACTOR" == 'StanleyLl0yd' ]]
[[ "$(git rev-parse HEAD)" == "$GITHUB_SHA" ]]
[[ "$GITHUB_RUN_ID" =~ ^[0-9]{1,18}$ ]]
[[ "$FF_M2_PRIVATE_IMPORT_ENABLED" == 1 ]]
for name in OPENFOOT_API_KEY PGHOST PGUSER PGDATABASE PGPASSWORD; do
  [[ -n "$(printenv "$name")" ]] || { echo 'FAIL: protected credentials unavailable'; exit 2; }
done
[[ "$OPENFOOT_API_KEY" =~ ^of_live_[A-Za-z0-9_-]{8,256}$ ]] || {
  echo 'FAIL: unexpected Starter key format'; exit 2;
}
[[ "$PGSSLMODE" == 'verify-full' && "$PGPORT" == '5432' ]] || {
  echo 'FAIL: database TLS or port not verified'; exit 2;
}
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
mkdir -m 0700 "$work/private"
if [[ -n "$M1_PGROOTCERT_B64" ]]; then
  printf '%s' "$M1_PGROOTCERT_B64" | base64 --decode > "$work/ca.crt"
else
  cp security/certs/supabase-root-2021-ca.crt "$work/ca.crt"
fi
fingerprint="$(openssl x509 -in "$work/ca.crt" -outform DER | sha256sum | cut -d ' ' -f1)"
[[ "$fingerprint" == '807025ad50d4ed219d2c9c7d299c004f824eb00cf7f65afef607d07b72e6cafa' ]] || {
  echo 'FAIL: unexpected Supabase CA fingerprint'; exit 2;
}
openssl x509 -in "$work/ca.crt" -noout -checkend 86400 >/dev/null
export PGSSLROOTCERT="$work/ca.crt"
printf 'header = "Authorization: Bearer %s"\n' "$OPENFOOT_API_KEY" > "$work/key.conf"
unset OPENFOOT_API_KEY
observed="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
index=0
for season in 2018/19 2019/20 2020/21 2021/22 2022/23 2023/24 2024/25; do
  index=$((index+1))
  folder="$work/$(printf '%02d' "$index")"
  mkdir -m 0700 "$folder"
  encoded="$(printf '%s' "$season" | sed 's@/@%2F@')"
  status="$(curl --fail --silent --show-error --proto '=https' --max-redirs 0 \
    --connect-timeout 8 --max-time 20 --max-filesize 200000 \
    --config "$work/key.conf" -H 'Accept: application/json' \
    -H 'User-Agent: FootballForecastM2PrivateResearch/1.0 (https://github.com/StanleyLl0yd/FootballForecast)' \
    --output "$folder/seed.json" --write-out '%{http_code}' \
    "https://openfootapi.com/v1/matches?competition=comp_premier_league_rus&season=$encoded" \
    2>/dev/null || true)"
  [[ "$status" == 200 && -s "$folder/seed.json" ]] || {
    echo "FAIL: bounded source seed request unavailable at index $index"; exit 2;
  }
  node scripts/m2-openfoot-seven-season-full-audit.mjs \
    discover "$folder/seed.json" "$season" "$folder/ids.txt" || {
      echo "FAIL: source seed validation at index $index"; exit 2;
    }
  sleep 1.2
  page=0
  while IFS= read -r team_id; do
    [[ "$team_id" =~ ^[A-Za-z0-9_-]{2,160}$ ]] || {
      echo 'FAIL: invalid team identity'; exit 2;
    }
    page=$((page+1))
    file="$folder/$(printf '%02d' "$page").json"
    status="$(curl --fail --silent --show-error --proto '=https' --max-redirs 0 \
      --connect-timeout 8 --max-time 20 --max-filesize 200000 \
      --config "$work/key.conf" -H 'Accept: application/json' \
      -H 'User-Agent: FootballForecastM2PrivateResearch/1.0 (https://github.com/StanleyLl0yd/FootballForecast)' \
      --output "$file" --write-out '%{http_code}' \
      "https://openfootapi.com/v1/matches?competition=comp_premier_league_rus&season=$encoded&team=$team_id" \
      2>/dev/null || true)"
    [[ "$status" == 200 && -s "$file" ]] || {
      echo "FAIL: bounded team request unavailable at index $index"; exit 2;
    }
    node scripts/m2-openfoot-seven-season-full-audit.mjs check "$file" "$season" "$team_id" || {
      echo "FAIL: private team source schema at index $index"; exit 2;
    }
    sleep 1.2
  done < "$folder/ids.txt"
  [[ "$page" == 16 ]] || { echo 'FAIL: expected 16 team pages'; exit 2; }
done
rm -f "$work/key.conf"
node scripts/m2-private-rpl-history-normalize.mjs \
  "$work" "$observed" "$work/private/history.json"
export PYTHONPATH=ml/src PYTHONDONTWRITEBYTECODE=1 PYTHONNOUSERSITE=1
python -m football_forecast.data.rpl_private_history \
  "$work/private/history.json" > "$work/private/receipt.json"
node scripts/m2-private-rpl-history-receipt.mjs "$work/private/receipt.json" \
  > "$work/private/safe-summary.json"
echo "M2_PRIVATE_RPL_HISTORY_OBSERVATION=$(cat "$work/private/safe-summary.json")"
{
  echo '## RPL private historical source: seven complete development seasons'
  echo 'Only aggregate counts; no provider records, credentials or source rows exported.'
  echo 'No sealed holdout, model training or public forecast writes.'
  echo '~~~json'
  cat "$work/private/safe-summary.json"
  echo
  echo '~~~'
} >> "$GITHUB_STEP_SUMMARY"
