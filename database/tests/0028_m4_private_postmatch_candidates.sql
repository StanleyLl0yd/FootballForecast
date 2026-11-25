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
and not exists (
  select 1 from unnest(array['anon','authenticated','service_role']) as roles(role_name)
  cross join unnest(array[
    'ff_private.ff_m4_result_observations','ff_private.ff_m4_result_candidate_settlements'
  ]) as relations(relation_name)
  cross join unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) as privileges(privilege_name)
  where has_table_privilege(role_name::regrole,relation_name::regclass,privilege_name)
)
and not exists (
  select 1 from unnest(array['anon','authenticated','service_role']) as roles(role_name)
  cross join unnest(array[
    'ff_private.ff_m4_result_observation_insert_guard()',
    'ff_private.ff_m4_result_candidate_insert_guard()'
  ]) as functions(function_name)
  where has_function_privilege(role_name::regrole,function_name::regprocedure,'EXECUTE')
)
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

-- Fake JWTs are used ONLY to test DB structure/linkage, never authenticity.
create temporary table a6_test_scope (unused boolean) on commit drop;
-- The synthetic fixture deliberately has no real score or provider body.
create function pg_temp.a6_observe(
  p_issuer text,p_publisher text,p_ref text,p_status text,p_kind text,
  p_home integer,p_away integer,p_goals text[],p_tag text,p_run bigint,
  p_decision text default null,p_decision_digest text default null,
  p_issued timestamptz default null,p_body_tag text default null,
  p_context bytea default null,p_context_digest text default null
) returns uuid language plpgsql as $test$
declare
  v_id uuid;
  v_issued timestamptz := coalesce(p_issued,clock_timestamp()-interval '1 second');
  v_token text := repeat('synthetic-token-',32)||p_tag;
begin
  insert into ff_private.ff_m4_result_observations (
    capture_id,source_issuer,source_publisher,source_fixture_ref,source_locator,
    source_response_sha256,source_oidc_jwt,source_jwk,source_token_sha256,
    source_issued_at,github_run_id,github_run_attempt,code_sha,fixture_key,kickoff_at,
    home_club_key,away_club_key,status,result_kind,home_goals,away_goals,
    counted_goal_clubs,kdk_scope_from,kdk_scope_through,kdk_scope_sha256,
    kdk_decision_ref,kdk_decision_sha256,observation_revision,recorded_at,
    source_context_manifest,source_context_manifest_sha256
  )
  select c.id,p_issuer,p_publisher,p_ref,
    case when p_issuer='rfs_kdk' then 'https://www.rfs.ru/archive?tags=16'
         when p_issuer in ('official_club','rpl_protocol') then 'https://synthetic.invalid/'||p_ref
         else null end,
    encode(sha256(convert_to('synthetic-body:'||coalesce(p_body_tag,p_tag),'UTF8')),'hex'),
    v_token,'{"kid":"synthetic","kty":"RSA"}'::jsonb,
    encode(sha256(convert_to(v_token,'UTF8')),'hex'),
    v_issued,p_run,1,repeat('7',40),c.fixture_key,c.kickoff_at,
    c.home_club_key,c.away_club_key,p_status,p_kind,p_home,p_away,p_goals,
    case when p_issuer='rfs_kdk' then c.kickoff_at end,
    case when p_issuer='rfs_kdk' then v_issued end,
    case when p_issuer='rfs_kdk' then encode(sha256(convert_to('scope:'||p_tag,'UTF8')),'hex') end,
    p_decision,p_decision_digest,999,'2010-01-01'::timestamptz,
    p_context,coalesce(p_context_digest,encode(sha256(p_context),'hex'))
  from ff_private.ff_m4_future_captures c
  where c.fixture_key=concat('rpl-','synthetic-a6-result-1') returning id into v_id;
  return v_id;
end;
$test$;

