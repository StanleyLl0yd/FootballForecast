-- Disposable PostgreSQL 17 ONLY. Synthetic A5 bootstrapping is rolled back.
-- Superuser test deliberately disables ONLY the original A5 BEFORE INSERT
-- clock guards during fixture setup to simulate a past 2026/27 game.
-- Never run this test on live Supabase. No raw match records/credentials.
\echo 'M4 A6: private postgame evidence candidate RLS and mutation regression'

\if :{?m4_disposable_ci}
\else
\echo 'FAIL: A6 test requires explicit disposable CI flag'
select 1 / 0 as refused_without_disposable_ci_flag;
\endif

-- Fail before any privileged synthetic setup on any database containing
-- existing protected model/A5 records. Never touch real prospective rows.
select 1 / case when
  current_setting('server_version_num')::integer between 170000 and 179999
  and (select count(*) from ff_private.ff_m4_candidate_models)=0
  and (select count(*) from ff_private.ff_m4_future_captures)=0
  and (select count(*) from ff_private.ff_m4_time_proofs)=0
  and (select count(*) from ff_private.ff_m4_shadow_entries)=0
then 1 else 0 end as empty_disposable_m4_only;


select 1 / case when (
  select count(*) from pg_class c
  where c.oid in (
    'ff_private.ff_m4_result_observations'::regclass,
    'ff_private.ff_m4_result_candidate_settlements'::regclass)
    and c.relrowsecurity and c.relforcerowsecurity
)=2
and not has_table_privilege(
  'anon'::regrole, 'ff_private.ff_m4_result_observations'::regclass, 'SELECT')
and not has_table_privilege(
  'authenticated'::regrole, 'ff_private.ff_m4_result_observations'::regclass, 'INSERT')
and not has_table_privilege(
  'service_role'::regrole, 'ff_private.ff_m4_result_candidate_settlements'::regclass, 'SELECT')
and not has_table_privilege(
  'service_role'::regrole, 'ff_private.ff_m4_result_candidate_settlements'::regclass, 'INSERT')
then 1 else 0 end as private_result_rls_denial;

begin;
-- A real A5 capture cannot be inserted AFTER kickoff. Only a disposable,
-- rollback-only test DB may bootstrap synthetic pre-match provenance this way.
alter table ff_private.ff_m4_future_captures
  disable trigger ff_m4_capture_server_clock;
alter table ff_private.ff_m4_time_proofs
  disable trigger ff_m4_proof_server_clock;
alter table ff_private.ff_m4_shadow_entries
  disable trigger ff_m4_entry_pre_kickoff;

insert into ff_private.ff_m4_candidate_models (
  model_version,training_scope,training_matches,distinct_clubs,
  source_manifest_sha256,eligible_rows_sha256,model_sha256,model_bytes,
  code_sha,github_run_id
) values (
  'm4-team-poisson-shrink12-shadow-v1',
  '2018/19-2024/25-development-only',1673,26,
  repeat('a',64),repeat('b',64),
  encode(sha256(convert_to('synthetic-a6-model','UTF8')),'hex'),
  convert_to('synthetic-a6-model','UTF8'),
  repeat('4',40),989876500
);
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
where c.fixture_key=concat('rpl-','synthetic-a6-result-1');

alter table ff_private.ff_m4_future_captures
  enable trigger ff_m4_capture_server_clock;
alter table ff_private.ff_m4_time_proofs
  enable trigger ff_m4_proof_server_clock;
alter table ff_private.ff_m4_shadow_entries
  enable trigger ff_m4_entry_pre_kickoff;

