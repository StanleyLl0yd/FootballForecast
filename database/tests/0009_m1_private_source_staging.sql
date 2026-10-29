-- M1 SQL integration: purely synthetic, transactional and rolled back.
-- The base fixture creates pg_temp.expect_rejection(code, message).
\echo 'M1 private staging RLS and transactional invariants'
select 1 / case when count(*)=2 then 1 else 0 end as both_private_stage_rls_enabled
from pg_class
where oid in ('ff_private.ff_ingest_snapshots'::regclass,
              'ff_private.ff_ingest_matches'::regclass)
  and relrowsecurity;

select 1 / case when not has_schema_privilege('anon','ff_private','USAGE')
  and not has_table_privilege('anon','ff_private.ff_ingest_snapshots','SELECT')
  and not has_table_privilege('anon','ff_private.ff_ingest_matches','SELECT')
  and not has_table_privilege('authenticated','ff_private.ff_ingest_snapshots','INSERT')
  and not has_table_privilege('authenticated','ff_private.ff_ingest_matches','SELECT')
  then 1 else 0 end as private_api_access_denied;

begin;
insert into public.ff_sources(id,name,license_status,license_reference,approved_at)
values ('31000000-0000-0000-0000-000000000001','m1-synthetic',
  'approved','https://example.invalid/cc-by-4',now());

insert into ff_private.ff_ingest_snapshots(id,source_id,source_url,
  license_url,source_sha256,normalized_sha256,retrieved_at)
values ('32000000-0000-0000-0000-000000000001',
  '31000000-0000-0000-0000-000000000001',
  'https://example.invalid/fixtures.csv','https://example.invalid/license',
  repeat('a',64),jsonb_build_object('2024/2025',repeat('b',64),
    '2025/2026',repeat('c',64),'2026/2027',repeat('d',64)),
  '2026-10-29T16:00:00Z');

insert into ff_private.ff_ingest_matches(snapshot_id,source_match_id,season,
  dataset_role,home_source_id,away_source_id,home_name,away_name,
  calendar_date_utc,kickoff_at,kickoff_time_confirmed,status,
  home_goals,away_goals,quarantine_reason,published_at)
values
  ('32000000-0000-0000-0000-000000000001','historical-1','2024/2025',
   'train_baseline','c1','c2','Club One','Club Two','2024-08-01',
   '2024-08-01T12:00:00Z',true,'finished',2,1,null,null),
  ('32000000-0000-0000-0000-000000000001','holdout-1','2025/2026',
   'sealed_holdout','c1','c3','Club One','Club Three','2025-08-01',
   '2025-08-01T12:00:00Z',true,'finished',1,1,null,null),
  ('32000000-0000-0000-0000-000000000001','current-1','2026/2027',
   'current','c2','c1','Club Two','Club One','2026-11-01',
   null,false,'scheduled',null,null,null,null),
  ('32000000-0000-0000-0000-000000000001','quarantined-1','2026/2027',
   'current','c3','c1','Club Three','Club One','2026-08-01',
   '2026-08-01T12:00:00Z',true,'finished',null,null,'invalid_finished_score',null);
select 1 / case when (select count(*) from ff_private.ff_ingest_matches
  where snapshot_id='32000000-0000-0000-0000-000000000001')=4
then 1 else 0 end as stage_rows_valid;

select pg_temp.expect_rejection($sql$
  insert into ff_private.ff_ingest_matches(snapshot_id,source_match_id,
  season,dataset_role,home_source_id,away_source_id,home_name,away_name,
  calendar_date_utc,kickoff_at,kickoff_time_confirmed,status)
  values('32000000-0000-0000-0000-000000000001','bad-role',
  '2025/2026','train_baseline','c8','c9','Club 8','Club 9',
  '2025-09-01',null,false,'scheduled')
$sql$,'23514','ff_ingest_matches_check');

select pg_temp.expect_rejection($sql$
  insert into ff_private.ff_ingest_matches(snapshot_id,source_match_id,
  season,dataset_role,home_source_id,away_source_id,home_name,away_name,
  calendar_date_utc,kickoff_at,kickoff_time_confirmed,status)
  values('32000000-0000-0000-0000-000000000001','bad-time',
  '2026/2027','current','c7','c9','Club 7','Club 9',
  '2026-11-01',null,true,'scheduled')
$sql$,'23514','ff_ingest_matches_check');

select pg_temp.expect_rejection($sql$
  update ff_private.ff_ingest_matches
  set home_goals=5
  where snapshot_id='32000000-0000-0000-0000-000000000001'
    and source_match_id='historical-1'
$sql$,'P0001','Source snapshot history is append-only');

select pg_temp.expect_rejection($sql$
  delete from ff_private.ff_ingest_snapshots
  where id='32000000-0000-0000-0000-000000000001'
$sql$,'P0001','Source snapshot history is append-only');
rollback;
select 1 / case when (select count(*) from ff_private.ff_ingest_snapshots)=0
    and (select count(*) from ff_private.ff_ingest_matches)=0
then 1 else 0 end as transaction_rollback_clean;
\echo 'PASS: private staging constraints and append-only audit'