create function pg_temp.a6_candidate(
  p_revision integer,p_previous uuid,p_primary uuid,p_other uuid,
  p_official uuid,p_second uuid,p_kdk uuid,
  p_state text default 'PRIVATE_RESULT_CANDIDATE_UNATTESTED',
  p_reason text default null,p_entry uuid default null,
  p_home integer default 2,p_away integer default 1,p_authorize boolean default false
) returns uuid language plpgsql as $test$
declare v_id uuid;
begin
  insert into ff_private.ff_m4_result_candidate_settlements (
    capture_id,shadow_entry_id,primary_observation_id,corroboration_observation_id,
    official_observation_id,second_official_observation_id,kdk_observation_id,
    revision,previous_settlement_id,evidence_cutoff_revision,home_goals,away_goals,
    state,blocking_reason,recorded_at,scoring_authorized
  )
  select c.id,coalesce(p_entry,e.id),p_primary,p_other,p_official,p_second,p_kdk,
    p_revision,p_previous,999,
    case when p_state='PRIVATE_RESULT_BLOCKED' then null else p_home end,
    case when p_state='PRIVATE_RESULT_BLOCKED' then null else p_away end,
    p_state,p_reason,'2010-01-01'::timestamptz,p_authorize
  from ff_private.ff_m4_future_captures c
  join ff_private.ff_m4_shadow_entries e on e.capture_id=c.id and e.revision=1
  where c.fixture_key=concat('rpl-','synthetic-a6-result-1') returning id into v_id;
  return v_id;
end;
$test$;

-- Synthetic JSONB bytes test SQL structure, never canonical encoding or JWT.
create function pg_temp.a6_context(
  p_primary uuid,p_other uuid,p_reports jsonb,p_receipt text,p_route text
) returns jsonb language sql as $test$
  select jsonb_build_object(
    'schema','ff-m4-official-witness-context-v1',
    'fixture',jsonb_build_object('fixtureKey',c.fixture_key,'sourceMatchId',t.source_match_id,
      'competition',c.competition,'season',c.season,'round',15,'kickoffAt',c.kickoff_at,
      'homeClub',c.home_club_key,'awayClub',c.away_club_key),
    'providerClaims',jsonb_build_array(
      jsonb_build_object('issuer',p.source_issuer,'sourceFixtureRef',p.source_fixture_ref,
        'bodySha256',p.source_response_sha256,'observedAt',p.source_issued_at,
        'status',p.status,'resultKind',p.result_kind,'score',array[p.home_goals,p.away_goals]),
      jsonb_build_object('issuer',m.source_issuer,'sourceFixtureRef',m.source_fixture_ref,
        'bodySha256',m.source_response_sha256,'observedAt',m.source_issued_at,
        'status',m.status,'resultKind',m.result_kind,'score',array[m.home_goals,m.away_goals])),
    'evidenceRoute',p_route,'witnessClaims',p_reports,'receiptPublisher',p_receipt)
  from ff_private.ff_m4_result_observations p
  join ff_private.ff_m4_result_observations m on m.capture_id=p.capture_id
  join ff_private.ff_m4_future_captures c on c.id=p.capture_id
  join ff_private.ff_m4_time_proofs t on t.capture_id=c.id
  where p.id=p_primary and m.id=p_other;
$test$;

create function pg_temp.a6_context_report(
  p_publisher text,p_ref text,p_body_tag text,p_observed timestamptz
) returns jsonb language sql as $test$
  select jsonb_build_object('publisher',p_publisher,
    'locator','https://synthetic.invalid/'||p_ref,
    'bodySha256',encode(sha256(convert_to('synthetic-body:'||p_body_tag,'UTF8')),'hex'),
    'observedAt',p_observed,'score',array[2,1],
    'events',jsonb_build_array('KICKOFF','HALF_TIME','SECOND_HALF','FULL_TIME'),
    'goals','[["zenit",1,0],["rubin",1,1],["zenit",2,1]]'::jsonb);
$test$;

-- A test must fail if the command succeeds, or if it fails for an unrelated
-- reason. Constant synthetic SQL only; never callable from production roles.
create function pg_temp.a6_reject(p_command text,p_expected text)
returns void language plpgsql as $test$
declare v_error text; v_state text;
begin
  begin
    execute p_command;
  exception when others then
    get stacked diagnostics v_error=message_text,v_state=returned_sqlstate;
    if v_error=p_expected or v_state=p_expected then return; end if;
    raise exception 'Unexpected rejection (%): %',v_state,v_error;
  end;
  raise exception 'Expected rejection but command succeeded: %',p_expected;
