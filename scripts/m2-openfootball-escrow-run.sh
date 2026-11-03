#!/usr/bin/env bash
# Owner-only private OpenFootball CC0 model escrow; no holdout access.
set -euo pipefail
umask 077
[[ "${GITHUB_REPOSITORY:-}" == 'StanleyLl0yd/FootballForecast' ]]
[[ "${GITHUB_REF:-}" == 'refs/heads/main' ]]
[[ "$(git rev-parse HEAD)" == "${GITHUB_SHA:-}" ]]
[[ "${GITHUB_RUN_ID:-}" =~ ^[0-9]{1,18}$ ]]
for name in PGHOST PGUSER PGDATABASE PGPASSWORD; do
  [[ -n "${!name:-}" ]] || { echo 'FAIL: protected database credentials unavailable'; exit 2; }
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
  echo 'FAIL: untrusted pinned Supabase root certificate'; exit 2;
}
openssl x509 -in "$work/ca.crt" -noout -checkend 86400 >/dev/null
export PGSSLROOTCERT="$work/ca.crt"
export PYTHONPATH=ml/src PYTHONDONTWRITEBYTECODE=1 PYTHONNOUSERSITE=1
curl --fail --silent --show-error --proto '=https' --max-redirs 0 \
  --connect-timeout 10 --max-time 25 --max-filesize 200000 \
  --output "$work/openfootball.txt" \
  'https://raw.githubusercontent.com/openfootball/europe/63df627f3c87ce71708f016522ea236cf74332c3/russia/2024-25_ru1.txt'
test -s "$work/openfootball.txt"
node scripts/m2-openfootball-training.mjs \
  "$work/openfootball.txt" "$work/train-private.json"
python -m football_forecast.research.openfootball_escrow \
  "$work/train-private.json" > "$work/receipt.json"
node scripts/m2-openfootball-escrow-validate.mjs "$work/receipt.json"
echo "M2_OPENFOOTBALL_PRIVATE_ESCROW_JSON=$(cat "$work/receipt.json")"
echo "M2_OPENFOOTBALL_PRIVATE_ESCROW_RECEIPT_SHA256=$(sha256sum "$work/receipt.json" | cut -d ' ' -f1)"
{
  echo '## M2 private OpenFootball CC0 training-only model escrow (NOT APPROVED)'
  echo 'Coefficients retained only in the append-only private Supabase table.'
  echo 'No 2025/26 labels, Footbolno network, public coefficients or forecasts.'
  echo '~~~json'
  cat "$work/receipt.json"
  echo
  echo '~~~'
} >> "$GITHUB_STEP_SUMMARY"
