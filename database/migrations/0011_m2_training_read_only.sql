-- M2: privileged pinned read-only 2024/25 training cohort, no holdout labels.
create function ff_private.ff_m2_training_rows(p_snapshot uuid, p_sha text)
returns table (
  source_match_id text, season text, dataset_role text,
  kickoff_at timestamptz, home_team_id text, away_team_id text,
  home_goals integer, away_goals integer, status text,
  kickoff_time_confirmed boolean, calendar_date_utc date,
  published_at timestamptz, source_sha256 text, retrieved_at timestamptz
)
language plpgsql stable security invoker set search_path = ''
as $m2$
declare
  v_retrieved timestamptz;
  v_sha text;
begin
  if p_snapshot is null or p_sha is null or p_sha !~ '^[a-f0-9]{64}$' then
    raise exception 'M2 training input: invalid pinned identity';
  end if;
  select s.retrieved_at, s.source_sha256 into v_retrieved, v_sha
  from ff_private.ff_ingest_snapshots s
  join public.ff_sources src on src.id=s.source_id
  where s.id=p_snapshot and s.source_sha256=p_sha
    and s.source_url='https://footbolno.ru/data/league/235-matches.csv'
    and s.license_url='https://footbolno.ru/otkrytye-dannye'
    and src.name='Footbolno' and src.license_status='approved'
    and src.license_reference=s.license_url;
  if v_retrieved is null or v_retrieved<'2025-07-01T00:00:00Z'::timestamptz then
    raise exception 'M2 training input: approved pinned snapshot not found';
  end if;
  -- Only aggregate envelope metadata for sealed_holdout; never its scores.
  if (select count(*) from ff_private.ff_ingest_matches r where r.snapshot_id=p_snapshot)<>720
    or (select count(*) from ff_private.ff_ingest_matches r
        where r.snapshot_id=p_snapshot and r.season='2024/2025'
          and r.dataset_role='train_baseline')<>240
    or (select count(*) from ff_private.ff_ingest_matches r
        where r.snapshot_id=p_snapshot and r.season='2025/2026'
          and r.dataset_role='sealed_holdout')<>240
    or (select count(*) from ff_private.ff_ingest_matches r
        where r.snapshot_id=p_snapshot and r.season='2026/2027'
          and r.dataset_role='current')<>240 then
    raise exception 'M2 training input: incomplete role-separated snapshot';
  end if;
  if exists(
    select 1 from ff_private.ff_ingest_matches r
    where r.snapshot_id=p_snapshot and r.season='2024/2025'
      and (r.dataset_role<>'train_baseline' or r.status<>'finished'
        or r.quarantine_reason is not null or r.published_at is not null
        or r.kickoff_time_confirmed is distinct from true or r.kickoff_at is null
        or r.kickoff_at<'2024-07-01T00:00:00Z'::timestamptz
        or r.kickoff_at>='2025-07-01T00:00:00Z'::timestamptz
        or r.kickoff_at>=v_retrieved
        or r.calendar_date_utc is distinct from
          (r.kickoff_at at time zone 'UTC')::date
        or r.home_goals is null or r.away_goals is null
        or r.home_goals not between 0 and 20
        or r.away_goals not between 0 and 20)
  ) then
    raise exception 'M2 training input: invalid training provenance or chronology';
  end if;
  if (select count(distinct team_id) from (
      select r.home_source_id as team_id from ff_private.ff_ingest_matches r
        where r.snapshot_id=p_snapshot and r.season='2024/2025'
      union all
      select r.away_source_id from ff_private.ff_ingest_matches r
        where r.snapshot_id=p_snapshot and r.season='2024/2025'
    ) sides)<>16
    or exists(select 1 from (
      select team_id,count(*) as appearances from (
        select r.home_source_id as team_id from ff_private.ff_ingest_matches r
          where r.snapshot_id=p_snapshot and r.season='2024/2025'
        union all
        select r.away_source_id from ff_private.ff_ingest_matches r
          where r.snapshot_id=p_snapshot and r.season='2024/2025'
      ) sides group by team_id
    ) clubs where clubs.appearances<>30) then
    raise exception 'M2 training input: invalid training club coverage';
  end if;
  return query
    select r.source_match_id,r.season,r.dataset_role,r.kickoff_at,
      r.home_source_id,r.away_source_id,r.home_goals,r.away_goals,
      r.status,r.kickoff_time_confirmed,r.calendar_date_utc,
      r.published_at,v_sha,v_retrieved
    from ff_private.ff_ingest_matches r
    where r.snapshot_id=p_snapshot and r.season='2024/2025'
      and r.dataset_role='train_baseline'
    order by r.kickoff_at,r.source_match_id;
end;
$m2$;
revoke all on function ff_private.ff_m2_training_rows(uuid,text)
  from public,anon,authenticated;
