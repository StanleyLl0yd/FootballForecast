-- M1 synthetic-only, transaction-rolled-back safe current refresh integration.
\echo 'M1 controlled current-season refresh, versioned result and holdout rejection'
begin;

create function pg_temp.m1_clone(
  parent uuid, target uuid, target_hash text, observed timestamptz,
  mode text, fixture text)
returns void language plpgsql as $$
begin
  insert into ff_private.ff_ingest_snapshots(
    id,source_id,source_url,license_url,source_sha256,
    normalized_sha256,retrieved_at)
  select target,source_id,source_url,license_url,target_hash,
    normalized_sha256,observed
  from ff_private.ff_ingest_snapshots where id=parent;

  insert into ff_private.ff_ingest_matches(
    snapshot_id,source_match_id,season,dataset_role,home_source_id,
    away_source_id,home_name,away_name,calendar_date_utc,kickoff_at,
    kickoff_time_confirmed,status,home_goals,away_goals,
    quarantine_reason,published_at)
  select target,source_match_id,season,dataset_role,home_source_id,
    away_source_id,home_name,away_name,calendar_date_utc,
    case when mode='confirm' and season='2026/2027'
      and source_match_id=fixture then '2026-11-01T12:00:00Z'::timestamptz
      else kickoff_at end,
    case when mode='confirm' and season='2026/2027'
      and source_match_id=fixture then true else kickoff_time_confirmed end,
    case when mode='finish' and season='2026/2027'
      and source_match_id=fixture then 'finished' else status end,
    case when mode='finish' and season='2026/2027'
      and source_match_id=fixture then 1
      when mode='holdout' and season='2025/2026'
      and source_match_id=fixture then home_goals+1
      else home_goals end,
    case when mode='finish' and season='2026/2027'
      and source_match_id=fixture then 0 else away_goals end,
    quarantine_reason,published_at
  from ff_private.ff_ingest_matches where snapshot_id=parent;
end;
$$;

do $m1_test$
declare
  base uuid;
  a uuid:='ea000000-0000-0000-0000-000000000001';
  b uuid:='ea000000-0000-0000-0000-000000000002';
  c uuid:='ea000000-0000-0000-0000-000000000003';
  current_id text;
  heldout_id text;
  result jsonb;
  current_fixture_id uuid;
  current_status text;
  actual_home integer;
  actual_away integer;
  pre_forecasts integer;
begin
  select count(*) into pre_forecasts from public.ff_forecasts;
  select id into strict base from ff_private.ff_ingest_snapshots
  where exists(select 1 from ff_private.ff_published_fixture_links l
    where l.snapshot_id=ff_ingest_snapshots.id);
  select min(source_match_id) into strict current_id
    from ff_private.ff_ingest_matches
    where snapshot_id=base and season='2026/2027';
  select min(source_match_id) into strict heldout_id
    from ff_private.ff_ingest_matches
    where snapshot_id=base and season='2025/2026';
  if current_id is null or heldout_id is null then
    raise exception 'M1 safe refresh synthetic prerequisites missing';
  end if;

  perform pg_temp.m1_clone(base,a,repeat('c',64),
    '2026-10-29T16:00:00Z'::timestamptz,'confirm',current_id);
  result:=ff_private.ff_apply_safe_current_refresh(a);
  if (result->>'newly_confirmed_scheduled')::int<>1
    or (result->>'scheduled_to_finished')::int<>0
    or (result->>'public_links')::int<>481
    or (result->>'already_published')::boolean
    or (select count(*) from public.ff_matches)<>483
    or (select count(*) from ff_private.ff_current_refresh_events)<>0
  then
    raise exception 'M1 safe refresh did not add exactly one newly confirmed fixture';
  end if;

  perform pg_temp.m1_clone(a,b,repeat('d',64),
    '2026-11-02T18:00:00Z'::timestamptz,'finish',current_id);
  result:=ff_private.ff_apply_safe_current_refresh(b);
  if (result->>'newly_confirmed_scheduled')::int<>0
    or (result->>'scheduled_to_finished')::int<>1
    or (result->>'public_links')::int<>481
    or (result->>'already_published')::boolean
    or (select count(*) from ff_private.ff_current_refresh_events
        where snapshot_id=b)<>1
  then
    raise exception 'M1 safe refresh did not record scheduled-to-finished transition';
  end if;
  select l.match_id into strict current_fixture_id
  from ff_private.ff_published_fixture_links l
  join ff_private.ff_ingest_matches r
    on r.snapshot_id=l.snapshot_id and r.source_match_id=l.source_match_id
  where l.snapshot_id=b and r.source_match_id=current_id
    and r.season='2026/2027';
  select status,home_goals,away_goals
    into strict current_status,actual_home,actual_away
  from public.ff_matches where id=current_fixture_id;
  if current_status<>'finished' or actual_home<>1 or actual_away<>0
    or (select count(*) from public.ff_matches)<>483
  then
    raise exception 'M1 safe refresh did not preserve canonical identity or final score';
  end if;
  result:=ff_private.ff_apply_safe_current_refresh(b);
  if not (result->>'already_published')::boolean
    or (select count(*) from ff_private.ff_current_refresh_events)<>1
    or (select count(*) from public.ff_matches)<>483
  then
    raise exception 'M1 safe refresh replay was not idempotent';
  end if;

  perform pg_temp.m1_clone(b,c,repeat('e',64),
    '2026-11-03T12:00:00Z'::timestamptz,'holdout',heldout_id);
  begin
    perform ff_private.ff_apply_safe_current_refresh(c);
    raise exception 'M1 safe refresh wrongly accepted a sealed-holdout correction';
  exception when others then
    if SQLERRM<>'M1 current refresh: review required for source changes' then
      raise;
    end if;
  end;
  if (select count(*) from ff_private.ff_current_refresh_events)<>1
    or (select count(*) from public.ff_matches)<>483
    or (select count(*) from public.ff_forecasts)<>pre_forecasts
  then
    raise exception 'M1 safe refresh holdout refusal had side effects';
  end if;
end;
$m1_test$;

rollback;
select 1 / case when
  (select count(*) from ff_private.ff_ingest_snapshots)=1
  and (select count(*) from ff_private.ff_ingest_matches)=720
  and (select count(*) from public.ff_matches)=482
  and (select count(*) from ff_private.ff_published_fixture_links)=480
  and (select count(*) from ff_private.ff_current_refresh_events)=0
then 1 else 0 end as fully_rolled_back_synthetic_refresh;
\echo 'PASS: only narrow current fixture changes, private audit and replay safety'