-- Fake JWTs are never verified as signatures in DB: this is ONLY a constraint
-- and linkage test. Protected workers must authenticate RS256 and source bodies.
insert into ff_private.ff_m4_result_observations (
  capture_id,source_issuer,source_fixture_ref,source_response_sha256,
  source_oidc_jwt,source_jwk,source_token_sha256,source_issued_at,
  github_run_id,github_run_attempt,code_sha,
  fixture_key,kickoff_at,home_club_key,away_club_key,
  status,result_kind,home_goals,away_goals,recorded_at
)
select c.id,'openfoot','match-synthetic-a6',repeat('6',64),
  repeat('c',512),'{"kid":"c","kty":"RSA"}'::jsonb,
  encode(sha256(convert_to(repeat('c',512),'UTF8')),'hex'),
  clock_timestamp()-interval '15 seconds',989876502,1,repeat('7',40),
  c.fixture_key,c.kickoff_at,c.home_club_key,c.away_club_key,
  'finished','played',2,1,'2010-01-01'::timestamptz
from ff_private.ff_m4_future_captures c;
insert into ff_private.ff_m4_result_observations (
  capture_id,source_issuer,source_fixture_ref,source_response_sha256,
  source_oidc_jwt,source_jwk,source_token_sha256,source_issued_at,
  github_run_id,github_run_attempt,code_sha,
  fixture_key,kickoff_at,home_club_key,away_club_key,
  status,result_kind,home_goals,away_goals,recorded_at
)
select c.id,'matchtv','round-15-editorial',repeat('8',64),
  repeat('d',512),'{"kid":"d","kty":"RSA"}'::jsonb,
  encode(sha256(convert_to(repeat('d',512),'UTF8')),'hex'),
  clock_timestamp()-interval '15 seconds',989876502,1,repeat('7',40),
  c.fixture_key,c.kickoff_at,c.home_club_key,c.away_club_key,
  'finished','played',2,1,'2010-01-01'::timestamptz
from ff_private.ff_m4_future_captures c;

insert into ff_private.ff_m4_result_candidate_settlements (
  capture_id,shadow_entry_id,primary_observation_id,
  corroboration_observation_id,revision,home_goals,away_goals,recorded_at
)
select c.id,e.id,p.id,m.id,1,2,1,'2010-01-01'::timestamptz
from ff_private.ff_m4_future_captures c
join ff_private.ff_m4_shadow_entries e on e.capture_id=c.id
join ff_private.ff_m4_result_observations p
  on p.capture_id=c.id and p.source_issuer='openfoot'
join ff_private.ff_m4_result_observations m
  on m.capture_id=c.id and m.source_issuer='matchtv';

select 1 / case when
  (select count(*) from ff_private.ff_m4_result_observations
     where recorded_at > '2026-11-11T11:04:56Z'::timestamptz
       and result_attested=false and publication_allowed=false)=2
  and
  (select count(*) from ff_private.ff_m4_result_candidate_settlements
     where recorded_at > '2026-11-11T11:04:56Z'::timestamptz
       and state='PRIVATE_RESULT_CANDIDATE_UNATTESTED'
       and settlement_authorized=false and model_approved=false
       and publication_allowed=false and holdout_2025_26_read=false)=1
then 1 else 0 end as one_unattested_private_candidate;

do $m4$
declare
 v_cap uuid;
 v_entry uuid;
 v_primary uuid;
 v_other uuid;
 v_abstain uuid;
 v_existing_settlement uuid;
