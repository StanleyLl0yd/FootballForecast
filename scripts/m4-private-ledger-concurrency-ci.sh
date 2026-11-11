#!/usr/bin/env bash
# Disposable PostgreSQL 17 ONLY. Nothing runs against live Supabase.
set -euo pipefail
[[ "$GITHUB_ACTIONS" == true && -n "$GITHUB_RUN_ID" ]] || {
  echo 'FAIL: test requires GitHub Actions disposable PG17'; exit 2;
}
container="$1"
[[ -n "$container" ]] || exit 2
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
cat > "$work/seed.sql" <<'SQL'
INSERT INTO ff_private.ff_m4_candidate_models
(model_version,training_scope,training_matches,distinct_clubs,
 source_manifest_sha256,eligible_rows_sha256,model_sha256,model_bytes,
 code_sha,github_run_id)
VALUES
('m4-team-poisson-shrink12-shadow-v1','2018/19-2024/25-development-only',
 1673,26,repeat('a',64),repeat('b',64),
 encode(sha256(convert_to('synthetic-m4-concurrent','UTF8')),'hex'),
 convert_to('synthetic-m4-concurrent','UTF8'),repeat('c',40),977700001);
INSERT INTO ff_private.ff_m4_future_captures
(fixture_key,competition,season,home_club_key,away_club_key,
 kickoff_at,status,revision_kind,
 source_revision_sha256,kickoff_evidence_sha256,team_mapping_sha256,
 source_issuer,kickoff_issuer,source_mac_sha256,kickoff_mac_sha256,
 source_observed_at,kickoff_observed_at)
VALUES
('rpl-synthetic-ci-concurrent','RPL','2026/27','zenit','rubin',
 clock_timestamp()+interval '2 days','scheduled','none',
 repeat('a',64),repeat('b',64),repeat('c',64),
 'source-one','kickoff-two',repeat('d',64),repeat('e',64),
 clock_timestamp()-interval '10 seconds',
 clock_timestamp()-interval '5 seconds');
SQL
docker exec -i "$container" psql -X -q -v ON_ERROR_STOP=1 \
  -U postgres -d postgres < "$work/seed.sql" > /dev/null
cat > "$work/first.sql" <<'SQL'
BEGIN;
INSERT INTO ff_private.ff_m4_shadow_entries
(capture_id,model_id,fixture_key,revision,idempotency_sha256,
 entry_kind,abstention_reason)
SELECT c.id,m.id,c.fixture_key,1,repeat('1',64),
 'ABSTAIN','SYNTHETIC_CONCURRENCY_TEST'
FROM ff_private.ff_m4_future_captures c
CROSS JOIN ff_private.ff_m4_candidate_models m
WHERE c.fixture_key='rpl-synthetic-ci-concurrent'
AND m.github_run_id=977700001;
SELECT pg_sleep(4);
COMMIT;
SQL
cat > "$work/second.sql" <<'SQL'
BEGIN;
INSERT INTO ff_private.ff_m4_shadow_entries
(capture_id,model_id,fixture_key,revision,idempotency_sha256,
 entry_kind,abstention_reason)
SELECT c.id,m.id,c.fixture_key,1,repeat('2',64),
 'ABSTAIN','SECOND_WRITER_MUST_FAIL'
FROM ff_private.ff_m4_future_captures c
CROSS JOIN ff_private.ff_m4_candidate_models m
WHERE c.fixture_key='rpl-synthetic-ci-concurrent'
AND m.github_run_id=977700001;
COMMIT;
SQL
docker exec -i -e PGAPPNAME=m4-concurrent-first-writer "$container" \
  psql -X -q -v ON_ERROR_STOP=1 -U postgres -d postgres \
  < "$work/first.sql" > "$work/first.out" 2>&1 &
first_pid=$!
# First transaction must hold the capture row before second writer starts.
ready=0
for _ in $(seq 1 30); do
  if [[ "$(docker exec "$container" psql -X -qAt -U postgres -d postgres \
    -c "SELECT count(*) FROM pg_stat_activity
        WHERE application_name='m4-concurrent-first-writer'
          AND state='active' AND query LIKE 'SELECT pg_sleep(4)%'")" == 1 ]]; then
    ready=1
    break
  fi
  sleep 0.1
done
if [[ "$ready" != 1 ]]; then
  wait "$first_pid" || true
  echo 'FAIL: no observed concurrent first-writer transaction'; exit 2
fi
if docker exec -i -e PGAPPNAME=m4-concurrent-second-writer "$container" \
  psql -X -q -v ON_ERROR_STOP=1 -U postgres -d postgres \
  < "$work/second.sql" > "$work/second.out" 2>&1; then
  wait "$first_pid" || true
  echo 'FAIL: parallel duplicate first revision committed'; exit 2
fi
wait "$first_pid"
if ! grep -q 'duplicate key value violates unique constraint' "$work/second.out"; then
  echo 'FAIL: rival writer rejected for unexpected reason'; exit 2
fi
docker exec "$container" psql -X -qAt -U postgres -d postgres -c \
  "SELECT 1 / CASE WHEN
     (SELECT count(*) FROM ff_private.ff_m4_shadow_entries e
      JOIN ff_private.ff_m4_future_captures c ON c.id=e.capture_id
      WHERE c.fixture_key='rpl-synthetic-ci-concurrent'
        AND e.revision=1 AND e.entry_kind='ABSTAIN'
        AND e.publication_allowed=false)=1
   THEN 1 ELSE 0 END" | grep -qx 1
echo 'PASS: parallel PostgreSQL 17 transactions yielded one immutable first revision'
