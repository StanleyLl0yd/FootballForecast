-- M1: explicit privileged, fail-closed current-season-only refresh.
-- Historical seasons, sealed holdout, evaluated predictions and old source snapshots are untouched.
create table if not exists ff_private.ff_current_refresh_events (
  snapshot_id uuid not null,
  source_match_id text not null check (length(source_match_id) between 1 and 100),
  match_id uuid not null,
  old_status text not null check (old_status='scheduled'),
  new_status text not null check (new_status='finished'),
  old_home_goals integer,
  old_away_goals integer,
  new_home_goals integer not null check (new_home_goals between 0 and 20),
  new_away_goals integer not null check (new_away_goals between 0 and 20),
  kickoff_at timestamptz not null,
  observed_at timestamptz not null default clock_timestamp(),
  primary key(snapshot_id,match_id),
  check (old_home_goals is null and old_away_goals is null)
);
create index if not exists ff_current_refresh_events_match_idx
  on ff_private.ff_current_refresh_events(match_id);
alter table ff_private.ff_current_refresh_events enable row level security;
revoke all on ff_private.ff_current_refresh_events from public,anon,authenticated;
create trigger ff_current_refresh_events_immutable
  before update or delete on ff_private.ff_current_refresh_events
  for each row execute function ff_private.ff_reject_ingest_mutation();
create trigger ff_current_refresh_events_no_truncate
  before truncate on ff_private.ff_current_refresh_events
  for each statement execute function ff_private.ff_reject_ingest_mutation();

create function ff_private.ff_apply_safe_current_refresh(p_snapshot uuid)
returns jsonb
language plpgsql security invoker set search_path = ''
as $m1_refresh$
declare
  v_preview jsonb;
  v_counts jsonb;
  v_baseline uuid;
  v_source uuid;
  v_retrieved timestamptz;
  v_confirmed integer;
  v_finished integer;
  v_updated integer:=0;
  v_linked integer;
  v_item record;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('footballforecast-m1-canonical-promotion'));
  v_preview:=ff_private.ff_preview_footbolno_revision(p_snapshot);
  v_counts:=v_preview->'change_counts';
  v_baseline:=(v_preview->>'baseline_snapshot_id')::uuid;
  v_confirmed:=(v_counts->>'newly_confirmed_times')::integer;
  v_finished:=(v_counts->>'newly_finished')::integer;

  -- Only two explicitly permitted current-season transitions:
  --   date-only scheduled -> scheduled with newly confirmed exact kickoff;
  --   already-known scheduled -> finished with score and same kickoff.
  -- All other drift (including old result corrections and historical edits)
  -- requires a separately reviewed versioned source correction procedure.
  if (v_counts->>'historical_train_or_holdout_changes')::integer<>0
    or (v_counts->>'added')::integer<>0
    or (v_counts->>'removed')::integer<>0
    or (v_counts->>'name_changes')::integer<>0
    or (v_counts->>'source_id_changes')::integer<>0
    or (v_counts->>'calendar_changes')::integer<>0
    or (v_counts->>'finished_regressions')::integer<>0
    or (v_counts->>'status_changes')::integer<>v_finished
    or (v_counts->>'score_changes')::integer<>v_finished
    or (v_counts->>'kickoff_changes')::integer<>v_confirmed
    or (v_counts->>'modified')::integer<>(v_finished+v_confirmed)
  then
    raise exception 'M1 current refresh: review required for source changes';
  end if;

  select source_id,retrieved_at into strict v_source,v_retrieved
  from ff_private.ff_ingest_snapshots where id=p_snapshot;

  for v_item in
    select n.source_match_id,n.kickoff_at as new_kickoff,
      n.home_goals as new_home,n.away_goals as new_away,
      m.id as match_id,m.status as live_status,
      m.kickoff_at as live_kickoff,
      m.home_goals as live_home,m.away_goals as live_away
    from ff_private.ff_ingest_matches n
    join ff_private.ff_ingest_matches old on
      old.snapshot_id=v_baseline and old.season=n.season
      and old.home_source_id=n.home_source_id
      and old.away_source_id=n.away_source_id
    left join public.ff_matches m on
      m.id=pg_catalog.md5('footballforecast:m1:'||v_source::text||':'||
        n.season||':'||n.home_source_id||':'||n.away_source_id)::uuid
    where n.snapshot_id=p_snapshot and n.season='2026/2027'
      and old.status='scheduled' and n.status='finished'
    order by n.source_match_id
  loop
    if v_item.match_id is null or v_item.live_status<>'scheduled'
      or v_item.live_home is not null or v_item.live_away is not null
      or v_item.new_kickoff is null or v_item.new_kickoff>v_retrieved
      or v_item.live_kickoff is distinct from v_item.new_kickoff
      or v_item.new_home is null or v_item.new_away is null
    then
      raise exception 'M1 current refresh: existing fixture transition is unsafe';
    end if;

    insert into ff_private.ff_current_refresh_events(
      snapshot_id,source_match_id,match_id,old_status,new_status,
      old_home_goals,old_away_goals,new_home_goals,new_away_goals,kickoff_at)
    values(p_snapshot,v_item.source_match_id,v_item.match_id,
      v_item.live_status,'finished',v_item.live_home,v_item.live_away,
      v_item.new_home,v_item.new_away,v_item.new_kickoff);

    update public.ff_matches
      set status='finished',home_goals=v_item.new_home,
        away_goals=v_item.new_away,updated_at=clock_timestamp()
      where id=v_item.match_id and status='scheduled'
        and home_goals is null and away_goals is null
        and kickoff_at=v_item.new_kickoff;
    if not found then
      raise exception 'M1 current refresh: concurrent fixture update detected';
    end if;
    v_updated:=v_updated+1;
  end loop;
  if v_updated<>v_finished then
    raise exception 'M1 current refresh: finished-transition count differs';
  end if;

  -- Reuse independently tested all-season canonical idempotence/QC:
  -- newly confirmed date-only fixtures are inserted only with exact times;
  -- existing unchanged fixtures must match exactly; source hashes are versioned.
  perform ff_private.ff_promote_footbolno_snapshot(p_snapshot);
  select count(*) into v_linked from ff_private.ff_published_fixture_links
    where snapshot_id=p_snapshot;
  if v_linked<>(select count(*) from ff_private.ff_ingest_matches
      where snapshot_id=p_snapshot and kickoff_time_confirmed)
    or (select count(*) from ff_private.ff_current_refresh_events
      where snapshot_id=p_snapshot)<>v_updated
  then
    raise exception 'M1 current refresh: promotion and audit counts differ';
  end if;
  return pg_catalog.jsonb_build_object(
    'snapshot_id',p_snapshot,'public_links',v_linked,
    'newly_confirmed_scheduled',v_confirmed,
    'scheduled_to_finished',v_updated,
    'historical_or_holdout_updates',0,
    'automatic_refresh_enabled',false,
    'historical_as_of_verified',false);
end;
$m1_refresh$;
revoke all on function ff_private.ff_apply_safe_current_refresh(uuid)
  from public,anon,authenticated;