end;
$test$;

do $m4$
declare
  p uuid; m uuid; w1 uuid; w2 uuid; k uuid; s1 uuid; s2 uuid; s3 uuid; s4 uuid;
  pending uuid; conflicting uuid; wrong_goals uuid; old_k uuid; new_p uuid;
  protocol uuid; v_abstain uuid; v_cap uuid; v_entry uuid;
  v_context jsonb; v_reports jsonb; v_bytes bytea; v_observed timestamptz;
  v_trial uuid;
  candidate_state constant text := 'PRIVATE_RESULT_CANDIDATE_UNATTESTED';
  blocked_state constant text := 'PRIVATE_RESULT_BLOCKED';
  consistent_error constant text := 'M4 candidate lacks consistent official/KDK evidence';
  role_error constant text := 'M4 result evidence role or capture mismatch';
  stale_error constant text := 'M4 duplicate, stale or contradictory result evidence';
  lineage_error constant text := 'M4 result revision lineage invalid';
begin
  select id into v_cap from ff_private.ff_m4_future_captures;
  select id into v_entry from ff_private.ff_m4_shadow_entries;
  p := pg_temp.a6_observe('openfoot','openfoot','match-synthetic-a6',
    'score_displayed_unverified','unknown',2,1,null,'p',989876502);
  m := pg_temp.a6_observe('matchtv','matchtv','matchtv:123456789',
    'score_displayed_unverified','unknown',2,1,null,'m',989876503);
  if (select count(*) from ff_private.ff_m4_result_observations
       where result_kind='unknown' and status='score_displayed_unverified'
         and result_attested=false and recorded_at>source_issued_at
         and observation_revision in (1,2))<>2 then
    raise exception 'Provider UNKNOWN was not preserved or DB clock/ordinal was not used';
  end if;

  -- Neither two agreeing providers nor a fabricated MatchTV played field is proof.
  perform pg_temp.a6_reject(format(
    'select pg_temp.a6_candidate(1,null,%L,%L,null,null,null)',p,m),consistent_error);
  perform pg_temp.a6_reject($q$select pg_temp.a6_observe(
    'matchtv','matchtv','matchtv:123456789','finished','played',2,1,null,
    'fake-played',989876504)$q$,'23514');
  perform pg_temp.a6_reject($q$select pg_temp.a6_observe(
    'openfoot','openfoot','wrong-match-reference','score_displayed_unverified','unknown',
    2,1,null,'wrong-id',989876504)$q$,'M4 result observation lacks fresh A5-linked postgame proof');
  perform pg_temp.a6_reject($q$select pg_temp.a6_observe(
    'openfoot','openfoot','match-synthetic-a6','score_displayed_unverified','unknown',
    2,1,null,'stale-clock',989876504,null,null,clock_timestamp()-interval '1 hour')$q$,
    'M4 result observation lacks fresh A5-linked postgame proof');
  perform pg_temp.a6_reject($q$select pg_temp.a6_observe(
    'openfoot','openfoot','match-synthetic-a6','awarded','technical',3,0,null,
    'technical',989876504)$q$,'23514');

  w1 := pg_temp.a6_observe('official_club','zenit','club-synthetic-home',
    'on_field_full_time_claim','played',2,1,array['zenit','rubin','zenit'],'w1',989876504);
  perform pg_temp.a6_reject($q$select pg_temp.a6_observe(
    'official_club','rubin','club-synthetic-away','on_field_full_time_claim','played',
    2,1,array['rubin','rubin','zenit'],'wrong-direction',989876505)$q$,
    'M4 invalid counted goal sequence');
  perform pg_temp.a6_reject($q$select pg_temp.a6_observe(
    'official_club','not-a-participant','club-synthetic-away','on_field_full_time_claim','played',
    2,1,array['zenit','rubin','zenit'],'wrong-publisher',989876505)$q$,
    'M4 result observation lacks fresh A5-linked postgame proof');
  w2 := pg_temp.a6_observe('official_club','rubin','club-synthetic-away',
    'on_field_full_time_claim','played',2,1,array['zenit','rubin','zenit'],'w2',989876505);
  perform pg_temp.a6_reject(format(
    'select pg_temp.a6_candidate(1,null,%L,%L,%L,%L,null)',p,m,w1,w2),consistent_error);

  pending := pg_temp.a6_observe('rfs_kdk','rfs','scope-synthetic-pending',
    'kdk_pending','unknown',null,null,null,'pending',989876506);
  perform pg_temp.a6_reject(format(
    'select pg_temp.a6_candidate(1,null,%L,%L,%L,%L,%L)',p,m,w1,w2,pending),consistent_error);
  perform pg_temp.a6_reject($q$select pg_temp.a6_observe(
    'rfs_kdk','rfs','scope-synthetic-cleared','kdk_reviewed_no_adverse_claim','unknown',
    null,null,null,'missing-decision',989876507)$q$,
    'M4 unresolved KDK proceeding requires issued decision evidence');
  perform pg_temp.a6_reject($q$select pg_temp.a6_observe(
    'rfs_kdk','rfs','scope-synthetic-cleared','kdk_reviewed_no_adverse_claim','unknown',
    null,null,null,'agenda',989876507,'https://www.rfs.ru/news/225644',repeat('a',64))$q$,'23514');

  k := pg_temp.a6_observe('rfs_kdk','rfs','scope-synthetic-reviewed',
    'kdk_reviewed_no_adverse_claim','unknown',null,null,null,'k',989876507,
    'https://www.rfs.ru/news/999999999',repeat('a',64));
  -- Single club, duplicate witness, swapped providers and wrong score fail.
  perform pg_temp.a6_reject(format(
    'select pg_temp.a6_candidate(1,null,%L,%L,%L,null,%L)',p,m,w1,k),consistent_error);
  perform pg_temp.a6_reject(format(
    'select pg_temp.a6_candidate(1,null,%L,%L,%L,%L,%L)',p,m,w1,w1,k),consistent_error);
  perform pg_temp.a6_reject(format(
    'select pg_temp.a6_candidate(1,null,%L,%L,%L,%L,%L)',m,p,w1,w2,k),role_error);
  perform pg_temp.a6_reject(format(
    'select pg_temp.a6_candidate(1,null,%L,%L,%L,%L,%L,%L,null,null,3,1)',
    p,m,w1,w2,k,candidate_state),consistent_error);
  perform pg_temp.a6_reject(format(
    'select pg_temp.a6_candidate(1,null,%L,%L,%L,%L,%L,%L,null,null,2,1,true)',
    p,m,w1,w2,k,candidate_state),'23514');
  s1 := pg_temp.a6_candidate(1,null,p,m,w1,w2,k);
  if not exists (select 1 from ff_private.ff_m4_result_candidate_settlements s
       where s.id=s1 and s.evidence_cutoff_revision=6 and s.revision=1
         and s.recorded_at>'2026-11-13T16:30:00Z'::timestamptz
         and not s.settlement_authorized and not s.scoring_authorized
         and not s.played_final_attested and not s.kdk_clearance_attested
         and not s.model_approved and not s.publication_allowed and not s.holdout_2025_26_read) then
    raise exception 'Candidate was not strictly unattested or DB cutoff was spoofable';
  end if;
  perform pg_temp.a6_reject(format(
    'select pg_temp.a6_candidate(2,%L,%L,%L,%L,%L,%L)',s1,p,m,w1,w2,k),lineage_error);

  -- Repeated unchanged provider body in a *different run* is retained.
  -- Reusing the token or same capture/publisher/run is refused.
  new_p := pg_temp.a6_observe('openfoot','openfoot','match-synthetic-a6',
    'score_displayed_unverified','unknown',2,1,null,'p-later',989876508,null,null,null,'p');
  perform pg_temp.a6_reject($q$select pg_temp.a6_observe(
    'openfoot','openfoot','match-synthetic-a6','score_displayed_unverified','unknown',
    2,1,null,'late-older',989876521,null,null,clock_timestamp()-interval '5 minutes')$q$,
    'M4 publisher observation clock did not advance');
  perform pg_temp.a6_reject($q$select pg_temp.a6_observe(
    'openfoot','openfoot','match-synthetic-a6','score_displayed_unverified','unknown',
    2,1,null,'p',989876509)$q$,'23505');
  perform pg_temp.a6_reject($q$select pg_temp.a6_observe(
    'openfoot','openfoot','match-synthetic-a6','score_displayed_unverified','unknown',
    2,1,null,'same-run',989876508)$q$,'23505');
  if not exists (select 1 from ff_private.ff_m4_result_candidate_settlements s
       where s.id=s1 and s.evidence_cutoff_revision <
         (select max(observation_revision) from ff_private.ff_m4_result_observations
          where capture_id=s.capture_id)) then
    raise exception 'New evidence did not make the previous cutoff stale';
  end if;
  perform pg_temp.a6_reject(format(
    'select pg_temp.a6_candidate(2,%L,%L,%L,%L,%L,%L)',s1,new_p,m,w1,w2,k),consistent_error);

  conflicting := pg_temp.a6_observe('official_club','rubin','club-synthetic-away',
    'official_unresolved','unknown',2,1,null,'conflict',989876509);
  old_k := k;
  k := pg_temp.a6_observe('rfs_kdk','rfs','scope-synthetic-reviewed',
    'kdk_reviewed_no_adverse_claim','unknown',null,null,null,'k-new',989876510,
    'https://www.rfs.ru/news/999999999',repeat('a',64));
  perform pg_temp.a6_reject(format(
    'select pg_temp.a6_candidate(2,%L,%L,%L,%L,%L,%L)',s1,new_p,m,w1,w2,k),stale_error);
  protocol := pg_temp.a6_observe('rpl_protocol','rpl','protocol-synthetic',
    'on_field_full_time_claim','played',2,1,array['zenit','rubin','zenit'],'protocol',989876511);
  k := pg_temp.a6_observe('rfs_kdk','rfs','scope-synthetic-reviewed',
    'kdk_reviewed_no_adverse_claim','unknown',null,null,null,'k-protocol',989876512,
    'https://www.rfs.ru/news/999999999',repeat('a',64));
  -- A protocol cannot hide a newer unresolved official club report.
  perform pg_temp.a6_reject(format(
    'select pg_temp.a6_candidate(2,%L,%L,%L,%L,null,%L)',s1,new_p,m,protocol,k),stale_error);
  perform pg_temp.a6_reject(format(
    'select pg_temp.a6_candidate(3,%L,%L,%L,%L,null,%L,%L,%L)',
    s1,new_p,m,protocol,k,blocked_state,'CONTRADICTORY_EVIDENCE'),lineage_error);
  s2 := pg_temp.a6_candidate(2,s1,new_p,m,w1,conflicting,k,blocked_state,
    'CONTRADICTORY_EVIDENCE');

  -- Correction from the same publisher keeps the old claim but can supersede it.
  wrong_goals := pg_temp.a6_observe('official_club','rubin','club-synthetic-away',
    'on_field_full_time_claim','played',2,1,array['rubin','zenit','zenit'],'other-order',989876513);
  k := pg_temp.a6_observe('rfs_kdk','rfs','scope-synthetic-reviewed',
    'kdk_reviewed_no_adverse_claim','unknown',null,null,null,'k-order',989876514,
    'https://www.rfs.ru/news/999999999',repeat('a',64));
  perform pg_temp.a6_reject(format(
    'select pg_temp.a6_candidate(3,%L,%L,%L,%L,%L,%L)',s2,new_p,m,w1,wrong_goals,k),consistent_error);
  w2 := pg_temp.a6_observe('official_club','rubin','club-synthetic-away',
    'on_field_full_time_claim','played',2,1,array['zenit','rubin','zenit'],
    'duplicate-body',989876519,null,null,null,'w1');
  k := pg_temp.a6_observe('rfs_kdk','rfs','scope-synthetic-reviewed',
    'kdk_reviewed_no_adverse_claim','unknown',null,null,null,'k-duplicate',989876520,
    'https://www.rfs.ru/news/999999999',repeat('a',64));
  perform pg_temp.a6_reject(format(
    'select pg_temp.a6_candidate(3,%L,%L,%L,%L,%L,%L)',s2,new_p,m,w1,w2,k),stale_error);
  w2 := pg_temp.a6_observe('official_club','rubin','club-synthetic-away',
    'on_field_full_time_claim','played',2,1,array['zenit','rubin','zenit'],'corrected',989876515);
  k := pg_temp.a6_observe('rfs_kdk','rfs','scope-synthetic-reviewed',
    'kdk_reviewed_no_adverse_claim','unknown',null,null,null,'k-corrected',989876516,
    'https://www.rfs.ru/news/999999999',repeat('a',64));
  -- Mixed raw/context witnesses and different complete contexts are refused.
  v_observed := clock_timestamp()-interval '2 seconds';
  v_reports := jsonb_build_array(
    pg_temp.a6_context_report('zenit','club-synthetic-home','w1',v_observed),
    pg_temp.a6_context_report('rubin','club-synthetic-away','context-away',v_observed));
  v_context := pg_temp.a6_context(new_p,m,v_reports,'rubin','OPPOSING_CLUB_REPORTS');
  w2 := pg_temp.a6_observe('official_club','rubin','club-synthetic-away',
    'on_field_full_time_claim','played',2,1,array['zenit','rubin','zenit'],
    'context-away',989876530,null,null,null,null,convert_to(v_context::text,'UTF8'));
  k := pg_temp.a6_observe('rfs_kdk','rfs','scope-synthetic-reviewed',
    'kdk_reviewed_no_adverse_claim','unknown',null,null,null,'k-mixed',989876531,
    'https://www.rfs.ru/news/999999999',repeat('a',64));
  perform pg_temp.a6_reject(format(
    'select pg_temp.a6_candidate(3,%L,%L,%L,%L,%L,%L)',s2,new_p,m,w1,w2,k),
    'M4 context manifest batch incomplete');

  v_reports := jsonb_build_array(
    pg_temp.a6_context_report('zenit','club-synthetic-home','context-home',v_observed),
    pg_temp.a6_context_report('rubin','club-synthetic-away','context-away',v_observed));
  v_context := pg_temp.a6_context(new_p,m,v_reports,'zenit','OPPOSING_CLUB_REPORTS');
  w1 := pg_temp.a6_observe('official_club','zenit','club-synthetic-home',
    'on_field_full_time_claim','played',2,1,array['zenit','rubin','zenit'],
    'context-home',989876532,null,null,null,null,convert_to(v_context::text,'UTF8'));
  k := pg_temp.a6_observe('rfs_kdk','rfs','scope-synthetic-reviewed',
    'kdk_reviewed_no_adverse_claim','unknown',null,null,null,'k-context-mismatch',989876533,
    'https://www.rfs.ru/news/999999999',repeat('a',64));
  perform pg_temp.a6_reject(format(
    'select pg_temp.a6_candidate(3,%L,%L,%L,%L,%L,%L)',s2,new_p,m,w1,w2,k),
    'M4 context manifest batch mismatch');

  v_context := jsonb_set(v_context,'{receiptPublisher}',to_jsonb('rubin'::text));
  w2 := pg_temp.a6_observe('official_club','rubin','club-synthetic-away',
    'on_field_full_time_claim','played',2,1,array['zenit','rubin','zenit'],
    'context-away-rebound',989876534,null,null,null,'context-away',
    convert_to(v_context::text,'UTF8'));
  k := pg_temp.a6_observe('rfs_kdk','rfs','scope-synthetic-reviewed',
    'kdk_reviewed_no_adverse_claim','unknown',null,null,null,'k-context-pair',989876535,
    'https://www.rfs.ru/news/999999999',repeat('a',64));
  begin
    v_trial := pg_temp.a6_candidate(3,s2,new_p,m,w1,w2,k);
    if v_trial is null then raise exception 'Context pair not retained'; end if;
    raise exception using errcode='ZX001',message='Rollback synthetic context pair trial';
  exception when sqlstate 'ZX001' then null;
  end;

  v_observed := clock_timestamp()-interval '2 seconds';
  v_context := pg_temp.a6_context(new_p,m,jsonb_build_array(
    pg_temp.a6_context_report('rpl_protocol:999999','999999','context-protocol',v_observed)),
    'rpl_protocol:999999','PROTOCOL_REFERENCE');
  v_bytes := convert_to(v_context::text,'UTF8');
  perform pg_temp.a6_reject(format(
    $q$select pg_temp.a6_observe('rpl_protocol','rpl','999999','on_field_full_time_claim',
      'played',2,1,array['zenit','rubin','zenit'],'context-protocol',989876536,
      null,null,null,null,%L::bytea,%L)$q$,v_bytes,repeat('f',64)),'23514');
  perform pg_temp.a6_reject(format(
    $q$select pg_temp.a6_observe('rpl_protocol','rpl','999999','on_field_full_time_claim',
      'played',2,1,array['zenit','rubin','zenit'],'context-protocol',989876536,
      null,null,null,null,%L::bytea)$q$,
    convert_to(jsonb_set(v_context,'{fixture,sourceMatchId}',to_jsonb('wrong'::text))::text,'UTF8')),
    'M4 context manifest identity mismatch');
  perform pg_temp.a6_reject(format(
    $q$select pg_temp.a6_observe('rpl_protocol','rpl','999999','on_field_full_time_claim',
      'played',2,1,array['zenit','rubin','zenit'],'context-protocol',989876536,
      null,null,null,null,%L::bytea)$q$,
    convert_to(jsonb_set(v_context,'{witnessClaims,0,goals}','[]'::jsonb)::text,'UTF8')),
    'M4 context manifest witness mismatch');
  protocol := pg_temp.a6_observe('rpl_protocol','rpl','999999',
    'on_field_full_time_claim','played',2,1,array['zenit','rubin','zenit'],
    'context-protocol-wrong-provider',989876536,null,null,null,'context-protocol',
    convert_to(jsonb_set(v_context,'{providerClaims,0,bodySha256}',
      to_jsonb(repeat('e',64)))::text,'UTF8'));
  k := pg_temp.a6_observe('rfs_kdk','rfs','scope-synthetic-reviewed',
    'kdk_reviewed_no_adverse_claim','unknown',null,null,null,'k-context-provider',989876537,
    'https://www.rfs.ru/news/999999999',repeat('a',64));
  perform pg_temp.a6_reject(format(
    'select pg_temp.a6_candidate(3,%L,%L,%L,%L,null,%L)',s2,new_p,m,protocol,k),
    'M4 context manifest provider mismatch');
  protocol := pg_temp.a6_observe('rpl_protocol','rpl','999999',
    'on_field_full_time_claim','played',2,1,array['zenit','rubin','zenit'],
    'context-protocol-corrected',989876538,null,null,null,'context-protocol',v_bytes);
  if not exists (select 1 from ff_private.ff_m4_result_observations o
    where o.id=protocol and o.source_context_manifest=v_bytes and
      o.source_context_manifest_sha256=encode(sha256(v_bytes),'hex') and not o.result_attested) then
    raise exception 'Exact context manifest bytes not retained';
  end if;
  k := pg_temp.a6_observe('rfs_kdk','rfs','scope-synthetic-reviewed',
    'kdk_reviewed_no_adverse_claim','unknown',null,null,null,'k-context-final',989876539,
    'https://www.rfs.ru/news/999999999',repeat('a',64));
  s3 := pg_temp.a6_candidate(3,s2,new_p,m,protocol,null,k);
  if (select count(*) from ff_private.ff_m4_result_candidate_settlements)<>3 or
     not exists (select 1 from ff_private.ff_m4_result_candidate_settlements
       where id=s2 and previous_settlement_id=s1 and state=blocked_state
         and home_goals is null and away_goals is null and blocking_reason='CONTRADICTORY_EVIDENCE') or
     not exists (select 1 from ff_private.ff_m4_result_candidate_settlements
       where id=s3 and previous_settlement_id=s2 and state=candidate_state) or
     not exists (select 1 from ff_private.ff_m4_result_observations
       where id=conflicting and result_kind='unknown') then
    raise exception 'Append-only blocked/corrected lineage was not retained';
  end if;

  -- A later provenance review may revoke a candidate without new raw bytes.
  -- No positive candidate or repeated block can reuse that unchanged cutoff.
  s4 := pg_temp.a6_candidate(4,s3,new_p,m,protocol,null,k,blocked_state,'REVIEW_REQUIRED');
  if not exists (
    select 1 from ff_private.ff_m4_result_candidate_settlements b
    join ff_private.ff_m4_result_candidate_settlements a on a.id=b.previous_settlement_id
    where b.id=s4 and a.id=s3 and b.evidence_cutoff_revision=a.evidence_cutoff_revision
      and b.state=blocked_state and b.home_goals is null and b.away_goals is null
  ) then raise exception 'Same-cutoff fail-closed revocation not retained'; end if;
  perform pg_temp.a6_reject(format(
    'select pg_temp.a6_candidate(5,%L,%L,%L,%L,null,%L)',s4,new_p,m,protocol,k),lineage_error);
  perform pg_temp.a6_reject(format(
    'select pg_temp.a6_candidate(5,%L,%L,%L,%L,null,%L,%L,%L)',
    s4,new_p,m,protocol,k,blocked_state,'REVIEW_REQUIRED'),lineage_error);

  -- An adverse issued decision cannot be cleared by citing itself.
  pending := pg_temp.a6_observe('rfs_kdk','rfs','scope-synthetic-adverse',
    'kdk_adverse','unknown',null,null,null,'adverse',989876517,
    'https://www.rfs.ru/news/999999998',repeat('b',64));
  perform pg_temp.a6_reject(format(
    'select pg_temp.a6_candidate(5,%L,%L,%L,%L,null,%L)',s4,new_p,m,protocol,pending),consistent_error);
  perform pg_temp.a6_reject($q$select pg_temp.a6_observe(
    'rfs_kdk','rfs','scope-synthetic-reviewed','kdk_reviewed_no_adverse_claim','unknown',
    null,null,null,'self-clear',989876518,'https://www.rfs.ru/news/999999998',repeat('b',64))$q$,
    'M4 adverse decision cannot clear itself');

  -- A superseding ABSTAIN is never itself a candidate, even a BLOCKED one.
  alter table ff_private.ff_m4_shadow_entries disable trigger ff_m4_entry_pre_kickoff;
  insert into ff_private.ff_m4_shadow_entries (
    capture_id,model_id,fixture_key,revision,previous_entry_id,
    idempotency_sha256,entry_kind,abstention_reason,committed_at
  ) select e.capture_id,e.model_id,e.fixture_key,2,e.id,repeat('e',64),
    'ABSTAIN','UNKNOWN_MODEL_CLUB_ID',e.committed_at+interval '1 minute'
    from ff_private.ff_m4_shadow_entries e where e.id=v_entry returning id into v_abstain;
  alter table ff_private.ff_m4_shadow_entries enable trigger ff_m4_entry_pre_kickoff;
  k := pg_temp.a6_observe('rfs_kdk','rfs','scope-synthetic-reviewed',
    'kdk_reviewed_no_adverse_claim','unknown',null,null,null,'new-decision',989876518,
    'https://www.rfs.ru/news/999999997',repeat('c',64));
  perform pg_temp.a6_reject(format(
    'select pg_temp.a6_candidate(5,%L,%L,%L,%L,null,%L,%L,null,%L)',
    s4,new_p,m,protocol,k,candidate_state,v_abstain),
    'M4 candidate lacks valid pregame FORECAST or evidence');
  perform pg_temp.a6_reject(format(
    'select pg_temp.a6_candidate(5,%L,%L,%L,%L,null,%L)',s4,new_p,m,protocol,k),consistent_error);

  -- Even structurally valid rows cannot be authorized, edited, or truncated.
  perform pg_temp.a6_reject(format(
    'update ff_private.ff_m4_result_observations set result_kind=%L where id=%L','played',p),
    'Source snapshot history is append-only');
  perform pg_temp.a6_reject(format(
    'update ff_private.ff_m4_result_candidate_settlements set scoring_authorized=true where id=%L',s3),
    'Source snapshot history is append-only');
  perform pg_temp.a6_reject('delete from ff_private.ff_m4_result_candidate_settlements',
    'Source snapshot history is append-only');
  perform pg_temp.a6_reject('truncate ff_private.ff_m4_result_observations cascade',
    'Source snapshot history is append-only');
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
\echo 'PASS: A6 UNKNOWN, independent official witnesses, dated KDK, blocked/corrected immutable revisions'
