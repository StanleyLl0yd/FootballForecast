#!/usr/bin/env bash
# Disposable PostgreSQL 17 ONLY, after the A4 concurrency fixture. No live URL.
set -euo pipefail
[[ "${GITHUB_ACTIONS:-}" == true && -n "${GITHUB_RUN_ID:-}" && $# == 1 ]] || {
  echo 'FAIL: A6 concurrency requires GitHub Actions disposable PG17'; exit 2;
}
container="$1"
[[ "$container" =~ ^[a-f0-9]{12,64}$ ]] || exit 2
work="$(mktemp -d)"
child=''
trap 'if [[ -n "$child" ]]; then wait "$child" || true; fi; rm -rf "$work"' EXIT
pg() {
  docker exec -i "$container" psql -X -q -v ON_ERROR_STOP=1 -U postgres -d postgres "$@"
}
# Fail closed before altering any trigger; only the preceding synthetic A4
# concurrency rows may exist. The service container is destroyed by CI.
pg -At <<'SQL' | grep -qx 1
select 1 / case when
  current_setting('server_version_num')::integer between 170000 and 179999
  and (select count(*) from ff_private.ff_m4_candidate_models)=1
  and (select count(*) from ff_private.ff_m4_candidate_models where github_run_id=977700001)=1
  and (select count(*) from ff_private.ff_m4_future_captures)=1
  and (select count(*) from ff_private.ff_m4_future_captures where fixture_key='rpl-synthetic-ci-concurrent')=1
  and (select count(*) from ff_private.ff_m4_shadow_entries)=1
  and (select count(*) from ff_private.ff_m4_time_proofs)=0
  and (select count(*) from ff_private.ff_m4_result_observations)=0
  and (select count(*) from ff_private.ff_m4_result_candidate_settlements)=0
then 1 else 0 end;
SQL
pg <<'SQL'
begin;
alter table ff_private.ff_m4_future_captures
  disable trigger ff_m4_capture_server_clock;
alter table ff_private.ff_m4_time_proofs
  disable trigger ff_m4_proof_server_clock;
alter table ff_private.ff_m4_shadow_entries
  disable trigger ff_m4_entry_pre_kickoff;

insert into ff_private.ff_m4_future_captures (
  fixture_key,competition,season,home_club_key,away_club_key,
  kickoff_at,status,revision_kind,source_revision_sha256,
  kickoff_evidence_sha256,team_mapping_sha256,
  source_issuer,kickoff_issuer,source_mac_sha256,kickoff_mac_sha256,
  source_observed_at,kickoff_observed_at,captured_at
) values (
  concat('rpl-','synthetic-a6-result-1'),'RPL','2026/27','zenit','rubin',
  '2026-11-13T16:30:00Z'::timestamptz,'scheduled','none',
  repeat('1',64),repeat('2',64),
  encode(sha256(convert_to(concat_ws(chr(10),
    concat('rpl-','synthetic-a6-result-1'),'match-synthetic-a6','zenit',
    'team-zenit','rubin','team-rubin') || chr(10),'UTF8')),'hex'),
  'openfoot','matchtv',
  encode(sha256(convert_to(repeat('a',512),'UTF8')),'hex'),
  encode(sha256(convert_to(repeat('b',512),'UTF8')),'hex'),
  '2026-11-11T16:30:00Z'::timestamptz,
  '2026-11-11T16:30:01Z'::timestamptz,
  '2026-11-11T16:30:05Z'::timestamptz
);
insert into ff_private.ff_m4_time_proofs (
  capture_id,github_run_id,github_run_attempt,code_sha,
  source_match_id,home_provider_team_id,away_provider_team_id,
  source_oidc_jwt,kickoff_oidc_jwt,source_jwk,kickoff_jwk,
  source_token_sha256,kickoff_token_sha256,
  source_issued_at,kickoff_issued_at,committed_at
)
select c.id,989876501,1,repeat('4',40),
  'match-synthetic-a6','team-zenit','team-rubin',
  repeat('a',512),repeat('b',512),
  '{"kid":"a","kty":"RSA"}'::jsonb,'{"kid":"b","kty":"RSA"}'::jsonb,
  encode(sha256(convert_to(repeat('a',512),'UTF8')),'hex'),
  encode(sha256(convert_to(repeat('b',512),'UTF8')),'hex'),
  c.kickoff_at-interval '2 days',
  c.kickoff_at-interval '2 days'+interval '1 second',
  c.kickoff_at-interval '2 days'+interval '5 seconds'
from ff_private.ff_m4_future_captures c
where c.fixture_key=concat('rpl-','synthetic-a6-result-1');
insert into ff_private.ff_m4_shadow_entries (
  capture_id,model_id,fixture_key,revision,idempotency_sha256,
  entry_kind,home_win,draw,away_win,expected_home,expected_away,
  prediction_sha256,committed_at
)
select c.id,m.id,c.fixture_key,1,repeat('3',64),
  'FORECAST',0.5,0.3,0.2,1.2,0.8,repeat('5',64),
  c.kickoff_at-interval '1 day'
from ff_private.ff_m4_future_captures c
cross join ff_private.ff_m4_candidate_models m
where c.fixture_key=concat('rpl-','synthetic-a6-result-1') and m.github_run_id=977700001;

alter table ff_private.ff_m4_future_captures
  enable trigger ff_m4_capture_server_clock;
alter table ff_private.ff_m4_time_proofs
  enable trigger ff_m4_proof_server_clock;
alter table ff_private.ff_m4_shadow_entries
  enable trigger ff_m4_entry_pre_kickoff;

commit;
SQL

cat > "$work/observe.sql" <<'SQL'
BEGIN;
WITH a AS (
  SELECT :'issuer'::text AS issuer, :'publisher'::text AS publisher,
    :'ref'::text AS ref, :'tag'::text AS tag,
    clock_timestamp()-interval '1 second' AS issued,
    repeat('synthetic-concurrency-token-',20)||:'tag' AS token
)
INSERT INTO ff_private.ff_m4_result_observations (
  capture_id,source_issuer,source_publisher,source_fixture_ref,source_locator,
  source_response_sha256,source_oidc_jwt,source_jwk,source_token_sha256,
  source_issued_at,github_run_id,github_run_attempt,code_sha,fixture_key,kickoff_at,
  home_club_key,away_club_key,status,result_kind,home_goals,away_goals,
  counted_goal_clubs,kdk_scope_from,kdk_scope_through,kdk_scope_sha256
)
SELECT c.id,a.issuer,a.publisher,a.ref,
  case when a.issuer='rpl_protocol' then 'https://synthetic.invalid/protocol'
       when a.issuer='rfs_kdk' then 'https://www.rfs.ru/archive?tags=16' end,
  encode(sha256(convert_to('body:'||a.tag,'UTF8')),'hex'),
  a.token,'{"kid":"synthetic","kty":"RSA"}'::jsonb,
  encode(sha256(convert_to(a.token,'UTF8')),'hex'),
  a.issued,:run,1,repeat('7',40),c.fixture_key,c.kickoff_at,c.home_club_key,c.away_club_key,
  case when a.issuer='rpl_protocol' then 'on_field_full_time_claim'
       when a.issuer='rfs_kdk' then 'kdk_reviewed_no_adverse_claim'
       else 'score_displayed_unverified' end,
  case when a.issuer='rpl_protocol' then 'played' else 'unknown' end,
  case when a.issuer<>'rfs_kdk' then 2 end,
  case when a.issuer<>'rfs_kdk' then 1 end,
  case when a.issuer='rpl_protocol' then array['zenit','rubin','zenit'] end,
  case when a.issuer='rfs_kdk' then c.kickoff_at end,
  case when a.issuer='rfs_kdk' then a.issued end,
  case when a.issuer='rfs_kdk' then encode(sha256(convert_to('scope:'||a.tag,'UTF8')),'hex') end
FROM ff_private.ff_m4_future_captures c CROSS JOIN a
WHERE c.fixture_key=concat('rpl-','synthetic-a6-result-1');
SELECT pg_sleep(:hold);
COMMIT;
SQL
cat > "$work/candidate.sql" <<'SQL'
BEGIN;
INSERT INTO ff_private.ff_m4_result_candidate_settlements
(capture_id,shadow_entry_id,primary_observation_id,corroboration_observation_id,
 official_observation_id,kdk_observation_id,revision,home_goals,away_goals)
SELECT c.id,e.id,p.id,m.id,w.id,k.id,1,2,1
FROM ff_private.ff_m4_future_captures c
JOIN ff_private.ff_m4_shadow_entries e ON e.capture_id=c.id
JOIN ff_private.ff_m4_result_observations p ON p.capture_id=c.id AND p.github_run_id=:p_run
JOIN ff_private.ff_m4_result_observations m ON m.capture_id=c.id AND m.github_run_id=988800002
JOIN ff_private.ff_m4_result_observations w ON w.capture_id=c.id AND w.github_run_id=988800003
JOIN ff_private.ff_m4_result_observations k ON k.capture_id=c.id AND k.github_run_id=:k_run
WHERE c.fixture_key=concat('rpl-','synthetic-a6-result-1');
SELECT pg_sleep(:hold);
COMMIT;
SQL
observe() {
  local app="$1" issuer="$2" publisher="$3" ref="$4" tag="$5" run="$6" hold="$7"
  docker exec -i -e PGAPPNAME="$app" "$container" \
    psql -X -q -v ON_ERROR_STOP=1 -U postgres -d postgres \
    -v issuer="$issuer" -v publisher="$publisher" -v ref="$ref" \
    -v tag="$tag" -v run="$run" -v hold="$hold" < "$work/observe.sql"
}
candidate() {
  docker exec -i -e PGAPPNAME="$1" "$container" \
    psql -X -q -v ON_ERROR_STOP=1 -U postgres -d postgres \
    -v p_run="$2" -v k_run="$3" -v hold="$4" < "$work/candidate.sql"
}
await_hold() {
  local app="$1"
  for _ in $(seq 1 40); do
    if [[ "$(pg -At -c "SELECT count(*) FROM pg_stat_activity
      WHERE application_name='$app' AND state='active'
      AND query LIKE 'SELECT pg_sleep(4)%'")" == 1 ]]; then return; fi
    sleep 0.1
  done
  echo "FAIL: no observed overlapping transaction ($app)"; exit 2
}
finish_child() {
  wait "$child"
  child=''
}
# Two different sources append against the same capture while one holds
# the lock. Both must commit, with consecutive DB-controlled ordinals.
observe a6-first openfoot openfoot match-synthetic-a6 p1 988800001 4 > "$work/first" 2>&1 &
child=$!
await_hold a6-first
observe a6-second matchtv matchtv matchtv:123456789 m1 988800002 0 > "$work/second" 2>&1
finish_child
pg -At <<'SQL' | grep -qx 1
select 1 / case when
  (select count(*) from ff_private.ff_m4_result_observations)=2
  and exists (select 1 from ff_private.ff_m4_result_observations
    where github_run_id=988800001 and observation_revision=1)
  and exists (select 1 from ff_private.ff_m4_result_observations
    where github_run_id=988800002 and observation_revision=2)
then 1 else 0 end;
SQL
observe a6-protocol rpl_protocol rpl protocol-synthetic w1 988800003 0 >/dev/null
observe a6-kdk rfs_kdk rfs scope-synthetic k1 988800004 0 >/dev/null

# Stale candidate races against a new observation. The candidate must wait
# for the same capture lock and then see the newly committed evidence.
observe a6-new-evidence openfoot openfoot match-synthetic-a6 p2 988800005 4 > "$work/new" 2>&1 &
child=$!
await_hold a6-new-evidence
if candidate a6-stale-candidate 988800001 988800004 0 > "$work/stale" 2>&1; then
  echo 'FAIL: stale candidate committed after concurrent evidence'; exit 2
fi
finish_child
grep -q 'M4 candidate lacks consistent official/KDK evidence' "$work/stale" || {
  echo 'FAIL: stale candidate refused for unexpected reason'; exit 2;
}
pg -At -c 'select count(*) from ff_private.ff_m4_result_candidate_settlements' | grep -qx 0
observe a6-fresh-kdk rfs_kdk rfs scope-synthetic k2 988800006 0 >/dev/null

# Two first candidates with the same complete current evidence cannot fork.
candidate a6-first-candidate 988800005 988800006 4 > "$work/candidate-first" 2>&1 &
child=$!
await_hold a6-first-candidate
if candidate a6-rival-candidate 988800005 988800006 0 > "$work/candidate-rival" 2>&1; then
  echo 'FAIL: competing candidate first revision committed'; exit 2
fi
finish_child
grep -q 'M4 result revision lineage invalid' "$work/candidate-rival" || {
  echo 'FAIL: candidate fork refused for unexpected reason'; exit 2;
}
pg -At <<'SQL' | grep -qx 1
select 1 / case when
  (select count(*) from ff_private.ff_m4_result_observations)=6
  and (select count(*) from ff_private.ff_m4_result_candidate_settlements)=1
  and exists (select 1 from ff_private.ff_m4_result_candidate_settlements
    where revision=1 and evidence_cutoff_revision=6
      and state='PRIVATE_RESULT_CANDIDATE_UNATTESTED'
      and not played_final_attested and not kdk_clearance_attested
      and not scoring_authorized and not settlement_authorized)
then 1 else 0 end;
SQL
echo 'PASS: parallel A6 observations, stale candidate refusal and no revision fork'
