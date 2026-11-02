-- Disposable PG17 synthetic integration only. Never expose held-out labels.
\echo 'M2 private training SELECT permissions and bounded cohort'
select 1 / case when
  not has_function_privilege('anon','ff_private.ff_m2_training_rows(uuid,text)','EXECUTE')
  and not has_function_privilege('authenticated',
    'ff_private.ff_m2_training_rows(uuid,text)','EXECUTE')
  and not has_table_privilege('anon','ff_private.ff_ingest_matches','SELECT')
  and not has_table_privilege('authenticated','ff_private.ff_ingest_matches','SELECT')
  and (select not prosecdef and provolatile='s' from pg_proc
    where oid='ff_private.ff_m2_training_rows(uuid,text)'::regprocedure)
then 1 else 0 end as no_browser_or_definer_read;

do $m2_test$
declare
  v_snapshot uuid;
  v_sha text;
  v_retrieved timestamptz;
  v_rows int;
begin
  select s.id,s.source_sha256,s.retrieved_at
    into strict v_snapshot,v_sha,v_retrieved
  from ff_private.ff_ingest_snapshots s
  where exists(select 1 from ff_private.ff_ingest_matches r
    where r.snapshot_id=s.id and r.dataset_role='train_baseline');
  select count(*) into v_rows from ff_private.ff_m2_training_rows(v_snapshot,v_sha);
  if v_rows<>240 then
    raise exception 'M2 expected 240 synthetic train-only rows';
  end if;
  if exists(select 1 from ff_private.ff_m2_training_rows(v_snapshot,v_sha) r
    where r.season<>'2024/2025' or r.dataset_role<>'train_baseline'
      or r.source_sha256<>v_sha or r.retrieved_at<>v_retrieved
      or r.status<>'finished' or r.published_at is not null) then
    raise exception 'M2 exposed non-training data';
  end if;
  begin
    perform ff_private.ff_m2_training_rows(v_snapshot,repeat('b',64));
    raise exception 'M2 accepted unpinned source';
  exception when others then
    if SQLERRM not like 'M2 training input: approved pinned snapshot not found' then
      raise;
    end if;
  end;
  begin
    perform ff_private.ff_m2_training_rows(
      'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid,v_sha);
    raise exception 'M2 accepted unknown snapshot';
  exception when others then
    if SQLERRM not like 'M2 training input: approved pinned snapshot not found' then
      raise;
    end if;
  end;
end;
$m2_test$;

begin;
do $m2_negative$
declare
  v_original uuid;
  v_corrupt uuid := 'ad000000-0000-0000-0000-000000000011';
  v_sha text := repeat('d',64);
begin
  select s.id into strict v_original
    from ff_private.ff_ingest_snapshots s limit 1;
  insert into ff_private.ff_ingest_snapshots(
    id,source_id,source_url,license_url,source_sha256,normalized_sha256,retrieved_at)
  select v_corrupt,source_id,source_url,license_url,v_sha,
    normalized_sha256,retrieved_at
  from ff_private.ff_ingest_snapshots where id=v_original;
  insert into ff_private.ff_ingest_matches(
    snapshot_id,source_match_id,season,dataset_role,home_source_id,
    away_source_id,home_name,away_name,calendar_date_utc,kickoff_at,
    kickoff_time_confirmed,status,home_goals,away_goals,quarantine_reason,published_at)
  select v_corrupt,source_match_id,season,dataset_role,home_source_id,
    away_source_id,home_name,away_name,calendar_date_utc,
    case when season='2024/2025'
      and source_match_id=(select min(source_match_id)
        from ff_private.ff_ingest_matches
        where snapshot_id=v_original and season='2024/2025')
      then '2026-11-01T12:00:00Z'::timestamptz else kickoff_at end,
    kickoff_time_confirmed,status,home_goals,away_goals,
    quarantine_reason,published_at
  from ff_private.ff_ingest_matches where snapshot_id=v_original;
  begin
    perform ff_private.ff_m2_training_rows(v_corrupt,v_sha);
    raise exception 'M2 accepted invalid synthetic chronology';
  exception when others then
    if SQLERRM not like 'M2 training input: invalid training provenance or chronology' then
      raise;
    end if;
  end;
end;
$m2_negative$;
rollback;
select 1 / case when count(*)=1 then 1 else 0 end as unchanged_synthetic_snapshots
from ff_private.ff_ingest_snapshots;
\echo 'PASS: M2 private training role and chronology gates'