begin
  select id into v_cap from ff_private.ff_m4_future_captures limit 1;
  select id into v_entry from ff_private.ff_m4_shadow_entries limit 1;
  select id into v_primary from ff_private.ff_m4_result_observations
    where source_issuer='openfoot';
  select id into v_other from ff_private.ff_m4_result_observations
    where source_issuer='matchtv';

  -- A technical/awarded match must never be admitted as played.
  begin
    insert into ff_private.ff_m4_result_observations (
      capture_id,source_issuer,source_fixture_ref,source_response_sha256,
      source_oidc_jwt,source_jwk,source_token_sha256,source_issued_at,
      github_run_id,github_run_attempt,code_sha,fixture_key,
      kickoff_at,home_club_key,away_club_key,
      status,result_kind,home_goals,away_goals
    ) select c.id,'openfoot','match-synthetic-a6',repeat('9',64),
      repeat('e',512),'{}'::jsonb,
      encode(sha256(convert_to(repeat('e',512),'UTF8')),'hex'),
      clock_timestamp()-interval '15 seconds',989876503,1,repeat('7',40),
      c.fixture_key,c.kickoff_at,c.home_club_key,c.away_club_key,
      'awarded','technical',3,0
      from ff_private.ff_m4_future_captures c;
    raise exception 'TECHNICAL_RESULT_WAS_WRITTEN';
  exception when check_violation then null;
  end;

  -- Claiming a different OpenFoot match ID refuses despite a plausible score.
  begin
    insert into ff_private.ff_m4_result_observations (
      capture_id,source_issuer,source_fixture_ref,source_response_sha256,
      source_oidc_jwt,source_jwk,source_token_sha256,source_issued_at,
      github_run_id,github_run_attempt,code_sha,fixture_key,
      kickoff_at,home_club_key,away_club_key,
      status,result_kind,home_goals,away_goals
    ) select c.id,'openfoot','wrong-match-reference',repeat('9',64),
      repeat('e',512),'{}'::jsonb,
      encode(sha256(convert_to(repeat('e',512),'UTF8')),'hex'),
      clock_timestamp()-interval '15 seconds',989876503,1,repeat('7',40),
      c.fixture_key,c.kickoff_at,c.home_club_key,c.away_club_key,
      'finished','played',2,1
      from ff_private.ff_m4_future_captures c;
    raise exception 'WRONG_PROVIDER_MATCH_WAS_WRITTEN';
  exception when raise_exception then
    if sqlerrm <>
       'M4 result observation lacks fresh A5-linked postgame proof'
    then raise; end if;
  end;

  -- A forged earlier source issuance must not pass server-time controls.
  begin
    insert into ff_private.ff_m4_result_observations (
      capture_id,source_issuer,source_fixture_ref,source_response_sha256,
      source_oidc_jwt,source_jwk,source_token_sha256,source_issued_at,
      github_run_id,github_run_attempt,code_sha,fixture_key,
      kickoff_at,home_club_key,away_club_key,
      status,result_kind,home_goals,away_goals
    ) select c.id,'openfoot','match-synthetic-a6',repeat('9',64),
      repeat('e',512),'{}'::jsonb,
      encode(sha256(convert_to(repeat('e',512),'UTF8')),'hex'),
      c.kickoff_at+interval '45 minutes',989876503,1,repeat('7',40),
      c.fixture_key,c.kickoff_at,c.home_club_key,c.away_club_key,
      'finished','played',2,1
      from ff_private.ff_m4_future_captures c;
    raise exception 'EARLY_RESULT_WAS_WRITTEN';
  exception when raise_exception then
    if sqlerrm <>
       'M4 result observation lacks fresh A5-linked postgame proof'
    then raise; end if;
  end;

  begin
    insert into ff_private.ff_m4_result_candidate_settlements (
      capture_id,shadow_entry_id,primary_observation_id,
      corroboration_observation_id,revision,home_goals,away_goals)
    values (v_cap,v_entry,v_other,v_primary,2,2,1);
    raise exception 'SWAPPED_SOURCES_WERE_SETTLED';
  exception when raise_exception then
    if sqlerrm <>
       'M4 candidate settlement has no consistent A5/played evidence'
    then raise; end if;
  end;

  begin
    insert into ff_private.ff_m4_result_candidate_settlements (
      capture_id,shadow_entry_id,primary_observation_id,
      corroboration_observation_id,revision,home_goals,away_goals)
    values (v_cap,v_entry,v_primary,v_other,2,3,1);
    raise exception 'WRONG_SCORE_WAS_SETTLED';
  exception when raise_exception then
    if sqlerrm <>
       'M4 candidate settlement has no consistent A5/played evidence'
    then raise; end if;
  end;

  begin
    insert into ff_private.ff_m4_result_candidate_settlements (
      capture_id,shadow_entry_id,primary_observation_id,
      corroboration_observation_id,revision,home_goals,away_goals)
    values (v_cap,v_entry,v_primary,v_other,2,2,1);
    raise exception 'INVALID_REVISION_WAS_SETTLED';
  exception when raise_exception then
    if sqlerrm <> 'M4 result revision lineage invalid' then raise; end if;
  end;

  -- Disposable-only synthetic A4 revision: a later ABSTAIN invalidates
  -- even a previously valid FORECAST for this fixture. The real A4 trigger
  -- refuses past-time inserts; disable it ONLY within this rollback.
  alter table ff_private.ff_m4_shadow_entries
    disable trigger ff_m4_entry_pre_kickoff;
  insert into ff_private.ff_m4_shadow_entries (
    capture_id,model_id,fixture_key,revision,previous_entry_id,
    idempotency_sha256,entry_kind,abstention_reason,committed_at
  ) select e.capture_id,e.model_id,e.fixture_key,2,e.id,
           repeat('e',64),'ABSTAIN','UNKNOWN_MODEL_CLUB_ID',
           e.committed_at+interval '1 minute'
    from ff_private.ff_m4_shadow_entries e where e.id=v_entry
    returning id into v_abstain;
  alter table ff_private.ff_m4_shadow_entries
    enable trigger ff_m4_entry_pre_kickoff;
  select id into v_existing_settlement
    from ff_private.ff_m4_result_candidate_settlements
    where capture_id=v_cap and revision=1;
  begin
    insert into ff_private.ff_m4_result_candidate_settlements (
      capture_id,shadow_entry_id,primary_observation_id,
      corroboration_observation_id,revision,previous_settlement_id,
      home_goals,away_goals
    ) values (
      v_cap,v_abstain,v_primary,v_other,2,v_existing_settlement,2,1
    );
    raise exception 'ABSTAIN_WAS_SETTLED';
  exception when raise_exception then
    if sqlerrm <> 'M4 candidate settlement has no consistent A5/played evidence'
    then raise; end if;
  end;

  -- An earlier FORECAST superseded by ABSTAIN cannot be settled either,
  -- even when two independent source observations agree about the score.
  begin
    insert into ff_private.ff_m4_result_candidate_settlements (
      capture_id,shadow_entry_id,primary_observation_id,
      corroboration_observation_id,revision,previous_settlement_id,
      home_goals,away_goals
    ) values (
      v_cap,v_entry,v_primary,v_other,2,v_existing_settlement,2,1
    );
    raise exception 'SUPERSEDED_FORECAST_WAS_SETTLED';
  exception when raise_exception then
    if sqlerrm <> 'M4 candidate settlement has no consistent A5/played evidence'
    then raise; end if;
  end;

  begin
    update ff_private.ff_m4_result_observations
    set source_issuer='matchtv' where id=v_primary;
    raise exception 'OBSERVATION_WAS_MUTABLE';
  exception when raise_exception then
    if sqlerrm <> 'Source snapshot history is append-only' then raise; end if;
  end;
  begin
    delete from ff_private.ff_m4_result_candidate_settlements;
    raise exception 'SETTLEMENT_WAS_MUTABLE';
  exception when raise_exception then
    if sqlerrm <> 'Source snapshot history is append-only' then raise; end if;
  end;
  begin
    -- A6 settlement rows reference these observations. CASCADE must still
    -- invoke the append-only TRUNCATE denial, not stop at FK prevalidation.
    truncate ff_private.ff_m4_result_observations cascade;
    raise exception 'OBSERVATIONS_WERE_TRUNCATED';
  exception when raise_exception then
    if sqlerrm <> 'Source snapshot history is append-only' then raise; end if;
  end;
end;
$m4$;
rollback;

select 1 / case when
  (select count(*) from ff_private.ff_m4_result_observations)=0
  and (select count(*) from ff_private.ff_m4_result_candidate_settlements)=0
  and (select count(*) from ff_private.ff_m4_future_captures)=0
  and (select count(*) from ff_private.ff_m4_time_proofs)=0
  and (select count(*) from ff_private.ff_m4_shadow_entries)=0
then 1 else 0 end as all_a6_synthetic_rows_rolled_back;
\echo 'PASS: A6 candidate result evidence RLS, true clock, immutable lineage'
