-- M4-A4 synthetic-only disposable PostgreSQL 17 ledger regression.
-- Never run on production. All fixture/model rows are rolled back.
\echo 'M4 private shadow ledger RLS, immutable clock and replay tests'
select 1 / case when (
  select count(*) from pg_class c
  where c.oid in (
    'ff_private.ff_m4_candidate_models'::regclass,
    'ff_private.ff_m4_future_captures'::regclass,
    'ff_private.ff_m4_shadow_entries'::regclass)
    and c.relrowsecurity and c.relforcerowsecurity
)=3
and not has_table_privilege('anon','ff_private.ff_m4_candidate_models','SELECT')
and not has_table_privilege('authenticated','ff_private.ff_m4_future_captures','SELECT')
and not has_table_privilege('service_role','ff_private.ff_m4_shadow_entries','SELECT')
and not has_table_privilege('service_role','ff_private.ff_m4_shadow_entries','INSERT')
and not has_table_privilege('anon','ff_private.ff_m4_shadow_entries','INSERT')
and not has_table_privilege('authenticated','ff_private.ff_m4_candidate_models','UPDATE')
then 1 else 0 end as private_shadow_denies_all_client_roles;

begin;
insert into ff_private.ff_m4_candidate_models (
  model_version,training_scope,training_matches,distinct_clubs,
  source_manifest_sha256,eligible_rows_sha256,model_sha256,model_bytes,
  code_sha,github_run_id,created_at
) values (
  'm4-team-poisson-shrink12-shadow-v1',
  '2018/19-2024/25-development-only',1673,26,
  repeat('a',64),repeat('b',64),
  encode(sha256(convert_to('m4-test-model-only','UTF8')),'hex'),
  convert_to('m4-test-model-only','UTF8'),repeat('a',40),991234567,
  '2010-01-01T00:00:00Z'
);
insert into ff_private.ff_m4_future_captures (
  fixture_key,competition,season,home_club_key,away_club_key,
  kickoff_at,status,revision_kind,
  source_revision_sha256,kickoff_evidence_sha256,team_mapping_sha256,
  source_issuer,kickoff_issuer,source_mac_sha256,kickoff_mac_sha256,
  source_observed_at,kickoff_observed_at,captured_at
) values (
  'rpl-synthetic-future-001','RPL','2026/27','zenit','spartak',
  clock_timestamp()+interval '2 days','scheduled','none',
  repeat('a',64),repeat('b',64),repeat('c',64),
  'source-v1','official-v1',repeat('d',64),repeat('e',64),
  clock_timestamp()-interval '10 seconds',
  clock_timestamp()-interval '5 seconds',
  '2010-01-01T00:00:00Z'
);
-- The DB clock must override attacker-supplied 2010 creation dates.
select 1 / case when (
  select count(*) from ff_private.ff_m4_candidate_models
  where created_at > '2026-11-11T11:04:56Z'::timestamptz
)=1 and (
  select count(*) from ff_private.ff_m4_future_captures
  where captured_at > '2026-11-11T11:04:56Z'::timestamptz
    and captured_at < kickoff_at - interval '15 minutes'
)=1 then 1 else 0 end as actual_pg_creation_clock;

insert into ff_private.ff_m4_shadow_entries (
  capture_id,model_id,fixture_key,revision,idempotency_sha256,
  entry_kind,home_win,draw,away_win,expected_home,expected_away,
  prediction_sha256,committed_at
) select c.id,m.id,c.fixture_key,1,repeat('f',64),'FORECAST',
    0.48,0.28,0.24,1.45,1.07,repeat('1',64),
    '2010-01-01T00:00:00Z'
  from ff_private.ff_m4_future_captures c
  cross join ff_private.ff_m4_candidate_models m
  where c.fixture_key='rpl-synthetic-future-001';

insert into ff_private.ff_m4_shadow_entries (
  capture_id,model_id,fixture_key,revision,previous_entry_id,
  idempotency_sha256,entry_kind,abstention_reason
) select c.id,m.id,c.fixture_key,2,p.id,
  repeat('2',64),'ABSTAIN','INPUT_STATUS_UNCERTAIN'
  from ff_private.ff_m4_future_captures c
  cross join ff_private.ff_m4_candidate_models m
  cross join ff_private.ff_m4_shadow_entries p
  where c.fixture_key='rpl-synthetic-future-001'
    and p.revision=1;

