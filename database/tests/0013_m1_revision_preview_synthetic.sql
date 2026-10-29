-- Disposable PostgreSQL 17 only; no real provider rows or credentials.
-- A synthetic snapshot is copied and mutated *inside ROLLBACK*.
\echo 'M1 immutable baseline, controlled synthetic drift preview and rollback'
begin;
do $m1_test$
declare
  base_id uuid;
  next_id uuid := 'eb000000-0000-0000-0000-000000000008';
  future_id text;
  holdout_id text;
  base_report jsonb;
  changed jsonb;
  changes jsonb;
begin
  select s.id into strict base_id
  from ff_private.ff_ingest_snapshots s
  where exists (select 1 from ff_private.ff_published_fixture_links l
    where l.snapshot_id=s.id);
  base_report:=ff_private.ff_preview_footbolno_revision(base_id);
  if (base_report->>'requires_review')::boolean
     or (base_report->'change_counts'->>'unchanged')::int<>720
     or (base_report->'change_counts'->>'modified')::int<>0
     or (base_report->>'auto_updates_enabled')::boolean
     or (base_report->>'historical_as_of_verified')::boolean
  then
    raise exception 'M1 revision preview: unmodified baseline incorrectly classified';
  end if;

  select min(source_match_id) into strict future_id
  from ff_private.ff_ingest_matches
  where snapshot_id=base_id and season='2026/2027'
    and status='scheduled' and kickoff_at is null;
  select min(source_match_id) into strict holdout_id
  from ff_private.ff_ingest_matches
  where snapshot_id=base_id and season='2025/2026'
    and status='finished';
  if future_id is null or holdout_id is null then
    raise exception 'M1 revision preview: fixture prerequisites missing';
  end if;

  insert into ff_private.ff_ingest_snapshots(
    id,source_id,source_url,license_url,source_sha256,normalized_sha256,retrieved_at)
  select next_id,source_id,source_url,license_url,repeat('e',64),
     normalized_sha256,retrieved_at+interval '1 hour'
  from ff_private.ff_ingest_snapshots where id=base_id;

  insert into ff_private.ff_ingest_matches(
    snapshot_id,source_match_id,season,dataset_role,home_source_id,
    away_source_id,home_name,away_name,calendar_date_utc,kickoff_at,
    kickoff_time_confirmed,status,home_goals,away_goals,
    quarantine_reason,published_at)
  select next_id,source_match_id,season,dataset_role,home_source_id,
    away_source_id,home_name,away_name,calendar_date_utc,
    case when season='2026/2027' and source_match_id=future_id
      then '2026-11-01T12:00:00Z'::timestamptz else kickoff_at end,
    case when season='2026/2027' and source_match_id=future_id
      then true else kickoff_time_confirmed end,
    status,
    case when season='2025/2026' and source_match_id=holdout_id
      then home_goals+1 else home_goals end,
    away_goals,quarantine_reason,published_at
  from ff_private.ff_ingest_matches where snapshot_id=base_id;

  changed:=ff_private.ff_preview_footbolno_revision(next_id);
  changes:=changed->'change_counts';
  if (changes->>'modified')::int<>2
    or (changes->>'unchanged')::int<>718
    or (changes->>'added')::int<>0
    or (changes->>'removed')::int<>0
    or (changes->>'score_changes')::int<>1
    or (changes->>'kickoff_changes')::int<>1
    or (changes->>'newly_confirmed_times')::int<>1
    or (changes->>'historical_train_or_holdout_changes')::int<>1
    or not (changed->>'requires_review')::boolean
    or (changed->>'auto_updates_enabled')::boolean
    or pg_catalog.jsonb_array_length(changed->'seasons')<>3
  then
    raise exception 'M1 revision preview: changed record aggregates not recognized';
  end if;
  if not exists (
    select 1 from pg_catalog.jsonb_array_elements(changed->'seasons') s
    where s->>'season'='2025/2026'
      and (s->>'score_changes')::int=1
      and (s->>'modified')::int=1
  ) or not exists (
    select 1 from pg_catalog.jsonb_array_elements(changed->'seasons') s
    where s->>'season'='2026/2027'
      and (s->>'newly_confirmed_times')::int=1
      and (s->>'modified')::int=1
  ) then
    raise exception 'M1 revision preview: season separation violated';
  end if;
  if (select count(*) from public.ff_matches)<>482 then
    raise exception 'M1 revision preview unexpectedly mutated public fixtures';
  end if;
  begin
    perform ff_private.ff_preview_footbolno_revision(
      'ed000000-0000-0000-0000-000000000099'::uuid);
    raise exception 'M1 revision preview accepted unrecognized snapshot';
  exception when others then
    if SQLERRM not like 'M1 revision review: approved snapshot not found' then
      raise;
    end if;
  end;
end;
$m1_test$;
rollback;
select 1 / case when (select count(*) from ff_private.ff_ingest_snapshots)=1
  and (select count(*) from ff_private.ff_ingest_matches)=720
  and (select count(*) from public.ff_matches)=482
  and (select count(*) from public.ff_forecasts)>=1
then 1 else 0 end as read_only_revision_test_rolled_back;
\echo 'PASS: revision preview compares synthetic immutable versions without writes'