select 1 / case when (
  select count(*) from ff_private.ff_m4_shadow_entries
  where committed_at > '2026-11-11T11:04:56Z'::timestamptz
)=2 and (
  select count(*) from ff_private.ff_m4_shadow_entries
  where entry_kind='FORECAST' and revision=1 and publication_allowed=false
)=1 and (
  select count(*) from ff_private.ff_m4_shadow_entries
  where entry_kind='ABSTAIN' and revision=2 and previous_entry_id is not null
)=1 then 1 else 0 end as immutable_revision_and_abstention;

do $m4$
declare v_capture uuid;v_model uuid;v_prev uuid;
begin
  select id into v_capture from ff_private.ff_m4_future_captures limit 1;
  select id into v_model from ff_private.ff_m4_candidate_models limit 1;
  select id into v_prev from ff_private.ff_m4_shadow_entries where revision=1;
  -- Global idempotency/unique revision protects racing writers.
  begin
    insert into ff_private.ff_m4_shadow_entries (
      capture_id,model_id,fixture_key,revision,idempotency_sha256,
      entry_kind,abstention_reason
    ) values (v_capture,v_model,'rpl-synthetic-future-001',1,
      repeat('3',64),'ABSTAIN','DUPLICATE_REVISION');
    raise exception 'Unexpected duplicate revision inserted';
  exception when unique_violation then null; end;
  begin
    insert into ff_private.ff_m4_shadow_entries (
      capture_id,model_id,fixture_key,revision,previous_entry_id,
      idempotency_sha256,entry_kind,abstention_reason
    ) values (v_capture,v_model,'rpl-synthetic-future-001',3,v_prev,
      repeat('4',64),'ABSTAIN','INVALID_LINEAGE');
    raise exception 'Unexpected wrong lineage inserted';
  exception when others then
    if SQLERRM <> 'M4 revision lineage invalid' then raise; end if;
  end;
  begin
    insert into ff_private.ff_m4_shadow_entries (
      capture_id,model_id,fixture_key,revision,previous_entry_id,
      idempotency_sha256,entry_kind,abstention_reason
    ) values (v_capture,v_model,'rpl-wrong-fixture',3,v_prev,
      repeat('5',64),'ABSTAIN','MISBOUND_FIXTURE');
    raise exception 'Unexpected wrong fixture inserted';
  exception when others then
    if SQLERRM <> 'M4 shadow fixture or capture identity mismatch' then raise; end if;
  end;
  begin
    update ff_private.ff_m4_candidate_models set model_state='SHADOW_CANDIDATE_UNAPPROVED';
    raise exception 'Unexpected private model mutation';
  exception when others then
    if SQLERRM <> 'Source snapshot history is append-only' then raise; end if;
  end;
  begin
    delete from ff_private.ff_m4_future_captures;
    raise exception 'Unexpected private capture deletion';
  exception when others then
    if SQLERRM <> 'Source snapshot history is append-only' then raise; end if;
  end;
  begin
    truncate ff_private.ff_m4_shadow_entries;
    raise exception 'Unexpected ledger truncate';
  exception when others then
    if SQLERRM <> 'Source snapshot history is append-only' then raise; end if;
  end;
end;
$m4$;

-- Inputs cannot make a past fixture look live, even if timestamps are forged.
do $m4$
begin
  begin
    insert into ff_private.ff_m4_future_captures (
      fixture_key,competition,season,home_club_key,away_club_key,
      kickoff_at,status,revision_kind,
      source_revision_sha256,kickoff_evidence_sha256,team_mapping_sha256,
      source_issuer,kickoff_issuer,source_mac_sha256,kickoff_mac_sha256,
      source_observed_at,kickoff_observed_at
    ) values ('rpl-past-rejected','RPL','2026/27','zenit','spartak',
      clock_timestamp()+interval '5 minutes','scheduled','none',
      repeat('a',64),repeat('b',64),repeat('c',64),
      'source-v1','official-v1',repeat('d',64),repeat('e',64),
      clock_timestamp()-interval '10 seconds',
      clock_timestamp()-interval '5 seconds');
    raise exception 'Unexpected late capture inserted';
  exception when others then
    if SQLERRM <> 'M4 capture requires fresh independently signed future sources'
      then raise; end if;
  end;
end;
$m4$;
rollback;

select 1 / case when
  (select count(*) from ff_private.ff_m4_candidate_models)=0
  and (select count(*) from ff_private.ff_m4_future_captures)=0
  and (select count(*) from ff_private.ff_m4_shadow_entries)=0
then 1 else 0 end as no_synthetic_records_committed;
\echo 'PASS: M4 shadow ledger immutable private RLS and pre-kickoff clock'
